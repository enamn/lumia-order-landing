import { ZodError } from "zod";
import { AppError } from "@/server/errors";
import { authenticateDevice, touchDevice } from "@/modules/devices/service";
import { jsonBody } from "@/server/api-body";

type Device = NonNullable<Awaited<ReturnType<typeof authenticateDevice>>>;
// Calls made by a terminal with its own key (Authorization: Bearer lumd_...). No sign-in cookie, no browser origin.
export async function deviceApi(request: Request, action: (device: Device, requestId: string, body: () => Promise<unknown>) => Promise<unknown>) {
  const requestId = crypto.randomUUID(), headers = { "Cache-Control": "no-store", "x-request-id": requestId };
  try {
    const device = await authenticateDevice(/^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1]);
    if (!device) throw new AppError("UNAUTHORIZED", "This terminal is not connected.", 401);
    void touchDevice(device.id);
    return Response.json({ data: await action(device, requestId, () => jsonBody(request)) }, { headers });
  } catch (error) {
    let status = 500, code = "INTERNAL_ERROR", message = "Something went wrong. Please try again.";
    if (error instanceof AppError) { status = error.status; code = error.code; message = error.message; }
    else if (error instanceof ZodError) { status = 422; code = "VALIDATION_ERROR"; message = error.issues[0]?.message ?? "Invalid input."; }
    else if (error instanceof SyntaxError) { status = 400; code = "INVALID_JSON"; message = "Invalid JSON body."; }
    else console.error(JSON.stringify({ level: "error", requestId, code, status }));
    return Response.json({ error: { code, message, requestId } }, { status, headers });
  }
}
