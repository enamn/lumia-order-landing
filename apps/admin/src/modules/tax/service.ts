import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { MARKETS, isCountryCode } from "../market/countries";
import { decideSaasTax, refusalCode, type CustomerTaxInput, type SupplierRegistration, type TaxDecision, type UaeServicePolicy, type VatStatus } from "./policy";

const PLATFORM_ID = "platform";
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const date = (v: string | null | undefined) => (v ? new Date(v) : null);

// ---- Afkar IO's own registrations (super admin only) ----
type StoredReg = { country: string; number: string; state: "INACTIVE" | "ACTIVE"; effectiveFrom: string | null; effectiveTo: string | null };
const toReg = (r: StoredReg): SupplierRegistration => ({ ...r, effectiveFrom: date(r.effectiveFrom), effectiveTo: date(r.effectiveTo) });
export async function getSupplier() {
  // The UAE registration starts INACTIVE with no number: it is switched on only when the real registration exists. Nothing is invented here.
  const row = await db.platformTaxProfile.findUnique({ where: { id: PLATFORM_ID } }) ?? await db.platformTaxProfile.create({ data: { id: PLATFORM_ID, legalName: "Afkar IO", country: "AE", registrations: [{ country: "AE", number: "", state: "INACTIVE", effectiveFrom: null, effectiveTo: null }] } }).catch(() => db.platformTaxProfile.findUniqueOrThrow({ where: { id: PLATFORM_ID } }));
  return { legalName: row.legalName, country: row.country, registrations: (row.registrations as StoredReg[]) ?? [], updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedBy };
}
const regSchema = z.object({ country: z.literal("AE"), number: z.string().trim().max(30), state: z.enum(["INACTIVE", "ACTIVE"]), effectiveFrom: z.string().datetime().nullable(), effectiveTo: z.string().datetime().nullable(), reason: z.string().trim().min(5).max(300) }).strict()
  .refine(r => r.state === "INACTIVE" || (r.number.length >= 8 && r.effectiveFrom !== null), { message: "An active registration needs its number and the date it takes effect." });
export async function setSupplierRegistration(actorId: string, input: unknown) {
  const b = regSchema.parse(input), before = await getSupplier();
  const next: StoredReg[] = [{ country: "AE", number: b.state === "ACTIVE" ? b.number : "", state: b.state, effectiveFrom: b.state === "ACTIVE" ? b.effectiveFrom : null, effectiveTo: b.state === "ACTIVE" ? b.effectiveTo : null }];
  await db.$transaction([db.platformTaxProfile.update({ where: { id: PLATFORM_ID }, data: { registrations: next as unknown as Prisma.InputJsonValue, updatedBy: actorId } }), db.taxAudit.create({ data: { actorId, entity: "PlatformTaxProfile", entityId: PLATFORM_ID, action: "supplier.registration.set", reason: b.reason, before: before.registrations as unknown as Prisma.InputJsonValue, after: next as unknown as Prisma.InputJsonValue } })]);
  return getSupplier();
}

// ---- approved UAE-treatment policies per destination country (super admin only) ----
const policySchema = z.object({ country: z.string().length(2).toUpperCase(), uaeTreatment: z.enum(["DOMESTIC_STANDARD", "ZERO_RATED", "OUTSIDE_SCOPE"]), effectiveFrom: z.string().datetime(), effectiveTo: z.string().datetime().nullable(), version: z.string().trim().min(1).max(40), evidence: z.string().trim().min(5).max(300) }).strict();
export async function addPolicy(actorId: string, input: unknown) {
  const b = policySchema.parse(input); if (!isCountryCode(b.country) || b.country === "AE") throw new AppError("COUNTRY_NOT_SUPPORTED", "A policy is for Saudi Arabia, Oman, Bahrain, Qatar or Kuwait.", 422);
  const row = await db.taxPolicy.create({ data: { country: b.country, uaeTreatment: b.uaeTreatment, effectiveFrom: new Date(b.effectiveFrom), effectiveTo: date(b.effectiveTo), version: b.version, approvedBy: actorId, evidence: b.evidence } });
  await db.taxAudit.create({ data: { actorId, entity: "TaxPolicy", entityId: row.id, action: "policy.added", reason: b.evidence, after: { country: b.country, uaeTreatment: b.uaeTreatment, effectiveFrom: b.effectiveFrom, version: b.version } } });
  return row;
}
export const listPolicies = () => db.taxPolicy.findMany({ orderBy: { effectiveFrom: "desc" }, take: 100 });

// ---- the restaurant's billing tax profile ----
const vatNumberOf = (v: string) => v.toUpperCase().replace(/[\s.-]/g, "");
export const profileSchema = z.object({
  legalName: z.string().trim().min(2, "Enter the legal name of the business.").max(160),
  billingAddress: z.object({ line1: z.string().trim().min(3).max(200), city: z.string().trim().min(2).max(100), region: z.string().trim().max(100).optional() }).strict(),
  vatRegistered: z.boolean(),
  // Format check only (letters and digits): whether the number really exists is decided by the review, never by this check.
  vatNumber: z.string().trim().max(30).transform(vatNumberOf).refine(v => v === "" || /^[A-Z0-9]{8,20}$/.test(v), "Check the VAT number: it has letters and digits only, 8 to 20 characters.").optional(),
}).strict();
export interface BillingTaxView { billingCountry: string; legalName: string; billingAddress: { line1: string; city: string; region?: string } | null; vatRequired: boolean; vatRegistered: boolean | null; vatNumber: string; vatVerificationStatus: VatStatus; validTo: string | null; rejectionReason: string | null; verifiedAt: string | null }
async function ensureProfile(businessId: string) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { countryCode: true } });
  const existing = await db.billingTaxProfile.findUnique({ where: { businessId } });
  if (existing) return existing;
  const required = isCountryCode(b.countryCode) && MARKETS[b.countryCode].requiresVerifiedVatForSaas;
  return db.billingTaxProfile.create({ data: { businessId, billingCountry: b.countryCode, vatVerificationStatus: required ? "NOT_SUBMITTED" : "NOT_REQUIRED" } }).catch(() => db.billingTaxProfile.findUniqueOrThrow({ where: { businessId } }));
}
export const viewOf = (p: Awaited<ReturnType<typeof ensureProfile>>): BillingTaxView => ({ billingCountry: p.billingCountry, legalName: p.legalName, billingAddress: (p.billingAddress as BillingTaxView["billingAddress"]) ?? null, vatRequired: isCountryCode(p.billingCountry) && MARKETS[p.billingCountry].requiresVerifiedVatForSaas, vatRegistered: p.vatRegistered, vatNumber: p.vatNumber ?? "", vatVerificationStatus: p.vatVerificationStatus as VatStatus, validTo: iso(p.validTo), rejectionReason: p.rejectionReason, verifiedAt: iso(p.verifiedAt) });
export async function getBillingTax(userId: string, businessId: string) { await authorize(userId, businessId, "business.manage"); return viewOf(await ensureProfile(businessId)); }
export async function saveBillingTax(userId: string, businessId: string, input: unknown) {
  const b = profileSchema.parse(input); await authorize(userId, businessId, "business.manage");
  const p = await ensureProfile(businessId), required = isCountryCode(p.billingCountry) && MARKETS[p.billingCountry].requiresVerifiedVatForSaas, number = b.vatNumber ?? "";
  if (required && b.vatRegistered && number === "") throw new AppError("VAT_REGISTRATION_REQUIRED", "Enter your VAT registration number.", 422);
  // Approval holds only for the details that were approved: a changed number, name or registration answer sends it back to review.
  const changed = vatNumberOf(p.vatNumber ?? "") !== number || p.legalName !== b.legalName || p.vatRegistered !== b.vatRegistered;
  let status: VatStatus = p.vatVerificationStatus as VatStatus, extra: Prisma.BillingTaxProfileUpdateInput = {};
  if (!required) status = "NOT_REQUIRED";
  else if (!b.vatRegistered) { status = "NOT_SUBMITTED"; extra = { verifiedAt: null, verifiedBy: null, validFrom: null, validTo: null, verificationMethod: null, rejectionReason: null }; }
  else if (changed || status === "NOT_SUBMITTED" || status === "REJECTED" || status === "EXPIRED") { status = "PENDING"; extra = { submittedAt: new Date(), verifiedAt: null, verifiedBy: null, validFrom: null, validTo: null, verificationMethod: null, rejectionReason: null }; }
  const row = await db.billingTaxProfile.update({ where: { businessId }, data: { legalName: b.legalName, billingAddress: b.billingAddress, vatRegistered: b.vatRegistered, vatNumber: number || null, vatCountry: number ? p.billingCountry : null, vatVerificationStatus: status, ...extra } });
  if (changed) await db.taxAudit.create({ data: { actorId: userId, entity: "BillingTaxProfile", entityId: businessId, action: "customer.profile.saved", reason: "Customer edited tax details", before: { status: p.vatVerificationStatus, vatNumber: p.vatNumber }, after: { status, vatNumber: number } } });
  return viewOf(row);
}

// ---- the review (super admin only) ----
export async function pendingVatReviews() {
  const rows = await db.billingTaxProfile.findMany({ where: { vatVerificationStatus: "PENDING" }, orderBy: { submittedAt: "asc" }, take: 100 });
  const names = new Map((await db.business.findMany({ where: { id: { in: rows.map(r => r.businessId) } }, select: { id: true, name: true } })).map(b => [b.id, b.name]));
  return rows.map(r => ({ businessId: r.businessId, restaurant: names.get(r.businessId) ?? "", country: r.billingCountry, legalName: r.legalName, address: r.billingAddress, vatNumber: r.vatNumber ?? "", submittedAt: iso(r.submittedAt) }));
}
const reviewSchema = z.object({ decision: z.enum(["VERIFIED", "REJECTED"]), method: z.enum(["OFFICIAL_LOOKUP", "MANUAL_DOCUMENT_REVIEW"]), evidenceReference: z.string().trim().max(300).default(""), validFrom: z.string().datetime().nullable().default(null), validTo: z.string().datetime().nullable().default(null), reason: z.string().trim().min(5).max(300) }).strict();
export async function reviewVat(actorId: string, businessId: string, input: unknown, now = new Date()) {
  const b = reviewSchema.parse(input), p = await ensureProfile(businessId);
  if (p.vatVerificationStatus !== "PENDING") throw new AppError("NOT_PENDING", "There is nothing to review for this restaurant.", 409);
  if (b.decision === "VERIFIED") {
    if (!b.evidenceReference || !b.validTo || new Date(b.validTo) <= now) throw new AppError("EVIDENCE_REQUIRED", "Approving needs the evidence reference and a validity end date in the future.", 422);
  }
  const data: Prisma.BillingTaxProfileUpdateInput = b.decision === "VERIFIED"
    ? { vatVerificationStatus: "VERIFIED", verificationMethod: b.method, verifiedAt: now, verifiedBy: actorId, validFrom: date(b.validFrom) ?? now, validTo: new Date(b.validTo!), evidenceReference: b.evidenceReference, rejectionReason: null }
    : { vatVerificationStatus: "REJECTED", verificationMethod: b.method, verifiedAt: null, verifiedBy: actorId, rejectionReason: b.reason };
  await db.$transaction([db.billingTaxProfile.update({ where: { businessId }, data }), db.taxAudit.create({ data: { actorId, entity: "BillingTaxProfile", entityId: businessId, action: `vat.${b.decision.toLowerCase()}`, reason: b.reason, before: { status: p.vatVerificationStatus, vatNumber: p.vatNumber }, after: { status: b.decision, method: b.method, validTo: b.validTo } } })]);
  return { businessId, status: b.decision };
}
// A verification that has run out is shown and treated as expired.
export async function expireOldVerifications(now = new Date()) {
  const r = await db.billingTaxProfile.updateMany({ where: { vatVerificationStatus: "VERIFIED", validTo: { lt: now } }, data: { vatVerificationStatus: "EXPIRED" } });
  return r.count;
}

// ---- the decision for a restaurant ----
export async function taxDecisionFor(businessId: string, now = new Date()): Promise<TaxDecision> {
  const [b, p, supplier, policies] = await Promise.all([db.business.findUniqueOrThrow({ where: { id: businessId }, select: { countryCode: true } }), ensureProfile(businessId), getSupplier(), db.taxPolicy.findMany()]);
  const customer: CustomerTaxInput = { country: b.countryCode, billingCountry: p.billingCountry, vatStatus: p.vatVerificationStatus as VatStatus, vatCountry: p.vatCountry, validFrom: p.validFrom, validTo: p.validTo, vatNumber: p.vatNumber, evidenceReference: p.evidenceReference };
  return decideSaasTax({ customer, registrations: supplier.registrations.map(toReg), policies: policies.map((x): UaeServicePolicy => ({ country: x.country, uaeTreatment: x.uaeTreatment as UaeServicePolicy["uaeTreatment"], effectiveFrom: x.effectiveFrom, effectiveTo: x.effectiveTo, version: x.version })), now });
}
// Every paid action calls this first: refuses with the reason code when the restaurant may not be sold to.
export async function requireTaxEligible(businessId: string, now = new Date()): Promise<TaxDecision> {
  const d = await taxDecisionFor(businessId, now);
  if (!d.eligible) {
    const code = refusalCode(d.reasons);
    const text: Record<string, string> = { VAT_REGISTRATION_REQUIRED: "For this market, Lumia Order currently supports subscriptions for VAT-registered businesses. Enter your business VAT number to continue. If you are not registered, contact sales to discuss future availability.", VAT_VERIFICATION_PENDING: "Your VAT details are being reviewed. You can continue preparing your restaurant while we verify your business.", VAT_VERIFICATION_REJECTED: "We couldn’t verify your VAT details. Check them and submit again, or contact support.", TAX_POLICY_REVIEW_REQUIRED: "This purchase needs a tax review before it can go ahead. Please contact support.", COUNTRY_NOT_SUPPORTED: "This country is not supported." };
    throw new AppError(code, text[code] ?? "This purchase isn’t available for your account yet.", 409, { reasons: d.reasons });
  }
  return d;
}
