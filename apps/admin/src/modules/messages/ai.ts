import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { lumiaApi } from "@/server/lumia-api";
import { decryptSecret } from "@/server/crypto";
import { deliverText } from "./reply";
import { welcomeFor } from "./welcome-text";
import { DRAFT_TTL_MS, type SavedAddr, draftKey, isComplete, meetsMinimum, placedText, recheckText, removedText, resolveDraft, summaryText, type DeliveryContext, type MenuEntry, type Options, type StoredDraft } from "@/modules/orders/draft";
import { quoteDelivery, type BranchPoint, type DeliveryRules } from "@/modules/orders/delivery";
import { canPersonalize } from "@/modules/billing/service";
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
  const recent = await db.message.findMany({ where: { conversationId: t.conversationId }, orderBy: { createdAt: "desc" }, take: 12, select: { externalMessageId: true, direction: true, senderType: true, messageType: true, textContent: true, createdAt: true } });
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
  // Delivery: the restaurant's pricing rules, its branches, the customer's shared location pin and WhatsApp name. The fee itself is worked out here, never by the assistant.
  const bizRow = await db.business.findUniqueOrThrow({ where: { id: t.businessId }, select: { settings: true, locations: { where: { status: "ACTIVE" }, select: { id: true, name: true, latitude: true, longitude: true } } } });
  const rules = ((bizRow.settings as { delivery?: DeliveryRules } | null)?.delivery ?? null) as DeliveryRules | null;
  const branches: BranchPoint[] = bizRow.locations.map(l => ({ id: l.id, name: l.name, active: true, latitude: l.latitude, longitude: l.longitude }));
  const shared = conversation.customerLocation as { latitude: number; longitude: number; at: string } | null;
  const pin = shared && now - new Date(shared.at).getTime() < 24 * 3600 * 1000 ? { latitude: shared.latitude, longitude: shared.longitude } : undefined;
  const savedRows = await db.customerAddress.findMany({ where: { customerId: conversation.customerId }, orderBy: { isDefault: "desc" }, take: 6 });
  const saved: SavedAddr[] = savedRows.map((a, i) => ({ id: String(i + 1), label: a.label, text: a.addressText, emirate: a.emirate, area: a.city, latitude: a.latitude, longitude: a.longitude }));
  const ctx: DeliveryContext = { rules, branches, profileName: conversation.customer.displayName ?? "", saved, ...(pin ? { pin } : {}) };
  const apiDraft = stored ? { items: stored.items.flatMap(l => byItem.has(l.itemId) ? [{ id: byItem.get(l.itemId)!, quantity: l.quantity, notes: l.notes }] : []), fulfillment: stored.fulfillment, address: stored.address, emirate: stored.emirate ?? null, area: stored.area ?? "", customerName: stored.name ?? "", addressLabel: stored.label ?? "", savedAddress: stored.savedId ?? "", confirmed: false } : null;
  const known = apiDraft ? resolveDraft(menu, { ...apiDraft, fulfillment: "delivery" }, options, ctx) : null;
  const preQuote = known?.delivery ?? quoteDelivery(rules, branches, { emirate: stored?.emirate ?? null, area: stored?.area ?? "", ...(pin ?? {}) }, 0, options.minimumMinor);
  const deliveryHint = options.delivery ? { method: rules?.method ?? null, needs: preQuote.status === "needs" ? preQuote.need : null, pinReceived: Boolean(pin), emirate: known?.emirate ?? stored?.emirate ?? null, area: stored?.area ?? "", note: "" } : null;
  const useName = await canPersonalize(t.businessId);
  const r = await lumiaApi<{ intent: string; language: "en" | "ar"; reply: string; needsHuman: boolean; order: { items: { id: string; quantity: number; notes: string }[]; fulfillment: "delivery" | "pickup" | null; address: string; emirate?: string | null; area?: string; customerName?: string; addressLabel?: string; savedAddress?: string; confirmed: boolean } | null }>("/internal/ai/reply", { businessName: conversation.business.name, tone: agent?.tone ?? "Friendly", instructions: agent?.instructions ?? "", menu: menu.map(m => ({ id: m.index, category: m.category, name: m.name, nameAr: m.nameAr, price: m.priceMinor / 100, available: m.available })), draft: apiDraft, delivery: deliveryHint, customer: { name: conversation.customer.displayName ?? "", useName }, savedAddresses: saved.map(a => ({ id: a.id, label: a.label, text: [a.text, a.emirate].filter(Boolean).join(", ") })), options: { delivery: options.delivery, pickup: options.pickup, minimumOrder: options.minimumMinor / 100 }, history, message: latestInbound.textContent, ...(latestInbound.messageType === "AUDIO" ? { voice: true } : {}) }, 45000);
  if (!r.ok) { console.error(JSON.stringify({ level: "error", code: "AI_REPLY_REJECTED", status: r.status, apiCode: r.code })); return "skipped"; }
  const lang = r.data.language; const parts = [r.data.reply];
  const data: { needsHuman?: boolean; draftOrder?: object | null } = {};
  // Muting the assistant is for real complaints and questions it cannot answer. Cancelling or changing an order in progress never needs a person.
  if (r.data.needsHuman && (r.data.intent === "complaint" || !stored)) data.needsHuman = true;
  // The model must send the whole draft every turn, but it sometimes drops a field it already knew (emirate, area, address, name). Keep what was
  // already agreed, otherwise the confirmation would not match what the customer was shown and the order would never be placed.
  const sameAddress = !!r.data.order && !!stored && (!r.data.order.address?.trim() || r.data.order.address.trim() === stored.address); // a new address must not inherit the old one's details
  const model = r.data.order && stored ? { ...r.data.order, address: r.data.order.address?.trim() || stored.address, customerName: r.data.order.customerName?.trim() || stored.name || "", ...(sameAddress ? { emirate: r.data.order.emirate ?? stored.emirate ?? null, area: r.data.order.area?.trim() || stored.area || "", addressLabel: r.data.order.addressLabel?.trim() || stored.label || "", savedAddress: r.data.order.savedAddress || stored.savedId || "" } : {}) } : r.data.order;
  if (model) {
    const resolved = resolveDraft(menu, model, options, ctx); const key = draftKey(resolved);
    // An order is placed only when the customer confirmed the exact summary we showed them (same items, type and address), and it is complete.
    if (model.confirmed && isComplete(resolved) && meetsMinimum(resolved, options) && stored?.shownKey === key && resolved.fulfillment) {
      const order = await createOrderFromDraft({ businessId: t.businessId, conversationId: t.conversationId, customerId: conversation.customerId, customerName: conversation.customer.displayName ?? "", customerPhone: conversation.customer.phone, resolved: { ...resolved, fulfillment: resolved.fulfillment } });
      parts.length = 0; parts.push(placedText(order.orderNumber, order.totalMinor, resolved.fulfillment, lang));
    } else if (!resolved.lines.length) { data.draftOrder = null as never; if (resolved.removed.length) parts.push(removedText(resolved.removed, lang)); }
    else {
      if (resolved.removed.length) parts.push(removedText(resolved.removed, lang));
      // The customer said yes but this is not (yet) exactly what they were shown, or something is missing: never let the assistant claim the order
      // is placed. Show the summary again and ask them to confirm it.
      const showSummary = stored?.shownKey !== key || resolved.removed.length > 0 || model.confirmed;
      // The summary below asks for YES, so the assistant's own words must not say the order is already confirmed; a real question from it is kept.
      if (model.confirmed || (showSummary && !/[?؟]/.test(parts[0] ?? ""))) parts[0] = recheckText(lang);
      // Show the exact summary whenever it changed, or an item was dropped, so the customer always confirms what we will really place.
      if (showSummary) parts.push(summaryText(resolved, lang, options));
      data.draftOrder = { items: resolved.lines.map(l => ({ itemId: l.itemId, quantity: l.quantity, notes: l.notes })), fulfillment: resolved.fulfillment, address: resolved.address, emirate: resolved.emirate, area: resolved.area, label: resolved.label, savedId: resolved.savedId, name: model.customerName || "", shownKey: key, updatedAt: new Date().toISOString() };
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

// Voice notes are transcribed (Arabic in any dialect, English, or a mix); images, videos and documents can't be read yet.
export const UNREADABLE_TYPES = new Set(["AUDIO", "VOICE", "IMAGE", "VIDEO", "DOCUMENT"]);
const TYPE_ONLY = "Sorry, I can only read text messages for now. Please type your message and I'll help right away 🙏\nعذراً، أستطيع قراءة الرسائل النصية فقط حالياً. فضلاً اكتب رسالتك وسأساعدك فوراً 🙏";
const UNSUPPORTED_LANGUAGE = "Sorry, I can only understand voice messages in Arabic or English. Please send your message in Arabic or English, or type it 🙏\nعذراً، أفهم الرسائل الصوتية بالعربية والإنجليزية فقط. فضلاً أرسل رسالتك بالعربية أو الإنجليزية أو اكتبها 🙏";
const NOT_CLEAR = "Sorry, I couldn't hear that clearly. Could you send it again, or type your message? 🙏\nعذراً، لم أستطع سماع الرسالة بوضوح. هل يمكنك إعادة إرسالها أو كتابتها؟ 🙏";
type Target = { businessId: string; conversationId: string; externalMessageId: string };

// A fixed notice (not an AI answer): same guards as the assistant, and the same notice is never repeated within ten minutes.
async function sendNotice(t: Target, text: string): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  const conversation = await db.conversation.findFirst({ where: { id: t.conversationId, businessId: t.businessId }, include: { customer: { select: { phone: true } } } });
  if (!account || !conversation || conversation.needsHuman === true) return "skipped";
  const now = Date.now();
  const recent = await db.message.findMany({ where: { conversationId: t.conversationId }, orderBy: { createdAt: "desc" }, take: 6, select: { senderType: true, textContent: true, createdAt: true } });
  if (recent.some(m => m.senderType === "STAFF" && now - m.createdAt.getTime() < HUMAN_ACTIVE_MS)) return "skipped";
  if (recent.some(m => m.senderType === "AI" && m.textContent === text && now - m.createdAt.getTime() < 600000)) return "skipped";
  const messageId = await deliverText(account, conversation.customer.phone, text);
  const at = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: t.conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: text, status: "SENT", createdAt: at } }),
    db.conversation.update({ where: { id: t.conversationId }, data: { lastMessageAt: at } }),
  ]);
  return "sent";
}
export const replyToUnreadable = (t: Target) => sendNotice(t, TYPE_ONLY);

// A voice note: transcribe it, keep the transcript on the message so staff can read it, refuse other languages, otherwise answer it like typed text.
export async function handleVoice(t: Target & { mediaId: string }): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  if (!account?.accessTokenEncrypted) return "skipped";
  const r = await lumiaApi<{ text: string; language: "ar" | "en" | "mixed" | "other"; usable: boolean }>("/internal/whatsapp/transcribe", { accessToken: decryptSecret(account.accessTokenEncrypted), mediaId: t.mediaId, hotwords: (await loadMenu(t.businessId)).flatMap(m => [m.name, m.nameAr]).filter(Boolean).slice(0, 80) }, 90000);
  if (!r.ok) { console.error(JSON.stringify({ level: "error", code: "VOICE_TRANSCRIBE_FAILED", status: r.status, apiCode: r.code })); return sendNotice(t, TYPE_ONLY); }
  if (r.data.text) await db.message.updateMany({ where: { externalMessageId: t.externalMessageId }, data: { textContent: r.data.text, transcription: r.data.text } });
  if (r.data.language === "other") return sendNotice(t, r.data.text ? UNSUPPORTED_LANGUAGE : NOT_CLEAR);
  if (!r.data.usable) return sendNotice(t, NOT_CLEAR);
  return autoReply(t);
}
