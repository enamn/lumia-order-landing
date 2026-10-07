import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { lumiaApi } from "@/server/lumia-api";
import { brandedEmail } from "@/modules/email/layout";
import { MARKETS } from "@/modules/market/countries";
import { TRIAL_DAYS, accessOf, trialInfo } from "./service";

// Reminder emails about the trial and the plan, sent from the hourly billing job (through lumia-order-api).
// Each email goes out once per period: a BillingNotice row is claimed first, and removed again if the email could not be sent so the next run retries.
type Kind = "trial_3d" | "trial_1d" | "trial_ended" | "plan_ending_3d" | "plan_ending_1d" | "payment_failed" | "plan_ended";
interface Vars { business: string; date?: string; graceDate?: string }
const DAY = 86_400_000, VAT_COUNTRIES = Object.values(MARKETS).filter(m => m.requiresVerifiedVatForSaas).map(m => m.code);

const COPY: Record<Kind, { en: (v: Vars) => [string, string]; ar: (v: Vars) => [string, string] }> = {
  trial_3d: { en: v => ["Your free trial ends in 3 days", `Your Lumia Order free trial for ${v.business} ends on ${v.date}. Choose a plan before then to keep receiving WhatsApp orders. After that the dashboard is locked and the assistant stops replying.`],
    ar: v => ["تنتهي تجربتك المجانية بعد 3 أيام", `تنتهي تجربة لوميا أوردر المجانية لـ ${v.business} في ${v.date}. اختر باقة قبل ذلك لتستمر في استقبال طلبات واتساب. بعدها تُقفل لوحة التحكم ويتوقف المساعد عن الرد.`] },
  trial_1d: { en: v => ["Your free trial ends tomorrow", `Your free trial for ${v.business} ends on ${v.date}. Choose a plan today so your WhatsApp ordering does not stop.`],
    ar: v => ["تنتهي تجربتك المجانية غداً", `تنتهي تجربتك المجانية لـ ${v.business} في ${v.date}. اختر باقة اليوم حتى لا يتوقف استقبال الطلبات عبر واتساب.`] },
  trial_ended: { en: v => ["Your free trial has ended", `The free trial for ${v.business} has ended. The dashboard is locked and the WhatsApp assistant has stopped replying. Choose a plan to switch everything back on.`],
    ar: v => ["انتهت تجربتك المجانية", `انتهت التجربة المجانية لـ ${v.business}. تم قفل لوحة التحكم وتوقف مساعد واتساب عن الرد. اختر باقة لإعادة تشغيل كل شيء.`] },
  plan_ending_3d: { en: v => ["Your plan ends in 3 days", `Your Lumia Order plan for ${v.business} is set to end on ${v.date} and will not renew. Resume it in Billing to keep your dashboard and WhatsApp assistant running.`],
    ar: v => ["تنتهي باقتك بعد 3 أيام", `ستنتهي باقة لوميا أوردر لـ ${v.business} في ${v.date} ولن تتجدد. أعد تفعيلها من صفحة الفوترة لتبقى لوحة التحكم ومساعد واتساب يعملان.`] },
  plan_ending_1d: { en: v => ["Your plan ends tomorrow", `Your plan for ${v.business} ends on ${v.date}. Resume it in Billing today so nothing stops.`],
    ar: v => ["تنتهي باقتك غداً", `تنتهي باقتك لـ ${v.business} في ${v.date}. أعد تفعيلها من صفحة الفوترة اليوم حتى لا يتوقف شيء.`] },
  payment_failed: { en: v => ["We couldn’t renew your plan", `The renewal payment for ${v.business} failed. Everything keeps working until ${v.graceDate}. Update your card in Billing before then, otherwise the dashboard is locked and the assistant stops replying.`],
    ar: v => ["تعذّر تجديد باقتك", `فشلت دفعة التجديد لـ ${v.business}. يستمر كل شيء بالعمل حتى ${v.graceDate}. حدّث بطاقتك من صفحة الفوترة قبل ذلك، وإلا ستُقفل لوحة التحكم ويتوقف المساعد عن الرد.`] },
  plan_ended: { en: v => ["Your plan has ended", `The plan for ${v.business} has ended. The dashboard is locked and the WhatsApp assistant has stopped replying. Choose a plan to switch everything back on.`],
    ar: v => ["انتهت باقتك", `انتهت باقة ${v.business}. تم قفل لوحة التحكم وتوقف مساعد واتساب عن الرد. اختر باقة لإعادة تشغيل كل شيء.`] },
};

export function renderEmail(kind: Kind, lang: "en" | "ar", vars: Vars, link: string) {
  const [subject, body] = COPY[kind][lang](vars);
  const ended = kind === "trial_ended" || kind === "plan_ended", failed = kind === "payment_failed";
  const { html, text } = brandedEmail({
    lang, heading: subject, body: [lang === "ar" ? `مرحباً ${vars.business}،` : `Hello ${vars.business},`, body], preheader: body.slice(0, 110),
    button: { label: lang === "ar" ? (failed ? "تحديث البطاقة" : "اختيار باقة") : failed ? "Update my card" : ended || kind.startsWith("trial") ? "Choose a plan" : "Open Billing", url: link },
    note: lang === "ar" ? "إذا كنت قد اتخذت الإجراء المطلوب فتجاهل هذه الرسالة." : "If you have already taken care of this, you can ignore this email.",
  });
  return { subject, html, text };
}

// Only the restaurant's confirmed contact email (Settings → Profile). Phone sign-ups have just a placeholder address, which is never used.
async function recipients(businessId: string) {
  const b = await db.business.findUnique({ where: { id: businessId }, select: { name: true, email: true, emailVerifiedAt: true, organizationId: true } });
  if (!b) return null;
  const list = new Map<string, "en" | "ar">();
  if (b.email && b.emailVerifiedAt) {
    const owner = await db.membership.findFirst({ where: { organizationId: b.organizationId, status: "ACTIVE", role: "OWNER" }, select: { user: { select: { preferredLanguage: true } } } });
    list.set(b.email.toLowerCase(), owner?.user.preferredLanguage === "ar" ? "ar" : "en");
  }
  return { name: b.name, list };
}

// Dates in a reminder use the restaurant's own country time zone (Riyadh, Muscat, ...), not Dubai.
const zoneOf = async (businessId: string) => (await db.business.findUnique({ where: { id: businessId }, select: { timezone: true } }))?.timezone ?? "Asia/Dubai";
const fmt = (d: Date, timeZone = "Asia/Dubai") => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone });

export async function notify(businessId: string, kind: Kind, periodKey: string, vars: Omit<Vars, "business">): Promise<boolean> {
  try { await db.billingNotice.create({ data: { businessId, kind, periodKey } }); }
  catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; throw e; }
  const to = await recipients(businessId);
  const link = `${(process.env.APP_URL ?? "https://app.order.lumia.ae").replace(/\/$/, "")}/dashboard`;
  let sent = 0;
  for (const [email, lang] of to?.list ?? []) {
    const mail = renderEmail(kind, lang, { business: to!.name, ...vars }, link);
    const r = await lumiaApi("/internal/email/send", { to: email, ...mail }, 15_000).catch(() => ({ ok: false as const, status: 0 }));
    if (r.ok) sent++; else console.error(JSON.stringify({ level: "error", code: "REMINDER_EMAIL_FAILED", kind, status: r.status }));
  }
  if (!sent) { await db.billingNotice.deleteMany({ where: { businessId, kind, periodKey } }); return false; } // nobody got it (no email provider yet, or no address): try again next run
  console.info(JSON.stringify({ level: "info", code: "REMINDER_SENT", kind, emails: sent }));
  return true;
}

export async function runReminders(now = new Date()) {
  const out = { sent: 0, checked: 0 };
  const t = now.getTime();
  const count = async (p: Promise<boolean>) => { out.checked++; try { if (await p) out.sent++; } catch { console.error(JSON.stringify({ level: "error", code: "REMINDER_ITEM_FAILED" })); } };

  // Free trial: no plan yet. Looks at businesses whose trial ends within 3 days, or ended in the last two weeks.
  // The trial starts when the restaurant is created, except in Saudi Arabia, Oman and Bahrain where it starts when the VAT registration is verified.
  const from = (days: number) => new Date(t - days * DAY), window = { gte: from(TRIAL_DAYS + 14), lte: from(TRIAL_DAYS - 3) };
  const plain = await db.business.findMany({ where: { createdAt: window, countryCode: { notIn: VAT_COUNTRIES } }, select: { id: true, createdAt: true }, take: 500 });
  const verified = await db.billingTaxProfile.findMany({ where: { vatVerificationStatus: "VERIFIED", verifiedAt: window, billingCountry: { in: VAT_COUNTRIES } }, select: { businessId: true, verifiedAt: true }, take: 500 });
  const trials = [...plain.map(b => ({ id: b.id, start: b.createdAt })), ...verified.map(v => ({ id: v.businessId, start: v.verifiedAt! }))];
  const subbed = new Set((await db.subscription.findMany({ where: { businessId: { in: trials.map(b => b.id) } }, select: { businessId: true } })).map(s => s.businessId));
  for (const b of trials) {
    if (subbed.has(b.id)) continue;
    const info = trialInfo(b.start, t), date = fmt(new Date(info.endsAt), await zoneOf(b.id));
    if (info.daysLeft === 0) await count(notify(b.id, "trial_ended", "trial", {}));
    else if (info.daysLeft <= 1) await count(notify(b.id, "trial_1d", "trial", { date }));
    else await count(notify(b.id, "trial_3d", "trial", { date }));
  }
  // Plans: ending (cancelled at period end), a failed renewal (grace period), and ended.
  const subs = await db.subscription.findMany({ where: { OR: [{ status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: { lte: new Date(t + 3 * DAY), gt: now } }, { status: "PAST_DUE" }, { status: { in: ["ENDED", "CANCELED"] }, updatedAt: { gte: new Date(t - 14 * DAY) } }] }, take: 500 });
  for (const s of subs) {
    const key = s.currentPeriodEnd.toISOString().slice(0, 10);
    if (s.status === "ACTIVE") await count(notify(s.businessId, s.currentPeriodEnd.getTime() - t <= DAY ? "plan_ending_1d" : "plan_ending_3d", key, { date: fmt(s.currentPeriodEnd, await zoneOf(s.businessId)) }));
    else if (s.status === "PAST_DUE") { const a = accessOf(s, new Date(0), t); if (a.active && a.graceEndsAt) await count(notify(s.businessId, "payment_failed", `${key}:${s.failedAttempts}`, { graceDate: fmt(new Date(a.graceEndsAt), await zoneOf(s.businessId)) })); }
    else await count(notify(s.businessId, "plan_ended", key, {}));
  }
  return out;
}
