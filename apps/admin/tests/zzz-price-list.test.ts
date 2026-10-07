import { describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { itemsOf, listMarketPrices, setMarketPriceList } from "../src/modules/billing/pricing";
const enabled = process.env.RUN_DB_TESTS === "true";
const past = new Date(Date.now() - 86_400_000).toISOString();

describe.skipIf(!enabled)("saving a whole country price list", () => {
  it("saves a partial list as a draft, refuses an incomplete active list, and saves a full list in one step", async () => {
    const admin = (await db.user.create({ data: { name: "list-admin", email: `list-${crypto.randomUUID().slice(0, 8)}@test.invalid`, phoneNumber: `+9715${String(Date.now()).slice(-7)}`, phoneNumberVerified: true } })).id;
    const items = itemsOf(), version = `list-${crypto.randomUUID().slice(0, 6)}`;
    await setMarketPriceList(admin, { country: "QA", status: "DRAFT", effectiveFrom: past, version, amounts: { "plan:plus:monthly": 99 } });
    await expect(setMarketPriceList(admin, { country: "QA", status: "ACTIVE", effectiveFrom: past, version: version + "a", amounts: { "plan:plus:monthly": 99 } })).rejects.toMatchObject({ code: "MARKET_PRICE_NOT_CONFIGURED" });
    await expect(setMarketPriceList(admin, { country: "QA", status: "DRAFT", effectiveFrom: past, version: version + "b", amounts: { "plan:gold:monthly": 1 } })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const all = Object.fromEntries(items.map(i => [i, 50]));
    const rows = await setMarketPriceList(admin, { country: "QA", status: "ACTIVE", effectiveFrom: past, version: version + "c", amounts: all });
    expect(rows).toHaveLength(items.length);
    expect((await listMarketPrices()).filter(p => p.country === "QA" && p.version === version + "c" && p.currency === "QAR" && p.amountMinor === 5000 && p.status === "ACTIVE")).toHaveLength(items.length);
    await db.marketPrice.deleteMany({ where: { version: { startsWith: version } } });
  });
});
