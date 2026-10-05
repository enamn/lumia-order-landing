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

// What each plan includes every month, counted from the plan's own billing day. The limit restaurants see is WhatsApp orders. Behind it, AI replies,
// voice notes and menu imports have a fair-use cap so chatting without ordering cannot run up costs. Sized from the real cost of an order (about 7 AI replies,
// roughly AED 0.5), so a plan used to its limit still earns money.
export interface Limits { orders: number; voice: number; imports: number }
export const LIMITS: Record<PlanId, Limits> = { starter: { orders: 100, voice: 60, imports: 3 }, plus: { orders: 150, voice: 120, imports: 10 }, pro: { orders: 250, voice: 200, imports: 30 } };
// The free trial reads a menu with AI only twice.
export const TRIAL_LIMITS: Limits = { orders: 20, voice: 20, imports: 2 };
// Branches: Starter 1, Plus 3 (fixed), Pro 3 and more at AED 99 a month each (AED 990 a year). Every extra branch adds some orders to the monthly limit.
export const INCLUDED_BRANCHES: Record<PlanId, number> = { starter: 1, plus: 3, pro: 3 };
export const EXTRA_BRANCH = { monthly: 99, yearly: 990, orders: 80, max: 27 };
// Fair use: AI replies allowed per order of the monthly limit (a normal order takes about 7).
export const REPLIES_PER_ORDER = 15;
// Someone already halfway through an order may finish it even when the monthly orders are used up, up to this much extra.
export const ORDER_BUFFER = 0.1;
// Extra orders bought on top of the plan. They never expire and are used only after the monthly orders. Prices are before VAT, in AED.
export const TOPUPS = { orders50: { orders: 50, price: 79 }, orders200: { orders: 200, price: 249 } } as const;
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
export function quoteRenewal(plan: PlanId, billing: Billing, extraBranches = 0): Quote {
  const lines: Line[] = [{ name: planName(plan, billing), unitMinor: planMinor(plan, billing), quantity: 1 }];
  if (plan === "pro" && extraBranches > 0) lines.push({ name: `Extra branch (${billing})`, unitMinor: fils(EXTRA_BRANCH[billing]), quantity: extraBranches });
  return withVat(lines);
}
// One more branch in the middle of a period pays for the time that is left.
export function quoteExtraBranch(billing: Billing, periodStart: Date, periodEnd: Date, now: Date): Quote {
  const total = periodEnd.getTime() - periodStart.getTime(), left = Math.max(0, Math.min(total, periodEnd.getTime() - now.getTime()));
  return withVat([{ name: "Extra branch (rest of period)", unitMinor: Math.round(fils(EXTRA_BRANCH[billing]) * (total > 0 ? left / total : 0)), quantity: 1 }]);
}
export const quoteTopUp = (pack: TopUpId): Quote => withVat([{ name: `Lumia Order extra orders (${TOPUPS[pack].orders})`, unitMinor: fils(TOPUPS[pack].price), quantity: 1 }]);
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
