import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness } from "../src/modules/business/service";
import { recordInbound } from "../src/modules/messages/inbound";
import { listCampaigns, offerLine, sendCampaign } from "../src/modules/campaigns/service";
import { recordStatuses } from "../src/modules/campaigns/status";
import { usageSummary } from "../src/modules/billing/usage";
import { LIMITS } from "../src/modules/billing/plans";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("the offer line in a campaign", () => {
  const until = new Date("2026-10-12T08:00:00Z");
  it("names the code, percentage and last day, in the language of the message", () => {
    expect(offerLine({ code: "WEEKEND20", percent: 20 }, until, false)).toBe("Code WEEKEND20: 20% off, valid until 12 Oct.");
    expect(offerLine({ code: "WEEKEND20", percent: 20 }, until, true)).toContain("WEEKEND20"); expect(offerLine(null, null, false)).toBe("Reply to this message to order.");
  });
});

describe.skipIf(!enabled)("campaigns", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5591${Date.now().toString().slice(-9)}`;
  let owner: string, biz: string, calls: { path: string; body: any }[]; let n = 0, out = 0; let failTo: Record<string, string> = {}, templateOff = false;
  const ids: Record<string, string> = {};
  const customer = async (key: string, phone: string, name: string, extra: object = {}) => {
    const c = await db.customer.create({ data: { businessId: biz, phone, displayName: name, ...extra } }); ids[key] = c.id;
    await db.order.create({ data: { businessId: biz, locationId: (await db.location.findFirstOrThrow({ where: { businessId: biz } })).id, customerId: c.id, orderNumber: String(++n + 100), fulfillmentType: "PICKUP", status: "COMPLETED", subtotalMinor: 5000, totalMinor: 5000 } });
  };
  const sent = () => calls.filter(c => c.path === "/internal/whatsapp/campaign");
  const send = (over: object = {}) => sendCampaign(owner, biz, { mode: "all", message: "Hi {name}, 20% off this weekend.", ...over });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname, body = JSON.parse(String(init.body)); calls.push({ path, body });
      if (path === "/internal/whatsapp/media") return Response.json({ mediaId: "88776655" });
      if (path === "/internal/whatsapp/campaign") { if (templateOff) return Response.json({ error: { code: "TEMPLATE_UNAVAILABLE" } }, { status: 409 }); if (failTo[body.to]) return Response.json({ error: { code: failTo[body.to] } }, { status: 409 }); return Response.json({ messageId: `wamid.camp.${suffix}.${++out}` }); }
      if (path === "/internal/whatsapp/send") return Response.json({ messageId: `wamid.out.${suffix}.${++out}` });
      if (path === "/internal/ai/reply") return Response.json({ intent: "other", language: "en", reply: "ai", needsHuman: false, order: null });
      return Response.json({}, { status: 404 });
    }));
    owner = (await db.user.create({ data: { name: "cp", email: `cp-${suffix}@test.invalid`, phoneNumber: "+97150333" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Burger House", locationName: "Main" }, "t")).id;
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990014", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    await customer("sara", "+971501000001", "Sara Khalid"); await customer("omar", "+971501000002", "Omar"); await customer("nameless", "+971501000003", ""); await customer("stopped", "+971501000004", "Stopped One", { marketingOptOut: true });
    calls = [];
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("is for Plus and Pro only", async () => {
    await expect(send()).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
    await db.subscription.create({ data: { businessId: biz, plan: "plus", billing: "monthly", status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000), startedAt: new Date() } });
  });
  it("messages every customer who has not opted out, with their first name, and keeps the numbers", async () => {
    calls = []; const r = await send();
    expect(sent().map(c => c.body.to).sort()).toEqual(["+971501000001", "+971501000002", "+971501000003"]); // the customer who said STOP is skipped
    const bySara = sent().find(c => c.body.to === "+971501000001")!.body; expect(bySara).toMatchObject({ message: "Hi Sara, 20% off this weekend.", offer: "Reply to this message to order.", restaurantName: "Burger House", accessToken: "biz-token", phoneNumberId: PNID }); expect(bySara.mediaId).toBeUndefined();
    expect(sent().find(c => c.body.to === "+971501000003")!.body.message).toBe("Hi there, 20% off this weekend."); // no name known
    expect(r).toMatchObject({ mode: "all", recipients: 3, sent: 3, read: 0, used: 0, failed: 0, status: "DONE", hasImage: false });
    expect(await db.campaignRecipient.count({ where: { campaignId: r.id, status: "SENT", messageId: { startsWith: "wamid.camp." } } })).toBe(3);
    expect((await usageSummary(biz)).campaigns.used).toBe(3);
    expect((await listCampaigns(owner, biz)).campaigns[0]).toMatchObject({ id: r.id, sent: 3 });
  });
  it("a custom offer goes to the picked customers with a code (created, valid for the chosen days), and a code is required", async () => {
    await expect(send({ mode: "offer", customerIds: [ids.sara] })).rejects.toMatchObject({ code: "CODE_REQUIRED" });
    await expect(send({ mode: "offer", customerIds: [] , code: { code: "TWO20", percent: 20, days: 7 } })).rejects.toMatchObject({ code: "NO_RECIPIENTS" });
    calls = []; const code = "OFR" + suffix.toUpperCase().slice(0, 6);
    const r = await send({ mode: "offer", customerIds: [ids.sara, ids.stopped, "no-such-id"], message: "Hi {name}, thanks! Your code is below.", code: { code: code.toLowerCase(), percent: 15, days: 14 } });
    expect(sent().map(c => c.body.to)).toEqual(["+971501000001"]); expect(sent()[0]!.body.offer).toMatch(new RegExp(`^Code ${code}: 15% off, valid until \\d{1,2} \\w{3}\\.$`));
    const row = await db.discountCode.findFirstOrThrow({ where: { businessId: biz, code } });
    expect(row).toMatchObject({ percent: 15, active: true, usedCount: 0, campaignId: r.id }); expect(Math.round((row.expiresAt.getTime() - row.startsAt.getTime()) / 86400000)).toBe(14);
    expect(r).toMatchObject({ mode: "offer", recipients: 1, title: `15% off · ${code}` });
  });
  it("a running code cannot be reused; an ended one starts again fresh", async () => {
    const code = "RUN" + suffix.toUpperCase().slice(0, 6);
    await send({ code: { code, percent: 10, days: 7 } });
    await expect(send({ code: { code, percent: 20, days: 7 } })).rejects.toMatchObject({ code: "CODE_IN_USE" });
    const row = await db.discountCode.findFirstOrThrow({ where: { businessId: biz, code } });
    await db.discountRedemption.create({ data: { codeId: row.id, businessId: biz, customerId: ids.sara!, orderId: "o1" } }); await db.discountCode.update({ where: { id: row.id }, data: { usedCount: 1, expiresAt: new Date(Date.now() - 1000) } });
    await send({ code: { code, percent: 25, days: 30 } });
    expect(await db.discountCode.findFirstOrThrow({ where: { id: row.id } })).toMatchObject({ percent: 25, usedCount: 0, active: true }); expect(await db.discountRedemption.count({ where: { codeId: row.id } })).toBe(0);
  });
  it("uploads the offer image once and sends every message with it", async () => {
    calls = []; const r = await send({ image: { name: "offer.png", mimeType: "image/png", data: Buffer.from("89504e470d0a1a0a", "hex").toString("base64") } });
    expect(calls.filter(c => c.path === "/internal/whatsapp/media")).toHaveLength(1); expect(sent().every(c => c.body.mediaId === "88776655")).toBe(true);
    expect(r).toMatchObject({ hasImage: true }); expect((await db.campaign.findUniqueOrThrow({ where: { id: r.id } })).imageMediaId).toBe("88776655");
    await expect(send({ image: { name: "x.png", mimeType: "image/png", data: "x".repeat(7_000_000) } })).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
  it("one customer failing does not stop the rest, and a message that never left is not counted against the month", async () => {
    const before = (await usageSummary(biz)).campaigns.used; failTo = { "+971501000002": "MARKETING_NOT_DELIVERED" }; calls = [];
    const r = await send(); failTo = {};
    expect(r).toMatchObject({ sent: 2, failed: 1, status: "DONE" }); expect((await db.campaignRecipient.findFirstOrThrow({ where: { campaignId: r.id, phone: "+971501000002" } }))).toMatchObject({ status: "FAILED", error: "MARKETING_NOT_DELIVERED" });
    expect((await usageSummary(biz)).campaigns.used).toBe(before + 2);
  });
  it("with the template not approved nothing is left behind, the allowance is returned and the owner is told why", async () => {
    const before = (await usageSummary(biz)).campaigns.used, campaigns = await db.campaign.count({ where: { businessId: biz } }); templateOff = true; const code = "NOP" + suffix.toUpperCase().slice(0, 6);
    await expect(send({ code: { code, percent: 20, days: 7 } })).rejects.toMatchObject({ code: "TEMPLATE_UNAVAILABLE", message: expect.stringContaining("isn’t approved yet") }); templateOff = false;
    expect(await db.campaign.count({ where: { businessId: biz } })).toBe(campaigns); expect((await usageSummary(biz)).campaigns.used).toBe(before);
    expect((await db.discountCode.findFirstOrThrow({ where: { businessId: biz, code } })).active).toBe(false); // the code is not live for an offer nobody received
  });
  it("delivery updates fill in Sent / Read, never go backwards, and failures after delivery are ignored", async () => {
    const r = await send(); const recs = await db.campaignRecipient.findMany({ where: { campaignId: r.id } }); const at = String(Math.floor(Date.now() / 1000));
    const [a, b, c] = recs;
    await recordStatuses({ statuses: [{ messageId: a!.messageId!, status: "read", timestamp: at }, { messageId: a!.messageId!, status: "delivered", timestamp: at }, { messageId: b!.messageId!, status: "delivered", timestamp: at }, { messageId: c!.messageId!, status: "failed", timestamp: at, errorCode: 131026 }, { messageId: b!.messageId!, status: "failed", timestamp: at }, { messageId: "wamid.not.a.campaign", status: "read", timestamp: at }] });
    expect(await db.campaign.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ sentCount: 2, deliveredCount: 2, readCount: 1, failedCount: 1 });
    expect((await db.campaignRecipient.findUniqueOrThrow({ where: { id: a!.id } })).status).toBe("READ");
    expect((await db.campaignRecipient.findUniqueOrThrow({ where: { id: c!.id } }))).toMatchObject({ status: "FAILED", error: "WhatsApp error 131026" });
  });
  it("stops at the plan's monthly message allowance", async () => {
    const { allowanceFor } = await import("../src/modules/billing/usage"); const { period } = await allowanceFor(biz);
    const w = { businessId: biz, periodStart: period.start, kind: "campaigns" }; const cur = await db.usageCounter.findFirstOrThrow({ where: w });
    await db.usageCounter.update({ where: { id: cur.id }, data: { used: LIMITS.plus.campaigns - 2 } });
    await expect(send()).rejects.toMatchObject({ code: "CAMPAIGN_LIMIT", message: expect.stringContaining("2 are left") });
    await db.usageCounter.update({ where: { id: cur.id }, data: { used: 0 } });
  });
  describe("customers who reply STOP", () => {
    const say = (text: string, from = "971501000001", type = "text") => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.${++n}`, senderId: from, timestamp: String(Math.floor(Date.now() / 1000)), senderName: "Sara", type, textBody: text } as any] });
    it("are left out from then on, get a confirmation (not the assistant), and can come back with START", async () => {
      await setAi(); calls = []; await say("STOP");
      expect((await db.customer.findFirstOrThrow({ where: { phone: "+971501000001", businessId: biz } })).marketingOptOut).toBe(true);
      expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false); expect(calls.find(c => c.path === "/internal/whatsapp/send")!.body.text).toContain("You won't receive offers"); expect(calls.find(c => c.path === "/internal/whatsapp/send")!.body.text).toContain("لن تصلك");
      calls = []; const r = await send(); expect(sent().map(c => c.body.to).sort()).toEqual(["+971501000002", "+971501000003"]); expect(r.recipients).toBe(2);
      calls = []; await say("Cancel"); expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(true); expect((await db.customer.findFirstOrThrow({ where: { phone: "+971501000001", businessId: biz } })).marketingOptOut).toBe(true); // "Cancel" is about an order, not offers
      calls = []; await say("start"); expect((await db.customer.findFirstOrThrow({ where: { phone: "+971501000001", businessId: biz } })).marketingOptOut).toBe(false); expect(calls.find(c => c.path === "/internal/whatsapp/send")!.body.text).toContain("receive our offers again");
      calls = []; await say("إيقاف", "971501000002"); expect((await db.customer.findFirstOrThrow({ where: { phone: "+971501000002", businessId: biz } })).marketingOptOut).toBe(true); // Arabic works too
    });
    async function setAi() { const { setAiSettings } = await import("../src/modules/messages/ai"); await setAiSettings(owner, biz, { enabled: true }, "t"); }
  });
});
