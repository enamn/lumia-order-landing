import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { applySession } from "../src/modules/billing/service";
import { quoteSignup } from "../src/modules/billing/plans";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("subscribing again", () => {
  afterAll(async () => { await db.$disconnect(); });
  it("software-only payments record no terminal, and a renewal without a terminal keeps the one the restaurant already has", async () => {
    const owner = (await db.user.create({ data: { name: "re", email: `re-${crypto.randomUUID().slice(0, 8)}@test.invalid`, phoneNumber: "+97150555" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    const biz = (await createBusiness(owner, { name: "Resub Grill", locationName: "Main" }, "t")).id;
    const session = (terminals: number, id: string) => ({ sessionId: id, mode: "payment", complete: true, paid: true, customerId: "cus_r", paymentMethodId: null, paymentIntentId: "pi_r" + id, amountTotalMinor: quoteSignup("plus", "monthly", terminals, 5).totalMinor, metadata: { businessId: biz, kind: "signup", plan: "plus", billing: "monthly", terminals: String(terminals), terminalAddress: terminals ? "Shop 4, Sharjah" : "", taxRate: "5" } }) as any;
    await applySession(biz, session(1, "cs_r1"));
    expect(await db.subscription.findFirstOrThrow({ where: { businessId: biz } })).toMatchObject({ terminals: 1, terminalAddress: "Shop 4, Sharjah" });
    await db.subscription.updateMany({ where: { businessId: biz }, data: { status: "CANCELED", nextChargeAt: null } }); // the plan ended
    await applySession(biz, session(0, "cs_r2")); // subscribes again, no new terminal
    expect(await db.subscription.findFirstOrThrow({ where: { businessId: biz } })).toMatchObject({ status: "ACTIVE", terminals: 1, terminalAddress: "Shop 4, Sharjah", terminal: { stage: 0 } });
    expect(await db.billingInvoice.count({ where: { businessId: biz } })).toBe(2);
    const fresh = (await createBusiness((await db.user.create({ data: { name: "so", email: `so-${crypto.randomUUID().slice(0, 8)}@test.invalid`, phoneNumber: "+97150556" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id, { name: "Software Only", locationName: "Main" }, "t")).id;
    await applySession(fresh, { ...session(0, "cs_r3"), metadata: { ...session(0, "x").metadata, businessId: fresh } });
    expect(await db.subscription.findFirstOrThrow({ where: { businessId: fresh } })).toMatchObject({ status: "ACTIVE", terminals: 0, terminalAddress: null });
  });
});
