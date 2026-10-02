import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { lumiaApi } from "@/server/lumia-api";
import { deliverText } from "./reply";
import { welcomeFor } from "./welcome-text";
import { DRAFT_TTL_MS, draftKey, isComplete, meetsMinimum, placedText, removedText, resolveDraft, summaryText, type MenuEntry, type Options, type StoredDraft } from "@/modules/orders/draft";
import { createOrderFromDraft } from "@/modules/orders/service";

// The AI assistant answers customers' WhatsApp messages from the restaurant's own menu. It only replies when the owner turned it on,
// never keeps talking once a person has taken over, and hands anything it cannot answer (orders, complaints, unknown facts) to staff.
const HUMAN_ACTIVE_MS = 15 * 60 * 1000; const MAX_AI_PER_HOUR = 20;
export const aiSettingsSchema = z.object({ enabled: z.boolean().optional(), instructions: z.string().trim().max(1500).optional(), welcome: z.string().trim().max(600).optional(), tone: z.enum(["Friendly", "Professional", "Casual"]).optional() }).strict();

const agentFor = (businessId: string) => db.aiAgent.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } });
// The assistant is always on for a connected restaurant. Only an explicit DISABLED status (set by us, not exposed in the app) silences it.
export const isOn = (a: { status: string } | null) => a?.status !== "DISABLED";
export const agentOf = agentFor;
const welcomeOf = (a: { configuration?: unknown } | null) => { const w = (a?.configuration as { welcome?: unknown } | null)?.welcome; return typeof w === "string" ? w : ""; };
const view = (a: { status: string; instructions: string; tone: string; configuration?: unknown } | null) => ({ enabled: isOn(a), welcome: welcomeOf(a), instructions: a?.instructions ?? "", tone: a?.tone ?? "Friendly" });

export async function getAiSettings(userId: string, businessId: string) { await authorize(userId, businessId); return view(await agentFor(businessId)); }

export async function setAiSettings(userId: string, businessId: string, input: unknown, requestId: string) {
  const data = aiSettingsSchema.parse(input);
  return transaction(async tx => {
    const { business } = await authorize(userId, businessId, "business.manage", tx);
    const existing = await tx.aiAgent.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } });
    const fields = { status: data.enabled === false ? "DISABLED" : "ACTIVE", ...(data.welcome !== undefined ? { configuration: { ...((existing?.configuration as object | null) ?? {}), welcome: data.welcome } } : {}), ...(data.instructions !== undefined ? { instructions: data.instructions } : {}), ...(data.tone ? { tone: data.tone } : {}) };
    const agent = existing ? await tx.aiAgent.update({ where: { id: existing.id }, data: fields }) : await tx.aiAgent.create({ data: { businessId, ...fields } });
    // Instructions can hold business details, so the audit trail records only that the setting changed.
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "AiAgent", entityId: agent.id, action: data.enabled === false ? "ai.disabled" : "ai.settings.updated", requestId } });
    return view(agent);
  });
}

async function loadMenu(businessId: string): Promise<(MenuEntry & { category: string })[]> {
  const catalog = await db.catalog.findFirst({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, include: { categories: true, items: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" }, take: 400 } } });
  if (!catalog) return [];
  const names = new Map(catalog.categories.map(c => [c.id, c.name]));
  return catalog.items.map((i, n) => ({ index: String(n + 1), itemId: i.id, category: (i.categoryId && names.get(i.categoryId)) || "Other", name: i.name, nameAr: i.nameAr ?? "", priceMinor: i.basePriceMinor, available: i.isAvailable }));
}

export async function autoReply(t: { businessId: string; conversationId: string; externalMessageId: string }): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  if (!account?.phoneNumberId || !account.accessTokenEncrypted) return "skipped";
  const conversation = await db.conversation.findFirst({ where: { id: t.conversationId, businessId: t.businessId }, include: { customer: { select: { phone: true, displayName: true } }, business: { select: { name: true } } } });
  if (!conversation || conversation.needsHuman === true) return "skipped";
  const now = Date.now();
  const recent = await db.message.findMany({ where: { conversationId: t.conversationId }, orderBy: { createdAt: "desc" }, take: 12, select: { externalMessageId: true, direction: true, senderType: true, textContent: true, createdAt: true } });
  // Answer only the newest customer message, and stay quiet while a person is actively replying.
  const latestInbound = recent.find(m => m.direction === "INBOUND");
  if (!latestInbound || latestInbound.externalMessageId !== t.externalMessageId || !latestInbound.textContent) return "skipped";
  if (recent.some(m => m.senderType === "STAFF" && now - m.createdAt.getTime() < HUMAN_ACTIVE_MS)) return "skipped";
  if (recent.filter(m => m.senderType === "AI" && now - m.createdAt.getTime() < 3600000).length >= MAX_AI_PER_HOUR) return "skipped";
  const history = recent.slice().reverse().filter(m => m.textContent && m.externalMessageId !== t.externalMessageId).map(m => ({ from: m.direction === "INBOUND" ? "customer" : "restaurant", text: m.textContent! }));
  const settings = await db.orderSettings.findUnique({ where: { businessId: t.businessId } });
  const options: Options = { delivery: settings?.supportsDelivery ?? true, pickup: settings?.supportsPickup ?? true, minimumMinor: settings?.minimumOrderAmountMinor ?? 0 };
  const menu = await loadMenu(t.businessId);
  const byItem = new Map(menu.map(m => [m.itemId, m.index]));
  const prev = conversation.draftOrder as StoredDraft | null;
  const stored = prev && Date.now() - new Date(prev.updatedAt).getTime() < DRAFT_TTL_MS ? prev : null;
  const apiDraft = stored ? { items: stored.items.flatMap(l => byItem.has(l.itemId) ? [{ id: byItem.get(l.itemId)!, quantity: l.quantity, notes: l.notes }] : []), fulfillment: stored.fulfillment, address: stored.address, confirmed: false } : null;
  const r = await lumiaApi<{ intent: string; language: "en" | "ar"; reply: string; needsHuman: boolean; order: { items: { id: string; quantity: number; notes: string }[]; fulfillment: "delivery" | "pickup" | null; address: string; confirmed: boolean } | null }>("/internal/ai/reply", { businessName: conversation.business.name, tone: agent?.tone ?? "Friendly", instructions: agent?.instructions ?? "", menu: menu.map(m => ({ id: m.index, category: m.category, name: m.name, nameAr: m.nameAr, price: m.priceMinor / 100, available: m.available })), draft: apiDraft, options: { delivery: options.delivery, pickup: options.pickup, minimumOrder: options.minimumMinor / 100 }, history, message: latestInbound.textContent }, 45000);
  if (!r.ok) { console.error(JSON.stringify({ level: "error", code: "AI_REPLY_REJECTED", status: r.status, apiCode: r.code })); return "skipped"; }
  const lang = r.data.language; const parts = [r.data.reply];
  const data: { needsHuman?: boolean; draftOrder?: object | null } = {};
  if (r.data.needsHuman) data.needsHuman = true;
  const model = r.data.order;
  if (model) {
    const resolved = resolveDraft(menu, model, options); const key = draftKey(resolved);
    // An order is placed only when the customer confirmed the exact summary we showed them (same items, type and address), and it is complete.
    if (model.confirmed && isComplete(resolved) && meetsMinimum(resolved, options) && stored?.shownKey === key && resolved.fulfillment) {
      const order = await createOrderFromDraft({ businessId: t.businessId, conversationId: t.conversationId, customerId: conversation.customerId, customerName: conversation.customer.displayName ?? "", customerPhone: conversation.customer.phone, resolved: { ...resolved, fulfillment: resolved.fulfillment } });
      parts.length = 0; parts.push(placedText(order.orderNumber, order.totalMinor, resolved.fulfillment, lang));
    } else if (!resolved.lines.length) { data.draftOrder = null as never; if (resolved.removed.length) parts.push(removedText(resolved.removed, lang)); }
    else {
      if (resolved.removed.length) parts.push(removedText(resolved.removed, lang));
      // Show the exact summary whenever it changed, or an item was dropped, so the customer always confirms what we will really place.
      if (stored?.shownKey !== key || resolved.removed.length) parts.push(summaryText(resolved, lang, options));
      data.draftOrder = { items: resolved.lines.map(l => ({ itemId: l.itemId, quantity: l.quantity, notes: l.notes })), fulfillment: resolved.fulfillment, address: resolved.address, shownKey: key, updatedAt: new Date().toISOString() };
    }
  }
  // First contact: if nobody has answered this customer yet (and Meta's own welcome event didn't already), greet them before answering.
  if (await db.message.count({ where: { conversationId: t.conversationId, direction: "OUTBOUND" } }) === 0) parts.unshift(welcomeFor(agent, conversation.business.name));
  const reply = parts.filter(Boolean).join("\n\n");
  // Flags and the saved draft change only together with a reply that was really sent, so a failed delivery never leaves the chat stuck as "needs you".
  if (!reply) { if (Object.keys(data).length) await db.conversation.update({ where: { id: t.conversationId }, data: data as never }); return "skipped"; }
  const messageId = await deliverText(account, conversation.customer.phone, reply);
  const at = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: t.conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: reply, status: "SENT", createdAt: at } }),
    db.conversation.update({ where: { id: t.conversationId }, data: { ...(data as object), lastMessageAt: at } as never }),
  ]);
  return "sent";
}

// Voice notes, images, videos and documents can't be read yet, so ask the customer to type instead of staying silent.
export const UNREADABLE_TYPES = new Set(["AUDIO", "VOICE", "IMAGE", "VIDEO", "DOCUMENT"]);
const TYPE_ONLY = "Sorry, I can only read text messages for now. Please type your message and I'll help right away 🙏\nعذراً، أستطيع قراءة الرسائل النصية فقط حالياً. فضلاً اكتب رسالتك وسأساعدك فوراً 🙏";
export async function replyToUnreadable(t: { businessId: string; conversationId: string; externalMessageId: string }): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  const conversation = await db.conversation.findFirst({ where: { id: t.conversationId, businessId: t.businessId }, include: { customer: { select: { phone: true } } } });
  if (!account || !conversation || conversation.needsHuman === true) return "skipped";
  const now = Date.now();
  const recent = await db.message.findMany({ where: { conversationId: t.conversationId }, orderBy: { createdAt: "desc" }, take: 6, select: { senderType: true, textContent: true, createdAt: true } });
  if (recent.some(m => m.senderType === "STAFF" && now - m.createdAt.getTime() < HUMAN_ACTIVE_MS)) return "skipped";
  // One notice per ten minutes, so a stream of voice notes doesn't get a stream of replies.
  if (recent.some(m => m.senderType === "AI" && m.textContent === TYPE_ONLY && now - m.createdAt.getTime() < 600000)) return "skipped";
  const messageId = await deliverText(account, conversation.customer.phone, TYPE_ONLY);
  const at = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: t.conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: TYPE_ONLY, status: "SENT", createdAt: at } }),
    db.conversation.update({ where: { id: t.conversationId }, data: { lastMessageAt: at } }),
  ]);
  return "sent";
}
