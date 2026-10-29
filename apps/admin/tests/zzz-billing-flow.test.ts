import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness } from "../src/modules/business/service";
import { setSupplierRegistration } from "../src/modules/tax/service";
import { quoteSignup, quoteRenewal } from "../src/modules/billing/plans";
import { confirmSession, runBilling, startCardSetup, confirmCardSetup, listCards, makeDefaultCard, removeCard, setCancel, buyTopUp, changePlan } from "../src/modules/billing/service";
import { runReminders } from "../src/modules/billing/reminders";
const enabled = process.env.RUN_DB_TESTS === "true";

// The whole paid path with Stripe and the mail service faked: subscribe, receipts, cards, renew, retry, top-up, cancel.
describe.skipIf(!enabled)("billing flow: subscribe, cards, renew, retry, credits, cancel", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string;
  let mails: { to: string; subject: string; text: string }[], charge: any, saved: any[], removed: string[], session: any, setup: any;
  const sub = () => db.subscription.findFirstOrThrow({ where: { businessId: biz } });
  const paid = (meta: Record<string, string>, amountTotalMinor?: number, pm = "pm_1") => ({ sessionId: `cs_${Math.random().toString(36).slice(2, 10)}`, mode: meta.kind === "card" ? "setup" : "payment", complete: true, paid: true, customerId: "cus_1", paymentMethodId: pm, paymentIntentId: `pi_${suffix}_signup`, amountTotalMinor, metadata: { businessId: biz, ...meta } });
  beforeAll(async () => {
    await ensureMongoIndexes();
    await setSupplierRegistration("test-admin", { country: "AE", number: "100123456700003", state: "ACTIVE", effectiveFrom: new Date(Date.now() - 86_400_000).toISOString(), effectiveTo: null, reason: "test set-up" });
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.APP_URL = "https://app.test";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname, body = JSON.parse(String(init.body));
      if (path === "/internal/billing/session") return Response.json(session);
      if (path === "/internal/billing/card-setup") return Response.json({ setupIntentId: "seti_form1", clientSecret: "seti_form1_secret_x", publishableKey: "pk_test_x" });
      if (path === "/internal/billing/card-setup/result") return Response.json(setup);
      if (path === "/internal/billing/card") return Response.json({ brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 });
      if (path === "/internal/billing/cards") return Response.json({ cards: saved });
      if (path === "/internal/billing/card/remove") { removed.push(body.paymentMethodId); saved = saved.filter(c => c.id !== body.paymentMethodId); return Response.json({ removed: true }); }
      if (path === "/internal/billing/charge") return Response.json(charge);
      if (path === "/internal/email/send") { mails.push({ to: body.to, subject: body.subject, text: body.text }); return Response.json({ ok: true }); }
      return Response.json({}, { status: 404 });
    }));
    owner = (await db.user.create({ data: { name: "own", email: `own-${suffix}@test.invalid`, phoneNumber: `+97150999${String(4000 + Math.floor(Math.random() * 999))}`, phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Flow Burgers", locationName: "Main" }, "t")).id;
    await db.business.update({ where: { id: biz }, data: { email: "owner@flow.test", emailVerifiedAt: new Date() } });
  });
  afterAll(async () => { await setSupplierRegistration("test-admin", { country: "AE", number: "", state: "INACTIVE", effectiveFrom: null, effectiveTo: null, reason: "test clean-up" }); vi.unstubAllGlobals(); await db.$disconnect(); });

  it("subscribing emails a receipt with the plan, amount, invoice and renewal date", async () => {
    mails = []; session = paid({ kind: "signup", plan: "starter", billing: "monthly", terminals: "0", taxRate: "5" }, quoteSignup("starter", "monthly", 0, 5).totalMinor);
    expect((await confirmSession(owner, biz, { sessionId: session.sessionId })).applied).toBe(true);
    expect(mails).toHaveLength(1); expect(mails[0]).toMatchObject({ to: "owner@flow.test" }); expect(mails[0]!.subject).toContain("Starter"); expect(mails[0]!.text).toMatch(/LO-\d{4}-\d{6}/);
    await confirmSession(owner, biz, { sessionId: session.sessionId }); expect(mails).toHaveLength(1); // the same payment is never mailed twice
  });
  it("lists every saved card, switches the main card and removes a spare one", async () => {
    saved = [{ id: "pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }, { id: "pm_2", brand: "visa", last4: "0005", expMonth: 1, expYear: 2031, wallet: "apple_pay" }]; removed = [];
    expect((await listCards(owner, biz)).cards.map(c => [c.id, c.isDefault])).toEqual([["pm_1", true], ["pm_2", false]]);
    await expect(removeCard(owner, biz, { paymentMethodId: "pm_1" })).rejects.toMatchObject({ code: "CARD_IN_USE" }); // pays the renewals
    await makeDefaultCard(owner, biz, { paymentMethodId: "pm_2" });
    expect(await sub()).toMatchObject({ stripePaymentMethodId: "pm_2", card: { last4: "0005", wallet: "apple_pay" } });
    await removeCard(owner, biz, { paymentMethodId: "pm_1" }); expect(removed).toEqual(["pm_1"]);
    await expect(makeDefaultCard(owner, biz, { paymentMethodId: "pm_9" })).rejects.toMatchObject({ status: 404 });
  });
  it("saves a card from Lumia's own card form once Stripe confirms it, and refuses an unfinished or foreign setup", async () => {
    const open = await startCardSetup(owner, biz); expect(open).toMatchObject({ setupIntentId: "seti_form1", clientSecret: "seti_form1_secret_x", publishableKey: "pk_test_x" });
    setup = { setupIntentId: "seti_form1", succeeded: false, customerId: "cus_1", paymentMethodId: "pm_form", metadata: { businessId: biz } };
    await expect(confirmCardSetup(owner, biz, { setupIntentId: "seti_form1" })).rejects.toMatchObject({ code: "CARD_NOT_SAVED" }); // not confirmed by Stripe yet
    setup = { ...setup, succeeded: true, metadata: { businessId: "someone-else" } };
    await expect(confirmCardSetup(owner, biz, { setupIntentId: "seti_form1" })).rejects.toMatchObject({ status: 404 });
    setup = { ...setup, metadata: { businessId: biz } };
    expect((await confirmCardSetup(owner, biz, { setupIntentId: "seti_form1" })).applied).toBe(true);
    expect(await sub()).toMatchObject({ stripePaymentMethodId: "pm_form", stripeCustomerId: "cus_1" });
    expect(await confirmCardSetup(owner, biz, { setupIntentId: "seti_form1" })).toMatchObject({ applied: false, reason: "ALREADY_APPLIED" });
  });
  it("a renewal mails a receipt; a failed one mails every retry; the last card can go once the plan is cancelled", async () => {
    const s0 = await sub(); mails = []; charge = { status: "succeeded", paymentIntentId: `pi_${suffix}_r` };
    const due = new Date(s0.currentPeriodEnd.getTime() + 60_000);
    expect((await runBilling(due, biz)).renewed).toBeGreaterThanOrEqual(1); // other test files share this database expect(mails.map(m => m.subject)).toEqual(["Your plan was renewed"]);
    const s1 = await sub(); mails = []; charge = { status: "failed", failureMessage: "Declined" };
    let now = new Date(s1.currentPeriodEnd.getTime() + 1000);
    for (let i = 1; i <= 2; i++) { expect((await runBilling(now, biz)).failed).toBeGreaterThanOrEqual(1); await runReminders(now, biz); const s = await sub(); expect(mails).toHaveLength(i); expect(mails.at(-1)!.text).toContain("try again"); now = new Date(s.nextChargeAt!.getTime() + 1000); }
    charge = { status: "succeeded", paymentIntentId: `pi_${suffix}_r2` }; mails = [];
    expect((await runBilling(now, biz)).renewed).toBeGreaterThanOrEqual(1); expect((await sub()).status).toBe("ACTIVE");
    await setCancel(owner, biz, true); await removeCard(owner, biz); expect(await sub()).toMatchObject({ stripePaymentMethodId: null, card: null });
    await expect(setCancel(owner, biz, false)).rejects.toMatchObject({ code: "NO_CARD" });
  });
  it("extra orders and upgrades mail a receipt", async () => {
    session = paid({ kind: "card" }, undefined, "pm_3"); saved = [{ id: "pm_3", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }];
    await confirmSession(owner, biz, { sessionId: session.sessionId }); await setCancel(owner, biz, false);
    mails = []; charge = { status: "succeeded", paymentIntentId: `pi_${suffix}_t` };
    await buyTopUp(owner, biz, { pack: "orders50", requestId: "req-topup-1" }); expect(mails.map(m => m.subject)).toEqual(["Extra orders added"]); expect(mails[0]!.text).toContain("50 extra orders");
    charge = { status: "succeeded", paymentIntentId: `pi_${suffix}_u` }; mails = []; await changePlan(owner, biz, { plan: "plus", billing: "monthly" }); expect(mails.map(m => m.subject)).toEqual(["You are now on Plus"]);
  });
});

describe.skipIf(!enabled)("late renewal", () => {
  it("a renewal paid long after its end starts the new period now and is charged once, with a key of its own", async () => {
    const suffix2 = crypto.randomUUID().slice(0, 8), charges: any[] = [];
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const path = new URL(url).pathname; if (path === "/internal/billing/charge") { charges.push(JSON.parse(String(init.body))); return Response.json({ status: "succeeded", paymentIntentId: `pi_${suffix2}_${charges.length}` }); } return Response.json({}); }));
    const u = await db.user.create({ data: { name: "late", email: `late-${suffix2}@test.invalid`, phoneNumber: `+97150777${String(1000 + Math.floor(Math.random() * 8999))}`, phoneNumberVerified: true } });
    const b = await createBusiness(u.id, { name: "Late Burgers", locationName: "Main" }, "t");
    const now = new Date(), old = new Date(now.getTime() - 90 * 86_400_000);
    await db.subscription.create({ data: { businessId: b.id, plan: "starter", billing: "monthly", status: "ACTIVE", stripeCustomerId: "cus_late", stripePaymentMethodId: "pm_late", currentPeriodStart: new Date(old.getTime() - 30 * 86_400_000), currentPeriodEnd: old, nextChargeAt: old, startedAt: old, processedSessions: [] } });
    expect((await runBilling(now, b.id)).renewed).toBe(1);
    const s = await db.subscription.findFirstOrThrow({ where: { businessId: b.id } });
    expect(Math.abs(s.currentPeriodStart.getTime() - now.getTime())).toBeLessThan(5000); expect(s.currentPeriodEnd.getTime()).toBeGreaterThan(now.getTime());
    expect((await runBilling(now, b.id)).checked).toBe(0); expect(charges).toHaveLength(1); expect(charges[0].idempotencyKey).toContain(old.toISOString());
    vi.unstubAllGlobals();
  });
});

// The sandbox clock: a month is 1 minute, a year is 1 hour, and a retry "day" is 1 minute.
describe("sandbox billing clock", () => {
  it("shortens periods and retries only when BILLING_SANDBOX is on", async () => {
    vi.resetModules(); vi.stubEnv("BILLING_SANDBOX", "true");
    const on = await import("../src/modules/billing/plans"); const t = new Date("2026-10-04T10:00:00Z");
    expect(on.addPeriod(t, "monthly").getTime() - t.getTime()).toBe(60_000); expect(on.addPeriod(t, "yearly").getTime() - t.getTime()).toBe(3_600_000); expect(on.RETRY_STEP_MS).toBe(60_000);
    vi.resetModules(); vi.stubEnv("BILLING_SANDBOX", "");
    const off = await import("../src/modules/billing/plans");
    expect(off.addPeriod(t, "monthly").toISOString()).toBe("2026-11-04T10:00:00.000Z"); expect(off.RETRY_STEP_MS).toBe(86_400_000);
    vi.unstubAllEnvs();
  });
});
