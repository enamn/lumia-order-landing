import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness, setMember } from "../src/modules/business/service";
import { recordInbound, getMessageStats, getOverview } from "../src/modules/messages/inbound";
import { setAiSettings } from "../src/modules/messages/ai";
import { listOrders, setOrderStatus } from "../src/modules/orders/service";
import { draftKey, resolveDraft, summaryText, type MenuEntry } from "../src/modules/orders/draft";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("order draft rules", () => {
  const menu: MenuEntry[] = [{ index: "1", itemId: "a", name: "Classic", nameAr: "كلاسيك", priceMinor: 2800, available: true }, { index: "2", itemId: "b", name: "Spicy", nameAr: "", priceMinor: 3200, available: false }];
  const opts = { delivery: true, pickup: false, minimumMinor: 0 };
  it("prices from the menu, merges duplicate lines, drops unknown or unavailable items and disallowed types", () => {
    const r = resolveDraft(menu, { items: [{ id: "1", quantity: 1, notes: "" }, { id: "1", quantity: 2, notes: "" }, { id: "2", quantity: 1, notes: "" }, { id: "99", quantity: 5, notes: "" }], fulfillment: "pickup", address: "x" }, opts);
    expect(r).toMatchObject({ subtotalMinor: 8400, removed: ["Spicy"], fulfillment: null, address: "" }); expect(r.lines).toHaveLength(1); expect(r.lines[0]).toMatchObject({ quantity: 3, unitMinor: 2800, totalMinor: 8400 });
  });
  it("keys change when anything the customer would see changes", () => {
    const a = resolveDraft(menu, { items: [{ id: "1", quantity: 1, notes: "" }], fulfillment: "delivery", address: "Al Majaz" }, opts);
    const b = resolveDraft(menu, { items: [{ id: "1", quantity: 1, notes: "" }], fulfillment: "delivery", address: "Al Khan" }, opts);
    expect(draftKey(a)).not.toBe(draftKey(b)); expect(draftKey(a)).toBe(draftKey(resolveDraft(menu, { items: [{ id: "1", quantity: 1, notes: "" }], fulfillment: "delivery", address: "Al Majaz" }, opts)));
    expect(summaryText(a, "ar", opts)).toContain("المجموع: 28 درهم".replace("درهم", "AED")); expect(summaryText(a, "ar", opts)).toContain("نعم");
  });
});

describe.skipIf(!enabled)("taking orders over WhatsApp", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5580${Date.now().toString().slice(-9)}`;
  let owner: string, viewer: string, biz: string; let calls: { path: string; body: any }[]; let ai: any; let n = 0; let out = 0;
  const say = (text: string, from = "971504074115") => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.${++n}`, senderId: from, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", textBody: text, senderName: "Ahmad" }] });
  const sent = () => calls.filter(c => c.path === "/internal/whatsapp/send").map(c => c.body.text as string);
  const idOf = (name: string) => calls.filter(c => c.path === "/internal/ai/reply").at(-1)!.body.menu.find((m: any) => m.name === name).id as string;
  const turn = async (text: string, make: (id: (n: string) => string) => any, from?: string) => { calls = []; ai = { __make: make }; await say(text, from); return sent().at(-1) ?? ""; };
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname; const body = JSON.parse(String(init.body)); calls.push({ path, body });
      if (path === "/internal/ai/reply") { const ids = (nm: string) => body.menu.find((m: any) => m.name === nm)?.id; return Response.json(ai.__make(ids)); }
      return Response.json({ messageId: `wamid.out.${suffix}.${++out}` });
    }));
    const mk = (nm: string, i: number) => db.user.create({ data: { name: nm, email: `${nm}-${suffix}@test.invalid`, phoneNumber: `+97150666${String(1000 + i)}`, phoneNumberVerified: true } });
    [owner, viewer] = (await Promise.all([mk("own", 1), mk("vie", 2)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "Order Test Burgers", locationName: "Main" }, "t")).id;
    await setMember(owner, biz, { phoneNumber: "+971506661002", role: "VIEWER" }, "t");
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990003", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    const cat = await db.catalog.create({ data: { businessId: biz, name: "Main", status: "ACTIVE" } });
    const c = await db.catalogCategory.create({ data: { catalogId: cat.id, name: "Food" } });
    for (const [name, nameAr, price, ok] of [["Classic", "كلاسيك", 2800, true], ["Fries", "", 1200, true], ["Spicy", "", 3200, false]] as const) await db.catalogItem.create({ data: { catalogId: cat.id, categoryId: c.id, name, nameAr, basePriceMinor: price, isAvailable: ok } });
    await setAiSettings(owner, biz, { enabled: true }, "t");
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });
  const draft = (id: (n: string) => string, items: [string, number][], fulfillment: any = null, address = "", confirmed = false) => ({ items: items.map(([nm, q]) => ({ id: id(nm), quantity: q, notes: "" })), fulfillment, address, confirmed });
  const reply = (order: any, text = "Sure!") => ({ intent: "order_request", language: "en", reply: text, needsHuman: false, order });

  it("builds the draft with server prices, then places the order only after the customer confirms the shown summary", async () => {
    let r = await turn("2 classic and fries please", id => reply(draft(id, [["Classic", 2], ["Fries", 1]]), "Got it. Pickup or delivery?"));
    expect(r).toContain("Got it. Pickup or delivery?"); expect(r).toContain("2 × Classic — 56 AED"); expect(r).toContain("1 × Fries — 12 AED"); expect(r).toContain("Total: 68 AED"); expect(r).not.toContain("Reply YES");
    expect(await db.order.count({ where: { businessId: biz } })).toBe(0);
    r = await turn("pickup", id => reply(draft(id, [["Classic", 2], ["Fries", 1]], "pickup"), "Great, pickup it is."));
    expect(r).toContain("Pickup from the restaurant"); expect(r).toContain("Reply YES to confirm");
    expect(calls.find(c => c.path === "/internal/ai/reply")!.body.draft).toMatchObject({ items: [{ quantity: 2 }, { quantity: 1 }], fulfillment: null }); // the saved draft is sent back to the model
    r = await turn("yes", id => reply(draft(id, [["Classic", 2], ["Fries", 1]], "pickup", "", true), "Thanks!"));
    expect(r).toBe("✅ Order #1001 received. Total 68 AED, pickup. We'll message you as soon as the restaurant confirms it.");
    const o = await db.order.findFirstOrThrow({ where: { businessId: biz }, include: { items: true, history: true } });
    expect(o).toMatchObject({ orderNumber: "1001", status: "AWAITING_BUSINESS_CONFIRMATION", fulfillmentType: "PICKUP", subtotalMinor: 6800, totalMinor: 6800, paymentStatus: "PENDING", channel: "WHATSAPP" });
    expect(o.items.map(i => [i.itemNameSnapshot, i.quantity, i.unitPriceMinor, i.totalMinor]).sort()).toEqual([["Classic", 2, 2800, 5600], ["Fries", 1, 1200, 1200]]); expect(o.history[0]).toMatchObject({ newStatus: "AWAITING_BUSINESS_CONFIRMATION", changedByType: "AI" });
    expect((await db.conversation.findFirstOrThrow({ where: { businessId: biz } })).draftOrder).toBeNull();
    expect((await getMessageStats(owner, biz)).ordersCreated).toBe(1);
  });
  it("ignores a premature or repeated confirmation, unavailable and made-up items", async () => {
    const other = "971500000333";
    let r = await turn("one classic, pickup, confirmed!", id => reply(draft(id, [["Classic", 1]], "pickup", "", true), "Done!"), other);
    expect(r).toContain("Reply YES"); expect(await db.order.count({ where: { businessId: biz } })).toBe(1); // the model said confirmed, but the customer never saw the summary
    r = await turn("add the spicy one and a ghost item", id => reply({ items: [...draft(id, [["Classic", 1]]).items, { id: id("Spicy"), quantity: 1, notes: "" }, { id: "999", quantity: 4, notes: "" }], fulfillment: "pickup", address: "", confirmed: false }), other);
    expect(r).toContain("Sorry, Spicy is not available right now"); expect(r).toContain("Total: 28 AED"); expect(r).not.toContain("999");
    expect(await db.order.count({ where: { businessId: biz } })).toBe(1);
    r = await turn("yes", id => reply(draft(id, [["Classic", 1]], "pickup", "", true)), other); expect(r).toContain("Order #1002"); // the customer saw this exact summary
    expect(await db.order.count({ where: { businessId: biz } })).toBe(2);
    await turn("yes again", id => reply(draft(id, [["Classic", 1]], "pickup", "", true)), other); expect(await db.order.count({ where: { businessId: biz } })).toBe(2); // no duplicate order
  });
  it("needs an address for delivery, honours the minimum order and the allowed order types, and speaks Arabic", async () => {
    const c3 = "971500000444";
    let r = await turn("deliver 1 classic", id => reply(draft(id, [["Classic", 1]], "delivery"), "What's your address?"), c3); expect(r).not.toContain("Reply YES");
    r = await turn("yes", id => reply(draft(id, [["Classic", 1]], "delivery", "", true)), c3); expect(await db.order.count({ where: { businessId: biz } })).toBe(2);
    r = await turn("Al Majaz, building 4", id => reply(draft(id, [["Classic", 1]], "delivery", "Al Majaz, building 4")), c3); expect(r).toContain("Delivery to: Al Majaz, building 4"); expect(r).toContain("Reply YES");
    await db.orderSettings.create({ data: { businessId: biz, minimumOrderAmountMinor: 5000, supportsPickup: false } });
    r = await turn("add fries", id => reply(draft(id, [["Classic", 1], ["Fries", 1]], "delivery", "Al Majaz, building 4")), c3); expect(r).toContain("The minimum order is 50 AED."); expect(r).not.toContain("Reply YES");
    expect(calls.find(c => c.path === "/internal/ai/reply")!.body.options).toEqual({ delivery: true, pickup: false, minimumOrder: 50 });
    await turn("yes", id => reply(draft(id, [["Classic", 1], ["Fries", 1]], "delivery", "Al Majaz, building 4", true)), c3); expect(await db.order.count({ where: { businessId: biz } })).toBe(2); // below the minimum
    await db.orderSettings.update({ where: { businessId: biz }, data: { minimumOrderAmountMinor: 0 } });
    r = await turn("نعم أضف 3 كلاسيك", id => ({ ...reply(draft(id, [["Classic", 4], ["Fries", 1]], "delivery", "Al Majaz, building 4"), "تمام!"), language: "ar" }), c3);
    expect(r).toContain("تمام!"); expect(r).toContain("المجموع: 124 AED"); expect(r).toContain("التوصيل إلى"); expect(r).toContain("نعم");
    r = await turn("نعم", id => ({ ...reply(draft(id, [["Classic", 4], ["Fries", 1]], "delivery", "Al Majaz, building 4", true)), language: "ar" }), c3);
    expect(r).toBe("✅ تم استلام طلبك رقم 1003. المجموع 124 درهم، توصيل. سنراسلك فور تأكيد المطعم.");
    const o = await db.order.findFirstOrThrow({ where: { orderNumber: "1003", businessId: biz }, include: { deliveryDetails: true } }); expect(o.deliveryDetails).toMatchObject({ addressText: "Al Majaz, building 4", recipientPhone: "+971500000444" });
  });
  it("lets staff move orders along, tells the customer, and blocks invalid steps and viewers", async () => {
    const [first] = (await listOrders(owner, biz)).filter(o => o.number === "1001");
    expect(first).toMatchObject({ status: "AWAITING_BUSINESS_CONFIRMATION", total: 68, customer: { phone: "+971504074115" } }); expect(first!.items).toHaveLength(2);
    calls = []; await setOrderStatus(owner, biz, first!.id, { status: "ACCEPTED" }, "t");
    expect(sent().at(-1)).toBe("✅ Your order #1001 was accepted. We're getting it ready."); expect(await db.message.findFirst({ where: { senderType: "SYSTEM", textContent: { contains: "#1001" } } })).toBeTruthy();
    const withHistory = (await listOrders(owner, biz)).find(o => o.number === "1001")!;
    expect(withHistory.history.map(h => h.status)).toEqual(["AWAITING_BUSINESS_CONFIRMATION", "ACCEPTED"]); expect(withHistory).toMatchObject({ subtotal: 68, deliveryFee: 0, note: "" });
    await expect(setOrderStatus(owner, biz, first!.id, { status: "COMPLETED" }, "t")).rejects.toMatchObject({ status: 409 });
    await expect(setOrderStatus(viewer, biz, first!.id, { status: "PREPARING" }, "t")).rejects.toMatchObject({ status: 403 });
    await expect(setOrderStatus(owner, biz, first!.id, { status: "PREPARING", extra: 1 }, "t")).rejects.toBeDefined();
    await setOrderStatus(owner, biz, first!.id, { status: "PREPARING" }, "t"); await setOrderStatus(owner, biz, first!.id, { status: "READY" }, "t");
    expect(sent().at(-1)).toBe("🛍️ Your order #1001 is ready for pickup."); // pickup order
    await expect(setOrderStatus(owner, biz, first!.id, { status: "OUT_FOR_DELIVERY" }, "t")).rejects.toMatchObject({ status: 409 });
    await setOrderStatus(owner, biz, first!.id, { status: "COMPLETED" }, "t");
    expect((await db.order.findFirstOrThrow({ where: { id: first!.id }, include: { history: true } })).history.map(h => h.newStatus)).toEqual(["AWAITING_BUSINESS_CONFIRMATION", "ACCEPTED", "PREPARING", "READY", "COMPLETED"]);
    const delivery = (await listOrders(owner, biz)).find(o => o.number === "1003")!; calls = [];
    await setOrderStatus(owner, biz, delivery.id, { status: "REJECTED" }, "t"); expect(sent().at(-1)).toContain("نعم".length ? "طلبك رقم 1003" : ""); // Arabic customer gets an Arabic notice
    await expect(setOrderStatus(owner, "other-business", delivery.id, { status: "ACCEPTED" }, "t")).rejects.toMatchObject({ status: 404 });
  });
  it("still changes the status when the customer can no longer be messaged", async () => {
    const o = (await listOrders(owner, biz)).find(x => x.number === "1002")!;
    await db.message.updateMany({ where: { direction: "INBOUND", conversation: { orders: { some: { id: o.id } } } }, data: { createdAt: new Date(Date.now() - 30 * 3600 * 1000) } }); calls = [];
    await setOrderStatus(owner, biz, o.id, { status: "ACCEPTED" }, "t"); expect(sent()).toEqual([]);
    expect((await db.order.findFirstOrThrow({ where: { id: o.id } })).status).toBe("ACCEPTED");
  });
  it("summarises orders, revenue, chats and top items for the Overview page, only for members", async () => {
    const week = await getOverview(owner, biz, "week", 0);
    const total = await db.order.aggregate({ where: { businessId: biz, status: { in: ["AWAITING_BUSINESS_CONFIRMATION", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED"] } }, _sum: { totalMinor: true }, _count: true });
    expect(week.setup).toEqual({ delivery: false, tested: true }); // an order exists, delivery rules were never saved
    expect(week.current.orders).toBe(total._count); expect(week.current.revenueMinor).toBe(total._sum.totalMinor ?? 0);
    expect(week.current.avgMinor).toBe(Math.round((total._sum.totalMinor ?? 0) / Math.max(1, total._count))); expect(week.current.chats).toBeGreaterThan(0);
    expect(week.buckets).toHaveLength(7); expect(week.buckets.reduce((t, b) => t + b.orders, 0)).toBe(week.current.orders); expect(week.top[0]).toMatchObject({ name: "Classic" });
    expect((await getOverview(owner, biz, "bogus", 0)).period).toBe("week"); expect((await getOverview(owner, biz, "today", 0)).buckets).toHaveLength(6);
    await expect(getOverview(crypto.randomUUID(), biz, "week", 0)).rejects.toBeTruthy();
  });
  it("tells the customer how long the order will take when staff pick a preparation time", async () => {
    const o = await db.order.findFirstOrThrow({ where: { businessId: biz, orderNumber: "1001" } });
    await db.order.update({ where: { id: o.id }, data: { status: "AWAITING_BUSINESS_CONFIRMATION" } }); // back to new
    calls = []; await setOrderStatus(owner, biz, o.id, { status: "ACCEPTED", prepMinutes: 25 }, "t");
    expect(sent().at(-1)).toContain("ready in about 25 minutes");
    await expect(setOrderStatus(owner, biz, o.id, { status: "PREPARING", prepMinutes: 2 }, "t")).rejects.toBeDefined();
  });
});
