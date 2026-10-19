import { vi } from "vitest";
// Tests run at any time of day: the restaurant's opening hours are checked against a fixed moment (Monday 13:00 in Dubai) unless a test sets globalThis.__TEST_NOW.
vi.mock("../src/modules/messages/hours", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/modules/messages/hours")>();
  return { ...actual, openStatus: (h: any, b: any, tz: string, now?: Date) => actual.openStatus(h, b, tz, now ?? (globalThis as any).__TEST_NOW ?? new Date("2026-10-19T09:00:00Z")) };
});
