"use client";
// Confirm the restaurant's contact email with a code sent to it. Used as a banner on the dashboard and inside Settings → Profile.
import React from "react";

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? "Something went wrong. Please try again.");
  return json.data ?? json;
}
const input: React.CSSProperties = { height: 44, flex: "1 1 220px", minWidth: 0, padding: "0 12px", borderRadius: 10, border: "1.5px solid #ECD9E0", background: "#fff", fontSize: 15 };
const btn: React.CSSProperties = { height: 44, padding: "0 18px", borderRadius: 12, border: 0, background: "linear-gradient(90deg,#FF5577,#C93DFF)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", flex: "none" };
const T = {
  en: { title: "Add your email to get plan reminders", why: "We email you before your trial or plan ends, and if a payment fails. Phone sign-in has no email, so add one here.", ph: "name@restaurant.com", send: "Send code", sending: "Sending…", code: "6-digit code", verify: "Verify", verifying: "Verifying…", sentTo: (e: string) => `We sent a code to ${e}.`, resend: "Send a new code", wait: (n: number) => `Send a new code in ${n}s`, change: "Use a different email", verified: "Verified", done: (e: string) => `${e} is verified. Reminders will go there.`, notVerified: "Not verified yet", settingsLabel: "Verify this email" },
  ar: { title: "أضف بريدك لتصلك تنبيهات الباقة", why: "نراسلك قبل انتهاء التجربة أو الباقة وعند فشل الدفع. تسجيل الدخول بالهاتف لا يحتوي بريداً، لذا أضفه هنا.", ph: "name@restaurant.com", send: "إرسال الرمز", sending: "جارٍ الإرسال…", code: "الرمز المكوّن من 6 أرقام", verify: "تحقق", verifying: "جارٍ التحقق…", sentTo: (e: string) => `أرسلنا رمزاً إلى ${e}.`, resend: "إرسال رمز جديد", wait: (n: number) => `رمز جديد بعد ${n} ث`, change: "استخدام بريد آخر", verified: "موثّق", done: (e: string) => `تم توثيق ${e}. ستصلك التنبيهات عليه.`, notVerified: "غير موثّق بعد", settingsLabel: "وثّق هذا البريد" },
};

export function EmailVerify({ businessId, email: initial, verified: initialVerified, ar, variant, draft, onVerified }: { businessId: string; email: string; verified: boolean; ar?: boolean; variant: "banner" | "settings"; draft?: string; onVerified?: (email: string) => void }) {
  const t = ar ? T.ar : T.en, base = `/api/v1/businesses/${businessId}/contact-email`;
  const [email, setEmail] = React.useState(initial), [code, setCode] = React.useState(""), [step, setStep] = React.useState<"email" | "code">("email");
  const [verified, setVerified] = React.useState(initialVerified), [busy, setBusy] = React.useState(false), [err, setErr] = React.useState(""), [left, setLeft] = React.useState(0);
  React.useEffect(() => { if (left <= 0) return; const id = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(id); }, [left]);
  React.useEffect(() => { setVerified(initialVerified); }, [initialVerified]);
  const target = (variant === "settings" ? draft ?? initial : email).trim();
  const start = async () => { setBusy(true); setErr(""); try { const r = await post(base, { email: target, lang: ar ? "ar" : "en" }); if (r.alreadyVerified) { setVerified(true); onVerified?.(target); } else { setStep("code"); setCode(""); setLeft(r.resendAfter ?? 30); } } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const confirm = async () => { setBusy(true); setErr(""); try { const r = await post(`${base}/verify`, { code }); setVerified(true); setStep("email"); onVerified?.(r.email); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const dir = ar ? "rtl" : "ltr";

  if (variant === "settings") {
    if (!initial && !draft) return null;
    return (
      <div dir={dir} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        {verified && target === initial ? <span style={{ fontSize: 13, fontWeight: 600, color: "#16704A" }}>✓ {t.verified}</span> : step === "email" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#8A4B00" }}>{t.notVerified}</span>
            <button type="button" disabled={busy || !target} onClick={start} style={{ ...btn, height: 34, padding: "0 14px", opacity: busy || !target ? 0.6 : 1 }}>{busy ? t.sending : t.settingsLabel}</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#3D1C31" }}>{t.sentTo(target)}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder={t.code} style={input} />
              <button type="button" disabled={busy || code.length !== 6} onClick={confirm} style={{ ...btn, opacity: busy || code.length !== 6 ? 0.6 : 1 }}>{busy ? t.verifying : t.verify}</button>
            </div>
            <button type="button" disabled={left > 0 || busy} onClick={start} style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 600, textDecoration: "underline", color: left > 0 ? "#8A5A6E" : "#C0284F" }}>{left > 0 ? t.wait(left) : t.resend}</button>
          </div>
        )}
        {err && <div role="alert" style={{ fontSize: 13, color: "#B4233B" }}>{err}</div>}
      </div>
    );
  }

  if (verified) return null;
  return (
    <div dir={dir} style={{ flex: "none", border: "1px solid #F5D7B4", background: "#FFF8EE", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#5C3200" }}>{t.title}</div>
      <div style={{ fontSize: 13, color: "#7A5A2E", lineHeight: 1.5 }}>{t.why}</div>
      {step === "email" ? (
        <form onSubmit={e => { e.preventDefault(); if (!busy && email.trim()) start(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.ph} autoComplete="email" style={input} />
          <button type="submit" disabled={busy || !email.trim()} style={{ ...btn, opacity: busy || !email.trim() ? 0.6 : 1 }}>{busy ? t.sending : t.send}</button>
        </form>
      ) : (
        <form onSubmit={e => { e.preventDefault(); if (!busy && code.length === 6) confirm(); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#3D1C31" }}>{t.sentTo(target)}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder={t.code} autoFocus style={input} />
            <button type="submit" disabled={busy || code.length !== 6} style={{ ...btn, opacity: busy || code.length !== 6 ? 0.6 : 1 }}>{busy ? t.verifying : t.verify}</button>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button type="button" disabled={left > 0 || busy} onClick={start} style={{ fontSize: 13, fontWeight: 600, textDecoration: "underline", color: left > 0 ? "#8A5A6E" : "#C0284F" }}>{left > 0 ? t.wait(left) : t.resend}</button>
            <button type="button" onClick={() => { setStep("email"); setErr(""); }} style={{ fontSize: 13, fontWeight: 600, textDecoration: "underline", color: "#8A5A6E" }}>{t.change}</button>
          </div>
        </form>
      )}
      {err && <div role="alert" style={{ fontSize: 13, color: "#B4233B" }}>{err}</div>}
    </div>
  );
}
