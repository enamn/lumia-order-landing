import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness, setMember } from "../src/modules/business/service";
import { recordInbound } from "../src/modules/messages/inbound";
import { getConversation, sendReply } from "../src/modules/messages/reply";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("replying to customers", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5560${Date.now().toString().slice(-9)}`;
  let owner: string, viewer: string, stranger: string, biz: string, conv: string; let calls: { path: string; body: any }[];
  const respond = (handler: (body: any) => Response) => vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const body = JSON.parse(String(init.body)); calls.push({ path: new URL(url).pathname, body }); return handler(body); }));
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const mk = (n: string, i: number) => db.user.create({ data: { name: n, email: `${n}-${suffix}@test.invalid`, phoneNumber: `+97150888${String(1000 + i)}`, phoneNumberVerified: true } });
    [owner, viewer, stranger] = (await Promise.all([mk("own", 1), mk("vie", 2), mk("str", 3)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "Reply Test", locationName: "Main" }, "t")).id;
    await setMember(owner, biz, { phoneNumber: `+97150888${String(1002)}`, role: "VIEWER" }, "t");
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990001", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    await recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.1`, senderId: "971504074115", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", textBody: "Do you deliver?", senderName: "Ahmad" }] });
    conv = (await db.conversation.findFirstOrThrow({ where: { businessId: biz } })).id;
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("shows the thread and whether a reply is still possible", async () => {
    const t = await getConversation(owner, biz, conv);
    expect(t).toMatchObject({ canReply: true, customer: { name: "Ahmad", phone: "+971504074115" } }); expect(t.messages).toHaveLength(1);
    await expect(getConversation(stranger, biz, conv)).rejects.toMatchObject({ status: 404 });
    await expect(getConversation(owner, biz, "does-not-exist")).rejects.toMatchObject({ status: 404 });
  });
  it("sends through the API with the decrypted token and stores the outgoing message", async () => {
    calls = []; respond(() => Response.json({ messageId: "wamid.out.1" }));
    const m = await sendReply(owner, biz, conv, { text: "  Yes, we do!  " }, "t");
    expect(calls).toEqual([{ path: "/internal/whatsapp/send", body: { accessToken: "biz-token", phoneNumberId: PNID, to: "+971504074115", text: "Yes, we do!" } }]);
    expect(m).toMatchObject({ direction: "OUTBOUND", senderType: "STAFF", text: "Yes, we do!", status: "SENT" });
    expect((await db.message.findFirstOrThrow({ where: { externalMessageId: "wamid.out.1" } })).conversationId).toBe(conv);
    const audit = await db.auditLog.findFirstOrThrow({ where: { businessId: biz, action: "message.sent" } }); expect(JSON.stringify(audit)).not.toContain("Yes, we do");
  });
  it("stores nothing when the API or Meta rejects the send, and explains why", async () => {
    const before = await db.message.count({ where: { conversationId: conv } });
    respond(() => Response.json({ error: { code: "REPLY_WINDOW_CLOSED" } }, { status: 409 }));
    await expect(sendReply(owner, biz, conv, { text: "x" }, "t")).rejects.toMatchObject({ code: "REPLY_WINDOW_CLOSED", status: 409 });
    respond(() => Response.json({ error: { code: "WHATSAPP_TOKEN_INVALID" } }, { status: 401 }));
    await expect(sendReply(owner, biz, conv, { text: "x" }, "t")).rejects.toMatchObject({ code: "WHATSAPP_RECONNECT_NEEDED" });
    respond(() => Response.json({}, { status: 502 }));
    await expect(sendReply(owner, biz, conv, { text: "x" }, "t")).rejects.toMatchObject({ code: "SEND_FAILED", status: 502 });
    expect(await db.message.count({ where: { conversationId: conv } })).toBe(before);
  });
  it("blocks replies after 24 hours, with empty text, for strangers and when WhatsApp is not connected", async () => {
    calls = []; respond(() => Response.json({ messageId: "wamid.out.2" }));
    await expect(sendReply(owner, biz, conv, { text: "   " }, "t")).rejects.toBeDefined(); await expect(sendReply(owner, biz, conv, { text: "x", extra: 1 }, "t")).rejects.toBeDefined();
    await expect(sendReply(stranger, biz, conv, { text: "x" }, "t")).rejects.toMatchObject({ status: 404 });
    await expect(sendReply(viewer, biz, conv, { text: "x" }, "t")).rejects.toMatchObject({ status: 403 });
    await db.message.updateMany({ where: { conversationId: conv, direction: "INBOUND" }, data: { createdAt: new Date(Date.now() - 25 * 3600 * 1000) } });
    expect((await getConversation(owner, biz, conv)).canReply).toBe(false);
    await expect(sendReply(owner, biz, conv, { text: "late" }, "t")).rejects.toMatchObject({ code: "REPLY_WINDOW_CLOSED" }); expect(calls).toHaveLength(0);
    await db.whatsAppAccount.updateMany({ where: { businessId: biz }, data: { status: "DISCONNECTED" } });
    await expect(sendReply(owner, biz, conv, { text: "x" }, "t")).rejects.toMatchObject({ code: "WHATSAPP_NOT_CONNECTED" });
  });
});
