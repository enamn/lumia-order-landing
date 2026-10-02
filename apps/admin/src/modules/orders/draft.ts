import { createHash } from "node:crypto";

// Pure order logic: the AI only proposes menu IDs and quantities. Names, prices and totals always come from the restaurant's own menu.
export type Lang = "en" | "ar";
export type Fulfillment = "delivery" | "pickup";
export interface MenuEntry { index: string; itemId: string; name: string; nameAr: string; priceMinor: number; available: boolean }
export interface StoredLine { itemId: string; quantity: number; notes: string }
export interface StoredDraft { items: StoredLine[]; fulfillment: Fulfillment | null; address: string; shownKey: string; updatedAt: string }
export interface ModelDraft { items: { id: string; quantity: number; notes: string }[]; fulfillment: Fulfillment | null; address: string; confirmed: boolean }
export interface PricedLine { itemId: string; name: string; nameAr: string; quantity: number; unitMinor: number; totalMinor: number; notes: string }
export interface Resolved { lines: PricedLine[]; removed: string[]; fulfillment: Fulfillment | null; address: string; subtotalMinor: number }
export interface Options { delivery: boolean; pickup: boolean; minimumMinor: number }

export const DRAFT_TTL_MS = 12 * 3600 * 1000;
const label = (e: { name: string; nameAr: string }, lang: Lang) => (lang === "ar" ? e.nameAr || e.name : e.name || e.nameAr);

export function resolveDraft(menu: MenuEntry[], d: Pick<ModelDraft, "items" | "fulfillment" | "address">, options: Options): Resolved {
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
  return { lines, removed: [...new Set(removed)], fulfillment, address: fulfillment === "delivery" ? d.address.trim() : "", subtotalMinor: lines.reduce((s, l) => s + l.totalMinor, 0) };
}

export const draftKey = (r: Pick<Resolved, "lines" | "fulfillment" | "address">) => createHash("sha256").update(JSON.stringify([r.lines.map(l => [l.itemId, l.quantity, l.notes]), r.fulfillment, r.address])).digest("hex").slice(0, 16);
export const isComplete = (r: Resolved) => r.lines.length > 0 && r.fulfillment !== null && (r.fulfillment === "pickup" || r.address.length >= 3);
export const meetsMinimum = (r: Resolved, o: Options) => r.subtotalMinor >= o.minimumMinor;
export const money = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

const T = {
  en: { order: "🧾 Your order", total: "Total", pickup: "Pickup from the restaurant", delivery: "Delivery to", payment: "Pay cash on delivery or pickup", confirm: "Reply YES to confirm your order.", minimum: (m: string) => `The minimum order is ${m} AED.`, removed: (n: string) => `Sorry, ${n} is not available right now, so I left it out.`, placed: (no: string, t: string, how: string) => `✅ Order #${no} received. Total ${t} AED, ${how}. We'll message you as soon as the restaurant confirms it.`, how: { pickup: "pickup", delivery: "delivery" } },
  ar: { order: "🧾 طلبك", total: "المجموع", pickup: "استلام من المطعم", delivery: "التوصيل إلى", payment: "الدفع نقداً عند الاستلام أو التوصيل", confirm: "للتأكيد أرسل «نعم».", minimum: (m: string) => `الحد الأدنى للطلب ${m} درهم.`, removed: (n: string) => `عذراً، ${n} غير متوفر حالياً فلم أضفه.`, placed: (no: string, t: string, how: string) => `✅ تم استلام طلبك رقم ${no}. المجموع ${t} درهم، ${how}. سنراسلك فور تأكيد المطعم.`, how: { pickup: "استلام", delivery: "توصيل" } },
};

export function summaryText(r: Resolved, lang: Lang, options: Options): string {
  const t = T[lang]; const out = [t.order];
  for (const l of r.lines) out.push(`${l.quantity} × ${label(l, lang)}${l.notes ? ` (${l.notes})` : ""} — ${money(l.totalMinor)} AED`);
  out.push(`${t.total}: ${money(r.subtotalMinor)} AED`);
  if (r.fulfillment === "pickup") out.push(t.pickup); else if (r.fulfillment === "delivery" && r.address) out.push(`${t.delivery}: ${r.address}`);
  if (isComplete(r)) { out.push(t.payment); if (meetsMinimum(r, options)) out.push(t.confirm); else out.push(t.minimum(money(options.minimumMinor))); }
  return out.join("\n");
}
export const removedText = (names: string[], lang: Lang) => names.map(n => T[lang].removed(n)).join("\n");
export const placedText = (orderNumber: string, totalMinor: number, fulfillment: Fulfillment, lang: Lang) => T[lang].placed(orderNumber, money(totalMinor), T[lang].how[fulfillment]);
export const langOf = (text: string): Lang => (/[؀-ۿ]/.test(text) ? "ar" : "en");
