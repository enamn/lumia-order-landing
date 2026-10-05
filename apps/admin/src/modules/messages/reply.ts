import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { decryptSecret } from "@/server/crypto";
import { lumiaApi } from "@/server/lumia-api";
import { linkTestMode } from "@/modules/auth/phone";

// Staff replies to customers from the dashboard. The message goes out through lumia-order-api from the restaurant's own linked number;
// we store it only after Meta accepted it. Meta allows free-form text only within 24 hours of the customer's last message.
const WINDOW_MS = 24 * 3600 * 1000;
export const replySchema = z.object({ text: z.string().trim().min(1).max(4096) }).strict();

export async function getConversation(userId: string, businessId: string, conversationId: string) {
  await authorize(userId, businessId);
  const c = await db.conversation.findFirst({ where: { id: conversationId, businessId }, include: { customer: { select: { displayName: true, phone: true } } } });
  if (!c) throw new AppError("NOT_FOUND", "Conversation not found.", 404);
  const rows = await db.message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, direction: true, senderType: true, messageType: true, textContent: true, status: true, createdAt: true } });
  const lastInbound = await db.message.findFirst({ where: { conversationId, direction: "INBOUND" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const windowEndsAt = lastInbound ? new Date(lastInbound.createdAt.getTime() + WINDOW_MS) : null;
  return { id: c.id, customer: { name: c.customer.displayName ?? "", phone: c.customer.phone }, needsHuman: c.needsHuman === true, canReply: !!windowEndsAt && windowEndsAt > new Date(), windowEndsAt, messages: rows.reverse().map(m => ({ id: m.id, direction: m.direction, senderType: m.senderType, type: m.messageType, text: m.textContent ?? "", status: m.status, createdAt: m.createdAt })) };
}

const ERRORS: Record<string, [string, string, number]> = {
  REPLY_WINDOW_CLOSED: ["REPLY_WINDOW_CLOSED", "The 24-hour reply window has closed. The customer must message you first.", 409],
  WHATSAPP_TOKEN_INVALID: ["WHATSAPP_RECONNECT_NEEDED", "Your WhatsApp connection expired. Reconnect WhatsApp and try again.", 409],
};

// Sends one text through lumia-order-api from the restaurant's own number; returns Meta's message ID. Used for staff and AI replies.
// A message that is more than text: the reply with a one-tap "Send location" button, reply buttons or a list (to pick a branch). If WhatsApp refuses the
// interactive form (too long, not supported), the plain text goes out instead, so the customer always gets the answer.
export interface Interactive { kind: "location_request" | "buttons" | "list"; options?: { id: string; title: string }[]; listButton?: string }
export async function deliverText(account: { phoneNumberId: string | null; accessTokenEncrypted: string | null }, to: string, text: string, interactive?: Interactive): Promise<string> {
  if (!account.phoneNumberId || !account.accessTokenEncrypted) throw new AppError("WHATSAPP_NOT_CONNECTED", "Connect WhatsApp before replying to customers.", 409);
  if (linkTestMode() && account.phoneNumberId.startsWith("test-")) return `test.${crypto.randomUUID()}`;
  const base = { accessToken: decryptSecret(account.accessTokenEncrypted), phoneNumberId: account.phoneNumberId, to, text };
  for (const extra of interactive ? [interactive, undefined] : [undefined]) {
    const r = await lumiaApi<{ messageId: string }>("/internal/whatsapp/send", { ...base, ...(extra ?? {}) }, 15000);
    if (r.ok) return r.data.messageId;
    const known = r.code ? ERRORS[r.code] : undefined;
    if (extra && !known) continue; // the interactive form was refused: try the plain text
    throw known ? new AppError(...known) : new AppError("SEND_FAILED", "We couldn’t send your reply. Please try again.", 502);
  }
  throw new AppError("SEND_FAILED", "We couldn’t send your reply. Please try again.", 502);
}

// The approved "review your order" template (customer name, order number, restaurant, items, total). Never throws: null means it was not sent and the caller sends the plain message.
export async function deliverOrderReview(account: { phoneNumberId: string | null; accessTokenEncrypted: string | null }, to: string, review: { customerName: string; orderNumber: string; restaurantName: string; items: string; total: string }): Promise<string | null> {
  if (!account.phoneNumberId || !account.accessTokenEncrypted) return null;
  if (linkTestMode() && account.phoneNumberId.startsWith("test-")) return `test.${crypto.randomUUID()}`;
  const r = await lumiaApi<{ messageId: string }>("/internal/whatsapp/order-review", { accessToken: decryptSecret(account.accessTokenEncrypted), phoneNumberId: account.phoneNumberId, to, ...review }, 15000);
  if (!r.ok) console.error(JSON.stringify({ level: "warn", code: "ORDER_REVIEW_TEMPLATE_NOT_SENT", status: r.status, apiCode: r.code }));
  return r.ok ? r.data.messageId : null;
}

export async function sendReply(userId: string, businessId: string, conversationId: string, input: unknown, requestId: string) {
  const { text } = replySchema.parse(input);
  const { business } = await authorize(userId, businessId, "operations.manage");
  const conversation = await db.conversation.findFirst({ where: { id: conversationId, businessId }, include: { customer: { select: { phone: true } } } });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found.", 404);
  const account = await db.whatsAppAccount.findFirst({ where: { businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  if (!account?.phoneNumberId || !account.accessTokenEncrypted) throw new AppError("WHATSAPP_NOT_CONNECTED", "Connect WhatsApp before replying to customers.", 409);
  const lastInbound = await db.message.findFirst({ where: { conversationId, direction: "INBOUND" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!lastInbound || lastInbound.createdAt.getTime() + WINDOW_MS < Date.now()) throw new AppError(...ERRORS.REPLY_WINDOW_CLOSED!);
  const messageId = await deliverText(account, conversation.customer.phone, text);
  const now = new Date();
  return transaction(async tx => {
    const message = await tx.message.create({ data: { conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "STAFF", messageType: "TEXT", textContent: text, status: "SENT", createdAt: now }, select: { id: true, direction: true, senderType: true, messageType: true, textContent: true, status: true, createdAt: true } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, needsHuman: false } });
    // The message text is never written to the audit log.
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Conversation", entityId: conversationId, action: "message.sent", requestId } });
    return { id: message.id, direction: message.direction, senderType: message.senderType, type: message.messageType, text: message.textContent ?? "", status: message.status, createdAt: message.createdAt };
  });
}
