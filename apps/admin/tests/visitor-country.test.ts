import { describe, expect, it } from "vitest";
import { visitorCountry } from "../src/server/visitor-country";

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe("visitorCountry", () => {
  it("prefers the platform country header", () => {
    expect(visitorCountry(h({ "x-client-geo-location": "sa", "x-forwarded-for": "8.8.8.8" }))).toBe("SA");
  });
  it("falls back to the IP address", () => {
    expect(visitorCountry(h({ "x-forwarded-for": "188.54.0.1, 10.0.0.1" }))).toBe("SA");
  });
  it("is empty when nothing identifies the country", () => {
    expect(visitorCountry(h({}))).toBe("");
  });
});
