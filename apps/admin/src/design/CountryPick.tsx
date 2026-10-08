"use client";
// The country of the restaurant. It is not chosen: it follows the phone number used to sign in the first time (+971 UAE, +966 Saudi Arabia, ...), and it fixes the currency.
import React from "react";
import { COUNTRIES } from "@/modules/auth/countries";
import { isCountryCode, MARKETS } from "@/modules/market/countries";

export function CountryPick({ value, ar, vat = "", onVat }: { value: string; ar?: boolean; vat?: string; onVat?: (v: string) => void }) {
  const c = COUNTRIES.find(x => x.code === value), m = isCountryCode(value) ? MARKETS[value] : null;
  const t = ar
    ? { label: "الدولة", note: "تتبع دولة مطعمك رقم هاتفك، ولا يمكن تغييرها. العملة: ", vat: "رقم التسجيل في ضريبة القيمة المضافة", vatNote: "يمكن فقط للمطاعم المسجلة في ضريبة القيمة المضافة فتح حساب في هذه الدولة. يراجع فريقنا الرقم قبل تفعيل مطعمك." }
    : { label: "Country", note: "Your restaurant's country follows your phone number and can't be changed. Currency: ", vat: "VAT registration number", vatNote: "Only VAT-registered restaurants can open an account in this country. Our team checks the number before your restaurant goes live." };
  if (!c || !m) return null;
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ marginTop: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#3D1C31" }}>{t.label}</div>
      <div style={{ marginTop: 8, height: 56, width: "100%", borderRadius: 14, border: "1.5px solid #E3CBD4", padding: "0 14px", fontSize: 17, background: "#FBF7F9", display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box" }} aria-label={t.label}>
        <span aria-hidden="true">{c.flag}</span><span>{ar ? c.nameAr : c.name}</span><span dir="ltr" style={{ marginInlineStart: "auto", color: "#8A5A6E", fontSize: 15 }}>{m.dial}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: "#8A5A6E", lineHeight: 1.5 }}>{t.note}{m.currency}.</div>
      {m.requiresVerifiedVatForSaas && onVat && <div style={{ marginTop: 16 }}>
        <label htmlFor="pd-vat" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#3D1C31" }}>{t.vat}</label>
        <input id="pd-vat" value={vat} onChange={e => onVat(e.target.value)} dir="ltr" autoComplete="off" inputMode="text" maxLength={30} style={{ marginTop: 8, height: 56, width: "100%", borderRadius: 14, border: "1.5px solid #E3CBD4", padding: "0 14px", fontSize: 17, background: "#fff", boxSizing: "border-box" }} />
        <div style={{ marginTop: 8, fontSize: 13, color: "#8A5A6E", lineHeight: 1.5 }}>{t.vatNote}</div>
      </div>}
    </div>
  );
}
