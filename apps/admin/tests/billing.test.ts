import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness, setMember } from "../src/modules/business/service";
import { getSubscription, startCheckout, openPortal, handleBillingEvent, entitlements, trialInfo } from "../src/modules/billing/service";
import { getSettings, saveSettingsSection } from "../src/modules/settings/service";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("trial and plan limits", () => {
  it("counts 14 trial days from sign-up and never goes below zero", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(trialInfo(new Date("2026-10-10T11:00:00Z"), now).daysLeft).toBe(14); expect(trialInfo(new Date("2026-10-03T12:00:00Z"), now).daysLeft).toBe(7); expect(trialInfo(new Date("2026-01-01T00:00:00Z"), now).daysLeft).toBe(0);
  });
  it("gives the smallest plan's limits without an active subscription", () => {
    expect(entitlements({ status: "NONE" })).toMatchObject({ plan: null, branches: 1, customers: false });
    expect(entitlements({ status: "ACTIVE", plan: "plus" })).toMatchObject({ branches: 1, customers: true, staff: 3 });
    expect(entitlements({ status: "PAST_DUE", plan: "pro" })).toMatchObject({ branches: 3, customers: true });
    expect(entitlements({ status: "CANCELED", plan: "pro" })).toMatchObject({ plan: null, branches: 1 });
  });
});

describe.skipIf(!enabled)("subscriptions with Stripe", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, viewer: string, biz: string; let calls: { path: string; body: any }[];
  const evt = (id: string, type: string, object: Record<string, unknown>) => handleBillingEvent({ id, type, created: 1_790_000_000, object });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.APP_URL = "https://app.test";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const path = new URL(url).pathname; calls.push({ path, body: JSON.parse(String(init.body)) }); return Response.json({ url: "https://checkout.stripe.com/c/pay/cs_1" }); }));
    const mk = (nm: string, i: number) => db.user.create({ data: { name: nm, email: `${nm}-${suffix}@test.invalid`, phoneNumber: `+97150888${String(3000 + i)}`, phoneNumberVerified: true } });
    [owner, viewer] = (await Promise.all([mk("own", 1), mk("vie", 2)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "Billing Burgers", locationName: "Main" }, "t")).id;
    await setMember(owner, biz, { phoneNumber: "+971508883002", role: "VIEWER" }, "t");
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("starts in the trial with the smallest plan's limits", async () => {
    const s = await getSubscription(owner, biz);
    expect(s).toMatchObject({ status: "NONE", canManage: true, hasCustomer: false, trial: { daysLeft: 14 }, entitlements: { plan: null, branches: 1 } });
    expect((await getSubscription(viewer, biz)).canManage).toBe(false); expect(JSON.stringify(s)).not.toContain("stripe");
  });
  it("opens Stripe Checkout through the API with the chosen plan, and only for owners and admins", async () => {
    calls = [];
    await db.business.update({ where: { id: biz }, data: { phone: "+97165550142", email: "hi@billing.test", vatRegistered: true, taxRegistrationNumber: "100234567800003" } });
    await db.location.updateMany({ where: { businessId: biz }, data: { addressLine1: "Corniche St", city: "Al Majaz", emirate: "Sharjah" } });
    expect((await getSubscription(owner, biz)).defaults.address).toBe("Corniche St, Al Majaz, Sharjah");
    const r = await startCheckout(owner, biz, { plan: "plus", billing: "yearly", terminals: 2, address: "Shop 4, Al Majaz 2, Sharjah" });
    expect(r.url).toContain("checkout.stripe.com");
    expect(calls[0]!.body.customer).toMatchObject({ name: "Billing Burgers", phone: "+97165550142", trn: "100234567800003", address: { line1: "Corniche St", city: "Al Majaz", state: "Sharjah" }, language: "en" }); expect(calls[0]!.body.email).toBe("hi@billing.test");
    expect(calls[0]).toMatchObject({ path: "/internal/billing/checkout", body: { businessId: biz, plan: "plus", billing: "yearly", terminals: 2, successUrl: `https://app.test/dashboard?businessId=${biz}&billing=success`, cancelUrl: `https://app.test/dashboard?businessId=${biz}&billing=cancel` } });
    await expect(startCheckout(viewer, biz, { plan: "plus", billing: "yearly", terminals: 1, address: "Shop 4, Al Majaz 2" })).rejects.toMatchObject({ status: 403 });
    await expect(startCheckout(owner, biz, { plan: "gold", billing: "yearly", terminals: 1, address: "Shop 4, Al Majaz 2" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(startCheckout(owner, biz, { plan: "pro", billing: "monthly", terminals: 1, address: "x" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(openPortal(owner, biz)).rejects.toMatchObject({ code: "NO_SUBSCRIPTION" });
  });
  it("activates on payment, keeps renewals and failures in step with Stripe, and ignores repeats", async () => {
    await evt("evt_1", "checkout.session.completed", { customer: "cus_1", subscription: "sub_1", metadata: { businessId: biz, plan: "plus", billing: "yearly", terminals: "2", terminalAddress: "Shop 4" } });
    let s = await getSubscription(owner, biz);
    expect(s).toMatchObject({ status: "ACTIVE", plan: "plus", billing: "yearly", terminals: 2, hasCustomer: true, terminal: { stage: 0 }, entitlements: { plan: "plus", customers: true, branches: 1 } });
    expect(await evt("evt_1", "checkout.session.completed", { customer: "cus_1", subscription: "sub_1", metadata: { businessId: biz, plan: "pro" } })).toMatchObject({ duplicate: true });
    expect((await getSubscription(owner, biz)).plan).toBe("plus"); // the repeat changed nothing
    await evt("evt_2", "customer.subscription.updated", { id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: true, current_period_end: 1_820_000_000, metadata: { businessId: biz, plan: "plus" } });
    s = await getSubscription(owner, biz); expect(s).toMatchObject({ cancelAtPeriodEnd: true, currentPeriodEnd: new Date(1_820_000_000_000).toISOString() });
    await evt("evt_3", "invoice.payment_failed", { customer: "cus_1", subscription: "sub_1" });
    expect((await getSubscription(owner, biz)).status).toBe("PAST_DUE");
    await evt("evt_4", "invoice.paid", { customer: "cus_1", subscription: "sub_1", lines: { data: [{ period: { end: 1_850_000_000 } }] } });
    s = await getSubscription(owner, biz); expect(s).toMatchObject({ status: "ACTIVE", currentPeriodEnd: new Date(1_850_000_000_000).toISOString() });
    calls = []; expect((await openPortal(owner, biz)).url).toContain("stripe.com"); expect(calls[0]!.body).toMatchObject({ customerId: "cus_1", returnUrl: `https://app.test/dashboard?businessId=${biz}&page=settings` });
    await evt("evt_5", "customer.subscription.deleted", { id: "sub_1", customer: "cus_1" });
    expect(await getSubscription(owner, biz)).toMatchObject({ status: "CANCELED", entitlements: { plan: null } });
    expect(await evt("evt_6", "invoice.paid", { customer: "cus_unknown", subscription: "sub_unknown" })).toMatchObject({ matched: false });
    await expect(handleBillingEvent({ nope: true })).rejects.toBeDefined();
  });
  it("limits branches to the plan: one without Pro, up to three with Pro", async () => {
    const cur = (await getSettings(owner, biz)).sections.branches; expect((await getSettings(owner, biz)).branchLimit).toBe(1);
    const add = (n: number) => [...cur, ...Array.from({ length: n }, (_, i) => ({ id: `tmp-${i}`, name: `Extra ${i}`, emirate: "Dubai", area: "", address: "", phone: "", eta: "45", active: true, pin: false, coords: "" }))];
    await expect(saveSettingsSection(owner, biz, "branches", add(1), "t")).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await evt("evt_7", "checkout.session.completed", { customer: "cus_1", subscription: "sub_2", metadata: { businessId: biz, plan: "pro", billing: "monthly", terminals: "1" } });
    expect((await getSettings(owner, biz)).branchLimit).toBe(3);
    expect(((await saveSettingsSection(owner, biz, "branches", add(2), "t")).value as any[])).toHaveLength(3);
    await expect(saveSettingsSection(owner, biz, "branches", add(3).concat([{ id: "tmp-9", name: "Fourth", emirate: "Dubai", area: "", address: "", phone: "", eta: "45", active: true, pin: false, coords: "" }]), "t")).rejects.toMatchObject({ code: "PLAN_LIMIT" });
  });
});
