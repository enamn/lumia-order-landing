import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { lumiaApi } from "@/server/lumia-api";
import { decryptSecret } from "@/server/crypto";
import { deliverOrderReview, deliverText, type Interactive } from "./reply";
import { welcomeFor } from "./welcome-text";
import { DRAFT_TTL_MS, type SavedAddr, draftKey, isComplete, meetsMinimum, money, orderItemLines, placedText, recheckText, codeText, langOf, removedText, resolveDraft, summaryText, type DeliveryContext, type MenuEntry, type Options, type StoredDraft } from "@/modules/orders/draft";
import { branchFromText, looksLikeAddress, nearestBranch, quoteDelivery, type BranchPoint, type DeliveryRules } from "@/modules/orders/delivery";
import { catalogIdFor } from "@/modules/menu/catalog";
import { canPersonalize, entitlementsFor } from "@/modules/billing/service";
import { canStartOrder, consume, refund } from "@/modules/billing/usage";
import { checkCode } from "@/modules/campaigns/codes";
import { confirmPendingOrder, createOrderFromDraft, discardPendingOrders, findPendingOrder } from "@/modules/orders/service";

// The AI assistant answers customers' WhatsApp messages from the restaurant's own menu. It only replies when the owner turned it on,
// never keeps talking once a person has taken over, and hands anything it cannot answer (orders, complaints, unknown facts) to staff.
// A complaint pauses the assistant for this long (staff replying also keeps it quiet). "Needs you" on its own only marks the chat for staff.
const COMPLAINT_PAUSE_MS = 30 * 60 * 1000;
const HUMAN_ACTIVE_MS = 15 * 60 * 1000; const MAX_AI_PER_HOUR = 20;
// Abuse guards: one person sending more than RATE_BURST messages in two minutes is told once to slow down, then ignored for a while; very long messages are cut.
const RATE_BURST = 10; const MAX_TEXT = 1000;
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

// The menu a customer is served from: the shared menu, or (Pro) the branch's own.
async function loadMenu(businessId: string, branchId?: string | null): Promise<(MenuEntry & { category: string })[]> {
  const id = await catalogIdFor(db, businessId, branchId);
  const catalog = id ? await db.catalog.findUnique({ where: { id }, include: { categories: true, items: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" }, take: 400 } } }) : null;
  if (!catalog) return [];
  const names = new Map(catalog.categories.map(c => [c.id, c.name]));
  return catalog.items.map((i, n) => ({ index: String(n + 1), itemId: i.id, category: (i.categoryId && names.get(i.categoryId)) || "Other", name: i.name, nameAr: i.nameAr ?? "", priceMinor: i.basePriceMinor, available: i.isAvailable }));
}

export async function autoReply(t: { businessId: string; conversationId: string; externalMessageId: string }): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  if (!account?.phoneNumberId || !account.accessTokenEncrypted) return "skipped";
  const conversation = await db.conversation.findFirst({ where: { id: t.conversationId, businessId: t.businessId }, include: { customer: { select: { phone: true, displayName: true, lastBranchId: true } }, business: { select: { name: true } } } });
  if (!conversation) return "skipped";
  const now = Date.now();
  const recent = await db.message.findMany({ where: { conversationId: t.conversationId }, orderBy: { createdAt: "desc" }, take: 12, select: { externalMessageId: true, direction: true, senderType: true, messageType: true, textContent: true, createdAt: true } });
  // Answer only the newest customer message, and stay quiet while a person is actively replying.
  if (conversation.aiPausedUntil && conversation.aiPausedUntil.getTime() > now) return "skipped"; // a complaint is with the team
  const latestInbound = recent.find(m => m.direction === "INBOUND");
  if (!latestInbound || latestInbound.externalMessageId !== t.externalMessageId || !latestInbound.textContent) return "skipped";
  if (recent.some(m => m.senderType === "STAFF" && now - m.createdAt.getTime() < HUMAN_ACTIVE_MS)) return "skipped";
  if (recent.filter(m => m.senderType === "AI" && now - m.createdAt.getTime() < 3600000).length >= MAX_AI_PER_HOUR) return "skipped";
  const history = recent.slice().reverse().filter(m => m.textContent && m.externalMessageId !== t.externalMessageId).map(m => ({ from: m.direction === "INBOUND" ? "customer" : "restaurant", text: m.textContent! }));
  const settings = await db.orderSettings.findUnique({ where: { businessId: t.businessId } });
  const options: Options = { delivery: settings?.supportsDelivery ?? true, pickup: settings?.supportsPickup ?? true, minimumMinor: settings?.minimumOrderAmountMinor ?? 0 };
  const prev = conversation.draftOrder as StoredDraft | null;
  let stored = prev && Date.now() - new Date(prev.updatedAt).getTime() < DRAFT_TTL_MS ? prev : null;
  // Delivery: the restaurant's pricing rules, its branches, the customer's shared location pin and WhatsApp name. The fee itself is worked out here, never by the assistant.
  const bizRow = await db.business.findUniqueOrThrow({ where: { id: t.businessId }, select: { settings: true, locations: { where: { status: "ACTIVE" }, select: { id: true, name: true, latitude: true, longitude: true } } } });
  const rules = ((bizRow.settings as { delivery?: DeliveryRules } | null)?.delivery ?? null) as DeliveryRules | null;
  const branches: BranchPoint[] = bizRow.locations.map(l => ({ id: l.id, name: l.name, active: true, latitude: l.latitude, longitude: l.longitude }));
  const shared = conversation.customerLocation as { latitude: number; longitude: number; at: string; emirate?: string | null; area?: string; formatted?: string } | null;
  const fresh = shared && now - new Date(shared.at).getTime() < 24 * 3600 * 1000 ? shared : null;
  const pin = fresh ? { latitude: fresh.latitude, longitude: fresh.longitude } : undefined;
  // What the pin resolved to: the emirate and area are known, so the customer is not asked for them again (the street/building still is).
  const pinPlace = { emirate: fresh?.emirate ?? null, area: fresh?.area ?? "", formatted: fresh?.formatted ?? "" };
  // Pro with a menu for each branch: the branch decides the menu. A shared pin picks the nearest branch (a different branch drops a half-made order, its menu differs);
  // otherwise the customer is asked which branch. Until it is known the assistant has no menu and can't take an order.
  const perBranch = (await entitlementsFor(t.businessId)).menuPerBranch && (await db.catalog.findMany({ where: { businessId: t.businessId, status: "ACTIVE" }, select: { locationId: true } })).some(c => c.locationId);
  let branchId: string | null = perBranch && conversation.branchId && branches.some(b => b.id === conversation.branchId) ? conversation.branchId : null;
  let branchSwitched = false;
  if (perBranch) {
    const near = pin ? nearestBranch(branches, pin) : null;
    if (near && near !== branchId) { branchSwitched = Boolean(branchId); if (branchSwitched) stored = null; branchId = near; }
    if (!branchId) branchId = branchFromText(rules, branches, latestInbound.textContent); // the restaurant's own area rules name a branch, so no pin is needed
    if (!branchId && branches.length === 1) branchId = branches[0]!.id;
  }
  const branchNeeded = perBranch && !branchId;
  const menu = branchNeeded ? [] : await loadMenu(t.businessId, perBranch ? branchId : null);
  const byItem = new Map(menu.map(m => [m.itemId, m.index]));
  const savedRows = await db.customerAddress.findMany({ where: { customerId: conversation.customerId }, orderBy: { isDefault: "desc" }, take: 6 });
  const saved: SavedAddr[] = savedRows.map((a, i) => ({ id: String(i + 1), label: a.label, text: a.addressText, emirate: a.emirate, area: a.city, latitude: a.latitude, longitude: a.longitude }));
  const ctx: DeliveryContext = { rules, branches, profileName: conversation.customer.displayName ?? "", saved, ...(pin ? { pin } : {}) };
  const apiDraft = stored ? { items: stored.items.flatMap(l => byItem.has(l.itemId) ? [{ id: byItem.get(l.itemId)!, quantity: l.quantity, notes: l.notes }] : []), fulfillment: stored.fulfillment, address: stored.address, emirate: stored.emirate ?? pinPlace.emirate, area: stored.area || pinPlace.area, customerName: stored.name ?? "", addressLabel: stored.label ?? "", savedAddress: stored.savedId ?? "", discountCode: stored.discountCode ?? "", confirmed: false } : null;
  const known = apiDraft ? resolveDraft(menu, { ...apiDraft, fulfillment: "delivery" }, options, ctx) : null;
  const preQuote = known?.delivery ?? quoteDelivery(rules, branches, { emirate: stored?.emirate ?? pinPlace.emirate, area: stored?.area || pinPlace.area, ...(pin ?? {}) }, 0, options.minimumMinor);
  const deliveryHint = options.delivery ? { method: rules?.method ?? null, needs: preQuote.status === "needs" ? preQuote.need : null, pinReceived: Boolean(pin), emirate: known?.emirate ?? stored?.emirate ?? pinPlace.emirate, area: stored?.area || pinPlace.area, note: pinPlace.formatted ? `The location pin the customer shared is at: ${pinPlace.formatted}. Do not ask for the emirate or area again; still ask for the building, flat or landmark if the address text is missing.` : "" } : null;
  const useName = await canPersonalize(t.businessId);
  // A tap on the review template's buttons is handled directly: no AI call, nothing counted against the AI allowance.
  const tapText = latestInbound.textContent.trim();
  const tap = /^(confirm order|تأكيد الطلب)$/i.test(tapText) ? "confirm" : /^(change order|تعديل الطلب)$/i.test(tapText) ? "change" : null;
  if (tap) { const pendingOrder = await findPendingOrder(t.conversationId); if (pendingOrder) return handleReviewTap(t, tap, pendingOrder, account, conversation, langOf(recent.find(m => m.direction === "OUTBOUND")?.textContent ?? tapText)); }
  // Abuse guard: a flood from one customer.
  const burst = await db.message.count({ where: { conversationId: t.conversationId, direction: "INBOUND", createdAt: { gte: new Date(now - 120000) } } });
  if (burst > RATE_BURST) { if (burst === RATE_BURST + 1) await sendNotice(t, SLOW_DOWN).catch(() => undefined); return "skipped"; }
  // The plan's monthly orders (then bought ones). Someone halfway through an order may finish it; everyone else gets a plain notice and the owner sees the message in the inbox.
  if (!stored && !await canStartOrder(t.businessId)) return sendNotice(t, BUSY, 3600000);
  // Behind that, a fair-use pool of AI replies so endless chatting cannot run up costs.
  const taken = await consume(t.businessId, "ai", { inProgress: Boolean(stored) });
  if (!taken.ok) return sendNotice(t, BUSY, 3600000);
  // No pin: an address the customer typed is looked up on the map, and they are asked once to confirm the place that was found.
  type Candidate = { query: string; latitude: number; longitude: number; emirate: string | null; area: string; street: string; place: string; formatted: string; at: string };
  let candidate = conversation.candidateLocation as Candidate | null;
  if (candidate && now - new Date(candidate.at).getTime() > 3600000) candidate = null;
  const wantsPin = !pin && ((preQuote.status === "needs" && preQuote.need === "pin") || branchNeeded);
  let newCandidate: Candidate | null = null;
  if (wantsPin && looksLikeAddress(latestInbound.textContent) && candidate?.query !== latestInbound.textContent) {
    const g = await lumiaApi<{ found: boolean; latitude: number; longitude: number; emirate: string | null; area: string; street: string; place: string; formatted: string }>("/internal/geo/search", { query: `${latestInbound.textContent.slice(0, 160)}, UAE` }, 6000);
    if (g.ok && g.data.found) newCandidate = candidate = { query: latestInbound.textContent, latitude: g.data.latitude, longitude: g.data.longitude, emirate: g.data.emirate, area: g.data.area, street: g.data.street, place: g.data.place, formatted: g.data.formatted, at: new Date().toISOString() };
  }
  const lastBranch = branchNeeded ? branches.find(b => b.id === conversation.customer.lastBranchId)?.name : undefined;
  const branchList = branches.map((b, i) => ({ id: String(i + 1), realId: b.id, name: b.name }));
  const r = await lumiaApi<{ intent: string; language: "en" | "ar"; reply: string; needsHuman: boolean; branch?: string; askLocation?: boolean; locationConfirmed?: boolean; order: { items: { id: string; quantity: number; notes: string }[]; fulfillment: "delivery" | "pickup" | null; address: string; emirate?: string | null; area?: string; customerName?: string; addressLabel?: string; savedAddress?: string; discountCode?: string; confirmed: boolean } | null }>("/internal/ai/reply", { businessName: conversation.business.name, tone: agent?.tone ?? "Friendly", instructions: agent?.instructions ?? "", menu: menu.map(m => ({ id: m.index, category: m.category, name: m.name, nameAr: m.nameAr, price: m.priceMinor / 100, available: m.available })), draft: apiDraft, delivery: deliveryHint, ...(branchNeeded ? { branchNeeded: true, branches: branchList.map(b => ({ id: b.id, name: b.name })), ...(lastBranch ? { lastBranch } : {}) } : {}), ...(wantsPin && candidate ? { candidate: candidate.formatted } : {}), customer: { name: conversation.customer.displayName ?? "", useName }, savedAddresses: saved.map(a => ({ id: a.id, label: a.label, text: [a.text, a.emirate].filter(Boolean).join(", ") })), options: { delivery: options.delivery, pickup: options.pickup, minimumOrder: options.minimumMinor / 100 }, history, message: latestInbound.textContent.slice(0, MAX_TEXT), ...(latestInbound.messageType === "AUDIO" ? { voice: true } : {}) }, 45000);
  if (!r.ok) { console.error(JSON.stringify({ level: "error", code: "AI_REPLY_REJECTED", status: r.status, apiCode: r.code })); await refund(t.businessId, "ai", taken); return sendNotice(t, TRY_AGAIN, 300000).catch(() => "skipped" as const); } // an AI failure must never leave the customer in silence
  const lang = r.data.language; const parts = [r.data.reply];
  const data: { needsHuman?: boolean; aiPausedUntil?: Date | null; draftOrder?: object | null; branchId?: string | null; customerLocation?: object; candidateLocation?: object | null } = {};
  if (newCandidate) data.candidateLocation = newCandidate;
  // The customer confirmed the place we found for their typed address: from now on it works like a shared pin.
  if (wantsPin && candidate && r.data.locationConfirmed) { data.customerLocation = { latitude: candidate.latitude, longitude: candidate.longitude, name: "", address: "", at: new Date().toISOString(), emirate: candidate.emirate, area: candidate.area, street: candidate.street, place: candidate.place, formatted: candidate.formatted, source: "address" }; data.candidateLocation = null; }
  if (branchSwitched) data.draftOrder = null as never; // the other branch's menu has different items
  if (perBranch && branchId !== (conversation.branchId ?? null)) data.branchId = branchId;
  // Pickup: the customer named a branch. Nothing is ordered in this turn (there was no menu yet); the next message uses that branch's menu.
  const chosen = branchNeeded ? branchList.find(b => b.id === r.data.branch) : undefined;
  if (branchNeeded) r.data.order = null;
  if (chosen) data.branchId = chosen.realId;
  // Muting the assistant is for real complaints and questions it cannot answer. Cancelling or changing an order in progress never needs a person.
  if (r.data.needsHuman && (r.data.intent === "complaint" || !stored)) data.needsHuman = true; // the badge for staff
  if (r.data.intent === "complaint") data.aiPausedUntil = new Date(now + COMPLAINT_PAUSE_MS); // only a complaint silences the assistant
  // The model must send the whole draft every turn, but it sometimes drops a field it already knew (emirate, area, address, name). Keep what was
  // already agreed, otherwise the confirmation would not match what the customer was shown and the order would never be placed.
  const sameAddress = !!r.data.order && !!stored && (!r.data.order.address?.trim() || r.data.order.address.trim() === stored.address); // a new address must not inherit the old one's details
  const merged = r.data.order && stored ? { ...r.data.order, discountCode: r.data.order.discountCode?.trim() || stored.discountCode || "", address: r.data.order.address?.trim() || stored.address, customerName: r.data.order.customerName?.trim() || stored.name || "", ...(sameAddress ? { emirate: r.data.order.emirate ?? stored.emirate ?? pinPlace.emirate, area: r.data.order.area?.trim() || stored.area || "", addressLabel: r.data.order.addressLabel?.trim() || stored.label || "", savedAddress: r.data.order.savedAddress || stored.savedId || "" } : {}) } : r.data.order;
  // The place the shared pin resolved to fills in what the assistant left out.
  const model = merged ? { ...merged, emirate: merged.emirate ?? pinPlace.emirate, area: merged.area?.trim() || pinPlace.area } : merged;
  let reviewId: string | null = null;
  // A discount code is checked here, never by the assistant: valid for this customer now, or the customer is told why not.
  const codeCheck = model ? await checkCode(t.businessId, conversation.customerId, model.discountCode) : null;
  const priced: DeliveryContext = codeCheck?.ok ? { ...ctx, discount: { id: codeCheck.id, code: codeCheck.code, percent: codeCheck.percent } } : ctx;
  if (model) {
    const resolved = resolveDraft(menu, model, options, priced); const key = draftKey(resolved);
    // An order is placed only when the customer confirmed the exact summary we showed them (same items, type and address), and it is complete.
    if (model.confirmed && isComplete(resolved) && meetsMinimum(resolved, options) && stored?.shownKey === key && resolved.fulfillment) {
      // The order counts against the plan's monthly orders (a little past the limit is allowed to finish one already started).
      const slot = await consume(t.businessId, "orders", { inProgress: true });
      if (!slot.ok) { parts.length = 0; parts.push(BUSY); data.draftOrder = prev as never; }
      else {
        let order: { orderNumber: string; totalMinor: number };
        try {
          // The customer already reviewed this order with the template: confirming it sends that very order to the restaurant.
          const pending = await findPendingOrder(t.conversationId);
          order = (pending && await confirmPendingOrder({ businessId: t.businessId, orderId: pending.id })) || await createOrderFromDraft({ businessId: t.businessId, conversationId: t.conversationId, customerId: conversation.customerId, customerName: conversation.customer.displayName ?? "", customerPhone: conversation.customer.phone, resolved: { ...resolved, fulfillment: resolved.fulfillment }, branchId: perBranch ? branchId : null });
        } catch (e) { await refund(t.businessId, "orders", slot); throw e; } // an order that was not saved does not count
        parts.length = 0; parts.push(placedText(order.orderNumber, order.totalMinor, resolved.fulfillment, lang));
        if (perBranch && branchId) await db.customer.update({ where: { id: conversation.customerId }, data: { lastBranchId: branchId } });
      }
    } else if (!resolved.lines.length) { await discardPendingOrders(t.conversationId); data.draftOrder = null as never; if (resolved.removed.length) parts.push(removedText(resolved.removed, lang)); }
    else {
      if (resolved.removed.length) parts.push(removedText(resolved.removed, lang));
      if (codeCheck && !codeCheck.ok) parts.push(codeText(codeCheck.reason, lang));
      // The customer said yes but this is not (yet) exactly what they were shown, or something is missing: never let the assistant claim the order
      // is placed. Show the summary again and ask them to confirm it.
      const showSummary = stored?.shownKey !== key || resolved.removed.length > 0 || model.confirmed;
      // The summary below asks for YES, so the assistant's own words must not say the order is already confirmed; a real question from it is kept.
      // Only when the summary really asks for YES (complete order); an order still missing its location keeps the assistant's own question.
      const asksYes = isComplete(resolved) && meetsMinimum(resolved, options);
      // A complete order is reviewed with the approved template: the order is saved with its number but only the customer sees it, and the template's
      // Confirm / Change buttons decide what happens next. If the template cannot be sent, the text summary and YES work as before.
      let reviewed = false;
      if (asksYes && showSummary && !model.confirmed && !resolved.removed.length && !(codeCheck && !codeCheck.ok) && resolved.fulfillment) {
        try {
          await discardPendingOrders(t.conversationId);
          const pending = await createOrderFromDraft({ businessId: t.businessId, conversationId: t.conversationId, customerId: conversation.customerId, customerName: conversation.customer.displayName ?? "", customerPhone: conversation.customer.phone, resolved: { ...resolved, fulfillment: resolved.fulfillment }, branchId: perBranch ? branchId : null, pending: true });
          const review = { customerName: resolved.name || conversation.customer.displayName || "", orderNumber: `#${pending.orderNumber}`, restaurantName: conversation.business.name, items: orderItemLines(resolved.lines, lang), total: `${money(pending.totalMinor)} AED` };
          reviewId = await deliverOrderReview(account, conversation.customer.phone, review);
          if (reviewId) { reviewed = true; parts.length = 0; parts.push(reviewText(review, lang)); } else await discardPendingOrders(t.conversationId);
        } catch { await discardPendingOrders(t.conversationId).catch(() => undefined); }
      } else if (!asksYes) await discardPendingOrders(t.conversationId); // an order that is no longer complete is not waiting for a tap
      if (!reviewed) {
        if (model.confirmed || (showSummary && asksYes && !/[?؟]/.test(parts[0] ?? ""))) parts[0] = recheckText(lang);
        // Show the exact summary whenever it changed, or an item was dropped, so the customer always confirms what we will really place.
        if (showSummary) parts.push(summaryText(resolved, lang, options));
      }
      data.draftOrder = { items: resolved.lines.map(l => ({ itemId: l.itemId, quantity: l.quantity, notes: l.notes })), fulfillment: resolved.fulfillment, address: resolved.address, emirate: resolved.emirate, area: resolved.area, label: resolved.label, savedId: resolved.savedId, name: model.customerName || "", discountCode: codeCheck?.ok ? codeCheck.code : "", shownKey: key, updatedAt: new Date().toISOString() };
    }
  }
  // First contact: if nobody has answered this customer yet (and Meta's own welcome event didn't already), greet them before answering.
  if (!reviewId && await db.message.count({ where: { conversationId: t.conversationId, direction: "OUTBOUND" } }) === 0) parts.unshift(welcomeFor(agent, conversation.business.name));
  const reply = parts.filter(Boolean).join("\n\n");
  // Flags and the saved draft change only together with a reply that was really sent, so a failed delivery never leaves the chat stuck as "needs you".
  if (!reply) { if (Object.keys(data).length) await db.conversation.update({ where: { id: t.conversationId }, data: data as never }); return "skipped"; }
  // One tap to share the location, or buttons / a list to pick a branch, instead of explaining the attach menu.
  let interactive: Interactive | undefined;
  if (!reviewId) {
    if (r.data.askLocation && !pin) interactive = { kind: "location_request" };
    else if (branchNeeded && !chosen && branchList.length && /[?؟]/.test(r.data.reply)) interactive = branchList.length <= 3 ? { kind: "buttons", options: branchList.map(b => ({ id: b.id, title: b.name })) } : { kind: "list", listButton: lang === "ar" ? "الفروع" : "Branches", options: branchList.slice(0, 10).map(b => ({ id: b.id, title: b.name })) };
  }
  const messageId = reviewId ?? await deliverText(account, conversation.customer.phone, reply, interactive);
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
const SLOW_DOWN = "You're sending messages very quickly. Please wait a moment and I'll reply 🙏\nأنت ترسل الرسائل بسرعة كبيرة. فضلاً انتظر قليلاً وسأرد عليك 🙏";
const BUSY = "Thanks for your message! Someone from the restaurant will assist you soon 🙏\nشكراً لرسالتك! سيقوم أحد من المطعم بمساعدتك قريباً 🙏";
const TRY_AGAIN = "Sorry, I couldn't process that. Please send your message again 🙏\nعذراً، لم أتمكن من معالجة رسالتك. فضلاً أرسلها مرة أخرى 🙏";
type Target = { businessId: string; conversationId: string; externalMessageId: string };

// A fixed notice (not an AI answer): same guards as the assistant, and the same notice is never repeated within ten minutes.
async function sendNotice(t: Target, text: string, repeatAfterMs = 600000): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  const conversation = await db.conversation.findFirst({ where: { id: t.conversationId, businessId: t.businessId }, include: { customer: { select: { phone: true } } } });
  if (!account || !conversation || (conversation.aiPausedUntil && conversation.aiPausedUntil.getTime() > Date.now())) return "skipped";
  const now = Date.now();
  const recent = await db.message.findMany({ where: { conversationId: t.conversationId }, orderBy: { createdAt: "desc" }, take: 12, select: { senderType: true, textContent: true, createdAt: true } });
  if (recent.some(m => m.senderType === "STAFF" && now - m.createdAt.getTime() < HUMAN_ACTIVE_MS)) return "skipped";
  if (recent.some(m => m.senderType === "AI" && m.textContent === text && now - m.createdAt.getTime() < repeatAfterMs)) return "skipped";
  const messageId = await deliverText(account, conversation.customer.phone, text);
  const at = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: t.conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: text, status: "SENT", createdAt: at } }),
    db.conversation.update({ where: { id: t.conversationId }, data: { lastMessageAt: at } }),
  ]);
  return "sent";
}
// What the review template looks like in the inbox (the template itself is Meta's; this is the same text, for staff).
const reviewText = (v: { customerName: string; orderNumber: string; restaurantName: string; items: string; total: string }, lang: "en" | "ar") => lang === "ar"
  ? `مرحباً ${v.customerName || ""}، فضلاً راجع الطلب ${v.orderNumber} من ${v.restaurantName}.\n${v.items}\nالمجموع: ${v.total}\nأكّد أدناه لإرسال طلبك إلى المطعم.\n[تأكيد الطلب] [تعديل الطلب]`
  : `Hi ${v.customerName || "there"}, please review order ${v.orderNumber} from ${v.restaurantName}.\n${v.items}\nTotal: ${v.total}\nConfirm below to send your order to the restaurant.\n[Confirm order] [Change order]`;

async function sendDirect(t: Target, account: { phoneNumberId: string | null; accessTokenEncrypted: string | null }, phone: string, text: string): Promise<"sent"> {
  const messageId = await deliverText(account, phone, text);
  const at = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: t.conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: text, status: "SENT", createdAt: at } }),
    db.conversation.update({ where: { id: t.conversationId }, data: { lastMessageAt: at } }),
  ]);
  return "sent";
}
// The customer tapped Confirm order or Change order under the review template.
async function handleReviewTap(t: Target, tap: "confirm" | "change", pending: { id: string }, account: { phoneNumberId: string | null; accessTokenEncrypted: string | null }, conversation: { draftOrder: unknown; customer: { phone: string } }, lang: "en" | "ar"): Promise<"sent" | "skipped"> {
  if (tap === "change") {
    await discardPendingOrders(t.conversationId);
    const draft = conversation.draftOrder as StoredDraft | null;
    if (draft) await db.conversation.update({ where: { id: t.conversationId }, data: { draftOrder: { ...draft, shownKey: "" } as never } }); // the next complete order is reviewed again
    return sendDirect(t, account, conversation.customer.phone, lang === "ar" ? "تمام، اكتب لي ما الذي تريد تغييره 👍" : "No problem, tell me what you'd like to change 👍");
  }
  const slot = await consume(t.businessId, "orders", { inProgress: true }); // the order counts against the plan's monthly orders when it is sent to the restaurant
  if (!slot.ok) return sendNotice(t, BUSY, 3600000);
  let order: Awaited<ReturnType<typeof confirmPendingOrder>>;
  try { order = await confirmPendingOrder({ businessId: t.businessId, orderId: pending.id }); } catch (e) { await refund(t.businessId, "orders", slot); throw e; }
  if (!order) { await refund(t.businessId, "orders", slot); return "skipped"; }
  return sendDirect(t, account, conversation.customer.phone, placedText(order.orderNumber, order.totalMinor, order.fulfillmentType === "DELIVERY" ? "delivery" : "pickup", lang));
}
export const replyToUnreadable = (t: Target) => sendNotice(t, TYPE_ONLY);

// A voice note: transcribe it, keep the transcript on the message so staff can read it, refuse other languages, otherwise answer it like typed text.
export async function handleVoice(t: Target & { mediaId: string }): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (!isOn(agent)) return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  if (!account?.accessTokenEncrypted) return "skipped";
  const voice = await consume(t.businessId, "voice"); // over the plan's voice notes: ask the customer to type instead
  if (!voice.ok) return sendNotice(t, TYPE_ONLY);
  const r = await lumiaApi<{ text: string; language: "ar" | "en" | "mixed" | "other"; usable: boolean }>("/internal/whatsapp/transcribe", { accessToken: decryptSecret(account.accessTokenEncrypted), mediaId: t.mediaId, hotwords: (await loadMenu(t.businessId, (await db.conversation.findUnique({ where: { id: t.conversationId }, select: { branchId: true } }))?.branchId)).flatMap(m => [m.name, m.nameAr]).filter(Boolean).slice(0, 80) }, 90000);
  if (!r.ok) { console.error(JSON.stringify({ level: "error", code: "VOICE_TRANSCRIBE_FAILED", status: r.status, apiCode: r.code })); await refund(t.businessId, "voice", voice); return sendNotice(t, TYPE_ONLY); }
  if (r.data.text) await db.message.updateMany({ where: { externalMessageId: t.externalMessageId }, data: { textContent: r.data.text, transcription: r.data.text } });
  if (r.data.language === "other") return sendNotice(t, r.data.text ? UNSUPPORTED_LANGUAGE : NOT_CLEAR);
  if (!r.data.usable) return sendNotice(t, NOT_CLEAR);
  return autoReply(t);
}
