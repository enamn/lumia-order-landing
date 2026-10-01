import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { recordInbound } from "@/modules/messages/inbound";
import { jsonBody } from "@/server/api-body";
export const dynamic = "force-dynamic";
// Server-to-server only: lumia-order-api forwards customer messages here with the shared INTERNAL_API_KEY. Not a browser endpoint.
export async function POST(request: Request) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return Response.json({ error: { code: "INTERNAL_API_DISABLED" } }, { status: 503 });
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer /, "")); const expected = Buffer.from(key);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  try { return Response.json(await recordInbound(await jsonBody(request, 262144)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    console.error(JSON.stringify({ level: "error", code: "INBOUND_FAILED" }));
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
