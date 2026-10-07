import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { addPolicy, expireOldVerifications, getBillingTax, getSupplier, pendingVatReviews, requireTaxEligible, reviewVat, saveBillingTax, setSupplierRegistration, taxDecisionFor } from "../src/modules/tax/service";
const enabled = process.env.RUN_DB_TESTS === "true";
const DAY = 86_400_000;

describe.skipIf(!enabled)("tax profiles, review and eligibility", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let admin: string, saOwner: string, sa: string, ae: string, aeOwner: string, kw: string, kwOwner: string;
  const mk = async (prefix: string, name: string) => { const u = (await db.user.create({ data: { name, email: `${name}-${suffix}@test.invalid`, phoneNumber: `${prefix}${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-7)}`, phoneNumberVerified: true } })).id; return { u, b: (await createBusiness(u, { name: `${name} Grill`, locationName: "Main" }, "t")).id }; };
  const details = (over: object = {}) => ({ legalName: "Riyadh Grill Trading Co", billingAddress: { line1: "King Fahd Road", city: "Riyadh" }, vatRegistered: true, vatNumber: "300000000000003", ...over });
  beforeAll(async () => {
    admin = (await db.user.create({ data: { name: "adm", email: `adm-${suffix}@test.invalid`, phoneNumber: `+9715${String(Date.now()).slice(-8)}`, phoneNumberVerified: true } })).id;
    ({ u: saOwner, b: sa } = await mk("+9665", "sa")); ({ u: aeOwner, b: ae } = await mk("+9715", "ae")); ({ u: kwOwner, b: kw } = await mk("+9655", "kw"));
  });
  afterAll(async () => { await db.$disconnect(); });

  it("Afkar's UAE VAT registration starts inactive, with no number", async () => {
    const s = await getSupplier(); expect(s.registrations).toEqual([{ country: "AE", number: "", state: "INACTIVE", effectiveFrom: null, effectiveTo: null }]);
  });
  it("UAE and Kuwait restaurants are sold to at once, with no VAT collected", async () => {
    expect(await requireTaxEligible(ae)).toMatchObject({ eligible: true, ratePercent: 0, uaeTreatment: "SUPPLIER_UNREGISTERED" });
    expect(await requireTaxEligible(kw)).toMatchObject({ eligible: true, destinationTreatment: "LOCAL_VAT_NOT_IMPLEMENTED" });
    expect((await getBillingTax(aeOwner, ae)).vatVerificationStatus).toBe("NOT_REQUIRED");
  });
  it("a Saudi restaurant cannot buy before its VAT is verified", async () => {
    expect((await getBillingTax(saOwner, sa))).toMatchObject({ vatRequired: true, vatVerificationStatus: "NOT_SUBMITTED" });
    await expect(requireTaxEligible(sa)).rejects.toMatchObject({ code: "VAT_REGISTRATION_REQUIRED", status: 409 });
    await expect(saveBillingTax(saOwner, sa, details({ vatNumber: "" }))).rejects.toMatchObject({ code: "VAT_REGISTRATION_REQUIRED" });
    expect(await saveBillingTax(saOwner, sa, details({ vatRegistered: false, vatNumber: "" }))).toMatchObject({ vatVerificationStatus: "NOT_SUBMITTED" });
    expect(await saveBillingTax(saOwner, sa, details())).toMatchObject({ vatVerificationStatus: "PENDING", vatNumber: "300000000000003" });
    await expect(requireTaxEligible(sa)).rejects.toMatchObject({ code: "VAT_VERIFICATION_PENDING" });
    expect((await pendingVatReviews()).some(r => r.businessId === sa && r.country === "SA")).toBe(true);
  });
  it("an approval needs evidence and a future end date; a rejection is explained", async () => {
    await expect(reviewVat(admin, sa, { decision: "VERIFIED", method: "MANUAL_DOCUMENT_REVIEW", reason: "checked certificate" })).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });
    await expect(reviewVat(admin, sa, { decision: "VERIFIED", method: "MANUAL_DOCUMENT_REVIEW", evidenceReference: "doc-1", validTo: new Date(Date.now() - DAY).toISOString(), reason: "checked certificate" })).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });
    await reviewVat(admin, sa, { decision: "REJECTED", method: "MANUAL_DOCUMENT_REVIEW", reason: "Number does not match the legal name" });
    expect(await getBillingTax(saOwner, sa)).toMatchObject({ vatVerificationStatus: "REJECTED", rejectionReason: "Number does not match the legal name" });
    await expect(requireTaxEligible(sa)).rejects.toMatchObject({ code: "VAT_VERIFICATION_REJECTED" });
    await expect(reviewVat(admin, sa, { decision: "REJECTED", method: "MANUAL_DOCUMENT_REVIEW", reason: "again" })).rejects.toMatchObject({ code: "NOT_PENDING" });
  });
  it("after re-submission and approval the Saudi restaurant is sold to under reverse charge", async () => {
    await saveBillingTax(saOwner, sa, details({ vatNumber: "300000000000004" }));
    await reviewVat(admin, sa, { decision: "VERIFIED", method: "OFFICIAL_LOOKUP", evidenceReference: "zatca-lookup-77", validTo: new Date(Date.now() + 300 * DAY).toISOString(), reason: "Found on the official register" });
    expect(await requireTaxEligible(sa)).toMatchObject({ eligible: true, destinationTreatment: "REVERSE_CHARGE", ratePercent: 0, customer: { vatStatus: "VERIFIED", evidenceReference: "zatca-lookup-77" } });
    expect((await db.taxAudit.findMany({ where: { entity: "BillingTaxProfile", entityId: sa } })).map(a => a.action)).toEqual(expect.arrayContaining(["vat.rejected", "vat.verified"]));
  });
  it("changing the approved details sends the profile back to review", async () => {
    expect(await saveBillingTax(saOwner, sa, details({ vatNumber: "300000000000004" }))).toMatchObject({ vatVerificationStatus: "VERIFIED" }); // same details: still approved
    expect(await saveBillingTax(saOwner, sa, details({ vatNumber: "300000000000009" }))).toMatchObject({ vatVerificationStatus: "PENDING" });
    await expect(requireTaxEligible(sa)).rejects.toMatchObject({ code: "VAT_VERIFICATION_PENDING" });
  });
  it("an approval that has run out stops new sales", async () => {
    await reviewVat(admin, sa, { decision: "VERIFIED", method: "MANUAL_DOCUMENT_REVIEW", evidenceReference: "doc-2", validTo: new Date(Date.now() + 5 * DAY).toISOString(), reason: "certificate valid" });
    expect((await taxDecisionFor(sa)).eligible).toBe(true);
    expect((await taxDecisionFor(sa, new Date(Date.now() + 10 * DAY))).reasons).toEqual(["VAT_VERIFICATION_EXPIRED"]);
    await db.billingTaxProfile.update({ where: { businessId: sa }, data: { validTo: new Date(Date.now() - DAY) } });
    expect(await expireOldVerifications()).toBeGreaterThanOrEqual(1);
    expect((await getBillingTax(saOwner, sa)).vatVerificationStatus).toBe("EXPIRED"); await expect(requireTaxEligible(sa)).rejects.toMatchObject({ code: "VAT_VERIFICATION_PENDING" });
  });
  it("registering Afkar for UAE VAT starts charging UAE restaurants from the effective date, and foreign sales wait for an approved policy", async () => {
    await expect(setSupplierRegistration(admin, { country: "AE", number: "", state: "ACTIVE", effectiveFrom: null, effectiveTo: null, reason: "registered" })).rejects.toBeTruthy();
    await setSupplierRegistration(admin, { country: "AE", number: "100123456700003", state: "ACTIVE", effectiveFrom: new Date(Date.now() - DAY).toISOString(), effectiveTo: null, reason: "FTA certificate received" });
    expect(await requireTaxEligible(ae)).toMatchObject({ ratePercent: 5, uaeTreatment: "DOMESTIC_STANDARD" });
    await expect(requireTaxEligible(kw)).rejects.toMatchObject({ code: "TAX_POLICY_REVIEW_REQUIRED" });
    await addPolicy(admin, { country: "KW", uaeTreatment: "ZERO_RATED", effectiveFrom: new Date(Date.now() - DAY).toISOString(), effectiveTo: null, version: "kw-1", evidence: "Tax adviser memo 2026-10" });
    expect(await requireTaxEligible(kw)).toMatchObject({ eligible: true, uaeTreatment: "ZERO_RATED", ratePercent: 0 });
    await setSupplierRegistration(admin, { country: "AE", number: "", state: "INACTIVE", effectiveFrom: null, effectiveTo: null, reason: "test cleanup" });
    expect((await db.taxAudit.findMany({ where: { entity: "PlatformTaxProfile" } })).length).toBeGreaterThanOrEqual(2);
  });
});

import { turnoverReport, VAT_THRESHOLD_AED_MINOR } from "../src/modules/tax/service";
describe.skipIf(!enabled)("turnover monitoring", () => {
  it("adds up paid Lumia invoices before tax over 12 months by currency, warns near the threshold, never counts restaurants' food sales", async () => {
    const before = await turnoverReport(); expect(before.level).toBe("OK");
    const owner = (await db.user.create({ data: { name: "to", email: `to-${crypto.randomUUID().slice(0, 6)}@test.invalid`, phoneNumber: `+9715${String(Date.now()).slice(-8)}`, phoneNumberVerified: true } })).id;
    const biz = (await createBusiness(owner, { name: "Turnover Grill", locationName: "Main" }, "t")).id;
    const sub = await db.subscription.create({ data: { businessId: biz, plan: "pro", billing: "yearly", status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 365 * 86_400_000), startedAt: new Date() } });
    const inv = (n: number, subtotalMinor: number, currency = "AED", daysAgo = 10) => db.billingInvoice.create({ data: { businessId: biz, subscriptionId: sub.id, number: `TO-${crypto.randomUUID().slice(0, 8)}-${n}`, kind: "RENEWAL", status: "PAID", lines: [], subtotalMinor, vatMinor: 0, totalMinor: subtotalMinor, currency, periodStart: new Date(), periodEnd: new Date(), createdAt: new Date(Date.now() - daysAgo * 86_400_000) } });
    await inv(1, Math.round(VAT_THRESHOLD_AED_MINOR * 0.85)); await inv(2, 12_345_000, "KWD");
    const r = await turnoverReport(); expect(r.level).toBe("WARNING"); expect(r.aedRollingMinor - before.aedRollingMinor).toBe(Math.round(VAT_THRESHOLD_AED_MINOR * 0.85)); expect(r.byCurrency.find(c => c.currency === "KWD")?.total).toBe(12_345_000);
    await inv(3, Math.round(VAT_THRESHOLD_AED_MINOR * 0.2)); expect((await turnoverReport()).level).toBe("REGISTER_NOW");
    const kept = (await turnoverReport()).aedRollingMinor; await inv(4, 99_999_999, "AED", 400); expect((await turnoverReport()).aedRollingMinor).toBe(kept); // older than 12 months: ignored
  });
});
