import { describe, expect, it } from "vitest";
import { REGIONS, isRegionOf, regionFrom, regionNames } from "../src/modules/market/regions";
import { GCC_CODES } from "../src/modules/market/countries";
import { branchFromText, emirateFrom, regionIn, type BranchPoint, type DeliveryRules } from "../src/modules/orders/delivery";

describe("regions of the six countries", () => {
  it("lists the first-level divisions of each country", () => {
    expect(regionNames("AE")).toHaveLength(7); expect(regionNames("SA")).toHaveLength(13); expect(regionNames("OM")).toHaveLength(11); expect(regionNames("BH")).toHaveLength(4); expect(regionNames("QA")).toHaveLength(8); expect(regionNames("KW")).toHaveLength(6);
    for (const c of GCC_CODES) for (const r of REGIONS[c]) { expect(r.en).toBeTruthy(); expect(r.ar).toBeTruthy(); expect(r.words.test(r.en) || r.words.test(r.ar)).toBe(true); } // every region is recognisable by its own name
    expect(new Set(GCC_CODES.flatMap(c => regionNames(c).map(n => c + n))).size).toBe(7 + 13 + 11 + 4 + 8 + 6);
  });
  it("names the region from English or Arabic free text, per country", () => {
    expect(regionFrom("AE", "I'm in Al Majaz, Sharjah")).toBe("Sharjah"); expect(regionFrom("AE", "أنا في دبي")).toBe("Dubai");
    expect(regionFrom("SA", "جدة حي الروضة")).toBe("Makkah"); expect(regionFrom("SA", "Olaya, Riyadh")).toBe("Riyadh"); expect(regionFrom("SA", "Al Khobar corniche")).toBe("Eastern Province");
    expect(regionFrom("OM", "Seeb, Muscat")).toBe("Muscat"); expect(regionFrom("OM", "صلالة")).toBe("Dhofar"); expect(regionFrom("BH", "المنامة")).toBe("Capital"); expect(regionFrom("QA", "West Bay, Doha")).toBe("Doha"); expect(regionFrom("KW", "السالمية")).toBe("Hawalli");
    expect(regionFrom("KW", "somewhere else")).toBeNull(); expect(regionFrom("SA", "Dubai Mall")).toBeNull(); // a city of another country is not a region here
  });
  it("accepts only the country's own regions", () => {
    expect(isRegionOf("SA", "Riyadh")).toBe(true); expect(isRegionOf("SA", "Dubai")).toBe(false); expect(isRegionOf("AE", "Dubai")).toBe(true); expect(isRegionOf("KW", "Hawalli")).toBe(true);
  });
  it("keeps the old UAE helpers working", () => { expect(emirateFrom("Ajman")).toBe("Ajman"); expect(regionIn(undefined, "sharjah")).toBe("Sharjah"); expect(regionIn("SA", "Dubai")).toBeNull(); });
  it("chooses a branch from the restaurant's area rules in any country", () => {
    const branches: BranchPoint[] = [{ id: "b1", name: "Olaya", active: true, latitude: null, longitude: null }];
    const rules = { status: "available", method: "area", areas: [{ emirate: "Riyadh", area: "All areas", fee: "10", min: "", eta: "", branch: "b1", on: true }], ranges: [], freeEm: [] } as unknown as DeliveryRules;
    expect(branchFromText(rules, branches, "I am in Riyadh", "SA")).toBe("b1"); expect(branchFromText(rules, branches, "I am in Riyadh", "AE")).toBeNull();
  });
});
