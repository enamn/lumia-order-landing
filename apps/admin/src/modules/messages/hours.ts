import type { Hours } from "@/modules/settings/schema";
// Is the restaurant taking orders right now? Worked out from the working hours the owner set (Settings > Hours), in the restaurant's own time zone.
// The assistant uses it so a customer who orders while the restaurant is closed is told so, with the working hours, instead of the order being taken.
type Day = Hours["same"][number];
export type OpenState =
  | { open: true }
  | { open: false; why: "closed" | "off" | "break" | "last"; week: Day[]; next: { dayOffset: number; weekday: number; time: string } | null; reopenOn?: string };
const toMin = (t: string) => { const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };
/** Local weekday (0 = Monday), minutes since midnight and calendar date in the given time zone. */
function localNow(now: Date, timeZone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(x => [x.type, x.value]));
  return { weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday!), minutes: Number(p.hour) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` };
}
/** Which of the week's rows apply: the same hours every day, one set for all branches, or the branch the customer is ordering from. */
export function weeksOf(h: Hours, branchId: string | null): Day[][] {
  if (h.mode === "every") return [Array.from({ length: 7 }, () => h.every)];
  if (h.scope === "per") { const mine = branchId ? h.per[branchId] : undefined; return mine ? [mine] : Object.values(h.per).length ? Object.values(h.per) : [h.same]; }
  return [h.same];
}
function dayStatus(d: Day | undefined, minutes: number, prev: Day | undefined): "open" | "off" | "break" | "last" | "before" {
  // Last night's hours that run past midnight (for example 18:00 to 02:00) still count in the early hours.
  if (prev?.open && toMin(prev.to) <= toMin(prev.from) && minutes < toMin(prev.to)) return "open";
  if (!d?.open) return "off";
  const from = toMin(d.from), to = toMin(d.to), overnight = to <= from;
  if (minutes < from) return "before";
  if (!overnight && minutes >= to) return "off";
  if (d.brk && minutes >= toMin(d.bFrom) && minutes < toMin(d.bTo)) return "break";
  if (!overnight && d.last && minutes >= toMin(d.last) && toMin(d.last) < to) return "last";
  return "open";
}
export function openStatus(hours: Hours | null, branchId: string | null, timeZone: string, now = new Date()): OpenState {
  if (!hours) return { open: true }; // no hours set up: never turn orders away
  const { weekday, minutes, date } = localNow(now, timeZone), weeks = weeksOf(hours, branchId);
  if (hours.mode === "closed") return hours.closedUntil && date >= hours.closedUntil ? { open: true } : { open: false, why: "closed", week: weeks[0]!, next: null, ...(hours.closedUntil ? { reopenOn: hours.closedUntil } : {}) };
  let best: OpenState | null = null;
  for (const week of weeks) {
    const st = dayStatus(week[weekday], minutes, week[(weekday + 6) % 7]);
    if (st === "open") return { open: true };
    const why = st === "before" ? "off" : st;
    let next: { dayOffset: number; weekday: number; time: string } | null = null;
    if (st === "before") next = { dayOffset: 0, weekday, time: week[weekday]!.from };
    else if (st === "break") next = { dayOffset: 0, weekday, time: week[weekday]!.bTo };
    else for (let o = 1; o <= 7 && !next; o++) { const w = (weekday + o) % 7; if (week[w]?.open) next = { dayOffset: o, weekday: w, time: week[w]!.from }; }
    if (!best || (next && (!(best as { next: unknown }).next || next.dayOffset < (best as { next: { dayOffset: number } }).next!.dayOffset))) best = { open: false, why, week, next };
  }
  return best ?? { open: true };
}

const WEEKDAY = { en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], ar: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"] };
const SHORT = { en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], ar: WEEKDAY.ar };
function clock(t: string, lang: "en" | "ar") {
  const [h, m] = t.split(":").map(Number), pm = h! >= 12, h12 = h! % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${lang === "ar" ? (pm ? "م" : "ص") : pm ? "PM" : "AM"}`;
}
/** The week as short lines: days with the same hours are grouped, e.g. "Mon–Thu 12:00 PM – 11:30 PM" and "Fri closed". */
export function hoursLines(week: Day[], lang: "en" | "ar") {
  const label = (d: Day) => d.open ? `${clock(d.from, lang)} – ${clock(d.to, lang)}` : lang === "ar" ? "مغلق" : "closed";
  const lines: string[] = [];
  for (let i = 0; i < 7;) {
    let j = i; while (j + 1 < 7 && label(week[j + 1]!) === label(week[i]!)) j++;
    lines.push(`${i === j ? SHORT[lang][i] : `${SHORT[lang][i]}–${SHORT[lang][j]}`}: ${label(week[i]!)}`); i = j + 1;
  }
  return lines;
}
/** What the customer is told when they try to order while the restaurant is closed. */
export function closedText(state: Extract<OpenState, { open: false }>, lang: "en" | "ar", restaurant: string) {
  const when = (n: NonNullable<typeof state.next>) => lang === "ar"
    ? `${n.dayOffset === 0 ? "اليوم" : n.dayOffset === 1 ? "غداً" : `يوم ${WEEKDAY.ar[n.weekday]}`} الساعة ${clock(n.time, "ar")}`
    : `${n.dayOffset === 0 ? "today" : n.dayOffset === 1 ? "tomorrow" : WEEKDAY.en[n.weekday]} at ${clock(n.time, "en")}`;
  const lines = hoursLines(state.week, lang).join("\n");
  if (lang === "ar") {
    const head = state.why === "break" ? `عذراً، ${restaurant} في استراحة قصيرة الآن ولا نستقبل الطلبات حالياً.` : state.why === "last" ? `عذراً، انتهى وقت استقبال الطلبات اليوم في ${restaurant}.` : `عذراً، ${restaurant} مغلق الآن ولا نستقبل الطلبات حالياً.`;
    const open = state.reopenOn ? `سنعود في ${state.reopenOn}.` : state.next ? `نفتح ${when(state.next)}.` : "";
    return `${head}\n\n🕒 ساعات العمل:\n${lines}\n\n${open}\nيسعدنا استقبال طلبك وقتها 🙏`;
  }
  const head = state.why === "break" ? `Sorry, ${restaurant} is on a short break and isn't taking orders right now.` : state.why === "last" ? `Sorry, ${restaurant} has stopped taking orders for today.` : `Sorry, ${restaurant} is closed right now and isn't taking orders.`;
  const open = state.reopenOn ? `We reopen on ${state.reopenOn}.` : state.next ? `We open ${when(state.next)}.` : "";
  return `${head}\n\n🕒 Working hours:\n${lines}\n\n${open} We'd be happy to take your order then 🙏`;
}
/** The restaurant's hours: what Settings > Hours saved, otherwise the first branch's weekly rows (0 = Sunday), otherwise none. */
export function hoursFrom(saved: Hours | null | undefined, rows: { dayOfWeek: number; isClosed: boolean; openTime: string; closeTime: string }[]): Hours | null {
  if (saved) return saved;
  if (!rows.length) return null;
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const week: Day[] = names.map((d, i) => { const r = rows.find(x => x.dayOfWeek === (i + 1) % 7); return { day: d, open: !!r && !r.isClosed, from: r?.openTime ?? "12:00", to: r?.closeTime ?? "23:30", last: r?.closeTime ?? "23:30", brk: false, bFrom: "16:00", bTo: "17:00" }; });
  return { mode: "custom", scope: "same", sel: "", every: { ...week[0]!, day: "Every day" }, closedUntil: "", same: week, per: {} };
}
/** What the assistant is told about the hours, so it can answer "when do you open?" and never invites an order while the restaurant is closed. */
export function hoursForAi(hours: Hours | null, branchId: string | null, state: OpenState): string {
  if (!hours) return "";
  const week = state.open ? weeksOf(hours, branchId)[0]! : state.week, lines = hoursLines(week, "en").join("; ");
  if (state.open) return `Working hours (restaurant's local time): ${lines}. The restaurant is open now and taking orders. Use these hours when a customer asks when you open or close.`;
  const when = state.reopenOn ? ` It reopens on ${state.reopenOn}.` : state.next ? ` It opens ${state.next.dayOffset === 0 ? "today" : state.next.dayOffset === 1 ? "tomorrow" : `on ${WEEKDAY.en[state.next.weekday]}`} at ${clock(state.next.time, "en")}.` : "";
  return `IMPORTANT: The restaurant is CLOSED right now and is not taking orders.${when} Working hours: ${lines}. Do not start or take an order and do not ask what the customer would like to order. Answer their questions politely and tell them when the restaurant opens.`;
}
