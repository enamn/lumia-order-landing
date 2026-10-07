"use client";
import React from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ink = "#1A0815", muted = "#8A5A6E", line = "#F0E4E8", grad = "linear-gradient(90deg,#FF5577,#C93DFF)";
const card: React.CSSProperties = { background: "#fff", border: `1px solid ${line}`, borderRadius: 16, padding: "18px 20px", minWidth: 0 };
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.01em" };
const num = (n: number) => n.toLocaleString("en-US");
const flag = (cc: string) => (cc.length === 2 && cc !== "ZZ" ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : "🌐");
const KIND: Record<string, string> = { cta_free_trial: "Free trial", cta_signup: "Sign up", login_click: "Sign in" };

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div style={{ ...card, padding: "16px 18px" }}><div style={{ fontSize: 13, color: muted }}>{label}</div><div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>{sub && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{sub}</div>}</div>;
}
function Bars({ rows }: { rows: { day: string; visitors: number; freeTrial: number; signup: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.visitors)), w = 100 / rows.length;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: 140, display: "block" }} role="img" aria-label="Visitors per day">
      {rows.map((r, i) => <g key={r.day}><title>{`${r.day}: ${r.visitors} visitors, ${r.freeTrial} free-trial clicks, ${r.signup} sign-up clicks`}</title><rect x={i * w + w * 0.15} y={40 - (r.visitors / max) * 38} width={w * 0.7} height={(r.visitors / max) * 38} rx="0.6" fill="#E9B8D0" /><rect x={i * w + w * 0.15} y={40 - ((r.freeTrial + r.signup) / max) * 38} width={w * 0.7} height={((r.freeTrial + r.signup) / max) * 38} rx="0.6" fill="#C93DFF" /></g>)}
    </svg>
  );
}

const FLAGS: [string, string][] = [["registrationEnabled", "Registration"], ["paidActivationEnabled", "Paid plans"], ["otpEnabled", "Sign-in code"], ["whatsappOnboardingEnabled", "WhatsApp set-up"], ["terminalSalesEnabled", "Terminals"]];
const STATE_BG: Record<string, string> = { live: "#E4F4EC", configured: "#FFF1DC", implemented: "#F3EEF1" };
function Markets() {
  const [rows, setRows] = React.useState<any[] | null>(null), [err, setErr] = React.useState(""), [busy, setBusy] = React.useState("");
  const load = () => fetch("/api/superadmin/markets", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not load."); setRows(j.data ?? j); }).catch(e => setErr(e.message));
  React.useEffect(() => { load(); }, []);
  const toggle = async (code: string, key: string, on: boolean) => {
    const reason = window.prompt(`Why are you turning "${key}" ${on ? "on" : "off"} for ${code}? (saved in the change log)`); if (!reason || reason.trim().length < 5) return;
    setBusy(code + key); setErr("");
    try { const r = await fetch("/api/superadmin/markets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, reason, flags: { [key]: on } }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not save."); setRows(j.data ?? j); } catch (e) { setErr((e as Error).message); }
    setBusy("");
  };
  return (
    <section style={{ ...card }}>
      <h2 style={h2}>Markets</h2>
      <div style={{ fontSize: 13, color: muted, marginBottom: 10 }}>Switch each GCC country on step by step. Paid plans stay off until prices and tax set-up for that country are approved.</div>
      {err && <div role="alert" style={{ color: "#B4233B", fontSize: 14, marginBottom: 8 }}>{err}</div>}
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ textAlign: "left", color: muted }}>{["Market", "Status", ...FLAGS.map(f => f[1])].map(h => <th key={h} style={{ padding: "6px 10px 8px 0", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{(rows ?? []).map((m: any) => <tr key={m.code} style={{ borderTop: `1px solid ${line}` }}>
          <td style={{ padding: "8px 10px 8px 0", whiteSpace: "nowrap" }}>{m.flag} {m.nameEn} <span style={{ color: muted }}>· {m.currency}</span></td>
          <td style={{ padding: "8px 10px 8px 0" }}><span title={m.stateNote} style={{ fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "2px 9px", background: STATE_BG[m.state] ?? "#eee" }}>{m.state}</span></td>
          {FLAGS.map(([k]) => <td key={k} style={{ padding: "8px 10px 8px 0" }}><input type="checkbox" aria-label={`${m.code} ${k}`} checked={!!m[k]} disabled={busy === m.code + k} onChange={e => toggle(m.code, k, e.target.checked)} /></td>)}
        </tr>)}</tbody></table></div>
    </section>
  );
}

function Tax() {
  const [d, setD] = React.useState<any>(null), [err, setErr] = React.useState(""), [busy, setBusy] = React.useState(false);
  const load = () => fetch("/api/superadmin/tax", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not load."); setD(j.data ?? j); }).catch(e => setErr(e.message));
  React.useEffect(() => { load(); }, []);
  const send = async (body: object) => { setBusy(true); setErr(""); try { const r = await fetch("/api/superadmin/tax", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not save."); await load(); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const day = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "–");
  const reg = d?.supplier?.registrations?.[0];
  const setRegistration = () => {
    const state = (window.prompt("Afkar IO's UAE VAT registration: type ACTIVE or INACTIVE", reg?.state ?? "INACTIVE") ?? "").toUpperCase(); if (state !== "ACTIVE" && state !== "INACTIVE") return;
    const number = state === "ACTIVE" ? window.prompt("The registration number (TRN) exactly as on the FTA certificate", reg?.number ?? "") ?? "" : "";
    const from = state === "ACTIVE" ? window.prompt("The date it takes effect (YYYY-MM-DD), from the certificate", "") ?? "" : "";
    const reason = window.prompt("Why? (saved in the change log, e.g. the certificate reference)") ?? ""; if (reason.trim().length < 5) return;
    send({ action: "registration", data: { country: "AE", number, state, effectiveFrom: state === "ACTIVE" && from ? new Date(from + "T00:00:00+04:00").toISOString() : null, effectiveTo: null, reason } });
  };
  const addPolicy = () => {
    const country = (window.prompt("Destination country code (SA, OM, BH, QA or KW)") ?? "").toUpperCase(); if (!country) return;
    const t = (window.prompt("Afkar's UAE treatment for this service: DOMESTIC_STANDARD, ZERO_RATED or OUTSIDE_SCOPE") ?? "").toUpperCase(); if (!t) return;
    const from = window.prompt("In force from (YYYY-MM-DD)", new Date().toISOString().slice(0, 10)) ?? ""; const evidence = window.prompt("Evidence: who approved it and where it is recorded") ?? ""; if (!from || evidence.trim().length < 5) return;
    send({ action: "policy", data: { country, uaeTreatment: t, effectiveFrom: new Date(from + "T00:00:00+04:00").toISOString(), effectiveTo: null, version: `${country}-${from}`, evidence } });
  };
  const review = (businessId: string, decision: "VERIFIED" | "REJECTED") => {
    const method = (window.prompt("How was it checked? OFFICIAL_LOOKUP or MANUAL_DOCUMENT_REVIEW", "MANUAL_DOCUMENT_REVIEW") ?? "").toUpperCase(); if (!method) return;
    let evidenceReference = "", validTo: string | null = null;
    if (decision === "VERIFIED") { evidenceReference = window.prompt("Evidence reference (where the certificate or lookup result is kept)") ?? ""; const v = window.prompt("The registration is valid until (YYYY-MM-DD)") ?? ""; validTo = v ? new Date(v + "T23:59:59+04:00").toISOString() : null; }
    const reason = window.prompt(decision === "VERIFIED" ? "Note (saved in the change log)" : "Why is it rejected? (the owner sees this)") ?? ""; if (reason.trim().length < 5) return;
    send({ action: "review", businessId, data: { decision, method, evidenceReference, validFrom: null, validTo, reason } });
  };
  return (
    <section style={{ ...card, marginTop: 12 }}>
      <h2 style={h2}>Tax</h2>
      {err && <div role="alert" style={{ color: "#B4233B", fontSize: 14, marginBottom: 8 }}>{err}</div>}
      {d && <>
        <div style={{ fontSize: 14, marginBottom: 14 }}>
          <b>Afkar IO · UAE VAT registration:</b> {reg?.state === "ACTIVE" ? `active, number ${reg.number}, from ${day(reg.effectiveFrom)}` : "not registered (no VAT is charged on subscriptions)"}
          <button type="button" disabled={busy} onClick={setRegistration} style={{ marginInlineStart: 10, fontSize: 13, fontWeight: 600, textDecoration: "underline", color: "#C0284F", cursor: "pointer" }}>Change</button>
          <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Only enter this when the registration really exists. A threshold alert is not a registration.</div>
        </div>
        <div style={{ fontSize: 14, marginBottom: 14, padding: "10px 12px", borderRadius: 12, background: d.turnover.level === "OK" ? "#F6EEF2" : d.turnover.level === "WARNING" ? "#FFF1DC" : "#FDECEC" }}>
          <b>UAE VAT threshold (rolling 12 months):</b> AED {(d.turnover.aedRollingMinor / 100).toLocaleString("en-US")} of AED 375,000 ({d.turnover.percentOfThreshold}%) · next-12-months estimate AED {(d.turnover.aedForecastMinor / 100).toLocaleString("en-US")}
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{d.turnover.note}{d.turnover.byCurrency.filter((c: any) => c.currency !== "AED").map((c: any) => ` Also invoiced: ${c.currency} ${(c.total / (["OMR", "BHD", "KWD"].includes(c.currency) ? 1000 : 100)).toLocaleString("en-US")}.`).join("")}</div>
        </div>
        <div style={{ fontSize: 14, marginBottom: 14 }}><b>Approved policies</b> (needed for foreign sales once Afkar is registered)
          <button type="button" disabled={busy} onClick={addPolicy} style={{ marginInlineStart: 10, fontSize: 13, fontWeight: 600, textDecoration: "underline", color: "#C0284F", cursor: "pointer" }}>Add</button>
          {d.policies.length ? d.policies.map((p: any) => <div key={p.id} style={{ fontSize: 13, color: muted }}>{p.country} · {p.uaeTreatment} · from {day(p.effectiveFrom)} · {p.version}</div>) : <div style={{ fontSize: 13, color: muted }}>None.</div>}</div>
        <div style={{ fontSize: 14 }}><b>VAT registrations waiting for review ({d.pending.length})</b>
          {d.pending.map((r: any) => <div key={r.businessId} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${line}` }}>
            <span style={{ flex: "1 1 260px" }}>{r.restaurant} · {r.country} · {r.legalName}<br /><span style={{ color: muted, fontSize: 13 }}>VAT number {r.vatNumber} · submitted {day(r.submittedAt)}</span></span>
            <button type="button" disabled={busy} onClick={() => review(r.businessId, "VERIFIED")} style={{ ...btnSm, background: "#E4F4EC" }}>Approve</button><button type="button" disabled={busy} onClick={() => review(r.businessId, "REJECTED")} style={{ ...btnSm, background: "#FDECEC" }}>Reject</button></div>)}
          {!d.pending.length && <div style={{ fontSize: 13, color: muted }}>Nothing waiting.</div>}</div>
        {d.audit.length > 0 && <details style={{ marginTop: 14, fontSize: 13 }}><summary style={{ cursor: "pointer", color: muted }}>Change log</summary>{d.audit.map((a: any, i: number) => <div key={i} style={{ padding: "3px 0", color: muted }}>{new Date(a.at).toLocaleString("en-GB")} · {a.action} · {a.reason}</div>)}</details>}
      </>}
    </section>
  );
}
const COUNTRIES: [string, string, string, number][] = [["SA", "Saudi Arabia", "SAR", 2], ["OM", "Oman", "OMR", 3], ["BH", "Bahrain", "BHD", 3], ["QA", "Qatar", "QAR", 2], ["KW", "Kuwait", "KWD", 3]];
const PLAN_ROWS: [string, string][] = [["starter", "Starter"], ["plus", "Plus"], ["pro", "Pro"]];
const inp: React.CSSProperties = { width: 110, height: 36, borderRadius: 10, border: "1.5px solid #ECD9E0", padding: "0 10px", fontSize: 15, fontVariantNumeric: "tabular-nums", background: "#fff", color: ink };
function Prices() {
  const [d, setD] = React.useState<any>(null), [flags, setFlags] = React.useState<any[]>([]), [err, setErr] = React.useState(""), [ok, setOk] = React.useState(""), [busy, setBusy] = React.useState(false);
  const [cc, setCc] = React.useState("SA"), [vals, setVals] = React.useState<Record<string, string>>({}), [from, setFrom] = React.useState(new Date().toISOString().slice(0, 10));
  const load = () => Promise.all([
    fetch("/api/superadmin/prices", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not load."); return j.data ?? j; }),
    fetch("/api/superadmin/markets", { cache: "no-store" }).then(r => r.json()).then(j => j.data ?? j).catch(() => []),
  ]).then(([p, m]) => { setD(p); setFlags(Array.isArray(m) ? m : []); }).catch(e => setErr(e.message));
  React.useEffect(() => { load(); }, []);
  const country = COUNTRIES.find(c => c[0] === cc)!, [, , cur, dec] = country;
  const unit = (minor: number) => String(minor / (dec === 3 ? 1000 : 100));
  // The newest price per item for this country: what is live (ACTIVE and started) beats a draft.
  const current = React.useMemo(() => {
    const m = new Map<string, any>(); if (!d) return m;
    const now = Date.now(), rows = d.prices.filter((p: any) => p.country === cc);
    for (const p of rows) { const live = p.status === "ACTIVE" && new Date(p.effectiveFrom).getTime() <= now; const had = m.get(p.item); if (!had || (live && !had.live) || (live === had.live && new Date(p.createdAt) > new Date(had.p.createdAt))) m.set(p.item, { p, live }); }
    return m;
  }, [d, cc]);
  React.useEffect(() => { const v: Record<string, string> = {}; current.forEach((x, item) => { v[item] = unit(x.p.amountMinor); }); setVals(v); setOk(""); setErr(""); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <section style={{ ...card, marginTop: 12 }}><h2 style={h2}>Plan prices</h2>{err ? <div role="alert" style={{ color: "#B4233B" }}>{err}</div> : <span style={{ color: muted }}>Loading…</span>}</section>;
  const items: string[] = d.items, filled = items.filter(i => Number(vals[i]) > 0), allFilled = filled.length === items.length;
  const liveCount = items.filter(i => current.get(i)?.live).length;
  const mk = flags.find((m: any) => m.code === cc), curOn = d.enabledCurrencies.includes(cur);
  const status = (code: string) => { const rows = d.prices.filter((p: any) => p.country === code); if (!rows.length) return ["Not set", "#F3EEF1"]; const n = new Set(rows.filter((p: any) => p.status === "ACTIVE" && new Date(p.effectiveFrom) <= new Date()).map((p: any) => p.item)).size; return n === items.length ? ["Prices live", "#E4F4EC"] : ["Draft", "#FFF1DC"]; };
  const uae = (item: string) => { const [kind, a, b] = item.split(":"); return kind === "plan" ? d.uae.plans[a][b] : kind === "branch" ? d.uae.extraBranch[a] : d.uae.topups[a]; };
  const save = async (statusTo: "DRAFT" | "ACTIVE") => {
    const amounts: Record<string, number> = {}; for (const i of items) if (Number(vals[i]) > 0) amounts[i] = Number(vals[i]);
    if (statusTo === "ACTIVE" && !window.confirm(`Make these ${cur} prices active from ${from}? New subscriptions in ${country[1]} will be charged these amounts (before tax).`)) return;
    setBusy(true); setErr(""); setOk("");
    try { const r = await fetch("/api/superadmin/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: cc, status: statusTo, amounts, effectiveFrom: new Date(from + "T00:00:00+04:00").toISOString(), version: `${from}-${Date.now().toString(36)}` }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not save."); setOk(statusTo === "ACTIVE" ? "Prices are active." : "Draft saved. It is not used for sales yet."); await load(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const cell = (item: string) => <td style={{ padding: "6px 14px 6px 0", whiteSpace: "nowrap" }}><input type="number" inputMode="decimal" min="0" step={dec === 3 ? "0.01" : "0.01"} aria-label={`${country[1]} ${item}`} style={inp} value={vals[item] ?? ""} placeholder="–" onChange={e => setVals(v => ({ ...v, [item]: e.target.value }))} /><span style={{ fontSize: 12, color: muted, marginInlineStart: 8 }}>AED {uae(item)}</span>{current.get(item) && <span style={{ fontSize: 11, marginInlineStart: 6, color: current.get(item).live ? "#16704A" : "#A86A00" }}>{current.get(item).live ? "live" : "draft"}</span>}</td>;
  // A plain function, not a component: a component defined inside Prices is a new type on every render, which remounts the inputs and drops the cursor after each key.
  const row = (label: string, a: string, b?: string) => <tr key={a} style={{ borderTop: `1px solid ${line}` }}><td style={{ padding: "6px 14px 6px 0", fontWeight: 600 }}>{label}</td>{cell(a)}{b ? cell(b) : <td />}</tr>;
  const check = (on: boolean, text: string) => <div style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><span aria-hidden style={{ color: on ? "#16704A" : "#B4233B" }}>{on ? "✓" : "✗"}</span><span>{text}</span></div>;
  return (
    <section style={{ ...card, marginTop: 12 }}>
      <h2 style={h2}>Plan prices per country</h2>
      <div style={{ fontSize: 13, color: muted, marginBottom: 12 }}>Enter the price of every plan in the country's own currency, before tax. The UAE prices (AED) are shown next to each box for reference. Save a draft while you work; “Make active” starts selling at these prices on the date you choose.</div>
      <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>{COUNTRIES.map(([code, name]) => { const [t, bg] = status(code); return <button key={code} type="button" role="tab" aria-selected={cc === code} onClick={() => setCc(code)} style={{ ...btnSm, background: cc === code ? "#FBF1FF" : "#fff", borderColor: cc === code ? "#C93DFF" : "#ECD9E0", height: 40 }}>{name} <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "1px 8px", background: bg, marginInlineStart: 4 }}>{t}</span></button>; })}</div>
      {err && <div role="alert" style={{ color: "#B4233B", fontSize: 14, marginBottom: 8 }}>{err}</div>}
      {ok && <div role="status" style={{ color: "#16704A", fontSize: 14, marginBottom: 8 }}>{ok}</div>}
      <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ textAlign: "left", color: muted }}><th style={{ padding: "4px 14px 6px 0", fontWeight: 500 }}>{cur}</th><th style={{ padding: "4px 14px 6px 0", fontWeight: 500 }}>Monthly</th><th style={{ padding: "4px 14px 6px 0", fontWeight: 500 }}>Yearly</th></tr></thead>
        <tbody>
          {PLAN_ROWS.map(([id, name]) => row(name, `plan:${id}:monthly`, `plan:${id}:yearly`))}
          {row("Extra branch", "branch:monthly", "branch:yearly")}
          <tr><td colSpan={3} style={{ padding: "12px 0 4px", color: muted, fontSize: 13 }}>Extra orders (one-time packs)</td></tr>
          {row("50 orders", "topup:orders50")}
          {row("200 orders", "topup:orders200")}
        </tbody></table></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 14 }}>
        <label style={{ fontSize: 14 }}>Starts on <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: 150, marginInlineStart: 6 }} /></label>
        <button type="button" disabled={busy || !filled.length} onClick={() => save("DRAFT")} style={{ ...btnSm, background: "#fff" }}>Save draft</button>
        <button type="button" disabled={busy || !allFilled} onClick={() => save("ACTIVE")} style={{ ...btnSm, border: 0, color: "#fff", background: grad, opacity: busy || !allFilled ? 0.5 : 1 }}>Make active</button>
        {!allFilled && <span style={{ fontSize: 13, color: muted }}>{filled.length} of {items.length} prices filled</span>}
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${line}`, display: "grid", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Ready to sell in {country[1]}?</div>
        {check(liveCount === items.length, `All ${items.length} prices are active (${liveCount} now)`)}
        {check(curOn, curOn ? `${cur} payments are enabled on the payment account` : `${cur} payments are not enabled on the payment account yet (enabled now: ${d.enabledCurrencies.join(", ")}). This is a server setting; ask me to enable it after checking ${cur} on Stripe.`)}
        {check(!!mk?.paidActivationEnabled, mk?.paidActivationEnabled ? "“Paid plans” is switched on for this market" : "Switch on “Paid plans” for this market in Markets")}
        <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Terminals are not priced here yet: they are sold only in the UAE for now.</div>
      </div>
    </section>
  );
}
const btnSm: React.CSSProperties = { height: 34, padding: "0 14px", borderRadius: 10, border: "1px solid #ECD9E0", fontWeight: 600, fontSize: 13, cursor: "pointer" };

function Analytics() {
  const [days, setDays] = React.useState(30), [data, setData] = React.useState<any>(null), [err, setErr] = React.useState(""), [gccOnly, setGccOnly] = React.useState(false);
  React.useEffect(() => {
    let live = true; setData(null); setErr("");
    fetch(`/api/superadmin/analytics?days=${days}`, { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not load."); if (live) setData(j.data ?? j); }).catch(e => live && setErr(e.message));
    return () => { live = false; };
  }, [days]);
  const countries = data ? (gccOnly ? data.countries.filter((c: any) => c.gcc) : data.countries) : [];
  return (
    <div>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between", marginBottom: 22 }}>
        <div><div style={{ fontSize: 13, fontWeight: 600, color: "#C0284F" }}>Super admin</div><h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", margin: "2px 0 0" }}>Landing page analytics</h1></div>
        <div role="tablist" style={{ display: "flex", gap: 6 }}>{[7, 30, 90].map(d => <button key={d} type="button" role="tab" aria-selected={days === d} onClick={() => setDays(d)} style={{ height: 36, padding: "0 14px", borderRadius: 10, border: `1.5px solid ${days === d ? "#C93DFF" : "#ECD9E0"}`, background: days === d ? "#FBF3F8" : "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Last {d} days</button>)}</div>
      </header>
      {err && <div role="alert" style={{ ...card, color: "#B4233B" }}>{err}</div>}
      {!data && !err && <div style={{ color: muted }}>Loading…</div>}
      {data && <>
        <p style={{ color: muted, fontSize: 13, margin: "0 0 14px" }}>Visitors are counted per day (an anonymous code that changes daily; no cookies, no IP kept). {data.totals.visitors === 0 && "No visits recorded yet: events appear after the landing page is deployed with tracking."}</p>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <Kpi label="Visitors" value={num(data.totals.visitors)} sub={`${num(data.totals.pageViews)} page views`} />
          <Kpi label="Viewed plans" value={num(data.totals.plansViewers)} sub={`${data.funnel[1].pct}% of visitors`} />
          <Kpi label="Free-trial clicks" value={num(data.totals.freeTrialClicks)} sub={`${num(data.totals.freeTrialVisitors)} visitors`} />
          <Kpi label="Sign-up clicks" value={num(data.totals.signupClicks)} sub={`${num(data.totals.signupVisitors)} visitors`} />
          <Kpi label="Accounts created" value={num(data.accounts.created)} sub={`${num(data.accounts.restaurants)} restaurants · ${num(data.accounts.paid)} paid`} />
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12, marginTop: 12 }}>
          <div style={card}><h2 style={h2}>Funnel</h2>
            {[...data.funnel, { step: "Accounts created", count: data.accounts.created, pct: data.totals.visitors ? Math.round((data.accounts.created / data.totals.visitors) * 1000) / 10 : 0 }].map((f: any) => (
              <div key={f.step} style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{f.step}</span><span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{num(f.count)} <span style={{ color: muted, fontWeight: 400 }}>· {f.pct}%</span></span></div><div style={{ height: 8, borderRadius: 4, background: "#F6ECF1", marginTop: 4 }}><div style={{ height: 8, borderRadius: 4, width: `${Math.min(100, f.pct)}%`, background: grad }} /></div></div>
            ))}
          </div>
          <div style={card}><h2 style={h2}>Visitors per day</h2><Bars rows={data.daily} /><div style={{ fontSize: 12, color: muted, marginTop: 6 }}><span style={{ color: "#E9B8D0" }}>■</span> visitors <span style={{ color: "#C93DFF", marginInlineStart: 10 }}>■</span> sign-up and free-trial clicks</div></div>
        </section>
        <section style={{ ...card, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}><h2 style={{ ...h2, margin: 0 }}>Countries</h2>
            <label style={{ fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={gccOnly} onChange={e => setGccOnly(e.target.checked)} /> GCC only</label></div>
          <div style={{ fontSize: 13, color: muted, margin: "6px 0 12px" }}>GCC total: {num(data.gcc.visitors)} visitors · {num(data.gcc.plans)} viewed plans · {num(data.gcc.freeTrial)} free-trial · {num(data.gcc.signup)} sign-up</div>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><thead><tr style={{ textAlign: "left", color: muted }}>{["Country", "Visitors", "Viewed plans", "Free trial", "Sign up"].map(h => <th key={h} style={{ padding: "6px 10px 8px 0", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>{countries.map((c: any) => <tr key={c.country} style={{ borderTop: `1px solid ${line}` }}><td style={{ padding: "8px 10px 8px 0", whiteSpace: "nowrap" }}>{flag(c.country)} {c.name} {c.gcc && <span style={{ fontSize: 11, fontWeight: 600, background: "#E4F4EC", color: "#16704A", borderRadius: 999, padding: "1px 7px", marginInlineStart: 4 }}>GCC</span>}</td>{[c.visitors, c.plans, c.freeTrial, c.signup].map((n, i) => <td key={i} style={{ padding: "8px 10px 8px 0", fontVariantNumeric: "tabular-nums" }}>{num(n)}</td>)}</tr>)}
              {!countries.length && <tr><td colSpan={5} style={{ padding: "12px 0", color: muted }}>No data yet.</td></tr>}</tbody></table></div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginTop: 12 }}>
          <div style={card}><h2 style={h2}>Where people click</h2>{data.locations.length ? data.locations.map((l: any) => <div key={l.kind + l.where} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", borderTop: `1px solid ${line}` }}><span>{KIND[l.kind] ?? l.kind} · {l.where}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{num(l.clicks)}</b></div>) : <span style={{ color: muted, fontSize: 14 }}>No clicks yet.</span>}</div>
          <div style={card}><h2 style={h2}>Where visitors come from</h2>{data.sources.length ? data.sources.map((s: any) => <div key={s.source} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", borderTop: `1px solid ${line}` }}><span>{s.source}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{num(s.visitors)}</b></div>) : <span style={{ color: muted, fontSize: 14 }}>No visits yet.</span>}</div>
          <div style={card}><h2 style={h2}>New accounts by phone country</h2>{data.accounts.byCountry.length ? data.accounts.byCountry.map((s: any) => <div key={s.country} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", borderTop: `1px solid ${line}` }}><span>{flag(s.country)} {s.name}</span><b>{num(s.count)}</b></div>) : <span style={{ color: muted, fontSize: 14 }}>No accounts in this period.</span>}
            <div style={{ fontSize: 12, color: muted, marginTop: 10 }}>Devices: {data.devices.map((d: any) => `${d.device} ${num(d.visitors)}`).join(" · ") || "none yet"}</div></div>
        </section>
      </>}
    </div>
  );
}

const NAV: [string, string, () => React.ReactElement][] = [
  ["analytics", "Analytics", () => <Analytics />], ["prices", "Plan prices", () => <Prices />], ["markets", "Markets", () => <Markets />], ["tax", "Tax and VAT", () => <Tax />],
];
export default function SuperAdminDashboard() {
  const [tab, setTab] = React.useState("analytics");
  React.useEffect(() => { const read = () => { const h = window.location.hash.slice(1); if (NAV.some(n => n[0] === h)) setTab(h); }; read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read); }, []);
  const go = (id: string) => { setTab(id); try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ } };
  const Body = (NAV.find(n => n[0] === tab) ?? NAV[0])[2];
  return (
    <div className="sa-shell" style={{ minHeight: "100vh", background: "#FBF7F9", color: ink, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
      <style>{`.sa-shell{display:flex}.sa-side{width:230px;flex:none;background:#fff;border-inline-end:1px solid ${line};padding:22px 14px;position:sticky;top:0;height:100vh;box-sizing:border-box}.sa-main{flex:1;min-width:0;padding:28px clamp(16px,3vw,36px) 60px;max-width:1200px}.sa-nav{display:flex;flex-direction:column;gap:4px;margin-top:18px}.sa-nav button{text-align:start;border:0;background:none;height:40px;padding:0 12px;border-radius:10px;font:inherit;font-size:15px;color:${ink};cursor:pointer}.sa-nav button[aria-current=page]{background:#FBF1FF;font-weight:600;color:#7A1FB0}@media(max-width:760px){.sa-shell{display:block}.sa-side{width:auto;height:auto;position:static;border-inline-end:0;border-bottom:1px solid ${line};padding:14px 12px}.sa-nav{flex-direction:row;overflow-x:auto;margin-top:10px}.sa-nav button{white-space:nowrap}}`}</style>
      <aside className="sa-side"><div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>Lumia Order</div><div style={{ fontSize: 13, fontWeight: 600, color: "#C0284F" }}>Super admin</div>
        <nav className="sa-nav" aria-label="Super admin">{NAV.map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>{label}</button>)}</nav></aside>
      <main className="sa-main"><Body /></main>
    </div>
  );
}
