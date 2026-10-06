import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { GCC_CODES, MARKETS, isCountryCode, type CountryCode, type MarketInfo } from "./countries";

// The per-market switches. UAE is fully on. Every other market can register, receive the sign-in code and connect WhatsApp, but paid plans and terminal sales stay
// off until their prices, tax set-up and (for terminals) logistics are approved and a super admin switches them on.
export interface MarketFlags { registrationEnabled: boolean; paidActivationEnabled: boolean; otpEnabled: boolean; whatsappOnboardingEnabled: boolean; terminalSalesEnabled: boolean }
export const FLAG_KEYS = ["registrationEnabled", "paidActivationEnabled", "otpEnabled", "whatsappOnboardingEnabled", "terminalSalesEnabled"] as const;
export const DEFAULT_FLAGS = (code: CountryCode): MarketFlags => code === "AE"
  ? { registrationEnabled: true, paidActivationEnabled: true, otpEnabled: true, whatsappOnboardingEnabled: true, terminalSalesEnabled: true }
  : { registrationEnabled: true, paidActivationEnabled: false, otpEnabled: true, whatsappOnboardingEnabled: true, terminalSalesEnabled: false };

const pick = (row: Partial<MarketFlags> & object): MarketFlags => Object.fromEntries(FLAG_KEYS.map(k => [k, Boolean((row as MarketFlags)[k])])) as unknown as MarketFlags;

// Creates the rows that are missing (with the defaults above); existing rows are never touched.
export async function ensureMarkets() {
  const have = new Set((await db.market.findMany({ select: { code: true } })).map(m => m.code));
  for (const code of GCC_CODES) if (!have.has(code)) await db.market.create({ data: { code, ...DEFAULT_FLAGS(code) } }).catch(() => undefined); // a parallel request may have created it
}
export async function marketFlags(code: string): Promise<MarketFlags> {
  if (!isCountryCode(code)) throw new AppError("COUNTRY_NOT_SUPPORTED", "This country is not supported.", 422);
  const row = await db.market.findUnique({ where: { code } });
  if (row) return pick(row);
  await ensureMarkets();
  return pick((await db.market.findUnique({ where: { code } })) ?? DEFAULT_FLAGS(code));
}
export async function requireRegistration(code: string) {
  const f = await marketFlags(code);
  if (!f.registrationEnabled) throw new AppError("MARKET_NOT_ENABLED", "Lumia Order is not open for new restaurants in this country yet.", 409);
  return f;
}

export type MarketState = "implemented" | "configured" | "live";
export interface MarketView extends MarketInfo, MarketFlags { state: MarketState; stateNote: string }
// "implemented" = the country exists in the product; "configured" = it can take registrations; "live" = customers can pay and use it.
export function stateOf(flags: MarketFlags): { state: MarketState; stateNote: string } {
  if (flags.registrationEnabled && flags.paidActivationEnabled && flags.otpEnabled) return { state: "live", stateNote: "Restaurants can register and pay." };
  if (flags.registrationEnabled) return { state: "configured", stateNote: "Restaurants can register and set up, but paid plans are not open yet." };
  return { state: "implemented", stateNote: "Supported in the product; registration is closed." };
}
export async function listMarkets(): Promise<MarketView[]> {
  await ensureMarkets();
  const rows = new Map((await db.market.findMany()).map(r => [r.code, pick(r)]));
  return GCC_CODES.map(code => { const flags = rows.get(code) ?? DEFAULT_FLAGS(code); return { ...MARKETS[code], ...flags, ...stateOf(flags) }; });
}
export async function setMarketFlags(actorId: string, code: string, patch: Partial<MarketFlags>, reason: string) {
  if (!isCountryCode(code)) throw new AppError("COUNTRY_NOT_SUPPORTED", "This country is not supported.", 422);
  if (reason.trim().length < 5) throw new AppError("REASON_REQUIRED", "Say why you are changing this market.", 422);
  const before = await marketFlags(code), after = { ...before };
  for (const k of FLAG_KEYS) if (typeof patch[k] === "boolean") after[k] = patch[k]!;
  await db.$transaction([db.market.update({ where: { code }, data: after }), db.marketChange.create({ data: { code, actorId, reason: reason.trim().slice(0, 300), before: { ...before }, after: { ...after } } })]);
  return after;
}
