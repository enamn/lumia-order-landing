// Prices and rules for the plans. This is the only place amounts are decided: the payment page, the renewal job and plan changes all
// use it, and Stripe is told exactly what to charge. Amounts are in fils (1/100 AED).
export type PlanId = "starter" | "plus" | "pro";
export type Billing = "monthly" | "yearly";
export const PLAN_IDS: readonly PlanId[] = ["starter", "plus", "pro"];
export const PLANS: Record<PlanId, { name: string; monthly: number; yearly: number; rank: number }> = {
  starter: { name: "Starter", monthly: 149, yearly: 1490, rank: 1 },
  plus: { name: "Plus", monthly: 249, yearly: 2490, rank: 2 },
  pro: { name: "Pro", monthly: 399, yearly: 3990, rank: 3 },
};
// The first terminal costs less on a yearly plan; extra terminals are the same for everyone.
export const TERMINAL = { yearly: { starter: 549, plus: 499, pro: 399 } as Record<PlanId, number>, monthly: 599, extra: 599 };
export const VAT_PERCENT = 5;

// What each plan includes every month (counted from the plan's own billing day). An AI reply is one answer the assistant sends; a voice note is one transcription;
// an import is one menu file read by AI. Sized from the real cost of a reply (about AED 0.08 today), so a plan used to its limit still earns money.
export interface Limits { aiReplies: number; voice: number; imports: number }
export const LIMITS: Record<PlanId, Limits> = { starter: { aiReplies: 400, voice: 40, imports: 3 }, plus: { aiReplies: 1000, voice: 150, imports: 10 }, pro: { aiReplies: 2000, voice: 400, imports: 30 } };
export const TRIAL_LIMITS: Limits = { aiReplies: 150, voice: 15, imports: 3 };
// Someone already halfway through an order may finish it even when the monthly allowance is used up, up to this much extra.
export const ORDER_BUFFER = 0.1;
// Extra AI replies bought on top of the plan. They never expire and are used only after the monthly allowance. Prices are before VAT, in AED.
export const TOPUPS = { ai500: { replies: 500, price: 69 }, ai2000: { replies: 2000, price: 229 } } as const;
export type TopUpId = keyof typeof TOPUPS;
export const TOPUP_IDS = Object.keys(TOPUPS) as TopUpId[];
// Retries after a failed renewal, in days after the previous attempt. After the last one fails the subscription lapses.
export const RETRY_DAYS = [1, 3, 5];

export interface Line { name: string; unitMinor: number; quantity: number }
export interface Quote { lines: Line[]; subtotalMinor: number; vatMinor: number; totalMinor: number }
const fils = (aed: number) => Math.round(aed * 100);
export const planMinor = (plan: PlanId, billing: Billing) => fils(PLANS[plan][billing]);
const planName = (plan: PlanId, billing: Billing) => `Lumia Order ${PLANS[plan].name} (${billing})`;
// VAT is 5% of the subtotal, rounded to the nearest fils, and shown as its own line so the total is exactly what is charged.
export function withVat(lines: Line[]): Quote {
  const subtotalMinor = lines.reduce((t, l) => t + l.unitMinor * l.quantity, 0), vatMinor = Math.round(subtotalMinor * VAT_PERCENT / 100);
  return { lines, subtotalMinor, vatMinor, totalMinor: subtotalMinor + vatMinor };
}
export function quoteSignup(plan: PlanId, billing: Billing, terminals: number): Quote {
  const first = fils(billing === "yearly" ? TERMINAL.yearly[plan] : TERMINAL.monthly);
  const lines: Line[] = [{ name: planName(plan, billing), unitMinor: planMinor(plan, billing), quantity: 1 }, { name: "Lumia Order Terminal", unitMinor: first, quantity: 1 }];
  if (terminals > 1) lines.push({ name: "Lumia Order Terminal (extra)", unitMinor: fils(TERMINAL.extra), quantity: terminals - 1 });
  return withVat(lines);
}
export const quoteRenewal = (plan: PlanId, billing: Billing): Quote => withVat([{ name: planName(plan, billing), unitMinor: planMinor(plan, billing), quantity: 1 }]);
export const quoteTopUp = (pack: TopUpId): Quote => withVat([{ name: `Lumia Order AI replies (${TOPUPS[pack].replies.toLocaleString("en-US")})`, unitMinor: fils(TOPUPS[pack].price), quantity: 1 }]);
export const isUpgrade = (from: PlanId, to: PlanId) => PLANS[to].rank > PLANS[from].rank;

// An upgrade in the middle of a period pays the price difference for the time that is left (same billing cycle).
export function quoteUpgrade(from: PlanId, to: PlanId, billing: Billing, periodStart: Date, periodEnd: Date, now: Date): Quote {
  const total = periodEnd.getTime() - periodStart.getTime(), left = Math.max(0, Math.min(total, periodEnd.getTime() - now.getTime()));
  const amount = Math.round((planMinor(to, billing) - planMinor(from, billing)) * (total > 0 ? left / total : 0));
  return withVat([{ name: `Upgrade ${PLANS[from].name} → ${PLANS[to].name} (rest of period)`, unitMinor: Math.max(amount, 0), quantity: 1 }]);
}

// One month or one year later, keeping the day of the month where possible (31 Jan -> 28/29 Feb).
export function addPeriod(from: Date, billing: Billing): Date {
  const d = new Date(from.getTime()), day = d.getUTCDate();
  d.setUTCDate(1); if (billing === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d;
}
