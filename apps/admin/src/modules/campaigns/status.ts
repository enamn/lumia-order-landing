import { z } from "zod";
import { db } from "@/server/db";

// WhatsApp tells us when a message we sent was delivered, read or could not be delivered. Only campaign messages are tracked.
export const statusSchema = z.object({ statuses: z.array(z.object({ messageId: z.string().min(5).max(200), status: z.enum(["delivered", "read", "failed"]), timestamp: z.string().regex(/^\d{1,12}$/), phoneNumberId: z.string().max(40).optional(), errorCode: z.number().int().optional() }).strict()).max(200) }).strict();
const RANK: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };

export async function recordStatuses(input: unknown) {
  const { statuses } = statusSchema.parse(input);
  const campaigns = new Set<string>(); let updated = 0;
  for (const st of statuses) {
    const rec = await db.campaignRecipient.findFirst({ where: { messageId: st.messageId } });
    if (!rec) continue; // an ordinary chat message, not a campaign
    const at = new Date(Number(st.timestamp) * 1000);
    if (st.status === "failed") { if (rec.status === "READ" || rec.status === "DELIVERED") continue; await db.campaignRecipient.update({ where: { id: rec.id }, data: { status: "FAILED", error: st.errorCode ? `WhatsApp error ${st.errorCode}` : "Not delivered" } }); }
    else {
      const next = st.status === "read" ? "READ" : "DELIVERED";
      if ((RANK[rec.status] ?? 0) >= RANK[next]!) continue; // updates can arrive out of order: never go backwards
      await db.campaignRecipient.update({ where: { id: rec.id }, data: { status: next, error: null, ...(next === "READ" ? { readAt: at, ...(rec.deliveredAt ? {} : { deliveredAt: at }) } : { deliveredAt: at }) } });
    }
    campaigns.add(rec.campaignId); updated++;
  }
  for (const id of campaigns) await refreshCounts(id);
  return { updated };
}
// The campaign's numbers come from its recipients, so they can always be recomputed.
export async function refreshCounts(campaignId: string) {
  const rows = await db.campaignRecipient.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } });
  const n = (s: string) => rows.find(r => r.status === s)?._count._all ?? 0;
  await db.campaign.update({ where: { id: campaignId }, data: { sentCount: n("SENT") + n("DELIVERED") + n("READ"), deliveredCount: n("DELIVERED") + n("READ"), readCount: n("READ"), failedCount: n("FAILED") } });
}
