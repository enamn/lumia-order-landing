import { describe, expect, it } from "vitest";
import { startOfDay } from "../src/modules/billing/reminders";
import { offerLine } from "../src/modules/campaigns/service";

describe("offer dates use the restaurant's country time zone", () => {
  // 20:30 UTC on 10 Oct is 00:30 on 11 Oct in Dubai (UTC+4) but 23:30 on 10 Oct in Riyadh (UTC+3).
  const until = new Date("2026-10-10T20:30:00Z"), code = { code: "EID", percent: 10 };
  it("Dubai restaurant sees 11 Oct", () => expect(offerLine(code, until, false, "Asia/Dubai")).toContain("11 Oct"));
  it("Riyadh restaurant sees 10 Oct", () => expect(offerLine(code, until, false, "Asia/Riyadh")).toContain("10 Oct"));
});

describe("start of the day in the restaurant's time zone", () => {
  const now = new Date("2026-10-07T21:30:00Z"); // 01:30 on 8 Oct in Dubai, 00:30 on 8 Oct in Riyadh, still 7 Oct in London-like zones
  it("Dubai", () => expect(startOfDay(now, "Asia/Dubai").toISOString()).toBe("2026-10-07T20:00:00.000Z"));
  it("Riyadh", () => expect(startOfDay(now, "Asia/Riyadh").toISOString()).toBe("2026-10-07T21:00:00.000Z"));
});
