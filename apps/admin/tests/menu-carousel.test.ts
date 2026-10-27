import { describe, expect, it } from "vitest";
import { adviceIsActive, carouselBatch, isAdviceNo, isAdviceYes, isMenuRequest, prepareCarousel, recommendationText } from "../src/modules/messages/menu-carousel";
import type { MenuProduct } from "../src/modules/messages/menu-presentation";
const item = (n: number): MenuProduct => ({ index: String(n + 1), itemId: `item-${n}`, name: `Item ${n}`, nameAr: `صنف ${n}`, priceMinor: 1275, available: true, categoryId: `c${n % 2}`, categoryOrder: n % 2, category: n % 2 ? "Sides" : "Mains", categoryAr: n % 2 ? "مقبلات" : "أطباق", description: "", descriptionAr: "", requiresCustomization: false });
describe("conversational menu carousel", () => {
  it.each(["شو عندك؟", "شو عندكم", "شُو عِندَك ؟", "شنو عندكم؟", "ايش عندك", "وش عندكم", "منيو", "what do you have?", "Show me the menu!"])("recognizes a menu request: %s", text => expect(isMenuRequest(text)).toBe(true));
  it.each(["مرحبا", "hi", "شو عندك من مشاكل؟", "عندك توصيل؟", "بدي ٢ كباب"])("does not hijack a greeting, question, or order: %s", text => expect(isMenuRequest(text)).toBe(false));
  it("shows all 35 available items exactly once across eight-item batches", () => {
    const menu = Array.from({ length: 36 }, (_, n) => item(n)); menu[10].available = false;
    const seen: string[] = [], sizes: number[] = [];
    for (let page = 0; page < 5; page++) {
      const batch = carouselBatch(menu, "ar", "KWD", page);
      sizes.push(batch.items.length); seen.push(...batch.items.map(i => i.itemId));
      expect(batch.cards[0].price).toBe("1.275 KWD");
      expect(batch.navigation.length).toBeLessThanOrEqual(2);
      expect(batch.hint).toContain("ابعت فويس");
    }
    expect(sizes).toEqual([8, 8, 8, 8, 3]); expect(new Set(seen).size).toBe(35); expect(seen).not.toContain("item-10");
  });
  it.each([0, 1, 2, 8, 9, 16, 17, 25])("handles small menus and single-item tails: %s", count => {
    const menu = Array.from({ length: count }, (_, n) => item(n)), first = carouselBatch(menu, "en", "AED");
    const pages = Array.from({ length: first.pageCount }, (_, page) => carouselBatch(menu, "en", "AED", page));
    expect(pages.flatMap(p => p.items).length).toBe(count);
    for (const page of pages) { expect(page.items.length).toBeLessThanOrEqual(8); if (count > 1) expect(page.items.length).toBeGreaterThanOrEqual(2); }
  });
  it("uses Details only, and binds carousel and navigation actions to one screen", () => {
    const batch = carouselBatch(Array.from({ length: 20 }, (_, n) => item(n)), "ar", "AED", 1);
    const p = prepareCarousel(batch, { locale: "ar", phoneNumberId: "123456", branchId: "branch" });
    expect(p.session.actions).toHaveLength(10);
    expect(p.cards.every(c => c.buttonTitle === "التفاصيل")).toBe(true);
    expect(p.session.actions.some(a => a.kind === "add")).toBe(false);
    expect([...p.cards.map(c => c.buttonId), ...p.navigation.map(n => n.id)].every(id => id.startsWith(`lm:${p.session.nonce}:`))).toBe(true);
  });
  it("recognizes advice replies and expires or isolates their context", () => {
    expect(isAdviceYes("نعم")).toBe(true); expect(isAdviceYes("شو بتنصحني؟")).toBe(true); expect(isAdviceYes("yes please")).toBe(true);
    expect(isAdviceYes("نعم بدي اتنين كباب")).toBe(false); expect(isAdviceNo("لا شكرا")).toBe(true);
    const session = { ...prepareCarousel(carouselBatch([item(1)], "ar", "AED"), { locale: "ar", phoneNumberId: "123456", branchId: null }).session, advice: "offered" as const, adviceOfferedAt: new Date().toISOString() };
    expect(adviceIsActive(session, "123456", null)).toBe(true); expect(adviceIsActive(session, "other", null)).toBe(false); expect(adviceIsActive(session, "123456", "other")).toBe(false); expect(adviceIsActive(session, "123456", null, Date.now() + 3 * 3600000)).toBe(false);
  });
  it("formats at most three grounded recommendations with current exact prices", () => {
    const menu = Array.from({ length: 5 }, (_, n) => item(n)); menu[1].available = false;
    const text = recommendationText(menu, ["1", "2", "fake", "1", "3", "4", "5"], "ar", "KWD");
    expect(text).toContain("1.275 KWD"); expect(text.match(/•/g)).toHaveLength(3); expect(text).not.toContain("صنف 1"); expect(text).not.toContain("fake");
  });
});
