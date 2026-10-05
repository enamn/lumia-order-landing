// Delivery pricing, decided by the server from the restaurant's Settings and where the customer is. The assistant never states a fee itself.
export const EMIRATES = ["Sharjah", "Ajman", "Dubai", "Abu Dhabi", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"] as const;
export type Emirate = (typeof EMIRATES)[number];

export interface DeliveryRules {
  status: "available" | "pickup" | "paused"; method: "area" | "distance" | "free" | "manual" | null; minOrder: string; freeAbove: string; eta: string; pinReq: boolean;
  areas: { emirate: string; area: string; fee: string; min: string; eta: string; branch: string; on: boolean }[];
  ranges: { from: string; to: string; fee: string; min: string; eta: string; on: boolean }[];
  freeEm: string[]; freeAreas: string; freeBranch: string; manualMsg: string; confirmFirst: boolean;
}
export interface BranchPoint { id: string; name: string; active: boolean; latitude: number | null; longitude: number | null }
export interface CustomerPlace { emirate: string | null; area: string; latitude?: number; longitude?: number }

export type Quote =
  | { status: "ok"; feeMinor: number; minimumMinor: number; etaMinutes: number | null; branchId: string | null; manual: boolean; distanceKm?: number; free: boolean }
  | { status: "needs"; need: "pin" | "area" }
  | { status: "outside"; reason: "range" | "area" | "emirate"; where: string }
  | { status: "unavailable"; reason: "PICKUP_ONLY" | "PAUSED" };

const EMIRATE_WORDS: [Emirate, RegExp][] = [
  ["Sharjah", /sharjah|الشارقة|الشارقه|sharja/i], ["Ajman", /ajman|عجمان/i], ["Dubai", /dubai|دبي|dxb/i], ["Abu Dhabi", /abu\s*dhabi|أبو\s*ظبي|ابو\s*ظبي|ابوظبي|أبوظبي/i],
  ["Umm Al Quwain", /umm\s*al\s*quwain|um\s*al\s*quwain|uaq|أم\s*القيوين|ام\s*القيوين/i], ["Ras Al Khaimah", /ras\s*al\s*khaimah|rak\b|رأس\s*الخيمة|راس\s*الخيمة|رأس\s*الخيمه/i], ["Fujairah", /fujairah|fujeirah|الفجيرة|الفجيره/i],
];
// The assistant returns a canonical emirate; this also finds one in free text (English or Arabic) as a safety net.
export function emirateFrom(...texts: (string | null | undefined)[]): Emirate | null {
  for (const t of texts) { if (!t) continue; const exact = EMIRATES.find(e => e.toLowerCase() === t.trim().toLowerCase()); if (exact) return exact; for (const [e, re] of EMIRATE_WORDS) if (re.test(t)) return e; }
  return null;
}

const fils = (v: string | undefined) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };
const mins = (v: string | undefined) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const allAreas = (a: string) => !a.trim() || /^all\b|^كل|^جميع/i.test(a.trim());

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const r = (d: number) => d * Math.PI / 180, R = 6371, dLat = r(b.latitude - a.latitude), dLng = r(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// The closest active branch that has a location pin of its own.
export function nearestBranch(branches: BranchPoint[], pin: { latitude: number; longitude: number }): string | null {
  const ranked = branches.filter(b => b.active && b.latitude !== null && b.longitude !== null).map(b => ({ id: b.id, km: distanceKm(pin, { latitude: b.latitude!, longitude: b.longitude! }) })).sort((x, y) => x.km - y.km);
  return ranked[0]?.id ?? null;
}
const firstBranch = (branches: BranchPoint[]) => branches.find(b => b.active)?.id ?? null;
const hasPin = (c: CustomerPlace): c is CustomerPlace & { latitude: number; longitude: number } => typeof c.latitude === "number" && typeof c.longitude === "number";

// Works out the delivery fee for one customer. `rules` null means delivery was never configured in Settings: delivery stays free of charge, as before.
export function quoteDelivery(rules: DeliveryRules | null, branches: BranchPoint[], place: CustomerPlace, subtotalMinor: number, fallbackMinimumMinor: number): Quote {
  if (!rules) return { status: "ok", feeMinor: 0, minimumMinor: fallbackMinimumMinor, etaMinutes: null, branchId: firstBranch(branches), manual: false, free: true };
  if (rules.status === "pickup") return { status: "unavailable", reason: "PICKUP_ONLY" };
  if (rules.status === "paused") return { status: "unavailable", reason: "PAUSED" };
  const base = mins(rules.eta), baseMin = fils(rules.minOrder) || fallbackMinimumMinor;
  const done = (feeMinor: number, o: { min?: string; eta?: string; branch?: string | null; km?: number }): Extract<Quote, { status: "ok" }> => {
    const free = rules.freeAbove !== "" && fils(rules.freeAbove) > 0 && subtotalMinor >= fils(rules.freeAbove);
    return { status: "ok", feeMinor: free ? 0 : feeMinor, minimumMinor: fils(o.min) || baseMin, etaMinutes: mins(o.eta) ?? base, branchId: o.branch || firstBranch(branches), manual: false, free: free || feeMinor === 0, ...(o.km !== undefined ? { distanceKm: Math.round(o.km * 10) / 10 } : {}) };
  };
  switch (rules.method) {
    case null: return done(0, {});
    case "manual": return { ...done(0, {}), manual: true, free: false };
    case "free": {
      const em = place.emirate; if (!em) return { status: "needs", need: "area" };
      if (!rules.freeEm.includes(em)) return { status: "outside", reason: "emirate", where: em };
      return done(0, { branch: rules.freeBranch });
    }
    case "area": {
      if (!place.emirate) return { status: "needs", need: "area" };
      const spot = norm(place.area);
      const rule = rules.areas.find(r => r.on && r.emirate === place.emirate && (allAreas(r.area) || (spot && (norm(r.area).includes(spot) || spot.includes(norm(r.area))))));
      if (!rule) return rules.areas.some(r => r.on && r.emirate === place.emirate && !allAreas(r.area)) && !spot ? { status: "needs", need: "area" } : { status: "outside", reason: "area", where: [place.area, place.emirate].filter(Boolean).join(", ") };
      return done(fils(rule.fee), { min: rule.min, eta: rule.eta, branch: rule.branch });
    }
    case "distance": {
      if (!hasPin(place)) return { status: "needs", need: "pin" };
      const near = branches.filter(b => b.active && b.latitude !== null && b.longitude !== null).map(b => ({ b, km: distanceKm(place, { latitude: b.latitude!, longitude: b.longitude! }) })).sort((x, y) => x.km - y.km)[0];
      if (!near) return { status: "outside", reason: "range", where: "no branch location is set" };
      const rule = rules.ranges.find(r => r.on && near.km >= Number(r.from || 0) && (r.to === "" || near.km < Number(r.to)));
      if (!rule) return { status: "outside", reason: "range", where: `${Math.round(near.km * 10) / 10} km` };
      return done(fils(rule.fee), { min: rule.min, eta: rule.eta, branch: near.b.id, km: near.km });
    }
  }
}
