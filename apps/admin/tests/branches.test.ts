import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness } from "../src/modules/business/service";
import { EXTRA_BRANCH, LIMITS, quoteExtraBranch, quoteRenewal } from "../src/modules/billing/plans";
import { buyBranch, changePlan, entitlements, getSubscription, runBilling, setExtraBranches } from "../src/modules/billing/service";
import { getSettings, saveSettingsSection } from "../src/modules/settings/service";
import { usageSummary } from "../src/modules/billing/usage";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("branches per plan and the price of an extra branch", () => {
  it("gives Starter 1, Plus 3 (fixed), Pro 3 plus the extra ones bought, and only Pro can buy more or have a menu per branch", () => {
    expect(entitlements({ status: "ACTIVE", plan: "starter" })).toMatchObject({ branches: 1, canBuyBranches: false, menuPerBranch: false });
    expect(entitlements({ status: "ACTIVE", plan: "plus", extraBranches: 5 })).toMatchObject({ branches: 3, canBuyBranches: false, menuPerBranch: false });
    expect(entitlements({ status: "ACTIVE", plan: "pro" })).toMatchObject({ branches: 3, includedBranches: 3, canBuyBranches: true, menuPerBranch: true });
    expect(entitlements({ status: "PAST_DUE", plan: "pro", extraBranches: 2 })).toMatchObject({ branches: 5 });
    expect(entitlements({ status: "ENDED", plan: "pro", extraBranches: 2 })).toMatchObject({ branches: 1, canBuyBranches: false });
    expect(entitlements(null)).toMatchObject({ branches: 1 });
  });
  it("adds AED 99 per extra branch to a Pro renewal as its own line, with 5% VAT", () => {
    expect(quoteRenewal("pro", "monthly", 2, 5).lines.map(l => [l.name, l.unitMinor, l.quantity])).toEqual([["Lumia Order Pro (monthly)", 39900, 1], ["Extra branch (monthly)", 9900, 2]]);
    expect(quoteRenewal("pro", "monthly", 2, 5)).toMatchObject({ subtotalMinor: 59700, vatMinor: 2985, totalMinor: 62685 });
    expect(quoteRenewal("pro", "yearly", 1, 5).subtotalMinor).toBe(399000 + 99000);
    expect(quoteRenewal("plus", "monthly", 3, 5).lines).toHaveLength(1); // only Pro has extra branches
  });
  it("charges an extra branch only for the time left in the period", () => {
    const start = new Date("2026-10-01T00:00:00Z"), end = new Date("2026-10-31T00:00:00Z");
    expect(quoteExtraBranch("monthly", start, end, start, 5)).toMatchObject({ subtotalMinor: 9900, totalMinor: 10395 });
    expect(quoteExtraBranch("monthly", start, end, new Date("2026-10-16T00:00:00Z"), 5).subtotalMinor).toBe(4950);
    expect(quoteExtraBranch("monthly", start, end, new Date("2026-11-02T00:00:00Z"), 5).subtotalMinor).toBe(0);
  });
});

describe.skipIf(!enabled)("branch limits, buying and releasing branches", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string; let charge: any; let calls: any[] = [];
  const save = (section: string, v: unknown) => saveSettingsSection(owner, biz, section, v, "r-" + Math.random());
  const branch = (n: number, active = true) => ({ id: `tmp-${n}`, name: `Branch ${n}`, emirate: "Sharjah", area: "Al Majaz", address: `Street ${n}`, phone: "", eta: "45", active, pin: false, coords: "" });
  const withBranches = async (n: number) => { const cur = (await getSettings(owner, biz)).sections.branches as any[]; return [...cur, ...Array.from({ length: Math.max(0, n - cur.length) }, (_, i) => branch(cur.length + i))]; };
  const setSub = (plan: string, extra: object = {}) => db.subscription.upsert({ where: { id: `sub-${suffix}` }, create: { id: `sub-${suffix}`, businessId: biz, plan, billing: "monthly", status: "ACTIVE", stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }, currentPeriodStart: new Date(Date.now() - 5 * 86_400_000), currentPeriodEnd: new Date(Date.now() + 25 * 86_400_000), nextChargeAt: new Date(Date.now() + 25 * 86_400_000), startedAt: new Date(), ...extra }, update: { plan, ...extra } });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const path = new URL(url).pathname, body = JSON.parse(String(init.body)); calls.push({ path, body }); return path === "/internal/billing/charge" ? Response.json(charge) : Response.json({}, { status: 404 }); }));
    owner = (await db.user.create({ data: { name: "br", email: `br-${suffix}@test.invalid`, phoneNumber: "+97150666" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Branch Burgers", locationName: "Main" }, "t")).id;
    charge = { status: "succeeded", paymentIntentId: "pi_branch" };
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("Starter has one branch: a second is refused with an upgrade message", async () => {
    await setSub("starter");
    await expect(save("branches", await withBranches(2))).rejects.toMatchObject({ code: "PLAN_LIMIT", message: expect.stringContaining("Upgrade") });
  });
  it("Plus has three and no more: the fourth is refused and cannot be bought", async () => {
    await setSub("plus");
    expect(((await save("branches", await withBranches(3))).value as any[])).toHaveLength(3);
    await expect(save("branches", await withBranches(4))).rejects.toMatchObject({ code: "PLAN_LIMIT", message: expect.stringContaining("Upgrade to Pro") });
    await expect(buyBranch(owner, biz, { requestId: "req-plus-0001" })).rejects.toMatchObject({ code: "NOT_PRO" });
    expect((await getSettings(owner, biz)).branchBuy).toBeNull();
  });
  it("Pro: a fourth branch needs one bought for AED 99 (+VAT, prorated), then it can be added and adds 80 orders", async () => {
    await setSub("pro", { extraBranches: null });
    await expect(save("branches", await withBranches(4))).rejects.toMatchObject({ code: "PLAN_LIMIT", message: expect.stringContaining("AED 99") });
    expect((await getSettings(owner, biz)).branchBuy).toMatchObject({ priceAed: 99, period: "month", hasCard: true, card: "4242" });
    const before = (await usageSummary(biz)).orders.limit;
    charge = { status: "failed", failureMessage: "Declined" };
    await expect(buyBranch(owner, biz, { requestId: "req-pro-0001" })).rejects.toMatchObject({ code: "PAYMENT_FAILED" });
    expect((await db.subscription.findFirstOrThrow({ where: { businessId: biz } })).extraBranches ?? 0).toBe(0);
    charge = { status: "succeeded", paymentIntentId: "pi_branch" }; calls = [];
    const s = await buyBranch(owner, biz, { requestId: "req-pro-0002" });
    const sent = calls.find(c => c.path === "/internal/billing/charge")!.body;
    expect(sent.idempotencyKey).toMatch(/^branch:sub-/); expect(sent.amountMinor).toBeGreaterThan(8000); expect(sent.amountMinor).toBeLessThanOrEqual(10395); // 25 of 30 days of AED 99 + VAT
    expect(s.branches).toMatchObject({ included: 3, extra: 1, limit: 4, used: 3, canBuy: true, menuPerBranch: true });
    expect((await usageSummary(biz)).orders.limit).toBe(before + EXTRA_BRANCH.orders);
    expect(await db.billingInvoice.findFirstOrThrow({ where: { businessId: biz, kind: "BRANCH" } })).toMatchObject({ totalMinor: sent.amountMinor });
    expect(((await save("branches", await withBranches(4))).value as any[])).toHaveLength(4);
    await expect(save("branches", await withBranches(5))).rejects.toMatchObject({ code: "PLAN_LIMIT" });
  });
  it("switched-off branches do not count against the plan", async () => {
    const cur = (await getSettings(owner, biz)).sections.branches as any[];
    const off = cur.map((b, i) => (i === 3 ? { ...b, active: false } : b));
    await save("branches", off);
    expect(((await save("branches", [...off, branch(9)])).value as any[]).filter(b => b.active)).toHaveLength(4);
  });
  it("the next renewal charges the plan plus the extra branches, and a release lowers it from then on", async () => {
    const sub = await db.subscription.findFirstOrThrow({ where: { businessId: biz } });
    await expect(setExtraBranches(owner, biz, { extra: 0 })).rejects.toMatchObject({ code: "PLAN_LIMIT" }); // 4 branches are active
    const cur = (await getSettings(owner, biz)).sections.branches as any[]; await save("branches", cur.map((b, i) => (i >= 3 ? { ...b, active: false } : b)));
    const v = await setExtraBranches(owner, biz, { extra: 0 }); expect(v.branches).toMatchObject({ extra: 1, pendingExtra: 0 });
    expect(v.nextCharge!.amountMinor).toBe(quoteRenewal("pro", "monthly", 0, 0).totalMinor);
    await db.subscription.update({ where: { id: sub.id }, data: { pendingExtraBranches: null, nextChargeAt: new Date(Date.now() - 1000), currentPeriodEnd: new Date(Date.now() - 1000) } });
    calls = []; await runBilling();
    expect(calls.find(c => c.path === "/internal/billing/charge" && c.body.metadata?.subscriptionId === sub.id)!.body.amountMinor).toBe(quoteRenewal("pro", "monthly", 1, 0).totalMinor);
  });
  it("a downgrade is refused while more branches than the smaller plan allows are active", async () => {
    await expect(changePlan(owner, biz, { plan: "starter", billing: "monthly" })).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    const cur = (await getSettings(owner, biz)).sections.branches as any[];
    await save("branches", cur.map((b, i) => (i > 0 ? { ...b, active: false } : b)));
    expect(await changePlan(owner, biz, { plan: "starter", billing: "monthly" })).toMatchObject({ pendingPlan: "starter" });
    expect(LIMITS.pro.orders).toBe(250);
  });
});
