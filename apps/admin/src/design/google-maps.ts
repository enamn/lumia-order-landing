// Google Maps for the dashboard: the key is public by design (restrict it to this site's addresses in the Google Cloud console) and enables two things,
// address suggestions (Places) and the map. Without a key the dashboard uses its OpenStreetMap search and map instead, so nothing breaks.
export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loading: Promise<any> | null = null;
export function loadGoogle(): Promise<any> {
  if (!GOOGLE_KEY || typeof window === "undefined") return Promise.reject(new Error("NO_KEY"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&loading=async&callback=__lumiaGoogleReady`;
    s.async = true; s.onerror = () => { loading = null; reject(new Error("LOAD_FAILED")); };
    w.__lumiaGoogleReady = () => resolve(w.google.maps);
    w.gm_authFailure = () => { loading = null; reject(new Error("KEY_REJECTED")); }; // a key that is wrong or not allowed for this address
    document.head.appendChild(s);
  });
  return loading;
}

// "25.2048, 55.2708" from what an owner pastes: a Google Maps link (@lat,lng, !3d!4d, ?q=lat,lng) or the two numbers.
export function coordsFromText(text: string): string | null {
  let t = text.trim(); try { t = decodeURIComponent(t); } catch { /* use as typed */ }
  const m = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/.exec(t) ?? /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(t) ?? /[?&](?:q|ll|query)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(t) ?? /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/.exec(t);
  if (!m || Math.abs(+m[1]!) > 90 || Math.abs(+m[2]!) > 180) return null;
  return `${(+m[1]!).toFixed(6)}, ${(+m[2]!).toFixed(6)}`;
}
export const parseCoords = (v: string): [number, number] | null => { const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(v); return m ? [+m[1]!, +m[2]!] : null; };
export const COUNTRY_CENTER: Record<string, [number, number]> = { AE: [25.2048, 55.2708], SA: [24.7136, 46.6753], OM: [23.588, 58.3829], BH: [26.2285, 50.586], QA: [25.2854, 51.531], KW: [29.3759, 47.9774] };
