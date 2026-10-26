import { z } from "zod";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import type { DraftMenu } from "./import";

// Reading a menu from a restaurant's own Talabat page. The page carries its menu as data (no AI needed): categories with items, names and prices, in the page's language.
// The Arabic and English versions of the page are both read, so each item gets both names. Only talabat.com is fetched (never an address the visitor can point elsewhere).
const HOSTS = new Set(["talabat.com", "www.talabat.com"]);
const MAX_HTML = 6 * 1048576, MAX_ITEMS = 1200, MAX_CATEGORIES = 120;
const urlSchema = z.object({ url: z.string().trim().min(10).max(500) }).strict();

// "https://www.talabat.com/ar/uae/restaurant/728554/omar-laffah-restaurant?aid=1525" -> the same page in Arabic and in English. null when it is not a Talabat restaurant page.
export function talabatPages(raw: string): { ar: string; en: string } | null {
  let u: URL; try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" || !HOSTS.has(u.hostname) || u.username || u.password || (u.port && u.port !== "443")) return null;
  const m = /^(?:\/(?:ar|en))?\/([a-z-]{2,20})\/restaurant\/(\d{1,9})\/([A-Za-z0-9._~%-]{1,120})\/?$/.exec(u.pathname);
  if (!m) return null;
  const aid = /^\d{1,9}$/.test(u.searchParams.get("aid") ?? "") ? `?aid=${u.searchParams.get("aid")}` : ""; // the delivery area the menu is shown for
  const at = (lang: string) => `https://www.talabat.com/${lang}/${m[1]}/restaurant/${m[2]}/${m[3]}${aid}`;
  return { ar: at("ar"), en: at("en") };
}

export interface TalabatItem { id: number; name: string; price: number | null }
export interface TalabatCategory { id: number; name: string; items: TalabatItem[] }
// Sections a restaurant adds only to promote items that already sit in their real category ("Picks for you", "Special offers", "30 or less"...).
const PROMO = /pick|recommend|popular|best.?sell|top.?rated|offer|deal|discount|promo|under|or less|less than|trending|عرض|عروض|خصم|اختيارات|مختارات|الأكثر|مقترح|أقل|اقل/i;

// The menu inside the page's data: categories in order, each item once (in its real category rather than a promotional one).
export function parseTalabatMenu(html: string): { restaurant: string; categories: TalabatCategory[] } | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  let data: any; try { data = JSON.parse(m[1]!); } catch { return null; }
  const state = data?.props?.pageProps?.initialMenuState, cats: any[] = state?.menuData?.categories;
  if (!Array.isArray(cats) || !cats.length) return null;
  const clean = (v: unknown, max: number) => String(v ?? "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max);
  const isPromo = (c: any) => Number(c?.id) < 0 || PROMO.test(String(c?.name ?? ""));
  const placed = new Set<number>(), out: TalabatCategory[] = [];
  // Real categories first, then promotional ones for items that exist nowhere else.
  for (const pass of [false, true]) for (const c of cats) {
    if (isPromo(c) !== pass || !Array.isArray(c.items)) continue;
    const items: TalabatItem[] = [];
    for (const i of c.items) {
      const id = Number(i?.id); if (!Number.isFinite(id) || placed.has(id)) continue;
      const name = clean(i.name, 120); if (!name) continue;
      const p = Number(i.price); placed.add(id); items.push({ id, name, price: Number.isFinite(p) && p > 0 && p <= 100000 ? p : null });
    }
    if (items.length) out.push({ id: Number(c.id), name: clean(c.name, 60).replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, "").trim() || clean(c.name, 60), items });
  }
  // Keep the page's own order for the categories (promotional ones last only because they came last in this pass).
  const order = new Map(cats.map((c, n) => [Number(c.id), n]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return out.length ? { restaurant: clean(state?.restaurant?.name, 120), categories: out } : null;
}

// Both languages into one draft: names from the English page, Arabic names from the Arabic page, matched by id.
export function mergeLanguages(ar: ReturnType<typeof parseTalabatMenu>, en: ReturnType<typeof parseTalabatMenu>): DraftMenu {
  const base = ar ?? en!, enCats = new Map((en?.categories ?? []).map(c => [c.id, c])), enItems = new Map((en?.categories ?? []).flatMap(c => c.items).map(i => [i.id, i]));
  const categories = base.categories.slice(0, MAX_CATEGORIES).map(c => ({
    name: ar ? enCats.get(c.id)?.name ?? "" : c.name, nameAr: ar ? c.name : "",
    items: c.items.map(i => { const e = enItems.get(i.id); const price = i.price ?? e?.price ?? null; return { name: ar ? e?.name ?? "" : i.name, nameAr: ar ? i.name : "", price, flagged: price == null }; }),
  }));
  let left = MAX_ITEMS; // a menu this large is not a restaurant's menu: stop at a sensible size
  return { categories: categories.map(c => { const items = c.items.slice(0, Math.max(0, left)); left -= items.length; return { ...c, items }; }).filter(c => c.items.length) };
}

async function page(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "LumiaOrder/1.0 (menu import; +https://order.lumia.ae)", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    const host = new URL(res.url).hostname;
    if (!res.ok || !HOSTS.has(host)) return null;
    const text = await res.text();
    return text.length > MAX_HTML ? null : text;
  } catch { return null; }
}

export async function extractMenuFromUrl(userId: string, businessId: string, input: unknown): Promise<DraftMenu> {
  await authorize(userId, businessId, "operations.manage");
  const { url } = urlSchema.parse(input);
  const pages = talabatPages(url);
  if (!pages) throw new AppError("UNSUPPORTED_LINK", "Paste the link of your restaurant's Talabat page (it looks like talabat.com/uae/restaurant/…).", 422);
  const [arHtml, enHtml] = await Promise.all([page(pages.ar), page(pages.en)]);
  const ar = arHtml ? parseTalabatMenu(arHtml) : null, en = enHtml ? parseTalabatMenu(enHtml) : null;
  if (!ar && !en) throw new AppError(arHtml || enHtml ? "NO_MENU_FOUND" : "LINK_UNREACHABLE", arHtml || enHtml ? "We couldn’t find a menu on that page. Check the link, or upload a file instead." : "We couldn’t open that link right now. Try again in a minute, or upload a file instead.", arHtml || enHtml ? 422 : 502);
  return mergeLanguages(ar, en);
}
