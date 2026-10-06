// Supported sign-in countries: the six GCC markets (see ../market/countries). Used by the sign-in screen and the server.
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { GCC_CODES, MARKETS, type CountryCode } from "../market/countries";
export interface Country { code: CountryCode; flag: string; name: string; nameAr: string; dial: string; len: number; groups: number[]; ex: string; label: string }
export const COUNTRIES: Country[] = GCC_CODES.map(code => { const m = MARKETS[code]; return { code, flag: m.flag, name: m.nameEn, nameAr: m.nameAr, dial: m.dial, len: m.groups.reduce((a, b) => a + b, 0), groups: m.groups, ex: m.ex, label: m.label }; });
// A mobile number is supported when libphonenumber (maintained numbering-plan data) says it is a valid mobile or fixed-line-or-mobile number of one of the six countries.
export function countryOf(e164: string): Country | undefined {
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return undefined;
  const p = parsePhoneNumberFromString(e164);
  if (!p || !p.isValid() || !p.country) return undefined;
  const type = p.getType();
  if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return undefined;
  return COUNTRIES.find(c => c.code === p.country);
}
export const isSupportedMobile = (e164: string) => Boolean(countryOf(e164));
/** The international number for what someone typed (with or without the leading 0 or the country code); undefined when it is not a valid GCC mobile. */
export function toE164(input: string, countryCode: CountryCode): string | undefined {
  const p = parsePhoneNumberFromString(input.trim(), countryCode);
  return p && countryOf(p.number) ? p.number : undefined;
}
export function groupDigits(digits: string, groups: number[]) { const out: string[] = []; let i = 0; for (const n of groups) { if (i >= digits.length) break; out.push(digits.slice(i, i + n)); i += n; } return out.join(" "); }
// "+971 50 XXX 4567" style mask used on the OTP and WhatsApp screens.
export function maskPhone(e164: string) {
  const c = COUNTRIES.find(x => e164.startsWith(x.dial)); if (!c) return e164;
  const parts = groupDigits(e164.slice(c.dial.length), c.groups).split(" ");
  return c.dial + " " + parts.map((g, i) => (i === 0 || i === parts.length - 1) ? g : "X".repeat(g.length)).join(" ");
}
