import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness } from "../src/modules/business/service";
import { recordInbound, getMessageStats, listConversations } from "../src/modules/messages/inbound";
import { POST } from "../src/app/api/internal/whatsapp/inbound/route";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("incoming WhatsApp messages", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5550${Date.now().toString().slice(-9)}`; const OTHER = `5551${Date.now().toString().slice(-9)}`; const WABA = `9990${Date.now().toString().slice(-9)}`;
  let owner: string, stranger: string, biz: string;
  const msg = (id: string, text = "hi", extra: object = {}) => ({ phoneNumberId: PNID, wabaId: WABA, messageId: `wamid.${suffix}.${id}`, senderId: "971504074115", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", textBody: text, senderName: "Ahmad", ...extra });
  beforeAll(async () => {
    await ensureMongoIndexes(); process.env.INTERNAL_API_KEY = "k".repeat(32);
    const mk = (n: string, i: number) => db.user.create({ data: { name: n, email: `${n}-${suffix}@test.invalid`, phoneNumber: `+97150777${String(1000 + i)}`, phoneNumberVerified: true } });
    [owner, stranger] = (await Promise.all([mk("own", 1), mk("str", 2)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "Inbound Test", locationName: "Main" }, "t")).id;
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: WABA, status: "CONNECTED", verifiedName: "T", displayPhoneNumber: "+1" } });
  });
  afterAll(async () => { await db.$disconnect(); });

  it("stores a customer, a conversation and the message for the restaurant that owns the number", async () => {
    expect(await recordInbound({ messages: [msg("1")] })).toEqual({ stored: 1, duplicates: 0, unmatched: 0 });
    const c = await db.customer.findFirstOrThrow({ where: { businessId: biz }, include: { conversations: { include: { messages: true } } } });
    expect(c).toMatchObject({ phone: "+971504074115", displayName: "Ahmad" });
    expect(c.conversations).toHaveLength(1); expect(c.conversations[0]!.messages[0]).toMatchObject({ direction: "INBOUND", senderType: "CUSTOMER", messageType: "TEXT", textContent: "hi", status: "RECEIVED", externalMessageId: `wamid.${suffix}.1` });
  });
  it("ignores redeliveries of the same Meta message and keeps one open conversation per customer", async () => {
    expect(await recordInbound({ messages: [msg("1"), msg("2", "menu please")] })).toEqual({ stored: 1, duplicates: 1, unmatched: 0 });
    expect(await db.conversation.count({ where: { businessId: biz } })).toBe(1); expect(await db.message.count({ where: { conversation: { businessId: biz } } })).toBe(2);
    expect(await db.customer.count({ where: { businessId: biz } })).toBe(1);
  });
  it("drops messages for unknown numbers, a mismatched account, and disconnected restaurants", async () => {
    expect(await recordInbound({ messages: [msg("3", "x", { phoneNumberId: OTHER })] })).toEqual({ stored: 0, duplicates: 0, unmatched: 1 });
    expect(await recordInbound({ messages: [msg("4", "x", { wabaId: "123456789012" })] })).toEqual({ stored: 0, duplicates: 0, unmatched: 1 });
    await db.whatsAppAccount.updateMany({ where: { phoneNumberId: PNID }, data: { status: "DISCONNECTED" } });
    expect(await recordInbound({ messages: [msg("5")] })).toMatchObject({ stored: 0, unmatched: 1 });
    await db.whatsAppAccount.updateMany({ where: { phoneNumberId: PNID }, data: { status: "CONNECTED" } });
  });
  it("keeps non-text messages as their type and rejects malformed input", async () => {
    await recordInbound({ messages: [msg("6", undefined as never, { type: "image", textBody: undefined })] });
    expect((await db.message.findFirstOrThrow({ where: { externalMessageId: `wamid.${suffix}.6` } })).messageType).toBe("IMAGE");
    await expect(recordInbound({ messages: [{ ...msg("7"), senderId: "not-a-number" }] })).rejects.toBeDefined();
    await expect(recordInbound({ messages: [] })).rejects.toBeDefined();
    await expect(recordInbound({ messages: [msg("8")], extra: 1 })).rejects.toBeDefined();
  });
  it("shows counts and conversations only to members of that restaurant", async () => {
    expect((await getMessageStats(owner, biz)).messagesReceived).toBe(3);
    const list = await listConversations(owner, biz); expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ customer: { name: "Ahmad", phone: "+971504074115" } });
    await expect(getMessageStats(stranger, biz)).rejects.toMatchObject({ status: 404 }); await expect(listConversations(stranger, biz)).rejects.toMatchObject({ status: 404 });
  });
  it("the HTTP endpoint requires the shared key", async () => {
    const call = (auth?: string, body: unknown = { messages: [msg("9")] }) => POST(new Request("http://localhost/api/internal/whatsapp/inbound", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) }));
    expect((await call()).status).toBe(401); expect((await call(`Bearer ${"x".repeat(32)}`)).status).toBe(401);
    const ok = await call(`Bearer ${"k".repeat(32)}`); expect(ok.status).toBe(200); expect(await ok.json()).toEqual({ stored: 1, duplicates: 0, unmatched: 0 });
    expect((await call(`Bearer ${"k".repeat(32)}`, { messages: [] })).status).toBe(400);
  });
});
