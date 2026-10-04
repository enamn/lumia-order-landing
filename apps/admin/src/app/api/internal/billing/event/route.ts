import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { handleBillingEvent } from "@/modules/billing/service";
import { jsonBody } from "@/server/api-body";
export const dynamic = "force-dynamic";
// Server-to-server only: lumia-order-api forwards verified Stripe events here with the shared INTERNAL_API_KEY.
export async function POST(request: Request) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return Response.json({ error: { code: "INTERNAL_API_DISABLED" } }, { status: 503 });
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer /, "")); const expected = Buffer.from(key);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  try { return Response.json(await handleBillingEvent(await jsonBody(request, 524288)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    console.error(JSON.stringify({ level: "error", code: "BILLING_EVENT_FAILED" }));
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
