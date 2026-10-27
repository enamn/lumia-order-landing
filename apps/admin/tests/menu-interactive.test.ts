import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness } from "../src/modules/business/service";
import { recordInbound } from "../src/modules/messages/inbound";
import * as hours from "../src/modules/messages/hours";
import * as billing from "../src/modules/billing/service";
import type { MenuSession } from "../src/modules/messages/menu-presentation";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("conversational carousel through inbound text and voice", () => {
  const suffix = crypto.randomUUID().slice(0, 8), pn = `5566${Date.now().toString().slice(-9)}`;
  let biz: string, product: string, catalogId: string, category: string, sender: string, sequence = 0, sent = 0;
  let calls: { path: string; body: any }[] = [], failCarousel = false, voiceText = "شو عندك؟";
  const inbound = (text: string, interactiveId?: string, extra: object = {}) => recordInbound({ messages: [{ phoneNumberId: pn, messageId: `wamid.menu.${suffix}.${++sequence}`, senderId: sender, timestamp: String(Math.floor(Date.now()/1000)), type: "text", textBody: text, ...(interactiveId ? { interactiveId } : {}), ...extra }] });
  const conversation = () => db.conversation.findFirstOrThrow({ where: { businessId: biz, customer: { phone: `+${sender}` }, phoneNumberId: pn } });
  async function tap(kind: string, pick = 0) {
    const c = await conversation(), s = c.menuSession as MenuSession;
    const index = s.actions.flatMap((a, index) => a.kind === kind ? [index] : [])[pick];
    expect(index).toBeDefined(); return inbound("Selection", `lm:${s.nonce}:${index}`);
  }
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const owner = await db.user.create({ data: { name: "Menu owner", email: `menu-${suffix}@test.invalid`, phoneNumber: `+97150988${String(Date.now()).slice(-4)}`, phoneNumberVerified: true } });
    biz = (await createBusiness(owner.id, { name: "Menu Restaurant", locationName: "Main" }, "test")).id;
    await db.aiAgent.create({ data: { businessId: biz, status: "ACTIVE", configuration: { interactiveMenu: true } } });
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: pn, status: "CONNECTED", accessTokenEncrypted: encryptSecret("test-business-token"), connectedAt: new Date() } });
    catalogId = (await db.catalog.create({ data: { businessId: biz, name: "Menu", status: "ACTIVE" } })).id;
    category = (await db.catalogCategory.create({ data: { catalogId, name: "Grills", nameAr: "المشاوي" } })).id;
    product = (await db.catalogItem.create({ data: { catalogId, categoryId: category, name: "Kebab", nameAr: "كباب", basePriceMinor: 3500, sortOrder: 0 } })).id;
    await db.catalogItem.createMany({ data: Array.from({ length: 9 }, (_, n) => ({ catalogId, categoryId: category, name: `Dish ${n}`, nameAr: `صنف ${n}`, basePriceMinor: 2000 + n * 100, sortOrder: n + 1 })) });
  });
  beforeEach(() => {
    sender = `9715099${String(++sequence).padStart(5, "0")}`; calls = []; failCarousel = false; voiceText = "شو عندك؟";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname, body = JSON.parse(String(init.body)); calls.push({ path, body });
      if (path === "/internal/whatsapp/media") return Response.json({ mediaId: String(9000000 + ++sent) });
      if (path === "/internal/whatsapp/transcribe") return Response.json({ text: voiceText, language: "ar", usable: true });
      if (path === "/internal/ai/reply") {
        if (body.message === "can I see what is available today?") return Response.json({ intent: "menu_question", language: "en", reply: "Menu", needsHuman: false, order: body.draft });
        const kebab = body.menu.find((i: any) => i.name === "Kebab");
        if (body.menuAdvice && !/two kebabs/.test(body.message)) return Response.json({ intent: "other", language: "ar", reply: "INVENTED DIETARY CLAIM", needsHuman: false, recommendations: [kebab?.id, "forged"], order: { ...body.draft, confirmed: true } });
        let order = body.draft;
        if (/two kebabs/.test(body.message)) order = { items: [{ id: kebab.id, quantity: 2, notes: "" }], fulfillment: null, address: "", confirmed: false };
        if (body.message === "pickup") order = { ...order, fulfillment: "pickup", confirmed: false };
        return Response.json({ intent: "order_request", language: "en", reply: "Tell me any missing details.", needsHuman: false, order });
      }
      if (failCarousel && path === "/internal/whatsapp/send-carousel") return Response.json({ error: { code: "CAROUSEL_UNAVAILABLE" } }, { status: 409 });
      return Response.json({ messageId: `wamid.menu.out.${suffix}.${++sent}` });
    }));
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });
  it("answers the dialect question directly with eight cards, then the voice/advice hint", async () => {
    await inbound("شو عندك؟");
    const carousel = calls.find(c => c.path === "/internal/whatsapp/send-carousel")!.body;
    expect(carousel.cards).toHaveLength(8); expect(carousel.cards[0]).toMatchObject({ text: "كباب\n35 AED", buttonTitle: "التفاصيل" });
    expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false);
    expect(calls.at(-1)!.body.text).toContain("وإذا محتار، بتحب أساعدك تختار؟");
    const session = (await conversation()).menuSession as MenuSession;
    expect(session.advice).toBe("offered"); expect(session.actions.some(a => a.kind === "add")).toBe(false);
  });
  it("greets normally without any menu or welcome buttons", async () => {
    await inbound("مرحبا"); expect(calls).toHaveLength(1); expect(calls[0].body.kind).toBeUndefined(); expect(calls[0].body.text).toContain("Menu Restaurant");
  });
  it("sends a one-language conversational chat-open welcome without buttons", async () => {
    await inbound("", undefined, { type: "request_welcome", textBody: undefined });
    expect(calls).toHaveLength(1); expect(calls[0].body.kind).toBeUndefined(); expect(calls[0].body.text).toContain("Welcome"); expect(calls[0].body.text).not.toMatch(/[\u0600-\u06ff]/);
  });
  it("does not resend a carousel for a duplicate inbound webhook", async () => {
    const messageId = `wamid.duplicate.${suffix}`; await inbound("menu", undefined, { messageId }); const count = calls.length;
    const result = await inbound("menu", undefined, { messageId }); expect(result.duplicates).toBe(1); expect(calls).toHaveLength(count);
  });
  it("keeps details and navigation on the same session without adding to a cart", async () => {
    await inbound("منيو"); const old = (await conversation()).menuSession as MenuSession;
    await tap("product"); expect(calls.at(-1)!.body.text).toContain("كباب"); expect((await conversation()).draftOrder).toBeNull();
    expect(((await conversation()).menuSession as MenuSession).nonce).toBe(old.nonce);
    await tap("menu"); expect(calls.findLast(c => c.path === "/internal/whatsapp/send-carousel")!.body.cards).toHaveLength(2);
    await inbound("old", `lm:${old.nonce}:0`); expect(calls.at(-1)!.body.text).toContain("انتهت صلاحية");
  });
  it("asks one preference question after yes, and returns only grounded recommendation prices", async () => {
    await inbound("منيو"); await inbound("نعم");
    expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false);
    expect(((await conversation()).menuSession as MenuSession).advice).toBe("preference");
    await inbound("المشاوي");
    expect(calls.find(c => c.path === "/internal/ai/reply")!.body.menuAdvice).toBe(true);
    expect(calls.at(-1)!.body.text).toContain("كباب — 35 AED"); expect(calls.at(-1)!.body.text).not.toContain("INVENTED"); expect((await conversation()).draftOrder).toBeNull();
  });
  it("shows the carousel for an AI-recognized menu question without dropping an existing draft", async () => {
    await inbound("two kebabs"); const before = (await conversation()).draftOrder;
    await inbound("can I see what is available today?");
    expect(calls.some(c => c.path === "/internal/whatsapp/send-carousel")).toBe(true); expect((await conversation()).draftOrder).toEqual(before);
  });
  it("does not confirm or alter a pending order when yes answers the advice offer", async () => {
    await inbound("two kebabs"); await inbound("pickup"); const before = (await conversation()).draftOrder;
    await inbound("منيو"); await inbound("نعم"); await inbound("المشاوي");
    expect((await conversation()).draftOrder).toEqual(before);
    const orders = await db.order.findMany({ where: { conversationId: (await conversation()).id } });
    expect(orders).toHaveLength(1); expect(orders[0].status).toBe("AWAITING_CUSTOMER_CONFIRMATION");
  });
  it("never treats yes to an old advice offer as confirmation of a pending order", async () => {
    await inbound("two kebabs"); await inbound("pickup"); await inbound("منيو");
    const c = await conversation(), session = c.menuSession as MenuSession;
    await db.conversation.update({ where: { id: c.id }, data: { menuSession: { ...session, adviceOfferedAt: new Date(Date.now() - 3 * 3600000).toISOString() } as never } });
    await inbound("نعم"); expect(((await conversation()).menuSession as MenuSession).advice).toBe("preference");
    expect(await db.order.count({ where: { conversationId: c.id, status: "AWAITING_CUSTOMER_CONFIRMATION" } })).toBe(1);
  });
  it("declines advice without forcing a flow or resetting the cart", async () => {
    await inbound("two kebabs"); const before = (await conversation()).draftOrder;
    await inbound("منيو"); await inbound("لا شكرا"); expect((await conversation()).draftOrder).toEqual(before); expect(((await conversation()).menuSession as MenuSession).advice).toBeNull();
  });
  it("accepts direct text ordering while advice is offered, then uses the existing COD service once", async () => {
    await inbound("منيو"); await inbound("two kebabs"); await inbound("pickup");
    const c = await conversation(); expect((c.draftOrder as any).items).toEqual([{ itemId: product, quantity: 2, notes: "" }]);
    const messageId = `wamid.confirm.${suffix}`; await inbound("Confirm order", undefined, { messageId }); await inbound("Confirm order", undefined, { messageId });
    const orders = await db.order.findMany({ where: { conversationId: c.id } }); expect(orders).toHaveLength(1); expect(orders[0]).toMatchObject({ channel: "WHATSAPP", fulfillmentType: "PICKUP", totalMinor: 7000 }); expect(orders[0].status).not.toBe("AWAITING_CUSTOMER_CONFIRMATION");
  });
  it("transcribes voice menu requests, advice replies and selections into the same flow", async () => {
    await inbound("", undefined, { type: "audio", textBody: undefined, mediaId: "12345678" });
    expect(calls.some(c => c.path === "/internal/whatsapp/send-carousel")).toBe(true);
    voiceText = "نعم"; await inbound("", undefined, { type: "audio", textBody: undefined, mediaId: "12345679" });
    expect(((await conversation()).menuSession as MenuSession).advice).toBe("preference");
    voiceText = "two kebabs"; await inbound("", undefined, { type: "audio", textBody: undefined, mediaId: "12345670" });
    const ask = calls.findLast(c => c.path === "/internal/ai/reply")!.body; expect(ask.voice).toBe(true); expect((await conversation()).draftOrder).toMatchObject({ items: [{ itemId: product, quantity: 2 }] });
  });
  it("reuses media uploads but regenerates an item when its price changes", async () => {
    await inbound("menu"); const uploads = calls.filter(c => c.path === "/internal/whatsapp/media").length;
    await inbound("menu"); expect(calls.filter(c => c.path === "/internal/whatsapp/media")).toHaveLength(uploads);
    await db.catalogItem.update({ where: { id: product }, data: { basePriceMinor: 4000 } });
    try { await inbound("menu"); expect(calls.filter(c => c.path === "/internal/whatsapp/media")).toHaveLength(uploads + 1); expect(calls.findLast(c => c.path === "/internal/whatsapp/send-carousel")!.body.cards[0].text).toContain("40 AED"); }
    finally { await db.catalogItem.update({ where: { id: product }, data: { basePriceMinor: 3500 } }); }
  });
  it("does not substitute lists or send a false advice offer after carousel rejection", async () => {
    failCarousel = true; await inbound("menu"); expect(calls.some(c => c.path === "/internal/whatsapp/send")).toBe(false); expect((await conversation()).menuSession).toBeNull();
  });
  it("rechecks stock on a Details tap", async () => {
    await inbound("menu"); await db.catalogItem.update({ where: { id: product }, data: { isAvailable: false } });
    try { await tap("product"); expect(calls.at(-1)!.body.text).toContain("unavailable"); expect((await conversation()).draftOrder).toBeNull(); }
    finally { await db.catalogItem.update({ where: { id: product }, data: { isAvailable: true } }); }
  });
  it("loads only the selected branch before rendering its carousel", async () => {
    const entitlements = await billing.entitlementsFor(biz), spy = vi.spyOn(billing, "entitlementsFor").mockResolvedValue({ ...entitlements, menuPerBranch: true });
    const branch = await db.location.create({ data: { businessId: biz, name: "Other branch", code: `branch-${suffix}` } });
    const catalog = await db.catalog.create({ data: { businessId: biz, locationId: branch.id, name: "Other branch", status: "ACTIVE" } });
    const branchItem = await db.catalogItem.create({ data: { catalogId: catalog.id, name: "Branch special", basePriceMinor: 6500 } });
    try {
      await inbound("menu"); expect(calls.at(-1)!.body.kind).toBe("list"); expect(calls.some(c => c.path === "/internal/whatsapp/send-carousel")).toBe(false);
      const s = (await conversation()).menuSession as MenuSession, index = s.actions.findIndex(a => a.kind === "branch" && a.branchId === branch.id);
      await inbound("Other branch", `lm:${s.nonce}:${index}`);
      const cards = calls.findLast(c => c.path === "/internal/whatsapp/send-carousel")!.body.cards;
      expect(cards).toHaveLength(1); expect(cards[0].text).toContain("Branch special"); expect((await conversation()).branchId).toBe(branch.id);
    } finally { spy.mockRestore(); await db.catalogItem.delete({ where: { id: branchItem.id } }); await db.catalog.delete({ where: { id: catalog.id } }); await db.location.delete({ where: { id: branch.id } }); }
  });
  it("allows browsing when closed but still blocks creating an order", async () => {
    const spy = vi.spyOn(hours, "openStatus").mockReturnValue({ open: false, why: "off", week: Array.from({ length: 7 }, (_, i) => ({ day: String(i), open: false, from: "09:00", to: "21:00", last: "20:30", brk: false, bFrom: "", bTo: "" })), next: null });
    try {
      await inbound("menu"); expect(calls.some(c => c.path === "/internal/whatsapp/send-carousel")).toBe(true); expect(calls.at(-1)!.body.text).toContain("closed");
      await inbound("two kebabs"); expect((await conversation()).draftOrder).toBeNull(); expect(await db.order.count({ where: { conversationId: (await conversation()).id } })).toBe(0);
    } finally { spy.mockRestore(); }
  });
  it("separates receiving numbers and ignores delayed messages outside the service window", async () => {
    const other = pn.slice(0, -1) + (pn.endsWith("9") ? "8" : "9");
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: other, status: "CONNECTED", accessTokenEncrypted: encryptSecret("other-token") } });
    await inbound("menu"); const first = await conversation(); await inbound("menu", undefined, { phoneNumberId: other });
    expect(await db.conversation.count({ where: { businessId: biz, customer: { phone: `+${sender}` } } })).toBe(2);
    expect((await db.conversation.findUniqueOrThrow({ where: { id: first.id } })).phoneNumberId).toBe(pn);
    sender = `9715099${String(++sequence).padStart(5, "0")}`; calls = []; await inbound("menu", undefined, { timestamp: String(Math.floor(Date.now()/1000) - 90000) }); expect(calls).toHaveLength(0);
  });
});
