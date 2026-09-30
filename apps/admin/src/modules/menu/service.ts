import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";

const opt = (max: number) => z.string().trim().max(max).optional().default("");
export const addItemSchema = z.object({ name: opt(120), nameAr: opt(120), category: opt(60), categoryAr: opt(60), price: z.number().min(0).max(100000) }).strict()
  .refine(v => v.name || v.nameAr, "Enter the item name in English or Arabic.").refine(v => v.category || v.categoryAr, "Enter a category in English or Arabic.");
export const availabilitySchema = z.object({ isAvailable: z.boolean().optional(), nameAr: z.string().trim().max(120).optional() }).strict().refine(v => v.isAvailable !== undefined || v.nameAr !== undefined, "Nothing to update.");

export interface MenuItem { id: string; name: string; nameAr: string; priceMinor: number; currency: string; isAvailable: boolean }
export interface MenuCategory { id: string; name: string; nameAr: string; items: MenuItem[] }

// Read-only members can see the menu; changing it needs operations.manage.
export async function getMenu(userId: string, businessId: string): Promise<MenuCategory[]> {
  await authorize(userId, businessId);
  const catalog = await db.catalog.findFirst({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, include: { categories: { orderBy: { sortOrder: "asc" } }, items: { where: { status: "ACTIVE" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } });
  if (!catalog) return [];
  const groups = catalog.categories.map(c => ({ id: c.id, name: c.name, nameAr: c.nameAr ?? "", items: [] as MenuItem[] }));
  const other: MenuCategory = { id: "other", name: "Other", nameAr: "أخرى", items: [] };
  for (const i of catalog.items) {
    const item = { id: i.id, name: i.name, nameAr: i.nameAr ?? "", priceMinor: i.basePriceMinor, currency: i.currencyCode, isAvailable: i.isAvailable };
    (groups.find(g => g.id === i.categoryId) ?? other).items.push(item);
  }
  return [...groups, other].filter(g => g.items.length);
}

export async function setItemAvailability(userId: string, businessId: string, itemId: string, input: unknown, requestId: string) {
  const { isAvailable, nameAr } = availabilitySchema.parse(input);
  return transaction(async tx => {
    const { business } = await authorize(userId, businessId, "operations.manage", tx);
    const item = await tx.catalogItem.findFirst({ where: { id: itemId, catalog: { businessId } } });
    if (!item) throw new AppError("NOT_FOUND", "Menu item not found.", 404);
    await tx.catalogItem.update({ where: { id: itemId }, data: { ...(isAvailable !== undefined ? { isAvailable } : {}), ...(nameAr !== undefined ? { nameAr: nameAr || null } : {}) } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "CatalogItem", entityId: itemId, action: nameAr !== undefined ? "menu.item.updated" : "menu.item.availability", requestId, beforeData: { isAvailable: item.isAvailable, nameAr: item.nameAr }, afterData: { isAvailable: isAvailable ?? item.isAvailable, nameAr: nameAr ?? item.nameAr } } });
    return { id: itemId, isAvailable: isAvailable ?? item.isAvailable, nameAr: nameAr ?? item.nameAr ?? "" };
  });
}

export async function addItem(userId: string, businessId: string, input: unknown, requestId: string) {
  const data = addItemSchema.parse(input);
  return transaction(async tx => {
    const { business } = await authorize(userId, businessId, "operations.manage", tx);
    const catalog = await tx.catalog.findFirst({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, include: { categories: true } })
      ?? await tx.catalog.create({ data: { businessId, name: "Menu", status: "ACTIVE" }, include: { categories: true } });
    const key = (data.category || data.categoryAr).toLowerCase();
    const category = catalog.categories.find(c => (c.name || c.nameAr || "").toLowerCase() === key)
      ?? await tx.catalogCategory.create({ data: { catalogId: catalog.id, name: data.category, nameAr: data.categoryAr || null, sortOrder: catalog.categories.length } });
    const item = await tx.catalogItem.create({ data: { catalogId: catalog.id, categoryId: category.id, name: data.name, nameAr: data.nameAr || null, basePriceMinor: Math.round(data.price * 100), currencyCode: "AED", status: "ACTIVE" } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "CatalogItem", entityId: item.id, action: "menu.item.created", requestId } });
    return { id: item.id };
  });
}
