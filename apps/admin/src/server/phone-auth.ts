import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { requestCode, verifyCode } from "@/modules/auth/otp";
import { sendCodeSchema, verifyCodeSchema } from "@/modules/auth/phone";
import { AppError } from "./errors";
function publicError(error: unknown): never {
  if (error instanceof AppError) throw new APIError(({ 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 429: "TOO_MANY_REQUESTS", 502: "BAD_GATEWAY", 503: "SERVICE_UNAVAILABLE" } as const)[error.status as 400 | 401 | 403 | 429 | 502 | 503] ?? "INTERNAL_SERVER_ERROR", { code: error.code, message: error.message });
  throw new APIError("INTERNAL_SERVER_ERROR", { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again." });
}
export function whatsappAuth() {
 return { id: "lumia-whatsapp", endpoints: {
   sendWhatsAppOtp: createAuthEndpoint("/whatsapp/send-code", { method: "POST", body: sendCodeSchema }, async ctx => {
     try { return ctx.json(await requestCode(ctx.body.phoneNumber, ctx.body.language, ctx.body.channel)); } catch (error) { publicError(error); }
   }),
   verifyWhatsAppOtp: createAuthEndpoint("/whatsapp/verify-code", { method: "POST", body: verifyCodeSchema }, async ctx => {
     try {
       const { user, redirectTo } = await verifyCode(ctx.body.phoneNumber, ctx.body.code);
       const session = await ctx.context.internalAdapter.createSession(user.id, false);
       if (!session) throw new AppError("SESSION_FAILED", "Please request a new code and try again.", 500);
       await setSessionCookie(ctx, { session, user });
       // Session token is in a signed HttpOnly cookie, never in JSON/localStorage.
       return ctx.json({ redirectTo });
     } catch (error) { publicError(error); }
   }),
 } };
}
