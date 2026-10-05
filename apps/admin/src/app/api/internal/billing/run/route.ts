import { timingSafeEqual } from "node:crypto";
import { runBilling } from "@/modules/billing/service";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
// Called on a schedule (Cloud Scheduler, hourly) with the shared INTERNAL_API_KEY: charges the subscriptions that are due and retries failed renewals.
export async function POST(request: Request) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return Response.json({ error: { code: "INTERNAL_API_DISABLED" } }, { status: 503 });
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer /, "")); const expected = Buffer.from(key);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  try { const result = await runBilling(); console.info(JSON.stringify({ level: "info", code: "BILLING_RUN", ...result })); return Response.json(result, { headers: { "Cache-Control": "no-store" } }); }
  catch { console.error(JSON.stringify({ level: "error", code: "BILLING_RUN_FAILED" })); return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 }); }
}
