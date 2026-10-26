import { describe, expect, it } from "vitest";
import { itemImage, mergeLanguages, parseTalabatMenu, talabatPages } from "../src/modules/menu/import-url";

const page = (cats: unknown, name = "Test Restaurant", logo = "https://talabat.dhmedia.io/image/talabat/restaurants/logo.jpg?width=180&amp;x=1") => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialMenuState: { restaurant: { name, logo }, menuData: { categories: cats } } } } })}</script></html>`;
const item = (id: number, name: string, price: number) => ({ id, name, price, hasChoices: false, description: `About ${name}`, originalImage: `https://talabat.dhmedia.io/image/x/${id}.jpg`, image: `https://talabat.dhmedia.io/image/x/${id}.jpg?width=172&amp;height=172` });
const arCats = [
  { id: -1, name: "اختيارات على ذوقك 🔥", items: [item(1, "وجبة ملكية", 43)] },
  { id: 10, name: "عروض خاصة", items: [item(2, "عرض الغداء", 30), item(1, "وجبة ملكية", 43)] },
  { id: 20, name: "بروستد دجاج", items: [item(1, "وجبة ملكية", 43), item(3, "وجبة مشاوي", 0)] },
  { id: 30, name: "مشروبات باردة", items: [item(4, "كولا", 7)] },
];
const enCats = [
  { id: -1, name: "Picks for you 🔥", items: [item(1, "Royal Meal", 43)] },
  { id: 10, name: "Special Offers", items: [item(2, "Lunch Deal", 30), item(1, "Royal Meal", 43)] },
  { id: 20, name: "Broasted Chicken", items: [item(1, "Royal Meal", 43), item(3, "Grill Meal", 0)] },
  { id: 30, name: "Cold Drinks", items: [item(4, "Cola", 7)] },
];

describe("menu from a Talabat link", () => {
  it("accepts only restaurant pages on talabat.com and builds the Arabic and English addresses", () => {
    expect(talabatPages("https://www.talabat.com/ar/uae/restaurant/728554/omar-laffah-restaurant?aid=1525&utm=x")).toEqual({ ar: "https://www.talabat.com/ar/uae/restaurant/728554/omar-laffah-restaurant?aid=1525", en: "https://www.talabat.com/en/uae/restaurant/728554/omar-laffah-restaurant?aid=1525" });
    expect(talabatPages("https://talabat.com/uae/restaurant/1/some-place")?.en).toBe("https://www.talabat.com/en/uae/restaurant/1/some-place");
    for (const bad of ["http://www.talabat.com/uae/restaurant/1/x", "https://evil.com/uae/restaurant/1/x", "https://talabat.com.evil.com/uae/restaurant/1/x", "https://www.talabat.com@evil.com/uae/restaurant/1/x", "https://www.talabat.com:8443/uae/restaurant/1/x", "https://www.talabat.com/uae/", "https://www.talabat.com/uae/restaurant/abc/x", "not a link", "file:///etc/passwd"]) expect(talabatPages(bad)).toBeNull();
  });
  it("reads each item once, in its real category, with promotional sections last and empty ones dropped", () => {
    const m = parseTalabatMenu(page(arCats))!;
    expect(m.restaurant).toBe("Test Restaurant");
    expect(m.categories.map(c => c.name)).toEqual(["عروض خاصة", "بروستد دجاج", "مشروبات باردة"]); // page order; "picks" holds only a duplicate, so it is gone
    expect(m.categories.find(c => c.name === "بروستد دجاج")!.items.map(i => i.id)).toEqual([1, 3]);
    expect(m.categories.find(c => c.name === "عروض خاصة")!.items.map(i => i.id)).toEqual([2]); // item 1 stays in its real category
    expect(m.categories.flatMap(c => c.items).find(i => i.id === 3)!.price).toBeNull(); // priced on selection
  });
  it("combines both languages by id and flags what has no price", () => {
    const d = mergeLanguages(parseTalabatMenu(page(arCats)), parseTalabatMenu(page(enCats)));
    const chicken = d.categories.find(c => c.nameAr === "بروستد دجاج")!;
    expect(chicken).toMatchObject({ name: "Broasted Chicken" });
    expect(chicken.items[0]).toMatchObject({ name: "Royal Meal", nameAr: "وجبة ملكية", price: 43, flagged: false });
    expect(chicken.items[1]).toMatchObject({ name: "Grill Meal", price: null, flagged: true });
    expect(mergeLanguages(null, parseTalabatMenu(page(enCats))).categories[0]!.items[0]).toMatchObject({ name: "Lunch Deal", nameAr: "" }); // only English was reachable
  });
  it("takes the restaurant's name in both languages and its logo address from the page", () => {
    const ar = parseTalabatMenu(page(arCats, "مطعم الاختبار")), en = parseTalabatMenu(page(enCats, "Test Place"));
    expect(en).toMatchObject({ restaurant: "Test Place", logoUrl: "https://talabat.dhmedia.io/image/talabat/restaurants/logo.jpg?width=180&x=1" });
    expect(mergeLanguages(ar, en).restaurant).toEqual({ name: "Test Place", nameAr: "مطعم الاختبار" });
    expect(mergeLanguages(null, en).restaurant).toEqual({ name: "Test Place", nameAr: "" });
    expect(parseTalabatMenu(page(arCats, "x", "javascript:alert(1)"))!.logoUrl).toBe(""); // only a web address is kept
  });
  it("keeps each item's photo and description in both languages, and only photos from Talabat's own image server", () => {
    const d = mergeLanguages(parseTalabatMenu(page(arCats)), parseTalabatMenu(page(enCats)));
    expect(d.categories.flatMap(c => c.items).find(i => i.name === "Cola")).toMatchObject({ image: "https://talabat.dhmedia.io/image/x/4.jpg", description: "About Cola", descriptionAr: "About كولا" });
    expect(itemImage("https://talabat.dhmedia.io/image/x/1.jpg?width=172&amp;height=172")).toBe("https://talabat.dhmedia.io/image/x/1.jpg");
    for (const bad of ["http://talabat.dhmedia.io/a.jpg", "https://evil.com/a.jpg", "https://talabat.dhmedia.io.evil.com/a.jpg", "https://talabat.dhmedia.io/a.html", "javascript:alert(1)", "", null, undefined]) expect(itemImage(bad)).toBe("");
  });
  it("returns nothing for a page without a menu", () => {
    expect(parseTalabatMenu("<html>nothing</html>")).toBeNull();
    expect(parseTalabatMenu(page([]))).toBeNull();
    expect(parseTalabatMenu('<script id="__NEXT_DATA__">{broken')).toBeNull();
    const whole = page(arCats); // a download cut off in the middle of the data (seen on large menus) is not read as a menu
    expect(parseTalabatMenu(whole.slice(0, whole.length - 200))).toBeNull();
  });
});
