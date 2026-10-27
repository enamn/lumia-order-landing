import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { amountText } from "@/modules/market/money";
import type { Lang } from "@/modules/orders/draft";
import { menuLabel, productName, type MenuProduct } from "./menu-presentation";

export const CARD_DESIGN_VERSION = "menu-card-v2";
export type CardInput = { businessName: string; item: MenuProduct; locale: Lang; currency: string };
export function cardFingerprint(input: CardInput) {
  return createHash("sha256").update(JSON.stringify([CARD_DESIGN_VERSION, input.businessName, input.item.itemId, productName(input.item, input.locale), input.locale === "ar" ? input.item.categoryAr || input.item.category : input.item.category || input.item.categoryAr, input.item.priceMinor, input.currency, input.locale])).digest("hex");
}
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
export function cardNameLines(value: string, limit: number) {
  const words = value.trim().split(/\s+/), lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && `${current} ${word}`.length > limit) { lines.push(current); current = word; } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  if (lines.length > 3) return [...lines.slice(0, 2), menuLabel(lines.slice(2).join(" "), limit)];
  return lines.map(line => menuLabel(line, limit));
}
export async function renderMenuCard(input: CardInput): Promise<Buffer> {
  const rtl = input.locale === "ar";
  const name = productName(input.item, input.locale), lines = cardNameLines(name, rtl ? 29 : 32);
  const category = menuLabel((rtl ? input.item.categoryAr || input.item.category : input.item.category || input.item.categoryAr) || (rtl ? "قائمة الطعام" : "Our menu"), 36);
  const x = rtl ? 968 : 56, anchor = rtl ? "end" : "start", size = name.length > 45 ? 52 : 66;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640" viewBox="0 0 1024 640"><rect width="1024" height="640" fill="#f5f2e9"/><circle cx="1010" cy="-50" r="190" fill="#e1e8d8"/><g font-family="Noto Sans Arabic" fill="#183c32"><text x="${x}" y="76" text-anchor="${anchor}" font-size="28">${xml(menuLabel(input.businessName, 50))}</text><line x1="56" y1="106" x2="968" y2="106" stroke="#d5dbcd" stroke-width="2"/><rect x="${rtl ? 590 : 56}" y="133" width="378" height="54" rx="27" fill="#e1e8d8"/><text x="${rtl ? 944 : 80}" y="168" text-anchor="${anchor}" font-size="25" fill="#637a67">${xml(category)}</text>${lines.map((line, index) => `<text x="${x}" y="${274 + index * 73}" text-anchor="${anchor}" font-size="${size}">${xml(line)}</text>`).join("")}<text x="${x}" y="534" text-anchor="${anchor}" font-size="78">${xml(amountText(input.item.priceMinor, input.currency))}<tspan dx="14" font-size="28" fill="#637a67">${xml(input.currency)}</tspan></text><line x1="56" y1="566" x2="968" y2="566" stroke="#d5dbcd" stroke-width="2"/><text x="${x}" y="606" text-anchor="${anchor}" font-size="20" fill="#637a67">${rtl ? "اسحب لتشوف الأصناف" : "Swipe to explore"}</text><text x="${rtl ? 56 : 968}" y="606" text-anchor="${rtl ? "start" : "end"}" font-size="18" fill="#637a67">LUMIA ORDER</text></g></svg>`;
  return new Resvg(svg, { font: { fontFiles: [join(process.cwd(), "public/fonts/noto-sans-arabic-regular.ttf")], loadSystemFonts: false, defaultFontFamily: "Noto Sans Arabic" } }).render().asPng();
}
