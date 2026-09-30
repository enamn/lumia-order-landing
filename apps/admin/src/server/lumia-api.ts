import { AppError } from "./errors";
// Server-to-server client for lumia-order-api, which owns every call to Meta (WhatsApp) and Claude.
export async function lumiaApi<T>(path: string, body: unknown, timeoutMs: number): Promise<{ ok: true; data: T } | { ok: false; status: number; code?: string }> {
  const base = (process.env.LUMIA_API_URL ?? "http://localhost:4000").replace(/\/$/, ""); const key = process.env.INTERNAL_API_KEY;
  if (!key) throw new AppError("API_NOT_CONFIGURED", "Lumia service is not configured yet. Please try again later.", 503);
  try {
    const response = await fetch(`${base}${path}`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(timeoutMs), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    if (!response.ok) return { ok: false, status: response.status, code: json?.error?.code };
    return { ok: true, data: json as T };
  } catch { return { ok: false, status: 0 }; }
}
