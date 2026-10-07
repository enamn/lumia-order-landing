import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { setMarketFlags } from "../src/modules/market/service";
import { GET } from "../src/app/api/public/pricing/route";
import { itemsOf, terminalItemsOf, setMarketPriceList, priceBookFor } from "../src/modules/billing/pricing";
const enabled = process.env.RUN_DB_TESTS === "true";
const ORIGIN = "https://order.test";

describe.skipIf(!enabled)("prices for the landing page visitor", () => {
  beforeAll(() => { process.env.NEXT_PUBLIC_MARKETING_URL = ORIGIN; });
  afterAll(async () => { delete process.env.NEXT_PUBLIC_MARKETING_URL; await db.$disconnect(); });
  const ask = async (geo: string, query = "") => { const r = await GET(new Request(`http://app.test/api/public/pricing${query}`, { headers: { origin: ORIGIN, ...(geo ? { "x-client-geo-location": geo } : {}) } })); return { status: r.status, body: r.status === 200 ? (await r.json()).data : null }; };

  it("shows AED outside the Gulf, in the UAE and when the country is unknown; refuses other origins", async () => {
    for (const geo of ["US", "AE", "IN", ""]) expect((await ask(geo)).body).toMatchObject({ currency: "AED", local: false, country: "AE", plans: { plus: { monthly: 249, yearly: 2490 } } });
    const bad = await GET(new Request("http://app.test/api/public/pricing", { headers: { origin: "https://evil.test", "x-client-geo-location": "SA" } })); expect(bad.status).toBe(403);
  });
  it("shows a Gulf visitor's own approved prices, and AED while their country has none", async () => {
    const admin = (await db.user.create({ data: { name: "pp", email: `pp-${crypto.randomUUID().slice(0, 8)}@test.invalid`, phoneNumber: "+97150" + String(Date.now()).slice(-7), phoneNumberVerified: true } })).id;
    const version = `pub-${crypto.randomUUID().slice(0, 6)}`, past = new Date(Date.now() - 86_400_000).toISOString();
    const qa = await ask("QA"); expect(qa.body).toMatchObject({ currency: "AED", local: false, detected: "QA", countryName: "Qatar" }); // no Qatari prices yet
    await setMarketPriceList(admin, { country: "OM", status: "ACTIVE", effectiveFrom: past, version, amounts: Object.fromEntries(itemsOf().map(i => [i, i.startsWith("plan:plus:monthly") ? 24.9 : 10])) });
    const om = await ask("OM"); expect(om.body).toMatchObject({ currency: "OMR", decimals: 3, local: true, country: "OM", plans: { plus: { monthly: 24.9, yearly: 10 } } });
    expect((await ask("US", "?country=OM")).body).toMatchObject({ currency: "OMR" }); // a Gulf country can be asked for by name
    expect((await ask("US", "?country=EG")).body).toMatchObject({ currency: "AED" }); // anything else is ignored
    expect(om.body.terminal).toBeNull(); // no Omani terminal prices yet: the landing page says so
    const withTerminal = Object.fromEntries([...itemsOf(), ...terminalItemsOf()].map(i => [i, i === "terminal:monthly" ? 59.9 : i === "terminal:regular" ? 69.9 : 10]));
    await setMarketPriceList(admin, { country: "OM", status: "ACTIVE", effectiveFrom: past, version: version + "t", amounts: withTerminal });
    expect((await ask("OM")).body.terminal).toBeNull(); // priced but the market's terminal switch is still off
    await setMarketFlags(admin, "OM", { terminalSalesEnabled: true, paidActivationEnabled: true }, "test: terminals on sale in Oman");
    expect((await ask("OM")).body.terminal).toMatchObject({ currency: "OMR", decimals: 3, monthly: 59.9, regular: 69.9, extra: 10, yearly: { pro: 10 } });
    process.env.STRIPE_ENABLED_CURRENCIES = "AED,OMR";
    expect((await priceBookFor("OM")).terminal).toMatchObject({ monthly: 59.9, extra: 10 }); // the same prices are what checkout charges
    await expect(setMarketPriceList(admin, { country: "OM", status: "ACTIVE", effectiveFrom: past, version: version + "x", amounts: Object.fromEntries([...itemsOf(), "terminal:monthly"].map(i => [i, 10])) })).rejects.toMatchObject({ code: "MARKET_PRICE_NOT_CONFIGURED" }); // terminal prices go together
    delete process.env.STRIPE_ENABLED_CURRENCIES; await setMarketFlags(admin, "OM", { terminalSalesEnabled: false, paidActivationEnabled: false }, "test clean-up");
    await db.marketPrice.deleteMany({ where: { version: { startsWith: version } } });
  });
});
