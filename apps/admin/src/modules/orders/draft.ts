import { createHash } from "node:crypto";
import { emirateFrom, quoteDelivery, type BranchPoint, type DeliveryRules, type Quote } from "./delivery";

// Pure order logic: the AI only proposes menu IDs and quantities. Names, prices and totals always come from the restaurant's own menu.
export type Lang = "en" | "ar";
export type Fulfillment = "delivery" | "pickup";
export interface MenuEntry { index: string; itemId: string; name: string; nameAr: string; priceMinor: number; available: boolean }
export interface StoredLine { itemId: string; quantity: number; notes: string }
export interface StoredDraft { items: StoredLine[]; fulfillment: Fulfillment | null; address: string; emirate?: string | null; area?: string; name?: string; label?: string; savedId?: string; discountCode?: string; shownKey: string; updatedAt: string }
export interface ModelDraft { items: { id: string; quantity: number; notes: string }[]; fulfillment: Fulfillment | null; address: string; emirate?: string | null; area?: string; customerName?: string; addressLabel?: string; savedAddress?: string; discountCode?: string; confirmed: boolean }
export interface PricedLine { itemId: string; name: string; nameAr: string; quantity: number; unitMinor: number; totalMinor: number; notes: string }
export interface Resolved { lines: PricedLine[]; removed: string[]; fulfillment: Fulfillment | null; address: string; subtotalMinor: number; emirate: string | null; area: string; name: string; label: string; savedId: string; delivery: Quote | null; feeMinor: number; discountMinor: number; discountCode: string; discountPercent: number; discountId: string; totalMinor: number; pin?: { latitude: number; longitude: number } }
// What the server knows for pricing delivery: the restaurant's rules and branches, the customer's WhatsApp name and shared location pin.
export interface SavedAddr { id: string; label: string; text: string; emirate: string | null; area: string; latitude: number | null; longitude: number | null }
export interface DeliveryContext { rules: DeliveryRules | null; branches: BranchPoint[]; profileName: string; pin?: { latitude: number; longitude: number }; saved?: SavedAddr[]; discount?: { id: string; code: string; percent: number } }
// "Home" and "Work" in English or Arabic become one spelling each; any other name the customer chose is kept (short, trimmed).
export function normalizeLabel(raw: string | undefined | null): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
  if (!t) return "";
  if (/^(home|house|بيت|البيت|منزل|المنزل|بيتي|منزلي)$/i.test(t)) return "Home";
  if (/^(work|office|job|عمل|العمل|شغل|الشغل|مكتب|المكتب|دوام|عملي)$/i.test(t)) return "Work";
  return t;
}
export const labelFor = (label: string, lang: Lang) => (lang === "ar" ? (label === "Home" ? "المنزل" : label === "Work" ? "العمل" : label) : label);
export interface Options { delivery: boolean; pickup: boolean; minimumMinor: number }

export const DRAFT_TTL_MS = 12 * 3600 * 1000;
const label = (e: { name: string; nameAr: string }, lang: Lang) => (lang === "ar" ? e.nameAr || e.name : e.name || e.nameAr);

export function resolveDraft(menu: MenuEntry[], d: Pick<ModelDraft, "items" | "fulfillment" | "address" | "emirate" | "area" | "customerName" | "addressLabel" | "savedAddress">, options: Options, ctx?: DeliveryContext): Resolved {
  const byIndex = new Map(menu.map(m => [m.index, m])); const merged = new Map<string, PricedLine>(); const removed: string[] = [];
  for (const l of d.items) {
    const m = byIndex.get(l.id);
    if (!m) continue; // unknown ID: the model made it up
    if (!m.available) { removed.push(m.name || m.nameAr); continue; }
    const key = `${m.itemId}|${l.notes}`; const have = merged.get(key);
    const quantity = Math.min((have?.quantity ?? 0) + l.quantity, 50);
    merged.set(key, { itemId: m.itemId, name: m.name, nameAr: m.nameAr, quantity, unitMinor: m.priceMinor, totalMinor: m.priceMinor * quantity, notes: l.notes });
  }
  const lines = [...merged.values()];
  const fulfillment = d.fulfillment && options[d.fulfillment] ? d.fulfillment : null;
  const subtotalMinor = lines.reduce((s, l) => s + l.totalMinor, 0), address = fulfillment === "delivery" ? d.address.trim() : "";
  const isDelivery = fulfillment === "delivery";
  // The customer picked one of their saved addresses: its text, area, emirate and location pin are used (no need to ask or share again).
  const saved = isDelivery && d.savedAddress ? ctx?.saved?.find(a => a.id === d.savedAddress) : undefined;
  const addr = saved ? saved.text : address, area = isDelivery ? (saved ? saved.area : (d.area ?? "")).trim() : "";
  const emirate = isDelivery ? (saved?.emirate ?? emirateFrom(d.emirate, addr, area) ?? null) : null, name = isDelivery ? ((d.customerName ?? "").trim() || ctx?.profileName.trim() || "") : "";
  const pin = saved && saved.latitude !== null && saved.longitude !== null ? { latitude: saved.latitude, longitude: saved.longitude } : saved ? undefined : ctx?.pin;
  const label = isDelivery ? (saved ? saved.label : normalizeLabel(d.addressLabel)) : "";
  const delivery = isDelivery && ctx ? quoteDelivery(ctx.rules, ctx.branches, { emirate, area, ...(pin ?? {}) }, subtotalMinor, options.minimumMinor) : null;
  const feeMinor = delivery?.status === "ok" ? delivery.feeMinor : 0;
  // A valid campaign code takes a percentage off the items (not the delivery fee).
  const discountMinor = ctx?.discount && subtotalMinor > 0 ? Math.min(subtotalMinor, Math.round(subtotalMinor * ctx.discount.percent / 100)) : 0;
  return { lines, removed: [...new Set(removed)], fulfillment, address: isDelivery ? addr : "", subtotalMinor, emirate, area, name, label, savedId: saved?.id ?? "", delivery, feeMinor, discountMinor, discountCode: discountMinor ? ctx!.discount!.code : "", discountPercent: discountMinor ? ctx!.discount!.percent : 0, discountId: discountMinor ? ctx!.discount!.id : "", totalMinor: subtotalMinor - discountMinor + feeMinor, ...(isDelivery && pin ? { pin } : {}) };
}

// The confirmation must match what was shown, including the delivery fee, the total and who it is for.
export const draftKey = (r: Pick<Resolved, "lines" | "fulfillment" | "address" | "feeMinor" | "discountMinor" | "totalMinor" | "name" | "emirate" | "area" | "label" | "savedId">) => createHash("sha256").update(JSON.stringify([r.lines.map(l => [l.itemId, l.quantity, l.notes]), r.fulfillment, r.address, r.feeMinor, r.discountMinor, r.totalMinor, r.name, r.emirate, r.area, r.label, r.savedId])).digest("hex").slice(0, 16);
// Delivery needs an address, a name and a delivery fee that could be worked out (or that the restaurant will confirm).
export const isComplete = (r: Resolved) => r.lines.length > 0 && r.fulfillment !== null && (r.fulfillment === "pickup" || (r.address.length >= 3 && (r.delivery === null || (r.name.length >= 2 && r.label.length >= 1 && r.delivery.status === "ok"))));
export const minimumFor = (r: Resolved, o: Options) => (r.delivery?.status === "ok" ? r.delivery.minimumMinor : o.minimumMinor);
export const meetsMinimum = (r: Resolved, o: Options) => r.subtotalMinor >= minimumFor(r, o);
export const money = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

// Template parameter {{4}} is one multiline value, so the same approved Meta
// template supports any number of items without adding more placeholders.
export function orderItemLines(lines: Pick<PricedLine, "quantity" | "name" | "nameAr" | "notes">[], lang: Lang): string {
  return lines.map(line => `${line.quantity}× ${label(line, lang)}${line.notes ? ` (${line.notes})` : ""}`).join("\n");
}

const T = {
  en: { order: "🧾 Your order", total: "Total", pickup: "Pickup from the restaurant", delivery: "Delivery to", payment: "Pay cash on delivery or pickup", confirm: "Reply YES to confirm your order.", minimum: (m: string) => `The minimum order is ${m} AED.`, subtotal: "Subtotal", discount: (c: string, p: number) => `Discount (${c}, ${p}%)`, fee: "Delivery fee", free: "Free", manualFee: "The restaurant will confirm the delivery fee", totalBefore: "Total before delivery fee", eta: (m: number) => `Estimated delivery: about ${m} minutes`, forName: "For", noPickupOnly: "Delivery is not available, but you can order for pickup.", pausedNow: "Delivery is paused right now, but you can order for pickup.", outside: (w: string) => `Sorry, we don't deliver to ${w} yet. You can order for pickup instead.`, recheck: "Please check these details, then reply YES to confirm your order.", removed: (n: string) => `Sorry, ${n} is not available right now, so I left it out.`, placed: (no: string, t: string, how: string) => `✅ Order #${no} received. Total ${t} AED, ${how}. We'll message you as soon as the restaurant confirms it.`, how: { pickup: "pickup", delivery: "delivery" } },
  ar: { order: "🧾 طلبك", total: "المجموع", pickup: "استلام من المطعم", delivery: "التوصيل إلى", payment: "الدفع نقداً عند الاستلام أو التوصيل", confirm: "للتأكيد أرسل «نعم».", minimum: (m: string) => `الحد الأدنى للطلب ${m} درهم.`, subtotal: "المجموع الفرعي", discount: (c: string, p: number) => `خصم (${c}، ${p}%)`, fee: "رسوم التوصيل", free: "مجاني", manualFee: "سيؤكد المطعم رسوم التوصيل", totalBefore: "المجموع قبل رسوم التوصيل", eta: (m: number) => `وقت التوصيل المتوقع: حوالي ${m} دقيقة`, forName: "باسم", noPickupOnly: "التوصيل غير متاح، لكن يمكنك الطلب للاستلام.", pausedNow: "التوصيل متوقف حالياً، لكن يمكنك الطلب للاستلام.", outside: (w: string) => `عذراً، لا نوصّل إلى ${w} حالياً. يمكنك الطلب للاستلام بدلاً من ذلك.`, recheck: "فضلاً راجع التفاصيل التالية ثم أرسل «نعم» لتأكيد طلبك.", removed: (n: string) => `عذراً، ${n} غير متوفر حالياً فلم أضفه.`, placed: (no: string, t: string, how: string) => `✅ تم استلام طلبك رقم ${no}. المجموع ${t} درهم، ${how}. سنراسلك فور تأكيد المطعم.`, how: { pickup: "استلام", delivery: "توصيل" } },
};

export function summaryText(r: Resolved, lang: Lang, options: Options): string {
  const t = T[lang]; const out = [t.order];
  for (const l of r.lines) out.push(`${l.quantity} × ${label(l, lang)}${l.notes ? ` (${l.notes})` : ""} — ${money(l.totalMinor)} AED`);
  const q = r.delivery;
  const afterDiscount = r.subtotalMinor - r.discountMinor;
  if (r.discountMinor) { out.push(`${t.subtotal}: ${money(r.subtotalMinor)} AED`); out.push(`${t.discount(r.discountCode, r.discountPercent)}: -${money(r.discountMinor)} AED`); }
  if (r.fulfillment === "delivery" && q?.status === "ok") {
    if (!r.discountMinor) out.push(`${t.subtotal}: ${money(r.subtotalMinor)} AED`);
    if (q.manual) { out.push(`${t.fee}: ${t.manualFee}`); out.push(`${t.totalBefore}: ${money(afterDiscount)} AED`); }
    else { out.push(`${t.fee}: ${r.feeMinor ? `${money(r.feeMinor)} AED` : t.free}`); out.push(`${t.total}: ${money(r.totalMinor)} AED`); }
  } else out.push(`${t.total}: ${money(afterDiscount)} AED`);
  if (r.fulfillment === "pickup") out.push(t.pickup);
  else if (r.fulfillment === "delivery") {
    if (r.address) out.push(`${t.delivery}${r.label ? ` (${labelFor(r.label, lang)})` : ""}: ${r.address}`);
    if (r.name && q?.status === "ok") out.push(`${t.forName}: ${r.name}`);
    if (q?.status === "ok" && q.etaMinutes) out.push(t.eta(q.etaMinutes));
    if (q?.status === "unavailable") out.push(q.reason === "PAUSED" ? t.pausedNow : t.noPickupOnly);
    else if (q?.status === "outside") out.push(t.outside(q.where));
  }
  if (isComplete(r)) { out.push(t.payment); if (meetsMinimum(r, options)) out.push(t.confirm); else out.push(t.minimum(money(minimumFor(r, options)))); }
  return out.join("\n");
}
// A discount code that does not count: said once, in the customer's language, never by the assistant.
export const codeText = (reason: "UNKNOWN" | "EXPIRED" | "USED", lang: Lang) => lang === "ar"
  ? (reason === "USED" ? "هذا الكود استُخدم من قبل على حسابك." : reason === "EXPIRED" ? "عذراً، انتهت صلاحية هذا الكود." : "عذراً، هذا الكود غير صحيح.")
  : (reason === "USED" ? "That code was already used on your account." : reason === "EXPIRED" ? "Sorry, that code has expired." : "Sorry, that code isn't valid.");
export const recheckText = (lang: Lang) => T[lang].recheck;
export const removedText = (names: string[], lang: Lang) => names.map(n => T[lang].removed(n)).join("\n");
export const placedText = (orderNumber: string, totalMinor: number, fulfillment: Fulfillment, lang: Lang) => T[lang].placed(orderNumber, money(totalMinor), T[lang].how[fulfillment]);
export const langOf = (text: string): Lang => (/[؀-ۿ]/.test(text) ? "ar" : "en");
