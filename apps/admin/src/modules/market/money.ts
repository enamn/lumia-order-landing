// Money for the restaurants' orders. Amounts are whole "minor units": 1/100 of the currency for AED, SAR and QAR, 1/1000 for OMR, BHD and KWD.
// Never use floating point for sums: add and compare minor units, and only convert at the edges (typing a price, showing a price).
export const CURRENCY_DECIMALS: Record<string, 2 | 3> = { AED: 2, SAR: 2, QAR: 2, OMR: 3, BHD: 3, KWD: 3 };
export const decimalsOf = (currency: string | null | undefined): 2 | 3 => CURRENCY_DECIMALS[(currency ?? "").toUpperCase()] ?? 2;
export const scaleOf = (currency: string | null | undefined) => (decimalsOf(currency) === 3 ? 1000 : 100);

// 12.5 AED -> 1250, 1.275 KWD -> 1275. Rounds to the nearest minor unit (half up), safely for values like 1.005.
export function toMinor(amount: number, currency: string | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  const scale = scaleOf(currency), sign = amount < 0 ? -1 : 1;
  return sign * Math.round(Number((Math.abs(amount) * scale).toPrecision(12)));
}
export const fromMinor = (minor: number, currency: string | null | undefined) => minor / scaleOf(currency);

// "12" for a whole amount, otherwise every decimal of the currency: "12.50", "2.450".
export function amountText(minor: number, currency: string | null | undefined): string {
  const d = decimalsOf(currency), scale = scaleOf(currency), neg = minor < 0, abs = Math.abs(minor);
  const whole = Math.trunc(abs / scale), frac = abs % scale;
  return `${neg ? "-" : ""}${frac === 0 ? whole : `${whole}.${String(frac).padStart(d, "0")}`}`;
}
/** "AED 12.50" with the ISO code (symbols are ambiguous across the GCC). */
export const formatMoney = (minor: number, currency: string | null | undefined, locale = "en-US") => {
  const d = decimalsOf(currency), cur = (currency ?? "AED").toUpperCase(), v = fromMinor(minor, currency);
  return `${cur} ${v.toLocaleString(locale, { minimumFractionDigits: Number.isInteger(v) ? 0 : d, maximumFractionDigits: d })}`;
};

// ---- what the dashboard shows (screens only: WhatsApp messages, emails and invoices keep the ISO code) ----
// The UAE dirham sign (U+20C3, drawn by the "Dirham" font) and the Saudi riyal sign (U+20C1); the other Gulf currencies have no sign of their own in English, so their ISO code shows.
export const currencySign = (currency: string | null | undefined): string => { const c = (currency ?? "AED").toUpperCase(); return c === "AED" ? "\u20C3" : c === "SAR" ? "\u20C1" : c; };
const isSymbol = (currency: string | null | undefined) => ["AED", "SAR"].includes((currency ?? "AED").toUpperCase());
/** The sign (or code) in front of an amount that is already formatted. */
export const withSign = (currency: string | null | undefined, amount: string) => `${currencySign(currency)}${isSymbol(currency) ? "\u2009" : " "}${amount}`;
/** A number in the currency's own units, as the dashboard shows it: no decimals when whole (209), otherwise at least two and never more than the currency has (12.90, 2.345). */
export function amountUi(value: number, currency: string | null | undefined, locale = "en-US"): string {
  const d = decimalsOf(currency), scale = d === 3 ? 1000 : 100, v = Math.round(value * scale) / scale;
  return v.toLocaleString(locale, Number.isInteger(v) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: d });
}
/** "⃁149", "OMR 12.90": the sign (or code) and the amount. */
export const moneyUi = (value: number, currency: string | null | undefined, locale = "en-US") => withSign(currency, amountUi(value, currency, locale));
export const formatMoneyUi = (minor: number, currency: string | null | undefined, locale = "en-US") => moneyUi(fromMinor(minor, currency), currency, locale);

// Reads a typed price, including Arabic-Indic digits and the Arabic decimal and thousands separators. Returns null when it is ambiguous or not a price.
export function parseAmount(input: string): number | null {
  let t = input.trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0));
  t = t.replace(/[٬\s]/g, "").replace(/٫/g, ".").replace(/[A-Za-z؀-ۿ]/g, "");
  if (!/^\d[\d,.]*$/.test(t)) return null;
  const dots = (t.match(/\./g) ?? []).length, commas = (t.match(/,/g) ?? []).length;
  if (dots > 1 && commas > 0) return null;
  if (dots === 1 && commas >= 1) { const lastDot = t.lastIndexOf("."), lastComma = t.lastIndexOf(","); t = lastDot > lastComma ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", "."); }
  else if (commas === 1 && dots === 0) { const [a, b] = t.split(","); t = b!.length === 3 && a!.length <= 3 && a !== "0" ? a + b! : a + "." + b; } // "1,500" is a thousand five hundred; "1,5" is one and a half
  else if (commas > 1) t = t.replace(/,/g, "");
  else if (dots > 1) { const parts = t.split("."); if (!parts.slice(1).every(p => p.length === 3)) return null; t = parts.join(""); }
  const n = Number(t); return Number.isFinite(n) && n >= 0 ? n : null;
}
