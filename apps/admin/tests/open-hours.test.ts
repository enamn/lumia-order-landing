import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness, setMember } from "../src/modules/business/service";
import { recordInbound } from "../src/modules/messages/inbound";
import { setAiSettings } from "../src/modules/messages/ai";
const enabled = process.env.RUN_DB_TESTS === "true";
const DUBAI = (iso: string) => new Date(`${iso}+04:00`); // 2026-10-19 is a Monday; new businesses are open 09:00 to 22:00 every day

describe.skipIf(!enabled)("working hours: a closed restaurant does not take orders", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5590${Date.now().toString().slice(-9)}`;
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
      if (path === "/internal/whatsapp/order-review") return Response.json({ error: { code: "WHATSAPP_SEND_FAILED" } }, { status: 502 }); // template not available here: the plain message goes out
      return Response.json({ messageId: `wamid.out.${suffix}.${++out}` });
    }));
    const mk = (nm: string, i: number) => db.user.create({ data: { name: nm, email: `${nm}-${suffix}@test.invalid`, phoneNumber: `+97150667${String(1000 + i)}`, phoneNumberVerified: true } });
    [owner, viewer] = (await Promise.all([mk("own", 1), mk("vie", 2)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "Hours Test Burgers", locationName: "Main" }, "t")).id;
    await setMember(owner, biz, { phoneNumber: "+971506671002", role: "VIEWER" }, "t");
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990013", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    const cat = await db.catalog.create({ data: { businessId: biz, name: "Main", status: "ACTIVE" } });
    const c = await db.catalogCategory.create({ data: { catalogId: cat.id, name: "Food" } });
    for (const [name, nameAr, price, ok] of [["Classic", "كلاسيك", 2800, true], ["Fries", "", 1200, true], ["Spicy", "", 3200, false]] as const) await db.catalogItem.create({ data: { catalogId: cat.id, categoryId: c.id, name, nameAr, basePriceMinor: price, isAvailable: ok } });
    await setAiSettings(owner, biz, { enabled: true }, "t");
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });
  const draft = (id: (n: string) => string, items: [string, number][], fulfillment: any = null, address = "", confirmed = false) => ({ items: items.map(([nm, q]) => ({ id: id(nm), quantity: q, notes: "" })), fulfillment, address, addressLabel: "", emirate: null, area: "", customerName: "", discountCode: "", confirmed });
  const order = (language: "en" | "ar" = "en") => (id: (n: string) => string) => ({ intent: "order_request", language, reply: "Sure! Pickup or delivery?", needsHuman: false, order: draft(id, [["Classic", 2]]) });
  const question = (id: (n: string) => string) => ({ intent: "price_question", language: "en", reply: "A Classic is 28 AED.", needsHuman: false, order: null });

  it("tells a customer who orders while the restaurant is closed, with the working hours, and takes no order", async () => {
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-19T23:00:00"); // after 22:00
    const r = await turn("2 classic please", order());
    expect(r).toContain("Hours Test Burgers is closed right now"); expect(r).toContain("Working hours"); expect(r).toContain("Mon–Sun: 9:00 AM – 10:00 PM"); expect(r).toContain("We open tomorrow at 9:00 AM");
    expect(r).not.toContain("Pickup or delivery"); expect(await db.order.count({ where: { businessId: biz } })).toBe(0);
    expect((await db.conversation.findFirstOrThrow({ where: { businessId: biz } })).draftOrder).toBeNull();
  });
  it("answers in Arabic when the customer writes Arabic", async () => {
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-20T03:00:00"); // before 09:00
    const r = await turn("ابغى 2 كلاسيك", order("ar"), "971500000555");
    expect(r).toContain("مغلق الآن"); expect(r).toContain("ساعات العمل"); expect(r).toContain("نفتح اليوم الساعة 9:00 ص");
    expect(await db.order.count({ where: { businessId: biz } })).toBe(0);
  });
  it("still answers questions while closed", async () => {
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-19T23:00:00");
    expect(await turn("how much is a classic?", question, "971500000666")).toContain("A Classic is 28 AED.");
  });
  it("answers a greeting while closed with the hours, not an invitation to order", async () => {
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-19T23:00:00");
    const r = await turn("hi", question, "971500000611");
    expect(r).toContain("is closed right now"); expect(r).toContain("We open tomorrow at 9:00 AM"); expect(r).not.toContain("What would you like to order");
    expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false);
  });
  it("tells the assistant the hours and whether the restaurant is open", async () => {
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-19T23:00:00");
    await turn("when do you open?", question, "971500000622");
    const closedAsk = calls.find(c => c.path === "/internal/ai/reply")!.body.instructions as string;
    expect(closedAsk).toContain("CLOSED right now"); expect(closedAsk).toContain("opens tomorrow at 9:00 AM"); expect(closedAsk).toContain("Mon–Sun: 9:00 AM – 10:00 PM");
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-20T13:00:00");
    await turn("when do you close?", question, "971500000622");
    const openAsk = calls.find(c => c.path === "/internal/ai/reply")!.body.instructions as string;
    expect(openAsk).toContain("open now"); expect(openAsk).not.toContain("CLOSED");
  });
  it("greets a new chat with the closed notice while closed", async () => {
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-19T23:00:00");
    calls = [];
    await recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.w${++n}`, senderId: "971500000633", timestamp: String(Math.floor(Date.now() / 1000)), type: "request_welcome", senderName: "Sara" } as never] });
    const r = sent().at(-1) ?? "";
    expect(r).toContain("is closed right now"); expect(r).toContain("Working hours");
  });
  it("takes the order again once the restaurant is open", async () => {
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-20T13:00:00");
    const r = await turn("2 classic please", order(), "971500000777");
    expect(r).toContain("Pickup or delivery"); expect(r).not.toContain("closed right now");
  });
  it("follows the hours the owner saved, such as a day off", async () => {
    const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, i) => ({ day, open: i !== 1, from: "09:00", to: "22:00", last: "22:00", brk: false, bFrom: "16:00", bTo: "17:00" }));
    const b = await db.business.findUniqueOrThrow({ where: { id: biz }, select: { settings: true } });
    await db.business.update({ where: { id: biz }, data: { settings: { ...((b.settings as object) ?? {}), hours: { mode: "custom", scope: "same", sel: "", every: { ...week[0], day: "Every day" }, closedUntil: "", same: week, per: {} } } as never } });
    (globalThis as any).__TEST_NOW = DUBAI("2026-10-20T13:00:00"); // Tuesday: day off
    const r = await turn("2 classic please", order(), "971500000888");
    expect(r).toContain("is closed right now"); expect(r).toContain("Tue: closed"); expect(r).toContain("We open tomorrow at 9:00 AM");
  });
});
