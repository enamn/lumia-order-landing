import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";

// Looks an address up on OpenStreetMap (Nominatim), limited to the restaurant's own country, so the owner can pin a branch without leaving the dashboard.
// Nominatim asks for an identifying User-Agent and at most one request a second per user: the dashboard calls it only when "Search" is pressed.
export interface Place { label: string; latitude: number; longitude: number }
export async function searchPlaces(userId: string, businessId: string, query: string): Promise<Place[]> {
  await authorize(userId, businessId, "read");
  return searchPlacesIn((await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { countryCode: true } })).countryCode, query);
}
// Before the restaurant exists (the first branch is chosen while signing up): any signed-in user, one of the six Gulf countries.
export async function searchPlacesIn(countryCode: string, query: string): Promise<Place[]> {
  const q = query.trim(), country = countryCode.toLowerCase();
  if (!["ae", "sa", "om", "bh", "qa", "kw"].includes(country)) throw new AppError("VALIDATION_FAILED", "Choose a Gulf country.", 400);
  if (q.length < 3) return [];
  if (q.length > 200) throw new AppError("VALIDATION_FAILED", "That address is too long.", 400);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0&accept-language=en&countrycodes=${country}&q=${encodeURIComponent(q)}`;
  let res: Response;
  try { res = await fetch(url, { headers: { "User-Agent": "LumiaOrder/1.0 (branch pin search; support@lumia.ae)" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new AppError("GEOCODER_UNAVAILABLE", "Address search is not available right now. Drop the pin on the map instead.", 503); }
  if (!res.ok) throw new AppError("GEOCODER_UNAVAILABLE", "Address search is not available right now. Drop the pin on the map instead.", 503);
  const rows = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
  return rows.flatMap(r => { const latitude = Number(r.lat), longitude = Number(r.lon); return r.display_name && Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ label: r.display_name, latitude, longitude }] : []; });
}

// What is at a point on the map: the address, neighbourhood, city and region, so dropping or dragging the pin fills the branch form in.
export interface Found { display: string; area: string; city: string; state: string }
export async function reversePlace(lat: number, lng: number): Promise<Found | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new AppError("VALIDATION_FAILED", "That location is not valid.", 400);
  let res: Response;
  try { res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`, { headers: { "User-Agent": "LumiaOrder/1.0 (branch pin search; support@lumia.ae)" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new AppError("GEOCODER_UNAVAILABLE", "Address lookup is not available right now.", 503); }
  if (!res.ok) throw new AppError("GEOCODER_UNAVAILABLE", "Address lookup is not available right now.", 503);
  const j = (await res.json()) as { display_name?: string; address?: Record<string, string> };
  if (!j.display_name) return null;
  const a = j.address ?? {};
  return { display: j.display_name, area: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? "", city: a.city ?? a.town ?? a.village ?? "", state: a.state ?? a.region ?? "" };
}
