import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z, ZodError } from "zod";
import { jsonBody } from "@/server/api-body";
import { db } from "@/server/db";
import { META_REVIEW_FIELDS } from "@/modules/superadmin/meta-events";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  field: z.enum(META_REVIEW_FIELDS),
  wabaId: z.string().max(40).optional(),
  phoneNumberId: z.string().max(40).optional(),
  subject: z.string().max(240).optional(),
  status: z.string().max(100).optional(),
  reason: z.string().max(500).optional(),
  occurredAt: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()),
}).strict();
const bodySchema = z.object({ events: z.array(eventSchema).min(1).max(100) }).strict();

export async function POST(request: Request) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return Response.json({ error: { code: "INTERNAL_API_DISABLED" } }, { status: 503 });
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  const expected = Buffer.from(key);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  try {
    const { events } = bodySchema.parse(await jsonBody(request, 262144));
    await db.metaWebhookEvent.createMany({ data: events.map(event => ({ ...event, payload: event.payload as Prisma.InputJsonValue, occurredAt: event.occurredAt ? new Date(event.occurredAt) : undefined })) });
    return Response.json({ stored: events.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    console.error(JSON.stringify({ level: "error", code: "META_EVENT_FAILED" }));
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
