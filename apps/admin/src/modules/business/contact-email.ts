import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { lumiaApi } from "@/server/lumia-api";

// The restaurant's contact email (billing and plan reminders). It is confirmed with a 6-digit code sent to it; only a confirmed address receives reminders.
const CODE_MINUTES = 10, RESEND_SECONDS = 30, MAX_SENDS_PER_HOUR = 5, MAX_ATTEMPTS = 5;
const hash = (businessId: string, code: string) => createHash("sha256").update(`${businessId}:${code}`).digest("hex");
const startSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200), lang: z.enum(["en", "ar"]).optional() });
const confirmSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") });

export async function contactEmailOf(businessId: string) {
  const b = await db.business.findUnique({ where: { id: businessId }, select: { email: true, emailVerifiedAt: true } });
  return { email: b?.email ?? "", verified: !!b?.email && !!b.emailVerifiedAt };
}

export async function startEmailVerification(userId: string, businessId: string, input: unknown, now = new Date()) {
  const { email, lang } = startSchema.parse(input);
  await authorize(userId, businessId, "business.manage");
  const current = await contactEmailOf(businessId);
  if (current.verified && current.email.toLowerCase() === email) return { sent: false, alreadyVerified: true, resendAfter: 0 };
  const old = await db.emailChallenge.findUnique({ where: { businessId } });
  let sendCount = 1, windowStart = now;
  if (old) {
    const wait = RESEND_SECONDS * 1000 - (now.getTime() - old.sentAt.getTime());
    if (wait > 0 && old.email === email) throw new AppError("RATE_LIMITED", `Please wait ${Math.ceil(wait / 1000)} seconds before asking for another code.`, 429);
    if (now.getTime() - old.windowStart.getTime() < 3_600_000) { if (old.sendCount >= MAX_SENDS_PER_HOUR) throw new AppError("RATE_LIMITED", "Too many codes requested. Try again in an hour.", 429); sendCount = old.sendCount + 1; windowStart = old.windowStart; }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const data = { email, codeHash: hash(businessId, code), expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000), attempts: 0, sentAt: now, windowStart, sendCount };
  await db.emailChallenge.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
  const ar = lang === "ar";
  const subject = ar ? "رمز التحقق من البريد في لوميا أوردر" : "Your Lumia Order email verification code";
  const body = ar ? `رمز التحقق الخاص بك هو ${code}. صالح لمدة ${CODE_MINUTES} دقائق. إذا لم تطلب هذا الرمز فتجاهل هذه الرسالة.` : `Your verification code is ${code}. It is valid for ${CODE_MINUTES} minutes. If you did not ask for it, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A0815"${ar ? ' dir="rtl"' : ""}><h2 style="margin:0 0 12px">${subject}</h2><p style="line-height:1.6">${body.replace(code, `</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:12px 0">${code}</p><p style="line-height:1.6">`)}</p></div>`;
  const sent = await lumiaApi("/internal/email/send", { to: email, subject, text: body, html }, 15_000).catch(() => ({ ok: false as const, status: 0 }));
  if (!sent.ok) { await db.emailChallenge.deleteMany({ where: { businessId } }); throw new AppError("EMAIL_FAILED", "We couldn’t send the code. Check the address and try again.", 502); }
  await db.business.update({ where: { id: businessId }, data: { email, emailVerifiedAt: null } });
  return { sent: true, alreadyVerified: false, resendAfter: RESEND_SECONDS };
}

export async function confirmEmailVerification(userId: string, businessId: string, input: unknown, now = new Date()) {
  const { code } = confirmSchema.parse(input);
  await authorize(userId, businessId, "business.manage");
  const c = await db.emailChallenge.findUnique({ where: { businessId } });
  if (!c) throw new AppError("NO_CODE", "Ask for a code first.", 409);
  if (c.expiresAt <= now) throw new AppError("CODE_EXPIRED", "This code has expired. Ask for a new one.", 410);
  if (c.attempts >= MAX_ATTEMPTS) throw new AppError("TOO_MANY_ATTEMPTS", "Too many wrong codes. Ask for a new one.", 429);
  const ok = timingSafeEqual(Buffer.from(hash(businessId, code)), Buffer.from(c.codeHash));
  if (!ok) { await db.emailChallenge.update({ where: { businessId }, data: { attempts: { increment: 1 } } }); throw new AppError("INVALID_CODE", "That code isn’t correct.", 422); }
  await db.$transaction([db.business.update({ where: { id: businessId }, data: { email: c.email, emailVerifiedAt: now } }), db.emailChallenge.deleteMany({ where: { businessId } })]);
  return { email: c.email, verified: true };
}
