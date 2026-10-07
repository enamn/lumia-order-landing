import { z } from "zod";
import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { lumiaApi } from "@/server/lumia-api";
import { decryptSecret } from "@/server/crypto";
import { campaignAudience, requireCustomers } from "@/modules/customers/service";
import { allowanceFor, consumeMany, refundMany } from "@/modules/billing/usage";
import { normalizeCode } from "./codes";
import { refreshCounts } from "./status";

// Offers sent to customers on WhatsApp (Plus and Pro). They may not have written in the last 24 hours, so each one goes out as an approved marketing
// template: the restaurant's message, the offer line (code, percentage, last day) and the restaurant's name, with the offer image as the header.
export const PERCENTS = [10, 15, 20, 25] as const; export const DAYS = [7, 14, 30] as const;
const MAX_RECIPIENTS = 500, PARALLEL = 6;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const sendSchema = z.object({
  mode: z.enum(["all", "offer"]), customerIds: z.array(z.string().max(60)).max(MAX_RECIPIENTS).default([]),
  message: z.string().trim().min(1, "Write the message.").max(600, "Keep the message under 600 characters."),
  code: z.object({ code: z.string().max(40), percent: z.number().refine(v => (PERCENTS as readonly number[]).includes(v), "Choose 10, 15, 20 or 25 percent."), days: z.number().refine(v => (DAYS as readonly number[]).includes(v), "Choose 7, 14 or 30 days.") }).strict().optional(),
  image: z.object({ name: z.string().trim().max(120), mimeType: z.enum(IMAGE_TYPES), data: z.string().max(7_200_000) }).strict().optional(),
}).strict();

const isArabic = (t: string) => /[؀-ۿ]/.test(t);
const dateLabel = (d: Date, ar: boolean, timeZone = "Asia/Dubai") => d.toLocaleDateString(ar ? "ar-AE" : "en-GB", { day: "numeric", month: "short", timeZone });
const firstName = (name: string, phone: string, ar: boolean) => (name && name !== phone ? name.split(/\s+/)[0]! : ar ? "عزيزي العميل" : "there");
export const offerLine = (code: { code: string; percent: number } | null, until: Date | null, ar: boolean, zone = "Asia/Dubai") => code && until
  ? (ar ? `الكود ${code.code}: خصم ${code.percent}%، صالح حتى ${dateLabel(until, true, zone)}.` : `Code ${code.code}: ${code.percent}% off, valid until ${dateLabel(until, false, zone)}.`)
  : (ar ? "رد على هذه الرسالة للطلب." : "Reply to this message to order.");

const REASONS: Record<string, [string, number]> = {
  TEMPLATE_UNAVAILABLE: ["The WhatsApp offer message isn’t approved yet, so nothing was sent. Please try again once it is approved.", 409],
  WHATSAPP_TOKEN_INVALID: ["The WhatsApp connection needs to be reconnected before you can send offers.", 409],
  RATE_LIMITED: ["WhatsApp is limiting how fast messages can be sent right now. Please try again in a little while.", 429],
  MEDIA_UPLOAD_FAILED: ["We couldn’t upload the offer image. Try a different image.", 502],
  API_UNAVAILABLE: ["We couldn’t reach the Lumia messaging service, so nothing was sent. Please try again in a moment.", 503],
};
const ABORT = new Set(["TEMPLATE_UNAVAILABLE", "WHATSAPP_TOKEN_INVALID", "RATE_LIMITED", "API_UNAVAILABLE"]);
// A failed call with no error code at all means the messaging service could not be reached (not that WhatsApp refused something).
const codeOf = (r: { status: number; code?: string | undefined }) => r.code ?? (r.status === 0 || r.status >= 500 ? "API_UNAVAILABLE" : undefined);

export async function listCampaigns(userId: string, businessId: string) {
  await authorize(userId, businessId);
  await requireCustomers(businessId);
  const rows = await db.campaign.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 30 });
  return { campaigns: rows.map(c => ({ id: c.id, title: c.title, mode: c.mode === "ALL" ? "all" : "offer", recipients: c.recipientCount, hasImage: Boolean(c.imageName), sent: c.sentCount, read: c.readCount, used: c.usedCount, failed: c.failedCount, status: c.status, createdAt: c.createdAt.toISOString() })) };
}

export async function sendCampaign(userId: string, businessId: string, input: unknown, now = new Date()) {
  const t0 = Date.now(), lap: Record<string, number> = {};
  const body = sendSchema.parse(input);
  await authorize(userId, businessId, "business.manage");
  const account = await db.whatsAppAccount.findFirst({ where: { businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  if (!account?.phoneNumberId || !account.accessTokenEncrypted) throw new AppError("WHATSAPP_NOT_CONNECTED", "Connect WhatsApp before sending offers.", 409);
  await requireCustomers(businessId);
  const everyone = (await campaignAudience(businessId)).filter(c => !c.optedOut); // customers who said STOP are never included
  const picked = body.mode === "all" ? everyone : everyone.filter(c => body.customerIds.includes(c.id));
  if (!picked.length) throw new AppError("NO_RECIPIENTS", body.mode === "all" ? "You have no customers to message yet." : "Select at least one customer.", 400);
  if (picked.length > MAX_RECIPIENTS) throw new AppError("TOO_MANY_RECIPIENTS", `You can send an offer to up to ${MAX_RECIPIENTS} customers at a time.`, 400);
  const code = body.code ? { code: normalizeCode(body.code.code), percent: body.code.percent, days: body.code.days } : null;
  if (body.mode === "offer" && !code) throw new AppError("CODE_REQUIRED", "Add a discount code to a custom offer.", 400);
  if (code && code.code.length < 3) throw new AppError("VALIDATION_FAILED", "The code needs 3 to 14 letters or numbers.", 400);
  if (body.image && (!/^[A-Za-z0-9+/=]+$/.test(body.image.data) || body.image.data.length * 0.75 > 5 * 1048576)) throw new AppError("FILE_TOO_LARGE", "Use an image under 5 MB.", 413);

  // The plan's monthly campaign messages (Meta bills marketing messages to the restaurant's own account; this keeps the shared WhatsApp app in good standing).
  const room = await consumeMany(businessId, "campaigns", picked.length, now);
  if (!room.ok) { const { limits } = await allowanceFor(businessId, now); throw new AppError("CAMPAIGN_LIMIT", limits.campaigns ? `Your plan includes ${limits.campaigns} offer messages a month and ${room.left} are left. Send to fewer customers or upgrade your plan.` : "Campaigns are available on the Plus and Pro plans.", 409); }
  const undo = async (ids: { campaignId?: string; codeId?: string } = {}) => {
    if (ids.campaignId) { await db.campaignRecipient.deleteMany({ where: { campaignId: ids.campaignId } }); await db.campaign.deleteMany({ where: { id: ids.campaignId } }); }
    if (ids.codeId) await db.discountCode.updateMany({ where: { id: ids.codeId }, data: { active: false, campaignId: null } });
  };
  let codeRow: { id: string } | null = null, campaignId = "", cleaned = false;
  try {
    const until = code ? new Date(now.getTime() + code.days * 86_400_000) : null;
    if (code && until) {
      const existing = await db.discountCode.findFirst({ where: { businessId, code: code.code } });
      if (existing && existing.active && existing.expiresAt > now) throw new AppError("CODE_IN_USE", `The code ${code.code} is already running until ${dateLabel(existing.expiresAt, false)}. Choose another code.`, 409);
      if (existing) { await db.discountRedemption.deleteMany({ where: { codeId: existing.id } }); codeRow = await db.discountCode.update({ where: { id: existing.id }, data: { percent: code.percent, startsAt: now, expiresAt: until, usedCount: 0, active: true, campaignId: null } }); } // an old code can run again as a fresh offer
      else codeRow = await db.discountCode.create({ data: { businessId, code: code.code, percent: code.percent, startsAt: now, expiresAt: until } });
    }
    const title = code ? `${code.percent}% off · ${code.code}` : body.message.slice(0, 48);
    const campaign = await db.campaign.create({ data: { businessId, createdByUserId: userId, mode: body.mode === "all" ? "ALL" : "OFFER", title, message: body.message, imageName: body.image?.name ?? null, discountCodeId: codeRow?.id ?? null, discountCode: code?.code ?? null, discountPercent: code?.percent ?? null, validUntil: until, recipientCount: picked.length } });
    campaignId = campaign.id;
    if (codeRow) await db.discountCode.update({ where: { id: codeRow.id }, data: { campaignId } });
    await db.campaignRecipient.createMany({ data: picked.map(c => ({ campaignId, businessId, customerId: c.id, phone: c.phone })) });

    lap.prepare = Date.now() - t0;
    const token = decryptSecret(account.accessTokenEncrypted);
    let mediaId: string | undefined;
    if (body.image) {
      const up = await lumiaApi<{ mediaId: string }>("/internal/whatsapp/media", { accessToken: token, phoneNumberId: account.phoneNumberId, mimeType: body.image.mimeType, data: body.image.data }, 45_000);
      if (!up.ok) { const c = codeOf(up) ?? "MEDIA_UPLOAD_FAILED"; const [msg, status] = REASONS[c] ?? REASONS.MEDIA_UPLOAD_FAILED!; throw new AppError(c, msg, status); }
      mediaId = up.data.mediaId; await db.campaign.update({ where: { id: campaignId }, data: { imageMediaId: mediaId } });
    }

    lap.upload = Date.now() - t0 - lap.prepare!;
    const ar = isArabic(body.message), biz = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, timezone: true } }), line = offerLine(code, until, ar, biz.timezone), restaurant = biz.name;
    let aborted: string | null = null, next = 0, sent = 0;
    const recipients = await db.campaignRecipient.findMany({ where: { campaignId } });
    const byCustomer = new Map(picked.map(c => [c.id, c]));
    const worker = async () => {
      while (!aborted) {
        const rec = recipients[next++]; if (!rec) return;
        const c = byCustomer.get(rec.customerId)!;
        const personal = body.message.replace(/\{name\}/g, firstName(c.name, c.phone, ar));
        const r = await lumiaApi<{ messageId: string }>("/internal/whatsapp/campaign", { accessToken: token, phoneNumberId: account.phoneNumberId!, to: rec.phone, ...(mediaId ? { mediaId } : {}), message: personal, offer: line, restaurantName: restaurant }, 30_000);
        if (r.ok) { sent++; await db.campaignRecipient.update({ where: { id: rec.id }, data: { status: "SENT", messageId: r.data.messageId, sentAt: new Date() } }); }
        else { const c = codeOf(r); if (c && ABORT.has(c)) aborted = c; await db.campaignRecipient.update({ where: { id: rec.id }, data: { status: "FAILED", error: c ?? `status ${r.status}` } }); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, recipients.length) }, worker));
    lap.send = Date.now() - t0 - lap.prepare! - lap.upload!;
    if (aborted) await db.campaignRecipient.updateMany({ where: { campaignId, status: "PENDING" }, data: { status: "FAILED", error: aborted } });
    if (aborted && !sent) { const [msg, status] = REASONS[aborted]!; await undo({ campaignId, ...(codeRow ? { codeId: codeRow.id } : {}) }); await refundMany(businessId, "campaigns", picked.length, room.periodStart); cleaned = true; throw new AppError(aborted, msg, status); }
    await refreshCounts(campaignId);
    const done = await db.campaign.update({ where: { id: campaignId }, data: { status: aborted ? "PARTIAL" : "DONE" } });
    console.info(JSON.stringify({ event: "campaign.sent", recipients: picked.length, sent: done.sentCount, failed: done.failedCount, hasImage: Boolean(body.image), ms: { ...lap, total: Date.now() - t0 } })); // where the time went: preparing (database), image upload, sending
    if (done.failedCount) await refundMany(businessId, "campaigns", done.failedCount, room.periodStart); // messages that never left do not count against the month
    return { id: done.id, title: done.title, mode: body.mode, recipients: done.recipientCount, hasImage: Boolean(done.imageName), sent: done.sentCount, read: done.readCount, used: done.usedCount, failed: done.failedCount, status: done.status, createdAt: done.createdAt.toISOString() };
  } catch (e) {
    // Anything that went wrong before a single message left: leave nothing half-made and give the allowance back.
    if (!cleaned) {
      const sentAny = campaignId ? await db.campaignRecipient.count({ where: { campaignId, status: { in: ["SENT", "DELIVERED", "READ"] } } }) : 0;
      if (!sentAny) { await undo({ ...(campaignId ? { campaignId } : {}), ...(codeRow ? { codeId: codeRow.id } : {}) }).catch(() => undefined); await refundMany(businessId, "campaigns", picked.length, room.periodStart).catch(() => undefined); }
    }
    throw e;
  }
}
