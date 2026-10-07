import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness } from "../src/modules/business/service";
import { recordInbound } from "../src/modules/messages/inbound";
import { accessFor, getSubscription, requireAccess } from "../src/modules/billing/service";
import { reviewVat, saveBillingTax } from "../src/modules/tax/service";
const enabled = process.env.RUN_DB_TESTS === "true";
const DAY = 86_400_000;

describe.skipIf(!enabled)("a Saudi restaurant goes live only after its VAT registration is verified", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5593${Date.now().toString().slice(-9)}`;
  let owner: string, admin: string, biz: string, calls: { path: string }[]; let n = 0;
  const ai = () => calls.filter(c => c.path === "/internal/ai/reply");
  const say = (text: string) => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.lv.${suffix}.${++n}`, senderId: "966501009999", timestamp: String(Math.floor(Date.now() / 1000)), senderName: "Sara", type: "text", textBody: text } as any] });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = new URL(url).pathname; calls.push({ path });
      if (path === "/internal/whatsapp/send") return Response.json({ messageId: `wamid.out.lv.${suffix}.${++n}` });
      if (path === "/internal/ai/reply") return Response.json({ intent: "other", language: "en", reply: "Hello!", needsHuman: false, order: null });
      return Response.json({}, { status: 404 });
    }));
    owner = (await db.user.create({ data: { name: "lv", email: `lv-${suffix}@test.invalid`, phoneNumber: `+9665${String(Date.now()).slice(-8)}`, phoneNumberVerified: true } })).id;
    admin = (await db.user.create({ data: { name: "lva", email: `lva-${suffix}@test.invalid`, phoneNumber: `+9715${String(Date.now() + 3).slice(-8)}`, phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Riyadh Live", vatNumber: "300123456700003", locationName: "Main" }, "t")).id;
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990016", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    await db.business.update({ where: { id: biz }, data: { createdAt: new Date(Date.now() - 60 * DAY) } }); // old account: the trial must not have been running
    calls = [];
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("can use the dashboard to set up (never locked), but the assistant stays silent and customers' messages are kept", async () => {
    expect(await accessFor(biz)).toMatchObject({ active: true, liveOrdering: false, reason: "setup" });
    await requireAccess(owner, biz);
    const before = await db.message.count({ where: { conversation: { businessId: biz } } });
    await say("hi"); expect(ai().length).toBe(0); expect(await db.message.count({ where: { conversation: { businessId: biz } } })).toBe(before + 1);
    const sub = await getSubscription(owner, biz); expect(sub.access).toMatchObject({ reason: "setup" }); expect(sub.trial).toMatchObject({ started: false }); expect(sub.tax).toMatchObject({ eligible: false, vatStatus: "PENDING" });
  });
  it("goes live, with a 14-day trial counted from the verification, once the VAT registration is approved", async () => {
    await saveBillingTax(owner, biz, { legalName: "Riyadh Live Trading", billingAddress: { line1: "Olaya Street", city: "Riyadh" }, vatRegistered: true, vatNumber: "300111222333003" });
    await reviewVat(admin, biz, { decision: "VERIFIED", method: "MANUAL_DOCUMENT_REVIEW", evidenceReference: "doc-9", validTo: new Date(Date.now() + 300 * DAY).toISOString(), reason: "certificate checked" });
    expect(await accessFor(biz)).toMatchObject({ active: true, liveOrdering: true, reason: "trial" });
    calls = []; await say("hello again"); expect(ai().length).toBe(1);
    const sub = await getSubscription(owner, biz); expect(sub.trial).toMatchObject({ started: true, daysLeft: 14 }); expect(sub.tax).toMatchObject({ eligible: true, destinationTreatment: "REVERSE_CHARGE", ratePercent: 0 });
  });
  it("goes silent again when the verification runs out", async () => {
    await db.billingTaxProfile.update({ where: { businessId: biz }, data: { validTo: new Date(Date.now() - DAY) } });
    expect((await accessFor(biz)).liveOrdering).toBe(false); calls = []; await say("anyone?"); expect(ai().length).toBe(0);
  });
});
