import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { originAllowed } from "@/server/origin";
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  if (!originAllowed(request.headers.get("origin"))) return Response.json({ code: "INVALID_ORIGIN", message: "Invalid request origin.", requestId }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ code: "INVALID_CONTENT_TYPE", message: "Use application/json.", requestId }, { status: 415 });
  // Read the body once (bounded), validate it, then hand the auth library a fresh request. Avoids Request.clone(), which is fragile across runtimes.
  let text: string;
  try { if (Number(request.headers.get("content-length")) > 32768) throw Error("too large"); text = await request.text(); if (text.length > 32768) throw Error("too large"); JSON.parse(text); }
  catch { return Response.json({ code: "INVALID_REQUEST", message: "Invalid request body.", requestId }, { status: 400 }); }
  const forwarded = new Request(request.url, { method: "POST", headers: request.headers, body: text });
  try {
    const response = await handlers.POST(forwarded);
    response.headers.set("Cache-Control", "no-store"); response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    // Not a client mistake (database or configuration problem): log only the error class and report a server error.
    console.error(JSON.stringify({ level: "error", code: "AUTH_HANDLER_FAILED", requestId, errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again.", requestId }, { status: 503 });
  }
}
