import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { setMarketFlags } from "../src/modules/market/service";
import { listMarketPrices, priceBookFor, priceBookForBusiness, providerAmountOk, setMarketPrice, itemsOf } from "../src/modules/billing/pricing";
import { quoteRenewal, quoteSignup, UAE_BOOK } from "../src/modules/billing/plans";
import { startCheckout } from "../src/modules/billing/service";
import { saveBillingTax, reviewVat } from "../src/modules/tax/service";
const enabled = process.env.RUN_DB_TESTS === "true";
const past = new Date(Date.now() - 86_400_000).toISOString(), future = new Date(Date.now() + 5 * 86_400_000).toISOString();

describe("what the payment provider accepts", () => {
  it("takes three-decimal currencies only in steps of 10, two-decimal ones as they are", () => {
    expect(providerAmountOk(12340, "KWD")).toBe(true); expect(providerAmountOk(12345, "KWD")).toBe(false); expect(providerAmountOk(12345, "OMR")).toBe(false); expect(providerAmountOk(12345, "SAR")).toBe(true); expect(providerAmountOk(1.5, "AED")).toBe(false);
  });
  it("the UAE list stays as approved, software-only signup has no terminal line", () => {
    expect(quoteSignup("plus", "yearly", 0, 0, UAE_BOOK).lines.map(l => l.name)).toEqual(["Lumia Order Plus (yearly)"]);
    expect(quoteSignup("plus", "yearly", 1, 0, UAE_BOOK).lines.map(l => l.unitMinor)).toEqual([249000, 49900]);
    expect(() => quoteSignup("plus", "yearly", 1, 0, { ...UAE_BOOK, terminal: null })).toThrow("TERMINAL_UNAVAILABLE");
  });
});

describe.skipIf(!enabled)("market prices", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let admin: string, saOwner: string, sa: string, kwOwner: string, kw: string, aeOwner: string, ae: string; let calls: any[];
  const user = async (prefix: string, name: string) => (await db.user.create({ data: { name, email: `${name}-${suffix}@test.invalid`, phoneNumber: `${prefix}${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-7)}`, phoneNumberVerified: true } })).id;
  const setAll = async (country: string, amount: (item: string) => number, status: "DRAFT" | "ACTIVE" = "ACTIVE", from = past) => { for (const item of itemsOf()) await setMarketPrice(admin, { country, item, amount: amount(item), status, effectiveFrom: from, version: "t1" }); };
  beforeAll(async () => {
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.APP_URL = "https://app.test";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { const path = new URL(url).pathname; calls.push({ path, body: JSON.parse(String(init.body)) }); return Response.json({ id: "cs_new", clientSecret: "cs_s", publishableKey: "pk_x", customerId: "cus_1" }); }));
    admin = await user("+9715", "adm"); saOwner = await user("+9665", "sa"); kwOwner = await user("+9655", "kw"); aeOwner = await user("+9715", "ae");
    sa = (await createBusiness(saOwner, { name: "Riyadh Prices", locationName: "Main" }, "t")).id; kw = (await createBusiness(kwOwner, { name: "Kuwait Prices", locationName: "Main" }, "t")).id; ae = (await createBusiness(aeOwner, { name: "Dubai Prices", locationName: "Main" }, "t")).id;
    calls = [];
  });
  afterAll(async () => { delete process.env.STRIPE_ENABLED_CURRENCIES; await setMarketFlags(admin, "SA", { paidActivationEnabled: false }, "test clean-up"); await setMarketFlags(admin, "KW", { paidActivationEnabled: false }, "test clean-up"); vi.unstubAllGlobals(); await db.$disconnect(); });

  it("the UAE uses its approved list; other markets cannot sell until they are switched on, priced and the currency is enabled", async () => {
    expect((await priceBookForBusiness(ae)).currency).toBe("AED");
    await expect(priceBookForBusiness(sa)).rejects.toMatchObject({ code: "MARKET_NOT_ENABLED" });
    await setMarketFlags(admin, "SA", { paidActivationEnabled: true }, "prices approved for the test");
    await expect(priceBookForBusiness(sa)).rejects.toMatchObject({ code: "MARKET_PRICE_NOT_CONFIGURED" });
    await setAll("SA", () => 100, "DRAFT"); await expect(priceBookFor("SA")).rejects.toMatchObject({ code: "MARKET_PRICE_NOT_CONFIGURED" }); // drafts are never used
    await setAll("SA", () => 100, "ACTIVE", future); await expect(priceBookFor("SA")).rejects.toMatchObject({ code: "MARKET_PRICE_NOT_CONFIGURED" }); // not in force yet
    await setAll("SA", i => (i.startsWith("plan:starter") ? 199 : i.startsWith("plan:plus") ? 299 : i.startsWith("plan:pro") ? 499 : i.startsWith("branch") ? 129 : 99));
    await expect(priceBookFor("SA")).rejects.toMatchObject({ code: "BILLING_CURRENCY_UNAVAILABLE" }); // the payment account is not confirmed for SAR yet
    process.env.STRIPE_ENABLED_CURRENCIES = "AED,SAR";
    const book = await priceBookFor("SA"); expect(book).toMatchObject({ currency: "SAR", decimals: 2, terminal: null, plans: { plus: { monthly: 299 } } });
    expect(quoteRenewal("plus", "monthly", 0, 0, book).totalMinor).toBe(29900); expect(quoteRenewal("pro", "yearly", 2, 0, book).totalMinor).toBe(49900 + 2 * 12900);
  });
  it("amounts are checked: decimals of the currency, steps of 10 for OMR, BHD and KWD, no UAE prices through the editor", async () => {
    await expect(setMarketPrice(admin, { country: "KW", item: "plan:plus:monthly", amount: 12.3456, status: "DRAFT", effectiveFrom: past, version: "x" })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(setMarketPrice(admin, { country: "KW", item: "plan:plus:monthly", amount: 12.345, status: "DRAFT", effectiveFrom: past, version: "x" })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await setMarketPrice(admin, { country: "KW", item: "plan:plus:monthly", amount: 12.34, status: "DRAFT", effectiveFrom: past, version: "x" });
    await expect(setMarketPrice(admin, { country: "AE", item: "plan:plus:monthly", amount: 1, status: "ACTIVE", effectiveFrom: past, version: "x" })).rejects.toMatchObject({ code: "COUNTRY_NOT_SUPPORTED" });
    await expect(setMarketPrice(admin, { country: "KW", item: "plan:gold:monthly", amount: 1, status: "ACTIVE", effectiveFrom: past, version: "x" })).rejects.toBeTruthy();
    expect((await listMarketPrices()).some(p => p.country === "KW" && p.amountMinor === 12340)).toBe(true);
  });
  it("a Kuwaiti restaurant buys software only, in KWD with three decimals, and cannot order a terminal", async () => {
    await setMarketFlags(admin, "KW", { paidActivationEnabled: true }, "prices approved for the test"); process.env.STRIPE_ENABLED_CURRENCIES = "AED,SAR,KWD";
    await setAll("KW", i => (i.startsWith("plan:plus") ? 24.9 : i.startsWith("plan:starter") ? 14.9 : i.startsWith("plan:pro") ? 39.9 : i.startsWith("branch") ? 9.9 : 7.9));
    expect((await priceBookFor("KW"))).toMatchObject({ currency: "KWD", decimals: 3 });
    calls = []; const r = await startCheckout(kwOwner, kw, { plan: "plus", billing: "monthly", terminals: 0 });
    expect(r).toMatchObject({ sessionId: "cs_new" }); const body = calls.find(c => c.path === "/internal/billing/checkout")!.body;
    expect(body).toMatchObject({ currency: "KWD", lines: [{ name: "Lumia Order Plus (monthly)", unitMinor: 24900, quantity: 1 }], metadata: { currency: "KWD", terminals: "0", total: "24900" } }); expect(body.shippingAddress).toBeUndefined();
    await expect(startCheckout(kwOwner, kw, { plan: "plus", billing: "monthly", terminals: 1, address: "Salmiya, Kuwait" })).rejects.toMatchObject({ code: "TERMINAL_UNAVAILABLE" });
  });
  it("a Saudi restaurant cannot start checkout until its VAT registration is verified, whatever the prices", async () => {
    await expect(startCheckout(saOwner, sa, { plan: "plus", billing: "monthly", terminals: 0 })).rejects.toMatchObject({ code: "VAT_REGISTRATION_REQUIRED" });
    await saveBillingTax(saOwner, sa, { legalName: "Riyadh Prices Co", billingAddress: { line1: "Olaya Street", city: "Riyadh" }, vatRegistered: true, vatNumber: "300555666777003" });
    await expect(startCheckout(saOwner, sa, { plan: "plus", billing: "monthly", terminals: 0 })).rejects.toMatchObject({ code: "VAT_VERIFICATION_PENDING" });
    await reviewVat(admin, sa, { decision: "VERIFIED", method: "MANUAL_DOCUMENT_REVIEW", evidenceReference: "doc-5", validTo: new Date(Date.now() + 200 * 86_400_000).toISOString(), reason: "checked" });
    calls = []; await startCheckout(saOwner, sa, { plan: "plus", billing: "monthly", terminals: 0 });
    expect(calls.find(c => c.path === "/internal/billing/checkout")!.body).toMatchObject({ currency: "SAR", lines: [{ unitMinor: 29900 }], metadata: { total: "29900", taxRate: "0" } });
  });
});
