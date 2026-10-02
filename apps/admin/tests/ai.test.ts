import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness, setMember } from "../src/modules/business/service";
import { recordInbound, getMessageStats, listConversations } from "../src/modules/messages/inbound";
import { getAiSettings, setAiSettings } from "../src/modules/messages/ai";
import { sendReply, getConversation as getConversationFor } from "../src/modules/messages/reply";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("AI replies", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5570${Date.now().toString().slice(-9)}`;
  let owner: string, viewer: string, biz: string; let calls: { path: string; body: any }[]; let ai: { intent: string; language: string; reply: string; needsHuman: boolean } | Response;
  let n = 0; let out = 0;
  const inbound = (text: string, extra: object = {}) => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.${++n}`, senderId: "971504074115", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", textBody: text, senderName: "Ahmad", ...extra }] });
  const setup = () => vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname; const body = JSON.parse(String(init.body)); calls.push({ path, body });
    if (path === "/internal/ai/reply") return ai instanceof Response ? ai.clone() : Response.json(ai);
    return Response.json({ messageId: `wamid.out.${suffix}.${++out}` });
  }));
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const mk = (nm: string, i: number) => db.user.create({ data: { name: nm, email: `${nm}-${suffix}@test.invalid`, phoneNumber: `+97150999${String(1000 + i)}`, phoneNumberVerified: true } });
    [owner, viewer] = (await Promise.all([mk("own", 1), mk("vie", 2)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "AI Test Burgers", locationName: "Main" }, "t")).id;
    await setMember(owner, biz, { phoneNumber: "+971509991002", role: "VIEWER" }, "t");
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990002", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    const cat = await db.catalog.create({ data: { businessId: biz, name: "Main", status: "ACTIVE" } });
    const burgers = await db.catalogCategory.create({ data: { catalogId: cat.id, name: "Burgers", nameAr: "برجر" } });
    await db.catalogItem.create({ data: { catalogId: cat.id, categoryId: burgers.id, name: "Classic", nameAr: "كلاسيك", basePriceMinor: 2800, isAvailable: true } });
    await db.catalogItem.create({ data: { catalogId: cat.id, categoryId: burgers.id, name: "Spicy", basePriceMinor: 3200, isAvailable: false } });
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("is always on without any setup, and only owners/admins can change the notes", async () => {
    expect(await getAiSettings(owner, biz)).toEqual({ enabled: true, welcome: "", instructions: "", tone: "Friendly" });
    await expect(setAiSettings(viewer, biz, { instructions: "x" }, "t")).rejects.toMatchObject({ status: 403 });
    await expect(setAiSettings(owner, biz, { instructions: "x", extra: 1 }, "t")).rejects.toBeDefined();
    expect(await setAiSettings(owner, biz, { instructions: "Open until midnight." }, "t")).toEqual({ enabled: true, welcome: "", instructions: "Open until midnight.", tone: "Friendly" });
    const audit = await db.auditLog.findFirstOrThrow({ where: { businessId: biz, action: "ai.settings.updated" } }); expect(JSON.stringify(audit)).not.toContain("midnight");
  });
  it("answers from the menu and stores the reply as AI", async () => {
    calls = []; ai = { intent: "price_question", language: "en", reply: "The Classic is 28 AED.", needsHuman: false }; setup();
    await inbound("How much is the classic?");
    const ask = calls.find(c => c.path === "/internal/ai/reply")!.body;
    expect(ask).toMatchObject({ businessName: "AI Test Burgers", instructions: "Open until midnight.", message: "How much is the classic?" });
    expect(ask.menu.map(({ id, ...m }: any) => ({ ...m, hasId: Boolean(id) }))).toEqual([{ category: "Burgers", name: "Classic", nameAr: "كلاسيك", price: 28, available: true, hasId: true }, { category: "Burgers", name: "Spicy", nameAr: "", price: 32, available: false, hasId: true }]);
    const send = calls.find(c => c.path === "/internal/whatsapp/send")!.body;
    expect(send).toMatchObject({ accessToken: "biz-token", phoneNumberId: PNID, to: "+971504074115" });
    expect(send.text).toMatch(/^Welcome to AI Test Burgers! 👋[\s\S]*أهلاً بك[\s\S]*\n\nThe Classic is 28 AED\.$/); // first contact: greeting, then the answer
    expect(await db.message.findFirstOrThrow({ where: { senderType: "AI", conversation: { businessId: biz } } })).toMatchObject({ direction: "OUTBOUND", textContent: expect.stringMatching(/The Classic is 28 AED\.$/), status: "SENT" });
    expect((await getMessageStats(owner, biz)).aiReplies).toBe(1);
  });
  it("greets only in the first reply of a conversation, never twice", async () => {
    calls = []; ai = { intent: "greeting", language: "en", reply: "Yes, we are open.", needsHuman: false }; setup();
    await inbound("are you open?");
    expect(calls.find(c => c.path === "/internal/whatsapp/send")!.body.text).toBe("Yes, we are open."); // this conversation already has replies
    calls = []; await inbound("from a brand new number", { senderId: "971500005555" });
    expect(calls.find(c => c.path === "/internal/whatsapp/send")!.body.text).toBe(`${(await getAiSettings(owner, biz)).welcome || `Welcome to AI Test Burgers! 👋\nI'm the restaurant's assistant. Ask me about the menu, or tell me what you'd like to order and I'll take care of it.\n\nأهلاً بك في AI Test Burgers! 👋\nأنا مساعد المطعم. اسألني عن القائمة أو أخبرني بما تريد طلبه وسأساعدك.`}\n\nYes, we are open.`);
    calls = []; await inbound("and delivery?", { senderId: "971500005555" });
    expect(calls.find(c => c.path === "/internal/whatsapp/send")!.body.text).toBe("Yes, we are open."); // greeted once
  });
  it("does not answer redeliveries or non-text messages", async () => {
    calls = []; setup();
    const id = `wamid.${suffix}.dup`; await inbound("again", { messageId: id }); const first = calls.length; await inbound("again", { messageId: id });
    expect(calls.length).toBe(first);
    calls = []; await inbound("", { type: "image", textBody: undefined });
    expect(calls.map(c => c.path)).toEqual(["/internal/whatsapp/send"]); // no text to read: only the "please type" notice, never the AI
  });
  it("sends the holding reply for orders, flags the conversation, then stays quiet until staff handle it", async () => {
    calls = []; ai = { intent: "order_request", language: "en", reply: "One Classic, 28 AED. The team will confirm shortly.", needsHuman: true }; setup();
    await inbound("I want one classic burger");
    expect(calls.some(c => c.path === "/internal/whatsapp/send")).toBe(true);
    expect((await listConversations(owner, biz))[0]).toMatchObject({ needsHuman: true });
    calls = []; await inbound("also fries");
    expect(calls).toEqual([]); // flagged: a person must answer
    await sendReply(owner, biz, (await db.conversation.findFirstOrThrow({ where: { businessId: biz } })).id, { text: "Confirmed!" }, "t");
    expect((await listConversations(owner, biz))[0]).toMatchObject({ needsHuman: false });
    calls = []; await inbound("thanks"); expect(calls).toEqual([]); // staff replied minutes ago: AI stays out
  });
  it("never loses the customer's message when the AI fails", async () => {
    await db.message.updateMany({ where: { senderType: "STAFF", conversation: { businessId: biz } }, data: { createdAt: new Date(Date.now() - 3600000) } });
    calls = []; ai = Response.json({ error: { code: "AI_FAILED" } }, { status: 502 }); setup();
    const before = await db.message.count({ where: { conversation: { businessId: biz } } });
    await expect(inbound("any update?")).resolves.toMatchObject({ stored: 1 });
    expect(await db.message.count({ where: { conversation: { businessId: biz } } })).toBe(before + 1);
    expect(calls.some(c => c.path === "/internal/whatsapp/send")).toBe(false);
  });
  it("a failed delivery does not flag the chat or silence later replies", async () => {
    await db.conversation.updateMany({ where: { businessId: biz }, data: { needsHuman: false } });
    await db.message.updateMany({ where: { senderType: "STAFF", conversation: { businessId: biz } }, data: { createdAt: new Date(Date.now() - 3600000) } });
    calls = []; ai = { intent: "complaint", language: "en", reply: "Sorry about that, a team member will follow up.", needsHuman: true };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const path = new URL(url).pathname; calls.push({ path, body: JSON.parse(String(init.body)) }); return path === "/internal/ai/reply" ? Response.json(ai) : Response.json({ error: { code: "WHATSAPP_SEND_FAILED" } }, { status: 502 }); }));
    await inbound("my food was cold");
    expect(calls.some(c => c.path === "/internal/whatsapp/send")).toBe(true);
    expect((await db.conversation.findFirstOrThrow({ where: { businessId: biz } })).needsHuman).not.toBe(true); // nothing was delivered, so nothing is flagged
    setup(); calls = []; ai = { intent: "greeting", language: "en", reply: "Hi again!", needsHuman: false }; await inbound("hello?");
    expect(calls.some(c => c.path === "/internal/whatsapp/send")).toBe(true); // it still answers
  });
  it("asks the customer to type when they send a voice note or image, once, without calling the AI", async () => {
    await db.conversation.updateMany({ where: { businessId: biz }, data: { needsHuman: false } });
    await db.message.updateMany({ where: { senderType: "STAFF", conversation: { businessId: biz } }, data: { createdAt: new Date(Date.now() - 3600000) } });
    await db.message.updateMany({ where: { senderType: "AI", conversation: { businessId: biz } }, data: { createdAt: new Date(Date.now() - 3600000) } }); // let earlier notices age out
    setup(); calls = [];
    await inbound("", { type: "audio", textBody: undefined });
    expect(calls.map(c => c.path)).toEqual(["/internal/whatsapp/send"]);
    expect(calls[0]!.body.text).toContain("only read text messages"); expect(calls[0]!.body.text).toContain("اكتب رسالتك");
    calls = []; await inbound("", { type: "image", textBody: undefined }); expect(calls).toEqual([]); // already told them a moment ago
    calls = []; await inbound("", { type: "sticker", textBody: undefined }); expect(calls).toEqual([]); // stickers and reactions are ignored
  });
  it("stays quiet only if it was explicitly disabled by us", async () => {
    await setAiSettings(owner, biz, { enabled: false }, "t"); await db.conversation.updateMany({ where: { businessId: biz }, data: { needsHuman: false } });
    await db.message.updateMany({ where: { senderType: "STAFF", conversation: { businessId: biz } }, data: { createdAt: new Date(Date.now() - 3600000) } });
    calls = []; ai = { intent: "greeting", language: "en", reply: "Hi!", needsHuman: false }; setup(); await inbound("hello again"); expect(calls).toEqual([]);
  });
});

describe.skipIf(!enabled)("welcome message when a chat is opened", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5590${Date.now().toString().slice(-9)}`;
  let owner: string, biz: string; let sends: string[]; let n = 0;
  const open = (extra: object = {}) => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.w${++n}`, senderId: "971504074115", timestamp: String(Math.floor(Date.now() / 1000)), type: "request_welcome", senderName: "Ahmad", ...extra }] });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const body = JSON.parse(String(init.body)); if (new URL(url).pathname === "/internal/whatsapp/send") sends.push(body.text); return Response.json({ messageId: `wamid.out.${suffix}.${++n}` }); }));
    owner = (await db.user.create({ data: { name: "own", email: `w-${suffix}@test.invalid`, phoneNumber: "+971509992001", phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Welcome Grill", locationName: "Main" }, "t")).id;
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990004", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
  });
  afterAll(async () => { vi.unstubAllGlobals(); });

  it("greets in English and Arabic by default, once, and starts the conversation", async () => {
    sends = []; const r = await open();
    expect(r).toMatchObject({ welcomed: 1 }); expect(sends).toHaveLength(1); expect(sends[0]).toContain("Welcome to Welcome Grill"); expect(sends[0]).toContain("أهلاً بك في Welcome Grill");
    const c = await db.conversation.findFirstOrThrow({ where: { businessId: biz }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    expect(c.messages.map(m => [m.direction, m.messageType])).toEqual([["INBOUND", "REQUEST_WELCOME"], ["OUTBOUND", "TEXT"]]);
    expect((await getConversationFor(owner, biz, c.id)).canReply).toBe(true); // Meta opens the 24-hour window
    sends = []; await recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.w1`, senderId: "971504074115", timestamp: String(Math.floor(Date.now() / 1000)), type: "request_welcome" }] });
    expect(sends).toEqual([]); // the same event delivered again is ignored
    expect(await db.customer.count({ where: { businessId: biz } })).toBe(1);
  });
  it("uses the owner's own welcome text, and nothing when the assistant is disabled", async () => {
    await setAiSettings(owner, biz, { welcome: "Hi! Welcome to our kitchen 🍔" }, "t"); await db.customer.deleteMany({ where: { businessId: biz } }).catch(() => undefined);
    sends = []; await open({ senderId: "971500007777" }); expect(sends).toEqual(["Hi! Welcome to our kitchen 🍔"]);
    expect((await getAiSettings(owner, biz)).welcome).toBe("Hi! Welcome to our kitchen 🍔");
    await setAiSettings(owner, biz, { enabled: false }, "t"); sends = []; await open({ senderId: "971500008888" }); expect(sends).toEqual([]);
  });
});
