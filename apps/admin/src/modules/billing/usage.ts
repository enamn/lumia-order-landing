import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { LIMITS, ORDER_BUFFER, TRIAL_LIMITS, type Limits, type PlanId } from "./plans";
import { getSubscriptionFor, trialInfo } from "./service";

// Monthly allowances per plan. Every AI reply, voice note and menu import is counted here before it costs anything, and the count is claimed atomically
// so two messages arriving together cannot both slip past the limit. Bought credits are used only after the monthly allowance and never expire.
export type Kind = "ai" | "voice" | "imports";
const FIELD: Record<Kind, keyof Limits> = { ai: "aiReplies", voice: "voice", imports: "imports" };
const FOREVER = new Date(0);

const monthAfter = (anchor: Date, n: number) => {
  const d = new Date(anchor.getTime()), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d;
};
// The billing month `now` falls in, counted from the anchor (the plan's start, or the sign-up day during the trial).
export function usagePeriod(anchor: Date, now: Date) {
  let n = Math.max(0, (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth());
  while (n > 0 && monthAfter(anchor, n) > now) n--;
  while (monthAfter(anchor, n + 1) <= now) n++;
  return { start: monthAfter(anchor, n), end: monthAfter(anchor, n + 1) };
}

// Which allowance applies: the plan's, the trial's, or (cancelled, lapsed) the smallest plan's.
export async function allowanceFor(businessId: string, now = new Date()) {
  const [sub, b] = await Promise.all([getSubscriptionFor(businessId), db.business.findUniqueOrThrow({ where: { id: businessId }, select: { createdAt: true } })]);
  const active = sub?.status === "ACTIVE" || sub?.status === "PAST_DUE";
  const trial = !sub && trialInfo(b.createdAt, now.getTime()).daysLeft > 0;
  const limits = active ? LIMITS[sub!.plan as PlanId] : trial ? TRIAL_LIMITS : LIMITS.starter;
  return { limits, period: usagePeriod(active ? sub!.currentPeriodStart : b.createdAt, now), source: active ? "plan" as const : trial ? "trial" as const : "none" as const };
}

async function row(businessId: string, periodStart: Date, kind: string) {
  const where = { businessId, periodStart, kind };
  const found = await db.usageCounter.findFirst({ where });
  if (found) return found;
  try { return await db.usageCounter.create({ data: where }); }
  catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return db.usageCounter.findFirstOrThrow({ where }); throw e; }
}
const claim = async (id: string, below: number) => (await db.usageCounter.updateMany({ where: { id, used: { lt: below } }, data: { used: { increment: 1 } } })).count === 1;

export type Claim = { ok: true; from: "plan" | "buffer" | "credits"; periodStart: Date } | { ok: false };
// Takes one unit of an allowance. `inProgress` lets someone finish an order they already started, a little past the limit.
export async function consume(businessId: string, kind: Kind, opts: { inProgress?: boolean; now?: Date } = {}): Promise<Claim> {
  const { limits, period } = await allowanceFor(businessId, opts.now);
  const limit = limits[FIELD[kind]], counter = await row(businessId, period.start, kind);
  if (await claim(counter.id, limit)) return { ok: true, from: "plan", periodStart: period.start };
  if (kind === "ai") {
    const credits = await db.usageCounter.findFirst({ where: { businessId, periodStart: FOREVER, kind: "credits" } });
    if (credits && (await db.usageCounter.updateMany({ where: { id: credits.id, used: { gt: 0 } }, data: { used: { decrement: 1 } } })).count === 1) return { ok: true, from: "credits", periodStart: period.start };
  }
  if (opts.inProgress && await claim(counter.id, limit + Math.ceil(limit * ORDER_BUFFER))) return { ok: true, from: "buffer", periodStart: period.start };
  return { ok: false };
}
// Gives a unit back when the work it paid for did not happen (the AI call failed).
export async function refund(businessId: string, kind: Kind, taken: Extract<Claim, { ok: true }>) {
  if (taken.from === "credits") { const credits = await row(businessId, FOREVER, "credits"); await db.usageCounter.update({ where: { id: credits.id }, data: { used: { increment: 1 } } }); return; }
  const counter = await row(businessId, taken.periodStart, kind);
  await db.usageCounter.updateMany({ where: { id: counter.id, used: { gt: 0 } }, data: { used: { decrement: 1 } } });
}
export async function addCredits(businessId: string, replies: number) {
  const credits = await row(businessId, FOREVER, "credits");
  await db.usageCounter.update({ where: { id: credits.id }, data: { used: { increment: replies } } });
}

// What the Billing page shows.
export async function usageSummary(businessId: string, now = new Date()) {
  const { limits, period, source } = await allowanceFor(businessId, now);
  const rows = await db.usageCounter.findMany({ where: { businessId, OR: [{ periodStart: period.start }, { periodStart: FOREVER }] } });
  const used = (kind: string, at: Date) => rows.find(r => r.kind === kind && r.periodStart.getTime() === at.getTime())?.used ?? 0;
  return {
    source, periodStart: period.start.toISOString(), periodEnd: period.end.toISOString(), credits: used("credits", FOREVER),
    aiReplies: { used: used("ai", period.start), limit: limits.aiReplies }, voice: { used: used("voice", period.start), limit: limits.voice }, imports: { used: used("imports", period.start), limit: limits.imports },
  };
}
