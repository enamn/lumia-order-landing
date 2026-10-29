"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY diagnostic page (Stripe test mode only): shows what Stripe offers for Apple Pay and Google Pay in this browser. Removed after the check.
import { useEffect, useRef, useState } from "react";
const PK = "pk_test_51UFowED9zGLNL7GR5QZth5LrxweDdrrBWS1Rlp0cKUxrlbWttsHFL09V9ak1njzL1gsIYFmg5siffi3vYTMFNojZ00h0Z2Q4Kx";
const load = (src: string, attr?: string) => new Promise<void>(res => { const s = document.createElement("script"); s.src = src; if (attr) s.crossOrigin = "anonymous"; s.onload = () => res(); s.onerror = () => res(); document.head.appendChild(s); setTimeout(res, 5000); });
export default function WalletTest() {
  const slot = useRef<HTMLDivElement>(null); const [log, setLog] = useState<string[]>([]);
  const say = (m: string) => setLog(l => [...l, m]);
  useEffect(() => {
    (async () => {
      const q = new URLSearchParams(location.search), cs = q.get("cs") ?? "", sdk = q.get("sdk") !== "0", always = q.get("always") !== "0";
      window.addEventListener("error", e => say("window error: " + e.message));
      say(`https=${location.protocol === "https:"} host=${location.host} sdk=${sdk} applePay=${always ? "always" : "auto"}`);
      if (sdk) await load("https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js", "a");
      say("ApplePaySession: " + typeof (window as any).ApplePaySession);
      await load("https://js.stripe.com/v3/");
      try {
        const stripe = (window as any).Stripe(PK), elements = stripe.elements({ clientSecret: cs, locale: "en" });
        const ex = elements.create("expressCheckout", { buttonHeight: 48, paymentMethods: { applePay: always ? "always" : "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" }, layout: { maxColumns: 2, maxRows: 1, overflow: "never" } });
        ex.on("ready", (e: any) => say("READY " + JSON.stringify(e?.availablePaymentMethods ?? null)));
        ex.on("loaderror", (e: any) => say("LOADERROR " + JSON.stringify(e?.error ?? e)));
        ex.on("click", () => say("button clicked"));
        ex.mount(slot.current!);
        setTimeout(() => say("slot height after 5s: " + (slot.current?.offsetHeight ?? 0) + "px, iframes: " + slot.current?.querySelectorAll("iframe").length), 5000);
      } catch (e: any) { say("ERROR creating element: " + (e?.message ?? e)); }
    })();
  }, []);
  return <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}><h1 style={{ fontSize: 18 }}>Wallet check (test)</h1><div ref={slot} style={{ minHeight: 8, margin: "12px 0" }} /><pre data-testid="log" style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{log.join("\n")}</pre></main>;
}
