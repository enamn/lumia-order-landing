import { Prisma } from "@prisma/client";
import { db } from "@/server/db";

// Discount codes sent in campaigns. A customer types the code in the chat; the server decides whether it counts, never the assistant.
export const normalizeCode = (raw?: string | null) => (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
export type CodeCheck = { ok: true; id: string; code: string; percent: number } | { ok: false; code: string; reason: "UNKNOWN" | "EXPIRED" | "USED" };

// null when no code was given. Otherwise: valid for this customer now, or why not.
export async function checkCode(businessId: string, customerId: string, raw: string | undefined | null, now = new Date()): Promise<CodeCheck | null> {
  const code = normalizeCode(raw);
  if (!code) return null;
  const row = await db.discountCode.findFirst({ where: { businessId, code } });
  if (!row || row.startsAt > now) return { ok: false, code, reason: "UNKNOWN" };
  if (!row.active || row.expiresAt < now) return { ok: false, code, reason: "EXPIRED" };
  if (await db.discountRedemption.findFirst({ where: { codeId: row.id, customerId } })) return { ok: false, code, reason: "USED" };
  return { ok: true, id: row.id, code: row.code, percent: row.percent };
}

type Tx = Pick<typeof db, "discountCode" | "discountRedemption" | "campaign">;
// The order that used the code was sent to the restaurant: count the use (once per customer) and the campaign's "code used" number.
export async function redeemCode(tx: Tx, input: { codeId: string; businessId: string; customerId: string; orderId: string }) {
  try { await tx.discountRedemption.create({ data: input }); }
  catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; throw e; } // already used by this customer: the order keeps its price, the use is not counted twice
  const code = await tx.discountCode.update({ where: { id: input.codeId }, data: { usedCount: { increment: 1 } }, select: { campaignId: true } });
  if (code.campaignId) await tx.campaign.update({ where: { id: code.campaignId }, data: { usedCount: { increment: 1 } } });
}
