import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { ensureMarkets, listMarkets, marketFlags, setMarketFlags, DEFAULT_FLAGS, stateOf } from "../src/modules/market/service";
import { MARKETS, GCC_CODES, marketFromDial } from "../src/modules/market/countries";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("market facts", () => {
  it("has the six GCC markets with the agreed currency, decimals and time zone", () => {
    expect(GCC_CODES).toEqual(["AE", "SA", "OM", "BH", "QA", "KW"]);
    expect(Object.values(MARKETS).map(m => [m.code, m.dial, m.currency, m.currencyDecimals, m.timezone])).toEqual([["AE", "+971", "AED", 2, "Asia/Dubai"], ["SA", "+966", "SAR", 2, "Asia/Riyadh"], ["OM", "+968", "OMR", 3, "Asia/Muscat"], ["BH", "+973", "BHD", 3, "Asia/Bahrain"], ["QA", "+974", "QAR", 2, "Asia/Qatar"], ["KW", "+965", "KWD", 3, "Asia/Kuwait"]]);
    expect(MARKETS.SA.requiresVerifiedVatForSaas && MARKETS.OM.requiresVerifiedVatForSaas && MARKETS.BH.requiresVerifiedVatForSaas).toBe(true);
    expect(MARKETS.AE.requiresVerifiedVatForSaas || MARKETS.QA.requiresVerifiedVatForSaas || MARKETS.KW.requiresVerifiedVatForSaas).toBe(false);
    expect(marketFromDial("+966512345678")?.code).toBe("SA");
  });
  it("describes how far each market is", () => {
    expect(stateOf(DEFAULT_FLAGS("AE")).state).toBe("live"); expect(stateOf(DEFAULT_FLAGS("SA")).state).toBe("configured"); expect(stateOf({ ...DEFAULT_FLAGS("SA"), registrationEnabled: false }).state).toBe("implemented");
  });
});

describe.skipIf(!enabled)("restaurant country", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string; const made: string[] = [];
  const phone = (n: number) => `+9665${String(Date.now() + n).slice(-8)}`;
  beforeAll(async () => { await ensureMarkets(); owner = (await db.user.create({ data: { name: "mk", email: `mk-${suffix}@test.invalid`, phoneNumber: phone(1), phoneNumberVerified: true } })).id; });
  afterAll(async () => { await db.$disconnect(); });

  it("seeds the markets: UAE fully on, the others open for set-up but not for paid plans or terminals", async () => {
    const list = await listMarkets(); expect(list.map(m => [m.code, m.state])).toEqual([["AE", "live"], ["SA", "configured"], ["OM", "configured"], ["BH", "configured"], ["QA", "configured"], ["KW", "configured"]]);
    expect(await marketFlags("SA")).toMatchObject({ registrationEnabled: true, paidActivationEnabled: false, terminalSalesEnabled: false });
    await expect(marketFlags("EG")).rejects.toMatchObject({ code: "COUNTRY_NOT_SUPPORTED" });
  });
  it("creates the restaurant in the country of the owner's phone, with that country's currency and time zone", async () => {
    const b = await createBusiness(owner, { name: "Riyadh Grill", vatNumber: "300123456700003", locationName: "Main" }, "t"); made.push(b.id);
    expect(b).toMatchObject({ countryCode: "SA", currencyCode: "SAR", timezone: "Asia/Riyadh" });
    const loc = await db.location.findFirstOrThrow({ where: { businessId: b.id } }); expect(loc).toMatchObject({ countryCode: "SA", timezone: "Asia/Riyadh" });
    expect((await createBusiness(owner, { name: "again", locationName: "Main" }, "t")).id).toBe(b.id); // no country named: the same account
  });
  it("the country follows the phone number, whatever is asked for; another country needs a phone number of that country", async () => {
    const mk = async (prefix: string) => (await db.user.create({ data: { name: "mkc", email: `mkc-${crypto.randomUUID().slice(0, 8)}@test.invalid`, phoneNumber: `${prefix}${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-8)}`, phoneNumberVerified: true } })).id;
    const ae = await createBusiness(await mk("+9715"), { name: "Dubai Grill", locationName: "Main" }, "t"); made.push(ae.id);
    expect(ae).toMatchObject({ countryCode: "AE", currencyCode: "AED", timezone: "Asia/Dubai" });
    const kwOwner = await mk("+9655"), kw = await createBusiness(kwOwner, { name: "Kuwait Grill", locationName: "Main", countryCode: "KW" }, "t"); made.push(kw.id);
    expect(kw).toMatchObject({ countryCode: "KW", currencyCode: "KWD", timezone: "Asia/Kuwait" });
    await expect(createBusiness(kwOwner, { name: "xx", locationName: "Main", countryCode: "AE" }, "t")).rejects.toMatchObject({ code: "COUNTRY_MISMATCH" }); // a Kuwaiti number cannot open a UAE restaurant
    expect((await createBusiness(kwOwner, { name: "xx", locationName: "Main" }, "t")).id).toBe(kw.id); // asking again returns the same account
    await expect(createBusiness(await mk("+9715"), { name: "xx", locationName: "Main", countryCode: "EG" }, "t")).rejects.toMatchObject({ code: "COUNTRY_MISMATCH" });
  });
  it("registration can be closed per market", async () => {
    const admin = owner; await setMarketFlags(admin, "QA", { registrationEnabled: false }, "closing for test");
    const qaOwner = (await db.user.create({ data: { name: "qa", email: `qa-${suffix}@test.invalid`, phoneNumber: `+9745${String(Date.now()).slice(-7)}`, phoneNumberVerified: true } })).id;
    await expect(createBusiness(qaOwner, { name: "Doha", locationName: "Main" }, "t")).rejects.toMatchObject({ code: "MARKET_NOT_ENABLED" });
    await setMarketFlags(admin, "QA", { registrationEnabled: true }, "reopening after test");
    expect((await db.marketChange.findMany({ where: { code: "QA" } })).length).toBeGreaterThanOrEqual(2);
    await expect(setMarketFlags(admin, "QA", { paidActivationEnabled: true }, "")).rejects.toMatchObject({ code: "REASON_REQUIRED" });
  });
});

import { saveSettingsSection, getSettings } from "../src/modules/settings/service";
describe.skipIf(!enabled)("branches and delivery areas stay inside the restaurant's country", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  it("a Saudi restaurant uses Saudi regions; a UAE emirate is rejected, also through the API", async () => {
    const o = (await db.user.create({ data: { name: "sa", email: `sa-${suffix}@test.invalid`, phoneNumber: `+9665${String(Date.now()).slice(-8)}`, phoneNumberVerified: true } })).id;
    const b = (await createBusiness(o, { name: "Riyadh Grill 2", vatNumber: "300123456700003", locationName: "Main" }, "t")).id;
    const s = await getSettings(o, b); expect(s.country).toBe("SA"); expect(s.sections.branches[0].emirate).toBe("Riyadh");
    const ok = s.sections.branches.map((x: any) => ({ ...x, emirate: "Makkah", area: "Jeddah" }));
    await saveSettingsSection(o, b, "branches", ok, "t"); expect((await db.location.findFirstOrThrow({ where: { businessId: b } })).emirate).toBe("Makkah");
    await expect(saveSettingsSection(o, b, "branches", ok.map((x: any) => ({ ...x, emirate: "Dubai" })), "t")).rejects.toMatchObject({ code: "BRANCH_OUTSIDE_RESTAURANT_COUNTRY" });
    const del = (await getSettings(o, b)).sections.delivery;
    await expect(saveSettingsSection(o, b, "delivery", { ...del, areas: [{ emirate: "Sharjah", area: "All areas", fee: "5", min: "", eta: "30", branch: "", on: true }] }, "t")).rejects.toMatchObject({ code: "INVALID_REGION" });
    await saveSettingsSection(o, b, "delivery", { ...del, method: "area", areas: [{ emirate: "Riyadh", area: "All areas", fee: "12.50", min: "", eta: "30", branch: "", on: true }] }, "t");
  });
  it("Saudi Arabia, Oman and Bahrain need a VAT number to open an account (saved for review); Qatar and Kuwait do not", async () => {
    const mk = async (prefix: string) => (await db.user.create({ data: { name: "vat", email: `vat-${crypto.randomUUID()}@test.invalid`, phoneNumber: `${prefix}${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-7)}`, phoneNumberVerified: true } })).id;
    const sa = await mk("+9665");
    await expect(createBusiness(sa, { name: "No VAT", locationName: "Main", countryCode: "SA" }, "t")).rejects.toMatchObject({ code: "VAT_REGISTRATION_REQUIRED" });
    await expect(createBusiness(sa, { name: "Bad VAT", locationName: "Main", countryCode: "SA", vatNumber: "12" }, "t")).rejects.toMatchObject({ code: "VAT_REGISTRATION_REQUIRED" });
    const b = await createBusiness(sa, { name: "With VAT", locationName: "Main", countryCode: "SA", vatNumber: "3001 2345-6700003" }, "t");
    expect(await db.billingTaxProfile.findUnique({ where: { businessId: b.id } })).toMatchObject({ vatNumber: "300123456700003", vatRegistered: true, vatVerificationStatus: "PENDING", billingCountry: "SA" });
    for (const [prefix, code] of [["+968", "OM"], ["+973", "BH"]] as const) await expect(createBusiness(await mk(prefix), { name: "xx", locationName: "Main", countryCode: code }, "t")).rejects.toMatchObject({ code: "VAT_REGISTRATION_REQUIRED" });
    const qa = await createBusiness(await mk("+974"), { name: "Doha ok", locationName: "Main", countryCode: "QA" }, "t").catch(e => e); // Qatar may be closed by its market flag, but never asks for VAT
    if (qa?.code) expect(qa.code).not.toBe("VAT_REGISTRATION_REQUIRED");
  });
});
