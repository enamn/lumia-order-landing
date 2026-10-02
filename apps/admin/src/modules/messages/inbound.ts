import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { autoReply, handleVoice, replyToUnreadable, UNREADABLE_TYPES } from "./ai";
import { sendWelcome } from "./welcome";

// Messages customers send to a restaurant's linked WhatsApp number. lumia-order-api receives Meta's webhook and forwards them here;
// we find the restaurant from the phone number ID, then keep one customer + conversation per person and one message per Meta message ID.
export const inboundSchema = z.object({ messages: z.array(z.object({
  phoneNumberId: z.string().regex(/^\d{5,30}$/), wabaId: z.string().regex(/^\d{5,30}$/).optional(),
  messageId: z.string().min(1).max(200), senderId: z.string().regex(/^\d{6,20}$/), timestamp: z.string().regex(/^\d{9,12}$/),
  type: z.string().min(1).max(40), mediaId: z.string().regex(/^\d{5,30}$/).optional(), textBody: z.string().max(8192).optional(), senderName: z.string().max(200).optional(),
}).strict()).min(1).max(100) }).strict();

export type InboundResult = { stored: number; duplicates: number; unmatched: number; welcomed?: number };

export async function recordInbound(input: unknown): Promise<InboundResult> {
  const { messages } = inboundSchema.parse(input);
  const result: InboundResult = { stored: 0, duplicates: 0, unmatched: 0 };
  const toAnswer: { businessId: string; conversationId: string; externalMessageId: string; kind: "text" | "voice" | "unreadable"; mediaId?: string }[] = [];
  for (const m of messages) {
    const account = await db.whatsAppAccount.findFirst({ where: { phoneNumberId: m.phoneNumberId, status: "CONNECTED" }, select: { businessId: true, wabaId: true } });
    if (!account || (account.wabaId && m.wabaId && account.wabaId !== m.wabaId)) { result.unmatched++; continue; }
    if (m.type === "request_welcome") {
      // Someone just opened the chat: greet them. A failed greeting must not fail the whole batch.
      const sent = await sendWelcome({ businessId: account.businessId, messageId: m.messageId, senderId: m.senderId, ...(m.senderName ? { senderName: m.senderName } : {}), timestamp: m.timestamp }).catch((e: { code?: unknown }) => { console.error(JSON.stringify({ level: "error", code: "WELCOME_FAILED", reason: typeof e?.code === "string" ? e.code : "UNKNOWN" })); return "skipped" as const; });
      if (sent === "sent") result.welcomed = (result.welcomed ?? 0) + 1;
      continue;
    }
    const phone = `+${m.senderId}`; const at = new Date(Number(m.timestamp) * 1000);
    let pending: (typeof toAnswer)[number] | undefined;
    try {
      await transaction(async tx => {
        const customer = await tx.customer.upsert({ where: { businessId_phone: { businessId: account.businessId, phone } }, create: { businessId: account.businessId, phone, ...(m.senderName ? { displayName: m.senderName } : {}) }, update: {} });
        if (m.senderName && !customer.displayName) await tx.customer.update({ where: { id: customer.id }, data: { displayName: m.senderName } });
        const open = await tx.conversation.findFirst({ where: { businessId: account.businessId, customerId: customer.id, status: "OPEN" }, orderBy: { lastMessageAt: "desc" } });
        const conversation = open ?? await tx.conversation.create({ data: { businessId: account.businessId, customerId: customer.id, lastMessageAt: at } });
        await tx.message.create({ data: { conversationId: conversation.id, externalMessageId: m.messageId, direction: "INBOUND", senderType: "CUSTOMER", messageType: m.type.toUpperCase(), textContent: m.textBody ?? null, status: "RECEIVED", createdAt: at } });
        if (m.type.toLowerCase() === "text" && m.textBody) pending = { businessId: account.businessId, conversationId: conversation.id, externalMessageId: m.messageId, kind: "text" };
        else if (m.type.toLowerCase() === "audio" && m.mediaId) pending = { businessId: account.businessId, conversationId: conversation.id, externalMessageId: m.messageId, kind: "voice", mediaId: m.mediaId };
        else if (UNREADABLE_TYPES.has(m.type.toUpperCase())) pending = { businessId: account.businessId, conversationId: conversation.id, externalMessageId: m.messageId, kind: "unreadable" };
        if (at > conversation.lastMessageAt) await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: at } });
      });
      result.stored++; if (pending) toAnswer.push(pending);
    } catch (error) {
      // Meta can deliver the same message more than once; the unique message ID makes that a no-op.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") result.duplicates++; else throw error;
    }
  }
  // Messages are stored first and never lost; an AI failure only means no automatic reply.
  for (const t of toAnswer) await (t.kind === "text" ? autoReply(t) : t.kind === "voice" ? handleVoice({ ...t, mediaId: t.mediaId! }) : replyToUnreadable(t)).catch((e: { code?: unknown }) => console.error(JSON.stringify({ level: "error", code: "AI_REPLY_FAILED", reason: typeof e?.code === "string" ? e.code : "UNKNOWN" })));
  return result;
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export async function getMessageStats(userId: string, businessId: string) {
  await authorize(userId, businessId);
  const received = await db.message.count({ where: { direction: "INBOUND", createdAt: { gte: startOfToday() }, conversation: { businessId } } });
  const aiReplies = await db.message.count({ where: { senderType: "AI", createdAt: { gte: startOfToday() }, conversation: { businessId } } });
  const ordersCreated = await db.order.count({ where: { businessId, createdAt: { gte: startOfToday() } } });
  return { messagesReceived: received, aiReplies, ordersCreated };
}

export async function listConversations(userId: string, businessId: string) {
  await authorize(userId, businessId);
  const rows = await db.conversation.findMany({ where: { businessId }, orderBy: { lastMessageAt: "desc" }, take: 30, include: { customer: { select: { displayName: true, phone: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true, textContent: true, messageType: true, createdAt: true } } } });
  return rows.map(c => ({ id: c.id, status: c.status, needsHuman: c.needsHuman === true, lastMessageAt: c.lastMessageAt, customer: { name: c.customer.displayName ?? "", phone: c.customer.phone }, lastMessage: c.messages[0] ? { direction: c.messages[0].direction, text: c.messages[0].textContent ?? "", type: c.messages[0].messageType } : null }));
}
