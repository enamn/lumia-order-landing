import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness, changeCountry } from "../src/modules/business/service";
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
    const b = await createBusiness(owner, { name: "Riyadh Grill", locationName: "Main" }, "t"); made.push(b.id);
    expect(b).toMatchObject({ countryCode: "SA", currencyCode: "SAR", timezone: "Asia/Riyadh" });
    const loc = await db.location.findFirstOrThrow({ where: { businessId: b.id } }); expect(loc).toMatchObject({ countryCode: "SA", timezone: "Asia/Riyadh" });
    expect((await createBusiness(owner, { name: "again", locationName: "Main" }, "t")).id).toBe(b.id); // no country named: the same account
  });
  it("a brand in a second country gets a second account; asking for the same country again returns it", async () => {
    const ae = await createBusiness(owner, { name: "Dubai Grill", locationName: "Main", countryCode: "AE" }, "t"); made.push(ae.id);
    expect(ae).toMatchObject({ countryCode: "AE", currencyCode: "AED", timezone: "Asia/Dubai" });
    expect((await createBusiness(owner, { name: "xx", locationName: "Main", countryCode: "AE" }, "t")).id).toBe(ae.id);
    const kw = await createBusiness(owner, { name: "Kuwait Grill", locationName: "Main", countryCode: "KW" }, "t"); made.push(kw.id); expect(kw).toMatchObject({ currencyCode: "KWD", timezone: "Asia/Kuwait" });
    await expect(createBusiness(owner, { name: "xx", locationName: "Main", countryCode: "EG" }, "t")).rejects.toMatchObject({ code: "COUNTRY_NOT_SUPPORTED" });
  });
  it("registration can be closed per market", async () => {
    const admin = owner; await setMarketFlags(admin, "QA", { registrationEnabled: false }, "closing for test");
    await expect(createBusiness(owner, { name: "Doha", locationName: "Main", countryCode: "QA" }, "t")).rejects.toMatchObject({ code: "MARKET_NOT_ENABLED" });
    await setMarketFlags(admin, "QA", { registrationEnabled: true }, "reopening after test");
    expect((await db.marketChange.findMany({ where: { code: "QA" } })).length).toBeGreaterThanOrEqual(2);
    await expect(setMarketFlags(admin, "QA", { paidActivationEnabled: true }, "")).rejects.toMatchObject({ code: "REASON_REQUIRED" });
  });
  it("a draft restaurant can still change its country, one with a menu price or billing cannot", async () => {
    const o2 = (await db.user.create({ data: { name: "mk2", email: `mk2-${suffix}@test.invalid`, phoneNumber: `+9715${String(Date.now()).slice(-8)}`, phoneNumberVerified: true } })).id;
    const b = await createBusiness(o2, { name: "Draft", locationName: "Main" }, "t"); made.push(b.id); expect(b.countryCode).toBe("AE");
    expect(await changeCountry(o2, b.id, { countryCode: "OM" }, "t")).toEqual({ countryCode: "OM", changed: true });
    expect(await db.business.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ currencyCode: "OMR", timezone: "Asia/Muscat" });
    const catalog = await db.catalog.create({ data: { businessId: b.id, name: "Menu" } });
    await db.catalogItem.create({ data: { catalogId: catalog.id, name: "Burger", basePriceMinor: 1500, currencyCode: "OMR" } as never });
    await expect(changeCountry(o2, b.id, { countryCode: "AE" }, "t")).rejects.toMatchObject({ code: "COUNTRY_CHANGE_NOT_ALLOWED" });
  });
  it("only an owner or admin of that restaurant may change it", async () => {
    const stranger = (await db.user.create({ data: { name: "st", email: `st-${suffix}@test.invalid`, phoneNumber: `+9715${String(Date.now() + 7).slice(-8)}`, phoneNumberVerified: true } })).id;
    await expect(changeCountry(stranger, made[0]!, { countryCode: "AE" }, "t")).rejects.toBeTruthy();
  });
});

import { saveSettingsSection, getSettings } from "../src/modules/settings/service";
describe.skipIf(!enabled)("branches and delivery areas stay inside the restaurant's country", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  it("a Saudi restaurant uses Saudi regions; a UAE emirate is rejected, also through the API", async () => {
    const o = (await db.user.create({ data: { name: "sa", email: `sa-${suffix}@test.invalid`, phoneNumber: `+9665${String(Date.now()).slice(-8)}`, phoneNumberVerified: true } })).id;
    const b = (await createBusiness(o, { name: "Riyadh Grill 2", locationName: "Main" }, "t")).id;
    const s = await getSettings(o, b); expect(s.country).toBe("SA"); expect(s.sections.branches[0].emirate).toBe("Riyadh");
    const ok = s.sections.branches.map((x: any) => ({ ...x, emirate: "Makkah", area: "Jeddah" }));
    await saveSettingsSection(o, b, "branches", ok, "t"); expect((await db.location.findFirstOrThrow({ where: { businessId: b } })).emirate).toBe("Makkah");
    await expect(saveSettingsSection(o, b, "branches", ok.map((x: any) => ({ ...x, emirate: "Dubai" })), "t")).rejects.toMatchObject({ code: "BRANCH_OUTSIDE_RESTAURANT_COUNTRY" });
    const del = (await getSettings(o, b)).sections.delivery;
    await expect(saveSettingsSection(o, b, "delivery", { ...del, areas: [{ emirate: "Sharjah", area: "All areas", fee: "5", min: "", eta: "30", branch: "", on: true }] }, "t")).rejects.toMatchObject({ code: "INVALID_REGION" });
    await saveSettingsSection(o, b, "delivery", { ...del, method: "area", areas: [{ emirate: "Riyadh", area: "All areas", fee: "12.50", min: "", eta: "30", branch: "", on: true }] }, "t");
  });
});
