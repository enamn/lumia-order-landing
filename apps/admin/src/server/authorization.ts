import type { Role, Prisma } from "@prisma/client";
import { db } from "./db";
import { AppError } from "./errors";
export type Permission = "read" | "business.manage" | "operations.manage" | "users.manage";
export const permissionRoles: Record<Permission, readonly Role[]> = {
  read: ["OWNER", "ADMIN", "MANAGER", "STAFF", "VIEWER"],
  "business.manage": ["OWNER", "ADMIN"],
  "operations.manage": ["OWNER", "ADMIN", "MANAGER"],
  "users.manage": ["OWNER", "ADMIN"],
};
export function can(role: Role, permission: Permission) { return permissionRoles[permission].includes(role); }
export async function authorize(userId: string, businessId: string, permission: Permission = "read", client: Prisma.TransactionClient = db) {
  const business = await client.business.findFirst({ where: { id: businessId, status: { not: "SUSPENDED" }, organization: { status: "ACTIVE", members: { some: { userId, status: "ACTIVE", user: { status: "ACTIVE", phoneNumberVerified: true } } } } }, include: { organization: { include: { members: { where: { userId, status: "ACTIVE" } } } } } });
  if (!business) throw new AppError("NOT_FOUND", "Business not found.", 404);
  const member = business.organization.members[0];
  if (!can(member.role, permission)) throw new AppError("FORBIDDEN", "You do not have permission to make this change.", 403);
  return { business, member };
}
