import { superAdminPhones } from "@/server/superadmin";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { AppError } from "@/server/errors";
import { sendWhatsAppCode, sendSmsCode } from "@/modules/whatsapp/verification";
import { phoneSchema, verifyCodeSchema, OTP_SECONDS, RESEND_SECONDS, MAX_ATTEMPTS, MAX_SENDS_PER_HOUR, TEST_CODE, authTestMode } from "./phone";
function digest(phone: string, nonce: string, code: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new AppError("AUTH_NOT_CONFIGURED", "Sign-in is not configured yet.", 503);
  return createHmac("sha256", secret).update(`whatsapp-otp:${phone}:${nonce}:${code}`).digest("hex");
}
export async function requestCode(phoneNumber: string, language: "en" | "ar" = "en", channel: "whatsapp" | "sms" = "whatsapp") {
  const phone = phoneSchema.parse(phoneNumber);
  const testMode = authTestMode();
  const code = testMode ? TEST_CODE : randomInt(0, 1000000).toString().padStart(6, "0");
  const nonce = randomUUID(); const now = new Date();
  const hashed = digest(phone, nonce, code);
  await transaction(async tx => {
    const existing = await tx.phoneChallenge.findUnique({ where: { id: phone } });
    if (!testMode && existing && existing.resendAt > now) throw new AppError("RESEND_TOO_SOON", "Please wait 60 seconds before requesting another code.", 429);
    const sameWindow = existing && now.getTime() - existing.windowStart.getTime() < 3600000;
    if (!testMode && sameWindow && existing.sends >= MAX_SENDS_PER_HOUR) throw new AppError("SEND_LIMIT_REACHED", "Too many codes requested. Please try again in an hour.", 429);
    const data = { digest: hashed, nonce, language, attempts: 0, status: "PENDING", expiresAt: new Date(now.getTime() + OTP_SECONDS * 1000), resendAt: new Date(now.getTime() + RESEND_SECONDS * 1000), windowStart: sameWindow ? existing.windowStart : now, sends: sameWindow ? existing.sends + 1 : 1, cleanupAt: new Date(now.getTime() + 86400000) };
    await tx.phoneChallenge.upsert({ where: { id: phone }, create: { id: phone, ...data }, update: data });
  });
  let delivery: Awaited<ReturnType<typeof sendWhatsAppCode>>;
  try {
    delivery = testMode ? { deliveryLanguage: language } : channel === "sms" ? await sendSmsCode(phone, code, language) : await sendWhatsAppCode(phone, code, language);
    await db.phoneChallenge.updateMany({ where: { id: phone, nonce, status: "PENDING" }, data: { status: "SENT" } });
  } catch (error) {
    await db.phoneChallenge.updateMany({ where: { id: phone, nonce }, data: { status: "FAILED", digest: "" } });
    throw error;
  }
  return { expiresIn: OTP_SECONDS, resendAfter: RESEND_SECONDS, deliveryLanguage: delivery.deliveryLanguage, ...(testMode ? { testMode: true } : {}) };
}
export async function verifyCode(phoneNumber: string, code: string) {
  verifyCodeSchema.parse({ phoneNumber, code });
  const result = await transaction(async tx => {
    const challenge = await tx.phoneChallenge.findUnique({ where: { id: phoneNumber } });
    if (!challenge || challenge.status !== "SENT") return { error: "INVALID_CODE" as const };
    if (challenge.expiresAt <= new Date()) return { error: "CODE_EXPIRED" as const };
    if (challenge.attempts >= MAX_ATTEMPTS) return { error: "ATTEMPTS_EXCEEDED" as const };
    const expected = Buffer.from(challenge.digest, "hex");
    const actual = Buffer.from(digest(phoneNumber, challenge.nonce, code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await tx.phoneChallenge.update({ where: { id: phoneNumber }, data: { attempts: { increment: 1 } } });
      return { error: challenge.attempts + 1 >= MAX_ATTEMPTS ? "ATTEMPTS_EXCEEDED" as const : "INVALID_CODE" as const };
    }
    // The same transaction consumes the code and creates/reuses the verified account.
    await tx.phoneChallenge.update({ where: { id: phoneNumber }, data: { status: "CONSUMED", digest: "" } });
    const existing = await tx.user.findUnique({ where: { phoneNumber } });
    if (existing && existing.status !== "ACTIVE") return { error: "ACCOUNT_UNAVAILABLE" as const };
    const user = existing ? await tx.user.update({ where: { id: existing.id }, data: { phoneNumberVerified: true, preferredLanguage: challenge.language } }) : await tx.user.create({ data: { name: challenge.language === "ar" ? "صاحب المطعم" : "Restaurant owner", preferredLanguage: challenge.language, phoneNumber, phoneNumberVerified: true, email: `${randomUUID()}@phone.lumia.invalid`, emailVerified: false } });
    const membership = await tx.membership.findFirst({ where: { userId: user.id, status: "ACTIVE", organization: { status: "ACTIVE" } } });
    return { user, redirectTo: superAdminPhones().has(user.phoneNumber) ? "/superadmin" : membership ? "/dashboard" : `/onboarding?lang=${challenge.language}` }; // super admin numbers go straight to the super admin
  });
  if ("error" in result) {
    const messages = { INVALID_CODE: "That code isn’t correct. Check the latest WhatsApp message and try again.", CODE_EXPIRED: "This code has expired. Request a new code.", ATTEMPTS_EXCEEDED: "Too many attempts. Request a new code.", ACCOUNT_UNAVAILABLE: "This account is unavailable. Contact support." };
    throw new AppError(result.error!, messages[result.error!], result.error === "ATTEMPTS_EXCEEDED" ? 429 : 400);
  }
  return result;
}
