import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness } from "../src/modules/business/service";
import { LIMITS, TRIAL_LIMITS, TOPUPS, quoteTopUp } from "../src/modules/billing/plans";
import { consume, refund, usagePeriod, usageSummary, addCredits } from "../src/modules/billing/usage";
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
    expect(quoteTopUp("ai500")).toMatchObject({ subtotalMinor: 6900, vatMinor: 345, totalMinor: 7245 });
    expect(TOPUPS.ai2000.replies).toBe(2000); expect(LIMITS.pro.aiReplies).toBeGreaterThan(LIMITS.plus.aiReplies); expect(TRIAL_LIMITS.aiReplies).toBeLessThan(LIMITS.starter.aiReplies);
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
    expect((await usageSummary(biz)).aiReplies).toEqual({ used: 0, limit: TRIAL_LIMITS.aiReplies });
    await consume(biz, "voice"); await fill("voice", TRIAL_LIMITS.voice);
    expect(await consume(biz, "voice")).toEqual({ ok: false });
    expect((await usageSummary(biz)).voice).toEqual({ used: TRIAL_LIMITS.voice, limit: TRIAL_LIMITS.voice });
  });
  it("uses the plan's allowance, lets an order in progress finish with a 10% buffer, and refuses everyone else", async () => {
    await setPlan("starter"); const limit = LIMITS.starter.aiReplies;
    const first = await consume(biz, "ai"); expect(first).toMatchObject({ ok: true, from: "plan" });
    await fill("ai", limit);
    expect(await consume(biz, "ai")).toEqual({ ok: false });
    expect(await consume(biz, "ai", { inProgress: true })).toMatchObject({ ok: true, from: "buffer" });
    await fill("ai", limit + Math.ceil(limit * 0.1));
    expect(await consume(biz, "ai", { inProgress: true })).toEqual({ ok: false });
    await setPlan("plus"); expect((await usageSummary(biz)).aiReplies.limit).toBe(LIMITS.plus.aiReplies); // upgrading raises the limit straight away
  });
  it("counts two simultaneous messages correctly: only the last free unit is given out once", async () => {
    await fill("ai", LIMITS.plus.aiReplies - 1);
    const results = await Promise.all([consume(biz, "ai"), consume(biz, "ai"), consume(biz, "ai")]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
  });
  it("uses bought credits after the allowance, never loses them, and gives a unit back when the work failed", async () => {
    await fill("ai", LIMITS.plus.aiReplies); await addCredits(biz, 2);
    const a = await consume(biz, "ai"), b = await consume(biz, "ai"), c = await consume(biz, "ai");
    expect([a, b, c].map(r => r.ok)).toEqual([true, true, false]); expect((await usageSummary(biz)).credits).toBe(0);
    await refund(biz, "ai", a as any); expect((await usageSummary(biz)).credits).toBe(1);
    const p = await consume(biz, "imports"); expect((await usageSummary(biz)).imports.used).toBe(1); await refund(biz, "imports", p as any); expect((await usageSummary(biz)).imports.used).toBe(0);
  });
  it("sells a top-up with the card on file: charged with VAT once, credits added, invoice written, nothing added when the card fails", async () => {
    calls = []; charge = { status: "failed", failureMessage: "Declined" };
    await expect(buyTopUp(owner, biz, { pack: "ai500", requestId: "req-aaaaaaaa" })).rejects.toMatchObject({ code: "PAYMENT_FAILED" });
    const before = (await usageSummary(biz)).credits;
    charge = { status: "succeeded", paymentIntentId: "pi_topup" };
    const s = await buyTopUp(owner, biz, { pack: "ai500", requestId: "req-bbbbbbbb" });
    expect(calls.at(-1)).toMatchObject({ path: "/internal/billing/charge", body: { amountMinor: 7245, idempotencyKey: `topup:sub-${suffix}:req-bbbbbbbb` } });
    expect(s.usage.credits).toBe(before + 500);
    expect(await db.billingInvoice.findFirstOrThrow({ where: { businessId: biz, kind: "TOPUP" } })).toMatchObject({ totalMinor: 7245, vatMinor: 345 });
    expect(s.topups.map(t => t.id)).toEqual(["ai500", "ai2000"]);
    await expect(buyTopUp(owner, biz, { pack: "nope", requestId: "req-cccccccc" })).rejects.toBeTruthy();
    await db.subscription.update({ where: { id: `sub-${suffix}` }, data: { stripePaymentMethodId: null } });
    await expect(buyTopUp(owner, biz, { pack: "ai500", requestId: "req-dddddddd" })).rejects.toMatchObject({ code: "NO_CARD" });
    expect((await getSubscription(owner, biz)).usage.aiReplies.limit).toBe(LIMITS.plus.aiReplies);
  });
});
