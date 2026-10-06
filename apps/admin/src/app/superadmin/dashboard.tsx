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
    </main>
  );
}
