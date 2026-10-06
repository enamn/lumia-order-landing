import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { countryOfIp } from "../src/server/geoip";
import { superAdminPhones, isSuperAdmin } from "../src/server/superadmin";
import { summarize, analyticsSummary } from "../src/modules/superadmin/analytics";
import { POST, OPTIONS } from "../src/app/api/public/track/route";
const enabled = process.env.RUN_DB_TESTS === "true";

describe("country of an IP address", () => {
  it("finds the country for IPv4 and IPv6, including IPv4 inside IPv6", () => {
    expect(countryOfIp("1.178.20.5")).toBe("AE"); expect(countryOfIp("8.8.8.8")).toBe("US"); expect(countryOfIp("2001:470:e819::1")).toBe("AE"); expect(countryOfIp("::ffff:1.178.20.5")).toBe("AE");
  });
  it("returns nothing for garbage or private addresses", () => {
    for (const bad of ["", "nope", "999.1.1.1", "1.2.3", "::zz", "10.0.0.1", "127.0.0.1"]) expect(countryOfIp(bad)).toBeNull();
  });
});

describe("super admin phones", () => {
  it("accepts only international numbers from the list", () => {
    expect([...superAdminPhones("+971 50 123 4567, 0501234567 ,+966-501234567,")]).toEqual(["+971501234567", "+966501234567"]);
    expect(superAdminPhones(undefined).size).toBe(0);
  });
});

describe("analytics summary", () => {
  const row = (name: string, visitor: string, country: string, over: object = {}) => ({ name, day: "2026-10-06", visitor, loc: null, ref: null, utm: null, country, device: "desktop", ...over });
  it("counts visitors, plan views and clicks, with the funnel and the GCC total", () => {
    const rows = [row("page_view", "a", "AE"), row("page_view", "a", "AE"), row("page_view", "b", "SA"), row("page_view", "c", "US", { ref: "google.com" }), row("plans_view", "a", "AE"), row("plans_view", "b", "SA"),
      row("cta_free_trial", "a", "AE", { loc: "hero" }), row("cta_free_trial", "a", "AE", { loc: "header" }), row("cta_signup", "b", "SA", { loc: "plan:plus" }), row("login_click", "c", "US", { loc: "header" })];
    const s = summarize(rows, ["2026-10-05", "2026-10-06"]);
    expect(s.totals).toMatchObject({ visitors: 3, pageViews: 4, plansViewers: 2, freeTrialClicks: 2, freeTrialVisitors: 1, signupClicks: 1, signupVisitors: 1, ctaVisitors: 2, loginClicks: 1 });
    expect(s.funnel.map(f => [f.count, f.pct])).toEqual([[3, 100], [2, 66.7], [2, 66.7]]);
    expect(s.gcc).toEqual({ visitors: 2, plans: 2, freeTrial: 1, signup: 1 });
    expect(s.countries.map(c => [c.country, c.gcc, c.visitors])).toEqual([["AE", true, 1], ["SA", true, 1], ["US", false, 1]]);
    expect(s.daily).toEqual([{ day: "2026-10-05", visitors: 0, plans: 0, freeTrial: 0, signup: 0 }, { day: "2026-10-06", visitors: 3, plans: 2, freeTrial: 1, signup: 1 }]);
    expect(s.locations[0]).toMatchObject({ clicks: 1 }); expect(s.sources.map(x => x.source).sort()).toEqual(["Direct", "google.com"]);
  });
});

describe.skipIf(!enabled)("tracking endpoint", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const send = (body: unknown, over: { origin?: string | null; ua?: string; ip?: string } = {}) => POST(new Request("http://app.test/api/public/track", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "text/plain", ...(over.origin === null ? {} : { origin: over.origin ?? "http://localhost:5173" }), "user-agent": over.ua ?? `Mozilla/5.0 (iPhone) Safari ${suffix}`, "x-forwarded-for": over.ip ?? "1.178.20.5, 35.1.1.1" } }));
  const mine = () => db.analyticsEvent.findMany({ where: { path: `/t-${suffix}` } });
  beforeAll(async () => { await db.analyticsEvent.deleteMany({ where: { path: `/t-${suffix}` } }); });
  afterAll(async () => { await db.analyticsEvent.deleteMany({ where: { path: `/t-${suffix}` } }); await db.$disconnect(); });

  it("stores an event with the country, an anonymous code and no IP", async () => {
    const r = await send({ event: "cta_free_trial", loc: "hero", path: `/t-${suffix}`, ref: "google.com", utm: "ads", w: 390 }); expect(r.status).toBe(204); expect(r.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const [e] = await mine(); expect(e).toMatchObject({ name: "cta_free_trial", loc: "hero", ref: "google.com", utm: "ads", country: "AE", device: "mobile" });
    expect(e!.visitor).toMatch(/^[0-9a-f]{16}$/); expect(JSON.stringify(e)).not.toContain("1.178.20.5");
  });
  it("ignores bots, unknown events, other websites and junk", async () => {
    const before = (await mine()).length;
    await send({ event: "page_view", path: `/t-${suffix}` }, { ua: "Googlebot/2.1" }); await send({ event: "hack", path: `/t-${suffix}` }); await send("not json"); await send("x".repeat(3000));
    expect((await send({ event: "page_view", path: `/t-${suffix}` }, { origin: "https://evil.example" })).status).toBe(403); expect((await send({ event: "page_view" }, { origin: null })).status).toBe(403);
    expect((await mine()).length).toBe(before);
  });
  it("answers the browser's pre-check only for the landing site", () => {
    expect(OPTIONS(new Request("http://app.test/api/public/track", { method: "OPTIONS", headers: { origin: "http://localhost:5173" } })).headers.get("access-control-allow-methods")).toContain("POST");
    expect(OPTIONS(new Request("http://app.test/api/public/track", { method: "OPTIONS", headers: { origin: "https://evil.example" } })).headers.get("access-control-allow-origin")).toBeNull();
  });
  it("shows up in the super admin summary", async () => {
    const s = await analyticsSummary(7); expect(s.days).toBe(7); expect(s.totals.freeTrialClicks).toBeGreaterThanOrEqual(1); expect(s.countries.some(c => c.country === "AE")).toBe(true); expect(s.accounts).toHaveProperty("created");
  });
  it("only a listed, verified phone is a super admin", async () => {
    const phone = "+97150666" + String(Date.now()).slice(-4);
    const u = await db.user.create({ data: { name: "sa", email: `${crypto.randomUUID()}@phone.lumia.invalid`, phoneNumber: phone, phoneNumberVerified: true } });
    const other = await db.user.create({ data: { name: "no", email: `${crypto.randomUUID()}@phone.lumia.invalid`, phoneNumber: "+97150667" + String(Date.now()).slice(-4), phoneNumberVerified: true } });
    process.env.SUPER_ADMIN_PHONES = phone; expect(await isSuperAdmin(u.id)).toBe(true); expect(await isSuperAdmin(other.id)).toBe(false);
    await db.user.update({ where: { id: u.id }, data: { phoneNumberVerified: false } }); expect(await isSuperAdmin(u.id)).toBe(false);
    process.env.SUPER_ADMIN_PHONES = ""; expect(await isSuperAdmin(u.id)).toBe(false); delete process.env.SUPER_ADMIN_PHONES;
    await db.user.deleteMany({ where: { id: { in: [u.id, other.id] } } });
  });
});
