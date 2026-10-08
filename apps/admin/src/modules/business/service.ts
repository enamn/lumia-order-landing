import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { profileInclude, listBusinesses } from "./repository";
import { createBusinessSchema, profileSchema, locationUpdateSchema, memberSchema } from "./validators";
import { steps, evaluateReadiness } from "../onboarding/readiness";
import { MARKETS, isCountryCode, marketFromDial } from "../market/countries";
import { requireRegistration } from "../market/service";

export async function createBusiness(userId: string, input: unknown, requestId: string) {
  const data = createBusinessSchema.parse(input);
  return transaction(async tx => {
    // Updating the user serializes concurrent initial workspace creation in MongoDB.
    const owner = await tx.user.findFirst({ where: { id: userId, status: "ACTIVE", phoneNumberVerified: true } });
    if (!owner) throw new AppError("UNAUTHENTICATED", "Verify your phone number to continue.", 401);
    await tx.user.update({ where: { id: userId }, data: { workspaceInitialized: true } });
    // The restaurant's country is the country of the owner's phone number at the first sign-in (+971 UAE, +966 Saudi Arabia, ...) and never changes: its currency, time zone and tax follow from it.
    // A brand in a second country opens a second account with a phone number of that country.
    const own = marketFromDial(owner.phoneNumber)?.code;
    if (!own) throw new AppError("COUNTRY_NOT_SUPPORTED", "Lumia Order is available with phone numbers from the UAE, Saudi Arabia, Oman, Bahrain, Qatar and Kuwait.", 422);
    if (data.countryCode && data.countryCode !== own) throw new AppError("COUNTRY_MISMATCH", `The country of your restaurant follows your phone number: ${owner.phoneNumber} is ${MARKETS[own].nameEn}.`, 422);
    const chosen = own, market = MARKETS[chosen];
    const existing = await tx.business.findFirst({ where: { organization: { members: { some: { userId, status: "ACTIVE" } } } }, orderBy: { createdAt: "asc" } });
    if (existing) return existing;
    await requireRegistration(chosen);
    // Saudi Arabia, Oman and Bahrain: only VAT-registered restaurants can open an account. The number is saved for review; the restaurant goes live once the review verifies it.
    const vatNumber = (data.vatNumber ?? "").toUpperCase().replace(/[\s.-]/g, "");
    if (market.requiresVerifiedVatForSaas && !/^[A-Z0-9]{8,20}$/.test(vatNumber)) throw new AppError("VAT_REGISTRATION_REQUIRED", `Only VAT-registered restaurants can open an account in ${market.nameEn}. Enter your VAT registration number (8 to 20 letters or digits).`, 422);
    const user = await tx.user.findFirst({ where: { id: userId, status: "ACTIVE" } });
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in.", 401);
    const org = await tx.organization.create({ data: { name: data.name, slug: `org-${crypto.randomUUID()}`, members: { create: { userId, role: "OWNER" } } } });
    const business = await tx.business.create({ data: { organizationId: org.id, name: data.name, logoUrl: data.logoUrl, phone: owner.phoneNumber, slug: `business-${crypto.randomUUID()}`, businessType: data.businessType,
      countryCode: market.code, currencyCode: market.currency, timezone: market.timezone,
      locations: { create: { name: data.locationName, code: "MAIN", countryCode: market.code, timezone: market.timezone, hours: { create: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isClosed: false, openTime: "09:00", closeTime: "22:00" })) } } },
      onboarding: { create: { steps: { create: steps.map(stepKey => ({ stepKey, status: stepKey === "BUSINESS" ? "IN_PROGRESS" : "PENDING" })) } } },
    } });
    if (market.requiresVerifiedVatForSaas) await tx.billingTaxProfile.create({ data: { businessId: business.id, billingCountry: market.code, legalName: data.name, vatRegistered: true, vatNumber, vatCountry: market.code, vatVerificationStatus: "PENDING", submittedAt: new Date() } });
    await tx.auditLog.create({ data: { organizationId: org.id, businessId: business.id, userId, entityType: "Business", entityId: business.id, action: "business.created", afterData: { countryCode: market.code, currency: market.currency }, requestId } });
    return business;
  });
}

export async function getBusiness(userId: string, id: string) {
  const { member } = await authorize(userId, id);
  const business = await db.business.findFirstOrThrow({ where: { id, organizationId: member.organizationId }, include: profileInclude });
  return { ...business, role: member.role };
}
function profileComplete(b: { name: string; phone: string | null }, locations: Array<{ status: string; addressLine1: string; city: string; hours: unknown[] }>) {
  return Boolean(b.name && b.phone && locations.some(l => l.status === "ACTIVE" && l.addressLine1 && l.city && l.hours.length === 7));
}
export async function updateProgress(tx: Prisma.TransactionClient, id: string) {
  const b = await tx.business.findUniqueOrThrow({ where: { id }, include: profileInclude });
  const complete = profileComplete(b, b.locations);
  await tx.onboardingSession.update({ where: { businessId: id }, data: { lastActivityAt: new Date(), currentStep: complete ? "WHATSAPP" : "BUSINESS", steps: { updateMany: { where: { stepKey: "BUSINESS" }, data: { status: complete ? "COMPLETED" : "IN_PROGRESS", completedAt: complete ? new Date() : null } } } } });
}
export async function updateBusiness(userId: string, id: string, input: unknown, requestId: string) {
  const { location, revision, ...data } = profileSchema.parse(input);
  await transaction(async tx => {
    const { business } = await authorize(userId, id, "business.manage", tx);
    const target = await tx.location.findFirst({ where: { id: location.id, businessId: id } });
    if (!target) throw new AppError("NOT_FOUND", "Location not found.", 404);
    const result = await tx.business.updateMany({ where: { id, revision }, data: { ...data, revision: { increment: 1 } } });
    if (!result.count) throw new AppError("STALE_REVISION", "This business was updated elsewhere. Reload before saving again.", 409);
    const { id: locationId, hours, ...locationData } = location;
    await tx.location.update({ where: { id: locationId, businessId: id }, data: { ...locationData, hours: { deleteMany: {}, create: hours } } });
    await updateProgress(tx, id);
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId: id, userId, entityType: "Business", entityId: id, action: "business.updated", requestId,
      beforeData: { name: business.name, revision }, afterData: { name: data.name, revision: revision + 1, locationId } } });
  });
  return getBusiness(userId, id);
}
export async function updateLocation(userId: string, businessId: string, locationId: string, input: unknown, requestId: string) {
  const { revision, location } = locationUpdateSchema.parse(input);
  if (location.id !== locationId) throw new AppError("INVALID_LOCATION", "Location IDs must match.");
  await transaction(async tx => {
    const { business } = await authorize(userId, businessId, "operations.manage", tx);
    const existing = await tx.location.findFirst({ where: { id: locationId, businessId } });
    if (!existing) throw new AppError("NOT_FOUND", "Location not found.", 404);
    const changed = await tx.business.updateMany({ where: { id: businessId, revision }, data: { revision: { increment: 1 } } });
    if (!changed.count) throw new AppError("STALE_REVISION", "This business was updated elsewhere. Reload before saving again.", 409);
    const { id: _, hours, ...data } = location;
    await tx.location.update({ where: { id: locationId, businessId }, data: { ...data, hours: { deleteMany: {}, create: hours } } });
    await updateProgress(tx, businessId);
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Location", entityId: locationId, action: "location.updated", requestId, beforeData: { name: existing.name }, afterData: { name: data.name } } });
  });
  return getBusiness(userId, businessId);
}
export async function readiness(userId: string, id: string) {
  await authorize(userId, id);
  const b = await db.business.findUniqueOrThrow({ where: { id }, include: { locations: { include: { hours: true } }, catalogs: { include: { items: { where: { isAvailable: true, status: "ACTIVE" }, take: 1 } } }, whatsappAccounts: true, agents: true, orderSettings: true } });
  return evaluateReadiness({ profileComplete: profileComplete(b, b.locations), activeLocation: b.locations.some(l => l.status === "ACTIVE"), whatsappConnected: b.whatsappAccounts.some(a => a.status === "CONNECTED"), activeCatalog: b.catalogs.some(c => c.status === "ACTIVE"), availableItem: b.catalogs.some(c => c.status === "ACTIVE" && c.items.length > 0), activeAgent: b.agents.some(a => a.status === "ACTIVE"), orderSettings: Boolean(b.orderSettings?.configuredAt) });
}
export async function completeOnboarding(userId: string, id: string) {
  await authorize(userId, id, "business.manage");
  const result = await readiness(userId, id);
  if (!result.ready) throw new AppError("GO_LIVE_BLOCKED", "Complete all required setup steps before going live.", 409, result);
  // Activation is intentionally unavailable until live integrations and test orders ship.
  throw new AppError("INTEGRATIONS_NOT_RELEASED", "Live activation will be enabled with the operational integrations.", 409);
}
export async function members(userId: string, id: string) {
  const { business } = await authorize(userId, id, "users.manage");
  return db.membership.findMany({ where: { organizationId: business.organizationId }, select: { id: true, role: true, status: true, user: { select: { name: true, phoneNumber: true } } }, orderBy: { createdAt: "asc" } });
}
export async function setMember(userId: string, id: string, input: unknown, requestId: string) {
  const data = memberSchema.parse(input);
  return transaction(async tx => {
    const { business, member } = await authorize(userId, id, "users.manage", tx);
    const target = await tx.user.findUnique({ where: { phoneNumber: data.phoneNumber } });
    if (!target || target.status !== "ACTIVE") throw new AppError("USER_NOT_FOUND", "The user must create an account before being added.", 404);
    const current = await tx.membership.findUnique({ where: { organizationId_userId: { organizationId: business.organizationId, userId: target.id } } });
    if (target.id === userId || current?.role === "OWNER" || (member.role !== "OWNER" && (data.role === "ADMIN" || current?.role === "ADMIN"))) throw new AppError("FORBIDDEN", "Only owners can manage admins; ownership and your own role cannot be changed here.", 403);
    const saved = await tx.membership.upsert({ where: { organizationId_userId: { organizationId: business.organizationId, userId: target.id } }, create: { organizationId: business.organizationId, userId: target.id, role: data.role }, update: { role: data.role, status: "ACTIVE" } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId: id, userId, entityType: "Membership", entityId: saved.id, action: "membership.updated", requestId, beforeData: { role: current?.role ?? null }, afterData: { role: saved.role } } });
    return { id: saved.id, role: saved.role };
  });
}
export { listBusinesses };
