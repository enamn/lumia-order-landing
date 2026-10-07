import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

// Terminal orders: every subscription that bought a terminal, with the delivery stage the restaurant sees on its Overview page.
export const STAGES = ["Order placed", "Preparing", "Shipped", "Out for delivery", "Delivered"] as const;
interface Stored { stage?: number; dates?: (string | null)[]; tracking?: string }

export async function listTerminalOrders() {
  const subs = await db.subscription.findMany({ where: { terminals: { gt: 0 } }, orderBy: { startedAt: "desc" }, take: 300 });
  const biz = await db.business.findMany({ where: { id: { in: subs.map(s => s.businessId) } }, select: { id: true, name: true, countryCode: true, phone: true, email: true } });
  const byId = new Map(biz.map(b => [b.id, b]));
  return subs.map(s => {
    const t = (s.terminal ?? {}) as Stored, b = byId.get(s.businessId);
    return { id: s.id, restaurant: b?.name ?? "", country: b?.countryCode ?? "", phone: b?.phone ?? "", email: b?.email ?? "", plan: s.plan, status: s.status, quantity: s.terminals, address: s.terminalAddress ?? "", placedAt: s.startedAt, stage: Math.max(0, Math.min(4, t.stage ?? 0)), stageName: STAGES[Math.max(0, Math.min(4, t.stage ?? 0))], tracking: t.tracking ?? "", dates: t.dates ?? [] };
  });
}

const stageSchema = z.object({ stage: z.number().int().min(0).max(4), tracking: z.string().trim().max(80).optional() }).strict();
export async function setTerminalStage(actorId: string, subscriptionId: string, input: unknown, now = new Date()) {
  const b = stageSchema.parse(input);
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub || sub.terminals < 1) throw new AppError("NOT_FOUND", "Terminal order not found.", 404);
  const before = (sub.terminal ?? {}) as Stored, dates = Array.from({ length: 5 }, (_, i) => before.dates?.[i] ?? null);
  for (let i = 0; i <= b.stage; i++) dates[i] = dates[i] ?? now.toISOString(); // a stage reached keeps the day it was first reached
  for (let i = b.stage + 1; i < 5; i++) dates[i] = null; // moving back clears the later days
  const tracking = b.tracking === undefined ? before.tracking : b.tracking || undefined;
  const next = { stage: b.stage, dates, ...(tracking ? { tracking } : {}) };
  await db.subscription.update({ where: { id: sub.id }, data: { terminal: next as unknown as Prisma.InputJsonValue } });
  const business = await db.business.findUnique({ where: { id: sub.businessId }, select: { organizationId: true } });
  if (business) await db.auditLog.create({ data: { organizationId: business.organizationId, businessId: sub.businessId, userId: actorId, entityType: "Subscription", entityId: sub.id, action: "terminal.stage", beforeData: { stage: before.stage ?? 0, tracking: before.tracking ?? null } as Prisma.InputJsonValue, afterData: { stage: b.stage, tracking: tracking ?? null } as Prisma.InputJsonValue } });
  return { id: sub.id, stage: b.stage, stageName: STAGES[b.stage], tracking: tracking ?? "" };
}
