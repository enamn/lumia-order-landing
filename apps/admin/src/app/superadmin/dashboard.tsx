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
    <section style={{ ...card, marginTop: 12 }}>
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
function Prices() {
  const [d, setD] = React.useState<any>(null), [err, setErr] = React.useState(""), [busy, setBusy] = React.useState(false);
  const load = () => fetch("/api/superadmin/prices", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not load."); setD(j.data ?? j); }).catch(e => setErr(e.message));
  React.useEffect(() => { load(); }, []);
  const add = async () => {
    const country = (window.prompt("Country code (SA, OM, BH, QA or KW)") ?? "").toUpperCase(); if (!country) return;
    const item = window.prompt(`Item, one of:\n${d.items.join("\n")}`) ?? ""; if (!item) return;
    const amount = Number(window.prompt("Price in the country's currency, before any tax (for example 299 or 24.900)") ?? ""); if (!(amount > 0)) return;
    const status = (window.prompt("DRAFT (saved, not used) or ACTIVE (used from the start date)", "DRAFT") ?? "").toUpperCase(); if (status !== "DRAFT" && status !== "ACTIVE") return;
    const from = window.prompt("Start date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10)) ?? ""; if (!from) return;
    setBusy(true); setErr("");
    try { const r = await fetch("/api/superadmin/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country, item, amount, status, effectiveFrom: new Date(from + "T00:00:00+04:00").toISOString(), version: `${from}` }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not save."); await load(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <section style={{ ...card, marginTop: 12 }}>
      <h2 style={h2}>Market prices</h2>
      <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>The UAE price list is fixed in the product. Every other country needs all {d?.items.length ?? 10} prices (plans, extra branch, extra orders) approved here, and its currency enabled on the payment account (now: {d ? d.enabledCurrencies.join(", ") : "…"}), before paid plans can open.</div>
      {err && <div role="alert" style={{ color: "#B4233B", fontSize: 14, marginBottom: 8 }}>{err}</div>}
      <button type="button" disabled={busy || !d} onClick={add} style={{ ...btnSm, background: "#fff", marginBottom: 10 }}>Add a price</button>
      {d && <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ textAlign: "left", color: muted }}>{["Country", "Item", "Amount", "Status", "From"].map(h => <th key={h} style={{ padding: "4px 10px 6px 0", fontWeight: 500 }}>{h}</th>)}</tr></thead>
        <tbody>{d.prices.map((p: any) => <tr key={p.id} style={{ borderTop: `1px solid ${line}` }}><td style={{ padding: "5px 10px 5px 0" }}>{p.country}</td><td style={{ padding: "5px 10px 5px 0" }}>{p.item}</td><td style={{ padding: "5px 10px 5px 0" }}>{p.currency} {(p.amountMinor / (["OMR", "BHD", "KWD"].includes(p.currency) ? 1000 : 100)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td><td style={{ padding: "5px 10px 5px 0" }}>{p.status}</td><td style={{ padding: "5px 10px 5px 0" }}>{new Date(p.effectiveFrom).toLocaleDateString("en-GB")}</td></tr>)}
          {!d.prices.length && <tr><td colSpan={5} style={{ padding: "8px 0", color: muted }}>No prices entered yet.</td></tr>}</tbody></table></div>}
    </section>
  );
}
const btnSm: React.CSSProperties = { height: 34, padding: "0 14px", borderRadius: 10, border: "1px solid #ECD9E0", fontWeight: 600, fontSize: 13, cursor: "pointer" };

export default function SuperAdminDashboard() {
  const [days, setDays] = React.useState(30), [data, setData] = React.useState<any>(null), [err, setErr] = React.useState(""), [gccOnly, setGccOnly] = React.useState(false);
  React.useEffect(() => {
    let live = true; setData(null); setErr("");
    fetch(`/api/superadmin/analytics?days=${days}`, { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? "Could not load."); if (live) setData(j.data ?? j); }).catch(e => live && setErr(e.message));
    return () => { live = false; };
  }, [days]);
  const countries = data ? (gccOnly ? data.countries.filter((c: any) => c.gcc) : data.countries) : [];
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 18px 60px", color: ink, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
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
      <Markets />
      <Tax />
      <Prices />
    </main>
  );
}
