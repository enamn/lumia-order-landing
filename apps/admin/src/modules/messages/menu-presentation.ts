import { amountText } from "@/modules/market/money";
import type { Lang, MenuEntry } from "@/modules/orders/draft";

export type MenuProduct = MenuEntry & { categoryId: string; categoryOrder: number; description: string; descriptionAr: string; requiresCustomization: boolean };
export type MenuAction = { kind: "menu"; page?: number } | { kind: "categories"; page?: number } | { kind: "branches"; page?: number } | { kind: "products"; categoryId: string; page?: number } | { kind: "product" | "add" | "customize"; itemId: string } | { kind: "branch"; branchId: string } | { [K in "cart" | "checkout" | "human" | "offers" | "track"]: { kind: K } }["cart" | "checkout" | "human" | "offers" | "track"];
export type MenuSession = { nonce: string; locale: Lang; branchId: string | null; phoneNumberId: string; createdAt: string; actions: MenuAction[]; view?: "carousel"; page?: number; advice?: "offered" | "preference" | null; adviceOfferedAt?: string };
export type Choice = { title: string; description?: string; action: MenuAction };
export type MenuScreen = { text: string; kind: "buttons" | "list"; listButton?: string; choices: Choice[]; imageUrl?: string | null };
// Bound by UTF-16 length as well as grapheme boundaries: never split an emoji or an Arabic combining sequence.
export function menuLabel(text: string, limit: number): string {
  const value = text.replace(/\s+/gu, " ").trim();
  if (value.length <= limit) return value;
  let result = "";
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)) { if ((result + segment).length > limit - 1) break; result += segment; }
  return result + "…";
}
const tr = (lang: Lang, ar: string, en: string) => lang === "ar" ? ar : en;
export const productName = (item: MenuEntry, lang: Lang) => lang === "ar" ? item.nameAr || item.name : item.name || item.nameAr;
const cart = (lang: Lang): Choice => ({ title: tr(lang, "السلة", "View cart"), action: { kind: "cart" } });
const categories = (lang: Lang): Choice => ({ title: tr(lang, "الأقسام", "Categories"), action: { kind: "categories" } });
function pageOf<T>(items: T[], page: number, size: number) {
  const current = Number.isSafeInteger(page) ? Math.max(0, Math.min(page, Math.max(0, Math.ceil(items.length / size) - 1))) : 0;
  return { current, items: items.slice(current * size, (current + 1) * size), prev: current > 0, next: (current + 1) * size < items.length };
}
export function welcomeScreen(name: string, lang: Lang): MenuScreen {
  return { text: tr(lang, `مرحباً بك في ${name} 👋\nكيف نقدر نساعدك اليوم؟`, `Welcome to ${name}! 👋\nHow can we help you today?`), kind: "buttons", choices: [
    { title: tr(lang, "📋 عرض المنيو", "📋 View Menu"), action: { kind: "categories" } },
    { title: tr(lang, "🔥 العروض", "🔥 Offers"), action: { kind: "offers" } },
    { title: tr(lang, "📦 تتبع الطلب", "📦 Track Order"), action: { kind: "track" } },
  ] };
}
export function categoryScreen(menu: MenuProduct[], lang: Lang, page = 0): MenuScreen {
  const grouped = new Map<string, MenuProduct>();
  for (const item of menu.filter(i => i.available).sort((a, b) => a.categoryOrder - b.categoryOrder)) if (!grouped.has(item.categoryId)) grouped.set(item.categoryId, item);
  const p = pageOf([...grouped.values()], page, 7);
  const choices: Choice[] = p.items.map(i => ({ title: (lang === "ar" ? i.categoryAr : i.category) || i.category || tr(lang, "أخرى", "Other"), action: { kind: "products", categoryId: i.categoryId } }));
  if (p.prev) choices.push({ title: tr(lang, "السابق", "Previous"), action: { kind: "categories", page: p.current - 1 } });
  if (p.next) choices.push({ title: tr(lang, "المزيد من الأقسام", "More categories"), action: { kind: "categories", page: p.current + 1 } });
  choices.push(cart(lang));
  return { text: p.items.length ? tr(lang, "*قائمة الطعام* 🍽️\nاختر القسم الذي ترغب بتصفحه.\nللتواصل مع الفريق، اكتب «مساعدة».", "*Our menu* 🍽️\nChoose a category to browse.\nType “help” to reach our team.") : tr(lang, "لا توجد أصناف متاحة حالياً. اكتب «مساعدة» للتواصل معنا.", "No items are available right now. Type “help” to reach our team."), kind: "list", listButton: tr(lang, "عرض الأقسام", "View categories"), choices };
}
export function productsScreen(menu: MenuProduct[], categoryId: string, lang: Lang, currency: string, page = 0): MenuScreen {
  const p = pageOf(menu.filter(i => i.available && i.categoryId === categoryId), page, 6);
  const choices: Choice[] = p.items.map(i => ({ title: productName(i, lang), description: `${amountText(i.priceMinor, currency)} ${currency}${i.requiresCustomization ? tr(lang, " · خيارات مطلوبة", " · Options required") : ""}`, action: { kind: "product", itemId: i.itemId } }));
  if (p.prev) choices.push({ title: tr(lang, "السابق", "Previous"), action: { kind: "products", categoryId, page: p.current - 1 } });
  if (p.next) choices.push({ title: tr(lang, "المزيد من الأصناف", "More items"), action: { kind: "products", categoryId, page: p.current + 1 } });
  choices.push(categories(lang), cart(lang));
  const first = p.items[0];
  const title = first ? ((lang === "ar" ? first.categoryAr : first.category) || first.category || "") : "";
  return { text: tr(lang, `*${title || "الأصناف"}*\nاختر صنفاً لعرض التفاصيل والسعر.`, `*${title || "Items"}*\nChoose an item to see details and price.`), kind: "list", listButton: tr(lang, "عرض الأصناف", "View items"), choices };
}
export function branchesScreen(branches: { id: string; name: string }[], lang: Lang, page = 0): MenuScreen {
  const p = pageOf(branches, page, 7);
  const choices: Choice[] = p.items.map(b => ({ title: b.name, action: { kind: "branch", branchId: b.id } }));
  if (p.prev) choices.push({ title: tr(lang, "السابق", "Previous"), action: { kind: "branches", page: p.current - 1 } });
  if (p.next) choices.push({ title: tr(lang, "المزيد من الفروع", "More branches"), action: { kind: "branches", page: p.current + 1 } });
  choices.push({ title: tr(lang, "مساعدة", "Get help"), action: { kind: "human" } });
  return { text: tr(lang, "اختر الفرع أولاً لعرض المنيو الصحيح.", "Choose a branch first to see its menu."), kind: "list", listButton: tr(lang, "الفروع", "Branches"), choices };
}
export function productScreen(item: MenuProduct, lang: Lang, currency: string): MenuScreen {
  const description = lang === "ar" ? item.descriptionAr || item.description : item.description || item.descriptionAr;
  return { text: [`*${productName(item, lang)}*`, description && menuLabel(description, 500), `*${amountText(item.priceMinor, currency)} ${currency}*`, item.requiresCustomization ? tr(lang, "هذا الصنف له خيارات. أخبرنا بما تفضّل وسيساعدك الفريق.", "This item has options. Tell us what you prefer and our team will help.") : tr(lang, "للطلب، اكتب الكمية والملاحظات أو ابعت فويس 🎤", "To order, type the quantity and notes, or send a voice message 🎤")].filter(Boolean).join("\n\n"), kind: "buttons", imageUrl: item.imageUrl, choices: [
    { title: tr(lang, "المنيو", "Menu"), action: { kind: "menu" } },
    { title: tr(lang, "مساعدة", "Get help"), action: { kind: "human" } },
  ] };
}
export function prepareScreen(screen: MenuScreen, scope: Pick<MenuSession, "locale" | "branchId" | "phoneNumberId">) {
  if (!screen.choices.length || screen.choices.length > (screen.kind === "buttons" ? 3 : 10)) throw Error("Invalid menu choice count");
  const session: MenuSession = { ...scope, nonce: crypto.randomUUID().replaceAll("-", "").slice(0, 16), createdAt: new Date().toISOString(), actions: screen.choices.map(c => c.action) };
  const options = screen.choices.map((c, i) => ({ id: `lm:${session.nonce}:${i}`, title: menuLabel(c.title, screen.kind === "buttons" ? 20 : 24), ...(c.description ? { description: menuLabel(c.description, 72) } : {}) }));
  // A usable fallback includes every visible choice; the controller accepts the fallback choice codes.
  const fallback = `${screen.text}\n\n${options.map((o, i) => `M${i + 1}. ${o.title}${o.description ? ` — ${o.description}` : ""}`).join("\n")}\n${scope.locale === "ar" ? "اكتب رمز الاختيار، مثل M1." : "Reply with a choice code, e.g. M1."}`;
  return { session, options, fallback };
}
export function resolveMenuAction(session: MenuSession | null, id: string, phoneNumberId: string, branchId: string | null, now = Date.now()): MenuAction | null {
  if (!session || session.phoneNumberId !== phoneNumberId || session.branchId !== branchId || !Number.isFinite(Date.parse(session.createdAt)) || now - Date.parse(session.createdAt) > 2 * 3600000) return null;
  const match = /^lm:([a-f0-9]{16}):(\d{1,2})$/.exec(id);
  return match && match[1] === session.nonce ? session.actions[Number(match[2])] ?? null : null;
}
