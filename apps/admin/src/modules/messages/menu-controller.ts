import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { deliverCarousel, deliverText } from "./reply";
import { branchesScreen, prepareScreen, productScreen, resolveMenuAction, type MenuAction, type MenuProduct, type MenuScreen, type MenuSession } from "./menu-presentation";
import { carouselBatch, isAdviceNo, isAdviceYes, isMenuRequest, preferenceQuestion, prepareCarousel } from "./menu-carousel";
import { menuCardMedia } from "./menu-media";
import type { Lang, StoredDraft } from "@/modules/orders/draft";
export { isMenuRequest } from "./menu-carousel";

export type MenuContext = {
  businessId: string; conversationId: string; phone: string; phoneNumberId: string; businessName: string;
  account: { phoneNumberId: string | null; accessTokenEncrypted: string | null };
  text: string; interactiveId?: string | null; locale: Lang; session: MenuSession | null;
  branchId: string | null; branchNeeded: boolean; branches: { id: string; name: string }[];
  menu: MenuProduct[]; currency: string; open: boolean; closedMessage: string; greeting: boolean; resetDraft?: boolean;
  draft: StoredDraft | null; updatedAt: Date; lastInboundAt: Date;
  loadBranchMenu?: (branchId: string) => Promise<MenuProduct[]>;
};
const tr = (lang: Lang, ar: string, en: string) => lang === "ar" ? ar : en;
function assertWindow(ctx: MenuContext) {
  if (Date.now() - ctx.lastInboundAt.getTime() >= 24 * 3600000) throw new AppError("REPLY_WINDOW_CLOSED", "A new customer message is required.", 409);
}
async function record(ctx: MenuContext, id: string, text: string, type = "TEXT") {
  const at = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: ctx.conversationId, externalMessageId: id, direction: "OUTBOUND", senderType: "AI", messageType: type, textContent: text, status: "SENT", createdAt: at } }),
    db.conversation.update({ where: { id: ctx.conversationId }, data: { lastMessageAt: at } }),
  ]);
}
export async function sendConversationText(ctx: MenuContext, text: string, advice?: MenuSession["advice"]) {
  assertWindow(ctx);
  const id = await deliverText(ctx.account, ctx.phone, text);
  await record(ctx, id, text);
  // Never overwrite a newer menu page or cart action while a reply was in flight.
  if (ctx.session && advice !== undefined) await db.conversation.updateMany({ where: { id: ctx.conversationId, businessId: ctx.businessId, menuSession: { equals: ctx.session as never } }, data: { menuSession: { ...ctx.session, advice, ...(advice === "preference" ? { adviceOfferedAt: new Date().toISOString() } : {}) } as never } });
  return "sent" as const;
}
// Reserved for branch selection. The menu itself is never sent as a list.
export async function sendMenuScreen(ctx: MenuContext, screen: MenuScreen) {
  assertWindow(ctx);
  const prepared = prepareScreen(screen, { locale: ctx.locale, branchId: ctx.branchId, phoneNumberId: ctx.phoneNumberId });
  const changed = await db.conversation.updateMany({ where: { id: ctx.conversationId, businessId: ctx.businessId, updatedAt: ctx.updatedAt }, data: { menuSession: prepared.session as never } });
  if (!changed.count) throw new AppError("MENU_CHANGED", "Please ask for the menu again.", 409);
  const id = await deliverText(ctx.account, ctx.phone, screen.text, { kind: screen.kind, listButton: screen.listButton, options: prepared.options, fallbackText: prepared.fallback });
  await record(ctx, id, prepared.fallback);
  return "sent" as const;
}
export async function sendMenuCarousel(ctx: MenuContext, page = 0) {
  assertWindow(ctx);
  if (ctx.branchNeeded) return sendMenuScreen(ctx, branchesScreen(ctx.branches, ctx.locale));
  const batch = carouselBatch(ctx.menu, ctx.locale, ctx.currency, page);
  if (!batch.items.length) return sendConversationText(ctx, tr(ctx.locale, "ما في أصناف متاحة حالياً. اكتب «مساعدة» ليتواصل معك الفريق.", "No items are available right now. Type “help” to reach our team."), null);
  const prepared = prepareCarousel(batch, { locale: ctx.locale, branchId: ctx.branchId, phoneNumberId: ctx.phoneNumberId });
  const cards: Parameters<typeof deliverCarousel>[3] = [];
  // Keep uploads bounded while preparing independent cards in pairs.
  for (let start = 0; start < batch.items.length; start += 2) {
    await Promise.all(batch.items.slice(start, start + 2).map(async (item, offset) => {
      const index = start + offset;
      const image = await menuCardMedia({ businessId: ctx.businessId, businessName: ctx.businessName, account: ctx.account, item, locale: ctx.locale, currency: ctx.currency });
      const card = prepared.cards[index]; cards[index] = { image, text: card.body, buttonId: card.buttonId, buttonTitle: card.buttonTitle };
    }));
  }
  assertWindow(ctx);
  const session = prepared.session;
  const reserved = await db.conversation.updateMany({ where: { id: ctx.conversationId, businessId: ctx.businessId, updatedAt: ctx.updatedAt }, data: { branchId: ctx.branchId, menuSession: session as never, ...(ctx.resetDraft ? { draftOrder: null } : {}) } });
  if (!reserved.count) throw new AppError("MENU_CHANGED", "Please ask for the menu again.", 409);
  let id: string;
  try { id = await deliverCarousel(ctx.account, ctx.phone, batch.text, cards); }
  catch (error) {
    await db.conversation.updateMany({ where: { id: ctx.conversationId, menuSession: { equals: session as never } }, data: { menuSession: ctx.session as never } });
    throw error; // No list fallback and no false advice offer after a failed carousel.
  }
  await record(ctx, id, [batch.text, ...batch.cards.map(c => `${c.name} — ${c.price}`)].join("\n"), batch.items.length === 1 ? "MENU_CARD" : "CAROUSEL");
  const hint = `${!ctx.open ? `${ctx.closedMessage}\n\n` : ""}${batch.hint}`;
  const followId = await deliverText(ctx.account, ctx.phone, hint, prepared.navigation.length ? { kind: "buttons", options: prepared.navigation, fallbackText: `${hint}\n${prepared.navigation.map((o, i) => `M${batch.items.length + i + 1}. ${o.title}`).join("\n")}` } : undefined);
  await record(ctx, followId, hint);
  await db.conversation.updateMany({ where: { id: ctx.conversationId, menuSession: { equals: session as never } }, data: { menuSession: { ...session, advice: "offered", adviceOfferedAt: new Date().toISOString() } as never } });
  return "sent" as const;
}
// Non-menu text/voice stays in the existing AI order flow. No button here adds or confirms an item.
export async function handleMenu(ctx: MenuContext): Promise<"sent" | null> {
  assertWindow(ctx);
  let action: MenuAction | null = null;
  if (ctx.interactiveId?.startsWith("lm:")) {
    action = resolveMenuAction(ctx.session, ctx.interactiveId, ctx.phoneNumberId, ctx.branchId);
    if (!action) return sendConversationText(ctx, tr(ctx.locale, "انتهت صلاحية الاختيار. اكتب «منيو» لعرض القائمة الحالية.", "That selection has expired. Send “menu” for the current menu."));
    ctx.locale = ctx.session?.locale ?? ctx.locale;
  } else if (isMenuRequest(ctx.text)) action = { kind: "menu" };
  else if (ctx.session?.view === "carousel" && ctx.session.phoneNumberId === ctx.phoneNumberId && ctx.session.branchId === ctx.branchId && /^(المزيد|التالي|more|more items|next page)[.!؟?\s]*$/iu.test(ctx.text.trim())) action = { kind: "menu", page: (ctx.session.page ?? 0) + 1 };
  else if (ctx.session?.view === "carousel" && ctx.session.phoneNumberId === ctx.phoneNumberId && ctx.session.branchId === ctx.branchId && /^(السابق|previous|previous page)[.!؟?\s]*$/iu.test(ctx.text.trim())) action = { kind: "menu", page: (ctx.session.page ?? 0) - 1 };
  else if (/^M\d{1,2}$/i.test(ctx.text.trim()) && ctx.session) action = resolveMenuAction(ctx.session, `lm:${ctx.session.nonce}:${Number(ctx.text.trim().slice(1)) - 1}`, ctx.phoneNumberId, ctx.branchId);
  else if (/^(help|human|مساعدة|موظف)$/iu.test(ctx.text.trim())) action = { kind: "human" };
  if (!action && ctx.session?.advice && ctx.session.phoneNumberId === ctx.phoneNumberId && ctx.session.branchId === ctx.branchId) {
    ctx.locale = ctx.session!.locale;
    if (isAdviceYes(ctx.text)) return sendConversationText(ctx, preferenceQuestion(ctx.menu, ctx.locale), "preference");
    if (isAdviceNo(ctx.text)) return sendConversationText(ctx, tr(ctx.locale, "تمام 👍 اكتب طلبك أو ابعت فويس لما تختار.", "No problem 👍 Type your order or send a voice message when you’re ready."), null);
  }
  if (!action) return null;
  if (action.kind === "human" || action.kind === "customize") {
    await sendConversationText(ctx, tr(ctx.locale, "أكيد، سيساعدك أحد من فريق المطعم.", "Of course—a member of the restaurant team will help you."), null);
    await db.conversation.update({ where: { id: ctx.conversationId }, data: { needsHuman: true, aiPausedUntil: new Date(Date.now() + 30 * 60000) } });
    return "sent";
  }
  if (action.kind === "branches") return sendMenuScreen(ctx, branchesScreen(ctx.branches, ctx.locale, action.page));
  if (action.kind === "branch") {
    const branch = ctx.branches.find(b => b.id === action.branchId);
    if (!branch || !ctx.loadBranchMenu) return sendConversationText(ctx, tr(ctx.locale, "هذا الفرع غير متاح. اكتب «منيو» من جديد.", "This branch is unavailable. Please send “menu” again."));
    ctx.menu = await ctx.loadBranchMenu(branch.id); ctx.resetDraft = ctx.branchId !== branch.id && !!ctx.draft; ctx.branchId = branch.id; ctx.branchNeeded = false;
    return sendMenuCarousel(ctx);
  }
  if (ctx.branchNeeded) return sendMenuScreen(ctx, branchesScreen(ctx.branches, ctx.locale));
  if (action.kind === "product") {
    const item = ctx.menu.find(i => i.itemId === action.itemId && i.available);
    return sendConversationText(ctx, item ? productScreen(item, ctx.locale, ctx.currency).text : tr(ctx.locale, "هذا الصنف غير متاح الآن. اكتب «منيو» لتشوف الخيارات الحالية.", "This item is unavailable now. Send “menu” to see current options."));
  }
  if (action.kind === "menu") return sendMenuCarousel(ctx, action.page);
  // Legacy menu/cart buttons cannot mutate a cart after moving to conversational browsing.
  return sendMenuCarousel(ctx);
}
