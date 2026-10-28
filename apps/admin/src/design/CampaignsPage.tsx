"use client";
// Campaigns: send an offer to customers on WhatsApp, in three plain steps (what to send, who gets it, review and send), with the customer's view
// always beside it. Past offers sit on their own tab. Plans can reach any customer who ordered and did not say STOP.
import React from "react";
import { formatMoney } from "@/modules/market/money";
import { segmentOf, TONE, type CustomerRow } from "./CustomersPage";
import { CampaignPreview, type CampaignItem, type CampaignKind } from "./CampaignPreview";

export type { CampaignItem };
export interface CampaignRow { id: string; title: string; mode: "all" | "offer"; recipients: number; hasImage: boolean; sent: number; read: number; used: number; failed?: number; status?: string; createdAt: string }
export interface SendInput { mode: "all" | "offer"; customerIds: string[]; message: string; code?: { code: string; percent: number; days: number }; image?: File }
type Filter = "all" | "regular" | "new" | "away";

const INK = "#1A0815", BODY = "#3D1C31", MUTED = "#76566A", LINE = "#EDE5E9", ROSE = "#F0446F", WINE = "#A3153F";
const MAX = 600, PERCENTS = [10, 15, 20, 25, 30], DAYS = [7, 14, 30];
const num: React.CSSProperties = { direction: "ltr", unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" };
const firstName = (c: CustomerRow | undefined, ar: boolean) => (c && c.name !== c.phone ? c.name.split(/\s+/)[0]! : ar ? "عزيزي العميل" : "there");

const CSS = `
.cm button,.cm select,.cm input,.cm textarea{font-family:inherit}
.cm .b{min-height:44px;padding:0 18px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:background-color .15s,border-color .15s,filter .15s}
.cm .b-out{border:1.5px solid #E6DBE1;background:#fff;color:${INK};font-weight:500}
.cm .b-out:hover:not(:disabled){background:#FFF8FB;border-color:#D9B8C7}
.cm .b-fill{border:0;background:linear-gradient(90deg,#D92B55,#B02BE0);color:#fff}
.cm .b-fill:hover:not(:disabled){filter:brightness(1.08)}
.cm .b:disabled{opacity:.5;cursor:not-allowed}
.cm .lk{min-height:44px;padding:0 4px;border:0;background:none;font-size:14px;font-weight:600;color:#C0284F;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.cm button:focus-visible,.cm input:focus-visible,.cm select:focus-visible,.cm textarea:focus-visible,.cm summary:focus-visible{outline:2px solid #A62BD9;outline-offset:2px}
.cm .field{height:44px;border:1.5px solid #E6DBE1;border-radius:10px;background:#fff;padding:0 12px;font-size:15px;color:${INK};min-width:0}
.cm .field:focus{border-color:${ROSE};box-shadow:0 0 0 3px rgba(240,68,111,.16);outline:none}
.cm .opt{display:flex;align-items:center;gap:14px;width:100%;text-align:start;padding:14px 16px;min-height:64px;border:1.5px solid #E6DBE1;border-radius:14px;background:#fff;color:${INK};cursor:pointer;transition:background-color .15s,border-color .15s}
.cm .opt:hover{border-color:#D9B8C7}
.cm .opt[aria-checked=true]{border-color:${ROSE};background:#FFF1F6}
.cm .dot{width:20px;height:20px;border-radius:50%;border:1.5px solid #D9BFCB;flex:none;display:inline-flex;align-items:center;justify-content:center;background:#fff}
.cm .opt[aria-checked=true] .dot{border-color:${ROSE}}
.cm .opt[aria-checked=true] .dot::after{content:"";width:10px;height:10px;border-radius:50%;background:${ROSE}}
.cm .thumb{position:relative;display:flex;flex-direction:column;gap:6px;align-items:flex-start;text-align:start;padding:10px 10px 14px;border:1.5px solid #E6DBE1;border-radius:16px;background:#fff;color:${INK};cursor:pointer;transition:background-color .15s,border-color .15s}
.cm .thumb:hover{border-color:#D9B8C7}
.cm .thumb[aria-checked=true]{border-color:${ROSE};background:#FFF8FB}
.cm .thumb .art{height:104px;width:100%;border-radius:10px;background:#EFE7DE;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.cm .thumb .tick{position:absolute;top:16px;inset-inline-end:16px;width:24px;height:24px;border-radius:50%;background:${ROSE};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center}
.cm .grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:32px;align-items:start}
.cm .aside{position:sticky;top:16px}
.cm .tabs{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:#F4EFF2}
.cm .tab{min-height:40px;padding:0 16px;border:0;border-radius:9px;background:transparent;font-size:14px;font-weight:500;color:${MUTED};cursor:pointer}
.cm .tab[aria-selected=true]{background:#fff;color:${INK};font-weight:600;box-shadow:0 1px 3px rgba(26,8,21,.1)}
.cm ::selection{background:#FFD3E1}
@media (max-width:980px){.cm .grid{grid-template-columns:minmax(0,1fr)}.cm .aside{position:static;max-width:380px}}
`;

export function CampaignsPage(p: {
  menuItems?: CampaignItem[]; currency?: string;
  ar: boolean; customers: CustomerRow[] | null; selected: string[]; onSelect: (ids: string[]) => void; history: CampaignRow[] | null; usage: { used: number; limit: number } | null;
  businessName: string; defaults: { all: string; offer: string }; waConnected: boolean; onConnect: () => void; onCustomers: () => void; onSend: (input: SendInput) => Promise<CampaignRow>;
}) {
  const A = (en: string, ar: string) => (p.ar ? ar : en);
  const [tab, setTab] = React.useState<"new" | "sent">("new"), [step, setStep] = React.useState(0), [kind, setKind] = React.useState<CampaignKind>("message");
  const all = p.customers ?? [], eligible = all.filter(c => !c.optedOut), currency = p.currency ?? "AED";
  const [filter, setFilter] = React.useState<Filter>("all"), [q, setQ] = React.useState(""), untouched = React.useRef(!p.selected.length);
  const [withCode, setWithCode] = React.useState(true), [pct, setPct] = React.useState(20), [days, setDays] = React.useState(7), [code, setCode] = React.useState("SAVE20"), [codeTouched, setCodeTouched] = React.useState(false);
  const [msg, setMsg] = React.useState(p.selected.length ? p.defaults.offer : p.defaults.all), [msgTouched, setMsgTouched] = React.useState(false);
  const [pickMsg, setPickMsg] = React.useState(""), [ids, setIds] = React.useState<string[]>([]), [itemQ, setItemQ] = React.useState("");
  const [img, setImg] = React.useState<{ file: File; url: string } | null>(null);
  const [confirm, setConfirm] = React.useState(false), [busy, setBusy] = React.useState(false), [err, setErr] = React.useState(""), [done, setDone] = React.useState("");
  const ta = React.useRef<HTMLTextAreaElement>(null), top = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);
  React.useEffect(() => { if (!msgTouched) setMsg(p.defaults.all); }, [p.defaults.all, msgTouched]);
  React.useEffect(() => { top.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [step]);

  const groups: Record<Filter, CustomerRow[]> = { all: eligible, regular: eligible.filter(c => segmentOf(c) === "regular"), new: eligible.filter(c => segmentOf(c) === "new"), away: eligible.filter(c => segmentOf(c) === "away") };
  // The list is the audience: everyone starts ticked, a group button ticks just that group, and single customers can be ticked or cleared.
  React.useEffect(() => { if (untouched.current && eligible.length) { untouched.current = false; p.onSelect(eligible.map(c => c.id)); } }, [eligible.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = new Set(p.selected), recips = eligible.filter(c => sel.has(c.id)), n = recips.length, isAll = n > 0 && n === eligible.length;
  const term = q.trim().toLowerCase().replace(/\s/g, "");
  const shown = groups[filter].filter(c => !term || c.name.toLowerCase().replace(/\s/g, "").includes(term) || c.phone.includes(term));
  const shownOn = shown.filter(c => sel.has(c.id)).length;
  const left = p.usage ? Math.max(0, p.usage.limit - p.usage.used) : null, over = left !== null && n > left;
  const codeOk = !withCode || code.trim().length >= 3, isMsg = kind === "message";
  const items = ids.flatMap(id => (p.menuItems ?? []).find(i => i.id === id && i.available) ?? []);
  const text = isMsg ? msg : pickMsg || A(`Hi {name}, our picks from ${p.businessName}. Tap Order on what you like.`, `أهلاً {name}، اخترنا لك من ${p.businessName}. اضغط اطلب على ما يعجبك.`);
  const until = new Date(Date.now() + days * 86_400_000).toLocaleDateString(p.ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short" });
  const offerText = !isMsg ? "" : withCode && codeOk ? A(`Code ${code}: ${pct}% off, valid until ${until}.`, `الكود ${code}: خصم ${pct}%، صالح حتى ${until}.`) : A("Reply to this message to order.", "رد على هذه الرسالة للطلب.");
  // Why the step's button waits, said in words.
  const why0 = isMsg ? (!msg.trim() ? A("Write your message to continue.", "اكتب رسالتك للمتابعة.") : msg.length > MAX ? A("The message is too long.", "الرسالة طويلة جداً.") : !codeOk ? A("Use 3 to 14 letters or numbers for the code.", "استخدم من 3 إلى 14 حرفاً أو رقماً للكود.") : "") : ids.length < 2 ? A("Pick at least 2 items to continue.", "اختر صنفين على الأقل للمتابعة.") : "";
  const why1 = !n ? A("Tick at least one customer.", "حدد عميلاً واحداً على الأقل.") : over ? A(`That is more than the ${left} offer messages left this month. Pick a smaller group.`, `هذا أكثر من ${left} رسالة متبقية هذا الشهر. اختر مجموعة أصغر.`) : "";
  const why2 = !p.waConnected ? A("Link WhatsApp first.", "اربط واتساب أولاً.") : !isMsg ? A("Sending item cards starts once WhatsApp approves the templates. Your design is saved here only for now.", "إرسال بطاقات الأصناف يبدأ بعد موافقة واتساب على القوالب. التصميم هنا للمعاينة فقط حالياً.") : "";

  const send = async () => {
    setBusy(true); setErr("");
    try {
      const row = await p.onSend({ mode: isAll ? "all" : "offer", customerIds: isAll ? [] : recips.map(c => c.id), message: msg.trim(), ...(withCode ? { code: { code, percent: pct, days } } : {}), ...(img ? { image: img.file } : {}) });
      setDone(row.sent === 1 ? A("Sent to 1 customer", "أُرسل إلى عميل واحد") : A(`Sent to ${row.sent} customers`, `أُرسل إلى ${row.sent} عميل`)); setConfirm(false); setStep(0);
      p.onSelect(eligible.map(c => c.id)); setFilter("all");
      setTimeout(() => setDone(""), 6000);
    } catch (e: any) { setErr(e.message); setConfirm(false); } finally { setBusy(false); }
  };
  const pickImg = (f?: File) => {
    if (!f) return; if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setErr(A("Use a JPG, PNG or WebP image.", "استخدم صورة JPG أو PNG أو WebP."));
    if (f.size > 5 * 1048576) return setErr(A("Use an image under 5 MB.", "استخدم صورة أقل من 5 ميغابايت."));
    if (img) URL.revokeObjectURL(img.url); setImg({ file: f, url: URL.createObjectURL(f) }); setErr("");
  };
  const insertName = () => { const el = ta.current, at = el ? el.selectionStart : msg.length; setMsg(msg.slice(0, at) + "{name}" + msg.slice(el ? el.selectionEnd : at)); setMsgTouched(true); requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + 6, at + 6); }); };
  const starters: [string, string][] = [
    [A("Weekend deal", "عرض نهاية الأسبوع"), A(`Hi {name}, this weekend only at ${p.businessName}: a little something off your order. Reply here to order.`, `أهلاً {name}، هذا الأسبوع فقط في ${p.businessName}: خصم على طلبك. رد هنا للطلب.`)],
    [A("We miss you", "اشتقنا لك"), A(`Hi {name}, it's been a while! Here's a treat to welcome you back to ${p.businessName}.`, `أهلاً {name}، اشتقنا لك! هذه هدية صغيرة لعودتك إلى ${p.businessName}.`)],
    [A("Thank you", "شكراً لك"), A(`Hi {name}, thank you for ordering with ${p.businessName}. Here's a discount on your next order.`, `أهلاً {name}، شكراً لطلبك من ${p.businessName}. هذا خصم على طلبك القادم.`)],
  ];
  const kinds: [CampaignKind, string, string][] = [
    ["message", A("A message", "رسالة"), A("Your words, with an optional photo and discount code.", "كلماتك مع صورة وكود خصم اختياريين.")],
    ["picks", A("Swipeable picks", "أصناف قابلة للسحب"), A("Cards with photo, name and price. Customers tap Order on the one they want.", "بطاقات بالصورة والاسم والسعر. يضغط العميل اطلب على ما يريد.")],
    ["list", A("Price list", "قائمة بالأسعار"), A("A short list with prices, a total and an Order button.", "قائمة قصيرة بالأسعار والمجموع وزر اطلب.")],
  ];
  const FILTERS: [Filter, string, string][] = [
    ["all", A("All", "الكل"), A("Everyone who ordered from you", "كل من طلب منك")],
    ["regular", A("Regulars", "الدائمون"), A("3 orders or more", "3 طلبات أو أكثر")],
    ["new", A("New", "الجدد"), A("1 order in the last 30 days", "طلب واحد خلال 30 يوماً")],
    ["away", A("Gone quiet", "انقطعوا"), A("No order in 30+ days", "لا طلبات منذ 30+ يوماً")],
  ];
  // Tiny drawings of what each choice looks like in the chat.
  const bar = (w: string, h = 6, bg = "#E6D5DD"): React.CSSProperties => ({ height: h, width: w, borderRadius: 3, background: bg });
  const kindArt = (k: CampaignKind) => k === "message"
    ? <span style={{ display: "flex", flexDirection: "column", gap: 5, background: "#fff", borderRadius: 8, padding: 8, width: "78%", boxShadow: "0 1px 1px rgba(0,0,0,.08)" }}><span style={bar("100%", 26, "#EAD7DF")} /><span style={bar("90%")} /><span style={bar("60%")} /><span style={{ ...bar("100%", 14, "#E4F2F7"), marginTop: 2 }} /></span>
    : k === "picks"
      ? <span style={{ display: "flex", gap: 5, width: "92%", overflow: "hidden" }}>{[0, 1, 2].map(i => <span key={i} style={{ flex: "0 0 40%", background: "#fff", borderRadius: 7, padding: 4, display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 1px 1px rgba(0,0,0,.08)" }}><span style={bar("100%", 28, ["#E5EEE2", "#EAD7DF", "#F3E3C9"][i])} /><span style={bar("80%")} /><span style={bar("50%", 5, "#CFE6EF")} /></span>)}</span>
      : <span style={{ display: "flex", flexDirection: "column", gap: 5, background: "#fff", borderRadius: 8, padding: 8, width: "78%", boxShadow: "0 1px 1px rgba(0,0,0,.08)" }}><span style={bar("100%", 18, "#E5EEE2")} />{[0, 1, 2].map(i => <span key={i} style={{ display: "flex", justifyContent: "space-between" }}><span style={bar("55%")} /><span style={bar("20%")} /></span>)}<span style={{ ...bar("100%", 12, "#E4F2F7"), marginTop: 2 }} /></span>;
  const steps = [A("What to send", "ماذا ترسل"), A("Who gets it", "لمن ترسل"), A("Review and send", "المراجعة والإرسال")];
  const audLabel = isAll ? A("All customers", "كل العملاء") : A("Chosen customers", "عملاء محددون");
  const filteredItems = (p.menuItems ?? []).filter(i => i.available && `${i.name} ${i.nameAr ?? ""}`.toLowerCase().includes(itemQ.trim().toLowerCase()));
  const itemName = (i: CampaignItem) => (p.ar ? i.nameAr || i.name : i.name);
  const price = (m: number) => formatMoney(m, currency, p.ar ? "ar-AE-u-nu-latn" : "en-GB");
  const label: React.CSSProperties = { fontSize: 14, fontWeight: 500, display: "flex", flexDirection: "column", gap: 6 };
  const h2: React.CSSProperties = { fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 };
  const muted: React.CSSProperties = { fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5 };
  const nav = (why: string, next: () => void, nextLabel: string) => <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
    {why && <p style={{ ...muted, color: "#7A4B00" }}>{why}</p>}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {step > 0 && <button type="button" className="b b-out" onClick={() => setStep(step - 1)}>{A("Back", "رجوع")}</button>}
      <button type="button" className="b b-fill" disabled={!!why} onClick={next}>{nextLabel}</button>
    </div>
  </div>;
  const when = (iso: string) => new Date(iso).toLocaleDateString(p.ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short" });
  const titleOf = (t: string) => { const m = /^(\d+)% off · (.+)$/.exec(t); return m ? A(`${m[1]}% off · ${m[2]}`, `خصم ${m[1]}% · ${m[2]}`) : t; };
  const sent = p.history ?? [];

  return <div className="cm" dir={p.ar ? "rtl" : "ltr"} data-screen-label="08 Dashboard · Campaigns" style={{ display: "flex", flexDirection: "column", gap: 20, color: INK, maxWidth: 1100 }}>
    <style>{CSS}</style>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <div><h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: p.ar ? 0 : "-0.035em", margin: 0 }}>{A("Campaigns", "الحملات")}</h1>
        <p style={{ fontSize: 15, color: BODY, margin: "4px 0 0", maxWidth: 560 }}>{A("Send an offer to your customers on WhatsApp. Each one gets it in their chat with you.", "أرسل عرضاً لعملائك على واتساب. يصل لكل عميل في محادثته معك.")}</p></div>
      {p.usage && p.usage.limit > 0 && <div style={{ minWidth: 220, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 14, color: MUTED, ...num, textAlign: p.ar ? "left" : "right" }}>{A(`${left} of ${p.usage.limit} offer messages left this month`, `متبقٍ ${left} من ${p.usage.limit} رسالة عروض هذا الشهر`)}</span>
        <span aria-hidden="true" style={{ height: 6, borderRadius: 999, background: "#F3EEF1", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.min(100, (p.usage.used / p.usage.limit) * 100)}%`, background: left === 0 ? "#B4233B" : ROSE }} /></span>
      </div>}
    </div>

    <div role="tablist" className="tabs" style={{ alignSelf: "flex-start" }}>
      <button type="button" role="tab" className="tab" aria-selected={tab === "new"} onClick={() => setTab("new")}>{A("New campaign", "حملة جديدة")}</button>
      <button type="button" role="tab" className="tab" aria-selected={tab === "sent"} onClick={() => setTab("sent")}>{A("Sent offers", "العروض المرسلة")}{sent.length ? ` (${sent.length})` : ""}</button>
    </div>

    {done && <div role="status" style={{ padding: "12px 16px", borderRadius: 12, background: "#E6F4EC", color: "#16704A", fontSize: 14, fontWeight: 600 }}>{done}. {A("See how it did under “Sent offers”.", "شاهد النتيجة في «العروض المرسلة».")}</div>}
    {!p.waConnected && <div role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 16, background: "#FDECEF", color: "#B4233B" }}>
      <span style={{ flex: "1 1 240px", fontSize: 14, lineHeight: 1.5 }}>{A("Link a WhatsApp number before sending offers. They go out from your number.", "اربط رقم واتساب قبل إرسال العروض، فهي تُرسل من رقمك.")}</span>
      <button type="button" className="b b-out" onClick={p.onConnect} style={{ borderColor: "#F3B8CB", color: "#B4233B" }}>{A("Link WhatsApp", "ربط واتساب")}</button></div>}

    {tab === "sent" ? (
      !sent.length ? <div style={{ border: "1px dashed #E3CBD4", borderRadius: 16, padding: "32px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
        <h2 style={h2}>{A("No offers sent yet", "لم تُرسل عروض بعد")}</h2><p style={{ ...muted, maxWidth: 380 }}>{A("After you send one, you will see how many customers got it, read it and used the code.", "بعد أن ترسل عرضاً سترى كم عميلاً استلمه وقرأه واستخدم الكود.")}</p>
        <button type="button" className="b b-fill" onClick={() => setTab("new")}>{A("Create a campaign", "أنشئ حملة")}</button></div>
      : <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        {sent.map((c, i) => { const readPct = c.sent ? Math.round((c.read / c.sent) * 100) : 0, usedPct = c.sent ? Math.round((c.used / c.sent) * 100) : 0;
          return <div key={c.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 24px", padding: "14px 18px", borderTop: i ? `1px solid ${LINE}` : 0 }}>
            <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleOf(c.title)}</span>
              <span style={{ fontSize: 14, color: MUTED }}>{[when(c.createdAt), c.mode === "all" ? A("All customers", "كل العملاء") : c.recipients === 1 ? A("1 customer", "عميل واحد") : A(`${c.recipients} customers`, `${c.recipients} عميل`), c.hasImage ? A("With photo", "مع صورة") : ""].filter(Boolean).join(" · ")}{c.status === "PARTIAL" ? <span style={{ color: "#7A4B00" }}> · {A(`${c.failed ?? 0} not delivered`, `${c.failed ?? 0} لم تُرسل`)}</span> : null}</span>
            </div>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(64px,auto))", gap: "0 22px" }}>
              {([[A("Sent", "أُرسلت"), c.sent, null], [A("Read", "قُرئت"), c.read, readPct], [A("Code used", "استُخدم الكود"), c.used, usedPct]] as [string, number, number | null][]).map(([k, v, pv]) => <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <dt style={{ fontSize: 13, color: MUTED }}>{k}</dt><dd style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontSize: 18, fontWeight: 600, ...num }}>{v}</span>{pv !== null && c.sent > 0 && <span style={{ fontSize: 13, color: MUTED, ...num }}>{pv}%</span>}</dd></div>)}
            </dl></div>; })}
      </div>
    ) : p.customers !== null && !all.length ? (
      <div style={{ border: "1px dashed #E3CBD4", borderRadius: 16, padding: "32px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <h2 style={h2}>{A("No one to send to yet", "لا يوجد عملاء بعد")}</h2>
        <p style={{ ...muted, maxWidth: 420 }}>{A("Offers go to customers who ordered from you on WhatsApp. Once your first orders come in, you can send them offers here.", "تُرسل العروض لمن طلب منك عبر واتساب. بعد وصول أول الطلبات يمكنك إرسال العروض من هنا.")}</p></div>
    ) : (
      <div className="grid">
        <div ref={top} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <ol aria-label={A("Steps", "الخطوات")} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {steps.map((s, i) => <li key={s}><button type="button" disabled={i > step} onClick={() => { setConfirm(false); setStep(i); }} aria-current={i === step ? "step" : undefined} style={{ minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1.5px solid ${i === step ? ROSE : "#E6DBE1"}`, background: i === step ? "#FFF1F6" : "#fff", color: i === step ? WINE : i < step ? INK : MUTED, fontSize: 14, fontWeight: i === step ? 600 : 500, cursor: i > step ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", background: i < step ? "#16704A" : i === step ? ROSE : "#F3EEF1", color: i <= step ? "#fff" : MUTED, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", ...num }}>{i < step ? "✓" : i + 1}</span>{s}</button></li>)}
          </ol>

          {step === 0 && <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><h2 style={h2}>{A("What do you want to send?", "ماذا تريد أن ترسل؟")}</h2></div>
            <div role="radiogroup" aria-label={A("What to send", "ماذا ترسل")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
              {kinds.map(([k, title, hint]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className="thumb" onClick={() => setKind(k)}>
                <span className="art" aria-hidden="true" style={{ background: k === "message" ? "#FFE6EE" : k === "picks" ? "#EEE6FF" : "#FFEFD6" }}>{kindArt(k)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>{k !== "message" && <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#FFF1DC", color: "#7A4B00" }}>{A("Preview", "معاينة")}</span>}</span>
                <span style={{ fontSize: 14, color: MUTED, lineHeight: 1.4 }}>{hint}</span>
                {kind === k && <span className="tick" aria-hidden="true">✓</span>}</button>)}
            </div>

            {isMsg ? <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{A("Your message", "رسالتك")}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{starters.map(([l, t]) => <button key={l} type="button" className="b b-out" style={{ minHeight: 36, padding: "0 12px", fontSize: 14 }} onClick={() => { setMsg(t); setMsgTouched(true); }}>{l}</button>)}</div>
                <textarea ref={ta} className="field" value={msg} onChange={e => { setMsg(e.target.value); setMsgTouched(true); }} rows={4} aria-label={A("Your message", "رسالتك")} style={{ height: "auto", padding: "10px 12px", lineHeight: 1.55, resize: "vertical", width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <button type="button" className="lk" onClick={insertName}>+ {A("Add customer's first name", "أضف الاسم الأول للعميل")}</button>
                  <span style={{ fontSize: 13, color: msg.length > MAX ? "#B4233B" : MUTED, ...num }}>{msg.length}/{MAX}</span></div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, cursor: "pointer", fontSize: 15, fontWeight: 500 }}>
                  <input type="checkbox" checked={withCode} onChange={e => setWithCode(e.target.checked)} style={{ width: 20, height: 20, accentColor: ROSE }} />{A("Add a discount code", "أضف كود خصم")}</label>
                {withCode && <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", paddingInlineStart: 32 }}>
                  <label style={label}>{A("Discount", "الخصم")}<select className="field" value={pct} onChange={e => { const v = Number(e.target.value); setPct(v); if (!codeTouched) setCode(`SAVE${v}`); }}>{PERCENTS.map(v => <option key={v} value={v}>{v}%</option>)}</select></label>
                  <label style={label}>{A("Valid for", "صالح لمدة")}<select className="field" value={days} onChange={e => setDays(Number(e.target.value))}>{DAYS.map(v => <option key={v} value={v}>{A(`${v} days`, `${v} يوماً`)}</option>)}</select></label>
                  <label style={label}>{A("Code", "الكود")}<input className="field" value={code} aria-invalid={!codeOk} onChange={e => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14)); }} style={{ width: 150, fontWeight: 600, letterSpacing: "0.05em", ...num, ...(codeOk ? {} : { borderColor: "#B4233B" }) }} /></label>
                  <p style={{ ...muted, flexBasis: "100%" }}>{A(`Customers say the code when they order and Lumia applies it. Works until ${until}.`, `يذكر العميل الكود عند الطلب ويطبقه Lumia. صالح حتى ${until}.`)}</p>
                </div>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {img ? <><img src={img.url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 10, border: `1px solid ${LINE}` }} /><span style={{ flex: "1 1 140px", minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.file.name}</span><button type="button" className="b b-out" onClick={() => { URL.revokeObjectURL(img.url); setImg(null); }}>{A("Remove photo", "إزالة الصورة")}</button></>
                  : <label className="b b-out" style={{ borderStyle: "dashed", position: "relative" }}>{A("Add a photo (optional)", "أضف صورة (اختياري)")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { pickImg(e.target.files?.[0]); e.target.value = ""; }} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /></label>}
              </div>
            </> : <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{A("Pick items from your menu", "اختر أصنافاً من المنيو")}</span><span style={{ ...muted, ...num }}>{ids.length} / 10</span></div>
                <input className="field" value={itemQ} onChange={e => setItemQ(e.target.value)} placeholder={A("Search your menu", "ابحث في المنيو")} aria-label={A("Search menu items", "ابحث عن صنف")} />
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, maxHeight: 260, overflowY: "auto", background: "#fff" }}>
                  {filteredItems.map((i, k) => { const on = ids.includes(i.id); return <label key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", minHeight: 52, cursor: "pointer", borderTop: k ? "1px solid #F4EFF2" : 0, background: on ? "#FFF1F6" : "#fff" }}>
                    <input type="checkbox" checked={on} disabled={!on && ids.length >= 10} onChange={() => setIds(on ? ids.filter(x => x !== i.id) : [...ids, i.id])} style={{ width: 20, height: 20, accentColor: ROSE, flex: "none" }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}>{itemName(i)}</span><span style={{ fontSize: 14, color: MUTED, ...num }}>{price(i.priceMinor)}</span></label>; })}
                  {!filteredItems.length && <p style={{ ...muted, padding: 20, textAlign: "center" }}>{A("No items found. Add items to your menu first.", "لا توجد أصناف. أضف أصنافاً للمنيو أولاً.")}</p>}
                </div>
              </div>
              <label style={label}>{A("Message above the items", "الرسالة فوق الأصناف")}<textarea className="field" value={pickMsg} onChange={e => setPickMsg(e.target.value)} rows={2} placeholder={A(`Hi {name}, our picks from ${p.businessName}. Tap Order on what you like.`, `أهلاً {name}، اخترنا لك من ${p.businessName}. اضغط اطلب على ما يعجبك.`)} style={{ height: "auto", padding: "10px 12px", lineHeight: 1.55, resize: "vertical" }} /></label>
              <p style={{ ...muted, padding: "12px 14px", borderRadius: 12, background: "#FFF8FB" }}>{A("Item cards need WhatsApp's approval before they can be sent. You can design and preview them now.", "بطاقات الأصناف تحتاج موافقة واتساب قبل إرسالها. يمكنك تصميمها ومعاينتها الآن.")}</p>
            </>}
            {nav(why0, () => setStep(1), A("Continue", "متابعة"))}
          </section>}

          {step === 1 && <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><h2 style={h2}>{A("Who should get it?", "لمن تريد إرسالها؟")}</h2>
              <p style={{ ...muted, marginTop: 2 }}>{A("Everyone is ticked. Pick a group, search, or tick customers one by one.", "الجميع محدد. اختر مجموعة أو ابحث أو حدد العملاء واحداً واحداً.")}{all.length > eligible.length ? " " + A(`${all.length - eligible.length} turned off offers and are not listed.`, `${all.length - eligible.length} أوقفوا العروض وغير مدرجين.`) : ""}</p></div>
            <div role="radiogroup" aria-label={A("Group", "المجموعة")} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FILTERS.map(([k, label]) => { const tone = k !== "all" ? TONE[k] : null, on = filter === k; return <button key={k} type="button" role="radio" aria-checked={on} title={FILTERS.find(f => f[0] === k)![2]} onClick={() => { setFilter(k); setConfirm(false); p.onSelect(groups[k].map(c => c.id)); }} style={{ minHeight: 44, padding: "0 14px", borderRadius: 999, border: `1.5px solid ${on ? ROSE : "#E6DBE1"}`, background: on ? "#FFF1F6" : "#fff", color: on ? WINE : INK, fontSize: 14, fontWeight: on ? 600 : 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                {tone && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tone.fg }} />}{label}<span style={{ ...num, color: MUTED, fontWeight: 500 }}>{p.customers === null ? "…" : groups[k].length}</span></button>; })}
            </div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${LINE}`, background: "#FBF8F9", flexWrap: "wrap" }}>
                <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder={A("Search name or number", "ابحث بالاسم أو الرقم")} aria-label={A("Search customers", "ابحث في العملاء")} style={{ flex: "1 1 180px" }} />
                <button type="button" className="lk" onClick={() => { const ids = new Set(p.selected); if (shownOn === shown.length) shown.forEach(c => ids.delete(c.id)); else shown.forEach(c => ids.add(c.id)); p.onSelect([...ids]); }}>{shown.length && shownOn === shown.length ? A("Clear these", "إلغاء تحديد هؤلاء") : A("Tick these", "تحديد هؤلاء")}</button>
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {shown.map((c, k) => { const on = sel.has(c.id), seg = segmentOf(c), tone = seg ? TONE[seg] : null; return <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: k ? "1px solid #F4EFF2" : 0, cursor: "pointer", background: on ? "#FFF8FB" : "#fff", minHeight: 56 }}>
                  <input type="checkbox" checked={on} onChange={() => p.onSelect(on ? p.selected.filter(x => x !== c.id) : [...p.selected, c.id])} style={{ width: 20, height: 20, accentColor: ROSE, flex: "none" }} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}><span style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(c.name === c.phone ? num : {}) }}>{c.name}</span>{c.name !== c.phone && <span style={{ fontSize: 13, color: MUTED, ...num }}>{c.phone}</span>}</span>
                  {tone && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tone.fg, flex: "none" }} />}
                  <span style={{ fontSize: 14, color: MUTED, whiteSpace: "nowrap" }}>{c.orders === 1 ? A("1 order", "طلب واحد") : A(`${c.orders} orders`, `${c.orders} طلبات`)}</span></label>; })}
                {!shown.length && <p style={{ ...muted, padding: 24, textAlign: "center" }}>{p.customers === null ? A("Loading customers…", "جارٍ تحميل العملاء…") : A("No customers match.", "لا يوجد عملاء مطابقون.")} {!!term && <button type="button" className="lk" onClick={() => setQ("")}>{A("Clear search", "مسح البحث")}</button>}</p>}
              </div>
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${LINE}`, background: "#FBF8F9", fontSize: 14, color: BODY }}><b style={num}>{n}</b> {A(`of ${eligible.length} customers ticked`, `من ${eligible.length} عميل محدد`)}</div>
            </div>
            {nav(why1, () => setStep(2), A("Continue", "متابعة"))}
          </section>}

          {step === 2 && <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={h2}>{A("Check and send", "راجع وأرسل")}</h2>
            <dl style={{ margin: 0, border: `1px solid ${LINE}`, borderRadius: 14, background: "#fff", padding: "4px 16px" }}>
              {([
                [A("Sending", "ما سيُرسل"), kinds.find(k => k[0] === kind)![1]],
                [A("To", "إلى"), `${audLabel} · ${n === 1 ? A("1 customer", "عميل واحد") : A(`${n} customers`, `${n} عميل`)}`],
                ...(isMsg ? [[A("Message", "الرسالة"), msg.trim().length > 90 ? msg.trim().slice(0, 90) + "…" : msg.trim()], [A("Discount", "الخصم"), withCode ? A(`${pct}% off with code ${code}, until ${until}`, `خصم ${pct}% بالكود ${code}، حتى ${until}`) : A("None", "بدون")], [A("Photo", "الصورة"), img ? img.file.name : A("None", "بدون")]] : [[A("Items", "الأصناف"), items.map(itemName).join(", ")]]),
                ...(left !== null ? [[A("Uses from your plan", "يُحتسب من باقتك"), A(`${n} of ${left} offer messages left`, `${n} من ${left} رسالة متبقية`)]] : []),
              ] as [string, string][]).map(([k, v], i) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "11px 0", borderTop: i ? `1px solid ${LINE}` : 0, fontSize: 14 }}><dt style={{ color: MUTED, flex: "none" }}>{k}</dt><dd style={{ margin: 0, fontWeight: 600, textAlign: "end", overflowWrap: "anywhere" }}>{v}</dd></div>)}
            </dl>
            {err && <div role="alert" style={{ fontSize: 14, color: "#B4233B", lineHeight: 1.45 }}>{err}</div>}
            {why2 && <p style={{ ...muted, color: "#7A4B00" }}>{why2}</p>}
            {confirm ? <div style={{ border: "1.5px solid #EBC4D2", background: "#FFF8FB", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <b style={{ fontSize: 15 }}>{n === 1 ? A("Send now to 1 customer?", "الإرسال الآن إلى عميل واحد؟") : A(`Send now to ${n} customers?`, `الإرسال الآن إلى ${n} عميل؟`)}</b>
              <p style={muted}>{A("Messages can't be taken back once they are sent.", "لا يمكن استرجاع الرسائل بعد إرسالها.")}</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" className="b b-fill" disabled={busy} onClick={send}>{busy ? A("Sending…", "جارٍ الإرسال…") : A("Yes, send", "نعم، أرسل")}</button><button type="button" className="b b-out" disabled={busy} onClick={() => setConfirm(false)}>{A("Not now", "ليس الآن")}</button></div></div>
              : <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="b b-out" onClick={() => setStep(1)}>{A("Back", "رجوع")}</button>
                <button type="button" className="b b-fill" disabled={!!why2 || busy} onClick={() => setConfirm(true)}>{n === 1 ? A("Send to 1 customer", "أرسل إلى عميل واحد") : A(`Send to ${n} customers`, `أرسل إلى ${n} عميل`)}</button></div>}
          </section>}
        </div>

        <aside className="aside" aria-label={A("Preview", "معاينة")} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ ...h2, fontSize: 15 }}>{A("What customers see", "ما يراه العملاء")}</h2>
          <CampaignPreview ar={p.ar} kind={kind} business={p.businessName} currency={currency} text={text} offer={offerText} photo={img?.url ?? null} items={items} sample={firstName(recips[0], p.ar)} />
        </aside>
      </div>
    )}
  </div>;
}
