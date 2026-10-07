import { MARKETS, type CountryCode } from "../market/countries";

// Tax on Lumia's own subscriptions, credits and add-ons (Afkar IO -> restaurant). This is NOT the tax a restaurant charges its customers on food orders.
// One deterministic decision per sale; it is stored on the invoice. Two separate questions are answered and never mixed:
//   1. destination country: is the customer allowed to buy, and who accounts for that country's VAT (reverse charge / not implemented / none)?
//   2. Afkar IO's UAE treatment: charge UAE VAT (only while Afkar's UAE registration is in force) or not.
export const POLICY_VERSION = "2026-10-06.1";

export type DestinationTreatment = "NOT_APPLICABLE" | "REVERSE_CHARGE" | "LOCAL_VAT_NOT_IMPLEMENTED" | "REVIEW_REQUIRED";
export type UaeTreatment = "SUPPLIER_UNREGISTERED" | "DOMESTIC_STANDARD" | "ZERO_RATED" | "OUTSIDE_SCOPE" | "REVIEW_REQUIRED";
export type VatStatus = "NOT_REQUIRED" | "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type ReasonCode =
  | "OK" | "VAT_REGISTRATION_REQUIRED" | "VAT_VERIFICATION_PENDING" | "VAT_VERIFICATION_REJECTED" | "VAT_VERIFICATION_EXPIRED" | "VAT_COUNTRY_MISMATCH" | "BILLING_COUNTRY_MISMATCH" | "TAX_POLICY_REVIEW_REQUIRED" | "COUNTRY_NOT_SUPPORTED";

export interface SupplierRegistration { country: string; number: string; state: "INACTIVE" | "ACTIVE"; effectiveFrom: Date | null; effectiveTo: Date | null }
export interface CustomerTaxInput {
  /** The restaurant's operating country (its account). */
  country: string;
  /** The country of the legal entity that is billed. Must equal the operating country for these rules. */
  billingCountry: string;
  vatStatus: VatStatus; vatCountry: string | null; validFrom: Date | null; validTo: Date | null;
  vatNumber?: string | null; evidenceReference?: string | null;
}
export interface UaeServicePolicy { country: string; uaeTreatment: Exclude<UaeTreatment, "SUPPLIER_UNREGISTERED" | "REVIEW_REQUIRED">; effectiveFrom: Date; effectiveTo: Date | null; version: string }

export interface TaxDecision {
  eligible: boolean; reasons: ReasonCode[]; policyVersion: string; evaluatedAt: string; country: string;
  destinationTreatment: DestinationTreatment; uaeTreatment: UaeTreatment;
  /** The UAE VAT collected on the invoice, in percent (0 when none). */
  ratePercent: number; appliedTaxes: { name: string; ratePercent: number }[];
  supplierRegistration: { country: string; number: string } | null;
  customer: { vatStatus: VatStatus; vatNumber: string | null; evidenceReference: string | null; validFrom: string | null; validTo: string | null };
}
const UAE_VAT_PERCENT = 5;
const within = (d: Date, from: Date | null, to: Date | null) => (!from || from <= d) && (!to || d <= to);
// The supplier's UAE registration counts only when it is active and in force on the day of the sale.
export const uaeRegistrationAt = (regs: SupplierRegistration[], now: Date) => regs.find(r => r.country === "AE" && r.state === "ACTIVE" && !!r.number.trim() && r.effectiveFrom !== null && within(now, r.effectiveFrom, r.effectiveTo)) ?? null;

export function decideSaasTax(input: { customer: CustomerTaxInput; registrations: SupplierRegistration[]; policies: UaeServicePolicy[]; now?: Date }): TaxDecision {
  const now = input.now ?? new Date(), c = input.customer, base = { policyVersion: POLICY_VERSION, evaluatedAt: now.toISOString(), country: c.country, customer: { vatStatus: c.vatStatus, vatNumber: c.vatNumber ?? null, evidenceReference: c.evidenceReference ?? null, validFrom: c.validFrom?.toISOString() ?? null, validTo: c.validTo?.toISOString() ?? null } };
  const stop = (reasons: ReasonCode[], destinationTreatment: DestinationTreatment = "NOT_APPLICABLE"): TaxDecision => ({ ...base, eligible: false, reasons, destinationTreatment, uaeTreatment: "REVIEW_REQUIRED", ratePercent: 0, appliedTaxes: [], supplierRegistration: null });
  if (!(c.country in MARKETS)) return stop(["COUNTRY_NOT_SUPPORTED"]);
  const market = MARKETS[c.country as CountryCode], supplier = uaeRegistrationAt(input.registrations, now);
  if (c.billingCountry !== c.country) return stop(["BILLING_COUNTRY_MISMATCH"], "REVIEW_REQUIRED"); // a different country's entity: reviewed, never assumed

  // 1. Destination country.
  let destinationTreatment: DestinationTreatment = "NOT_APPLICABLE";
  if (c.country === "AE") destinationTreatment = "NOT_APPLICABLE";
  else if (market.requiresVerifiedVatForSaas) {
    if (c.vatStatus === "NOT_SUBMITTED" || c.vatStatus === "NOT_REQUIRED") return stop(["VAT_REGISTRATION_REQUIRED"], "REVIEW_REQUIRED");
    if (c.vatStatus === "PENDING") return stop(["VAT_VERIFICATION_PENDING"], "REVIEW_REQUIRED");
    if (c.vatStatus === "REJECTED") return stop(["VAT_VERIFICATION_REJECTED"], "REVIEW_REQUIRED");
    if (c.vatStatus === "EXPIRED" || !within(now, c.validFrom, c.validTo)) return stop(["VAT_VERIFICATION_EXPIRED"], "REVIEW_REQUIRED");
    if (c.vatCountry !== c.country) return stop(["VAT_COUNTRY_MISMATCH"], "REVIEW_REQUIRED");
    destinationTreatment = "REVERSE_CHARGE"; // the customer accounts for its own country's VAT
  } else destinationTreatment = "LOCAL_VAT_NOT_IMPLEMENTED"; // Qatar and Kuwait: no local VAT regime to apply

  // 2. Afkar IO's UAE treatment of this supply.
  let uaeTreatment: UaeTreatment, ratePercent = 0;
  if (!supplier) uaeTreatment = "SUPPLIER_UNREGISTERED";
  else if (c.country === "AE") { uaeTreatment = "DOMESTIC_STANDARD"; ratePercent = UAE_VAT_PERCENT; }
  else {
    const policy = input.policies.filter(p => p.country === c.country && within(now, p.effectiveFrom, p.effectiveTo)).sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
    if (!policy) return { ...base, eligible: false, reasons: ["TAX_POLICY_REVIEW_REQUIRED"], destinationTreatment, uaeTreatment: "REVIEW_REQUIRED", ratePercent: 0, appliedTaxes: [], supplierRegistration: { country: "AE", number: supplier.number } };
    uaeTreatment = policy.uaeTreatment; ratePercent = policy.uaeTreatment === "DOMESTIC_STANDARD" ? UAE_VAT_PERCENT : 0;
  }
  return { ...base, eligible: true, reasons: ["OK"], destinationTreatment, uaeTreatment, ratePercent, appliedTaxes: ratePercent ? [{ name: "UAE VAT", ratePercent }] : [], supplierRegistration: supplier ? { country: "AE", number: supplier.number } : null };
}

/** The API reason code shown for a refused sale. */
export const refusalCode = (reasons: ReasonCode[]): string => reasons.includes("OK") ? "OK" : ({
  VAT_REGISTRATION_REQUIRED: "VAT_REGISTRATION_REQUIRED", VAT_VERIFICATION_PENDING: "VAT_VERIFICATION_PENDING", VAT_VERIFICATION_REJECTED: "VAT_VERIFICATION_REJECTED", VAT_VERIFICATION_EXPIRED: "VAT_VERIFICATION_PENDING",
  VAT_COUNTRY_MISMATCH: "TAX_POLICY_REVIEW_REQUIRED", BILLING_COUNTRY_MISMATCH: "TAX_POLICY_REVIEW_REQUIRED", TAX_POLICY_REVIEW_REQUIRED: "TAX_POLICY_REVIEW_REQUIRED", COUNTRY_NOT_SUPPORTED: "COUNTRY_NOT_SUPPORTED",
} as Record<ReasonCode, string>)[reasons[0]!] ?? "TAX_POLICY_REVIEW_REQUIRED";
