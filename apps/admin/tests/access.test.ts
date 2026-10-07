import { describe, expect, it } from "vitest";
import { accessOf } from "@/modules/billing/service";
import { renderEmail } from "@/modules/billing/reminders";

const DAY = 86_400_000, now = Date.parse("2026-10-06T10:00:00Z");
const sub = (status: string, failedAttempts = 0, nextChargeAt: Date | null = null) => ({ status, failedAttempts, nextChargeAt });

describe("who may use Lumia Order", () => {
  it("allows the free trial for 14 days, then locks", () => {
    expect(accessOf(null, new Date(now - 5 * DAY), now)).toEqual({ active: true, liveOrdering: true, reason: "trial" });
    expect(accessOf(null, new Date(now - 14 * DAY - 1000), now)).toEqual({ active: false, liveOrdering: false, reason: "trial_ended" });
  });
  it("a restaurant that needs a verified VAT number sets up first, and its trial starts when the number is verified", () => {
    const need = (verifiedFrom: Date | null) => ({ required: true, verifiedFrom });
    expect(accessOf(null, new Date(now - 40 * DAY), now, need(null))).toEqual({ active: true, liveOrdering: false, reason: "setup" }); // never locks while setting up
    expect(accessOf(null, new Date(now - 40 * DAY), now, need(new Date(now - 2 * DAY)))).toEqual({ active: true, liveOrdering: true, reason: "trial" });
    expect(accessOf(null, new Date(now - 40 * DAY), now, need(new Date(now - 20 * DAY)))).toEqual({ active: false, liveOrdering: false, reason: "trial_ended" });
    expect(accessOf(sub("ACTIVE"), new Date(0), now, need(null)).liveOrdering).toBe(true); // a paid plan was sold only after verification
  });
  it("allows a paid plan", () => { expect(accessOf(sub("ACTIVE"), new Date(0), now).active).toBe(true); });
  it("keeps everything on through the retry window after a failed renewal, then locks", () => {
    const first = accessOf(sub("PAST_DUE", 1, new Date(now + DAY)), new Date(0), now);
    expect(first.reason).toBe("grace"); expect(first.graceEndsAt).toBe(new Date(now + DAY + 8 * DAY).toISOString()); // retries after 1, 3 and 5 days
    expect(accessOf(sub("PAST_DUE", 3, new Date(now + 5 * DAY)), new Date(0), now).graceEndsAt).toBe(new Date(now + 5 * DAY).toISOString());
    expect(accessOf(sub("PAST_DUE", 3, new Date(now - 1000)), new Date(0), now)).toEqual({ active: false, liveOrdering: false, reason: "ended" });
  });
  it("locks an ended or cancelled plan, even inside the old trial window", () => {
    expect(accessOf(sub("ENDED"), new Date(now), now)).toEqual({ active: false, liveOrdering: false, reason: "ended" });
    expect(accessOf(sub("CANCELED"), new Date(now), now)).toEqual({ active: false, liveOrdering: false, reason: "ended" });
  });
});

describe("reminder emails", () => {
  it("renders English and Arabic with the link, and escapes the restaurant name", () => {
    const en = renderEmail("trial_3d", "en", { business: "<b>Burger</b> House", date: "9 October 2026" }, "https://app.order.lumia.ae/dashboard");
    expect(en.subject).toBe("Your free trial ends in 3 days"); expect(en.html).not.toContain("<b>"); expect(en.text).toContain("https://app.order.lumia.ae/dashboard"); expect(en.text).toContain("9 October 2026");
    const ar = renderEmail("payment_failed", "ar", { business: "برجر", graceDate: "12 أكتوبر" }, "https://x.test/d");
    expect(ar.html).toContain('dir="rtl"'); expect(ar.text).toContain("12 أكتوبر");
  });
});
