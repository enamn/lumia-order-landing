import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { isCountryCode, marketOf } from "../market/countries";
import { marketFlags } from "../market/service";
import { PLAN_IDS, TOPUP_IDS, UAE_BOOK, type PriceBook, type PlanId } from "./plans";

// What a restaurant is charged is decided here and nowhere else: the UAE price list from code, every other market only from prices a super admin approved.
// Nothing is invented for a market without prices, and nothing is converted from another currency.
export const itemsOf = () => [...PLAN_IDS.flatMap(p => (["monthly", "yearly"] as const).map(i => `plan:${p}:${i}`)), "branch:monthly", "branch:yearly", ...TOPUP_IDS.map(t => `topup:${t}`)];
// Currencies the payment account can really charge, checked with the provider: set STRIPE_ENABLED_CURRENCIES once a currency is confirmed (default: AED only).
export const enabledCurrencies = () => new Set((process.env.STRIPE_ENABLED_CURRENCIES ?? "AED").split(",").map(c => c.trim().toUpperCase()).filter(Boolean));
// Stripe takes three-decimal currencies (OMR, BHD, KWD) only in steps of 10 minor units: anything else is refused, never rounded.
export const providerAmountOk = (amountMinor: number, currency: string) => Number.isInteger(amountMinor) && amountMinor >= 0 && (marketOfCurrency(currency)?.currencyDecimals === 3 ? amountMinor % 10 === 0 : true);
const CURRENCY_COUNTRY: Record<string, string> = { AED: "AE", SAR: "SA", OMR: "OM", BHD: "BH", QAR: "QA", KWD: "KW" };
const marketOfCurrency = (currency: string) => (CURRENCY_COUNTRY[currency] ? marketOf(CURRENCY_COUNTRY[currency]) : undefined);

export async function priceBookFor(country: string, now = new Date()): Promise<PriceBook> {
  if (!isCountryCode(country)) throw new AppError("COUNTRY_NOT_SUPPORTED", "This country is not supported.", 422);
  const flags = await marketFlags(country);
  if (!flags.paidActivationEnabled) throw new AppError("MARKET_NOT_ENABLED", "Paid plans are not open in this country yet.", 409);
  if (country === "AE") return UAE_BOOK;
  const market = marketOf(country), rows = await db.marketPrice.findMany({ where: { country, status: "ACTIVE", effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" } });
  const latest = new Map<string, (typeof rows)[number]>(); for (const r of rows) if (!latest.has(r.item)) latest.set(r.item, r);
  const missing = itemsOf().filter(i => !latest.has(i));
  if (missing.length) throw new AppError("MARKET_PRICE_NOT_CONFIGURED", "Plan prices for this country are not available yet.", 409, { missing });
  const currencies = new Set([...latest.values()].map(r => r.currency));
  if (currencies.size !== 1 || !currencies.has(market.currency)) throw new AppError("CURRENCY_MISMATCH", "The prices for this country are not all in its currency.", 409);
  if (!enabledCurrencies().has(market.currency)) throw new AppError("BILLING_CURRENCY_UNAVAILABLE", `Payments in ${market.currency} are not enabled on the payment account yet.`, 409);
  const unit = (i: string) => latest.get(i)!.amountMinor / (market.currencyDecimals === 3 ? 1000 : 100);
  return {
    country, currency: market.currency, decimals: market.currencyDecimals,
    plans: Object.fromEntries(PLAN_IDS.map(p => [p, { monthly: unit(`plan:${p}:monthly`), yearly: unit(`plan:${p}:yearly`) }])) as Record<PlanId, { monthly: number; yearly: number }>,
    extraBranch: { monthly: unit("branch:monthly"), yearly: unit("branch:yearly") },
    topups: { orders50: unit("topup:orders50"), orders200: unit("topup:orders200") },
    terminal: null, // hardware is sold only where terminal sales are switched on and priced (the UAE today)
  };
}
export async function priceBookForBusiness(businessId: string, now = new Date()) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { countryCode: true } });
  return priceBookFor(b.countryCode, now);
}
// The same, but "no prices yet" is an answer, not an error: used to show what can be bought.
export async function priceBookOrNull(businessId: string, now = new Date()): Promise<{ book: PriceBook | null; code: string | null }> {
  try { return { book: await priceBookForBusiness(businessId, now), code: null }; } catch (e) { if (e instanceof AppError) return { book: null, code: e.code }; throw e; }
}

// ---- super admin: enter and approve prices ----
const priceSchema = z.object({
  country: z.string().length(2).toUpperCase(), item: z.string().refine(i => itemsOf().includes(i), "Unknown item."), amount: z.number().positive().max(1_000_000),
  status: z.enum(["DRAFT", "ACTIVE"]), effectiveFrom: z.string().datetime(), version: z.string().trim().min(1).max(40), providerPriceRef: z.string().trim().max(80).optional(),
}).strict();
export async function setMarketPrice(actorId: string, input: unknown) {
  const b = priceSchema.parse(input);
  if (!isCountryCode(b.country) || b.country === "AE") throw new AppError("COUNTRY_NOT_SUPPORTED", "Prices are entered for Saudi Arabia, Oman, Bahrain, Qatar and Kuwait. The UAE list is in code.", 422);
  const market = marketOf(b.country), scale = market.currencyDecimals === 3 ? 1000 : 100, amountMinor = Math.round(b.amount * scale);
  if (Math.abs(amountMinor / scale - b.amount) > 1e-9) throw new AppError("INVALID_AMOUNT", `Use at most ${market.currencyDecimals} decimal places for ${market.currency}.`, 422);
  if (!providerAmountOk(amountMinor, market.currency)) throw new AppError("INVALID_AMOUNT", `${market.currency} amounts must end in 0 in the last decimal place (the payment provider does not take smaller steps).`, 422);
  const row = await db.marketPrice.create({ data: { country: b.country, item: b.item, currency: market.currency, amountMinor, status: b.status, effectiveFrom: new Date(b.effectiveFrom), version: b.version, providerPriceRef: b.providerPriceRef ?? null, createdBy: actorId } });
  await db.taxAudit.create({ data: { actorId, entity: "MarketPrice", entityId: row.id, action: `price.${b.status.toLowerCase()}`, reason: `${b.country} ${b.item} ${b.amount} ${market.currency} v${b.version}`, after: { country: b.country, item: b.item, amountMinor, currency: market.currency, effectiveFrom: b.effectiveFrom } } });
  return row;
}
export const listMarketPrices = () => db.marketPrice.findMany({ orderBy: [{ country: "asc" }, { item: "asc" }, { effectiveFrom: "desc" }], take: 300 });
