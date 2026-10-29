"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Billing inside the dashboard: plan and renewal, the card on file, upgrades, cancellation and invoices.
// The subscription is Lumia's; Stripe only takes the payments, so every action here talks to Lumia's own API.
// Plans only go up: a bigger plan starts now, a longer cycle starts at the renewal, and a smaller plan means cancelling and subscribing again.
import React from "react";
import { ContentLoader } from "@/components/lumia-loader";
import { mountEmbeddedCheckout, type EmbeddedForm } from "@/lib/stripe-embed";
import { formatMoneyUi, moneyUi } from "@/modules/market/money";

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? json.message ?? "Something went wrong. Please try again.");
  return json.data ?? json;
}
const fmtDate = (ar: boolean) => (iso?: string) => (iso ? new Date(iso).toLocaleDateString(ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
const num = (n: number) => n.toLocaleString("en-US");
const INK = "#1A0815", MUTED = "#8A5A6E", LINE = "#F0E4E8", WASH = "#FFF7FA";
const card: React.CSSProperties = { border: `1px solid ${LINE}`, borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0, background: "#fff" };
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 };
const muted: React.CSSProperties = { fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5 };
const pill = (bg: string, fg: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: bg, color: fg, whiteSpace: "nowrap" });
const row: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
// Buttons are classes so they get hover and keyboard focus; the fill is a shade deeper than the brand gradient so white text reads at 4.5:1.
const CSS = `
.bl button,.bl a{font-family:inherit}
.bl .b{min-height:44px;padding:0 18px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:background-color .15s,border-color .15s,filter .15s}
.bl .b-out{border:1.5px solid #ECD9E0;background:#fff;color:${INK};font-weight:500}
.bl .b-out:hover:not(:disabled){background:${WASH};border-color:#E2BCCB}
.bl .b-fill{border:0;background:linear-gradient(90deg,#D92B55,#B02BE0);color:#fff}
.bl .b-fill:hover:not(:disabled){filter:brightness(1.08)}
.bl .b-danger{border:0;background:#B42318;color:#fff}
.bl .b-danger:hover:not(:disabled){filter:brightness(1.1)}
.bl .b:disabled{opacity:.5;cursor:not-allowed}
.bl .lk{min-height:44px;padding:0 4px;border:0;background:none;font-size:14px;font-weight:600;color:#C0284F;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.bl .lk:disabled{opacity:.5;cursor:not-allowed}
.bl .lk.quiet{color:${MUTED};font-weight:500}
.bl button:focus-visible,.bl a:focus-visible{outline:2px solid #A62BD9;outline-offset:2px}
.bl ::selection{background:#FFD3E1}
.bl .nums{font-variant-numeric:tabular-nums}
.bl .opt{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 24px;padding:18px 0;border-top:1px solid ${LINE}}
.bl .opt:first-of-type{border-top:0;padding-top:4px}
@media (max-width:640px){.bl .opt{grid-template-columns:1fr}.bl .card{padding:18px 16px}}
`;

type Ask = { where: string; title: string; rows: [string, string][]; note?: string; confirm: string; danger?: boolean; go: () => void };

export function BillingPage({ businessId, onChoosePlan, onChanged, focus, ar = false }: { businessId: string; onChoosePlan: () => void; onChanged: () => void; focus?: string; ar?: boolean }) {
  const t = (en: string, a: string) => (ar ? a : en), date = fmtDate(ar);
  const base = `/api/v1/businesses/${businessId}/subscription`;
  const [sub, setSub] = React.useState<any>(null), [invoices, setInvoices] = React.useState<any[]>([]), [error, setError] = React.useState(""), [busy, setBusy] = React.useState(""), [note, setNote] = React.useState("");
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("monthly"), [quotes, setQuotes] = React.useState<Record<string, any>>({}), [cardForm, setCardForm] = React.useState<null | { secret: string; key: string; id: string }>(null), [ask, setAsk] = React.useState<Ask | null>(null), [cards, setCards] = React.useState<any[] | null>(null);
  const slot = React.useRef<HTMLDivElement>(null), form = React.useRef<EmbeddedForm | null>(null), alertRef = React.useRef<HTMLDivElement>(null), askRef = React.useRef<HTMLButtonElement>(null);
  const load = React.useCallback(async () => { try { const [s, i] = await Promise.all([api(base), api(`${base}/invoices`)]); setSub(s); setInvoices(i); if (s.hasCustomer) api(`${base}/cards`, "POST").then(r => setCards(r.cards)).catch(() => setCards([])); else setCards([]); setCycle(c => (s.billing === "yearly" ? "yearly" : c)); } catch (e: any) { setError(e.message); } }, [base]);
  React.useEffect(() => { load(); }, [load]);
  // What each bigger plan would cost today, under the cycle being looked at (a yearly owner can only see yearly).
  const target: "monthly" | "yearly" = sub?.billing === "yearly" ? "yearly" : cycle;
  React.useEffect(() => { if (!sub || !sub.plan || !sub.catalog || sub.status === "NONE") return; let live = true; Promise.all(sub.catalog.filter((p: any) => p.rank >= (sub.catalog.find((c: any) => c.id === sub.plan)?.rank ?? 1)).map((p: any) => api(`${base}/quote`, "POST", { plan: p.id, billing: target }).then(q => [p.id, q] as const).catch(() => [p.id, null] as const))).then((r: any) => { if (live) setQuotes(Object.fromEntries(r)); }); return () => { live = false; }; }, [sub, target, base]);
  React.useEffect(() => {
    if (!cardForm || !slot.current) return; let gone = false;
    mountEmbeddedCheckout(slot.current, cardForm.secret, cardForm.key, async () => { form.current?.destroy(); form.current = null; setCardForm(null); try { await api(`${base}/confirm`, "POST", { sessionId: cardForm.id }); setNote(t("Your card was updated.", "تم تحديث بطاقتك.")); await load(); onChanged(); } catch (e: any) { setError(e.message); } })
      .then(f => { if (gone) f.destroy(); else form.current = f; }).catch(e => setError(e.message));
    return () => { gone = true; form.current?.destroy(); form.current = null; };
  }, [cardForm, base, load, onChanged]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (error) alertRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [error]);
  React.useEffect(() => { if (ask) askRef.current?.focus(); }, [ask]);

  const run = async (key: string, fn: () => Promise<any>, done: string) => { setBusy(key); setError(""); setNote(""); try { await fn(); setNote(done); setAsk(null); await load(); onChanged(); } catch (e: any) { setError(e.message); setAsk(null); } setBusy(""); };
  if (!sub && !error) return <ContentLoader />;
  if (!sub) return <div role="alert" style={{ color: "#B42318", fontSize: 15 }}>{error}</div>;
  // Amounts are shown in the restaurant's own currency (dirham sign, riyal sign, or the code); invoices keep the currency they were issued in.
  const cur0 = sub.prices?.currency ?? "AED", money = (minor: number, c: string = cur0) => formatMoneyUi(minor, c), vatTag = sub.tax?.ratePercent > 0 ? " + VAT" : "";
  const active = sub.status === "ACTIVE" || sub.status === "PAST_DUE", pastDue = sub.status === "PAST_DUE", canManage = sub.canManage, catalog: any[] = sub.catalog ?? [];
  const mine = catalog.find(p => p.id === sub.plan), planName = mine?.name ?? "", ending = !!sub.cancelAtPeriodEnd;
  const status = pastDue ? [t("Payment failed", "فشل الدفع"), "#FFF1DC", "#8A4B00"] : sub.status === "ENDED" ? [t("Lapsed", "انتهت"), "#FDECEC", "#B42318"] : sub.status === "CANCELED" ? [t("Cancelled", "ملغاة"), "#F6EEF2", "#3D1C31"] : ending ? [t("Ends ", "تنتهي في ") + date(sub.currentPeriodEnd), "#F6EEF2", "#3D1C31"] : active ? [t("Active", "نشطة"), "#E6F4EC", "#16704A"] : [t("Free trial", "تجربة مجانية"), "#FDEAF2", "#8A2040"];
  const taxFirst = focus === "tax", noPlan = !active && sub.status === "NONE", ended = sub.status === "ENDED" || sub.status === "CANCELED";
  const taxNode = <div id="billing-tax"><TaxDetails ar={ar} businessId={businessId} canManage={!!canManage} onSaved={() => { load(); onChanged(); }} /></div>;
  const trialLeft = sub.trial?.daysLeft ?? 0, trialOn = noPlan && sub.trial?.started !== false && trialLeft > 0;
  const includes = (p: any) => p ? (ar ? `${num(p.orders)} طلب شهرياً · ${p.branches} ${p.branches === 1 ? "فرع" : "فروع"}${p.extraBranches ? " (يمكن إضافة المزيد)" : ""} · ${p.staff} ${p.staff === 1 ? "حساب موظف" : "حسابات موظفين"}` : `${num(p.orders)} orders a month · ${p.branches} ${p.branches === 1 ? "branch" : "branches"}${p.extraBranches ? " (more can be added)" : ""} · ${p.staff} staff ${p.staff === 1 ? "account" : "accounts"}`) : "";

  // Why a payment button is switched off, said next to the button instead of leaving it grey and silent.
  const blocked = pastDue ? t("Update your card to pay the overdue renewal first.", "حدّث بطاقتك لدفع التجديد المتأخر أولاً.") : ending ? t("Your plan is set to end. Choose “Keep my plan” first.", "باقتك ستنتهي. اختر «الإبقاء على باقتي» أولاً.") : !sub.card ? t("Add a card first.", "أضف بطاقة أولاً.") : "";
  const sheet = (where: string) => ask?.where === where && <div role="group" aria-label={ask.title} style={{ border: `1.5px solid ${ask.danger ? "#F0B8B2" : "#E6C3D0"}`, background: ask.danger ? "#FFF8F7" : WASH, borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, width: "fit-content", minWidth: "min(100%, 340px)", maxWidth: "100%", boxSizing: "border-box" }}>
    <b style={{ fontSize: 15 }}>{ask.title}</b>
    <dl style={{ margin: 0, fontSize: 14 }}>{ask.rows.map(([k, v], i) => <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24, padding: "9px 0", borderTop: i ? `1px solid ${ask.danger ? "#F3D9D5" : "#F1DDE5"}` : 0 }}><dt style={{ color: MUTED }}>{k}</dt><dd className="nums" style={{ margin: 0, fontWeight: 600, textAlign: "end" }}>{v}</dd></div>)}</dl>
    {ask.note && <p style={{ ...muted, maxWidth: 440 }}>{ask.note}</p>}
    <div style={row}>
      <button ref={askRef} type="button" className={`b ${ask.danger ? "b-danger" : "b-fill"}`} disabled={!!busy} onClick={ask.go}>{busy ? t("Working…", "جارٍ التنفيذ…") : ask.confirm}</button>
      <button type="button" className="b b-out" disabled={!!busy} onClick={() => setAsk(null)} onKeyDown={e => { if (e.key === "Escape") setAsk(null); }}>{t("Not now", "ليس الآن")}</button>
      {!ask.danger && sub.card && <button type="button" className="lk quiet" disabled={!!busy} onClick={openCard}>{t("Pay with a different card", "الدفع ببطاقة أخرى")}</button>}
    </div></div>;
  const openCard = () => { setAsk(null); run("card", async () => { const r = await api(`${base}/card`, "POST"); if (r.clientSecret) setCardForm({ secret: r.clientSecret, key: r.publishableKey, id: r.sessionId }); else window.location.assign(r.url); }, ""); };
  const reason = (show: boolean) => show && blocked ? <p style={muted}>{blocked}</p> : null;

  const askCancel = () => setAsk({ where: "cancel", title: t("Cancel your plan?", "إلغاء باقتك؟"), rows: [[t("Stays active until", "تبقى فعّالة حتى"), date(sub.currentPeriodEnd)], [t("Charged after that", "المبلغ بعد ذلك"), t("Nothing", "لا شيء")]], note: t("Your restaurant keeps working until then. You can keep the plan again before that date, or subscribe to any plan afterwards.", "يستمر مطعمك بالعمل حتى ذلك التاريخ. يمكنك الإبقاء على الباقة قبله، أو الاشتراك في أي باقة بعده."), confirm: t("Cancel plan", "إلغاء الباقة"), danger: true, go: () => run("cancel", () => api(`${base}/cancel`, "POST"), t("Your plan will end at the end of this period.", "ستنتهي باقتك في نهاية هذه الفترة.")) });
  const cardName = (c: any) => `${c.wallet === "apple_pay" ? "Apple Pay · " : c.wallet === "google_pay" ? "Google Pay · " : ""}${c.brand ? c.brand.charAt(0).toUpperCase() + c.brand.slice(1) : t("Card", "بطاقة")} •••• ${c.last4}`;
  const askRemoveCard = (c: any) => setAsk({ where: "cards", title: t("Remove this card?", "إزالة هذه البطاقة؟"), rows: [[t("Card", "البطاقة"), cardName(c)]], note: c.isDefault ? t("Your plan is set to end, so nothing more will be charged. To keep your plan later, add a card again first.", "باقتك ستنتهي، فلن يُخصم شيء آخر. للإبقاء على باقتك لاحقاً، أضف بطاقة من جديد أولاً.") : t("This card is not used for your renewals.", "هذه البطاقة غير مستخدمة في تجديداتك."), confirm: t("Remove card", "إزالة البطاقة"), danger: true, go: () => run("card-remove", () => api(`${base}/remove-card`, "POST", { paymentMethodId: c.id }), t("Card removed.", "تمت إزالة البطاقة.")) });
  const askMakeMain = (c: any) => setAsk({ where: "cards", title: t("Use this card for renewals?", "استخدام هذه البطاقة للتجديدات؟"), rows: [[t("Card", "البطاقة"), cardName(c)]], note: pastDue ? t("Your overdue renewal will be tried on this card right away.", "سيتم تجربة التجديد المتأخر على هذه البطاقة فوراً.") : t("Your next renewal and any extras are charged to this card.", "ستُخصم عليها تجديداتك القادمة وأي إضافات."), confirm: t("Use this card", "استخدام هذه البطاقة"), go: () => run("card-main", () => api(`${base}/default-card`, "POST", { paymentMethodId: c.id }), t("This card now pays your renewals.", "هذه البطاقة تدفع تجديداتك الآن.")) });
  const askTopUp = (pk: any) => setAsk({ where: "usage", title: ar ? `شراء ${num(pk.orders)} طلب إضافي` : `Buy ${num(pk.orders)} extra orders`, rows: [[t("Charged now", "المبلغ الآن"), money(pk.totalMinor) + (vatTag ? t(" (incl. VAT)", " (شامل الضريبة)") : "")], [t("Card", "البطاقة"), `${sub.card?.brand ?? t("Card", "بطاقة")} •••• ${sub.card?.last4 ?? ""}`], [t("Expire", "الصلاحية"), t("Never", "لا تنتهي")]], note: t("They are used after this month’s orders run out.", "تُستخدم بعد نفاد طلبات هذا الشهر."), confirm: t(`Pay ${money(pk.totalMinor)}`, `ادفع ${money(pk.totalMinor)}`), go: () => run("topup", () => api(`${base}/topup`, "POST", { pack: pk.id, requestId: crypto.randomUUID() }), ar ? `تمت إضافة ${num(pk.orders)} طلب.` : `${num(pk.orders)} orders added.`) });
  const per = sub.billing === "yearly" ? t("year", "سنة") : t("month", "شهر"), b = sub.branches ?? {};
  const askBranch = () => setAsk({ where: "branches", title: t("Add a branch", "إضافة فرع"), rows: [[t("Pay now", "ادفع الآن"), `${money(b.payNowMinor ?? 0)}${vatTag ? t(" (incl. VAT)", " (شامل الضريبة)") : ""}`], [t("Covers", "تغطي"), ar ? `باقي هذه الفترة، حتى ${date(sub.currentPeriodEnd)}` : `Rest of this period, to ${date(sub.currentPeriodEnd)}`], [t("From renewal", "من التجديد"), ar ? `${money(b.priceMinor ?? 0)}${vatTag} لكل ${per}` : `${money(b.priceMinor ?? 0)}${vatTag} per ${per}`], [t("Adds", "يضيف"), ar ? `${b.ordersPerBranch} طلب شهرياً` : `${b.ordersPerBranch} orders a month`]], note: t("Taking a branch off later happens at renewal, and nothing is refunded for the current period.", "إزالة الفرع لاحقاً تتم عند التجديد، ولا يُسترد شيء عن الفترة الحالية."), confirm: t(`Pay ${money(b.payNowMinor ?? 0)}`, `ادفع ${money(b.payNowMinor ?? 0)}`), go: () => run("branch", () => api(`${base}/branch`, "POST", { requestId: crypto.randomUUID() }), t("Branch added. You can set it up in Settings.", "تمت إضافة الفرع. يمكنك إعداده من الإعدادات.")) });
  const askRemoveBranch = () => { const left = (b.pendingExtra ?? b.extra) - 1; setAsk({ where: "branches", title: t("Remove one extra branch", "إزالة فرع إضافي واحد"), rows: [[t("Takes effect", "يسري في"), date(sub.currentPeriodEnd)], [t("Extra branches after", "الفروع الإضافية بعد ذلك"), String(left)]], note: t("You keep it until then and nothing is refunded for this period. Switch the branch off in Settings first if it is active.", "تحتفظ به حتى ذلك الحين ولا يُسترد شيء عن هذه الفترة. أوقف الفرع من الإعدادات أولاً إن كان فعّالاً."), confirm: t("Remove at renewal", "إزالة عند التجديد"), go: () => run("branches", () => api(`${base}/branches`, "POST", { extra: left }), t("One fewer extra branch from your next renewal.", "فرع إضافي أقل ابتداءً من تجديدك القادم.")) }); };
  const askUpgrade = (p: any, q: any) => setAsk({ where: "plan", title: t(`Upgrade to ${p.name}`, `الترقية إلى ${p.name}`), rows: [[t("Pay now", "ادفع الآن"), `${money(q.totalMinor)}${vatTag ? t(" (incl. VAT)", " (شامل الضريبة)") : ""}`], [t("Covers", "تغطي"), ar ? `باقي هذه الفترة، حتى ${date(sub.currentPeriodEnd)}` : `Rest of this period, to ${date(sub.currentPeriodEnd)}`], [t(`From ${date(q.renewsAt)}`, `من ${date(q.renewsAt)}`), ar ? `${money(q.renewalMinor)} لكل ${target === "yearly" ? "سنة" : "شهر"}` : `${money(q.renewalMinor)} per ${target === "yearly" ? "year" : "month"}`]], note: q.cycleChange ? t(`${p.name} starts now. Yearly billing starts at your next renewal.`, `تبدأ ${p.name} الآن. تبدأ الفوترة السنوية عند تجديدك القادم.`) : t(`${p.name} starts as soon as the payment goes through.`, `تبدأ ${p.name} فور نجاح الدفع.`), confirm: q.totalMinor ? t(`Pay ${money(q.totalMinor)} and upgrade`, `ادفع ${money(q.totalMinor)} وقم بالترقية`) : t("Upgrade now", "رقِّ الآن"), go: () => run("plan", () => api(`${base}/change`, "POST", { plan: p.id, billing: target }), t(`You’re on ${p.name} now.`, `أنت الآن على ${p.name}.`)) });
  const askYearly = (q: any) => setAsk({ where: "plan", title: t("Switch to yearly billing", "التحويل إلى الفوترة السنوية"), rows: [[t("Pay now", "ادفع الآن"), t("Nothing", "لا شيء")], [t(`From ${date(q.effectiveAt)}`, `من ${date(q.effectiveAt)}`), ar ? `${money(q.renewalMinor)} لكل سنة` : `${money(q.renewalMinor)} per year`]], note: t("Your plan and limits stay the same. You can undo this before the renewal.", "تبقى باقتك وحدودها كما هي. يمكنك التراجع قبل التجديد."), confirm: t("Switch at renewal", "التحويل عند التجديد"), go: () => run("plan", () => api(`${base}/change`, "POST", { plan: sub.plan, billing: "yearly" }), t(`Yearly billing starts ${date(sub.currentPeriodEnd)}.`, `تبدأ الفوترة السنوية في ${date(sub.currentPeriodEnd)}.`)) });

  const plan = (id: string) => sub.prices?.plans?.[id];
  const monthEq = (id: string, c: "monthly" | "yearly") => { const p = plan(id); return p ? (c === "yearly" ? p.yearly / 12 : p.monthly) : null; };
  const saving = mine && plan(mine.id) ? Math.round((1 - plan(mine.id).yearly / (plan(mine.id).monthly * 12)) * 100) : 0;
  const higher = catalog.filter(p => p.rank > (mine?.rank ?? 0));

  return <div className="bl" data-screen-label="10 Billing" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
    <style>{CSS}</style>
    <div><h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: ar ? 0 : "-0.035em", margin: 0 }}>{t("Billing", "الفوترة")}</h1><p style={{ ...muted, marginTop: 6 }}>{t("Your plan, orders, payment card and invoices.", "باقتك وطلباتك وبطاقة الدفع والفواتير.")}</p></div>
    <div ref={alertRef} style={{ display: error || note ? "flex" : "none", flexDirection: "column", gap: 8 }}>
      {error && <div role="alert" style={{ fontSize: 14, color: "#B42318", padding: "10px 14px", borderRadius: 12, background: "#FDECEC" }}>{error}</div>}
      {note && <div role="status" style={{ fontSize: 14, color: "#16704A", fontWeight: 500, padding: "10px 14px", borderRadius: 12, background: "#E6F4EC" }}>{note}</div>}
    </div>
    {taxFirst && taxNode}

    <section className="card" style={{ ...card, gap: 16, padding: "22px 24px", background: `linear-gradient(180deg,${WASH},#fff 70%)`, borderColor: "#F6D9E3" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", margin: 0 }}>{noPlan ? (trialOn ? t("Free trial", "تجربة مجانية") : sub.trial?.started === false ? t("Free trial not started", "التجربة المجانية لم تبدأ") : t("Free trial ended", "انتهت التجربة المجانية")) : ended ? t("No active plan", "لا توجد باقة فعّالة") : planName}</h2>
            <span style={pill(status[1]!, status[2]!)}>{trialOn ? (ar ? `بقي ${trialLeft} ${trialLeft === 1 ? "يوم" : "أيام"}` : `${trialLeft} ${trialLeft === 1 ? "day" : "days"} left`) : status[0]}</span>
          </div>
          {active && <p style={muted}>{includes(mine)}{sub.billing === "yearly" ? t(" · billed yearly", " · فوترة سنوية") : t(" · billed monthly", " · فوترة شهرية")}</p>}
          {trialOn && <div role="progressbar" aria-label={t("Free trial days left", "أيام التجربة المجانية المتبقية")} aria-valuemin={0} aria-valuemax={14} aria-valuenow={trialLeft} style={{ height: 6, width: 220, maxWidth: "100%", borderRadius: 999, background: "#F6EEF2", overflow: "hidden" }}><div style={{ width: `${Math.min(100, Math.round(trialLeft / 14 * 100))}%`, height: "100%", background: "linear-gradient(90deg,#FF5577,#C93DFF)" }} /></div>}
        </div>
        {(noPlan || ended) && canManage && <button type="button" className="b b-fill" onClick={onChoosePlan}>{t("Choose a plan", "اختر باقة")}</button>}
      </div>
      {noPlan && <p style={muted}>{sub.trial?.started === false ? t("Your free trial starts once your VAT registration is verified.", "تبدأ تجربتك المجانية بعد التحقق من تسجيلك في ضريبة القيمة المضافة.") : trialOn ? t(`Your free trial ends on ${date(sub.trial.endsAt)}.`, `تنتهي تجربتك المجانية في ${date(sub.trial.endsAt)}.`) : t("Your free trial has ended and WhatsApp ordering is paused.", "انتهت تجربتك المجانية وتوقف الطلب عبر واتساب.")} {t("Choose a plan to keep receiving WhatsApp orders.", "اختر باقة لتواصل استقبال طلبات واتساب.")}</p>}
      {ended && <p style={muted}>{sub.status === "ENDED" ? t("Your last renewal could not be paid, so the plan lapsed.", "تعذّر دفع آخر تجديد فانتهت الباقة.") : t("Your plan was cancelled.", "تم إلغاء باقتك.")} {t("Choose a plan to switch everything back on. Your menu and settings are kept.", "اختر باقة لإعادة تشغيل كل شيء. قائمتك وإعداداتك محفوظة.")}</p>}
      {active && <>
        {pastDue && <div role="alert" style={{ padding: "14px 16px", borderRadius: 12, background: "#FFF1DC", color: "#6B3A00", fontSize: 14, lineHeight: 1.5, display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 320px" }}>{sub.needsAuthentication ? t("Your bank needs you to confirm the renewal payment. Choose “Update card” and enter your card again so the bank can confirm it.", "يحتاج بنكك إلى تأكيدك لدفعة التجديد. اختر «تحديث البطاقة» وأدخل بطاقتك من جديد ليؤكدها البنك.") : <>{t("The last payment didn’t go through", "لم تتم آخر دفعة")}{sub.lastFailure && !ar ? ` (${String(sub.lastFailure).replace(/\.$/, "")})` : ""}.</>} {t("Everything keeps working while we try again.", "يستمر كل شيء بالعمل بينما نعيد المحاولة.")}{sub.access?.graceEndsAt ? t(` Update your card before ${date(sub.access.graceEndsAt)} or the plan will end.`, ` حدّث بطاقتك قبل ${date(sub.access.graceEndsAt)} وإلا ستنتهي الباقة.`) : t(" Update your card to fix it now.", " حدّث بطاقتك لحل المشكلة الآن.")}</span>
          {canManage && !cardForm && <button type="button" className="b b-fill" disabled={!!busy} onClick={openCard}>{t("Update card", "تحديث البطاقة")}</button>}
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 24, paddingTop: 4 }}>
          <div><p style={muted}>{ending ? t("Plan ends", "تنتهي الباقة") : t("Next payment", "الدفعة القادمة")}</p>
            <p className="nums" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: "2px 0 0" }}>{ending ? date(sub.currentPeriodEnd) : sub.nextCharge ? money(sub.nextCharge.amountMinor) : "—"}</p>
            {!ending && sub.nextCharge && <p style={muted}>{t("on ", "في ")}{date(sub.nextCharge.at)}{sub.pendingBilling === "yearly" ? t(", billed yearly from then", "، وفوترة سنوية بعد ذلك") : ""}</p>}</div>
          <div><p style={muted}>{t("Current period", "الفترة الحالية")}</p><p className="nums" style={{ fontSize: 16, fontWeight: 600, margin: "4px 0 0" }}>{date(sub.currentPeriodStart)}</p><p style={muted}>{t("to ", "إلى ")}{date(sub.currentPeriodEnd)}</p></div>
          <div><p style={muted}>{t("Payment card", "بطاقة الدفع")}</p>
            {sub.card ? <><p className="nums" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: "2px 0 0" }}><span style={{ textTransform: "capitalize" }}>{sub.card.brand}</span> •••• {sub.card.last4}</p><p style={muted}>{t("expires ", "تنتهي ")}{String(sub.card.expMonth).padStart(2, "0")}/{String(sub.card.expYear).slice(-2)}</p></> : <p style={{ ...muted, margin: "6px 0 0" }}>{t("No card on file", "لا توجد بطاقة محفوظة")}</p>}
            {canManage && !cardForm && <div style={{ ...row, gap: 4, marginTop: 4 }}>
              <button type="button" className="b b-out" style={{ minHeight: 40 }} disabled={!!busy} onClick={openCard}>{sub.card ? t("Change card", "تغيير البطاقة") : t("Add card", "إضافة بطاقة")}</button>
            </div>}</div>
        </div>
        {cardForm && <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", overflowY: "auto", padding: 16, background: "rgba(26,8,21,.5)", backdropFilter: "blur(3px)" }} onMouseDown={e => { if (e.target === e.currentTarget) setCardForm(null); }} onKeyDown={e => { if (e.key === "Escape") setCardForm(null); }}>
          <div role="dialog" aria-modal="true" aria-label={t("Update payment method", "تحديث طريقة الدفع")} style={{ width: "100%", maxWidth: 520, margin: "auto", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(26,8,21,.5)" }}>
            <div style={{ ...row, justifyContent: "space-between", flexWrap: "nowrap", padding: "14px 22px 10px", borderBottom: `1px solid ${LINE}` }}>
              <h2 style={{ ...h2, margin: 0 }}>{t("Update payment method", "تحديث طريقة الدفع")}</h2>
              <button type="button" aria-label={t("Close", "إغلاق")} onClick={() => setCardForm(null)} style={{ width: 44, height: 44, border: 0, background: "none", borderRadius: 12, fontSize: 22, lineHeight: 1, color: MUTED, cursor: "pointer", flex: "none" }}>×</button>
            </div>
            <div style={{ padding: "14px 22px 4px" }}><div ref={slot} /></div>
            <div style={{ padding: "6px 22px 16px", display: "flex", justifyContent: "flex-end" }}><button type="button" className="b b-out" onClick={() => setCardForm(null)}>{t("Cancel", "إلغاء")}</button></div>
          </div>
        </div>}
        {sub.pendingBilling && !ending && <p style={muted}>{t("Yearly billing starts on ", "تبدأ الفوترة السنوية في ")}<b>{date(sub.currentPeriodEnd)}</b>. <button type="button" className="lk" disabled={!!busy} onClick={() => run("plan", () => api(`${base}/change`, "POST", { plan: sub.plan, billing: sub.billing }), t("The scheduled change was cancelled.", "تم إلغاء التغيير المجدول."))}>{t("Undo", "تراجع")}</button></p>}
        {canManage && <div style={{ borderTop: "1px solid #F3EEF1", paddingTop: 8, ...row }}>
          {ending ? <><p style={{ ...muted, flex: "1 1 260px" }}>{t(`Your plan is set to end on ${date(sub.currentPeriodEnd)}.`, `ستنتهي باقتك في ${date(sub.currentPeriodEnd)}.`)}</p><button type="button" className="b b-out" disabled={!!busy} onClick={() => run("resume", () => api(`${base}/resume`, "POST"), t("Your plan will keep renewing.", "ستتجدد باقتك تلقائياً."))}>{t("Keep my plan", "الإبقاء على باقتي")}</button></>
            : <button type="button" className="lk quiet" disabled={!!busy} onClick={askCancel}>{t("Cancel plan", "إلغاء الباقة")}</button>}
        </div>}
        {sheet("cancel")}
      </>}
    </section>

    {cards && cards.length > 0 && <section className="card" style={card} aria-label={t("Your cards", "بطاقاتك")}>
      <div style={{ ...row, justifyContent: "space-between" }}><h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t("Your cards", "بطاقاتك")}</h2>{canManage && !cardForm && <button type="button" className="b b-out" style={{ minHeight: 40 }} disabled={!!busy} onClick={openCard}>{t("Add a card", "إضافة بطاقة")}</button>}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{cards.map((c: any, k: number) => <li key={c.id} style={{ ...row, padding: "12px 0", borderTop: k ? `1px solid ${LINE}` : 0, justifyContent: "space-between" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b className="nums" style={{ fontSize: 15 }}>{cardName(c)}</b><span style={muted}>{t("expires ", "تنتهي ")}{String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}{c.isDefault && <> · <b style={{ color: INK }}>{t("pays your renewals", "تدفع تجديداتك")}</b></>}</span></span>
        {canManage && <span style={{ ...row, gap: 4 }}>
          {!c.isDefault && sub.status !== "NONE" && <button type="button" className="lk" disabled={!!busy} onClick={() => askMakeMain(c)}>{t("Use for renewals", "استخدمها للتجديد")}</button>}
          {(!c.isDefault || !active || ending) && <button type="button" className="lk quiet" disabled={!!busy} onClick={() => askRemoveCard(c)}>{t("Remove", "إزالة")}</button>}
        </span>}
      </li>)}</ul>
      <p style={{ ...muted, fontSize: 13 }}>{t("Apple Pay and Google Pay appear here as cards once you pay with them.", "تظهر Apple Pay وGoogle Pay هنا كبطاقات بعد الدفع بهما.")}</p>
      {sheet("cards")}
    </section>}

    {sub.usage && (() => { const u = sub.usage, o = u.orders, left = Math.max(0, o.limit - o.used) + u.credits, over = o.used >= o.limit && u.credits === 0, warm = o.limit > 0 && o.used / o.limit >= 0.8;
      // Voice notes, menu imports and the AI-reply pool are fair-use limits behind the order limit: they only show when one is nearly used up.
      const fair = ([[t("Voice notes", "الرسائل الصوتية"), u.voice], [t("AI menu imports", "استيراد القائمة بالذكاء الاصطناعي"), u.imports], [t("AI replies", "ردود الذكاء الاصطناعي"), u.aiReplies]] as [string, { used: number; limit: number }][]).filter(([, x]) => x.limit && x.used / x.limit >= 0.8);
      const bar = (label: string, used: number, limit: number, hot: boolean, amber: boolean) => <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{label}</span><b className="nums" dir="ltr">{num(used)} / {num(limit)}</b></div>
        <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} style={{ height: 10, borderRadius: 999, background: "#F6EEF2", overflow: "hidden" }}><div style={{ width: `${limit ? Math.min(100, Math.round(used / limit * 100)) : 100}%`, height: "100%", borderRadius: 999, background: hot ? "#B42318" : amber ? "#E8A100" : "linear-gradient(90deg,#FF5577,#C93DFF)" }} /></div>
      </div>;
      const alertBox = (text: string, role: string, key?: string) => <div key={key} role={role} style={{ padding: "12px 14px", borderRadius: 12, background: "#FFF1DC", color: "#6B3A00", fontSize: 14, lineHeight: 1.5 }}>{text}</div>;
      return <section className="card" style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h2 style={h2}>{t("Orders this month", "طلبات هذا الشهر")}</h2><span style={muted}>{t("Resets ", "يُعاد الضبط في ")}{date(u.periodEnd)}</span></div>
        {bar(t("WhatsApp orders", "طلبات واتساب"), o.used, o.limit, over, warm)}
        {u.credits > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, fontSize: 14 }}><span>{t("Extra orders you bought", "طلبات إضافية اشتريتها")}</span><b className="nums" dir="ltr">+{num(u.credits)}</b></div>}
        <p style={muted}>{over ? t("No orders left this month.", "لا توجد طلبات متبقية هذا الشهر.") : t(`${num(left)} orders left this month.`, `بقي ${num(left)} طلب هذا الشهر.`)}{u.credits > 0 ? t(` That includes ${num(u.credits)} extra orders you bought. They are used after your monthly orders and never expire.`, ` ويشمل ذلك ${num(u.credits)} طلباً إضافياً اشتريتها. تُستخدم بعد طلباتك الشهرية ولا تنتهي صلاحيتها.`) : ""}</p>
        {over && alertBox(t("You have reached this month’s orders. New customers now get “someone from the restaurant will assist you soon”, and you reply from the inbox yourself. Buy more orders below or upgrade your plan.", "وصلت إلى حد طلبات هذا الشهر. يصل العملاء الجدد الآن رد «سيساعدك أحد من المطعم قريباً»، وتردّ أنت من صندوق الوارد. اشترِ طلبات إضافية أدناه أو رقِّ باقتك."), "alert")}
        {!over && warm && alertBox(t("You have used over 80% of this month’s orders.", "استخدمت أكثر من 80% من طلبات هذا الشهر."), "status")}
        {fair.map(([label, x]) => alertBox(t(`${label}: ${num(x.used)} of ${num(x.limit)} included this month are used.`, `${label}: استُخدم ${num(x.used)} من ${num(x.limit)} مشمولة هذا الشهر.`), "status", label))}
        {active && canManage && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={row}>{(sub.topups ?? []).map((pk: any) => <button key={pk.id} type="button" className="b b-out" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "6px 16px", lineHeight: 1.25 }} disabled={!!busy || !!blocked} onClick={() => askTopUp(pk)}><span>{t(`Add ${num(pk.orders)} orders`, `أضف ${num(pk.orders)} طلب`)}</span><span className="nums" style={{ fontSize: 13, color: MUTED, fontWeight: 400 }}>{money(pk.subtotalMinor)}{vatTag}</span></button>)}</div>
          {reason(ask?.where !== "usage")}
        </div>}
        {sheet("usage")}
      </section>; })()}

    {active && sub.branches && <section className="card" style={card}>
      <h2 style={h2}>{t("Branches", "الفروع")}</h2>
      <p style={muted}>{ar ? <><b>{b.used}</b> فعّال من <b>{b.limit}</b> {b.limit === 1 ? "فرع" : "فروع"} · {b.included} مشمولة في {planName}{b.extra ? ` + ${b.extra} إضافي` : ""}.{b.menuPerBranch ? " يمكن لكل فرع قائمته الخاصة، أو أن تشترك الفروع في قائمة واحدة." : sub.plan === "plus" ? " تشترك كل الفروع في قائمة واحدة." : ""}</> : <><b>{b.used}</b> active of <b>{b.limit}</b> {b.limit === 1 ? "branch" : "branches"} · {b.included} included in {planName}{b.extra ? ` + ${b.extra} extra` : ""}.{b.menuPerBranch ? " Each branch can have its own menu, or all branches can share one." : sub.plan === "plus" ? " All branches share one menu." : ""}</>}</p>
      {b.pendingExtra !== undefined && <p style={muted}>{ar ? `من ${date(sub.currentPeriodEnd)} سيكون لديك ${b.pendingExtra} ${b.pendingExtra === 1 ? "فرع إضافي" : "فروع إضافية"}.` : `From ${date(sub.currentPeriodEnd)} you will have ${b.pendingExtra} extra ${b.pendingExtra === 1 ? "branch" : "branches"}.`}</p>}
      {b.priceMinor ? <p style={muted}>{ar ? `الفرع الإضافي بسعر ${money(b.priceMinor)}${vatTag} لكل ${per} ويضيف ${b.ordersPerBranch} طلب شهرياً.` : `An extra branch is ${money(b.priceMinor)}${vatTag} per ${per} and adds ${b.ordersPerBranch} orders a month.`}</p> : null}
      {!sub.entitlements?.canBuyBranches && sub.plan !== "pro" && <p style={muted}>{t(`Pro lets you add more than ${b.included} branches.`, `تتيح لك Pro إضافة أكثر من ${b.included} فروع.`)}</p>}
      {canManage && sub.entitlements?.canBuyBranches && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={row}>
          <button type="button" className="b b-out" disabled={!!busy || !!blocked || !b.canBuy} onClick={askBranch}>{t("Add a branch", "إضافة فرع")}</button>
          {(b.pendingExtra ?? b.extra) > 0 && !ending && <button type="button" className="b b-out" disabled={!!busy} onClick={askRemoveBranch}>{t("Remove one at renewal", "إزالة فرع عند التجديد")}</button>}
        </div>
        {reason(ask?.where !== "branches")}
      </div>}
      {sheet("branches")}
    </section>}

    {active && canManage && <section className="card" style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={h2}>{higher.length ? t("Upgrade your plan", "ترقية باقتك") : t("Your plan", "باقتك")}</h2>
        {sub.billing === "monthly" && !ending && <div role="group" aria-label={t("Billing cycle", "دورة الفوترة")} style={{ display: "flex", padding: 3, borderRadius: 10, background: "#F6EEF2", gap: 2 }}>
          {(["monthly", "yearly"] as const).map(c => <button key={c} type="button" aria-pressed={cycle === c} className="b" onClick={() => setCycle(c)} style={{ minHeight: 36, padding: "0 14px", borderRadius: 8, border: 0, fontSize: 14, fontWeight: cycle === c ? 600 : 500, background: cycle === c ? "#fff" : "transparent", color: cycle === c ? INK : MUTED, boxShadow: cycle === c ? "0 1px 3px rgba(26,8,21,.12)" : "none" }}>{c === "monthly" ? t("Monthly", "شهري") : saving > 0 ? t(`Yearly · save ${saving}%`, `سنوي · وفّر ${saving}%`) : t("Yearly", "سنوي")}</button>)}
        </div>}
      </div>
      {ending ? <p style={muted}>{t(`Your plan is set to end on ${date(sub.currentPeriodEnd)}. Choose “Keep my plan” above to upgrade or change billing.`, `ستنتهي باقتك في ${date(sub.currentPeriodEnd)}. اختر «الإبقاء على باقتي» أعلاه لتتمكن من الترقية أو تغيير الفوترة.`)}</p> : <div>
        {sub.billing === "monthly" && target === "yearly" && mine && (() => { const q = quotes[mine.id]; return <div className="opt">
          <div><b style={{ fontSize: 16 }}>{t(`Stay on ${mine.name}, billed yearly`, `البقاء على ${mine.name} بفوترة سنوية`)}</b><p style={{ ...muted, marginTop: 4 }}>{saving > 0 ? t(`Pay for 10 months instead of 12 (${saving}% less). `, `ادفع 10 أشهر بدل 12 (أقل بنسبة ${saving}%). `) : ""}{t(`Starts at your next renewal on ${date(sub.currentPeriodEnd)}, so nothing to pay now.`, `تبدأ عند تجديدك القادم في ${date(sub.currentPeriodEnd)}، فلا شيء يُدفع الآن.`)}</p></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", justifyContent: "center" }}>
            <span className="nums" style={{ fontSize: 18, fontWeight: 600 }}>{plan(mine.id) ? moneyUi(plan(mine.id).yearly, cur0) : "—"}<span style={{ fontSize: 13, color: MUTED, fontWeight: 400 }}> {t("/ year", "/ سنة")}</span></span>
            <button type="button" className="b b-out" disabled={!!busy || !q || q.kind !== "scheduled" || !!sub.pendingBilling} onClick={() => q && askYearly(q)}>{sub.pendingBilling ? t("Scheduled", "مجدول") : t("Switch at renewal", "التحويل عند التجديد")}</button></div></div>; })()}
        {higher.map(p => { const q = quotes[p.id], eq = monthEq(p.id, target), yr = target === "yearly";
          return <div key={p.id} className="opt">
            <div style={{ minWidth: 0 }}><b style={{ fontSize: 16 }}>{p.name}</b>
              <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "2px 18px", fontSize: 14, color: INK }}>
                <li>{t(`${num(p.orders)} orders a month`, `${num(p.orders)} طلب شهرياً`)}</li><li>{t(`${p.branches} branches${p.extraBranches ? ", more can be added" : ""}`, `${p.branches} فروع${p.extraBranches ? "، ويمكن إضافة المزيد" : ""}`)}</li><li>{t(`${p.staff} staff accounts`, `${p.staff} حسابات موظفين`)}</li>
                {p.customers && !mine?.customers && <li>{t("Customers page and campaigns", "صفحة العملاء والحملات")}</li>}{p.menuPerBranch && !mine?.menuPerBranch && <li>{t("A separate menu for each branch", "قائمة منفصلة لكل فرع")}</li>}
              </ul>
              {q?.kind === "upgrade" && <p style={{ ...muted, marginTop: 8 }}>{q.totalMinor ? <>{t("Pay ", "ادفع ")}<b className="nums" style={{ color: INK }}>{money(q.totalMinor)}</b>{t(" today for the rest of this period. ", " اليوم عن باقي هذه الفترة. ")}</> : t("Nothing to pay today. ", "لا شيء يُدفع اليوم. ")}{ar ? `ثم ${money(q.renewalMinor)} لكل ${yr ? "سنة" : "شهر"} ابتداءً من ${date(q.renewsAt)}.` : `Then ${money(q.renewalMinor)} per ${yr ? "year" : "month"} from ${date(q.renewsAt)}.`}{q.cycleChange ? t(" Yearly billing starts then.", " تبدأ الفوترة السنوية حينها.") : ""}</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", justifyContent: "center" }}>
              <span className="nums" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em" }}>{eq === null ? "—" : moneyUi(Math.round(eq * 100) / 100, cur0)}<span style={{ fontSize: 13, color: MUTED, fontWeight: 400 }}> {t("/ month", "/ شهر")}</span></span>
              {yr && plan(p.id) && <span style={{ ...muted, fontSize: 13 }}>{t(`billed ${moneyUi(plan(p.id).yearly, cur0)} a year`, `تُفوتر ${moneyUi(plan(p.id).yearly, cur0)} في السنة`)}</span>}
              <button type="button" className="b b-fill" disabled={!!busy || !!blocked || !q || q.kind !== "upgrade"} onClick={() => q && askUpgrade(p, q)}>{t(`Upgrade to ${p.name}`, `الترقية إلى ${p.name}`)}</button>
            </div>
          </div>; })}
        {!higher.length && <p style={muted}>{t("You’re on our biggest plan. Add branches above, or buy extra orders when you need them.", "أنت على أكبر باقاتنا. أضف فروعاً من الأعلى أو اشترِ طلبات إضافية عند الحاجة.")}</p>}
        {!!higher.length && reason(ask?.where !== "plan")}
        {sheet("plan")}
        {mine && mine.rank > 1 || sub.billing === "yearly" ? <p style={{ ...muted, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>{ar ? `الباقات تنتقل للأعلى فقط. للانتقال إلى باقة أصغر${sub.billing === "yearly" ? " أو إلى الفوترة الشهرية" : ""}، ألغِ باقتك واشترك من جديد بعد ${date(sub.currentPeriodEnd)}.` : `Plans only go up. To move to a smaller plan${sub.billing === "yearly" ? " or to monthly billing" : ""}, cancel your plan and subscribe again after ${date(sub.currentPeriodEnd)}.`}</p> : null}
      </div>}
    </section>}

    <section className="card" style={card}>
      <h2 style={h2}>{t("Invoices", "الفواتير")}</h2>
      {!invoices.length ? <p style={muted}>{t("Your invoices appear here after your first payment.", "تظهر فواتيرك هنا بعد أول دفعة.")}</p> : <div style={{ display: "flex", flexDirection: "column" }}>
        {invoices.map((i, k) => <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderTop: k ? "1px solid #F3EEF1" : 0, flexWrap: "wrap" }}>
          <b className="nums" style={{ minWidth: 130 }}>{i.number}</b><span style={{ ...muted, flex: 1, minWidth: 140 }}>{date(i.createdAt)} · {(ar ? { SIGNUP: "الدفعة الأولى", RENEWAL: "تجديد", TOPUP: "طلبات إضافية", UPGRADE: "ترقية", BRANCH: "فرع إضافي" } : { SIGNUP: "First payment", RENEWAL: "Renewal", TOPUP: "Extra orders", UPGRADE: "Upgrade", BRANCH: "Extra branch" } as Record<string, string>)[i.kind] ?? t("Payment", "دفعة")}</span>
          <span className="nums" style={{ fontWeight: 600 }}>{money(i.totalMinor, i.currency)}</span><a href={`/invoices/${i.id}?businessId=${businessId}`} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 500, minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 6px" }}>{t("View", "عرض")}</a>
        </div>)}
      </div>}
    </section>
    {!taxFirst && taxNode}
  </div>;
}

// The business's billing tax details: who is invoiced, and (for Saudi Arabia, Oman and Bahrain) the local VAT registration that has to be verified before a plan can be bought.
const VAT_COPY: Record<string, [string, string, string, string]> = {
  NOT_REQUIRED: ["Not required", "#F6EEF2", "#3D1C31", "غير مطلوب"], NOT_SUBMITTED: ["Not submitted", "#FFF1DC", "#8A4B00", "لم يُرسل"], PENDING: ["Being reviewed", "#FFF1DC", "#8A4B00", "قيد المراجعة"], VERIFIED: ["Verified", "#E4F4EC", "#16704A", "تم التحقق"], REJECTED: ["Not verified", "#FDECEC", "#B42318", "لم يتم التحقق"], EXPIRED: ["Expired", "#FDECEC", "#B42318", "منتهي"],
};
const field: React.CSSProperties = { height: 44, width: "100%", padding: "0 12px", borderRadius: 10, border: "1.5px solid #ECD9E0", background: "#fff", fontSize: 15, boxSizing: "border-box" };
export function TaxDetails({ businessId, canManage, onSaved, ar = false }: { businessId: string; canManage: boolean; onSaved: () => void; ar?: boolean }) {
  const t = (en: string, a: string) => (ar ? a : en), date = fmtDate(ar);
  const base = `/api/v1/businesses/${businessId}/billing-tax`;
  const [p, setP] = React.useState<any>(null), [f, setF] = React.useState<any>({ legalName: "", line1: "", city: "", vatRegistered: false, vatNumber: "" }), [err, setErr] = React.useState(""), [busy, setBusy] = React.useState(false), [saved, setSaved] = React.useState(false);
  const fill = (v: any) => { setP(v); setF({ legalName: v.legalName ?? "", line1: v.billingAddress?.line1 ?? "", city: v.billingAddress?.city ?? "", vatRegistered: v.vatRegistered ?? v.vatRequired, vatNumber: v.vatNumber ?? "" }); };
  React.useEffect(() => { api(base).then(fill).catch(e => setErr(e.message)); }, [base]);
  if (!p) return err ? <div role="alert" style={{ color: "#B42318", fontSize: 14 }}>{err}</div> : null;
  const [en, bg, fg, arLabel] = VAT_COPY[p.vatVerificationStatus] ?? VAT_COPY.NOT_SUBMITTED!, label = t(en, arLabel);
  const note = p.vatVerificationStatus === "PENDING" ? t("Your VAT details are being reviewed. You can continue setting up while we verify your business.", "بيانات ضريبة القيمة المضافة قيد المراجعة. يمكنك متابعة الإعداد أثناء التحقق من نشاطك.")
    : p.vatVerificationStatus === "VERIFIED" ? t(`Your VAT registration is verified${p.validTo ? ` until ${date(p.validTo)}` : ""}.`, `تم التحقق من تسجيلك في ضريبة القيمة المضافة${p.validTo ? ` حتى ${date(p.validTo)}` : ""}.`)
    : p.vatVerificationStatus === "REJECTED" ? t(`We couldn’t verify your VAT details${p.rejectionReason ? `: ${p.rejectionReason}` : ""}. Check them and submit again.`, `تعذّر التحقق من بيانات ضريبة القيمة المضافة${p.rejectionReason ? `: ${p.rejectionReason}` : ""}. تحقق منها وأرسلها من جديد.`)
    : p.vatVerificationStatus === "EXPIRED" ? t("Your VAT verification has expired. Submit your details again to renew it.", "انتهى التحقق من ضريبة القيمة المضافة. أرسل بياناتك من جديد لتجديده.")
    : p.vatRequired ? t("For this market, Lumia Order currently supports subscriptions for VAT-registered businesses. Enter your business VAT number to continue. If you are not registered, contact sales to discuss future availability.", "في هذا السوق، يدعم لوميا أوردر حالياً الاشتراكات للأنشطة المسجلة في ضريبة القيمة المضافة. أدخل رقم تسجيل نشاطك للمتابعة. إن لم تكن مسجلاً، تواصل مع المبيعات لمناقشة التوفر مستقبلاً.") : "";
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(""); setSaved(false);
    try { const v = await api(base, "PUT", { legalName: f.legalName, billingAddress: { line1: f.line1, city: f.city }, vatRegistered: !!f.vatRegistered, vatNumber: f.vatRegistered ? f.vatNumber : "" }); fill(v); setSaved(true); onSaved(); } catch (e2: any) { setErr(e2.message); }
    setBusy(false);
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return <section style={card}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><h2 style={h2}>{t("Tax details", "البيانات الضريبية")}</h2>{p.vatRequired && <span style={pill(bg, fg)}>{t("VAT: ", "الضريبة: ")}{label}</span>}</div>
    <p style={muted}>{t(`These details appear on your invoices${p.vatRequired ? ", and your VAT registration decides whether a plan can be bought" : ""}.`, `تظهر هذه البيانات في فواتيرك${p.vatRequired ? "، ويحدد تسجيلك في ضريبة القيمة المضافة إمكانية شراء باقة" : ""}.`)}</p>
    {note && <p style={{ ...muted, color: p.vatVerificationStatus === "REJECTED" || p.vatVerificationStatus === "EXPIRED" ? "#B42318" : "#3D1C31" }}>{note}</p>}
    <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 }}>{t("Legal name of the business", "الاسم القانوني للنشاط")}<input style={field} value={f.legalName} onChange={set("legalName")} disabled={!canManage} required minLength={2} /></label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 }}>{t("Billing address", "عنوان الفوترة")}<input style={field} value={f.line1} onChange={set("line1")} disabled={!canManage} required minLength={3} /></label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 }}>{t("City", "المدينة")}<input style={field} value={f.city} onChange={set("city")} disabled={!canManage} required minLength={2} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, alignSelf: "end", minHeight: 44 }}><input type="checkbox" checked={!!f.vatRegistered} onChange={set("vatRegistered")} disabled={!canManage || p.vatRequired && false} />{t(`My business is VAT registered in ${p.billingCountry}`, `نشاطي مسجل في ضريبة القيمة المضافة في ${p.billingCountry}`)}</label>
      {f.vatRegistered && <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 }}>{t("VAT registration number", "رقم التسجيل الضريبي")}<input style={field} value={f.vatNumber} onChange={set("vatNumber")} disabled={!canManage} required={p.vatRequired} inputMode="text" autoComplete="off" /></label>}
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {canManage && <button type="submit" className="b b-fill" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save tax details", "حفظ البيانات الضريبية")}</button>}
        {saved && <span role="status" style={{ fontSize: 14, color: "#16704A", fontWeight: 500 }}>{t("Saved.", "تم الحفظ.")}</span>}
        {err && <span role="alert" style={{ fontSize: 14, color: "#B42318" }}>{err}</span>}
      </div>
    </form>
  </section>;
}
