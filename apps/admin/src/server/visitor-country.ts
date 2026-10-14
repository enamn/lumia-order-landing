import { countryOfIp } from "./geoip";

// The visitor's country (ISO 3166 alpha-2) from the request: a country header added by the platform in front of the app, otherwise the IP address looked up in the bundled table (nothing is stored or sent anywhere).
const GEO_HEADERS = ["x-client-geo-location", "x-appengine-country", "cf-ipcountry", "x-vercel-ip-country", "x-country-code"];

export function visitorCountry(headers: { get(name: string): string | null }): string {
  for (const h of GEO_HEADERS) { const v = headers.get(h)?.trim().toUpperCase(); if (v && /^[A-Z]{2}$/.test(v)) return v; }
  const ip = (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  return (ip && countryOfIp(ip)) || "";
}
