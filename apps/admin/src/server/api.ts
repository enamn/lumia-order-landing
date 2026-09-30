import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "./auth";
import { AppError } from "./errors";
import { db } from "./db";
export async function api(request: Request, action: (userId: string, requestId: string) => Promise<unknown>) {
  const requestId = crypto.randomUUID();
  let status = 200;
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (!origin || origin !== new URL(process.env.APP_URL ?? "http://localhost:3000").origin) throw new AppError("INVALID_ORIGIN", "Invalid request origin.", 403);
      if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("INVALID_CONTENT_TYPE", "Use application/json.", 415);
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new AppError("UNAUTHENTICATED", "Please sign in.", 401);
    const active = await db.user.findFirst({ where: { id: session.user.id, status: "ACTIVE", phoneNumberVerified: true }, select: { id: true } });
    if (!active) throw new AppError("UNAUTHENTICATED", "Please sign in.", 401);
    const data = await action(session.user.id, requestId);
    return Response.json({ data }, { headers: { "x-request-id": requestId, "Cache-Control": "no-store" } });
  } catch (error) {
    let code = "INTERNAL_ERROR", message = "Something went wrong. Please try again.", details: unknown;
    status = 500;
    if (error instanceof AppError) { status = error.status; code = error.code; message = error.message; details = error.details; }
    else if (error instanceof ZodError) { status = 422; code = "VALIDATION_ERROR"; message = error.issues[0]?.message ?? "Invalid input."; details = error.flatten(); }
    else if (error instanceof SyntaxError) { status = 400; code = "INVALID_JSON"; message = "Invalid JSON body."; }
    else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { status = 409; code = "CONFLICT"; message = "This record already exists."; }
    // Only allowlisted metadata is logged. No request bodies, cookies, tokens, emails or exception payloads.
    console.error(JSON.stringify({ level: "error", requestId, code, status }));
    return Response.json({ error: { code, message, requestId, ...(details ? { details } : {}) } }, { status, headers: { "x-request-id": requestId, "Cache-Control": "no-store" } });
  } finally {
    console.info(JSON.stringify({ level: "info", requestId, method: request.method, status }));
  }
}
export { jsonBody } from "./api-body";
