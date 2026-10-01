import { db } from "@/server/db";
export const dynamic = "force-dynamic";
// Readiness probe: can the app reach MongoDB? Reports only up/down, never the connection details or the error text.
export async function GET() {
  try { await db.$runCommandRaw({ ping: 1 }); return Response.json({ status: "ok", db: "up" }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ status: "degraded", db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
