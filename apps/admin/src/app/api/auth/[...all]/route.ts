import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { jsonBody } from "@/server/api-body";
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const origin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
  if (request.headers.get("origin") !== origin) return Response.json({ code: "INVALID_ORIGIN", message: "Invalid request origin.", requestId }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ code: "INVALID_CONTENT_TYPE", message: "Use application/json.", requestId }, { status: 415 });
  try {
    await jsonBody(request.clone());
    const response = await handlers.POST(request);
    response.headers.set("Cache-Control", "no-store"); response.headers.set("x-request-id", requestId);
    return response;
  } catch { return Response.json({ code: "INVALID_REQUEST", message: "Invalid request body.", requestId }, { status: 400 }); }
}
