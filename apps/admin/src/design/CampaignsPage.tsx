"use client";
// Campaigns inside the dashboard: pick who gets it, add a discount code if you want, write the message, see exactly what lands
// in the customer's WhatsApp, then send. Below it, how each past offer did (sent, read, code used).
import React from "react";
import { segmentOf, TONE, type CustomerRow } from "./CustomersPage";

export interface CampaignRow { id: string; title: string; mode: "all" | "offer"; recipients: number; hasImage: boolean; sent: number; read: number; used: number; failed?: number; status?: string; createdAt: string }
export interface SendInput { mode: "all" | "offer"; customerIds: string[]; message: string; code?: { code: string; percent: number; days: number }; image?: File }
type Audience = "all" | "regular" | "new" | "away" | "picked";

const INK = "#1A0815", BODY = "#3D1C31", MUTED = "#8A5A6E", LINE = "#F0E4E8", ROSE = "#FF5577", WINE = "#8A2040";
const PERCENTS = [10, 15, 20, 25], DAYS = [7, 14, 30], MAX = 600;
const num: React.CSSProperties = { direction: "ltr", unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" };
const firstName = (c: CustomerRow | undefined, ar: boolean) => (c && c.name !== c.phone ? c.name.split(/\s+/)[0]! : ar ? "عزيزي العميل" : "there");

const CSS = `
.cp-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
.cp-aside{position:sticky;top:16px}
.cp-chip:hover{border-color:#E3CBD4}
.cp-chip:focus-visible,.cp-btn:focus-visible,.cp-aud:focus-visible{outline:2px solid ${ROSE};outline-offset:2px}
.cp-aud:hover{border-color:#E3CBD4}
.cp-ta:focus,.cp-in:focus{border-color:${ROSE};outline:none;box-shadow:0 0 0 3px rgba(255,85,119,.14)}
@media (max-width:980px){.cp-grid{grid-template-columns:minmax(0,1fr)}.cp-aside{position:static}}
`;

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 0", borderTop: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: INK, color: "#fff", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", transform: "translateY(-2px)", ...num }}>{n}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 }}>{title}</h2>
          {hint && <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.45 }}>{hint}</p>}
        </div>
      </div>
      <div style={{ paddingInlineStart: 36, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </section>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className="cp-chip" aria-pressed={on} onClick={onClick} style={{ height: 40, minWidth: 56, padding: "0 14px", borderRadius: 11, border: `1.5px solid ${on ? ROSE : "#ECD9E0"}`, background: on ? "#FDEAF2" : "#fff", color: on ? WINE : BODY, fontSize: 14, fontWeight: on ? 600 : 500, cursor: "pointer", ...num }}>{children}</button>;
}

export function CampaignsPage(p: {
  ar: boolean; customers: CustomerRow[] | null; selected: string[]; onSelect: (ids: string[]) => void; history: CampaignRow[] | null; usage: { used: number; limit: number } | null;
  businessName: string; defaults: { all: string; offer: string }; waConnected: boolean; onConnect: () => void; onCustomers: () => void; onSend: (input: SendInput) => Promise<CampaignRow>;
}) {
  const A = (en: string, ar: string) => (p.ar ? ar : en);
  const all = p.customers ?? [], eligible = all.filter(c => !c.optedOut);
  const [aud, setAud] = React.useState<Audience>(p.selected.length ? "picked" : "all");
  const [withCode, setWithCode] = React.useState(true), [pct, setPct] = React.useState(20), [days, setDays] = React.useState(7), [code, setCode] = React.useState("SAVE20"), [codeTouched, setCodeTouched] = React.useState(false);
  const [msg, setMsg] = React.useState(p.selected.length ? p.defaults.offer : p.defaults.all), [msgTouched, setMsgTouched] = React.useState(false);
  const [img, setImg] = React.useState<{ file: File; url: string } | null>(null);
  const [q, setQ] = React.useState(""), [confirm, setConfirm] = React.useState(false), [busy, setBusy] = React.useState(false), [err, setErr] = React.useState(""), [done, setDone] = React.useState("");
  const ta = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);
  React.useEffect(() => { if (!msgTouched) setMsg(p.defaults.all); }, [p.defaults.all, msgTouched]);

  const groups: Record<Exclude<Audience, "picked">, CustomerRow[]> = { all: eligible, regular: eligible.filter(c => segmentOf(c) === "regular"), new: eligible.filter(c => segmentOf(c) === "new"), away: eligible.filter(c => segmentOf(c) === "away") };
  const sel = new Set(p.selected);
  const recips = aud === "picked" ? eligible.filter(c => sel.has(c.id)) : groups[aud];
  const n = recips.length;
  const left = p.usage ? Math.max(0, p.usage.limit - p.usage.used) : null;
  const codeOk = !withCode || code.trim().length >= 3;
  const over = left !== null && n > left;
  const blocked = !p.waConnected || !n || !msg.trim() || msg.length > MAX || !codeOk || over || busy;
  const until = new Date(Date.now() + days * 86_400_000).toLocaleDateString(p.ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short" });
  const offerText = withCode && codeOk ? A(`Code ${code}: ${pct}% off, valid until ${until}.`, `الكود ${code}: خصم ${pct}%، صالح حتى ${until}.`) : A("Reply to this message to order.", "رد على هذه الرسالة للطلب.");
  const AUD: [Audience, string, string, number][] = [
    ["all", A("All customers", "كل العملاء"), A("Everyone who ordered", "كل من طلب منك"), groups.all.length],
    ["regular", A("Regulars", "الدائمون"), A("3+ orders", "3 طلبات أو أكثر"), groups.regular.length],
    ["new", A("New", "جدد"), A("1 order, last 30 days", "طلب واحد خلال 30 يوماً"), groups.new.length],
    ["away", A("Gone quiet", "انقطعوا"), A("No order in 30+ days", "لا طلبات منذ 30+ يوماً"), groups.away.length],
    ["picked", A("Choose customers", "اختر العملاء"), A("Pick them one by one", "اخترهم واحداً واحداً"), sel.size],
  ];
  const STARTERS: [string, string, boolean][] = [
    [A("Weekend deal", "عرض نهاية الأسبوع"), A(`Hi {name}, this weekend only at ${p.businessName}: a little something off your order. Reply here to order.`, `أهلاً {name}، هذا الأسبوع فقط في ${p.businessName}: خصم على طلبك. رد هنا للطلب.`), true],
    [A("We miss you", "اشتقنا لك"), A(`Hi {name}, it's been a while! Here's a treat to welcome you back to ${p.businessName}.`, `أهلاً {name}، اشتقنا لك! هذه هدية صغيرة لعودتك إلى ${p.businessName}.`), true],
    [A("Thank you", "شكراً لك"), A(`Hi {name}, thank you for ordering with ${p.businessName}. Here's a discount on your next order.`, `أهلاً {name}، شكراً لطلبك من ${p.businessName}. هذا خصم على طلبك القادم.`), true],
    [A("Something new", "جديدنا"), A(`Hi {name}, something new just landed on our menu at ${p.businessName}. Reply here to try it.`, `أهلاً {name}، أضفنا صنفاً جديداً إلى قائمة ${p.businessName}. رد هنا لتجربته.`), false],
  ];
  const insertName = () => {
    const el = ta.current; const at = el ? el.selectionStart : msg.length; const next = msg.slice(0, at) + "{name}" + msg.slice(el ? el.selectionEnd : at);
    setMsg(next); setMsgTouched(true); requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + 6, at + 6); });
  };
  const pickImg = (f?: File) => {
    if (!f) return; if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setErr(A("Use a JPG, PNG or WebP image.", "استخدم صورة JPG أو PNG أو WebP."));
    if (f.size > 5 * 1048576) return setErr(A("Use an image under 5 MB.", "استخدم صورة أقل من 5 ميغابايت."));
    if (img) URL.revokeObjectURL(img.url); setImg({ file: f, url: URL.createObjectURL(f) }); setErr("");
  };
  const send = async () => {
    setBusy(true); setErr("");
    try {
      const row = await p.onSend({ mode: aud === "all" ? "all" : "offer", customerIds: aud === "all" ? [] : recips.map(c => c.id), message: msg.trim(), ...(withCode ? { code: { code, percent: pct, days } } : {}), ...(img ? { image: img.file } : {}) });
      setDone(row.sent === 1 ? A("Sent to 1 customer", "أُرسل إلى عميل واحد") : A(`Sent to ${row.sent} customers`, `أُرسل إلى ${row.sent} عميل`)); setConfirm(false);
      if (aud === "picked") { p.onSelect([]); setAud("all"); }
      setTimeout(() => setDone(""), 4000);
    } catch (e: any) { setErr(e.message); setConfirm(false); } finally { setBusy(false); }
  };
  const list = eligible.filter(c => { const t = q.trim().toLowerCase().replace(/\s/g, ""); return !t || c.name.toLowerCase().replace(/\s/g, "").includes(t) || c.phone.includes(t); });
  // Offer titles are stored as "20% off · CODE"; shown in the dashboard language.
  const titleOf = (t: string) => { const m = /^(\d+)% off · (.+)$/.exec(t); return m ? A(`${m[1]}% off · ${m[2]}`, `خصم ${m[1]}% · ${m[2]}`) : t; };
  const when = (iso: string) => new Date(iso).toLocaleDateString(p.ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short" });
  const btn: React.CSSProperties = { minHeight: 40, padding: "0 14px", borderRadius: 11, border: "1.5px solid #ECD9E0", background: "#fff", color: INK, fontSize: 14, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 };
  const sw = (on: boolean) => <span aria-hidden="true" style={{ width: 42, height: 24, borderRadius: 999, background: on ? ROSE : "#D9BFCB", position: "relative", flex: "none", transition: "background .15s" }}><span style={{ position: "absolute", top: 3, insetInlineStart: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s", boxShadow: "0 1px 2px rgba(26,8,21,.25)" }} /></span>;

  // ---- the message as the customer sees it
  const preview = (
    <div style={{ borderRadius: 28, background: INK, padding: 8, boxShadow: "0 30px 60px -30px rgba(26,8,21,.45)" }}>
      <div style={{ borderRadius: 22, overflow: "hidden", background: "#EFE7DE" }}>
        <div style={{ background: "#075E54", color: "#fff", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{p.businessName.slice(0, 1).toUpperCase()}</span>
          <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 14, fontWeight: 600 }}>{p.businessName}</span><span style={{ fontSize: 11, opacity: 0.8 }}>{A("Business account", "حساب تجاري")}</span></span>
        </div>
        <div dir={/[؀-ۿ]/.test(msg) ? "rtl" : "ltr"} style={{ padding: "16px 12px 18px", minHeight: 260, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ maxWidth: "88%", background: "#fff", borderRadius: 10, borderStartStartRadius: 2, padding: 4, boxShadow: "0 1px 1px rgba(0,0,0,.08)" }}>
            {img && <img src={img.url} alt="" style={{ display: "block", width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 7 }} />}
            <div style={{ padding: "6px 8px 4px", display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.4, color: "#111B21", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              <span>{msg.trim() ? msg.replace(/\{name\}/g, firstName(recips[0], p.ar)) : <span style={{ color: "#8696A0" }}>{A("Your message appears here", "ستظهر رسالتك هنا")}</span>}</span>
              <span style={{ fontWeight: 600 }}>{offerText}</span>
              <span style={{ fontSize: 12, color: "#667781" }}>{p.businessName}</span>
            </div>
            <span style={{ display: "block", textAlign: "end", fontSize: 11, color: "#667781", padding: "0 8px 2px", ...num }}>12:30</span>
          </div>
        </div>
      </div>
      <p style={{ color: "rgba(255,255,255,.7)", fontSize: 12, textAlign: "center", margin: "8px 0 4px" }}>{recips[0] && recips[0].name !== recips[0].phone ? A(`As ${firstName(recips[0], false)} will see it`, `كما سيراها ${firstName(recips[0], true)}`) : A("As your customers will see it", "كما سيراها عملاؤك")}</p>
    </div>
  );

  return (
    <div dir={p.ar ? "rtl" : "ltr"} data-screen-label="08 Dashboard · Campaigns" style={{ display: "flex", flexDirection: "column", gap: 20, color: INK }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.035em", margin: 0 }}>{A("Campaigns", "الحملات")}</h1>
          <p style={{ fontSize: 15, color: BODY, margin: "4px 0 0", maxWidth: 560 }}>{A("Send an offer to your customers on WhatsApp. Each customer gets it in their chat with you.", "أرسل عرضاً لعملائك على واتساب. يصل لكل عميل في محادثته معك.")}</p>
        </div>
        {p.usage && p.usage.limit > 0 && (
          <div style={{ minWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: MUTED, ...num, textAlign: p.ar ? "left" : "right" }}>{A(`${left} of ${p.usage.limit} offer messages left this month`, `متبقٍ ${left} من ${p.usage.limit} رسالة عروض هذا الشهر`)}</span>
            <span aria-hidden="true" style={{ height: 6, borderRadius: 999, background: "#F3EEF1", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.min(100, (p.usage.used / p.usage.limit) * 100)}%`, background: left === 0 ? "#B4233B" : ROSE }} /></span>
          </div>
        )}
      </div>

      {!p.waConnected && (
        <div role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 16, background: "#FDECEF", color: "#B4233B" }}>
          <span style={{ flex: "1 1 240px", fontSize: 14, lineHeight: 1.5 }}>{A("Link a WhatsApp number before sending offers. They go out from your number.", "اربط رقم واتساب قبل إرسال العروض، فهي تُرسل من رقمك.")}</span>
          <button type="button" className="cp-btn" onClick={p.onConnect} style={{ ...btn, borderColor: "#F3B8CB", color: "#B4233B", fontWeight: 600 }}>{A("Link WhatsApp", "ربط واتساب")}</button>
        </div>
      )}

      {p.customers !== null && !all.length ? (
        <div style={{ border: "1px dashed #E3CBD4", borderRadius: 20, padding: "36px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>{A("No one to send to yet", "لا يوجد عملاء بعد")}</h2>
          <p style={{ fontSize: 15, color: BODY, margin: 0, maxWidth: 420, lineHeight: 1.55 }}>{A("Offers go to customers who ordered from you on WhatsApp. Once your first orders come in, you can send them offers here.", "تُرسل العروض لمن طلب منك عبر واتساب. بعد وصول أول الطلبات يمكنك إرسال العروض من هنا.")}</p>
        </div>
      ) : (
        <div className="cp-grid">
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Section n={1} title={A("Who gets it", "لمن ترسل")} hint={all.length > eligible.length ? A(`${all.length - eligible.length} customer${all.length - eligible.length === 1 ? "" : "s"} turned off offers and won't get it.`, `${all.length - eligible.length} من العملاء أوقفوا العروض ولن تصلهم.`) : undefined}>
              <div role="radiogroup" aria-label={A("Who gets it", "لمن ترسل")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))", gap: 8 }}>
                {AUD.map(([k, label, sub, count]) => {
                  const on = aud === k, tone = k !== "all" && k !== "picked" ? TONE[k] : null;
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on} className="cp-aud" onClick={() => { setAud(k); setConfirm(false); }} style={{ textAlign: "start", padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${on ? ROSE : "#ECD9E0"}`, background: on ? "#FFF7FA" : "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, color: INK, minHeight: 84 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600 }}>{tone && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tone.fg }} />}{label}</span>
                      <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.35 }}>{sub}</span>
                      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", marginTop: "auto", ...num, textAlign: p.ar ? "right" : "left" }}>{p.customers === null ? "…" : count}</span>
                    </button>
                  );
                })}
              </div>
              {aud === "picked" && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${LINE}`, background: "#FBF8F9" }}>
                    <input className="cp-in" value={q} onChange={e => setQ(e.target.value)} placeholder={A("Search name or number", "ابحث بالاسم أو الرقم")} aria-label={A("Search customers", "ابحث في العملاء")} style={{ flex: 1, minWidth: 0, height: 38, border: "1.5px solid #E3CBD4", borderRadius: 10, padding: "0 12px", fontSize: 15, background: "#fff" }} />
                    <button type="button" className="cp-btn" onClick={() => p.onSelect(sel.size === eligible.length ? [] : eligible.map(c => c.id))} style={{ ...btn, border: 0, background: "none", color: WINE, fontWeight: 600, padding: "0 6px" }}>{sel.size === eligible.length && eligible.length ? A("Clear all", "إلغاء الكل") : A("Select all", "تحديد الكل")}</button>
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    {list.map(c => {
                      const on = sel.has(c.id);
                      return (
                        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: `1px solid #F6EEF2`, cursor: "pointer", background: on ? "#FFF7FA" : "#fff", minHeight: 52 }}>
                          <input type="checkbox" checked={on} onChange={() => p.onSelect(on ? p.selected.filter(x => x !== c.id) : [...p.selected, c.id])} style={{ width: 18, height: 18, accentColor: ROSE, flex: "none" }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(c.name === c.phone ? num : {}) }}>{c.name}</span>
                          <span style={{ fontSize: 13, color: MUTED, ...num }}>{c.orders === 1 ? A("1 order", "طلب واحد") : A(`${c.orders} orders`, `${c.orders} طلبات`)}</span>
                        </label>
                      );
                    })}
                    {!list.length && <p style={{ margin: 0, padding: 20, textAlign: "center", fontSize: 14, color: MUTED }}>{A("No customers match.", "لا يوجد عملاء مطابقون.")}</p>}
                  </div>
                </div>
              )}
              {!!p.customers && !n && aud !== "picked" && <p style={{ margin: 0, fontSize: 14, color: MUTED }}>{A("No one in this group right now. Pick another group.", "لا يوجد أحد في هذه المجموعة حالياً. اختر مجموعة أخرى.")} <button type="button" onClick={p.onCustomers} style={{ border: 0, background: "none", color: WINE, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>{A("See customers", "عرض العملاء")}</button></p>}
            </Section>

            <Section n={2} title={A("Discount", "الخصم")} hint={A("A code the customer mentions when ordering. Lumia applies it automatically.", "كود يذكره العميل عند الطلب، ويطبقه Lumia تلقائياً.")}>
              <button type="button" role="switch" aria-checked={withCode} onClick={() => setWithCode(!withCode)} className="cp-btn" style={{ display: "flex", alignItems: "center", gap: 12, border: 0, background: "none", padding: 0, cursor: "pointer", fontSize: 15, fontWeight: 500, color: INK, alignSelf: "flex-start", minHeight: 40 }}>{sw(withCode)}{A("Include a discount code", "أضف كود خصم")}</button>
              {withCode && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{A("Discount", "نسبة الخصم")}</span><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{PERCENTS.map(v => <Chip key={v} on={pct === v} onClick={() => { setPct(v); if (!codeTouched) setCode(`SAVE${v}`); }}>{v}%</Chip>)}</div></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{A("Valid for", "صالح لمدة")}</span><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{DAYS.map(v => <Chip key={v} on={days === v} onClick={() => setDays(v)}>{A(`${v} days`, `${v} يوماً`)}</Chip>)}</div></div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{A("Code", "الكود")}</span>
                    <input className="cp-in" value={code} onChange={e => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14)); }} aria-invalid={!codeOk} style={{ height: 46, border: `1.5px solid ${codeOk ? "#E3CBD4" : "#B4233B"}`, borderRadius: 12, padding: "0 14px", fontSize: 16, fontWeight: 600, letterSpacing: "0.06em", ...num, textAlign: p.ar ? "right" : "left" }} />
                    <span style={{ fontSize: 13, color: codeOk ? MUTED : "#B4233B" }}>{codeOk ? A(`Works until ${until}.`, `صالح حتى ${until}.`) : A("Use 3 to 14 letters or numbers.", "استخدم من 3 إلى 14 حرفاً أو رقماً.")}</span>
                  </label>
                </div>
              )}
            </Section>

            <Section n={3} title={A("Message", "الرسالة")} hint={A("Short and friendly works best. {name} becomes each customer's first name.", "الرسالة القصيرة الودودة أفضل. يتحول {name} إلى الاسم الأول لكل عميل.")}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STARTERS.map(([label, text, wantsCode]) => <button key={label} type="button" className="cp-chip" onClick={() => { setMsg(text); setMsgTouched(true); if (wantsCode) setWithCode(true); }} style={{ height: 34, padding: "0 12px", borderRadius: 999, border: "1.5px solid #ECD9E0", background: "#fff", color: BODY, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{label}</button>)}
              </div>
              <div style={{ position: "relative" }}>
                <textarea ref={ta} className="cp-ta" value={msg} onChange={e => { setMsg(e.target.value); setMsgTouched(true); }} rows={5} aria-label={A("Message", "الرسالة")} style={{ width: "100%", resize: "vertical", border: `1.5px solid ${msg.length > MAX ? "#B4233B" : "#E3CBD4"}`, borderRadius: 14, padding: "12px 14px 34px", fontSize: 15, lineHeight: 1.5, fontFamily: "inherit", color: INK, background: "#fff", boxSizing: "border-box" }} />
                <div style={{ position: "absolute", insetInline: 10, bottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "none" }}>
                  <button type="button" onClick={insertName} style={{ pointerEvents: "auto", height: 26, padding: "0 10px", borderRadius: 8, border: 0, background: "#FDEAF2", color: WINE, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ {A("First name", "الاسم الأول")}</button>
                  <span style={{ fontSize: 12, color: msg.length > MAX ? "#B4233B" : MUTED, ...num }}>{msg.length}/{MAX}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {img ? (
                  <>
                    <img src={img.url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: `1px solid ${LINE}` }} />
                    <span style={{ flex: "1 1 160px", minWidth: 0, fontSize: 14, color: BODY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.file.name}</span>
                    <button type="button" className="cp-btn" onClick={() => { URL.revokeObjectURL(img.url); setImg(null); }} style={btn}>{A("Remove image", "إزالة الصورة")}</button>
                  </>
                ) : (
                  <label className="cp-btn" style={{ ...btn, borderStyle: "dashed" }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2.5" stroke={INK} strokeWidth="1.5" /><circle cx="7.5" cy="8.5" r="1.4" fill={INK} /><path d="m4 15 4.5-4.5 3 3 2-2L17 14" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    {A("Add a photo (optional)", "أضف صورة (اختياري)")}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { pickImg(e.target.files?.[0]); e.target.value = ""; }} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
                  </label>
                )}
              </div>
            </Section>

            {/* send: two taps on purpose, since these messages can't be taken back */}
            <div style={{ position: "sticky", bottom: 12, zIndex: 4, marginTop: 4, borderRadius: 18, background: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 18px 40px -24px rgba(26,8,21,.35)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {err && <div role="alert" style={{ fontSize: 14, color: "#B4233B", lineHeight: 1.45 }}>{err}</div>}
              {done && <div role="status" style={{ fontSize: 14, color: "#16704A", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 10.4 8.4 13.8 15 7" stroke="#16704A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>{done}</div>}
              {over && <div style={{ fontSize: 14, color: "#7A4B00", lineHeight: 1.45 }}>{A(`That's more than the ${left} offer messages left this month. Pick a smaller group or upgrade your plan.`, `هذا أكثر من ${left} رسالة متبقية هذا الشهر. اختر مجموعة أصغر أو قم بترقية باقتك.`)}</div>}
              {confirm ? (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: "1 1 220px", fontSize: 14, lineHeight: 1.45, color: BODY }}>{n === 1 ? A("Send now to 1 customer? This can't be undone.", "الإرسال الآن إلى عميل واحد؟ لا يمكن التراجع.") : A(`Send now to ${n} customers? This can't be undone.`, `الإرسال الآن إلى ${n} عميل؟ لا يمكن التراجع.`)}</span>
                  <button type="button" className="cp-btn" onClick={() => setConfirm(false)} disabled={busy} style={btn}>{A("Back", "رجوع")}</button>
                  <button type="button" onClick={send} disabled={busy} style={{ height: 46, padding: "0 20px", borderRadius: 12, border: 0, background: "linear-gradient(90deg,#FF5577,#C93DFF)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: busy ? "progress" : "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? A("Sending…", "جارٍ الإرسال…") : A("Yes, send", "نعم، أرسل")}</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: "1 1 200px", fontSize: 14, color: BODY, lineHeight: 1.45 }}>{n ? <><b style={num}>{n}</b> {n === 1 ? A("customer will get this on WhatsApp", "عميل سيستلم هذه الرسالة") : A("customers will get this on WhatsApp", "عميل سيستلمون هذه الرسالة")}</> : aud === "picked" ? A("Choose at least one customer", "اختر عميلاً واحداً على الأقل") : A("No one to send to in this group", "لا أحد في هذه المجموعة")}</span>
                  <button type="button" onClick={() => setConfirm(true)} disabled={blocked} style={{ height: 46, padding: "0 22px", borderRadius: 12, border: 0, background: "linear-gradient(90deg,#FF5577,#C93DFF)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.45 : 1, boxShadow: blocked ? "none" : "0 10px 24px -12px rgba(201,61,255,.55)" }}>{n === 1 ? A("Send to 1 customer", "أرسل إلى عميل واحد") : A(`Send to ${n} customers`, `أرسل إلى ${n} عميل`)}</button>
                </div>
              )}
            </div>
          </div>
          <aside className="cp-aside" aria-label={A("Preview", "معاينة")} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: MUTED, margin: 0 }}>{A("What customers see", "ما يراه العميل")}</h2>
            {preview}
          </aside>
        </div>
      )}

      {/* how earlier offers did */}
      {p.history && p.history.length > 0 && (
        <section aria-labelledby="cp-hist" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
          <h2 id="cp-hist" style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{A("Sent offers", "العروض المرسلة")}</h2>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 18, overflow: "hidden" }}>
            {p.history.map((c, i) => {
              const readPct = c.sent ? Math.round((c.read / c.sent) * 100) : 0, usedPct = c.sent ? Math.round((c.used / c.sent) * 100) : 0;
              return (
                <div key={c.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 24px", padding: "14px 18px", borderTop: i ? `1px solid ${LINE}` : 0 }}>
                  <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleOf(c.title)}</span>
                    <span style={{ fontSize: 13, color: MUTED }}>{[when(c.createdAt), c.mode === "all" ? A("All customers", "كل العملاء") : c.recipients === 1 ? A("1 customer", "عميل واحد") : A(`${c.recipients} customers`, `${c.recipients} عميل`), c.hasImage ? A("With photo", "مع صورة") : ""].filter(Boolean).join(" · ")}{c.status === "PARTIAL" ? <span style={{ color: "#7A4B00" }}> · {A(`${c.failed ?? 0} not delivered`, `${c.failed ?? 0} لم تُرسل`)}</span> : null}</span>
                  </div>
                  <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(64px,auto))", gap: "0 22px", flex: "none" }}>
                    {[[A("Sent", "أُرسلت"), c.sent, null], [A("Read", "قُرئت"), c.read, readPct], [A("Code used", "استُخدم الكود"), c.used, usedPct]].map(([k, v, pctv]) => (
                      <div key={k as string} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <dt style={{ fontSize: 12, color: MUTED }}>{k}</dt>
                        <dd style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontSize: 18, fontWeight: 600, ...num }}>{v as number}</span>{pctv !== null && c.sent > 0 && <span style={{ fontSize: 12, color: MUTED, ...num }}>{pctv as number}%</span>}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
