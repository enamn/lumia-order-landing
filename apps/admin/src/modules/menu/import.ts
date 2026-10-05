import { z } from "zod";
import { authorize } from "@/server/authorization";
import { transaction } from "@/server/transaction";
import { AppError } from "@/server/errors";
import { consume, refund } from "@/modules/billing/usage";
import { lumiaApi } from "@/server/lumia-api";

const MAX_FILE_BYTES = 8 * 1048576;
const uploadSchema = z.object({ fileName: z.string().trim().min(1).max(200), mediaType: z.enum(["application/pdf", "image/png", "image/jpeg"]), data: z.string().min(1) }).strict();
const en = (max: number) => z.string().trim().max(max).optional().default("");
const named = <T extends { name: string; nameAr: string }>(v: T) => Boolean(v.name || v.nameAr);
export const confirmSchema = z.object({ categories: z.array(z.object({ name: en(60), nameAr: en(60), items: z.array(z.object({ name: en(120), nameAr: en(120), price: z.number().min(0).max(100000) }).strict().refine(named, "Each item needs a name.")).min(1).max(300) }).strict().refine(named, "Each category needs a name.")).min(1).max(40) }).strict();

export interface DraftMenu { categories: { name: string; nameAr: string; items: { name: string; nameAr: string; price: number | null; flagged: boolean }[] }[] }

// Reading the menu file (Claude) happens in lumia-order-api; this app only authorizes, forwards and later saves the confirmed draft.
export async function extractMenu(userId: string, businessId: string, input: unknown): Promise<DraftMenu> {
  await authorize(userId, businessId, "operations.manage");
  const file = uploadSchema.parse(input);
  if (!/^[A-Za-z0-9+/=]+$/.test(file.data) || file.data.length * 0.75 > MAX_FILE_BYTES) throw new AppError("FILE_TOO_LARGE", "That file is too large. Use a file under 8 MB.", 413);
  const taken = await consume(businessId, "imports"); // AI menu reading is counted per month
  if (!taken.ok) throw new AppError("LIMIT_REACHED", "You’ve used all AI menu imports included in your plan this month. You can add items manually, or upgrade your plan.", 429);
  const result = await lumiaApi<DraftMenu>("/internal/menu/extract", { mediaType: file.mediaType, data: file.data }, 130000);
  if (result.ok) return result.data;
  await refund(businessId, "imports", taken); // nothing was read, so it does not count
  if (result.code === "AI_NOT_CONFIGURED") throw new AppError("AI_NOT_CONFIGURED", "AI menu import isn’t available yet. You can add your menu manually.", 503);
  if (result.code === "NO_MENU_FOUND") throw new AppError("NO_MENU_FOUND", "We couldn’t find a menu in that file. Try another file or add items manually.", 422);
  throw new AppError("AI_FAILED", "We couldn’t read that menu. Try a clearer photo or PDF, or add items manually.", 502);
}

type Tx = Parameters<Parameters<typeof transaction>[0]>[0];
export interface SaveItem { name: string; nameAr?: string; price: number }
export interface SaveCategory { name: string; nameAr?: string; items: SaveItem[] }
// Writes categories/items into the business's active catalog. `replace` archives the existing active items first.
export async function saveMenu(tx: Tx, business: { organizationId: string }, userId: string, businessId: string, categories: SaveCategory[], requestId: string, action: string, replace = false) {
  const withRels = { categories: true, items: { where: { status: "ACTIVE" }, select: { categoryId: true, name: true, nameAr: true } } } as const;
  const catalog = await tx.catalog.findFirst({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, include: withRels }) ?? await tx.catalog.create({ data: { businessId, name: "Menu", status: "ACTIVE" }, include: withRels });
  if (replace) await tx.catalogItem.updateMany({ where: { catalogId: catalog.id, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
  const existing = new Set(replace ? [] : catalog.items.map(i => `${i.categoryId}|${(i.name || i.nameAr || "").toLowerCase()}`)); let order = catalog.categories.length; let created = 0;
  for (const c of categories) {
    const key = (c.name || c.nameAr || "").toLowerCase();
    const category = catalog.categories.find(x => (x.name || x.nameAr || "").toLowerCase() === key) ?? await tx.catalogCategory.create({ data: { catalogId: catalog.id, name: c.name, nameAr: c.nameAr || null, sortOrder: order++ } });
    const fresh = c.items.filter(i => !existing.has(`${category.id}|${(i.name || i.nameAr || "").toLowerCase()}`));
    if (fresh.length) await tx.catalogItem.createMany({ data: fresh.map((i, n) => ({ catalogId: catalog.id, categoryId: category.id, name: i.name, nameAr: i.nameAr || null, basePriceMinor: Math.round(i.price * 100), currencyCode: "AED", status: "ACTIVE", sortOrder: n })) });
    created += fresh.length;
  }
  await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Catalog", entityId: catalog.id, action, requestId, afterData: { items: created, replace } } });
  return { created };
}
export async function confirmImport(userId: string, businessId: string, input: unknown, requestId: string) {
  const { categories } = confirmSchema.parse(input);
  return transaction(async tx => { const { business } = await authorize(userId, businessId, "operations.manage", tx); return saveMenu(tx, business, userId, businessId, categories, requestId, "menu.imported"); });
}
