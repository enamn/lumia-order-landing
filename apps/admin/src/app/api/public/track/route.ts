import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { countryOfIp } from "@/server/geoip";
import { dubaiDay } from "@/server/dubai-day";
export const dynamic = "force-dynamic";

// Receives the landing page's analytics events. No cookies and no IP address are kept: only the country (looked up from the IP here, in memory) and
// an anonymous visitor code that changes every day (a hash of a secret, the day, the IP and the browser). Bots are ignored.
const EVENTS = new Set(["page_view", "plans_view", "cta_free_trial", "cta_signup", "login_click"]);
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python|axios|node-fetch|go-http|java\/|monitor|uptime|facebookexternalhit|whatsapp/i;
const MAX_PER_VISITOR_PER_DAY = 200;
const allowed = () => new Set([(process.env.NEXT_PUBLIC_MARKETING_URL ?? "").replace(/\/$/, ""), ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"])].filter(Boolean));
const cors = (origin: string | null) => ({ "Access-Control-Allow-Origin": origin ?? "", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" });
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().replace(/[^\w.:/@+\- ]/g, "").slice(0, n) : "");
const GEO_HEADERS = ["x-client-geo-location", "x-appengine-country", "cf-ipcountry", "x-vercel-ip-country", "x-country-code"]; // used when the platform provides one

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, { status: 204, headers: origin && allowed().has(origin) ? cors(origin) : {} });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !allowed().has(origin)) return new Response(null, { status: 403 });
  const headers = cors(origin), done = () => new Response(null, { status: 204, headers });
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || BOT.test(ua)) return done();
    const text = await request.text(); if (text.length > 2000) return done();
    const b = JSON.parse(text) as Record<string, unknown>;
    if (typeof b.event !== "string" || !EVENTS.has(b.event)) return done();
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
    let country = "";
    for (const h of GEO_HEADERS) { const v = request.headers.get(h)?.trim().toUpperCase(); if (v && /^[A-Z]{2}$/.test(v)) { country = v; break; } }
    if (!country) country = (ip && countryOfIp(ip)) || "ZZ";
    const day = dubaiDay();
    const visitor = createHash("sha256").update(`${process.env.BETTER_AUTH_SECRET ?? "dev"}|${day}|${ip}|${ua}`).digest("hex").slice(0, 16);
    if (await db.analyticsEvent.count({ where: { day, visitor } }) >= MAX_PER_VISITOR_PER_DAY) return done();
    const w = Number(b.w);
    await db.analyticsEvent.create({ data: { day, visitor, name: b.event, loc: clip(b.loc, 40) || null, path: clip(b.path, 100) || null, ref: clip(b.ref, 100) || null, utm: clip(b.utm, 40) || null, country, device: w > 0 && w < 768 ? "mobile" : "desktop" } });
  } catch { /* analytics must never return an error to the page */ }
  return done();
}
