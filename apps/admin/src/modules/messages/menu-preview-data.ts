import type { Lang } from "@/modules/orders/draft";
import type { MenuProduct } from "./menu-presentation";
import { carouselBatch } from "./menu-carousel";
import { renderMenuCard } from "./menu-card-image";
export async function buildMenuPreview(name: string, currency: string, menu: MenuProduct[], locale: Lang, page = 0) {
  const batch = carouselBatch(menu, locale, currency, page);
  const cards = [];
  for (let index = 0; index < batch.items.length; index++) {
    const item = batch.items[index];
    cards.push({ ...batch.cards[index], imageUrl: item.imageUrl?.startsWith("https://") ? item.imageUrl : `data:image/png;base64,${(await renderMenuCard({ businessName: name, currency, item, locale })).toString("base64")}` });
  }
  return { ...batch, cards };
}
