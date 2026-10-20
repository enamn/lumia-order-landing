import { db } from "@/server/db";
import { visitorCountry } from "@/server/visitor-country";
import { GCC_CODES, MARKETS, isCountryCode } from "@/modules/market/countries";
import { PLAN_IDS } from "@/modules/billing/plans";
import { TERMINAL_REQUIRED, uaeBook } from "@/modules/billing/pricing";
import { marketFlags } from "@/modules/market/service";
export const dynamic = "force-dynamic";

// The plan prices the landing page shows for a visitor: their country's approved prices when the visitor is in the Gulf and the prices exist, otherwise the UAE prices in AED.
// Only the country is looked up (from the IP, in memory); nothing is stored.
const allowed = () => { // the landing page's own address; while developing, the landing page may run on any local port (Vite moves to the next one when 5173 is busy)
  const fixed = new Set([(process.env.NEXT_PUBLIC_MARKETING_URL ?? "").replace(/\/$/, "")].filter(Boolean));
  return { has: (o: string) => fixed.has(o) || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(o)) };
};
const cors = (origin: string | null) => ({ "Access-Control-Allow-Origin": origin ?? "", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" });

export function OPTIONS(request: Request) { const origin = request.headers.get("origin"); return new Response(null, { status: 204, headers: origin && allowed().has(origin) ? cors(origin) : {} }); }

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !allowed().has(origin)) return new Response(null, { status: 403 });
  const detected = visitorCountry(request.headers);
  const asked = new URL(request.url).searchParams.get("country")?.toUpperCase() ?? "";
  const country = (GCC_CODES as readonly string[]).includes(asked) ? asked : detected;
  const book = await uaeBook(), uae = { detected: country, country: "AE", countryName: MARKETS.AE.nameEn, currency: "AED", decimals: 2, local: false, paidOpen: true, plans: book.plans, terminal: { currency: "AED", decimals: 2, ...book.terminal! } };
  let body: object = uae;
  if (isCountryCode(country) && country !== "AE") {
    const m = MARKETS[country], scale = m.currencyDecimals === 3 ? 1000 : 100;
    const rows = await db.marketPrice.findMany({ where: { country, status: "ACTIVE", effectiveFrom: { lte: new Date() } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] });
    const latest = new Map<string, number>(); for (const r of rows) if (!latest.has(r.item) && r.currency === m.currency) latest.set(r.item, r.amountMinor / scale);
    const plans = Object.fromEntries(PLAN_IDS.map(p => [p, { monthly: latest.get(`plan:${p}:monthly`), yearly: latest.get(`plan:${p}:yearly`) }]));
    if (PLAN_IDS.every(p => plans[p]!.monthly && plans[p]!.yearly)) {
      const flags = await marketFlags(country), u = (i: string) => latest.get(i)!;
      // Terminals are priced per country too; where they are not priced (or not on sale yet) the landing page says so instead of showing another country's price.
      const terminal = flags.terminalSalesEnabled && TERMINAL_REQUIRED.every(i => latest.has(i)) ? { currency: m.currency, decimals: m.currencyDecimals, yearly: { starter: u("terminal:yearly:starter"), plus: u("terminal:yearly:plus"), pro: u("terminal:yearly:pro") }, monthly: u("terminal:monthly"), extra: u("terminal:extra"), ...(latest.has("terminal:regular") ? { regular: u("terminal:regular") } : {}) } : null;
      body = { detected: country, country, countryName: m.nameEn, currency: m.currency, decimals: m.currencyDecimals, local: true, paidOpen: flags.paidActivationEnabled, plans, terminal };
    }
    else body = { ...uae, detected: country, countryName: m.nameEn }; // a Gulf visitor whose country has no approved prices yet: the UAE prices, in AED
  }
  return Response.json({ data: body }, { headers: { ...cors(origin), "Cache-Control": "private, max-age=600" } });
}
