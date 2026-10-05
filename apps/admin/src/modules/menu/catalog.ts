import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { entitlementsFor } from "@/modules/billing/service";

// Which menu applies. Starter and Plus have one menu for all branches. Pro can also give a branch its own menu; a branch without one uses the shared menu.
// A shared menu has no locationId (missing or null); a branch menu has the branch's ID.
type Client = Pick<typeof db, "catalog" | "location">;
// Menus created before branch menus existed have no locationId at all, which Prisma on MongoDB does not match with `null`.
export const SHARED: Pick<Prisma.CatalogWhereInput, "OR"> = { OR: [{ locationId: null }, { locationId: { isSet: false } }] };

const sharedId = async (c: Client, businessId: string) => (await c.catalog.findFirst({ where: { businessId, status: "ACTIVE", ...SHARED }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
const ownId = async (c: Client, businessId: string, branchId: string) => (await c.catalog.findFirst({ where: { businessId, status: "ACTIVE", locationId: branchId }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;

// The menu to read for a branch: its own (Pro), otherwise the shared menu. No branch, or a plan with one menu, always means the shared menu.
export async function catalogIdFor(client: Client, businessId: string, branchId?: string | null): Promise<string | null> {
  if (branchId && (await entitlementsFor(businessId)).menuPerBranch) { const own = await ownId(client, businessId, branchId); if (own) return own; }
  return sharedId(client, businessId);
}
// The menu to change. With a branch it must have its own menu already (so nothing lands in the shared menu by mistake); without one, null (= the shared menu).
export async function writableBranchCatalogId(client: Client, businessId: string, branchId?: string | null): Promise<string | null> {
  if (!branchId) return null;
  if (!(await entitlementsFor(businessId)).menuPerBranch) throw new AppError("NOT_PRO", "A separate menu for each branch is available on the Pro plan.", 409);
  if (!await client.location.findFirst({ where: { id: branchId, businessId } })) throw new AppError("NOT_FOUND", "Branch not found.", 404);
  const own = await ownId(client, businessId, branchId);
  if (!own) throw new AppError("BRANCH_MENU_MISSING", "Create a menu for this branch first.", 409);
  return own;
}
