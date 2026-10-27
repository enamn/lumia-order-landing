import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { deliverText } from "./reply";
import { agentOf, isOn } from "./ai";
import { notifyCustomerWaiting } from "@/modules/billing/reminders";
import { getSubscriptionFor, type Access } from "@/modules/billing/service";

// A customer wrote to a restaurant whose trial or plan is over. The assistant stays off, but nobody is left in silence:
// the owner is emailed (first 3 customers one by one, then a daily summary) and the customer gets one short notice a day telling them to contact the restaurant directly.
// The number stays connected, so choosing a plan switches everything back on at once.
const dayKey = (d: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);

export async function handleLockedInbound(t: { businessId: string; phone: string; customerName: string | null; phoneNumberId: string; conversationId: string; access: Pick<Access, "reason"> }, now = new Date()): Promise<void> {
  if (t.access.reason !== "trial_ended" && t.access.reason !== "ended") return; // "setup" (VAT registration pending) is the owner's onboarding, not an expired plan
  const sub = await getSubscriptionFor(t.businessId);
  const lockKey = sub ? sub.currentPeriodEnd.toISOString().slice(0, 10) : "trial";
  await notifyCustomerWaiting(t.businessId, t.phone, t.customerName, lockKey, now).catch(() => console.error(JSON.stringify({ level: "error", code: "LOCKED_NOTIFY_FAILED" })));
  await tellCustomer(t, now).catch((e: { code?: unknown }) => console.error(JSON.stringify({ level: "error", code: "LOCKED_REPLY_FAILED", reason: typeof e?.code === "string" ? e.code : "UNKNOWN" })));
}

async function tellCustomer(t: { businessId: string; phone: string; phoneNumberId: string; conversationId: string }, now: Date) {
  if (!isOn(await agentOf(t.businessId))) return; // the owner turned automatic replies off
  const business = await db.business.findUnique({ where: { id: t.businessId }, select: { name: true, timezone: true } });
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, phoneNumberId: t.phoneNumberId, status: "CONNECTED" } });
  if (!business || !account) return;
  // One notice per customer per day (the restaurant's own calendar day).
  const periodKey = `${t.phone}|${dayKey(now, business.timezone ?? "Asia/Dubai")}`;
  if (await db.billingNotice.findFirst({ where: { businessId: t.businessId, kind: "customer_autoreply", periodKey }, select: { id: true } })) return;
  try { await db.billingNotice.create({ data: { businessId: t.businessId, kind: "customer_autoreply", periodKey } }); }
  catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; throw e; }
  const text = `Ordering on WhatsApp is temporarily unavailable at ${business.name}. Please contact the restaurant directly. Thank you!\n\nالطلب عبر واتساب غير متاح مؤقتاً لدى ${business.name}. يرجى التواصل مع المطعم مباشرة. شكراً لك!`;
  let sentId: string;
  try { sentId = await deliverText(account, t.phone, text); }
  catch (e) { await db.billingNotice.deleteMany({ where: { businessId: t.businessId, kind: "customer_autoreply", periodKey } }); throw e; } // not delivered: the next message tries again
  await db.$transaction([
    db.message.create({ data: { conversationId: t.conversationId, externalMessageId: sentId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: text, status: "SENT", createdAt: now } }),
    db.conversation.update({ where: { id: t.conversationId }, data: { lastMessageAt: now } }),
  ]);
}
