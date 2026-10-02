import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness } from "../src/modules/business/service";
import { recordInbound, listConversations } from "../src/modules/messages/inbound";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("voice notes", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5600${Date.now().toString().slice(-9)}`;
  let owner: string, biz: string; let calls: { path: string; body: any }[]; let stt: any; let ai: any; let n = 0; let out = 0;
  const voice = (from: string, mediaId = "123456789") => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.${++n}`, senderId: from, timestamp: String(Math.floor(Date.now() / 1000)), type: "audio", mediaId, senderName: "Ahmad" }] });
  const sent = () => calls.filter(c => c.path === "/internal/whatsapp/send").map(c => c.body.text as string);
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname; const body = JSON.parse(String(init.body)); calls.push({ path, body });
      if (path === "/internal/whatsapp/transcribe") return stt instanceof Response ? stt.clone() : Response.json(stt);
      if (path === "/internal/ai/reply") return Response.json(ai);
      return Response.json({ messageId: `wamid.out.${suffix}.${++out}` });
    }));
    owner = (await db.user.create({ data: { name: "own", email: `v-${suffix}@test.invalid`, phoneNumber: "+971509993001", phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Voice Grill", locationName: "Main" }, "t")).id;
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990005", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    const cat = await db.catalog.create({ data: { businessId: biz, name: "Main", status: "ACTIVE" } });
    await db.catalogItem.create({ data: { catalogId: cat.id, name: "Classic Burger", nameAr: "برجر كلاسيك", basePriceMinor: 2800 } });
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });
  const stored = (from: string) => db.message.findFirstOrThrow({ where: { messageType: "AUDIO", conversation: { businessId: biz, customer: { phone: `+${from}` } } }, orderBy: { createdAt: "desc" } });

  it.each([["Gulf Arabic", "971500001001", "ابغى برجر كلاسيك من فضلك", "ar"], ["Egyptian Arabic", "971500001002", "عايز اتنين برجر كلاسيك لو سمحت", "ar"], ["Levantine Arabic", "971500001003", "بدي برجر كلاسيك بليز", "ar"], ["English", "971500001004", "I would like one classic burger", "en"], ["Arabic and English mixed", "971500001005", "ابي two classic burger please", "mixed"]])("%s: transcribes, keeps the transcript, and answers it like typed text", async (_n, from, text, language) => {
    calls = []; stt = { text, language, usable: true }; ai = { intent: "price_question", language: language === "en" ? "en" : "ar", reply: "Classic Burger is 28 AED.", needsHuman: false };
    await voice(from);
    expect(calls[0]).toEqual({ path: "/internal/whatsapp/transcribe", body: { accessToken: "biz-token", mediaId: "123456789", hotwords: ["Classic Burger", "برجر كلاسيك"] } }); // the menu helps it hear item names
    const ask = calls.find(c => c.path === "/internal/ai/reply")!.body; expect(ask).toMatchObject({ message: text, voice: true });
    expect(sent().at(-1)).toContain("Classic Burger is 28 AED.");
    expect(await stored(from)).toMatchObject({ messageType: "AUDIO", textContent: text, transcription: text });
  });
  it("refuses a language other than Arabic or English with a bilingual message, and does not call the AI", async () => {
    calls = []; stt = { text: "مجھے ایک برگر چاہیے", language: "other", usable: false };
    await voice("971500002001");
    expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false);
    expect(sent()).toEqual([expect.stringContaining("only understand voice messages in Arabic or English")]); expect(sent()[0]).toContain("بالعربية والإنجليزية فقط");
    expect((await stored("971500002001")).transcription).toBe("مجھے ایک برگر چاہیے"); // staff can still read what was said
  });
  it("asks to repeat when the audio is unclear or empty", async () => {
    calls = []; stt = { text: "", language: "other", usable: false }; await voice("971500003001");
    expect(sent()).toEqual([expect.stringContaining("couldn't hear that clearly")]); expect(sent()[0]).toContain("لم أستطع سماع الرسالة بوضوح");
    calls = []; stt = { text: "mm hm", language: "en", usable: false }; await voice("971500003002"); expect(sent()).toEqual([expect.stringContaining("couldn't hear that clearly")]);
    expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false);
  });
  it("falls back to the 'please type' note when transcription is unavailable, and never loses the message", async () => {
    calls = []; stt = Response.json({ error: { code: "STT_NOT_CONFIGURED" } }, { status: 503 }); await voice("971500004001");
    expect(sent()).toEqual([expect.stringContaining("only read text messages")]);
    expect(await stored("971500004001")).toMatchObject({ messageType: "AUDIO", direction: "INBOUND" });
    const list = await listConversations(owner, biz); expect(list.length).toBeGreaterThan(4);
  });
  it("ignores a redelivered voice note", async () => {
    stt = { text: "ابغى برجر", language: "ar", usable: true }; ai = { intent: "greeting", language: "ar", reply: "أهلاً", needsHuman: false };
    const id = `wamid.${suffix}.dupvoice`; const msg = { phoneNumberId: PNID, messageId: id, senderId: "971500005001", timestamp: String(Math.floor(Date.now() / 1000)), type: "audio", mediaId: "123456789" };
    await recordInbound({ messages: [msg] }); calls = []; await recordInbound({ messages: [msg] }); expect(calls).toEqual([]);
  });
});
