// The six GCC markets Lumia Order supports. Static facts about each country live here (shared by the server and the browser); what is switched on
// commercially (registration, paid plans, terminals ...) is a per-market flag in the database, see ./service.ts.
export const GCC_CODES = ["AE", "SA", "OM", "BH", "QA", "KW"] as const;
export type CountryCode = (typeof GCC_CODES)[number];

export interface MarketInfo {
  code: CountryCode; nameEn: string; nameAr: string; flag: string; dial: string; label: string;
  currency: string; currencyDecimals: 2 | 3; timezone: string;
  /** Local standard VAT, for reference only. It does not decide what Lumia charges: see the tax policy. */
  localVatRate: number | null; localVatImplemented: boolean;
  /** Paid subscriptions only for businesses with a verified local VAT registration. */
  requiresVerifiedVatForSaas: boolean;
  /** Name of the first-level administrative division shown in address forms. */
  regionLabelEn: string; regionLabelAr: string;
  /** Digit groups for the phone field (national number) and an example. */
  groups: number[]; ex: string;
  configVersion: string;
}
// One switch for the VAT requirement in Saudi Arabia, Oman and Bahrain (verified VAT number to sign up and go live). NEXT_PUBLIC_VAT_GATE=off turns it off everywhere: those countries then behave like Qatar and Kuwait. It is a build-time setting, so server and browser agree.
const VAT_GATE = process.env.NEXT_PUBLIC_VAT_GATE !== "off";
export const MARKETS: Record<CountryCode, MarketInfo> = {
  AE: { code: "AE", nameEn: "United Arab Emirates", nameAr: "الإمارات العربية المتحدة", flag: "🇦🇪", dial: "+971", label: "UAE", currency: "AED", currencyDecimals: 2, timezone: "Asia/Dubai", localVatRate: 0.05, localVatImplemented: true, requiresVerifiedVatForSaas: false, regionLabelEn: "Emirate", regionLabelAr: "الإمارة", groups: [2, 3, 4], ex: "50 123 4567", configVersion: "2026-10-06" },
  SA: { code: "SA", nameEn: "Saudi Arabia", nameAr: "المملكة العربية السعودية", flag: "🇸🇦", dial: "+966", label: "Saudi", currency: "SAR", currencyDecimals: 2, timezone: "Asia/Riyadh", localVatRate: 0.15, localVatImplemented: true, requiresVerifiedVatForSaas: VAT_GATE, regionLabelEn: "Region", regionLabelAr: "المنطقة", groups: [2, 3, 4], ex: "50 123 4567", configVersion: "2026-10-06" },
  OM: { code: "OM", nameEn: "Oman", nameAr: "سلطنة عُمان", flag: "🇴🇲", dial: "+968", label: "Omani", currency: "OMR", currencyDecimals: 3, timezone: "Asia/Muscat", localVatRate: 0.05, localVatImplemented: true, requiresVerifiedVatForSaas: VAT_GATE, regionLabelEn: "Governorate", regionLabelAr: "المحافظة", groups: [4, 4], ex: "9212 3456", configVersion: "2026-10-06" },
  BH: { code: "BH", nameEn: "Bahrain", nameAr: "مملكة البحرين", flag: "🇧🇭", dial: "+973", label: "Bahraini", currency: "BHD", currencyDecimals: 3, timezone: "Asia/Bahrain", localVatRate: 0.1, localVatImplemented: true, requiresVerifiedVatForSaas: VAT_GATE, regionLabelEn: "Governorate", regionLabelAr: "المحافظة", groups: [4, 4], ex: "3600 1234", configVersion: "2026-10-06" },
  QA: { code: "QA", nameEn: "Qatar", nameAr: "دولة قطر", flag: "🇶🇦", dial: "+974", label: "Qatari", currency: "QAR", currencyDecimals: 2, timezone: "Asia/Qatar", localVatRate: null, localVatImplemented: false, requiresVerifiedVatForSaas: false, regionLabelEn: "Municipality", regionLabelAr: "البلدية", groups: [4, 4], ex: "3312 3456", configVersion: "2026-10-06" },
  KW: { code: "KW", nameEn: "Kuwait", nameAr: "دولة الكويت", flag: "🇰🇼", dial: "+965", label: "Kuwaiti", currency: "KWD", currencyDecimals: 3, timezone: "Asia/Kuwait", localVatRate: null, localVatImplemented: false, requiresVerifiedVatForSaas: false, regionLabelEn: "Governorate", regionLabelAr: "المحافظة", groups: [4, 4], ex: "5012 3456", configVersion: "2026-10-06" },
};
export const isCountryCode = (v: unknown): v is CountryCode => typeof v === "string" && (GCC_CODES as readonly string[]).includes(v);
export const marketOf = (code: string | null | undefined): MarketInfo => MARKETS[isCountryCode(code) ? code : "AE"];
export const marketFromDial = (e164: string): MarketInfo | undefined => Object.values(MARKETS).find(m => e164.startsWith(m.dial));
