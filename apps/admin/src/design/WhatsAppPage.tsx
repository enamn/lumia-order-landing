"use client";
// WhatsApp inside the dashboard: the numbers the restaurant linked (by plan), their status, and the guided way to link one.
// Customers order by messaging these numbers, so the page says plainly whether orders can come in right now.
import React from "react";

export interface WaNumber { id: string; status: "connected" | "disconnected"; displayPhoneNumber: string; verifiedName: string; businessPortfolioName?: string; connectedAt?: string | null; disconnectedAt?: string | null }
export type LinkMode = "existing" | "new";

const INK = "#1A0815", BODY = "#3D1C31", MUTED = "#8A5A6E", LINE = "#ECD9E0", SOFT = "#FAF6FA", GREEN = "#16704A";
const gradient: React.CSSProperties = { minHeight: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "linear-gradient(90deg,#FF5577,#C93DFF)", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer", boxShadow: "0 10px 24px -12px rgba(201,61,255,.55)" };
const outline: React.CSSProperties = { minHeight: 44, padding: "0 16px", borderRadius: 12, border: `1.5px solid ${LINE}`, background: "#fff", color: INK, fontWeight: 500, fontSize: 15, cursor: "pointer" };
const quiet: React.CSSProperties = { minHeight: 44, padding: "0 4px", border: 0, background: "none", color: BODY, fontSize: 15, fontWeight: 500, textDecoration: "underline", textDecorationColor: "#E3CBD4", textUnderlineOffset: 4, cursor: "pointer" };
const pill = (bg: string, fg: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: bg, color: fg, whiteSpace: "nowrap" });
const num: React.CSSProperties = { direction: "ltr", unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" };

export function WaGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <path d="M12 2.6a9.4 9.4 0 0 0-8.1 14.1L2.6 21.4l4.8-1.3A9.4 9.4 0 1 0 12 2.6z" fill="#25D366" />
      <path d="M8.9 7.4c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.2-.7-.7-1.2-1.5-1.4-1.7-.1-.3 0-.4.1-.5l.4-.4.2-.4v-.4l-.9-2z" fill="#fff" />
    </svg>
  );
}
const Check = ({ color = GREEN }: { color?: string }) => <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}><path d="M5 10.4 8.4 13.8 15 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Chevron = ({ ar }: { ar: boolean }) => <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: "none", transform: ar ? "scaleX(-1)" : undefined }}><path d="M8 5l5 5-5 5" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const day = (iso: string | null | undefined, ar: boolean) => (iso ? new Date(iso).toLocaleDateString(ar ? "ar-AE" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

// ---------------------------------------------------------------- the page

export function WhatsAppNumbers(p: { ar: boolean; numbers: WaNumber[]; limit: number; planName: string; canUpgrade: boolean; stats: { label: string; v: number }[]; onAdd: () => void; onDisconnect: (n: WaNumber) => void; onUpgrade: () => void }) {
  const A = (en: string, ar: string) => (p.ar ? ar : en);
  const live = p.numbers.filter(n => n.status === "connected"), off = p.numbers.filter(n => n.status !== "connected");
  const full = live.length >= p.limit;
  return (
    <div dir={p.ar ? "rtl" : "ltr"} data-screen-label="07 WhatsApp" style={{ display: "flex", flexDirection: "column", gap: 20, color: INK, maxWidth: 880 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.035em", margin: 0 }}>{A("WhatsApp", "واتساب")}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: BODY, margin: 0, maxWidth: 620, textWrap: "pretty" }}>{A("Customers order by sending a message to your WhatsApp number. Lumia answers them and turns the chat into an order.", "يطلب عملاؤك بإرسال رسالة إلى رقم واتساب الخاص بك. يرد عليهم Lumia ويحوّل المحادثة إلى طلب.")}</p>
      </div>

      {/* The one thing the owner must know: can orders come in right now? */}
      {live.length ? (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 16, background: "#E9F7EF", color: GREEN }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#25D366", boxShadow: "0 0 0 4px rgba(37,211,102,.22)", flex: "none" }} />
          <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{live.length === 1 ? A("Receiving orders on 1 number", "يستقبل الطلبات على رقم واحد") : A(`Receiving orders on ${live.length} numbers`, `يستقبل الطلبات على ${live.length} أرقام`)}</span>
        </div>
      ) : (
        <div style={{ borderRadius: 20, padding: "24px 22px", background: "radial-gradient(70% 90% at 0% 0%,#FFE9EF 0%,rgba(255,233,239,0) 100%),radial-gradient(60% 80% at 100% 100%,#F1E6FF 0%,rgba(241,230,255,0) 100%),#fff", border: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ ...pill("#FDECEF", "#B4233B"), alignSelf: "flex-start" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#B4233B" }} />{A("Not receiving orders", "لا يستقبل الطلبات")}</span>
          <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, margin: 0, textWrap: "balance" }}>{off.length ? A("Your WhatsApp number is disconnected", "رقم واتساب غير مربوط حالياً") : A("Link your WhatsApp number to start taking orders", "اربط رقم واتساب لتبدأ باستقبال الطلبات")}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: BODY, margin: 0, maxWidth: 560, textWrap: "pretty" }}>{A("Until a number is linked, customers can't order through Lumia. Linking takes about 5 minutes and happens on Meta, the company behind WhatsApp.", "قبل ربط رقم، لا يمكن للعملاء الطلب عبر Lumia. يستغرق الربط حوالي 5 دقائق ويتم عبر Meta، الشركة المالكة لواتساب.")}</p>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 10 }}>
            {[[A("Pick the number", "اختر الرقم"), A("The one you signed in with, or another one.", "الرقم الذي سجّلت به أو رقم آخر.")], [A("Approve on Meta", "وافق عبر Meta"), A("Sign in with Facebook and confirm the number.", "سجّل الدخول بفيسبوك وأكّد الرقم.")], [A("Lumia starts replying", "يبدأ Lumia بالرد"), A("Orders show up here and on your terminal.", "تظهر الطلبات هنا وعلى جهازك.")]].map(([t, d], i) => (
              <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,255,255,.7)", borderRadius: 14, padding: "12px 14px" }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: INK, color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", ...num }}>{i + 1}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 13, lineHeight: 1.45, color: BODY }}>{d}</span></span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={p.onAdd} style={{ ...gradient, alignSelf: "flex-start", minHeight: 52, padding: "0 24px", fontSize: 16 }} className="dch1">{A("Link WhatsApp number", "ربط رقم واتساب")}</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 16, alignItems: "start" }}>
        {p.numbers.length > 0 && <section aria-labelledby="wa-numbers" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h2 id="wa-numbers" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 }}>{A("Your numbers", "أرقامك")}</h2>
            <span style={{ fontSize: 14, color: MUTED, ...num }}>{A(`${live.length} of ${p.limit} in use`, `${live.length} من ${p.limit} مستخدم`)}</span>
          </div>
          {p.numbers.map(n => {
            const on = n.status === "connected";
            return (
              <article key={n.id} style={{ border: `1px solid ${on ? "#CFEBDB" : LINE}`, borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, background: "#fff" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px", minWidth: 0 }}>
                  <span style={{ width: 46, height: 46, borderRadius: 14, background: on ? "#EAF8EF" : SOFT, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", filter: on ? undefined : "grayscale(1)", opacity: on ? 1 : 0.7 }}><WaGlyph size={26} /></span>
                  <div style={{ flex: "1 1 150px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", ...num, textAlign: p.ar ? "right" : "left" }}>{n.displayPhoneNumber || A("WhatsApp number", "رقم واتساب")}</span>
                    <span style={{ fontSize: 14, color: BODY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.verifiedName || A("Name pending", "الاسم قيد المراجعة")}</span>
                  </div>
                  <span style={on ? pill("#E4F4EC", GREEN) : pill("#F3EEF1", BODY)}><span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#25D366" : "#B79AA6" }} />{on ? A("Connected", "متصل") : A("Disconnected", "غير متصل")}</span>
                </div>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 14, borderTop: "1px solid #F3EEF1", paddingTop: 12 }}>
                  <dt style={{ color: MUTED }}>{A("Status", "الحالة")}</dt><dd style={{ margin: 0, textAlign: "end", color: on ? GREEN : BODY, fontWeight: 500 }}>{on ? A("Lumia replies and takes orders", "Lumia يرد ويستقبل الطلبات") : A("Not receiving messages", "لا يستقبل الرسائل")}</dd>
                  {n.businessPortfolioName ? <><dt style={{ color: MUTED }}>{A("Meta business", "حساب Meta")}</dt><dd style={{ margin: 0, textAlign: "end", overflow: "hidden", textOverflow: "ellipsis" }}>{n.businessPortfolioName}</dd></> : null}
                  <dt style={{ color: MUTED }}>{on ? A("Linked on", "تاريخ الربط") : A("Disconnected on", "تاريخ الفصل")}</dt><dd style={{ margin: 0, textAlign: "end" }}>{day(on ? n.connectedAt : n.disconnectedAt, p.ar) || "—"}</dd>
                </dl>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {on ? <button type="button" onClick={() => p.onDisconnect(n)} style={outline} className="dch4">{A("Disconnect", "فصل الرقم")}</button>
                    : <button type="button" onClick={p.onAdd} disabled={full} style={{ ...outline, opacity: full ? 0.5 : 1, cursor: full ? "not-allowed" : "pointer" }} className="dch4">{A("Link again", "ربط مرة أخرى")}</button>}
                </div>
              </article>
            );
          })}
          {/* Adding a number goes through the same guided flow as the first one. */}
          {!full && live.length > 0 && (
            <button type="button" onClick={p.onAdd} className="dch0" style={{ minHeight: 64, borderRadius: 18, border: `1.5px dashed #E3CBD4`, background: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", cursor: "pointer", textAlign: "start", color: INK }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "#FDEAF2", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="#8A2040" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{A("Add another number", "إضافة رقم آخر")}</span><span style={{ fontSize: 13, color: MUTED }}>{A(`Your plan includes up to ${p.limit} numbers`, `باقتك تشمل حتى ${p.limit} أرقام`)}</span></span>
              <Chevron ar={p.ar} />
            </button>
          )}
          {full && (
            <div style={{ borderRadius: 18, background: SOFT, padding: "14px 18px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span style={{ flex: "1 1 220px", fontSize: 14, lineHeight: 1.5, color: BODY }}>{p.limit === 1 ? A(`Your ${p.planName} plan includes 1 WhatsApp number.`, `باقة ${p.planName} تشمل رقم واتساب واحداً.`) : A(`Your ${p.planName} plan includes ${p.limit} WhatsApp numbers, and all are in use.`, `باقة ${p.planName} تشمل ${p.limit} أرقام واتساب، وكلها مستخدمة.`)}{p.canUpgrade ? A(" Upgrade to link more.", " قم بالترقية لربط المزيد.") : ""}</span>
              {p.canUpgrade && <button type="button" onClick={p.onUpgrade} style={{ ...outline, borderColor: "#FF5577", color: "#8A2040", fontWeight: 600 }} className="dch4">{A("Upgrade plan", "ترقية الباقة")}</button>}
            </div>
          )}
        </section>}

        {live.length > 0 && (
          <section aria-labelledby="wa-today" style={{ background: SOFT, borderRadius: 20, padding: "18px 22px 8px", display: "flex", flexDirection: "column" }}>
            <h2 id="wa-today" style={{ fontSize: 14, fontWeight: 600, color: MUTED, margin: "0 0 6px" }}>{A("Today, all numbers", "اليوم، كل الأرقام")}</h2>
            {p.stats.map((t, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "12px 0", borderTop: i ? "1px solid #EFE3E9" : 0 }}>
                <span style={{ fontSize: 15, color: BODY }}>{t.label}</span>
                <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", ...num }}>{t.v}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the guided link flow (opens in the WhatsApp drawer)

type Which = "login" | "other";
type Where = "business" | "personal" | "none";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, lineHeight: 1.5 }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${LINE}`, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#8A2040", ...num }}>{n}</span>
      <span style={{ paddingTop: 1, textWrap: "pretty" }}>{children}</span>
    </li>
  );
}
function Choice({ title, detail, tag, onPick, ar }: { title: React.ReactNode; detail: string; tag?: string; onPick: () => void; ar: boolean }) {
  return (
    <button type="button" onClick={onPick} className="dch0" style={{ width: "100%", textAlign: "start", border: `1.5px solid ${LINE}`, borderRadius: 16, background: "#fff", padding: "16px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", color: INK, minHeight: 72 }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600 }}>{title}{tag ? <span style={pill("#FDEAF2", "#8A2040")}>{tag}</span> : null}</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: BODY }}>{detail}</span>
      </span>
      <Chevron ar={ar} />
    </button>
  );
}
function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  return <div style={{ borderRadius: 14, padding: "12px 14px", background: tone === "warn" ? "#FFF6E5" : SOFT, color: tone === "warn" ? "#7A4B00" : BODY, fontSize: 14, lineHeight: 1.5, display: "flex", gap: 10 }}>{children}</div>;
}

export function WhatsAppLinkGuide(p: { ar: boolean; loginPhone: string; adding: boolean; onStart: (mode: LinkMode) => void; onLater: () => void }) {
  const A = (en: string, ar: string) => (p.ar ? ar : en);
  const [which, setWhich] = React.useState<Which | null>(null), [where, setWhere] = React.useState<Where | null>(null);
  const top = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { top.current?.parentElement?.scrollTo?.({ top: 0 }); top.current?.querySelector<HTMLElement>("h2")?.focus(); }, [which, where]);
  const back = () => { if (where) setWhere(null); else setWhich(null); };
  const theNumber = which === "login" ? <span style={{ ...num, whiteSpace: "nowrap" }}>{p.loginPhone}</span> : A("your number", "رقمك");
  const h2: React.CSSProperties = { fontSize: 24, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.15, margin: 0, textWrap: "balance", outline: "none" };
  const lead: React.CSSProperties = { fontSize: 15, lineHeight: 1.55, color: BODY, margin: 0, textWrap: "pretty" };
  const sub: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: MUTED, margin: "6px 0 0" };
  const card: React.CSSProperties = { border: `1.5px solid ${LINE}`, borderRadius: 16, padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10, background: "#fff" };
  const cardH: React.CSSProperties = { fontSize: 15, fontWeight: 600, margin: 0, color: INK };
  const list: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14.5, lineHeight: 1.5, color: BODY };
  const backBtn = <button type="button" onClick={back} style={{ ...quiet, alignSelf: "flex-start", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, color: MUTED, marginTop: -8 }}><span style={{ display: "inline-flex", transform: p.ar ? undefined : "scaleX(-1)" }}><Chevron ar={false} /></span>{A("Back", "رجوع")}</button>;

  let body: React.ReactNode;
  if (!which) {
    body = <>
      <span style={{ width: 56, height: 56, borderRadius: 16, background: "#EAF8EF", display: "flex", alignItems: "center", justifyContent: "center" }}><WaGlyph size={30} /></span>
      <h2 tabIndex={-1} style={h2}>{p.adding ? A("Add a WhatsApp number", "إضافة رقم واتساب") : A("Which number will customers message?", "على أي رقم سيراسلك العملاء؟")}</h2>
      <p style={lead}>{A("This is the number customers send their orders to. Lumia replies from it automatically.", "هذا هو الرقم الذي يرسل إليه العملاء طلباتهم. سيرد Lumia منه تلقائياً.")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Choice ar={p.ar} onPick={() => setWhich("login")} title={A("The number I signed in with", "الرقم الذي سجّلت به")} detail={p.loginPhone ? A(`${p.loginPhone}, the number you use to sign in to Lumia.`, `${p.loginPhone}، الرقم الذي تسجّل به في Lumia.`) : A("The number you use to sign in to Lumia.", "الرقم الذي تسجّل به في Lumia.")} />
        <Choice ar={p.ar} onPick={() => setWhich("other")} title={A("A different number", "رقم آخر")} detail={A("For example a separate WhatsApp for the restaurant, or a new SIM.", "مثل رقم واتساب منفصل للمطعم، أو شريحة جديدة.")} />
      </div>
      <Note><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}><circle cx="8" cy="8" r="7" stroke={MUTED} strokeWidth="1.4" /><path d="M8 7.2v4" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="4.9" r=".85" fill={MUTED} /></svg><span>{A("Your Lumia sign-in doesn't change. Linking only lets Lumia read and answer this number's customer chats.", "تسجيل دخولك إلى Lumia لا يتغير. الربط يسمح فقط لـ Lumia بقراءة محادثات العملاء على هذا الرقم والرد عليها.")}</span></Note>
    </>;
  } else if (!where) {
    body = <>
      {backBtn}
      <h2 tabIndex={-1} style={h2}>{which === "login" ? <>{A("Which WhatsApp app is ", "ما تطبيق واتساب المستخدم على ")}{theNumber}{A(" on?", "؟")}</> : A("Is this number on WhatsApp now?", "هل هذا الرقم مستخدم على واتساب الآن؟")}</h2>
      <p style={lead}>{A("This decides how Meta links it. You can check on the phone: the WhatsApp Business app has a shop icon.", "هذا يحدد طريقة الربط عبر Meta. يمكنك التحقق من الهاتف: تطبيق واتساب للأعمال عليه أيقونة متجر.")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Choice ar={p.ar} onPick={() => setWhere("business")} tag={A("Easiest", "الأسهل")} title={A("WhatsApp Business app", "تطبيق واتساب للأعمال")} detail={A("Keep using the app on your phone. Your chats and contacts stay.", "تستمر باستخدام التطبيق على هاتفك. محادثاتك وجهات الاتصال تبقى كما هي.")} />
        <Choice ar={p.ar} onPick={() => setWhere("personal")} title={A("Regular WhatsApp", "واتساب العادي")} detail={A("Move it to WhatsApp Business first. It's free and keeps your chats.", "انقله أولاً إلى واتساب للأعمال. مجاني ويحتفظ بمحادثاتك.")} />
        {which === "other" && <Choice ar={p.ar} onPick={() => setWhere("none")} title={A("Not on WhatsApp", "غير مستخدم على واتساب")} detail={A("A new number. You'll verify it with a code by SMS or call.", "رقم جديد. ستؤكده برمز عبر رسالة نصية أو مكالمة.")} />}
      </div>
    </>;
  } else if (where === "personal") {
    body = <>
      {backBtn}
      <h2 tabIndex={-1} style={h2}>{A("First, move the number to WhatsApp Business", "أولاً، انقل الرقم إلى واتساب للأعمال")}</h2>
      <p style={lead}>{A("Meta only links numbers that use the WhatsApp Business app (or no WhatsApp at all). Moving takes about 2 minutes and keeps your chats.", "تربط Meta فقط الأرقام التي تستخدم تطبيق واتساب للأعمال (أو غير المستخدمة على واتساب). النقل يستغرق دقيقتين تقريباً ويحتفظ بمحادثاتك.")}</p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <Step n={1}>{A("Back up your chats in WhatsApp: Settings → Chats → Chat backup.", "انسخ محادثاتك احتياطياً في واتساب: الإعدادات ← الدردشات ← النسخ الاحتياطي.")}</Step>
        <Step n={2}>{A("Install WhatsApp Business from the App Store or Google Play.", "ثبّت واتساب للأعمال من App Store أو Google Play.")}</Step>
        <Step n={3}>{A("Open it and choose to use ", "افتحه واختر استخدام ")}{theNumber}{A(". It offers to move your account and chats.", ". سيعرض نقل حسابك ومحادثاتك.")}</Step>
        <Step n={4}>{A("Add your restaurant name and logo, then come back here.", "أضف اسم مطعمك وشعاره، ثم عد إلى هنا.")}</Step>
      </ol>
      {which === "login" && <Note><span>{A("You'll still sign in to Lumia with this number. Codes arrive in the WhatsApp Business app instead.", "ستستمر بتسجيل الدخول إلى Lumia بهذا الرقم، وستصلك الرموز على تطبيق واتساب للأعمال.")}</span></Note>}
      <button type="button" onClick={() => setWhere("business")} style={{ ...gradient, minHeight: 54, fontSize: 16 }} className="dch1">{A("Done, it's on WhatsApp Business", "تم، الرقم على واتساب للأعمال")}</button>
    </>;
  } else {
    const existing = where === "business";
    const li = (bold: string, rest: string) => <li style={{ display: "flex", gap: 10 }}><Check /><span style={{ textWrap: "pretty" }}><b style={{ fontWeight: 600, color: INK }}>{bold}</b> {rest}</span></li>;
    body = <>
      {backBtn}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {existing && <span style={{ ...pill("#EAF8EF", GREEN), alignSelf: "flex-start" }}>{A("WhatsApp Coexistence · New from Meta", "واتساب Coexistence · ميزة جديدة من Meta")}</span>}
        <h2 tabIndex={-1} style={h2}>{existing ? <>{A("Link your WhatsApp Business app", "اربط تطبيق واتساب للأعمال")}</> : <>{A("Link ", "ربط ")}{theNumber}{A(" with Meta", " عبر Meta")}</>}</h2>
      </div>
      <p style={lead}>{existing ? <>{A("Keep using the app on your phone while Lumia takes orders on ", "استمر باستخدام التطبيق على هاتفك بينما يستقبل Lumia الطلبات على ")}{theNumber}{A(". Same number, same chats, both working together.", ". نفس الرقم ونفس المحادثات، والاثنان يعملان معاً.")}</> : A("Meta opens in a new window. Keep the phone with this SIM nearby to receive the code.", "ستُفتح Meta في نافذة جديدة. أبقِ الهاتف الذي فيه هذه الشريحة قريباً لاستلام الرمز.")}</p>
      {existing && <Note tone="warn"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}><circle cx="8" cy="8" r="7" fill="#F2A007" /><path d="M8 4.4v4.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /><circle cx="8" cy="11.2" r=".9" fill="#fff" /></svg><span>{A("Linking the WhatsApp Business app (WhatsApp Coexistence) is a new feature from Meta. A few app features may be limited while Meta expands support.", "ربط تطبيق واتساب للأعمال (WhatsApp Coexistence) ميزة جديدة من Meta. قد تكون بعض ميزات التطبيق محدودة إلى أن توسّع Meta دعمها.")}</span></Note>}

      <section style={card}>
        <h3 style={cardH}>{A("Before you connect", "قبل الربط")}</h3>
        <ul style={list}>
          {li(A("A Facebook account.", "حساب فيسبوك."), A("Meta uses it to confirm you own the business.", "تستخدمه Meta لتأكيد ملكيتك للنشاط."))}
          {li(A("A business portfolio on Meta.", "حافظة أعمال (Business portfolio) على Meta."), A("You'll select it during linking. If you don't have one yet, Meta lets you create it there with your restaurant's name.", "ستختارها أثناء الربط. إن لم تكن لديك واحدة، يمكنك إنشاؤها هناك باسم مطعمك."))}
          {existing ? li(A("WhatsApp Business app up to date,", "تطبيق واتساب للأعمال محدّث،"), A("with your phone nearby to approve the link.", "وهاتفك قريب منك للموافقة على الربط."))
            : li(A("The number can receive an SMS or a call", "الرقم يستقبل رسالة نصية أو مكالمة"), A("for the verification code.", "لرمز التحقق."))}
        </ul>
      </section>
      {!existing && <Note tone="warn"><span>{A("If this number is on WhatsApp, Meta will refuse it. Use the WhatsApp Business option instead, or delete that WhatsApp account first.", "إذا كان الرقم مستخدماً على واتساب سترفضه Meta. اختر خيار واتساب للأعمال بدلاً من ذلك، أو احذف حساب واتساب أولاً.")}</span></Note>}

      <h3 style={sub}>{A("What you'll do on Meta", "ما ستفعله في Meta")}</h3>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <Step n={1}>{A("Sign in with Facebook.", "سجّل الدخول بفيسبوك.")}</Step>
        <Step n={2}><b style={{ fontWeight: 600 }}>{A("Select your business portfolio", "اختر حافظة أعمالك")}</b>{A(", or create one with your restaurant's name.", "، أو أنشئ واحدة باسم مطعمك.")}</Step>
        {existing ? <>
          <Step n={3}>{A("Choose “Connect your existing WhatsApp Business app” and enter ", "اختر «ربط تطبيق واتساب للأعمال الحالي» وأدخل ")}{theNumber}.</Step>
          <Step n={4}>{A("On your phone, open WhatsApp Business and approve the request Meta sends (or scan the QR code shown).", "على هاتفك، افتح واتساب للأعمال ووافق على الطلب الذي ترسله Meta (أو امسح رمز QR الظاهر).")}</Step>
        </> : <>
          <Step n={3}>{A("Choose “Add a new number”, enter it, and type the code you get by SMS or call.", "اختر «إضافة رقم جديد»، أدخله، واكتب الرمز الذي يصلك برسالة أو مكالمة.")}</Step>
          <Step n={4}>{A("Set the display name customers will see: your restaurant's name.", "حدّد الاسم الظاهر للعملاء: اسم مطعمك.")}</Step>
        </>}
        <Step n={5}>{A("Allow Lumia Order access and tap Finish. You'll come back here with the number linked.", "اسمح لتطبيق Lumia Order بالوصول واضغط إنهاء. ستعود إلى هنا والرقم مربوط.")}</Step>
      </ol>

      <section style={card}>
        <h3 style={cardH}>{A("After you connect", "بعد الربط")}</h3>
        <ul style={list}>
          {existing ? <>
            {li(A("Open the WhatsApp Business app at least once every 14 days", "افتح تطبيق واتساب للأعمال مرة كل 14 يوماً على الأقل"), A("to keep the number linked.", "ليبقى الرقم مربوطاً."))}
            {li(A("WhatsApp for Windows and WearOS aren't supported", "واتساب لويندوز وساعات WearOS غير مدعومة"), A("by Meta for coexistence. Messages from those devices won't reach Lumia.", "من Meta مع هذه الميزة. الرسائل من هذه الأجهزة لن تصل إلى Lumia."))}
            {li(A("Calls stay in the app.", "المكالمات تبقى في التطبيق."), A("Lumia answers messages; you keep chatting and calling from your phone as usual.", "يرد Lumia على الرسائل، وتستمر أنت بالمراسلة والاتصال من هاتفك كالمعتاد."))}
          </> : <>
            {li(A("The number works through Lumia only.", "الرقم يعمل عبر Lumia فقط."), A("It can't be used in a WhatsApp app on a phone at the same time.", "لا يمكن استخدامه في تطبيق واتساب على الهاتف في الوقت نفسه."))}
            {li(A("Every chat shows up in Lumia,", "كل المحادثات تظهر في Lumia،"), A("and orders arrive here and on your terminal.", "والطلبات تصل هنا وإلى جهازك."))}
          </>}
        </ul>
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: "#EEF4FF", color: "#1D3A6E", fontSize: 14, lineHeight: 1.5 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}><path d="M10 2 3.5 4.6v4.6c0 4 2.8 7.4 6.5 8.8 3.7-1.4 6.5-4.8 6.5-8.8V4.6L10 2Z" fill="#1877F2" /><path d="m7 10 2.1 2.1L13.2 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span style={{ textWrap: "pretty" }}><b style={{ fontWeight: 600 }}>{A("Lumia Order is a verified Meta partner.", "Lumia Order شريك موثّق لدى Meta.")}</b> {A("You approve access on Meta's own window, and you can disconnect the number any time from this page.", "توافق على الوصول من نافذة Meta نفسها، ويمكنك فصل الرقم في أي وقت من هذه الصفحة.")}</span>
      </div>
      <button type="button" onClick={() => p.onStart(existing ? "existing" : "new")} style={{ minHeight: 54, padding: "0 20px", borderRadius: 12, border: 0, background: "#1877F2", color: "#fff", fontWeight: 600, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 10px 24px -12px rgba(24,119,242,.6)" }} className="dch1"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}><rect width="24" height="24" rx="5" fill="#fff" /><path d="M16.5 24v-9.3h3.1l.5-3.6h-3.6V8.8c0-1 .3-1.8 1.8-1.8h1.9V3.8c-.3 0-1.5-.1-2.8-.1-2.8 0-4.6 1.7-4.6 4.8v2.6H9.6v3.6h3.2V24h3.7Z" fill="#1877F2" /></svg>{A("Connect with Facebook", "الربط عبر فيسبوك")}</button>
    </>;
  }
  return (
    <div ref={top} dir={p.ar ? "rtl" : "ltr"} style={{ flex: 1, overflow: "auto", padding: "24px 24px 28px", display: "flex", flexDirection: "column", gap: 16, color: INK }}>
      {body}
      {!which && <button type="button" onClick={p.onLater} style={{ ...quiet, alignSelf: "center" }} className="dch2">{A("Do this later", "لاحقاً")}</button>}
    </div>
  );
}
