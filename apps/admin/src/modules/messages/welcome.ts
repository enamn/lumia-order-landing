import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { deliverText } from "./reply";
import { agentOf, isOn } from "./ai";
import { welcomeFor } from "./welcome-text";

// Meta sends a `request_welcome` event the first time someone opens a chat with a restaurant's number, before they type anything.
// We greet them (the restaurant can write its own greeting), and keep the event as the start of the conversation so replies are allowed for 24 hours.
export async function sendWelcome(t: { businessId: string; messageId: string; senderId: string; senderName?: string; timestamp: string }): Promise<"sent" | "skipped"> {
  const agent = await agentOf(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  const business = await db.business.findUnique({ where: { id: t.businessId }, select: { name: true } });
  if (!account?.phoneNumberId || !account.accessTokenEncrypted || !business) return "skipped";
  const phone = `+${t.senderId}`; const at = new Date(Number(t.timestamp) * 1000);
  const customer = await db.customer.upsert({ where: { businessId_phone: { businessId: t.businessId, phone } }, create: { businessId: t.businessId, phone, ...(t.senderName ? { displayName: t.senderName } : {}) }, update: {} });
  const open = await db.conversation.findFirst({ where: { businessId: t.businessId, customerId: customer.id, status: "OPEN" }, orderBy: { lastMessageAt: "desc" } });
  const conversation = open ?? await db.conversation.create({ data: { businessId: t.businessId, customerId: customer.id, lastMessageAt: at } });
  try { await db.message.create({ data: { conversationId: conversation.id, externalMessageId: t.messageId, direction: "INBOUND", senderType: "CUSTOMER", messageType: "REQUEST_WELCOME", status: "RECEIVED", createdAt: at } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "skipped"; /* Meta redelivered it */ throw error; }
  const text = welcomeFor(agent, business.name);
  const sentId = await deliverText(account, phone, text); const now = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: conversation.id, externalMessageId: sentId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: text, status: "SENT", createdAt: now } }),
    db.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } }),
  ]);
  return "sent";
}
