import { db } from "@/server/db";

// A restaurant can link several WhatsApp numbers (by plan). A reply goes out from the number the customer last wrote to,
// or, if that number was disconnected since, from the most recently connected one.
export async function sendingAccount(businessId: string, conversationId?: string | null) {
  const conversation = conversationId ? await db.conversation.findFirst({ where: { id: conversationId, businessId }, select: { phoneNumberId: true } }) : null;
  if (conversation?.phoneNumberId) {
    const account = await db.whatsAppAccount.findFirst({ where: { businessId, phoneNumberId: conversation.phoneNumberId, status: "CONNECTED" } });
    if (account) return account;
  }
  return db.whatsAppAccount.findFirst({ where: { businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
}
