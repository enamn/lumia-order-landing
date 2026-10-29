"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// The popup for adding or replacing the card that pays renewals: our own title and buttons around Stripe's secure fields (name and address, then card,
// Apple Pay or Google Pay). Card details go straight to Stripe's frames, never through Lumia. The popup is as tall as its form: nothing scrolls inside it.
import React from "react";
import { LumiaLoader } from "@/components/lumia-loader";

const INK = "#1A0815", MUTED = "#8A5A6E", LINE = "#F0E4E8";
async function loadStripeJs(): Promise<(key: string) => any> {
  const w = window as any;
  if (!w.Stripe) await new Promise<void>((resolve, reject) => { const s = document.createElement("script"); s.src = "https://js.stripe.com/v3/"; s.onload = () => resolve(); s.onerror = () => reject(Error("We couldn’t load the payment form.")); document.head.appendChild(s); });
  if (!w.Stripe) throw Error("We couldn’t load the payment form.");
  return w.Stripe;
}

// Apple's web script: it lets Apple Pay work in Chrome, Firefox and Edge on a computer (the customer scans a QR code with an iPhone). Safari has Apple Pay built in.
// If it cannot load the popup works without it.
async function loadApplePayScript() {
  const w = window as any;
  if (w.ApplePaySession || document.querySelector("script[data-apple-pay]")) return;
  await new Promise<void>(resolve => { const s = document.createElement("script"); s.src = "https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js"; s.crossOrigin = "anonymous"; s.dataset.applePay = "1"; s.onload = () => resolve(); s.onerror = () => resolve(); document.head.appendChild(s); setTimeout(resolve, 4000); });
}

export function CardDialog({ ar, base, api, onClose, onSaved }: { ar: boolean; base: string; api: (path: string, method?: string, body?: unknown) => Promise<any>; onClose: () => void; onSaved: () => void }) {
  const t = (en: string, a: string) => (ar ? a : en);
  const expressSlot = React.useRef<HTMLDivElement>(null), addressSlot = React.useRef<HTMLDivElement>(null), paymentSlot = React.useRef<HTMLDivElement>(null), dialogRef = React.useRef<HTMLDivElement>(null);
  const live = React.useRef<{ stripe: any; elements: any; clientSecret: string; email?: string } | null>(null);
  const [ready, setReady] = React.useState(false), [saving, setSaving] = React.useState(false), [error, setError] = React.useState(""), [wallets, setWallets] = React.useState(false), [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    let gone = false, elements: any = null;
    (async () => {
      try {
        const r = await api(`${base}/card-setup`, "POST");
        const [Stripe] = await Promise.all([loadStripeJs(), loadApplePayScript()]);
        if (gone) return;
        const stripe = Stripe(r.publishableKey);
        elements = stripe.elements({
          clientSecret: r.clientSecret, locale: ar ? "ar" : "en",
          appearance: { theme: "stripe", variables: { colorPrimary: "#F0446F", colorText: INK, colorTextSecondary: MUTED, colorDanger: "#B42318", borderRadius: "12px", fontFamily: "Geist, system-ui, sans-serif", spacingUnit: "4px" } },
        });
        // Name and address come from the address field; the card field then asks only for the card itself.
        const address = elements.create("address", { mode: "billing", defaultValues: { name: r.name ?? "", address: { country: "AE" } } });
        const payment = elements.create("payment", { layout: "tabs", wallets: { applePay: "never", googlePay: "never" }, fields: { billingDetails: { name: "never", email: "never", address: "never" } } });
        // Apple Pay and Google Pay: their own buttons at the top. Apple Pay is always offered: in Chrome and Firefox on a computer it asks the customer to scan a QR code with their iPhone.
        const express = elements.create("expressCheckout", { buttonHeight: 48, paymentMethods: { applePay: "always", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" }, layout: { maxColumns: 2, maxRows: 1, overflow: "never" } });
        // Whether a wallet button really drew itself (Stripe draws none when the browser has no wallet to offer).
        express.on("ready", (e: any) => { console.info("wallets reported by Stripe:", JSON.stringify(e?.availablePaymentMethods ?? null)); setTimeout(() => { if (!gone) setWallets((expressSlot.current?.offsetHeight ?? 0) > 20); setChecked(true); }, 400); });
        express.on("confirm", () => { void confirm(); });
        express.mount(expressSlot.current!); address.mount(addressSlot.current!); payment.mount(paymentSlot.current!);
        payment.on("ready", () => { if (!gone) setReady(true); });
        live.current = { stripe, elements, clientSecret: r.clientSecret, email: r.email };
      } catch (e: any) { if (!gone) setError(e.message || t("We couldn’t load the payment form.", "تعذّر تحميل نموذج الدفع.")); }
    })();
    return () => { gone = true; try { elements?.getElement?.("expressCheckout")?.destroy(); elements?.getElement?.("address")?.destroy(); elements?.getElement?.("payment")?.destroy(); } catch { /* already gone */ } live.current = null; };
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { dialogRef.current?.focus(); }, []);

  // Used by the Update button and by the Apple Pay / Google Pay buttons: Stripe confirms the card, then Lumia saves it.
  async function confirm() {
    const l = live.current; if (!l || saving) return;
    setSaving(true); setError("");
    try {
      const { error: err, setupIntent } = await l.stripe.confirmSetup({ elements: l.elements, clientSecret: l.clientSecret, redirect: "if_required", confirmParams: { return_url: window.location.href, payment_method_data: { billing_details: l.email ? { email: l.email } : {} } } });
      if (err) { setError(err.message || t("The card could not be saved.", "تعذّر حفظ البطاقة.")); setSaving(false); return; }
      await api(`${base}/card-confirm`, "POST", { setupIntentId: setupIntent.id });
      onSaved();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }
  const save = confirm;

  const btn: React.CSSProperties = { minHeight: 44, padding: "0 22px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" };
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", overflowY: "auto", padding: 16, background: "rgba(26,8,21,.5)", backdropFilter: "blur(3px)" }}
    onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }} onKeyDown={e => { if (e.key === "Escape" && !saving) onClose(); }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("Update payment method", "تحديث طريقة الدفع")} dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}
      style={{ width: "100%", maxWidth: 520, margin: "auto", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(26,8,21,.5)", outline: "none", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 24px 8px" }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: ar ? 0 : "-0.015em" }}>{t("Update payment method", "تحديث طريقة الدفع")}</h2>
        <button type="button" aria-label={t("Close", "إغلاق")} disabled={saving} onClick={onClose} style={{ width: 44, height: 44, border: 0, background: "none", borderRadius: 12, fontSize: 24, lineHeight: 1, color: MUTED, cursor: "pointer", flex: "none" }}>×</button>
      </div>
      <div style={{ padding: "4px 24px 8px", display: "flex", flexDirection: "column", gap: 16, minHeight: ready || error ? undefined : 260, position: "relative" }}>
        {!ready && !error && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><LumiaLoader size={56} /></div>}
        <div style={{ opacity: ready ? 1 : 0 }}><div ref={expressSlot} /></div>
        {ready && checked && (wallets
          ? <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: MUTED }}>{t("Or enter your card", "أو أدخل بطاقتك")}</p>
          : <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: MUTED }}>{t("Apple Pay and Google Pay are not offered by this browser. Open Billing in Safari with a card in Apple Wallet, or in Chrome signed in to Google Pay.", "لا يعرض هذا المتصفح Apple Pay وGoogle Pay. افتح الفوترة في Safari ومعك بطاقة في Apple Wallet، أو في Chrome مسجّلاً الدخول إلى Google Pay.")}</p>)}
        <div style={{ opacity: ready ? 1 : 0 }}><div ref={addressSlot} /></div>
        <div style={{ opacity: ready ? 1 : 0 }}><div ref={paymentSlot} /></div>
        {error && <div role="alert" style={{ padding: "12px 14px", borderRadius: 12, background: "#FDECEC", color: "#8A1F14", fontSize: 14, lineHeight: 1.5 }}>{error}</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "8px 24px 20px", borderTop: `1px solid ${LINE}`, marginTop: 8, paddingTop: 16 }}>
        <button type="button" disabled={saving} onClick={onClose} style={{ ...btn, border: "1.5px solid #ECD9E0", background: "#fff", color: INK }}>{t("Cancel", "إلغاء")}</button>
        <button type="button" disabled={!ready || saving} onClick={save} style={{ ...btn, border: 0, color: "#fff", background: "linear-gradient(90deg,#FF5577,#C93DFF)", opacity: !ready || saving ? 0.6 : 1, cursor: !ready || saving ? "not-allowed" : "pointer" }}>{saving ? t("Saving…", "جارٍ الحفظ…") : t("Update", "تحديث")}</button>
      </div>
    </div>
  </div>;
}
