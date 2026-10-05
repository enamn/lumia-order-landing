"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Billing inside the dashboard: plan and renewal, the card on file, plan changes, cancellation and invoices.
// The subscription is Lumia's; Stripe only takes the payments, so every action here talks to Lumia's own API.
import React from "react";
import { ContentLoader } from "@/components/lumia-loader";
import { mountEmbeddedCheckout, type EmbeddedForm } from "@/lib/stripe-embed";

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? json.message ?? "Something went wrong. Please try again.");
  return json.data ?? json;
}
const PLANS: [string, string, number, number][] = [["starter", "Starter", 149, 1490], ["plus", "Plus", 249, 2490], ["pro", "Pro", 399, 3990]];
const RANK: Record<string, number> = { starter: 1, plus: 2, pro: 3 };
const aed = (minor: number) => "AED " + (minor / 100).toLocaleString("en-US", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 });
const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
const card: React.CSSProperties = { border: "1px solid #F0E4E8", borderRadius: 16, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 };
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 };
const muted: React.CSSProperties = { fontSize: 14, color: "#8A5A6E", margin: 0, lineHeight: 1.5 };
const outline: React.CSSProperties = { height: 40, padding: "0 16px", borderRadius: 12, border: "1.5px solid #ECD9E0", background: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" };
const gradient: React.CSSProperties = { height: 40, padding: "0 18px", borderRadius: 12, border: 0, background: "linear-gradient(90deg,#FF5577,#C93DFF)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const pill = (bg: string, fg: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: bg, color: fg, whiteSpace: "nowrap" });

export function BillingPage({ businessId, onChoosePlan, onChanged }: { businessId: string; onChoosePlan: () => void; onChanged: () => void }) {
  const base = `/api/v1/businesses/${businessId}/subscription`;
  const [sub, setSub] = React.useState<any>(null), [invoices, setInvoices] = React.useState<any[]>([]), [error, setError] = React.useState(""), [busy, setBusy] = React.useState(""), [note, setNote] = React.useState("");
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("monthly"), [quotes, setQuotes] = React.useState<Record<string, any>>({}), [cardForm, setCardForm] = React.useState<null | { secret: string; key: string; id: string }>(null);
  const slot = React.useRef<HTMLDivElement>(null), form = React.useRef<EmbeddedForm | null>(null);
  const load = React.useCallback(async () => { try { const [s, i] = await Promise.all([api(base), api(`${base}/invoices`)]); setSub(s); setInvoices(i); setCycle(s.billing ?? "monthly"); } catch (e: any) { setError(e.message); } }, [base]);
  React.useEffect(() => { load(); }, [load]);
  // quotes for each plan under the chosen cycle
  React.useEffect(() => { if (!sub || !sub.plan || sub.status === "NONE") return; let live = true; Promise.all(PLANS.map(([id]) => api(`${base}/quote`, "POST", { plan: id, billing: cycle }).then(q => [id, q] as const).catch(() => [id, null] as const))).then(r => { if (live) setQuotes(Object.fromEntries(r)); }); return () => { live = false; }; }, [sub, cycle, base]);
  React.useEffect(() => {
    if (!cardForm || !slot.current) return; let gone = false;
    mountEmbeddedCheckout(slot.current, cardForm.secret, cardForm.key, async () => { form.current?.destroy(); form.current = null; setCardForm(null); try { await api(`${base}/confirm`, "POST", { sessionId: cardForm.id }); setNote("Your card was updated."); await load(); onChanged(); } catch (e: any) { setError(e.message); } })
      .then(f => { if (gone) f.destroy(); else form.current = f; }).catch(e => setError(e.message));
    return () => { gone = true; form.current?.destroy(); form.current = null; };
  }, [cardForm, base, load, onChanged]);

  const run = async (key: string, fn: () => Promise<any>, done: string) => { setBusy(key); setError(""); setNote(""); try { await fn(); setNote(done); await load(); onChanged(); } catch (e: any) { setError(e.message); } setBusy(""); };
  if (!sub && !error) return <ContentLoader />;
  if (!sub) return <div style={{ color: "#B42318", fontSize: 15 }}>{error}</div>;
  const active = sub.status === "ACTIVE" || sub.status === "PAST_DUE", pastDue = sub.status === "PAST_DUE", canManage = sub.canManage;
  const planName = PLANS.find(p => p[0] === sub.plan)?.[1] ?? "";
  const status = pastDue ? ["Payment failed", "#FFF1DC", "#8A4B00"] : sub.status === "ENDED" ? ["Lapsed", "#FDECEC", "#B42318"] : sub.status === "CANCELED" ? ["Cancelled", "#F6EEF2", "#3D1C31"] : sub.cancelAtPeriodEnd ? ["Cancels " + date(sub.currentPeriodEnd), "#F6EEF2", "#3D1C31"] : active ? ["Active", "#E6F4EC", "#16704A"] : ["Free trial", "#FDEAF2", "#8A2040"];

  return <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
    <div><h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.035em", margin: 0 }}>Billing</h1><p style={{ ...muted, marginTop: 6 }}>Your plan, payment card and invoices.</p></div>
    {error && <div role="alert" style={{ fontSize: 14, color: "#B42318" }}>{error}</div>}
    {note && <div role="status" style={{ fontSize: 14, color: "#16704A", fontWeight: 500 }}>{note}</div>}

    <section style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><h2 style={h2}>{active || sub.status !== "NONE" ? `${planName} plan` : "No plan yet"}</h2><span style={pill(status[1]!, status[2]!)}>{status[0]}</span></div>
      {!active && sub.status === "NONE" && <><p style={muted}>{sub.trial.daysLeft ? `Your free trial ends on ${date(sub.trial.endsAt)}.` : "Your free trial has ended."} Choose a plan to keep receiving WhatsApp orders.</p><div><button type="button" style={gradient} onClick={onChoosePlan}>Choose a plan</button></div></>}
      {(sub.status === "ENDED" || sub.status === "CANCELED") && <><p style={muted}>{sub.status === "ENDED" ? "Your last renewal could not be paid, so the plan lapsed." : "Your plan was cancelled."} You can subscribe again at any time.</p><div><button type="button" style={gradient} onClick={onChoosePlan}>Choose a plan</button></div></>}
      {active && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <div><p style={muted}>Billing</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0, textTransform: "capitalize" }}>{sub.billing}</p></div>
          <div><p style={muted}>{sub.cancelAtPeriodEnd ? "Plan ends" : "Next payment"}</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{sub.cancelAtPeriodEnd ? date(sub.currentPeriodEnd) : sub.nextCharge ? `${aed(sub.nextCharge.amountMinor)} on ${date(sub.nextCharge.at)}` : "—"}</p></div>
          <div><p style={muted}>Current period</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{date(sub.currentPeriodStart)} – {date(sub.currentPeriodEnd)}</p></div>
        </div>
        {pastDue && <div role="alert" style={{ padding: "12px 14px", borderRadius: 12, background: "#FFF1DC", color: "#6B3A00", fontSize: 14, lineHeight: 1.45 }}>The last payment didn’t go through{sub.lastFailure ? ` (${String(sub.lastFailure).replace(/\.$/, "")})` : ""}. We’ll try again automatically{sub.failedAttempts ? ` (attempt ${sub.failedAttempts} of 4 failed)` : ""}. Update your card to fix it now.</div>}
        {sub.pendingPlan && <p style={muted}>Changes to <b>{PLANS.find(p => p[0] === sub.pendingPlan)?.[1]}</b> ({sub.pendingBilling}) on {date(sub.currentPeriodEnd)}.</p>}
        {canManage && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {sub.cancelAtPeriodEnd ? <button type="button" style={outline} disabled={!!busy} onClick={() => run("resume", () => api(`${base}/resume`, "POST"), "Your plan will keep renewing.")}>Keep my plan</button>
            : <button type="button" style={outline} disabled={!!busy} onClick={() => { if (window.confirm(`Cancel your plan? It stays active until ${date(sub.currentPeriodEnd)}, then stops. You won’t be charged again.`)) run("cancel", () => api(`${base}/cancel`, "POST"), "Your plan will end at the end of this period."); }}>Cancel plan</button>}
        </div>}
      </>}
    </section>

    {active && <section style={card}>
      <h2 style={h2}>Payment card</h2>
      {sub.card ? <p style={{ fontSize: 15, margin: 0, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b style={{ textTransform: "capitalize" }}>{sub.card.brand}</b> •••• {sub.card.last4} <span style={{ color: "#8A5A6E" }}>expires {String(sub.card.expMonth).padStart(2, "0")}/{String(sub.card.expYear).slice(-2)}</span></p> : <p style={muted}>No card on file.</p>}
      {canManage && !cardForm && <div><button type="button" style={outline} disabled={!!busy} onClick={() => run("card", async () => { const r = await api(`${base}/card`, "POST"); if (r.clientSecret) setCardForm({ secret: r.clientSecret, key: r.publishableKey, id: r.sessionId }); else window.location.assign(r.url); }, "")}>{sub.card ? "Update card" : "Add card"}</button></div>}
      {cardForm && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><div ref={slot} style={{ minHeight: 300, border: "1.5px solid #ECD9E0", borderRadius: 16, padding: 12, background: "#fff" }} /><div><button type="button" style={outline} onClick={() => setCardForm(null)}>Cancel</button></div></div>}
    </section>}

    {active && canManage && <section style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h2 style={h2}>Change plan</h2>
        <div role="radiogroup" aria-label="Billing cycle" style={{ display: "flex", padding: 3, borderRadius: 10, background: "#F6EEF2", gap: 2 }}>
          {(["monthly", "yearly"] as const).map(c => <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, fontSize: 14, fontWeight: cycle === c ? 600 : 500, background: cycle === c ? "#fff" : "transparent", color: cycle === c ? "#1A0815" : "#8A5A6E", boxShadow: cycle === c ? "0 1px 3px rgba(26,8,21,.12)" : "none", cursor: "pointer", textTransform: "capitalize" }}>{c}</button>)}
        </div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
        {PLANS.map(([id, name, m, y]) => { const cur = sub.plan === id && sub.billing === cycle, q = quotes[id], up = RANK[id]! > RANK[sub.plan]!;
          const hint = cur ? "Your current plan" : !q ? "" : q.kind === "upgrade" ? `Upgrade now: pay ${aed(q.totalMinor)} for the rest of this period` : `Starts ${date(q.effectiveAt)} at ${aed(q.renewalMinor)} per ${cycle === "yearly" ? "year" : "month"}`;
          return <div key={id} style={{ border: `2px solid ${cur ? "#FF5577" : "#F0E4E8"}`, background: cur ? "#FFF7FA" : "#fff", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <b style={{ fontSize: 16 }}>{name}</b><span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em" }}>AED {cycle === "yearly" ? y : m}<span style={{ fontSize: 13, color: "#8A5A6E", fontWeight: 400 }}> / {cycle === "yearly" ? "year" : "month"}</span></span>
            <span style={{ fontSize: 13, color: "#8A5A6E", minHeight: 36 }}>{hint}</span>
            <button type="button" disabled={cur || !!busy} style={{ ...(up && sub.billing === cycle ? gradient : outline), opacity: cur ? 0.45 : 1 }} onClick={() => run("plan", () => api(`${base}/change`, "POST", { plan: id, billing: cycle }), up && sub.billing === cycle ? `You’re on ${name} now.` : `Done. ${name} starts at your next renewal.`)}>{cur ? "Current" : up && sub.billing === cycle ? `Upgrade to ${name}` : `Switch to ${name}`}</button>
          </div>; })}
      </div>
      {sub.pendingPlan && <div><button type="button" style={outline} disabled={!!busy} onClick={() => run("plan", () => api(`${base}/change`, "POST", { plan: sub.plan, billing: sub.billing }), "The scheduled change was cancelled.")}>Cancel scheduled change</button></div>}
    </section>}

    <section style={card}>
      <h2 style={h2}>Invoices</h2>
      {!invoices.length ? <p style={muted}>Invoices appear here after your first payment.</p> : <div style={{ display: "flex", flexDirection: "column" }}>
        {invoices.map((i, k) => <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: k ? "1px solid #F3EEF1" : 0, flexWrap: "wrap" }}>
          <b style={{ fontVariantNumeric: "tabular-nums", minWidth: 130 }}>{i.number}</b><span style={{ ...muted, flex: 1, minWidth: 140 }}>{date(i.createdAt)} · {i.kind === "SIGNUP" ? "First payment" : i.kind === "RENEWAL" ? "Renewal" : "Upgrade"}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{aed(i.totalMinor)}</span><a href={`/invoices/${i.id}?businessId=${businessId}`} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 500 }}>View</a>
        </div>)}
      </div>}
    </section>
  </div>;
}
