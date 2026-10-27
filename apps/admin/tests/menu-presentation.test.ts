import { describe, expect, it } from "vitest";
import { categoryScreen, menuLabel, prepareScreen, productScreen, productsScreen, resolveMenuAction, welcomeScreen, type MenuProduct } from "../src/modules/messages/menu-presentation";
const item = (i: number, categoryId = `c${i}`): MenuProduct => ({ index: String(i), itemId: `i${i}`, categoryId, categoryOrder: i, category: `Category ${categoryId}`, categoryAr: `القسم ${categoryId}`, name: `Item ${i}`, nameAr: `الصنف ${i}`, priceMinor: 1275, available: true, description: "Freshly prepared", descriptionAr: "يحضر طازجاً", requiresCustomization: false });
const scope = { locale: "ar" as const, branchId: null, phoneNumberId: "123456" };
describe("WhatsApp menu presentation", () => {
  it("keeps all categories reachable inside the ten-row limit", () => {
    const menu = Array.from({ length: 25 }, (_, i) => item(i));
    const seen = new Set<string>();
    for (let page = 0; page < 4; page++) {
      const screen = categoryScreen(menu, "ar", page);
      expect(screen.choices.length).toBeLessThanOrEqual(10);
      for (const c of screen.choices) if (c.action.kind === "products") seen.add(c.action.categoryId);
    }
    expect(seen.size).toBe(25);
  });
  it("paginates products, hides unavailable items and formats three-decimal currencies", () => {
    const menu = Array.from({ length: 20 }, (_, i) => item(i, "grills")); menu[3].available = false;
    const seen = new Set<string>();
    for (let page = 0; page < 4; page++) {
      const screen = productsScreen(menu, "grills", "en", "KWD", page);
      expect(screen.choices.length).toBeLessThanOrEqual(10);
      for (const c of screen.choices) if (c.action.kind === "product") { seen.add(c.action.itemId); expect(c.description).toContain("1.275 KWD"); }
    }
    expect(seen.size).toBe(19); expect(seen.has("i3")).toBe(false);
  });
  it("does not split emoji or combining Arabic marks", () => {
    expect(menuLabel("👨‍👩‍👧‍👦".repeat(20), 24).length).toBeLessThanOrEqual(24);
    expect(menuLabel("اَ".repeat(30), 24)).not.toMatch(/ا…$/);
    const screen = categoryScreen([item(1)], "ar"); screen.choices[0].title = "👋".repeat(80);
    const prepared = prepareScreen(screen, scope);
    expect(prepared.options[0].title.length).toBeLessThanOrEqual(24);
    expect(prepared.fallback).toContain("M1");
  });
  it("binds opaque actions to the screen, sender and branch and expires old selections", () => {
    const p = prepareScreen(welcomeScreen("Test", "ar"), scope), id = p.options[0].id;
    expect(resolveMenuAction(p.session, id, scope.phoneNumberId, null)).toEqual({ kind: "categories" });
    expect(resolveMenuAction(p.session, id, "other", null)).toBeNull();
    expect(resolveMenuAction(p.session, id, scope.phoneNumberId, "other")).toBeNull();
    expect(resolveMenuAction(p.session, id + "9", scope.phoneNumberId, null)).toBeNull();
    expect(resolveMenuAction({ ...p.session, nonce: "other" }, id, scope.phoneNumberId, null)).toBeNull();
    expect(resolveMenuAction(p.session, id, scope.phoneNumberId, null, Date.now() + 3 * 3600000)).toBeNull();
  });
  it("offers staff customization instead of an unpriced add action", () => {
    const screen = productScreen({ ...item(1), requiresCustomization: true }, "en", "AED");
    expect(screen.choices.some(c => c.action.kind === "add")).toBe(false); expect(screen.text).toContain("team"); expect(screen.choices).toHaveLength(2);
    expect(productScreen(item(1), "ar", "AED").text).toContain("12.75 AED");
  });
  it("rejects oversized choice builders", () => {
    expect(() => prepareScreen({ ...welcomeScreen("Test", "en"), choices: Array.from({ length: 4 }, () => ({ title: "x", action: { kind: "cart" as const } })) }, scope)).toThrow();
  });
});
