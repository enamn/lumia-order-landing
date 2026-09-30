// Supported sign-in countries. Same table as the design (Lumia Order Pre-Dashboard Flow v2); used by the UI and the server.
export interface Country { flag: string; name: string; dial: string; len: number; groups: number[]; ex: string; re: RegExp; label: string }
export const COUNTRIES: Country[] = [
  { flag: "🇦🇪", name: "United Arab Emirates", dial: "+971", len: 9, groups: [2, 3, 4], ex: "50 123 4567", re: /^5[024568]\d{7}$/, label: "UAE" },
  { flag: "🇸🇦", name: "Saudi Arabia", dial: "+966", len: 9, groups: [2, 3, 4], ex: "50 123 4567", re: /^5\d{8}$/, label: "Saudi" },
  { flag: "🇶🇦", name: "Qatar", dial: "+974", len: 8, groups: [4, 4], ex: "3312 3456", re: /^[3567]\d{7}$/, label: "Qatari" },
  { flag: "🇰🇼", name: "Kuwait", dial: "+965", len: 8, groups: [4, 4], ex: "5012 3456", re: /^[569]\d{7}$/, label: "Kuwaiti" },
  { flag: "🇧🇭", name: "Bahrain", dial: "+973", len: 8, groups: [4, 4], ex: "3600 1234", re: /^3\d{7}$/, label: "Bahraini" },
  { flag: "🇴🇲", name: "Oman", dial: "+968", len: 8, groups: [4, 4], ex: "9212 3456", re: /^[79]\d{7}$/, label: "Omani" },
  { flag: "🇪🇬", name: "Egypt", dial: "+20", len: 10, groups: [3, 3, 4], ex: "100 123 4567", re: /^1[0125]\d{8}$/, label: "Egyptian" },
  { flag: "🇮🇳", name: "India", dial: "+91", len: 10, groups: [5, 5], ex: "98765 43210", re: /^[6-9]\d{9}$/, label: "Indian" },
  { flag: "🇬🇧", name: "United Kingdom", dial: "+44", len: 10, groups: [4, 6], ex: "7400 123456", re: /^7\d{9}$/, label: "UK" },
];
export function countryOf(e164: string) { return COUNTRIES.find(c => e164.startsWith(c.dial) && c.re.test(e164.slice(c.dial.length))); }
export const isSupportedMobile = (e164: string) => Boolean(countryOf(e164));
export function groupDigits(digits: string, groups: number[]) { const out: string[] = []; let i = 0; for (const n of groups) { if (i >= digits.length) break; out.push(digits.slice(i, i + n)); i += n; } return out.join(" "); }
// "+971 50 XXX 4567" style mask used on the OTP and WhatsApp screens.
export function maskPhone(e164: string) {
  const c = COUNTRIES.find(x => e164.startsWith(x.dial)); if (!c) return e164;
  const parts = groupDigits(e164.slice(c.dial.length), c.groups).split(" ");
  return c.dial + " " + parts.map((g, i) => (i === 0 || i === parts.length - 1) ? g : "X".repeat(g.length)).join(" ");
}
