import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness, setMember } from "../src/modules/business/service";
import { PLANS, addPeriod, quoteRenewal, quoteSignup, quoteUpgrade, isUpgrade } from "../src/modules/billing/plans";
import { getSubscription, startCheckout, startCardUpdate, confirmSession, handleBillingEvent, runBilling, changePlan, quotePlanChange, setCancel, listInvoices, entitlements, trialInfo } from "../src/modules/billing/service";
import { getSettings, saveSettingsSection } from "../src/modules/settings/service";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("plans, prices and periods", () => {
  it("prices a yearly Plus signup with two terminals and 5% VAT as separate lines that add up exactly", () => {
    const q = quoteSignup("plus", "yearly", 2);
    expect(q.lines.map(l => [l.name, l.unitMinor, l.quantity])).toEqual([["Lumia Order Plus (yearly)", 249000, 1], ["Lumia Order Terminal", 49900, 1], ["Lumia Order Terminal (extra)", 59900, 1]]);
    expect(q).toMatchObject({ subtotalMinor: 358800, vatMinor: 17940, totalMinor: 376740 });
    expect(quoteSignup("starter", "monthly", 1)).toMatchObject({ subtotalMinor: 74800, vatMinor: 3740, totalMinor: 78540 }); // 149 + 599 terminal
    expect(quoteRenewal("pro", "monthly")).toMatchObject({ subtotalMinor: 39900, vatMinor: 1995, totalMinor: 41895 }); // renewals never include a terminal
  });
  it("adds one month or year, keeping the day where it can", () => {
    expect(addPeriod(new Date("2026-10-04T10:00:00Z"), "monthly").toISOString()).toBe("2026-11-04T10:00:00.000Z");
    expect(addPeriod(new Date("2026-01-31T10:00:00Z"), "monthly").toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addPeriod(new Date("2027-12-31T10:00:00Z"), "monthly").toISOString()).toBe("2028-01-31T10:00:00.000Z");
    expect(addPeriod(new Date("2028-02-29T10:00:00Z"), "yearly").toISOString()).toBe("2029-02-28T10:00:00.000Z");
  });
  it("charges only the price difference for the time left when upgrading", () => {
    const start = new Date("2026-10-01T00:00:00Z"), end = new Date("2026-10-31T00:00:00Z");
    expect(quoteUpgrade("starter", "plus", "monthly", start, end, new Date("2026-10-16T00:00:00Z"))).toMatchObject({ subtotalMinor: 5000, vatMinor: 250, totalMinor: 5250 }); // half of AED 100
    expect(quoteUpgrade("starter", "pro", "monthly", start, end, start).subtotalMinor).toBe(25000); // the whole difference on day one
    expect(quoteUpgrade("starter", "pro", "monthly", start, end, new Date("2026-11-05T00:00:00Z")).subtotalMinor).toBe(0); // nothing left
    expect(isUpgrade("plus", "pro")).toBe(true); expect(isUpgrade("pro", "plus")).toBe(false); expect(PLANS.starter.rank).toBe(1);
  });
  it("counts 14 trial days and gives the smallest plan's limits without an active plan", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(trialInfo(new Date("2026-10-10T11:00:00Z"), now).daysLeft).toBe(14); expect(trialInfo(new Date("2026-10-03T12:00:00Z"), now).daysLeft).toBe(7); expect(trialInfo(new Date("2026-01-01T00:00:00Z"), now).daysLeft).toBe(0);
    expect(entitlements(null)).toMatchObject({ plan: null, branches: 1, customers: false });
    expect(entitlements({ status: "ACTIVE", plan: "plus" })).toMatchObject({ branches: 1, customers: true, staff: 3 });
    expect(entitlements({ status: "PAST_DUE", plan: "pro" })).toMatchObject({ branches: 3, customers: true });
    for (const status of ["CANCELED", "ENDED"]) expect(entitlements({ status, plan: "pro" })).toMatchObject({ plan: null, branches: 1 });
  });
});

describe.skipIf(!enabled)("Lumia-run subscriptions, Stripe only takes payments", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, viewer: string, biz: string; let calls: { path: string; body: any }[];
  let session: any, charge: any, cardInfo = { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
  const T0 = new Date("2026-10-04T10:00:00Z");
  const paid = (meta: Record<string, string>, amountTotalMinor?: number, extra: object = {}) => ({ sessionId: `cs_${Math.random().toString(36).slice(2, 10)}`, mode: meta.kind === "card" ? "setup" : "payment", complete: true, paid: true, customerId: "cus_1", paymentMethodId: "pm_1", paymentIntentId: "pi_1", amountTotalMinor, metadata: { businessId: biz, ...meta }, ...extra });
  const signup = (plan = "plus", billing = "yearly", terminals = 2) => paid({ kind: "signup", plan, billing, terminals: String(terminals), terminalAddress: "Shop 4, Al Majaz 2" }, quoteSignup(plan as any, billing as any, terminals).totalMinor);
  const sub = () => db.subscription.findFirstOrThrow({ where: { businessId: biz } });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.APP_URL = "https://app.test";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname, body = JSON.parse(String(init.body)); calls.push({ path, body });
      if (path === "/internal/billing/checkout") return Response.json({ id: "cs_new", clientSecret: "cs_new_secret", publishableKey: "pk_test_x", customerId: "cus_1" });
      if (path === "/internal/billing/session") return Response.json(session);
      if (path === "/internal/billing/card") return Response.json(cardInfo);
      if (path === "/internal/billing/charge") return Response.json(charge);
      return Response.json({}, { status: 404 });
    }));
    const mk = (nm: string, i: number) => db.user.create({ data: { name: nm, email: `${nm}-${suffix}@test.invalid`, phoneNumber: `+97150888${String(3000 + i)}`, phoneNumberVerified: true } });
    [owner, viewer] = (await Promise.all([mk("own", 1), mk("vie", 2)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "Billing Burgers", locationName: "Main" }, "t")).id;
    await setMember(owner, biz, { phoneNumber: "+971508883002", role: "VIEWER" }, "t");
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("starts in the trial with no plan", async () => {
    const s = await getSubscription(owner, biz);
    expect(s).toMatchObject({ status: "NONE", canManage: true, nextCharge: null, trial: { daysLeft: 14 }, entitlements: { plan: null, branches: 1 } });
    expect((await getSubscription(viewer, biz)).canManage).toBe(false);
  });
  it("opens the payment form with the exact amounts, pre-filled details and a note, only for owners and admins", async () => {
    await db.business.update({ where: { id: biz }, data: { phone: "+97165550142", email: "hi@billing.test", vatRegistered: true, taxRegistrationNumber: "100234567800003" } });
    await db.location.updateMany({ where: { businessId: biz }, data: { addressLine1: "Corniche St", city: "Al Majaz", emirate: "Sharjah" } });
    expect((await getSubscription(owner, biz)).defaults.address).toBe("Corniche St, Al Majaz, Sharjah");
    calls = [];
    const r = await startCheckout(owner, biz, { plan: "plus", billing: "yearly", terminals: 2, address: "Shop 4, Al Majaz 2, Sharjah" });
    expect(r).toMatchObject({ sessionId: "cs_new", clientSecret: "cs_new_secret", publishableKey: "pk_test_x" });
    const b = calls[0]!.body;
    expect(b).toMatchObject({ businessId: biz, mode: "payment", embedded: true, email: "hi@billing.test", shippingAddress: "Shop 4, Al Majaz 2, Sharjah", metadata: { kind: "signup", plan: "plus", billing: "yearly", terminals: "2", total: "376740" }, customer: { name: "Billing Burgers", phone: "+97165550142", trn: "100234567800003", language: "en" } });
    expect(b.lines.map((l: any) => l.unitMinor * l.quantity).reduce((a: number, c: number) => a + c, 0)).toBe(376740); // what Stripe charges is exactly the quote, VAT included
    expect(b.lines.at(-1)).toMatchObject({ name: "VAT (5%)", unitMinor: 17940 });
    expect((await db.business.findUniqueOrThrow({ where: { id: biz } })).stripeCustomerId).toBe("cus_1");
    await expect(startCheckout(viewer, biz, { plan: "plus", billing: "yearly", terminals: 1, address: "Shop 4, Al Majaz 2" })).rejects.toMatchObject({ status: 403 });
    await expect(startCheckout(owner, biz, { plan: "gold", billing: "yearly", terminals: 1, address: "Shop 4, Al Majaz 2" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(startCheckout(owner, biz, { plan: "pro", billing: "monthly", terminals: 1, address: "x" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
  it("starts the subscription when the payment is confirmed, once, and only if the amount matches", async () => {
    session = signup("plus", "yearly", 2); session.amountTotalMinor = 100; // someone tampered with the amount
    await expect(confirmSession(owner, biz, { sessionId: "cs_abc" })).rejects.toMatchObject({ code: "AMOUNT_MISMATCH" });
    session = { ...paid({ kind: "signup", plan: "plus", billing: "yearly", terminals: "2" }, 376740), metadata: { businessId: "someone-else", kind: "signup", plan: "plus" } };
    await expect(confirmSession(owner, biz, { sessionId: "cs_abc" })).rejects.toMatchObject({ status: 404 });
    session = signup("plus", "yearly", 2); session.complete = false;
    expect((await confirmSession(owner, biz, { sessionId: "cs_abc" })).applied).toBe(false);
    session = signup("plus", "yearly", 2);
    const r = await confirmSession(owner, biz, { sessionId: session.sessionId });
    expect(r.applied).toBe(true);
    const s = await sub(); expect(s).toMatchObject({ plan: "plus", billing: "yearly", status: "ACTIVE", terminals: 2, stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1" });
    expect(s.card).toMatchObject({ brand: "visa", last4: "4242" }); expect(s.terminal).toMatchObject({ stage: 0 });
    expect(s.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 360 * 86400000); expect(s.nextChargeAt?.getTime()).toBe(s.currentPeriodEnd.getTime());
    const invoices = await listInvoices(owner, biz); expect(invoices).toHaveLength(1); expect(invoices[0]).toMatchObject({ kind: "SIGNUP", status: "PAID", totalMinor: 376740, vatMinor: 17940 }); expect(invoices[0]!.number).toMatch(/^LO-\d{4}-000001$/);
    expect(await confirmSession(owner, biz, { sessionId: session.sessionId })).toMatchObject({ applied: false, reason: "ALREADY_APPLIED" }); expect(await listInvoices(owner, biz)).toHaveLength(1);
    expect(await handleBillingEvent({ id: "evt_1", type: "checkout.session.completed", session })).toMatchObject({ applied: false, reason: "ALREADY_APPLIED" }); // the webhook for the same payment changes nothing
    const view = await getSubscription(owner, biz);
    expect(view).toMatchObject({ status: "ACTIVE", plan: "plus", entitlements: { plan: "plus", customers: true, branches: 1 }, nextCharge: { amountMinor: quoteRenewal("plus", "yearly").totalMinor }, card: { last4: "4242" } });
    await expect(startCheckout(owner, biz, { plan: "pro", billing: "monthly", terminals: 1, address: "Shop 4, Al Majaz 2" })).rejects.toMatchObject({ code: "ALREADY_SUBSCRIBED" });
  });
  it("renews when due: charges the card on file once, moves the period on and issues an invoice", async () => {
    expect(await runBilling(T0)).toMatchObject({ checked: 0 }); // nothing due yet
    const s0 = await sub(); const due = new Date(s0.currentPeriodEnd.getTime() + 60_000);
    charge = { status: "succeeded", paymentIntentId: "pi_renew" }; calls = [];
    expect(await runBilling(due)).toMatchObject({ checked: 1, renewed: 1, failed: 0 });
    const body = calls.find(c => c.path === "/internal/billing/charge")!.body;
    expect(body).toMatchObject({ customerId: "cus_1", paymentMethodId: "pm_1", amountMinor: quoteRenewal("plus", "yearly").totalMinor, metadata: { kind: "renewal" } }); expect(body.idempotencyKey).toMatch(/^renew:.+:\d{4}-\d{2}-\d{2}:1$/);
    const s1 = await sub(); expect(s1.currentPeriodStart.getTime()).toBe(s0.currentPeriodEnd.getTime()); expect(s1.currentPeriodEnd.getTime()).toBe(addPeriod(s0.currentPeriodEnd, "yearly").getTime()); expect(s1.failedAttempts).toBe(0);
    expect((await listInvoices(owner, biz))[0]).toMatchObject({ kind: "RENEWAL", totalMinor: quoteRenewal("plus", "yearly").totalMinor });
    expect(await runBilling(due)).toMatchObject({ checked: 0 }); // running it again does not bill twice
  });
  it("retries a failed renewal after 1, 3 and 5 days, keeps the plan meanwhile, then lets it lapse", async () => {
    await db.subscription.updateMany({ where: { businessId: biz }, data: { nextChargeAt: new Date(T0.getTime() - 1000), currentPeriodEnd: new Date(T0.getTime() - 1000), billing: "monthly" } });
    charge = { status: "failed", failureMessage: "Your card was declined." };
    let now = T0; const days = [1, 3, 5];
    for (let i = 0; i < 3; i++) {
      expect(await runBilling(now)).toMatchObject({ failed: 1 });
      const s = await sub(); expect(s).toMatchObject({ status: "PAST_DUE", failedAttempts: i + 1, lastFailure: "Your card was declined." }); expect(s.nextChargeAt?.getTime()).toBe(now.getTime() + days[i]! * 86400000);
      expect((await getSubscription(owner, biz)).entitlements.plan).toBe("plus"); // still has the plan during the retry period
      now = new Date(s.nextChargeAt!.getTime() + 1000);
    }
    expect(await runBilling(now)).toMatchObject({ ended: 1 });
    expect(await sub()).toMatchObject({ status: "ENDED", nextChargeAt: null }); expect((await getSubscription(owner, biz)).entitlements.plan).toBeNull();
    expect(await runBilling(new Date(now.getTime() + 99 * 86400000))).toMatchObject({ checked: 0 });
  });
  it("a new card fixes an overdue renewal straight away", async () => {
    await db.subscription.updateMany({ where: { businessId: biz }, data: { status: "PAST_DUE", failedAttempts: 1, nextChargeAt: new Date(Date.now() + 86400000), currentPeriodEnd: new Date(Date.now() - 86400000), stripePaymentMethodId: "pm_old", billing: "monthly" } });
    expect(await startCardUpdate(owner, biz)).toMatchObject({ clientSecret: "cs_new_secret" }); expect(calls.at(-1)!.body).toMatchObject({ mode: "setup", customerId: "cus_1", metadata: { kind: "card" } });
    charge = { status: "succeeded", paymentIntentId: "pi_fix" }; session = paid({ kind: "card" }, undefined, { paymentMethodId: "pm_new" }); cardInfo = { brand: "mastercard", last4: "4444", expMonth: 1, expYear: 2031 };
    expect((await confirmSession(owner, biz, { sessionId: session.sessionId })).applied).toBe(true);
    const s = await sub(); expect(s).toMatchObject({ status: "ACTIVE", stripePaymentMethodId: "pm_new", failedAttempts: 0 }); expect(s.card).toMatchObject({ brand: "mastercard", last4: "4444" });
    expect(calls.filter(c => c.path === "/internal/billing/charge").at(-1)!.body.paymentMethodId).toBe("pm_new");
  });
  it("upgrades now for the time left, schedules downgrades and cycle changes for the next renewal, and cancels at period end", async () => {
    const start = new Date(Date.now() - 10 * 86400000), end = new Date(Date.now() + 20 * 86400000);
    await db.subscription.updateMany({ where: { businessId: biz }, data: { plan: "starter", billing: "monthly", status: "ACTIVE", currentPeriodStart: start, currentPeriodEnd: end, nextChargeAt: end, failedAttempts: 0, pendingPlan: null, pendingBilling: null, cancelAtPeriodEnd: false } });
    const q = await quotePlanChange(owner, biz, { plan: "pro", billing: "monthly" }); expect(q).toMatchObject({ kind: "upgrade", now: true }); expect((q as any).totalMinor).toBeGreaterThan(15000); expect((q as any).totalMinor).toBeLessThan(20000);
    charge = { status: "failed", failureMessage: "Declined" }; await expect(changePlan(owner, biz, { plan: "pro", billing: "monthly" })).rejects.toMatchObject({ code: "PAYMENT_FAILED" }); expect((await sub()).plan).toBe("starter");
    charge = { status: "succeeded", paymentIntentId: "pi_up" }; calls = [];
    expect(await changePlan(owner, biz, { plan: "pro", billing: "monthly" })).toMatchObject({ plan: "pro" });
    expect(calls.find(c => c.path === "/internal/billing/charge")!.body.amountMinor).toBe((q as any).totalMinor);
    expect((await listInvoices(owner, biz)).find(i => i.kind === "UPGRADE")).toMatchObject({ totalMinor: (q as any).totalMinor });
    expect((await getSettings(owner, biz)).branchLimit).toBe(3);
    // downgrade waits for the renewal
    expect(await changePlan(owner, biz, { plan: "plus", billing: "monthly" })).toMatchObject({ plan: "pro", pendingPlan: "plus" });
    expect((await getSubscription(owner, biz)).nextCharge).toMatchObject({ amountMinor: quoteRenewal("plus", "monthly").totalMinor });
    expect(await changePlan(owner, biz, { plan: "pro", billing: "monthly" })).toMatchObject({ pendingPlan: undefined }); // choosing the current plan again undoes it
    await changePlan(owner, biz, { plan: "plus", billing: "yearly" }); expect(await sub()).toMatchObject({ pendingPlan: "plus", pendingBilling: "yearly" });
    charge = { status: "succeeded", paymentIntentId: "pi_next" }; calls = [];
    await runBilling(new Date(end.getTime() + 1000));
    expect(calls.find(c => c.path === "/internal/billing/charge")!.body.amountMinor).toBe(quoteRenewal("plus", "yearly").totalMinor);
    expect(await sub()).toMatchObject({ plan: "plus", billing: "yearly", pendingPlan: null });
    // cancel: keeps the plan until the period ends, then no charge
    expect(await setCancel(owner, biz, true)).toMatchObject({ cancelAtPeriodEnd: true, nextCharge: null }); expect((await getSubscription(owner, biz)).entitlements.plan).toBe("plus");
    expect(await setCancel(owner, biz, false)).toMatchObject({ cancelAtPeriodEnd: false });
    await setCancel(owner, biz, true); calls = [];
    const after = new Date((await sub()).currentPeriodEnd.getTime() + 1000);
    expect(await runBilling(after)).toMatchObject({ ended: 1 }); expect(calls.some(c => c.path === "/internal/billing/charge")).toBe(false);
    expect(await sub()).toMatchObject({ status: "CANCELED", nextChargeAt: null }); expect((await getSubscription(owner, biz)).entitlements.plan).toBeNull();
    await expect(changePlan(viewer, biz, { plan: "pro", billing: "monthly" })).rejects.toMatchObject({ status: 403 });
  });
  it("limits branches to the plan: one without Pro, up to three with Pro", async () => {
    await db.subscription.updateMany({ where: { businessId: biz }, data: { status: "ACTIVE", plan: "plus", cancelAtPeriodEnd: false } });
    const cur = (await getSettings(owner, biz)).sections.branches; expect((await getSettings(owner, biz)).branchLimit).toBe(1);
    const add = (n: number) => [...cur, ...Array.from({ length: n }, (_, i) => ({ id: `tmp-${i}`, name: `Extra ${i}`, emirate: "Dubai", area: "", address: "", phone: "", eta: "45", active: true, pin: false, coords: "" }))];
    await expect(saveSettingsSection(owner, biz, "branches", add(1), "t")).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await db.subscription.updateMany({ where: { businessId: biz }, data: { plan: "pro" } });
    expect((await getSettings(owner, biz)).branchLimit).toBe(3); expect(((await saveSettingsSection(owner, biz, "branches", add(2), "t")).value as any[])).toHaveLength(3);
  });
});
