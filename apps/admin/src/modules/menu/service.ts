import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { entitlementsFor } from "@/modules/billing/service";
import { SHARED, catalogIdFor, writableBranchCatalogId } from "./catalog";

const opt = (max: number) => z.string().trim().max(max).optional().default("");
export const addItemSchema = z.object({ name: opt(120), nameAr: opt(120), category: opt(60), categoryAr: opt(60), price: z.number().min(0).max(100000) }).strict()
  .refine(v => v.name || v.nameAr, "Enter the item name in English or Arabic.").refine(v => v.category || v.categoryAr, "Enter a category in English or Arabic.");
export const availabilitySchema = z.object({ isAvailable: z.boolean().optional(), nameAr: z.string().trim().max(120).optional() }).strict().refine(v => v.isAvailable !== undefined || v.nameAr !== undefined, "Nothing to update.");

export interface MenuItem { id: string; name: string; nameAr: string; priceMinor: number; currency: string; isAvailable: boolean }
export interface MenuCategory { id: string; name: string; nameAr: string; items: MenuItem[] }

// Read-only members can see the menu; changing it needs operations.manage.
export async function getMenu(userId: string, businessId: string, branchId?: string | null): Promise<MenuCategory[]> {
  await authorize(userId, businessId);
  const id = await catalogIdFor(db, businessId, branchId);
  const catalog = id ? await db.catalog.findUnique({ where: { id }, include: { categories: { orderBy: { sortOrder: "asc" } }, items: { where: { status: "ACTIVE" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } }) : null;
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

export async function addItem(userId: string, businessId: string, input: unknown, requestId: string, branchId?: string | null) {
  const data = addItemSchema.parse(input);
  return transaction(async tx => {
    const { business } = await authorize(userId, businessId, "operations.manage", tx);
    const ownId = await writableBranchCatalogId(tx, businessId, branchId);
    const catalog = (ownId ? await tx.catalog.findUnique({ where: { id: ownId }, include: { categories: true } }) : null) ?? await tx.catalog.findFirst({ where: { businessId, status: "ACTIVE", ...SHARED }, orderBy: { createdAt: "asc" }, include: { categories: true } })
      ?? await tx.catalog.create({ data: { businessId, name: "Menu", status: "ACTIVE" }, include: { categories: true } });
    const key = (data.category || data.categoryAr).toLowerCase();
    const category = catalog.categories.find(c => (c.name || c.nameAr || "").toLowerCase() === key)
      ?? await tx.catalogCategory.create({ data: { catalogId: catalog.id, name: data.category, nameAr: data.categoryAr || null, sortOrder: catalog.categories.length } });
    const item = await tx.catalogItem.create({ data: { catalogId: catalog.id, categoryId: category.id, name: data.name, nameAr: data.nameAr || null, basePriceMinor: Math.round(data.price * 100), currencyCode: "AED", status: "ACTIVE" } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "CatalogItem", entityId: item.id, action: "menu.item.created", requestId } });
    return { id: item.id };
  });
}

// ---- Pro: a menu for each branch ----
export async function getMenuScopes(userId: string, businessId: string) {
  await authorize(userId, businessId);
  const e = await entitlementsFor(businessId);
  if (!e.menuPerBranch) return { menuPerBranch: false as const, branches: [] };
  const [branches, catalogs] = await Promise.all([db.location.findMany({ where: { businessId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, status: true } }), db.catalog.findMany({ where: { businessId, status: "ACTIVE" }, select: { locationId: true, _count: { select: { items: { where: { status: "ACTIVE" } } } } } })]);
  const own = new Map(catalogs.filter(c => c.locationId).map(c => [c.locationId, c._count.items]));
  return { menuPerBranch: true as const, branches: branches.map(b => ({ id: b.id, name: b.name, active: b.status === "ACTIVE", hasOwnMenu: own.has(b.id), items: own.get(b.id) ?? 0 })) };
}
const createSchema = z.object({ copy: z.boolean() }).strict();
// Gives one branch its own menu, starting as a copy of the shared menu or empty.
export async function createBranchMenu(userId: string, businessId: string, branchId: string, input: unknown, requestId: string) {
  const { copy } = createSchema.parse(input);
  return transaction(async tx => {
    const { business } = await authorize(userId, businessId, "operations.manage", tx);
    if (!(await entitlementsFor(businessId)).menuPerBranch) throw new AppError("NOT_PRO", "A separate menu for each branch is available on the Pro plan.", 409);
    const branch = await tx.location.findFirst({ where: { id: branchId, businessId } });
    if (!branch) throw new AppError("NOT_FOUND", "Branch not found.", 404);
    if (await tx.catalog.findFirst({ where: { businessId, status: "ACTIVE", locationId: branchId } })) throw new AppError("CONFLICT", "This branch already has its own menu.", 409);
    const made = await tx.catalog.create({ data: { businessId, locationId: branchId, name: `${branch.name} menu`, status: "ACTIVE" } });
    let items = 0;
    if (copy) {
      const shared = await tx.catalog.findFirst({ where: { businessId, status: "ACTIVE", ...SHARED }, orderBy: { createdAt: "asc" }, include: { categories: { orderBy: { sortOrder: "asc" } }, items: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } } });
      const ids = new Map<string, string>();
      for (const c of shared?.categories ?? []) ids.set(c.id, (await tx.catalogCategory.create({ data: { catalogId: made.id, name: c.name, nameAr: c.nameAr, sortOrder: c.sortOrder } })).id);
      for (const i of shared?.items ?? []) { await tx.catalogItem.create({ data: { catalogId: made.id, categoryId: i.categoryId ? ids.get(i.categoryId) ?? null : null, name: i.name, nameAr: i.nameAr, description: i.description, descriptionAr: i.descriptionAr, basePriceMinor: i.basePriceMinor, currencyCode: i.currencyCode, status: "ACTIVE", isAvailable: i.isAvailable, sortOrder: i.sortOrder } }); items++; }
    }
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Catalog", entityId: made.id, action: "menu.branch.created", requestId, afterData: { branchId, copy, items } } });
    return { branchId, items };
  });
}
// The branch goes back to the shared menu (its own menu is archived, not deleted).
export async function removeBranchMenu(userId: string, businessId: string, branchId: string, requestId: string) {
  return transaction(async tx => {
    const { business } = await authorize(userId, businessId, "operations.manage", tx);
    const found = await tx.catalog.findMany({ where: { businessId, status: "ACTIVE", locationId: branchId } });
    if (!found.length) throw new AppError("NOT_FOUND", "This branch has no menu of its own.", 404);
    await tx.catalog.updateMany({ where: { id: { in: found.map(c => c.id) } }, data: { status: "ARCHIVED" } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Catalog", entityId: found[0]!.id, action: "menu.branch.removed", requestId, afterData: { branchId } } });
    return { branchId };
  });
}
