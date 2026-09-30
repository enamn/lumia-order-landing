import { db } from "@/server/db";
export function listBusinesses(userId: string) {
  return db.business.findMany({ where: { status: { not: "SUSPENDED" }, organization: { status: "ACTIVE", members: { some: { userId, status: "ACTIVE", user: { status: "ACTIVE", phoneNumberVerified: true } } } } },
    select: { id: true, name: true, organizationId: true, status: true, locations: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } });
}
export const profileInclude = { locations: { orderBy: { createdAt: "asc" as const }, include: { hours: { orderBy: { dayOfWeek: "asc" as const } } } }, onboarding: { include: { steps: true } } };
