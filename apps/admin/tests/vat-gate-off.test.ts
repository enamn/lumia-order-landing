import { describe, expect, it, vi } from "vitest";

describe("the VAT requirement switch", () => {
  it("is on by default and turned off by NEXT_PUBLIC_VAT_GATE=off, for Saudi Arabia, Oman and Bahrain alike", async () => {
    const on = await import("../src/modules/market/countries");
    expect(["SA", "OM", "BH"].map(c => on.MARKETS[c as "SA"].requiresVerifiedVatForSaas)).toEqual([true, true, true]);
    vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_VAT_GATE", "off");
    const off = await import("../src/modules/market/countries");
    expect(Object.values(off.MARKETS).every(m => !m.requiresVerifiedVatForSaas)).toBe(true);
    vi.unstubAllEnvs(); vi.resetModules();
  });
});
