// A browser request that changes something must come from the app itself. In production that is exactly APP_URL. While developing, the same app is also reached
// at http://localhost:<port> or 127.0.0.1 (APP_URL is often set to https for Stripe or Meta), so those are accepted there and only there.
export function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === new URL(process.env.APP_URL ?? "http://localhost:3000").origin) return true;
  if (process.env.NODE_ENV === "production") return false;
  try { const u = new URL(origin); return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]"; } catch { return false; }
}
