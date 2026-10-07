import { describe, expect, it } from "vitest";
import { decideSaasTax, refusalCode, uaeRegistrationAt, type CustomerTaxInput, type SupplierRegistration, type UaeServicePolicy } from "../src/modules/tax/policy";

const now = new Date("2026-10-06T10:00:00Z"), day = 86_400_000;
const none: SupplierRegistration[] = [{ country: "AE", number: "", state: "INACTIVE", effectiveFrom: null, effectiveTo: null }];
const registered = (from = new Date(now.getTime() - 30 * day)): SupplierRegistration[] => [{ country: "AE", number: "100000000000003", state: "ACTIVE", effectiveFrom: from, effectiveTo: null }];
const cust = (country: string, over: Partial<CustomerTaxInput> = {}): CustomerTaxInput => ({ country, billingCountry: country, vatStatus: "NOT_SUBMITTED", vatCountry: null, validFrom: null, validTo: null, ...over });
const verified = (country: string, over: Partial<CustomerTaxInput> = {}) => cust(country, { vatStatus: "VERIFIED", vatCountry: country, validFrom: new Date(now.getTime() - 10 * day), validTo: new Date(now.getTime() + 300 * day), vatNumber: "300000000000003", ...over });
const decide = (customer: CustomerTaxInput, registrations = none, policies: UaeServicePolicy[] = []) => decideSaasTax({ customer, registrations, policies, now });

describe("subscription tax decision", () => {
  it("UAE, supplier VAT inactive: registered or not, no VAT is collected and the reason is recorded", () => {
    for (const c of [cust("AE"), verified("AE")]) { const d = decide(c); expect(d).toMatchObject({ eligible: true, ratePercent: 0, uaeTreatment: "SUPPLIER_UNREGISTERED", destinationTreatment: "NOT_APPLICABLE", appliedTaxes: [] }); expect(d.reasons).toEqual(["OK"]); }
  });
  it("UAE, supplier registered from its effective date: domestic standard rate, and not before that date", () => {
    expect(decide(cust("AE"), registered())).toMatchObject({ eligible: true, ratePercent: 5, uaeTreatment: "DOMESTIC_STANDARD", appliedTaxes: [{ name: "UAE VAT", ratePercent: 5 }] });
    expect(decide(cust("AE"), registered(new Date(now.getTime() + 5 * day)))).toMatchObject({ ratePercent: 0, uaeTreatment: "SUPPLIER_UNREGISTERED" });
    expect(uaeRegistrationAt([{ ...registered()[0]!, number: "  " }], now)).toBeNull(); // active without a number does not count
    expect(uaeRegistrationAt([{ ...registered()[0]!, effectiveTo: new Date(now.getTime() - day) }], now)).toBeNull(); // ended
  });
  it("Saudi Arabia, Oman, Bahrain: a verified local VAT business is sold to under reverse charge, no destination VAT", () => {
    for (const c of ["SA", "OM", "BH"]) expect(decide(verified(c))).toMatchObject({ eligible: true, destinationTreatment: "REVERSE_CHARGE", uaeTreatment: "SUPPLIER_UNREGISTERED", ratePercent: 0 });
  });
  it("Saudi Arabia, Oman, Bahrain: not registered, pending, rejected or expired means no sale", () => {
    for (const c of ["SA", "OM", "BH"]) {
      expect(decide(cust(c)).reasons).toEqual(["VAT_REGISTRATION_REQUIRED"]); expect(decide(cust(c, { vatStatus: "NOT_REQUIRED" })).eligible).toBe(false);
      expect(decide(cust(c, { vatStatus: "PENDING", vatCountry: c })).reasons).toEqual(["VAT_VERIFICATION_PENDING"]); expect(decide(cust(c, { vatStatus: "REJECTED" })).reasons).toEqual(["VAT_VERIFICATION_REJECTED"]);
      expect(decide(verified(c, { validTo: new Date(now.getTime() - day) })).reasons).toEqual(["VAT_VERIFICATION_EXPIRED"]); expect(decide(verified(c, { validFrom: new Date(now.getTime() + day) })).eligible).toBe(false);
    }
    expect(decide(verified("SA", { vatCountry: "AE" })).reasons).toEqual(["VAT_COUNTRY_MISMATCH"]);
  });
  it("Qatar and Kuwait: a valid business customer, no VAT number needed, no local VAT", () => {
    for (const c of ["QA", "KW"]) expect(decide(cust(c))).toMatchObject({ eligible: true, destinationTreatment: "LOCAL_VAT_NOT_IMPLEMENTED", ratePercent: 0 });
  });
  it("a customer billed in another country's name goes to review, never to a guessed treatment", () => {
    const d = decide(verified("SA", { billingCountry: "AE" })); expect(d).toMatchObject({ eligible: false, reasons: ["BILLING_COUNTRY_MISMATCH"] }); expect(refusalCode(d.reasons)).toBe("TAX_POLICY_REVIEW_REQUIRED");
  });
  it("once Afkar is registered in the UAE, a foreign sale needs an approved policy for that country", () => {
    expect(decide(verified("SA"), registered())).toMatchObject({ eligible: false, reasons: ["TAX_POLICY_REVIEW_REQUIRED"], uaeTreatment: "REVIEW_REQUIRED" });
    const zero: UaeServicePolicy = { country: "SA", uaeTreatment: "ZERO_RATED", effectiveFrom: new Date(now.getTime() - day), effectiveTo: null, version: "p1" };
    expect(decide(verified("SA"), registered(), [zero])).toMatchObject({ eligible: true, uaeTreatment: "ZERO_RATED", destinationTreatment: "REVERSE_CHARGE", ratePercent: 0 });
    expect(decide(verified("SA"), registered(), [{ ...zero, uaeTreatment: "DOMESTIC_STANDARD" }])).toMatchObject({ eligible: true, ratePercent: 5 });
    expect(decide(verified("SA"), registered(), [{ ...zero, country: "OM" }]).eligible).toBe(false); // another country's policy does not count
    expect(decide(verified("SA"), registered(), [{ ...zero, effectiveFrom: new Date(now.getTime() + day) }]).eligible).toBe(false); // not in force yet
  });
  it("returns a snapshot with the policy version, time and customer evidence", () => {
    const d = decide(verified("OM", { evidenceReference: "cert-123" })); expect(d).toMatchObject({ policyVersion: "2026-10-06.1", evaluatedAt: now.toISOString(), customer: { vatStatus: "VERIFIED", evidenceReference: "cert-123" } });
  });
  it("rejects an unsupported country", () => { expect(decide(cust("EG"))).toMatchObject({ eligible: false, reasons: ["COUNTRY_NOT_SUPPORTED"] }); });
});
