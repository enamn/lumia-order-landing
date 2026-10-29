"use client";
// Customers inside the dashboard: everyone who ordered on WhatsApp, grouped by how they order (regulars, new, gone quiet),
// with their totals, saved addresses and a quick way to send a group an offer. Selection lives in FlowApp because Campaigns uses it.
import React from "react";

export interface CustomerRow { id: string; name: string; phone: string; orders: number; spentMinor: number; lastOrderAt: string | null; optedOut: boolean; addresses: { label: string; text: string; uses: number; isDefault: boolean }[] }
export type Segment = "all" | "regular" | "new" | "away";
type Sort = "recent" | "orders" | "spent";

const INK = "#1A0815", BODY = "#3D1C31", MUTED = "#76566A", LINE = "#EDE5E9", ROSE = "#F0446F", WINE = "#A3153F";
const DAY = 86_400_000, AWAY_DAYS = 30, REGULAR_ORDERS = 3;
const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : Infinity);
// One tag per customer, in the order an owner acts on it: someone who went quiet matters more than how often they used to order.
export const segmentOf = (c: CustomerRow): Exclude<Segment, "all"> | null => daysSince(c.lastOrderAt) > AWAY_DAYS ? "away" : c.orders >= REGULAR_ORDERS ? "regular" : c.orders <= 1 ? "new" : null;
export const TONE: Record<Exclude<Segment, "all">, { bg: string; fg: string }> = { regular: { bg: "#F3E8FF", fg: "#6B2FA8" }, new: { bg: "#E4F4EC", fg: "#16704A" }, away: { bg: "#FFF1DC", fg: "#7A4B00" } };
const AV = ["#FFE6EE", "#EEE6FF", "#FFEFD6", "#E1F3E8", "#E3EEFF"];
const avatarOf = (id: string) => AV[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AV.length]!;
const initials = (n: string) => n.split(/\s+/).filter(w => w && !/^(al|el)$/i.test(w)).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "#";
const prettyPhone = (p: string) => (/^\+971\d{9}$/.test(p) ? `+971 ${p.slice(4, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p);
const num: React.CSSProperties = { direction: "ltr", unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" };

const CSS = `
.cx-row{display:grid;grid-template-columns:44px minmax(0,1fr) 84px 128px 132px 36px;align-items:center}
.cx-head{display:grid;grid-template-columns:44px minmax(0,1fr) 84px 128px 132px 36px;align-items:center}
.cx-cell-m{display:none}
.cx-segs{display:flex;flex-wrap:wrap;gap:8px}
.cx-main:hover{background:#FFF8FB}
.cx-main:focus-visible,.cx-btn:focus-visible,.cx-seg:focus-visible,.cx-ck:focus-visible{outline:2px solid ${ROSE};outline-offset:2px}
.cx-seg:hover{border-color:#DDC8D2}
.cx-btn:hover{background:#F8F1F5}
.cx-skel{background:linear-gradient(90deg,#F4EFF2 0%,#FBF7F9 50%,#F4EFF2 100%);background-size:200% 100%;animation:cx-sh 1.2s ease-in-out infinite;border-radius:8px}
@keyframes cx-sh{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.cx-skel{animation:none}}
@media (max-width:720px){
  .cx-row{grid-template-columns:44px minmax(0,1fr) auto}
  .cx-head{display:none}
  .cx-cell-d{display:none}
  .cx-cell-m{display:flex}
  .cx-segs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
  .cx-segs::-webkit-scrollbar{display:none}
}`;

function Check({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 6, flex: "none", border: `1.5px solid ${disabled ? "#EADDE3" : on ? ROSE : "#D9BFCB"}`, background: disabled ? "#F7F1F4" : on ? ROSE : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s, border-color .15s" }}>
      {on && <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="m4.5 10.5 3.5 3.5 7.5-8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </span>
  );
}

export function CustomersPage(p: { ar: boolean; list: CustomerRow[] | null; error: string; money: (minor: number) => string; selected: string[]; onSelect: (ids: string[]) => void; onSendOffer: (ids?: string[]) => void }) {
  const A = (en: string, ar: string) => (p.ar ? ar : en);
  const [seg, setSeg] = React.useState<Segment>("all"), [sort, setSort] = React.useState<Sort>("recent"), [q, setQ] = React.useState(""), [open, setOpen] = React.useState<string | null>(null), [copied, setCopied] = React.useState("");
  const all = p.list ?? [];
  const counts = { all: all.length, regular: 0, new: 0, away: 0 } as Record<Segment, number>;
  for (const c of all) { const s = segmentOf(c); if (s) counts[s]++; }
  const needle = q.trim().toLowerCase().replace(/\s/g, "");
  const rows = all
    .filter(c => seg === "all" || segmentOf(c) === seg)
    .filter(c => !needle || c.name.toLowerCase().replace(/\s/g, "").includes(needle) || c.phone.replace(/\s/g, "").includes(needle))
    .sort((a, b) => sort === "orders" ? b.orders - a.orders : sort === "spent" ? b.spentMinor - a.spentMinor : (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""));
  const sel = new Set(p.selected);
  const eligible = rows.filter(c => !c.optedOut), allOn = eligible.length > 0 && eligible.every(c => sel.has(c.id));
  const toggle = (id: string) => p.onSelect(sel.has(id) ? p.selected.filter(x => x !== id) : [...p.selected, id]);
  const toggleShown = () => p.onSelect(allOn ? p.selected.filter(id => !eligible.some(c => c.id === id)) : [...new Set([...p.selected, ...eligible.map(c => c.id)])]);
  const when = (iso: string | null) => {
    const d = daysSince(iso); if (d === Infinity) return "—";
    if (d <= 0) return A("Today", "اليوم"); if (d === 1) return A("Yesterday", "أمس");
    if (d < 14) return A(`${d} days ago`, `قبل ${d} أيام`);
    return new Date(iso!).toLocaleDateString(p.ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short", ...(d > 300 ? { year: "numeric" } : {}) });
  };
  const SEG: Record<Segment, [string, string]> = {
    all: [A("All", "الكل"), ""],
    regular: [A("Regulars", "الدائمون"), A(`${REGULAR_ORDERS} or more orders. Thank them, or tell them first about something new.`, `${REGULAR_ORDERS} طلبات أو أكثر. اشكرهم أو أخبرهم أولاً بالجديد.`)],
    new: [A("New", "جدد"), A(`One order so far, in the last ${AWAY_DAYS} days. A small offer can bring them back for a second.`, `طلب واحد حتى الآن خلال آخر ${AWAY_DAYS} يوماً. عرض بسيط قد يعيدهم لطلب ثانٍ.`)],
    away: [A("Gone quiet", "انقطعوا"), A(`No order in over ${AWAY_DAYS} days. Win them back with an offer.`, `لا طلبات منذ أكثر من ${AWAY_DAYS} يوماً. استعدهم بعرض.`)],
  };
  const TAG: Record<Exclude<Segment, "all">, string> = { regular: A("Regular", "دائم"), new: A("New", "جديد"), away: A("Gone quiet", "منقطع") };
  const segIds = rows.filter(c => !c.optedOut).map(c => c.id);
  const copy = (c: CustomerRow) => { navigator.clipboard?.writeText(c.phone).then(() => { setCopied(c.id); setTimeout(() => setCopied(""), 1600); }).catch(() => undefined); };
  const sortBtn = (k: Sort, label: string, align: "start" | "end" = "end") => (
    <button type="button" className="cx-btn" onClick={() => setSort(k)} aria-pressed={sort === k} style={{ justifySelf: align, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: sort === k ? 600 : 500, color: sort === k ? INK : MUTED, padding: "6px 8px", borderRadius: 8, border: 0, background: "none", cursor: "pointer" }}>
      {label}{sort === k && <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 7.5 1.5 3h7z" fill={INK} /></svg>}
    </button>
  );
  const iconBtn: React.CSSProperties = { minHeight: 40, padding: "0 14px", borderRadius: 11, border: "1.5px solid #E6DBE1", background: "#fff", color: INK, fontSize: 14, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", textDecoration: "none" };

  return (
    <div dir={p.ar ? "rtl" : "ltr"} data-screen-label="07 Dashboard · Customers" style={{ display: "flex", flexDirection: "column", gap: 18, color: INK, paddingBottom: p.selected.length ? 88 : 0 }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.035em", margin: 0 }}>{A("Customers", "العملاء")}</h1>
          <p style={{ fontSize: 15, color: BODY, margin: "4px 0 0" }}>{p.list === null ? A("Loading your customers…", "جارٍ تحميل عملائك…") : !all.length ? A("No WhatsApp orders yet", "لا توجد طلبات واتساب بعد") : all.length === 1 ? A("1 customer has ordered from you on WhatsApp", "عميل واحد طلب منك عبر واتساب") : A(`${all.length} customers have ordered from you on WhatsApp`, `${all.length} عميل طلبوا منك عبر واتساب`)}</p>
        </div>
        {all.length > 0 && (
          <label style={{ flex: "1 1 260px", maxWidth: 360, height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderRadius: 12, border: "1.5px solid #DDC8D2", background: "#fff" }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: "none" }}><circle cx="9" cy="9" r="5.5" stroke={MUTED} strokeWidth="1.7" /><path d="m13.2 13.2 3.3 3.3" stroke={MUTED} strokeWidth="1.7" strokeLinecap="round" /></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={A("Search name or number", "ابحث بالاسم أو الرقم")} aria-label={A("Search customers", "ابحث في العملاء")} style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", fontSize: 15, height: "100%", color: INK }} />
          </label>
        )}
      </div>

      {p.error && <div role="alert" style={{ borderRadius: 14, padding: "12px 16px", background: "#FDECEF", color: "#B4233B", fontSize: 14 }}>{p.error}</div>}

      {p.list === null ? (
        <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 1, border: `1px solid ${LINE}`, borderRadius: 18, overflow: "hidden" }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "#fff" }}><span className="cx-skel" style={{ width: 40, height: 40, borderRadius: "50%" }} /><span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}><span className="cx-skel" style={{ width: "38%", height: 12 }} /><span className="cx-skel" style={{ width: "24%", height: 10 }} /></span><span className="cx-skel" style={{ width: 64, height: 12 }} /></div>)}
        </div>
      ) : !all.length ? (
        <div style={{ border: `1px dashed #DDC8D2`, borderRadius: 20, padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
          <span style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFF1F6", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 16.5c.8-2.9 3.2-4.5 6-4.5s5.2 1.6 6 4.5" stroke={WINE} strokeWidth="1.6" strokeLinecap="round" /></svg></span>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: "6px 0 0" }}>{A("Your customers will appear here", "سيظهر عملاؤك هنا")}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: BODY, margin: 0, maxWidth: 420, textWrap: "pretty" }}>{A("Everyone who orders on WhatsApp is added automatically, with their orders, spending and saved addresses.", "كل من يطلب عبر واتساب يُضاف تلقائياً، مع طلباته وما أنفقه وعناوينه المحفوظة.")}</p>
        </div>
      ) : (
        <>
          {/* Groups an owner acts on, with what to do about each */}
          <div className="cx-segs" role="tablist" aria-label={A("Customer groups", "مجموعات العملاء")} >
            {(["all", "regular", "new", "away"] as Segment[]).map(k => {
              const on = seg === k;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} className="cx-seg" onClick={() => { setSeg(k); setOpen(null); }} style={{ flex: "none", height: 40, padding: "0 14px", borderRadius: 999, border: `1.5px solid ${on ? ROSE : "#E6DBE1"}`, background: on ? "#FFF1F6" : "#fff", color: on ? WINE : INK, fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", whiteSpace: "nowrap", transition: "background .15s, color .15s" }}>
                  {k !== "all" && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: TONE[k].fg, boxShadow: "none" }} />}
                  {SEG[k][0]}
                  <span style={{ fontWeight: 500, color: MUTED, ...num }}>{counts[k]}</span>
                </button>
              );
            })}
          </div>
          {seg !== "all" && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, background: TONE[seg].bg }}>
              <span style={{ flex: "1 1 260px", fontSize: 14, lineHeight: 1.5, color: TONE[seg].fg }}>{SEG[seg][1]}</span>
              {segIds.length > 0 && <button type="button" className="cx-btn" onClick={() => { p.onSelect(segIds); p.onSendOffer(segIds); }} style={{ ...iconBtn, borderColor: "transparent", fontWeight: 600, color: TONE[seg].fg }}>{segIds.length === 1 ? A("Send an offer to this customer", "أرسل عرضاً لهذا العميل") : A(`Send an offer to these ${segIds.length}`, `أرسل عرضاً لهؤلاء الـ${segIds.length}`)}</button>}
            </div>
          )}

          <div role="table" aria-label={A("Customers", "العملاء")} style={{ border: `1px solid ${LINE}`, borderRadius: 18, overflow: "hidden", background: "#fff" }}>
            <div role="row" className="cx-head" style={{ minHeight: 44, borderBottom: `1px solid ${LINE}`, background: "#FAF7F9", paddingInlineEnd: 6 }}>
              <button type="button" className="cx-ck" onClick={toggleShown} aria-label={allOn ? A("Clear selection", "إلغاء التحديد") : A("Select all shown", "تحديد الكل")} disabled={!eligible.length} style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "none", cursor: "pointer" }}><Check on={allOn} disabled={!eligible.length} /></button>
              {sortBtn("recent", A("Customer · newest first", "العميل · الأحدث أولاً"), "start")}
              {sortBtn("orders", A("Orders", "الطلبات"))}
              {sortBtn("spent", A("Spent", "المبلغ"))}
              <span role="columnheader" style={{ justifySelf: "end", fontSize: 13, fontWeight: 500, color: MUTED, paddingInline: 8 }}>{A("Last order", "آخر طلب")}</span>
              <span />
            </div>
            {/* phone: the sort lives above the list since the column headers are hidden */}
            <div className="cx-cell-m" style={{ alignItems: "center", gap: 4, padding: "8px 10px", borderBottom: `1px solid ${LINE}`, background: "#FAF7F9", flexWrap: "wrap" }}>
              <button type="button" className="cx-ck" onClick={toggleShown} aria-label={allOn ? A("Clear selection", "إلغاء التحديد") : A("Select all shown", "تحديد الكل")} disabled={!eligible.length} style={{ width: 34, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "none", cursor: "pointer" }}><Check on={allOn} disabled={!eligible.length} /></button>
              <span style={{ fontSize: 13, color: MUTED, marginInlineEnd: "auto" }}>{A("Sort", "ترتيب")}</span>
              {sortBtn("recent", A("Recent", "الأحدث"))}{sortBtn("orders", A("Orders", "الطلبات"))}{sortBtn("spent", A("Spent", "المبلغ"))}
            </div>

            {rows.map((c, i) => {
              const on = sel.has(c.id), isOpen = open === c.id, tag = segmentOf(c), avg = c.orders ? Math.round(c.spentMinor / c.orders) : 0;
              return (
                <div key={c.id} role="rowgroup" style={{ borderTop: i ? `1px solid ${LINE}` : 0, background: on ? "#FFF8FB" : "#fff" }}>
                  <div role="row" className="cx-row" style={{ minHeight: 68, paddingInlineEnd: 6 }}>
                    <button type="button" className="cx-ck" onClick={() => !c.optedOut && toggle(c.id)} disabled={c.optedOut} aria-pressed={on} aria-label={c.optedOut ? A(`${c.name} turned off offers`, `${c.name} أوقف العروض`) : (on ? A("Deselect ", "إلغاء تحديد ") : A("Select ", "تحديد ")) + c.name} title={c.optedOut ? A("This customer turned off offers", "هذا العميل أوقف استلام العروض") : undefined} style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "none", cursor: c.optedOut ? "not-allowed" : "pointer" }}><Check on={on} disabled={c.optedOut} /></button>
                    <button type="button" className="cx-main" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen} style={{ gridColumn: "2 / -1", display: "grid", gridTemplateColumns: "subgrid", alignItems: "center", alignSelf: "stretch", border: 0, background: "none", cursor: "pointer", textAlign: "start", color: INK, padding: 0, borderRadius: 10 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, padding: "12px 8px 12px 4px" }}>
                        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", flex: "none", background: avatarOf(c.id), color: INK, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(c.name)}</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(c.name === c.phone ? num : {}) }}>{c.name === c.phone ? prettyPhone(c.phone) : c.name}</span>
                            {tag && <span className="cx-cell-d" style={{ flex: "none", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: TONE[tag].bg, color: TONE[tag].fg }}>{TAG[tag]}</span>}
                            {c.optedOut && <span style={{ flex: "none", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#F4EFF2", color: "#5E4555" }}>{A("Offers off", "العروض متوقفة")}</span>}
                          </span>
                          {c.name !== c.phone && <span className="cx-cell-d" style={{ fontSize: 14, color: BODY, ...num, textAlign: p.ar ? "right" : "left" }}>{prettyPhone(c.phone)}</span>}
                          <span className="cx-cell-m" style={{ fontSize: 13, color: BODY, gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            {tag && <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[tag].fg }} aria-label={TAG[tag]} />}
                            <span style={num}>{c.orders === 1 ? A("1 order", "طلب واحد") : A(`${c.orders} orders`, `${c.orders} طلبات`)}</span><span aria-hidden="true">·</span><span style={num}>{p.money(c.spentMinor)}</span>
                          </span>
                        </span>
                      </span>
                      <span className="cx-cell-d" style={{ justifySelf: "end", fontSize: 15, fontWeight: 600, paddingInline: 8, ...num }}>{c.orders}</span>
                      <span className="cx-cell-d" style={{ justifySelf: "end", fontSize: 15, fontWeight: 600, paddingInline: 8, ...num }}>{p.money(c.spentMinor)}</span>
                      <span style={{ justifySelf: "end", fontSize: 14, color: daysSince(c.lastOrderAt) > AWAY_DAYS ? "#7A4B00" : BODY, paddingInline: 8, whiteSpace: "nowrap" }}>{when(c.lastOrderAt)}</span>
                      <svg className="cx-cell-d" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ justifySelf: "center", transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: "transform .15s" }}><path d="m4 6 4 4 4-4" stroke={MUTED} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: "4px 18px 18px", paddingInlineStart: 60, display: "flex", flexDirection: "column", gap: 16 }}>
                      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
                        {[[A("Orders", "الطلبات"), String(c.orders)], [A("Spent", "المبلغ"), p.money(c.spentMinor)], [A("Average order", "متوسط الطلب"), c.orders ? p.money(avg) : "—"], [A("Last order", "آخر طلب"), c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString(p.ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"]].map(([k, v]) => (
                          <div key={k} style={{ background: "#FAF7F9", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}><dt style={{ fontSize: 12, color: MUTED }}>{k}</dt><dd style={{ margin: 0, fontSize: 16, fontWeight: 600, ...num, textAlign: p.ar ? "right" : "left" }}>{v}</dd></div>
                        ))}
                      </dl>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <a href={`tel:${c.phone}`} className="cx-btn" style={iconBtn}><svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.5 3.5h2.2l1.2 3.4-1.6 1.1a8.8 8.8 0 0 0 4.7 4.7l1.1-1.6 3.4 1.2v2.2a1.6 1.6 0 0 1-1.7 1.6A12.6 12.6 0 0 1 3.9 5.2 1.6 1.6 0 0 1 5.5 3.5z" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" /></svg>{A("Call", "اتصال")}</a>
                        <button type="button" className="cx-btn" onClick={() => copy(c)} style={iconBtn} aria-live="polite"><svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="2" stroke={INK} strokeWidth="1.5" /><path d="M13 7V5a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 4 5v6.5A1.5 1.5 0 0 0 5.5 13H7" stroke={INK} strokeWidth="1.5" /></svg>{copied === c.id ? A("Copied", "تم النسخ") : A("Copy number", "نسخ الرقم")}</button>
                        {!c.optedOut ? <button type="button" className="cx-btn" onClick={() => { p.onSelect([c.id]); p.onSendOffer([c.id]); }} style={{ ...iconBtn, borderColor: "#F3B8CB", color: WINE, fontWeight: 600 }}>{A("Send an offer", "أرسل عرضاً")}</button>
                          : <span style={{ alignSelf: "center", fontSize: 13, color: MUTED }}>{A("Turned off offers (replied STOP)", "أوقف العروض (أرسل إيقاف)")}</span>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{A("Saved addresses", "العناوين المحفوظة")}</h3>
                        {c.addresses.length ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 8 }}>
                            {c.addresses.map((a, j) => (
                              <div key={j} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>{a.label}{(a.isDefault || (j === 0 && !c.addresses.some(x => x.isDefault))) && <span style={{ fontSize: 12, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "#FFF1F6", color: WINE }}>{A("Default", "الافتراضي")}</span>}</span>
                                <span style={{ fontSize: 14, lineHeight: 1.45, color: BODY, textWrap: "pretty" }}>{a.text}</span>
                                <span style={{ fontSize: 13, color: MUTED }}>{a.uses ? (a.uses === 1 ? A("Used for 1 order", "استُخدم لطلب واحد") : A(`Used for ${a.uses} orders`, `استُخدم لـ${a.uses} طلبات`)) : A("Not used yet", "لم يُستخدم بعد")}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>{A("No saved addresses. This customer picks up, or hasn't shared a location yet.", "لا عناوين محفوظة. العميل يستلم بنفسه أو لم يشارك موقعه بعد.")}</p>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!rows.length && <p style={{ padding: "36px 20px", textAlign: "center", fontSize: 15, color: MUTED, margin: 0 }}>{needle ? A("No customers match your search.", "لا يوجد عملاء مطابقون لبحثك.") : A("No customers in this group right now.", "لا يوجد عملاء في هذه المجموعة حالياً.")}</p>}
          </div>
        </>
      )}

      {/* Selection: one bar, pinned to the bottom so it's reachable on a phone */}
      {p.selected.length > 0 && (
        <div role="region" aria-label={A("Selected customers", "العملاء المحددون")} style={{ position: "sticky", bottom: 16, zIndex: 5, alignSelf: "center", width: "min(100%, 560px)", display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", paddingInlineStart: 18, borderRadius: 16, background: "#fff", color: INK, border: `1px solid ${LINE}`, boxShadow: "0 18px 40px -22px rgba(26,8,21,.4)" }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, ...num, textAlign: p.ar ? "right" : "left" }}>{p.selected.length === 1 ? A("1 selected", "عميل واحد محدد") : A(`${p.selected.length} selected`, `${p.selected.length} محددون`)}</span>
          <button type="button" onClick={() => p.onSelect([])} style={{ height: 40, padding: "0 12px", borderRadius: 10, border: 0, background: "transparent", color: MUTED, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>{A("Clear", "إلغاء")}</button>
          <button type="button" onClick={() => p.onSendOffer()} style={{ height: 42, padding: "0 16px", borderRadius: 11, border: 0, background: "linear-gradient(90deg,#D92B55,#B02BE0)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{A("Send offer", "أرسل عرضاً")}</button>
        </div>
      )}
    </div>
  );
}
