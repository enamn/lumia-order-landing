import { ZodError } from "zod";
import { AppError } from "@/server/errors";
import { pairDevice } from "@/modules/devices/service";
export const dynamic = "force-dynamic";

// The terminal app sends the 6-digit code (typed, or read from the QR code) with its serial number, and receives its own key once.
// No sign-in and no browser origin: the code is the proof, wrong codes are limited per address, and the code works once for 10 minutes.
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("INVALID_CONTENT_TYPE", "Use application/json.", 415);
    const text = await request.text(); if (text.length > 2000) throw new AppError("VALIDATION_ERROR", "Request too large.", 413);
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
    const data = await pairDevice(JSON.parse(text), ip);
    return Response.json({ data }, { headers: { "Cache-Control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    let status = 500, code = "INTERNAL_ERROR", message = "Something went wrong. Please try again.";
    if (error instanceof AppError) { status = error.status; code = error.code; message = error.message; }
    else if (error instanceof ZodError) { status = 422; code = "VALIDATION_ERROR"; message = error.issues[0]?.message ?? "Invalid input."; }
    else if (error instanceof SyntaxError) { status = 400; code = "INVALID_JSON"; message = "Invalid JSON body."; }
    else console.error(JSON.stringify({ level: "error", requestId, code, status }));
    return Response.json({ error: { code, message, requestId } }, { status, headers: { "Cache-Control": "no-store", "x-request-id": requestId } });
  }
}
