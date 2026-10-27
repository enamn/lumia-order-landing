import { describe, expect, it } from "vitest";
import { cardFingerprint, cardNameLines, renderMenuCard } from "../src/modules/messages/menu-card-image";
const item = { itemId: "i", index: "1", categoryId: "c", categoryOrder: 0, category: "Grills", categoryAr: "المشاوي", name: "Kebab plate", nameAr: "صحن كباب", priceMinor: 3500, available: true, description: "", descriptionAr: "", requiresCustomization: false };
describe("branded menu card rendering", () => {
  it.each(["ar", "en"] as const)("renders a real PNG with bundled fonts in %s", async locale => {
    const png = await renderMenuCard({ businessName: "Burger House", item, locale, currency: "AED" });
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); expect(png.readUInt32BE(16)).toBe(1024); expect(png.readUInt32BE(20)).toBe(640);
  });
  it("changes cache fingerprints when price, locale, currency or name changes", () => {
    const base = { businessName: "B", item, locale: "ar" as const, currency: "AED" }, hash = cardFingerprint(base);
    expect(cardFingerprint({ ...base, item: { ...item, priceMinor: 3600 } })).not.toBe(hash);
    expect(cardFingerprint({ ...base, locale: "en" })).not.toBe(hash);
    expect(cardFingerprint({ ...base, currency: "KWD" })).not.toBe(hash);
    expect(cardFingerprint({ ...base, item: { ...item, nameAr: "صنف جديد" } })).not.toBe(hash);
  });
  it("wraps long Arabic names without covering prices", () => {
    const lines = cardNameLines("كيلو مشكل مشاوي الريف الشامي مع مجموعة من الأصناف ذات الأسماء الطويلة جداً للاختبار", 29);
    expect(lines.length).toBeLessThanOrEqual(3); expect(lines.every(line => line.length <= 29)).toBe(true);
  });
});
