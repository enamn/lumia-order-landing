import type { Lang } from "@/modules/orders/draft";
import { amountText } from "@/modules/market/money";
import { menuLabel, productName, type MenuAction, type MenuProduct, type MenuSession } from "./menu-presentation";

export const MENU_BATCH_SIZE = 8;
export const menuHint = (lang: Lang) => lang === "ar" ? "اكتب طلبك أو ابعت فويس 🎤\nوإذا محتار، بتحب أساعدك تختار؟" : "Type your order or send a voice message 🎤\nWould you like help choosing?";
export function isMenuRequest(text: string): boolean {
  const value = text.normalize("NFKC").replace(/[\u064B-\u065F\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/[.!؟?،,]+/g, " ").replace(/\s+/g, " ").trim();
  return /^(menu|view menu|show (me )?(the )?menu|what (do you have|is on the menu|can i order)|منيو|المنيو|قائمة|القائمة|عرض المنيو|قائمة الطعام|شو (في )?عندك[من]?|شو عندكم|شنو عندك[من]?|وش عندك[من]?|ايش عندك[من]?|ماذا لديكم|شو الاكل عندكم)$/iu.test(value);
}
export const isAdviceYes = (text: string) => /^(yes|yeah|yep|sure|please|yes please|help me choose|what do you (think|recommend)|نعم|اي|ايه|اه|اكيد|طبعا|تمام|ساعدني|ساعدني اختار|شو بتنصحني|شو رايك)[.!؟?\s]*$/iu.test(text.normalize("NFKC").replace(/[\u064B-\u065F\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").trim());
export const isAdviceNo = (text: string) => /^(no|no thanks|not now|لا|لا شكرا|لا شكراً|مش هلأ|مو هلا|مش هلا)[.!؟?\s]*$/iu.test(text.trim());
export function adviceIsActive(session: MenuSession | null, phoneNumberId: string, branchId: string | null, now = Date.now()) {
  return !!session?.advice && session.phoneNumberId === phoneNumberId && session.branchId === branchId && Number.isFinite(Date.parse(session.adviceOfferedAt ?? "")) && now - Date.parse(session.adviceOfferedAt!) < 2 * 3600000;
}
export function preferenceQuestion(menu: MenuProduct[], lang: Lang) {
  const categories = [...new Set(menu.filter(i => i.available).map(i => (lang === "ar" ? i.categoryAr || i.category : i.category || i.categoryAr) || ""))].filter(Boolean).slice(0, 3);
  return lang === "ar" ? categories.length > 1 ? `أكيد 😋 بتفضّل أي قسم: ${categories.join("، ")}؟` : "أكيد 😋 شو بتحب عادةً، أو في صنف معيّن ببالك؟" : categories.length > 1 ? `Of course! Which do you prefer: ${categories.join(", ")}?` : "Of course! What do you usually like, or is there an item you have in mind?";
}
export function carouselBatch(menu: MenuProduct[], lang: Lang, currency: string, requestedPage = 0) {
  // Array order follows the configured item sort order; category order groups it without dropping items.
  const items = menu.filter(i => i.available).slice().sort((a, b) => a.categoryOrder - b.categoryOrder);
  const pages: MenuProduct[][] = [];
  for (let i = 0; i < items.length; i += MENU_BATCH_SIZE) pages.push(items.slice(i, i + MENU_BATCH_SIZE));
  // A native carousel needs at least two cards. Balance a single trailing item into a final pair.
  if (pages.length > 1 && pages.at(-1)!.length === 1) pages.at(-1)!.unshift(pages.at(-2)!.pop()!);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(0, Math.min(requestedPage, pages.length - 1)) : 0;
  const selected = pages[page] ?? [];
  return { page, pageCount: pages.length, total: items.length, items: selected, text: lang === "ar" ? `تفضل المنيو 😋 اسحب لتشوف الأصناف.\nالدفعة ${page + 1} من ${pages.length || 1}` : `Here’s our menu 😋 Swipe to browse.\nBatch ${page + 1} of ${pages.length || 1}`, hint: menuHint(lang), cards: selected.map(item => ({ itemId: item.itemId, name: productName(item, lang), category: (lang === "ar" ? item.categoryAr || item.category : item.category || item.categoryAr) || "", price: `${amountText(item.priceMinor, currency)} ${currency}`, body: `${menuLabel(productName(item, lang), 120)}\n${amountText(item.priceMinor, currency)} ${currency}`, buttonTitle: lang === "ar" ? "التفاصيل" : "Details", imageUrl: item.imageUrl ?? null })), navigation: [
    ...(page > 0 ? [{ title: lang === "ar" ? "السابق" : "Previous", action: { kind: "menu", page: page - 1 } as MenuAction }] : []),
    ...(page + 1 < pages.length ? [{ title: lang === "ar" ? "المزيد" : "More", action: { kind: "menu", page: page + 1 } as MenuAction }] : []),
  ] };
}
export function prepareCarousel(batch: ReturnType<typeof carouselBatch>, scope: Pick<MenuSession, "locale" | "branchId" | "phoneNumberId">) {
  const session: MenuSession = { ...scope, nonce: crypto.randomUUID().replaceAll("-", "").slice(0, 16), createdAt: new Date().toISOString(), view: "carousel", page: batch.page, advice: null, actions: [...batch.items.map(item => ({ kind: "product" as const, itemId: item.itemId })), ...batch.navigation.map(n => n.action)] };
  const id = (i: number) => `lm:${session.nonce}:${i}`;
  return { session, cards: batch.cards.map((card, i) => ({ ...card, buttonId: id(i) })), navigation: batch.navigation.map((n, i) => ({ id: id(batch.items.length + i), title: n.title })) };
}
export function recommendationText(menu: MenuProduct[], ids: string[], lang: Lang, currency: string) {
  const items = [...new Set(ids)].map(id => menu.find(i => i.index === id && i.available)).filter((i): i is MenuProduct => !!i).slice(0, 3);
  if (!items.length) return lang === "ar" ? "ما عندي معلومات كافية لأرشّح بثقة حسب طلبك. احكيلي أي صنف لفت نظرك، أو اكتب «مساعدة» ليعاونك الفريق." : "I don’t have enough information to recommend confidently for that preference. Tell me which item caught your eye, or type “help” for our team.";
  return [lang === "ar" ? "ممكن تعجبك هالأصناف 😋" : "You might like these 😋", ...items.map(i => `• ${productName(i, lang)} — ${amountText(i.priceMinor, currency)} ${currency}`), lang === "ar" ? "إذا اخترت، اكتب اسم الصنف والكمية أو ابعت فويس 🎤" : "When you’ve chosen, type the item and quantity or send a voice message 🎤"].join("\n");
}
