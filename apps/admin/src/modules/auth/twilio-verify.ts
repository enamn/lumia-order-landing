import { AppError } from "@/server/errors";
// SMS sign-in codes through Twilio Verify (the same service the e-commerce backend uses). Twilio generates, sends and checks the code,
// so Lumia stores no code for these challenges. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID.
export const TWILIO_SENTINEL = "twilio-verify"; // stored in the challenge instead of a code hash
const clean = (v: string | undefined) => (typeof v === "string" ? v.trim() : "");
export function twilioConfigured() { return !!(clean(process.env.TWILIO_ACCOUNT_SID) && clean(process.env.TWILIO_AUTH_TOKEN) && clean(process.env.TWILIO_VERIFY_SERVICE_SID)); }
async function call(path: "Verifications" | "VerificationCheck", body: Record<string, string>) {
  const sid = clean(process.env.TWILIO_ACCOUNT_SID), token = clean(process.env.TWILIO_AUTH_TOKEN), service = clean(process.env.TWILIO_VERIFY_SERVICE_SID);
  const res = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
  return { ok: res.ok, status: res.status, json };
}
export async function sendTwilioSms(phoneNumber: string, language: "en" | "ar" = "en") {
  let r;
  try { r = await call("Verifications", { To: phoneNumber, Channel: "sms", Locale: language }); } catch { throw new AppError("SMS_SEND_FAILED", "We couldn’t send your SMS code. Please wait a minute and try again.", 502); }
  if (r.ok) return { deliveryLanguage: language } as const;
  if (r.status === 429) throw new AppError("RESEND_TOO_SOON", "Please wait a minute before requesting another code.", 429);
  if (r.json.code === 60200 || r.json.code === 21211) throw new AppError("PHONE_INVALID", "We couldn’t send an SMS to this number. Check it and try again.", 400);
  throw new AppError("SMS_SEND_FAILED", "We couldn’t send your SMS code. Please wait a minute and try again.", 502);
}
/** true when Twilio approves the code; false when it is wrong, expired or already used. */
export async function checkTwilioCode(phoneNumber: string, code: string) {
  let r;
  try { r = await call("VerificationCheck", { To: phoneNumber, Code: code }); } catch { throw new AppError("SMS_CHECK_FAILED", "We couldn’t check your code right now. Please try again.", 502); }
  if (r.ok) return r.json.status === "approved";
  if (r.status === 404 || r.status === 429) return false; // no pending verification (expired or used) or too many checks
  throw new AppError("SMS_CHECK_FAILED", "We couldn’t check your code right now. Please try again.", 502);
}
