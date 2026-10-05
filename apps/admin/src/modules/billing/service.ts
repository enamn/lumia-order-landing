import { z } from "zod";
import { Prisma, type Subscription } from "@prisma/client";
import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { lumiaApi } from "@/server/lumia-api";
import { PLANS, RETRY_DAYS, addPeriod, isUpgrade, quoteRenewal, quoteSignup, quoteUpgrade, type Billing, type PlanId, type Quote } from "./plans";

// Subscriptions are run by Lumia: the plan, the billing period, renewals, retries, plan changes, cancellation and invoices all live here.
// Stripe only takes each payment and keeps the card on file (through lumia-order-api). Card details never reach Lumia.
export const TRIAL_DAYS = 14;
export type { PlanId, Billing } from "./plans";
export type SubStatus = "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "ENDED";
interface Card { brand: string; last4: string; expMonth: number; expYear: number }
interface Terminal { stage: number; dates: string[]; tracking?: string }
const isActive = (s: { status: string } | null | undefined) => s?.status === "ACTIVE" || s?.status === "PAST_DUE";

// What each plan allows. Without an active plan (trial, cancelled or lapsed) the smallest plan's limits apply.
export function entitlements(sub: Pick<Subscription, "status" | "plan"> | null) {
  const plan = isActive(sub) ? (sub!.plan as PlanId) : undefined;
  return { plan: plan ?? null, branches: plan === "pro" ? 3 : 1, customers: plan === "plus" || plan === "pro", staff: plan === "pro" ? 10 : plan === "plus" ? 3 : 1 };
}
export const trialInfo = (createdAt: Date, now = Date.now()) => {
  const endsAt = new Date(createdAt.getTime() + TRIAL_DAYS * 86_400_000);
  return { endsAt: endsAt.toISOString(), daysLeft: Math.max(0, Math.min(TRIAL_DAYS, Math.ceil((endsAt.getTime() - now) / 86_400_000))) };
};
export const getSubscriptionFor = async (businessId: string) => db.subscription.findFirst({ where: { businessId } });
export async function entitlementsFor(businessId: string) { return entitlements(await getSubscriptionFor(businessId)); }
// Calling customers by name is for Plus and Pro, and for restaurants still in their free trial. Starter keeps replies impersonal.
export async function canPersonalize(businessId: string): Promise<boolean> {
  const [sub, b] = await Promise.all([getSubscriptionFor(businessId), db.business.findUniqueOrThrow({ where: { id: businessId }, select: { createdAt: true } })]);
  if (isActive(sub)) return sub!.plan !== "starter";
  return !sub && trialInfo(b.createdAt).daysLeft > 0;
}

// What we already know about the restaurant, used to pre-fill the payment page and Stripe so nobody types it twice.
async function knownDetails(businessId: string) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, phone: true, email: true, vatRegistered: true, taxRegistrationNumber: true, settings: true, locations: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 1, select: { addressLine1: true, city: true, emirate: true } } } });
  const loc = b.locations[0], legal = (b.settings as { profile?: { name?: string } } | null)?.profile?.name;
  const address = [loc?.addressLine1, loc?.city, loc?.emirate].filter(Boolean).join(", ");
  return { name: legal || b.name, phone: b.phone ?? undefined, email: b.email ?? undefined, trn: b.vatRegistered && /^\d{15}$/.test(b.taxRegistrationNumber ?? "") ? b.taxRegistrationNumber! : undefined, address, line1: loc?.addressLine1 || undefined, city: loc?.city || undefined, state: loc?.emirate || undefined };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
export async function getSubscription(userId: string, businessId: string) {
  const { member } = await authorize(userId, businessId);
  const [b, sub, known] = await Promise.all([db.business.findUniqueOrThrow({ where: { id: businessId }, select: { createdAt: true, stripeCustomerId: true } }), getSubscriptionFor(businessId), knownDetails(businessId)]);
  const active = isActive(sub), nextPlan = (sub?.pendingPlan ?? sub?.plan) as PlanId | undefined, nextBilling = (sub?.pendingBilling ?? sub?.billing) as Billing | undefined;
  return {
    status: (sub?.status ?? "NONE") as SubStatus, plan: sub?.plan, billing: sub?.billing, currentPeriodStart: iso(sub?.currentPeriodStart), currentPeriodEnd: iso(sub?.currentPeriodEnd), cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    pendingPlan: sub?.pendingPlan ?? undefined, pendingBilling: sub?.pendingBilling ?? undefined, failedAttempts: sub?.failedAttempts ?? 0, lastFailure: sub?.lastFailure ?? undefined,
    nextCharge: active && !sub!.cancelAtPeriodEnd && nextPlan && nextBilling ? { at: iso(sub!.nextChargeAt ?? sub!.currentPeriodEnd)!, amountMinor: quoteRenewal(nextPlan, nextBilling).totalMinor } : null,
    card: (sub?.card as Card | null) ?? undefined, terminals: sub?.terminals, terminalAddress: sub?.terminalAddress ?? undefined, terminal: (sub?.terminal as Terminal | null) ?? undefined, startedAt: iso(sub?.startedAt),
    hasCustomer: Boolean(sub?.stripeCustomerId || b.stripeCustomerId), defaults: { address: known.address }, canManage: member.role === "OWNER" || member.role === "ADMIN",
    trial: trialInfo(b.createdAt), entitlements: entitlements(sub),
  };
}

// ---- calls to lumia-order-api (Stripe) ----
async function api<T>(path: string, body: unknown): Promise<T> {
  const r = await lumiaApi<T>(path, body, 28_000);
  if (!r.ok) throw new AppError(r.code === "BILLING_NOT_CONFIGURED" ? "BILLING_NOT_CONFIGURED" : "BILLING_UNAVAILABLE", r.code === "BILLING_NOT_CONFIGURED" ? "Payments are not switched on yet. Please contact Lumia to subscribe." : "We couldn’t reach the payment service. Please try again.", 503);
  return r.data;
}
interface CheckoutReply { id: string; url?: string; clientSecret?: string; publishableKey?: string; customerId?: string }
interface SessionSummary { sessionId: string; mode: "payment" | "setup"; complete: boolean; paid: boolean; customerId?: string; paymentMethodId?: string; paymentIntentId?: string; amountTotalMinor?: number; metadata: Record<string, string> }
interface ChargeReply { status: "succeeded" | "requires_action" | "failed"; paymentIntentId?: string; failureCode?: string; failureMessage?: string }
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const checkoutSchema = z.object({ plan: z.enum(["starter", "plus", "pro"]), billing: z.enum(["monthly", "yearly"]), terminals: z.number().int().min(1).max(10), address: z.string().trim().min(6).max(400) }).strict();

async function customerPayload(userId: string, businessId: string) {
  const [user, known] = await Promise.all([db.user.findUnique({ where: { id: userId }, select: { email: true, preferredLanguage: true } }), knownDetails(businessId)]);
  const email = known.email || (user?.email && !user.email.endsWith(".invalid") ? user.email : undefined);
  const customer = { name: known.name, ...(known.phone ? { phone: known.phone } : {}), ...(known.trn ? { trn: known.trn } : {}), ...(known.line1 || known.city || known.state ? { address: { line1: known.line1, city: known.city, state: known.state } } : {}), language: user?.preferredLanguage === "ar" ? "ar" : "en" };
  return { customer, ...(email ? { email } : {}) };
}
async function rememberCustomer(businessId: string, customerId: string | undefined) { if (customerId) await db.business.update({ where: { id: businessId }, data: { stripeCustomerId: customerId } }); }

// First payment: the plan plus the terminal(s). Stripe takes it and keeps the card; the subscription starts when the payment is confirmed.
export async function startCheckout(userId: string, businessId: string, input: unknown) {
  const data = checkoutSchema.safeParse(input);
  if (!data.success) throw new AppError("VALIDATION_FAILED", "Choose a plan and add a delivery address for the terminal.", 400);
  await authorize(userId, businessId, "business.manage");
  const [existing, b] = await Promise.all([getSubscriptionFor(businessId), db.business.findUniqueOrThrow({ where: { id: businessId }, select: { stripeCustomerId: true } })]);
  if (isActive(existing)) throw new AppError("ALREADY_SUBSCRIBED", "This restaurant already has a plan. Change it from Billing.", 409);
  const { plan, billing, terminals, address } = data.data, quote = quoteSignup(plan, billing, terminals);
  const reply = await api<CheckoutReply>("/internal/billing/checkout", {
    businessId, mode: "payment", embedded: true, returnUrl: `${appUrl()}/dashboard?businessId=${businessId}`, ...(await customerPayload(userId, businessId)), ...(b.stripeCustomerId || existing?.stripeCustomerId ? { customerId: b.stripeCustomerId ?? existing?.stripeCustomerId } : {}),
    lines: [...quote.lines, { name: "VAT (5%)", unitMinor: quote.vatMinor, quantity: 1 }], // the form charges exactly quote.totalMinor
    description: `Lumia Order ${PLANS[plan].name} (${billing})`, shippingAddress: address,
    note: `${PLANS[plan].name} plan + ${terminals} ${terminals === 1 ? "terminal" : "terminals"}. The terminal ships to: ${address}`,
    metadata: { kind: "signup", plan, billing, terminals: String(terminals), terminalAddress: address.slice(0, 400), total: String(quote.totalMinor) },
  });
  await rememberCustomer(businessId, reply.customerId);
  return { sessionId: reply.id, url: reply.url, clientSecret: reply.clientSecret, publishableKey: reply.publishableKey };
}

// Replace the card used for renewals (also how a failed renewal is fixed).
export async function startCardUpdate(userId: string, businessId: string) {
  await authorize(userId, businessId, "business.manage");
  const [sub, b] = await Promise.all([getSubscriptionFor(businessId), db.business.findUniqueOrThrow({ where: { id: businessId }, select: { stripeCustomerId: true } })]);
  const customerId = sub?.stripeCustomerId ?? b.stripeCustomerId;
  if (!customerId) throw new AppError("NO_SUBSCRIPTION", "There is no card on file yet.", 409);
  const reply = await api<CheckoutReply>("/internal/billing/checkout", { businessId, mode: "setup", embedded: true, returnUrl: `${appUrl()}/dashboard?businessId=${businessId}`, customerId, ...(await customerPayload(userId, businessId)), description: "Lumia Order card", metadata: { kind: "card" } });
  return { sessionId: reply.id, url: reply.url, clientSecret: reply.clientSecret, publishableKey: reply.publishableKey };
}

async function nextInvoiceNumber(now: Date): Promise<string> {
  const id = `invoice-${now.getUTCFullYear()}`;
  for (let attempt = 0; ; attempt++) {
    try { const c = await db.billingCounter.upsert({ where: { id }, create: { id, value: 1 }, update: { value: { increment: 1 } } }); return `LO-${now.getUTCFullYear()}-${String(c.value).padStart(6, "0")}`; }
    catch (e) { if (attempt < 4 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; throw e; }
  }
}
async function writeInvoice(s: Subscription, kind: "SIGNUP" | "RENEWAL" | "UPGRADE", quote: Quote, period: { start: Date; end: Date }, paymentIntentId: string | undefined, now: Date) {
  const known = await knownDetails(s.businessId);
  return db.billingInvoice.create({ data: { businessId: s.businessId, subscriptionId: s.id, number: await nextInvoiceNumber(now), kind, status: "PAID", lines: quote.lines as unknown as Prisma.InputJsonValue, subtotalMinor: quote.subtotalMinor, vatMinor: quote.vatMinor, totalMinor: quote.totalMinor, periodStart: period.start, periodEnd: period.end, stripePaymentIntentId: paymentIntentId ?? null,
    billedTo: { name: known.name, trn: known.trn ?? null, address: known.address, email: known.email ?? null } as unknown as Prisma.InputJsonValue, createdAt: now } });
}
async function cardOf(paymentMethodId: string | undefined): Promise<Card | undefined> {
  if (!paymentMethodId) return undefined;
  const r = await lumiaApi<Card>("/internal/billing/card", { paymentMethodId }, 15_000);
  return r.ok ? r.data : undefined; // the card summary is a nicety; the subscription works without it
}

// A finished payment form (confirmed by the dashboard, or reported by Stripe's webhook). Safe to run twice: each session counts once.
export async function applySession(businessId: string, session: SessionSummary, now = new Date()) {
  if (session.metadata.businessId !== businessId) throw new AppError("NOT_FOUND", "Payment not found.", 404);
  if (!session.complete || !session.paid) return { applied: false, reason: "NOT_PAID" as const };
  const existing = await getSubscriptionFor(businessId);
  if (existing?.processedSessions.includes(session.sessionId)) return { applied: false, reason: "ALREADY_APPLIED" as const };
  const kind = session.metadata.kind;
  if (session.customerId) await rememberCustomer(businessId, session.customerId);
  if (kind === "card") {
    if (!existing || !session.paymentMethodId) return { applied: false, reason: "NO_SUBSCRIPTION" as const };
    const card = await cardOf(session.paymentMethodId);
    await db.subscription.update({ where: { id: existing.id }, data: { stripePaymentMethodId: session.paymentMethodId, ...(session.customerId ? { stripeCustomerId: session.customerId } : {}), ...(card ? { card: card as unknown as Prisma.InputJsonValue } : {}), processedSessions: { push: session.sessionId } } });
    if (existing.status === "PAST_DUE") await billOne({ ...existing, stripePaymentMethodId: session.paymentMethodId }, now, true); // new card: try the unpaid renewal straight away
    return { applied: true, kind: "card" as const };
  }
  if (kind !== "signup") return { applied: false, reason: "UNKNOWN_KIND" as const };
  const plan = session.metadata.plan as PlanId, billing = session.metadata.billing as Billing, terminals = Number(session.metadata.terminals) || 1;
  if (!(plan in PLANS) || (billing !== "monthly" && billing !== "yearly")) throw new AppError("VALIDATION_FAILED", "Unknown plan.", 400);
  const quote = quoteSignup(plan, billing, terminals);
  if (session.amountTotalMinor !== quote.totalMinor) { console.error(JSON.stringify({ level: "error", code: "BILLING_AMOUNT_MISMATCH", expected: quote.totalMinor, got: session.amountTotalMinor })); throw new AppError("AMOUNT_MISMATCH", "The payment did not match the plan. Please contact Lumia.", 409); }
  const end = addPeriod(now, billing), card = await cardOf(session.paymentMethodId);
  const data = { plan, billing, status: "ACTIVE", terminals, terminalAddress: session.metadata.terminalAddress || null, terminal: { stage: 0, dates: [now.toISOString()] } as unknown as Prisma.InputJsonValue,
    stripeCustomerId: session.customerId ?? null, stripePaymentMethodId: session.paymentMethodId ?? null, ...(card ? { card: card as unknown as Prisma.InputJsonValue } : {}), currentPeriodStart: now, currentPeriodEnd: end, nextChargeAt: end, cancelAtPeriodEnd: false, pendingPlan: null, pendingBilling: null, failedAttempts: 0, lastFailure: null, startedAt: now };
  const sub = existing ? await db.subscription.update({ where: { id: existing.id }, data: { ...data, processedSessions: { push: session.sessionId } } }) : await db.subscription.create({ data: { businessId, ...data, processedSessions: [session.sessionId] } });
  await writeInvoice(sub, "SIGNUP", quote, { start: now, end }, session.paymentIntentId, now);
  return { applied: true, kind: "signup" as const };
}

export async function confirmSession(userId: string, businessId: string, input: unknown) {
  const { sessionId } = z.object({ sessionId: z.string().regex(/^cs_\w+$/) }).strict().parse(input);
  await authorize(userId, businessId, "business.manage");
  const session = await api<SessionSummary>("/internal/billing/session", { sessionId });
  const result = await applySession(businessId, session);
  return { ...result, subscription: await getSubscription(userId, businessId) };
}
// The webhook's version: the session was already looked up at Stripe by lumia-order-api.
export async function handleBillingEvent(input: unknown) {
  const e = z.object({ id: z.string().max(100), type: z.string().max(80), session: z.object({ sessionId: z.string(), mode: z.enum(["payment", "setup"]), complete: z.boolean(), paid: z.boolean(), customerId: z.string().optional(), paymentMethodId: z.string().optional(), paymentIntentId: z.string().optional(), amountTotalMinor: z.number().optional(), metadata: z.record(z.string(), z.string()) }) }).parse(input);
  if (e.type !== "checkout.session.completed" || !e.session.metadata.businessId) return { ok: true, ignored: true };
  const exists = await db.business.findUnique({ where: { id: e.session.metadata.businessId }, select: { id: true } });
  if (!exists) return { ok: true, matched: false };
  return { ok: true, ...(await applySession(exists.id, e.session)) };
}

// ---- renewals ----
// Charges every subscription that is due. Run on a schedule (see /api/internal/billing/run); running it twice is harmless because each
// subscription is claimed before charging and each charge carries an idempotency key.
export async function runBilling(now = new Date()) {
  const due = await db.subscription.findMany({ where: { status: { in: ["ACTIVE", "PAST_DUE"] }, nextChargeAt: { lte: now } }, take: 200 });
  const out = { checked: due.length, renewed: 0, failed: 0, ended: 0, skipped: 0 };
  for (const s of due) {
    try { const r = await billOne(s, now); if (r === "renewed") out.renewed++; else if (r === "failed") out.failed++; else if (r === "ended") out.ended++; else out.skipped++; }
    catch { out.skipped++; console.error(JSON.stringify({ level: "error", code: "BILLING_RUN_ITEM_FAILED" })); }
  }
  return out;
}
type BillResult = "renewed" | "failed" | "ended" | "skipped";
async function billOne(s: Subscription, now: Date, force = false): Promise<BillResult> {
  if (!force) { const claim = await db.subscription.updateMany({ where: { id: s.id, nextChargeAt: s.nextChargeAt }, data: { nextChargeAt: new Date(now.getTime() + 15 * 60_000) } }); if (!claim.count) return "skipped"; }
  if (s.cancelAtPeriodEnd && s.currentPeriodEnd <= now) { await db.subscription.update({ where: { id: s.id }, data: { status: "CANCELED", nextChargeAt: null } }); return "ended"; }
  const plan = (s.pendingPlan ?? s.plan) as PlanId, billing = (s.pendingBilling ?? s.billing) as Billing, quote = quoteRenewal(plan, billing), attempt = s.failedAttempts + 1;
  const fail = async (message: string): Promise<BillResult> => {
    if (attempt > RETRY_DAYS.length) { await db.subscription.update({ where: { id: s.id }, data: { status: "ENDED", nextChargeAt: null, failedAttempts: attempt, lastFailure: message } }); return "ended"; }
    await db.subscription.update({ where: { id: s.id }, data: { status: "PAST_DUE", failedAttempts: attempt, lastFailure: message, nextChargeAt: new Date(now.getTime() + RETRY_DAYS[attempt - 1]! * 86_400_000) } });
    return "failed";
  };
  if (!s.stripeCustomerId || !s.stripePaymentMethodId) return fail("No card on file.");
  let charge: ChargeReply;
  try { charge = await api<ChargeReply>("/internal/billing/charge", { customerId: s.stripeCustomerId, paymentMethodId: s.stripePaymentMethodId, amountMinor: quote.totalMinor, description: `Lumia Order ${PLANS[plan].name} (${billing}) renewal`, idempotencyKey: `renew:${s.id}:${s.currentPeriodEnd.toISOString().slice(0, 10)}:${attempt}`, metadata: { kind: "renewal", subscriptionId: s.id, businessId: s.businessId } }); }
  catch { await db.subscription.update({ where: { id: s.id }, data: { nextChargeAt: new Date(now.getTime() + 60 * 60_000) } }); return "skipped"; } // payment service unreachable: not the customer's fault, try again in an hour
  if (charge.status !== "succeeded") return fail(charge.failureMessage ?? "The payment did not go through.");
  const start = s.currentPeriodEnd, end = addPeriod(start, billing);
  const sub = await db.subscription.update({ where: { id: s.id }, data: { plan, billing, pendingPlan: null, pendingBilling: null, currentPeriodStart: start, currentPeriodEnd: end, nextChargeAt: end, status: "ACTIVE", failedAttempts: 0, lastFailure: null } });
  try { await writeInvoice(sub, "RENEWAL", quote, { start, end }, charge.paymentIntentId, now); } catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; }
  return "renewed";
}

// ---- changes made by the owner ----
const planSchema = z.object({ plan: z.enum(["starter", "plus", "pro"]), billing: z.enum(["monthly", "yearly"]) }).strict();
export async function quotePlanChange(userId: string, businessId: string, input: unknown, now = new Date()) {
  const { plan, billing } = planSchema.parse(input);
  await authorize(userId, businessId);
  const s = await getSubscriptionFor(businessId);
  if (!isActive(s)) throw new AppError("NO_SUBSCRIPTION", "Subscribe to a plan first.", 409);
  const sameCycle = billing === s!.billing;
  if (plan === s!.plan && sameCycle) return { kind: "none" as const };
  if (sameCycle && isUpgrade(s!.plan as PlanId, plan)) { const q = quoteUpgrade(s!.plan as PlanId, plan, billing, s!.currentPeriodStart, s!.currentPeriodEnd, now); return { kind: "upgrade" as const, now: true, totalMinor: q.totalMinor, vatMinor: q.vatMinor, effectiveAt: now.toISOString() }; }
  return { kind: "scheduled" as const, now: false, totalMinor: 0, effectiveAt: s!.currentPeriodEnd.toISOString(), renewalMinor: quoteRenewal(plan, billing).totalMinor };
}
export async function changePlan(userId: string, businessId: string, input: unknown, now = new Date()) {
  const { plan, billing } = planSchema.parse(input);
  await authorize(userId, businessId, "business.manage");
  const s = await getSubscriptionFor(businessId);
  if (!isActive(s)) throw new AppError("NO_SUBSCRIPTION", "Subscribe to a plan first.", 409);
  const sameCycle = billing === s!.billing;
  if (plan === s!.plan && sameCycle) { await db.subscription.update({ where: { id: s!.id }, data: { pendingPlan: null, pendingBilling: null } }); return getSubscription(userId, businessId); } // choosing the current plan again cancels a scheduled change
  if (sameCycle && isUpgrade(s!.plan as PlanId, plan)) {
    if (s!.status === "PAST_DUE") throw new AppError("PAYMENT_OVERDUE", "Update your card and pay the overdue renewal before upgrading.", 409);
    if (!s!.stripeCustomerId || !s!.stripePaymentMethodId) throw new AppError("NO_CARD", "Add a card first.", 409);
    const q = quoteUpgrade(s!.plan as PlanId, plan, billing, s!.currentPeriodStart, s!.currentPeriodEnd, now);
    if (q.totalMinor >= 200) {
      const charge = await api<ChargeReply>("/internal/billing/charge", { customerId: s!.stripeCustomerId, paymentMethodId: s!.stripePaymentMethodId, amountMinor: q.totalMinor, description: `Lumia Order upgrade to ${PLANS[plan].name}`, idempotencyKey: `upgrade:${s!.id}:${s!.plan}:${plan}:${s!.currentPeriodEnd.toISOString().slice(0, 10)}`, metadata: { kind: "upgrade", subscriptionId: s!.id, businessId } });
      if (charge.status !== "succeeded") throw new AppError("PAYMENT_FAILED", charge.failureMessage ?? "The payment did not go through. Try another card.", 402);
      const sub = await db.subscription.update({ where: { id: s!.id }, data: { plan, pendingPlan: null, pendingBilling: null } });
      await writeInvoice(sub, "UPGRADE", q, { start: now, end: s!.currentPeriodEnd }, charge.paymentIntentId, now);
    } else await db.subscription.update({ where: { id: s!.id }, data: { plan, pendingPlan: null, pendingBilling: null } }); // nothing left to pay for
    return getSubscription(userId, businessId);
  }
  await db.subscription.update({ where: { id: s!.id }, data: { pendingPlan: plan, pendingBilling: billing } }); // downgrades and billing-cycle changes start at the next renewal
  return getSubscription(userId, businessId);
}
export async function setCancel(userId: string, businessId: string, cancel: boolean) {
  await authorize(userId, businessId, "business.manage");
  const s = await getSubscriptionFor(businessId);
  if (!isActive(s)) throw new AppError("NO_SUBSCRIPTION", "There is no active plan.", 409);
  await db.subscription.update({ where: { id: s!.id }, data: { cancelAtPeriodEnd: cancel, ...(cancel ? { pendingPlan: null, pendingBilling: null } : {}) } });
  return getSubscription(userId, businessId);
}

export async function listInvoices(userId: string, businessId: string) {
  await authorize(userId, businessId);
  const rows = await db.billingInvoice.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 60 });
  return rows.map(r => ({ id: r.id, number: r.number, kind: r.kind, status: r.status, totalMinor: r.totalMinor, vatMinor: r.vatMinor, currency: r.currency, createdAt: r.createdAt.toISOString(), periodStart: r.periodStart.toISOString(), periodEnd: r.periodEnd.toISOString() }));
}
export async function getInvoice(userId: string, businessId: string, invoiceId: string) {
  await authorize(userId, businessId);
  const inv = await db.billingInvoice.findFirst({ where: { id: invoiceId, businessId } });
  if (!inv) throw new AppError("NOT_FOUND", "Invoice not found.", 404);
  return inv;
}
