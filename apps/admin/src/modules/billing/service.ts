import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { lumiaApi } from "@/server/lumia-api";

// Subscriptions: Stripe takes the payment (hosted Checkout, so card details never reach Lumia) and renews it automatically.
// Stripe tells us what happened through lumia-order-api's signed webhook; this module keeps the result on the business.
export const TRIAL_DAYS = 14;
export type PlanId = "starter" | "plus" | "pro";
export type SubStatus = "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export interface Subscription {
  status: SubStatus; plan?: PlanId; billing?: "monthly" | "yearly"; stripeCustomerId?: string; stripeSubscriptionId?: string;
  currentPeriodEnd?: string; cancelAtPeriodEnd?: boolean; terminals?: number; terminalAddress?: string;
  terminal?: { stage: number; dates: string[]; tracking?: string }; startedAt?: string; events?: string[];
}
const NONE: Subscription = { status: "NONE" };
const read = (v: Prisma.JsonValue | null | undefined): Subscription => (v && typeof v === "object" && !Array.isArray(v) ? { ...NONE, ...(v as object) } as Subscription : NONE);

// What each plan allows. Without an active plan (trial or ended) the limits of the smallest plan apply.
export function entitlements(sub: Subscription) {
  const active = sub.status === "ACTIVE" || sub.status === "PAST_DUE";
  const plan = active ? sub.plan : undefined;
  return { plan: plan ?? null, branches: plan === "pro" ? 3 : 1, customers: plan === "plus" || plan === "pro", staff: plan === "pro" ? 10 : plan === "plus" ? 3 : 1 };
}
export const trialInfo = (createdAt: Date, now = Date.now()) => {
  const endsAt = new Date(createdAt.getTime() + TRIAL_DAYS * 86_400_000);
  return { endsAt: endsAt.toISOString(), daysLeft: Math.max(0, Math.min(TRIAL_DAYS, Math.ceil((endsAt.getTime() - now) / 86_400_000))) };
};

export async function getSubscriptionFor(businessId: string) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { createdAt: true, subscription: true } });
  return { sub: read(b.subscription), createdAt: b.createdAt };
}
// What we already know about the restaurant, used to pre-fill the payment page and Stripe so nobody types it twice.
async function knownDetails(businessId: string) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, phone: true, email: true, vatRegistered: true, taxRegistrationNumber: true, settings: true, locations: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 1, select: { addressLine1: true, city: true, emirate: true } } } });
  const loc = b.locations[0], legal = (b.settings as { profile?: { name?: string } } | null)?.profile?.name;
  const address = [loc?.addressLine1, loc?.city, loc?.emirate].filter(Boolean).join(", ");
  return { name: legal || b.name, phone: b.phone ?? undefined, email: b.email ?? undefined, trn: b.vatRegistered && /^\d{15}$/.test(b.taxRegistrationNumber ?? "") ? b.taxRegistrationNumber! : undefined, address, line1: loc?.addressLine1 || undefined, city: loc?.city || undefined, state: loc?.emirate || undefined };
}
export async function getSubscription(userId: string, businessId: string) {
  const { member } = await authorize(userId, businessId);
  const { sub, createdAt } = await getSubscriptionFor(businessId);
  const { stripeCustomerId, stripeSubscriptionId, events: _events, ...safe } = sub;
  const known = await knownDetails(businessId);
  return { ...safe, defaults: { address: known.address }, canManage: member.role === "OWNER" || member.role === "ADMIN", hasCustomer: Boolean(stripeCustomerId), trial: trialInfo(createdAt), entitlements: entitlements(sub) };
}

const checkoutSchema = z.object({ plan: z.enum(["starter", "plus", "pro"]), billing: z.enum(["monthly", "yearly"]), terminals: z.number().int().min(1).max(10), address: z.string().trim().min(6).max(400) }).strict();
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function startCheckout(userId: string, businessId: string, input: unknown) {
  const data = checkoutSchema.safeParse(input);
  if (!data.success) throw new AppError("VALIDATION_FAILED", "Choose a plan and add a delivery address for the terminal.", 400);
  const { business } = await authorize(userId, businessId, "business.manage");
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, preferredLanguage: true } });
  const { sub } = await getSubscriptionFor(businessId);
  const known = await knownDetails(businessId);
  const email = known.email || (user?.email && !user.email.endsWith(".invalid") ? user.email : undefined);
  const customer = { name: known.name, ...(known.phone ? { phone: known.phone } : {}), ...(known.trn ? { trn: known.trn } : {}), ...(known.line1 || known.city || known.state ? { address: { line1: known.line1, city: known.city, state: known.state } } : {}), language: user?.preferredLanguage === "ar" ? "ar" : "en" };
  const base = `${appUrl()}/dashboard?businessId=${businessId}`;
  const result = await lumiaApi<{ url?: string; clientSecret?: string; publishableKey?: string; customerId?: string }>("/internal/billing/checkout", { businessId, ...data.data, customer, embedded: true, ...(email ? { email } : {}), ...(sub.stripeCustomerId ? { customerId: sub.stripeCustomerId } : {}), successUrl: `${base}&billing=success`, cancelUrl: `${base}&billing=cancel` }, 25_000);
  if (!result.ok) throw new AppError(result.code === "BILLING_NOT_CONFIGURED" ? "BILLING_NOT_CONFIGURED" : "BILLING_UNAVAILABLE", result.code === "BILLING_NOT_CONFIGURED" ? "Payments are not switched on yet. Please contact Lumia to subscribe." : "We couldn’t open the payment page. Please try again.", 503);
  // Remember the Stripe customer so a second attempt reuses it (and so renewals can be matched to this restaurant).
  if (result.data.customerId && result.data.customerId !== sub.stripeCustomerId) await db.business.update({ where: { id: businessId }, data: { subscription: { ...sub, stripeCustomerId: result.data.customerId } as unknown as Prisma.InputJsonValue } });
  // clientSecret + publishableKey: the form is drawn inside the dashboard; url: Stripe's own page (when no public key is configured).
  return { url: result.data.url, clientSecret: result.data.clientSecret, publishableKey: result.data.publishableKey };
}
export async function openPortal(userId: string, businessId: string) {
  await authorize(userId, businessId, "business.manage");
  const { sub } = await getSubscriptionFor(businessId);
  if (!sub.stripeCustomerId) throw new AppError("NO_SUBSCRIPTION", "There is no subscription to manage yet.", 409);
  const result = await lumiaApi<{ url: string }>("/internal/billing/portal", { customerId: sub.stripeCustomerId, returnUrl: `${appUrl()}/dashboard?businessId=${businessId}&page=settings` }, 25_000);
  if (!result.ok) throw new AppError("BILLING_UNAVAILABLE", "We couldn’t open billing. Please try again.", 503);
  return { url: result.data.url };
}

// ---- Stripe events (from lumia-order-api) ----
const obj = z.object({ id: z.string().max(100), type: z.string().max(80), created: z.number(), object: z.record(z.string(), z.unknown()) });
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const periodEnd = (o: Record<string, any>): string | undefined => {
  const t = o.current_period_end ?? o.items?.data?.[0]?.current_period_end ?? o.lines?.data?.[0]?.period?.end;
  return typeof t === "number" ? new Date(t * 1000).toISOString() : undefined;
};
const STATUS: Record<string, SubStatus | undefined> = { active: "ACTIVE", trialing: "ACTIVE", past_due: "PAST_DUE", unpaid: "PAST_DUE", canceled: "CANCELED", incomplete_expired: "CANCELED" };

async function findBusiness(o: Record<string, any>) {
  const fromMeta = str(o.metadata?.businessId) ?? str(o.client_reference_id);
  if (fromMeta) { const b = await db.business.findUnique({ where: { id: fromMeta }, select: { id: true, subscription: true } }); if (b) return b; }
  const cus = str(o.customer), subId = str(o.type === "invoice" ? o.subscription : o.id) ?? str(o.subscription);
  const rows = await db.business.findMany({ select: { id: true, subscription: true } }); // only reached when an event carries no businessId
  return rows.find(r => { const s = read(r.subscription); return (cus && s.stripeCustomerId === cus) || (subId && s.stripeSubscriptionId === subId); });
}

export async function handleBillingEvent(input: unknown) {
  const e = obj.parse(input); const o = e.object as Record<string, any>;
  const b = await findBusiness({ ...o, type: e.type.startsWith("invoice.") ? "invoice" : o.object });
  if (!b) { console.warn(JSON.stringify({ level: "warn", code: "BILLING_EVENT_UNMATCHED", type: e.type })); return { ok: true, matched: false }; }
  const sub = read(b.subscription);
  if (sub.events?.includes(e.id)) return { ok: true, duplicate: true }; // Stripe retries; handle each event once
  const next: Subscription = { ...sub, events: [...(sub.events ?? []).slice(-19), e.id] };
  switch (e.type) {
    case "checkout.session.completed": {
      const m = (o.metadata ?? {}) as Record<string, string>;
      Object.assign(next, { status: "ACTIVE" as const, stripeCustomerId: str(o.customer) ?? sub.stripeCustomerId, stripeSubscriptionId: str(o.subscription) ?? sub.stripeSubscriptionId,
        plan: (["starter", "plus", "pro"].includes(m.plan ?? "") ? m.plan : sub.plan) as PlanId, billing: (m.billing === "monthly" || m.billing === "yearly" ? m.billing : sub.billing),
        terminals: Number(m.terminals) || sub.terminals || 1, terminalAddress: m.terminalAddress || sub.terminalAddress, startedAt: sub.startedAt ?? new Date(e.created * 1000).toISOString(),
        terminal: sub.terminal ?? { stage: 0, dates: [new Date(e.created * 1000).toISOString()] } });
      break;
    }
    case "customer.subscription.created": case "customer.subscription.updated": {
      const status = STATUS[String(o.status)]; const m = (o.metadata ?? {}) as Record<string, string>;
      Object.assign(next, { ...(status ? { status } : {}), stripeSubscriptionId: str(o.id) ?? sub.stripeSubscriptionId, stripeCustomerId: str(o.customer) ?? sub.stripeCustomerId, cancelAtPeriodEnd: Boolean(o.cancel_at_period_end),
        ...(periodEnd(o) ? { currentPeriodEnd: periodEnd(o) } : {}), ...(["starter", "plus", "pro"].includes(m.plan ?? "") ? { plan: m.plan as PlanId } : {}) });
      break;
    }
    case "customer.subscription.deleted": Object.assign(next, { status: "CANCELED" as const, cancelAtPeriodEnd: false }); break;
    case "invoice.paid": Object.assign(next, { status: "ACTIVE" as const, ...(periodEnd(o) ? { currentPeriodEnd: periodEnd(o) } : {}) }); break; // a renewal went through
    case "invoice.payment_failed": Object.assign(next, { status: "PAST_DUE" as const }); break; // Stripe keeps retrying; the owner is asked to update the card
    default: return { ok: true, ignored: true };
  }
  await db.business.update({ where: { id: b.id }, data: { subscription: next as unknown as Prisma.InputJsonValue } });
  return { ok: true };
}
