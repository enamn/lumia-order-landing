import { describe, expect, it } from "vitest";
import { amountText, decimalsOf, formatMoney, fromMinor, parseAmount, scaleOf, toMinor } from "../src/modules/market/money";
import { resolveDraft, summaryText, placedText, money, type MenuEntry } from "../src/modules/orders/draft";
import { quoteDelivery, type DeliveryRules } from "../src/modules/orders/delivery";

describe("money in the six GCC currencies", () => {
  it("knows the decimals of each currency", () => {
    for (const c of ["AED", "SAR", "QAR"]) { expect(decimalsOf(c)).toBe(2); expect(scaleOf(c)).toBe(100); }
    for (const c of ["OMR", "BHD", "KWD"]) { expect(decimalsOf(c)).toBe(3); expect(scaleOf(c)).toBe(1000); }
  });
  it("converts without floating point surprises", () => {
    expect(toMinor(1.275, "KWD")).toBe(1275); expect(toMinor(2.1, "OMR")).toBe(2100); expect(toMinor(1.005, "AED")).toBe(101); expect(toMinor(0.1 + 0.2, "AED")).toBe(30); expect(toMinor(299, "SAR")).toBe(29900);
    expect(fromMinor(3825, "KWD")).toBe(3.825); expect(fromMinor(29900, "SAR")).toBe(299);
  });
  it("matches the required calculation examples", () => {
    expect(amountText(3 * toMinor(1.275, "KWD"), "KWD")).toBe("3.825");
    expect(amountText(toMinor(2.1, "OMR") + toMinor(0.35, "OMR"), "OMR")).toBe("2.450");
    expect(amountText(29900, "SAR")).toBe("299"); expect(amountText(1250, "AED")).toBe("12.50"); expect(amountText(2450, "BHD")).toBe("2.450"); expect(amountText(-500, "AED")).toBe("-5");
  });
  it("shows the ISO code", () => { expect(formatMoney(2450, "OMR")).toBe("OMR 2.450"); expect(formatMoney(29900, "SAR")).toBe("SAR 299"); expect(formatMoney(1250, "AED")).toBe("AED 12.50"); });
  it("reads typed prices in English and Arabic digits, and rejects ambiguous ones", () => {
    expect(parseAmount("12.5")).toBe(12.5); expect(parseAmount("١٢٫٥٠")).toBe(12.5); expect(parseAmount("۱۲.۵")).toBe(12.5); expect(parseAmount("1,500")).toBe(1500); expect(parseAmount("1,5")).toBe(1.5); expect(parseAmount("1.234,56")).toBe(1234.56); expect(parseAmount("1,234.56")).toBe(1234.56); expect(parseAmount("٢٫١٠٠")).toBe(2.1);
    for (const bad of ["", "abc", "1.2.3,4", "-5"]) expect(parseAmount(bad)).toBeNull();
  });
});

describe("an order in a three-decimal currency", () => {
  const menu: MenuEntry[] = [{ index: "1", itemId: "a", name: "Shawarma", nameAr: "", priceMinor: 1275, available: true }];
  const rules: DeliveryRules = { status: "available", method: "area", minOrder: "2.500", freeAbove: "", eta: "40", areas: [{ emirate: "Muscat", area: "", fee: "0.350", min: "", eta: "", branch: "", on: true }], ranges: [], freeEm: [], freeAreas: "", freeBranch: "", manualMsg: "", confirmFirst: false } as never;
  it("totals, summary and confirmation use the currency's decimals", () => {
    const options = { delivery: true, pickup: true, minimumMinor: 0, currency: "KWD" };
    const r = resolveDraft(menu, { items: [{ id: "1", quantity: 3, notes: "" }], fulfillment: "pickup", address: "", emirate: null, area: "", customerName: "", addressLabel: "", savedAddress: "" } as never, options, undefined);
    expect(r.subtotalMinor).toBe(3825); expect(r.totalMinor).toBe(3825);
    const text = summaryText(r, "en", options); expect(text).toContain("3 × Shawarma — 3.825 KWD"); expect(text).toContain("Total: 3.825 KWD");
    expect(placedText("12", 3825, "pickup", "en", "KWD")).toContain("Total 3.825 KWD"); expect(money(3825, "KWD")).toBe("3.825");
  });
  it("delivery fees and minimums typed in the settings become 1/1000 units", () => {
    const q = quoteDelivery({ ...rules, method: "free", freeEm: ["Muscat"] } as never, [], { emirate: "Muscat", area: "" }, 3000, 0, "OMR");
    expect(q.status).toBe("ok");
    const fee = quoteDelivery(rules, [], { emirate: "Muscat", area: "" }, 3000, 0, "OMR");
    if (fee.status === "ok") { expect(fee.feeMinor).toBe(350); expect(fee.minimumMinor).toBe(2500); } else throw new Error(JSON.stringify(fee));
  });
});

import { afterAll, beforeAll } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { addItem, getMenu } from "../src/modules/menu/service";
import { getSettings, saveSettingsSection } from "../src/modules/settings/service";
describe.skipIf(process.env.RUN_DB_TESTS !== "true")("a Kuwait restaurant", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string;
  beforeAll(async () => { owner = (await db.user.create({ data: { name: "kw", email: `kw-${suffix}@test.invalid`, phoneNumber: `+9655${String(Date.now()).slice(-7)}`, phoneNumberVerified: true } })).id; biz = (await createBusiness(owner, { name: "Kuwait Grill", locationName: "Main" }, "t")).id; });
  afterAll(async () => { await db.$disconnect(); });
  it("stores menu prices in 1/1000 KWD and returns them with the currency", async () => {
    expect((await db.business.findUniqueOrThrow({ where: { id: biz } })).currencyCode).toBe("KWD");
    await addItem(owner, biz, { name: "Machboos", category: "Mains", price: 1.275 }, "t");
    const item = (await getMenu(owner, biz))[0]!.items[0]!; expect(item).toMatchObject({ priceMinor: 1275, currency: "KWD" });
  });
  it("keeps the minimum order of the settings in 1/1000 KWD", async () => {
    const cur = (await getSettings(owner, biz)).sections;
    await saveSettingsSection(owner, biz, "delivery", { ...cur.delivery, minOrder: "2.500" }, "t");
    expect((await db.orderSettings.findUniqueOrThrow({ where: { businessId: biz } })).minimumOrderAmountMinor).toBe(2500);
    expect((await getSettings(owner, biz)).sections.delivery.minOrder).toBe("2.500"); expect((await getSettings(owner, biz)).currency).toBe("KWD");
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== "true")("amounts typed in the settings", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  it("allow 2 decimals in dirhams and reject a third", async () => {
    const o = (await db.user.create({ data: { name: "ae", email: `ae-${suffix}@test.invalid`, phoneNumber: `+9715${String(Date.now()).slice(-8)}`, phoneNumberVerified: true } })).id;
    const b = (await createBusiness(o, { name: "Dubai Grill", locationName: "Main" }, "t")).id; const cur = (await getSettings(o, b)).sections;
    await saveSettingsSection(o, b, "delivery", { ...cur.delivery, minOrder: "12.50" }, "t");
    await expect(saveSettingsSection(o, b, "delivery", { ...cur.delivery, minOrder: "12.505" }, "t")).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });
});
