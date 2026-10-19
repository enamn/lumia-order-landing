import { describe, expect, it } from "vitest";
import { closedText, hoursLines, openStatus } from "../src/modules/messages/hours";
import type { Hours } from "../src/modules/settings/schema";
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const day = (i: number, over: Record<string, unknown> = {}) => ({ day: NAMES[i]!, open: true, from: "12:00", to: "23:30", last: "23:30", brk: false, bFrom: "16:00", bTo: "17:00", ...over });
const week = (over: (i: number) => Record<string, unknown> = () => ({})) => NAMES.map((_, i) => day(i, over(i)));
const hours = (over: Partial<Hours> = {}): Hours => ({ mode: "custom", scope: "same", sel: "", every: day(0), closedUntil: "", same: week(), per: {}, ...over }) as Hours;
const TZ = "Asia/Dubai"; // UTC+4
const at = (iso: string) => new Date(`${iso}+04:00`); // a Dubai local time; 2026-10-19 is a Monday
describe("is the restaurant taking orders", () => {
  it("is open inside the hours and closed outside them", () => {
    expect(openStatus(hours(), null, TZ, at("2026-10-19T13:00:00")).open).toBe(true);
    expect(openStatus(hours(), null, TZ, at("2026-10-19T09:00:00"))).toMatchObject({ open: false, next: { dayOffset: 0, time: "12:00" } });
    expect(openStatus(hours(), null, TZ, at("2026-10-19T23:45:00"))).toMatchObject({ open: false, next: { dayOffset: 1, weekday: 1, time: "12:00" } });
  });
  it("uses the restaurant's time zone, not the server's", () => {
    // 09:00 UTC is 13:00 in Dubai (open) but 05:00 in New York (closed).
    expect(openStatus(hours(), null, TZ, new Date("2026-10-19T09:00:00Z")).open).toBe(true);
    expect(openStatus(hours(), null, "America/New_York", new Date("2026-10-19T09:00:00Z")).open).toBe(false);
  });
  it("is closed on a day off and says when it opens next", () => {
    const h = hours({ same: week(i => (i === 0 ? { open: false } : {})) });
    expect(openStatus(h, null, TZ, at("2026-10-19T13:00:00"))).toMatchObject({ open: false, why: "off", next: { dayOffset: 1, weekday: 1 } });
  });
  it("handles hours that run past midnight", () => {
    const h = hours({ same: week(() => ({ from: "18:00", to: "02:00", last: "02:00" })) });
    expect(openStatus(h, null, TZ, at("2026-10-20T01:00:00")).open).toBe(true); // Tuesday 01:00 belongs to Monday's evening
    expect(openStatus(h, null, TZ, at("2026-10-20T03:00:00")).open).toBe(false);
    expect(openStatus(h, null, TZ, at("2026-10-19T19:00:00")).open).toBe(true);
  });
  it("closes for a break and after the last order", () => {
    const b = hours({ same: week(() => ({ brk: true })) });
    expect(openStatus(b, null, TZ, at("2026-10-19T16:30:00"))).toMatchObject({ open: false, why: "break", next: { dayOffset: 0, time: "17:00" } });
    expect(openStatus(b, null, TZ, at("2026-10-19T17:30:00")).open).toBe(true);
    const l = hours({ same: week(() => ({ to: "23:30", last: "22:30" })) });
    expect(openStatus(l, null, TZ, at("2026-10-19T22:45:00"))).toMatchObject({ open: false, why: "last" });
  });
  it("follows temporarily closed until the reopening date", () => {
    const h = hours({ mode: "closed", closedUntil: "2026-10-22" });
    expect(openStatus(h, null, TZ, at("2026-10-19T13:00:00"))).toMatchObject({ open: false, why: "closed", reopenOn: "2026-10-22" });
    expect(openStatus(h, null, TZ, at("2026-10-22T13:00:00")).open).toBe(true);
    expect(openStatus(hours({ mode: "closed" }), null, TZ, at("2026-10-19T13:00:00")).open).toBe(false);
  });
  it("uses the branch's own hours when they differ", () => {
    const h = hours({ scope: "per", per: { a: week(), b: week(() => ({ from: "20:00", to: "23:00", last: "23:00" })) } });
    expect(openStatus(h, "a", TZ, at("2026-10-19T13:00:00")).open).toBe(true);
    expect(openStatus(h, "b", TZ, at("2026-10-19T13:00:00")).open).toBe(false);
    expect(openStatus(h, null, TZ, at("2026-10-19T13:00:00")).open).toBe(true); // branch unknown: open if any branch is
  });
  it("never turns orders away when no hours are set", () => { expect(openStatus(null, null, TZ).open).toBe(true); });
});
describe("the closed message", () => {
  const h = hours({ same: week(i => (i === 4 ? { open: false } : {})) });
  const state = openStatus(h, null, TZ, at("2026-10-19T09:00:00")) as Extract<ReturnType<typeof openStatus>, { open: false }>;
  it("groups days with the same hours", () => { expect(hoursLines(h.same, "en")).toEqual(["Mon–Thu: 12:00 PM – 11:30 PM", "Fri: closed", "Sat–Sun: 12:00 PM – 11:30 PM"]); });
  it("tells an English customer the restaurant is closed, with the hours and the next opening", () => {
    const t = closedText(state, "en", "Burger House");
    expect(t).toContain("Burger House is closed right now"); expect(t).toContain("Mon–Thu: 12:00 PM – 11:30 PM"); expect(t).toContain("Fri: closed"); expect(t).toContain("We open today at 12:00 PM");
  });
  it("tells an Arabic customer in Arabic", () => {
    const t = closedText(state, "ar", "بيت البرجر");
    expect(t).toContain("بيت البرجر مغلق الآن"); expect(t).toContain("ساعات العمل"); expect(t).toContain("الجمعة: مغلق"); expect(t).toContain("نفتح اليوم الساعة 12:00 م");
  });
});
