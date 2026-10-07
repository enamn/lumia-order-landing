import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness } from "../src/modules/business/service";
import { LIMITS, TRIAL_LIMITS, TOPUPS, REPLIES_PER_ORDER, quoteTopUp } from "../src/modules/billing/plans";
import { consume, refund, usagePeriod, usageSummary, addCredits, canStartOrder } from "../src/modules/billing/usage";
import { buyTopUp, getSubscription } from "../src/modules/billing/service";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("monthly periods and top-up prices", () => {
  it("counts months from the plan's own day, keeping the day where it can", () => {
    const anchor = new Date("2026-01-31T10:00:00Z");
    expect(usagePeriod(anchor, new Date("2026-02-10T00:00:00Z"))).toEqual({ start: new Date("2026-01-31T10:00:00Z"), end: new Date("2026-02-28T10:00:00Z") });
    expect(usagePeriod(anchor, new Date("2026-03-01T00:00:00Z"))).toEqual({ start: new Date("2026-02-28T10:00:00Z"), end: new Date("2026-03-31T10:00:00Z") });
    expect(usagePeriod(new Date("2026-10-04T10:00:00Z"), new Date("2027-10-04T10:00:00Z")).start).toEqual(new Date("2027-10-04T10:00:00Z")); // a yearly plan still gets a fresh allowance each month
    expect(usagePeriod(new Date("2026-10-04T10:00:00Z"), new Date("2026-10-04T09:00:00Z")).start).toEqual(new Date("2026-10-04T10:00:00Z"));
  });
  it("prices a top-up with 5% VAT as its own amount", () => {
    expect(quoteTopUp("orders50", 5)).toMatchObject({ subtotalMinor: 7900, vatMinor: 395, totalMinor: 8295 });
    expect(TOPUPS.orders200.orders).toBe(200); expect(LIMITS.pro.orders).toBeGreaterThan(LIMITS.plus.orders); expect(LIMITS.plus.orders).toBeGreaterThan(LIMITS.starter.orders); expect(TRIAL_LIMITS.orders).toBeLessThan(LIMITS.starter.orders); expect(TRIAL_LIMITS.imports).toBe(2);
  });
});

describe.skipIf(!enabled)("plan allowances, buffer, credits and top-ups", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string; let charge: any; let calls: any[] = [];
  const start = new Date(Date.now() - 5 * 86_400_000);
  const setPlan = (plan: string, extra: object = {}) => db.subscription.upsert({ where: { id: `sub-${suffix}` }, create: { id: `sub-${suffix}`, businessId: biz, plan, billing: "monthly", status: "ACTIVE", stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", currentPeriodStart: start, currentPeriodEnd: new Date(start.getTime() + 30 * 86_400_000), startedAt: start, ...extra }, update: { plan, ...extra } });
  const fill = async (kind: string, used: number) => { const { period } = await (await import("../src/modules/billing/usage")).allowanceFor(biz); await db.usageCounter.updateMany({ where: { businessId: biz, periodStart: period.start, kind }, data: { used } }); };
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const path = new URL(url).pathname, body = JSON.parse(String(init.body)); calls.push({ path, body }); return path === "/internal/billing/charge" ? Response.json(charge) : Response.json({}, { status: 404 }); }));
    owner = (await db.user.create({ data: { name: "use", email: `use-${suffix}@test.invalid`, phoneNumber: "+97150777" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Usage Burgers", locationName: "Main" }, "t")).id;
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("gives a trial the trial allowance, then stops at the limit", async () => {
    expect((await usageSummary(biz)).orders).toEqual({ used: 0, limit: TRIAL_LIMITS.orders });
    expect((await usageSummary(biz)).aiReplies.limit).toBe(REPLIES_PER_ORDER * TRIAL_LIMITS.orders);
    await consume(biz, "voice"); await fill("voice", TRIAL_LIMITS.voice);
    expect(await consume(biz, "voice")).toEqual({ ok: false });
  });
  it("uses the plan's orders, lets an order in progress finish with a 10% buffer, and refuses everyone else", async () => {
    await setPlan("starter"); const limit = LIMITS.starter.orders;
    expect(await consume(biz, "orders")).toMatchObject({ ok: true, from: "plan" });
    await fill("orders", limit - 1); expect(await canStartOrder(biz)).toBe(true);
    await fill("orders", limit); expect(await canStartOrder(biz)).toBe(false);
    expect(await consume(biz, "orders")).toEqual({ ok: false });
    expect(await consume(biz, "orders", { inProgress: true })).toMatchObject({ ok: true, from: "buffer" });
    await fill("orders", limit + Math.ceil(limit * 0.1));
    expect(await consume(biz, "orders", { inProgress: true })).toEqual({ ok: false });
    await setPlan("plus"); expect((await usageSummary(biz)).orders.limit).toBe(LIMITS.plus.orders); expect(await canStartOrder(biz)).toBe(true); // upgrading raises the limit straight away
  });
  it("counts simultaneous orders correctly: only the last free one is given out once", async () => {
    await fill("orders", LIMITS.plus.orders - 1);
    const results = await Promise.all([consume(biz, "orders"), consume(biz, "orders"), consume(biz, "orders")]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
  });
  it("uses bought orders after the monthly ones, never loses them, and gives one back when the order was not saved", async () => {
    await fill("orders", LIMITS.plus.orders); await addCredits(biz, 2);
    expect(await canStartOrder(biz)).toBe(true);
    const a = await consume(biz, "orders"), b = await consume(biz, "orders"), c = await consume(biz, "orders");
    expect([a, b, c].map(r => r.ok)).toEqual([true, true, false]); expect((await usageSummary(biz)).credits).toBe(0); expect(await canStartOrder(biz)).toBe(false);
    await refund(biz, "orders", a as any); expect((await usageSummary(biz)).credits).toBe(1);
    const p = await consume(biz, "imports"); expect((await usageSummary(biz)).imports.used).toBe(1); await refund(biz, "imports", p as any); expect((await usageSummary(biz)).imports.used).toBe(0);
    expect((await usageSummary(biz)).aiReplies.limit).toBe(REPLIES_PER_ORDER * (LIMITS.plus.orders + 1)); // bought orders widen the fair-use reply pool too
  });
  it("sells extra orders with the card on file: charged once (no VAT while Afkar's UAE VAT registration is inactive), orders added, invoice written, nothing added when the card fails", async () => {
    calls = []; charge = { status: "failed", failureMessage: "Declined" };
    await expect(buyTopUp(owner, biz, { pack: "orders50", requestId: "req-aaaaaaaa" })).rejects.toMatchObject({ code: "PAYMENT_FAILED" });
    const before = (await usageSummary(biz)).credits;
    charge = { status: "succeeded", paymentIntentId: "pi_topup" };
    const s = await buyTopUp(owner, biz, { pack: "orders50", requestId: "req-bbbbbbbb" });
    expect(calls.at(-1)).toMatchObject({ path: "/internal/billing/charge", body: { amountMinor: 7900, idempotencyKey: `topup:sub-${suffix}:req-bbbbbbbb` } });
    expect(s.usage.credits).toBe(before + 50);
    expect(await db.billingInvoice.findFirstOrThrow({ where: { businessId: biz, kind: "TOPUP" } })).toMatchObject({ totalMinor: 7900, vatMinor: 0 }); // Afkar's UAE VAT registration is inactive: no VAT collected
    expect(s.topups.map(t => t.id)).toEqual(["orders50", "orders200"]);
    await expect(buyTopUp(owner, biz, { pack: "nope", requestId: "req-cccccccc" })).rejects.toBeTruthy();
    await db.subscription.update({ where: { id: `sub-${suffix}` }, data: { stripePaymentMethodId: null } });
    await expect(buyTopUp(owner, biz, { pack: "orders50", requestId: "req-dddddddd" })).rejects.toMatchObject({ code: "NO_CARD" });
    expect((await getSubscription(owner, biz)).usage.orders.limit).toBe(LIMITS.plus.orders);
  });
});
