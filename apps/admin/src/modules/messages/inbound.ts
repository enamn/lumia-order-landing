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
  type: z.string().min(1).max(40), location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), name: z.string().max(200).optional(), address: z.string().max(300).optional() }).strict().optional(), mediaId: z.string().regex(/^\d{5,30}$/).optional(), textBody: z.string().max(8192).optional(), senderName: z.string().max(200).optional(),
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
        // A shared location pin is kept on the conversation (for delivery pricing) and shown in the chat as readable text.
        const loc = m.type.toLowerCase() === "location" ? m.location : undefined;
        const shown = loc ? `📍 ${[loc.name, loc.address].filter(Boolean).join(", ") || "Location"} (${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)})` : (m.textBody ?? null);
        await tx.message.create({ data: { conversationId: conversation.id, externalMessageId: m.messageId, direction: "INBOUND", senderType: "CUSTOMER", messageType: m.type.toUpperCase(), textContent: shown, status: "RECEIVED", createdAt: at } });
        if (loc) await tx.conversation.update({ where: { id: conversation.id }, data: { customerLocation: { latitude: loc.latitude, longitude: loc.longitude, name: loc.name ?? "", address: loc.address ?? "", at: at.toISOString() } } });
        if (loc) pending = { businessId: account.businessId, conversationId: conversation.id, externalMessageId: m.messageId, kind: "text" };
        else if (m.type.toLowerCase() === "text" && m.textBody) pending = { businessId: account.businessId, conversationId: conversation.id, externalMessageId: m.messageId, kind: "text" };
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

const COUNTED = ["AWAITING_BUSINESS_CONFIRMATION", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED"] as const;
const PERIODS = { today: { days: 1, buckets: 6 }, week: { days: 7, buckets: 7 }, month: { days: 30, buckets: 6 } } as const;
// Orders, revenue and WhatsApp chats for the Overview page, compared with the period before. `tzOffset` is the browser's Date.getTimezoneOffset() so "today" means the owner's day.
export async function getOverview(userId: string, businessId: string, period: string, tzOffset: number) {
  await authorize(userId, businessId);
  const cfg = PERIODS[period as keyof typeof PERIODS] ?? PERIODS.week;
  const DAY = 86_400_000, off = Number.isFinite(tzOffset) ? Math.max(-840, Math.min(840, Math.trunc(tzOffset))) * 60_000 : 0;
  const end = Math.floor((Date.now() - off) / DAY) * DAY + off + DAY, span = cfg.days * DAY, start = end - span, prevStart = start - span;
  const orders = await db.order.findMany({ where: { businessId, status: { in: [...COUNTED] }, createdAt: { gte: new Date(prevStart), lt: new Date(end) } }, select: { createdAt: true, totalMinor: true, currencyCode: true, items: { select: { itemNameSnapshot: true, quantity: true } } } });
  const msgs = await db.message.findMany({ where: { direction: "INBOUND", createdAt: { gte: new Date(prevStart), lt: new Date(end) }, conversation: { businessId } }, select: { conversationId: true, createdAt: true } });
  const sum = (from: number, to: number) => {
    const rows = orders.filter(o => o.createdAt.getTime() >= from && o.createdAt.getTime() < to);
    const revenueMinor = rows.reduce((t, o) => t + o.totalMinor, 0);
    const chats = new Set(msgs.filter(m => m.createdAt.getTime() >= from && m.createdAt.getTime() < to).map(m => m.conversationId)).size;
    return { rows, orders: rows.length, revenueMinor, avgMinor: rows.length ? Math.round(revenueMinor / rows.length) : 0, chats };
  };
  const cur = sum(start, end), prev = sum(prevStart, start), size = span / cfg.buckets;
  const buckets = Array.from({ length: cfg.buckets }, (_, i) => ({ start: new Date(start + i * size).toISOString(), orders: cur.rows.filter(o => { const t = o.createdAt.getTime(); return t >= start + i * size && t < start + (i + 1) * size; }).length }));
  const qty = new Map<string, number>();
  for (const o of cur.rows) for (const it of o.items) qty.set(it.itemNameSnapshot, (qty.get(it.itemNameSnapshot) ?? 0) + it.quantity);
  const top = [...qty].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, sold]) => ({ name, sold }));
  const strip = ({ rows: _rows, ...rest }: typeof cur) => rest;
  // Setup checklist: delivery rules saved in Settings, and at least one order placed (a real or test order).
  const biz = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { settings: true } });
  const delivery = (biz.settings as { delivery?: { method?: string | null; status?: string } } | null)?.delivery;
  const setup = { delivery: Boolean(delivery && (delivery.method || (delivery.status && delivery.status !== "available"))), tested: (await db.order.count({ where: { businessId } })) > 0 };
  return { setup, period: period in PERIODS ? period : "week", currency: orders[0]?.currencyCode ?? "AED", current: strip(cur), previous: strip(prev), buckets, top };
}

export async function listConversations(userId: string, businessId: string) {
  await authorize(userId, businessId);
  const rows = await db.conversation.findMany({ where: { businessId }, orderBy: { lastMessageAt: "desc" }, take: 30, include: { customer: { select: { displayName: true, phone: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true, textContent: true, messageType: true, createdAt: true } } } });
  return rows.map(c => ({ id: c.id, status: c.status, needsHuman: c.needsHuman === true, lastMessageAt: c.lastMessageAt, customer: { name: c.customer.displayName ?? "", phone: c.customer.phone }, lastMessage: c.messages[0] ? { direction: c.messages[0].direction, text: c.messages[0].textContent ?? "", type: c.messages[0].messageType } : null }));
}
