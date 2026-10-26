import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";

// Looks an address up on OpenStreetMap (Nominatim), limited to the restaurant's own country, so the owner can pin a branch without leaving the dashboard.
// Nominatim asks for an identifying User-Agent and at most one request a second per user: the dashboard calls it only when "Search" is pressed.
export interface Place { label: string; latitude: number; longitude: number }
export async function searchPlaces(userId: string, businessId: string, query: string): Promise<Place[]> {
  await authorize(userId, businessId, "read");
  const q = query.trim();
  if (q.length < 3) return [];
  if (q.length > 200) throw new AppError("VALIDATION_FAILED", "That address is too long.", 400);
  const country = (await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { countryCode: true } })).countryCode.toLowerCase();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0&accept-language=en&countrycodes=${country}&q=${encodeURIComponent(q)}`;
  let res: Response;
  try { res = await fetch(url, { headers: { "User-Agent": "LumiaOrder/1.0 (branch pin search; support@lumia.ae)" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new AppError("GEOCODER_UNAVAILABLE", "Address search is not available right now. Drop the pin on the map instead.", 503); }
  if (!res.ok) throw new AppError("GEOCODER_UNAVAILABLE", "Address search is not available right now. Drop the pin on the map instead.", 503);
  const rows = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
  return rows.flatMap(r => { const latitude = Number(r.lat), longitude = Number(r.lon); return r.display_name && Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ label: r.display_name, latitude, longitude }] : []; });
}
