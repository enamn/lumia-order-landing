import { db } from "@/server/db";
import { COUNTRIES } from "@/modules/auth/countries";
import { dubaiDay } from "@/server/dubai-day";

// What the super admin dashboard shows: how many people visit the landing page, how far they get, from which countries, and how many real accounts followed.
export const GCC = ["AE", "SA", "QA", "KW", "BH", "OM"] as const;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const nameOf = (cc: string) => { try { return cc === "ZZ" ? "Unknown" : regionNames.of(cc) ?? cc; } catch { return cc; } };
const DIAL_TO_CC: Record<string, string> = { "+971": "AE", "+966": "SA", "+974": "QA", "+965": "KW", "+973": "BH", "+968": "OM", "+20": "EG", "+91": "IN", "+44": "GB" };

interface Row { name: string; day: string; visitor: string; loc: string | null; ref: string | null; utm: string | null; country: string; device: string }
interface Bucket { visitors: Set<string>; plans: Set<string>; freeTrial: Set<string>; signup: Set<string>; clicks: number }
const bucket = (): Bucket => ({ visitors: new Set(), plans: new Set(), freeTrial: new Set(), signup: new Set(), clicks: 0 });

export function summarize(rows: Row[], days: string[]) {
  const key = (r: Row) => `${r.day}|${r.visitor}`; // a visitor's code changes every day, so "visitors" are counted per day
  const all = bucket(), perDay = new Map(days.map(d => [d, bucket()])), perCountry = new Map<string, Bucket>(), sources = new Map<string, Set<string>>(), loc = new Map<string, { kind: string; clicks: number }>(), device = new Map<string, Set<string>>();
  let pageViews = 0, loginClicks = 0, freeTrialClicks = 0, signupClicks = 0;
  const add = (b: Bucket, r: Row) => {
    const k = key(r);
    if (r.name === "page_view") b.visitors.add(k);
    else if (r.name === "plans_view") b.plans.add(k);
    else if (r.name === "cta_free_trial") { b.freeTrial.add(k); b.clicks++; }
    else if (r.name === "cta_signup") { b.signup.add(k); b.clicks++; }
  };
  for (const r of rows) {
    add(all, r); const d = perDay.get(r.day); if (d) add(d, r);
    let c = perCountry.get(r.country); if (!c) perCountry.set(r.country, c = bucket()); add(c, r);
    if (r.name === "page_view") { pageViews++; const s = r.utm || r.ref || "Direct"; (sources.get(s) ?? sources.set(s, new Set()).get(s)!).add(key(r)); (device.get(r.device) ?? device.set(r.device, new Set()).get(r.device)!).add(key(r)); }
    if (r.name === "cta_free_trial") freeTrialClicks++; if (r.name === "cta_signup") signupClicks++; if (r.name === "login_click") loginClicks++;
    if (["cta_free_trial", "cta_signup", "login_click"].includes(r.name)) { const l = `${r.name}|${r.loc ?? "?"}`; const e = loc.get(l) ?? { kind: r.name, clicks: 0 }; e.clicks++; loc.set(l, e); }
  }
  const clickers = new Set([...all.freeTrial, ...all.signup]);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const countries = [...perCountry.entries()].map(([cc, b]) => ({ country: cc, name: nameOf(cc), gcc: (GCC as readonly string[]).includes(cc), visitors: b.visitors.size, plans: b.plans.size, freeTrial: b.freeTrial.size, signup: b.signup.size })).filter(c => c.visitors || c.plans || c.freeTrial || c.signup).sort((a, b) => b.visitors - a.visitors);
  const g = countries.filter(c => c.gcc), sum = (k: "visitors" | "plans" | "freeTrial" | "signup") => g.reduce((t, c) => t + c[k], 0);
  return {
    totals: { visitors: all.visitors.size, pageViews, plansViewers: all.plans.size, freeTrialClicks, freeTrialVisitors: all.freeTrial.size, signupClicks, signupVisitors: all.signup.size, ctaVisitors: clickers.size, loginClicks },
    funnel: [
      { step: "Visitors", count: all.visitors.size, pct: 100 },
      { step: "Viewed plans", count: all.plans.size, pct: pct(all.plans.size, all.visitors.size) },
      { step: "Clicked a sign-up button", count: clickers.size, pct: pct(clickers.size, all.visitors.size) },
    ],
    daily: days.map(d => { const b = perDay.get(d)!; return { day: d, visitors: b.visitors.size, plans: b.plans.size, freeTrial: b.freeTrial.size, signup: b.signup.size }; }),
    countries, gcc: { visitors: sum("visitors"), plans: sum("plans"), freeTrial: sum("freeTrial"), signup: sum("signup") },
    sources: [...sources.entries()].map(([source, v]) => ({ source, visitors: v.size })).sort((a, b) => b.visitors - a.visitors).slice(0, 10),
    locations: [...loc.entries()].map(([k, v]) => ({ kind: v.kind, where: k.split("|")[1]!, clicks: v.clicks })).sort((a, b) => b.clicks - a.clicks),
    devices: [...device.entries()].map(([d, v]) => ({ device: d, visitors: v.size })),
  };
}

export async function analyticsSummary(daysBack: number, now = new Date()) {
  const n = [7, 30, 90].includes(daysBack) ? daysBack : 30;
  const days = Array.from({ length: n }, (_, i) => dubaiDay(new Date(now.getTime() - (n - 1 - i) * 86_400_000)));
  const from = days[0]!, since = new Date(now.getTime() - n * 86_400_000 - 86_400_000);
  const rows = await db.analyticsEvent.findMany({ where: { day: { gte: from } }, select: { name: true, day: true, visitor: true, loc: true, ref: true, utm: true, country: true, device: true }, take: 300_000 });
  const [users, businesses, paid] = await Promise.all([
    db.user.findMany({ where: { createdAt: { gte: since }, phoneNumberVerified: true }, select: { phoneNumber: true, createdAt: true } }),
    db.business.count({ where: { createdAt: { gte: since } } }),
    db.subscription.count({ where: { startedAt: { gte: since }, status: { in: ["ACTIVE", "PAST_DUE"] } } }),
  ]);
  const byCountry = new Map<string, number>();
  for (const u of users) { const dial = COUNTRIES.map(c => c.dial).sort((a, b) => b.length - a.length).find(d => u.phoneNumber.startsWith(d)); const cc = (dial && DIAL_TO_CC[dial]) || "ZZ"; byCountry.set(cc, (byCountry.get(cc) ?? 0) + 1); }
  return { days: n, from, to: days[days.length - 1], ...summarize(rows, days), accounts: { created: users.length, restaurants: businesses, paid, byCountry: [...byCountry.entries()].map(([country, count]) => ({ country, name: nameOf(country), count })).sort((a, b) => b.count - a.count) }, generatedAt: now.toISOString() };
}
