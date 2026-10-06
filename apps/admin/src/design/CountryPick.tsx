"use client";
// The country the restaurant operates in (asked once, when the restaurant is created). Fetches the markets so a market that is not open is shown as such.
import React from "react";
import { COUNTRIES } from "@/modules/auth/countries";

interface M { code: string; nameEn: string; nameAr: string; flag: string; currency: string; registrationEnabled: boolean; paidActivationEnabled: boolean }
export function CountryPick({ value, onChange, ar }: { value: string; onChange: (code: string) => void; ar?: boolean }) {
  const [markets, setMarkets] = React.useState<M[] | null>(null);
  React.useEffect(() => { let live = true; fetch("/api/v1/markets", { cache: "no-store" }).then(r => r.json()).then(j => live && setMarkets(j.data ?? j)).catch(() => undefined); return () => { live = false; }; }, []);
  const list: M[] = markets ?? COUNTRIES.map(c => ({ code: c.code, nameEn: c.name, nameAr: c.nameAr, flag: c.flag, currency: "", registrationEnabled: true, paidActivationEnabled: true }));
  const cur = list.find(m => m.code === value), t = ar
    ? { label: "الدولة", note: "لا يمكن تغيير الدولة بعد إضافة القائمة أو الفروع أو الفوترة. العملة: ", soon: "الاشتراكات المدفوعة غير متاحة بعد في هذه الدولة، لكن يمكنك تجهيز مطعمك.", closed: "(قريباً)" }
    : { label: "Country", note: "The country can’t be changed once you add a menu with prices, branches or billing. Currency: ", soon: "Paid plans are not open in this country yet, but you can set up your restaurant now.", closed: "(coming soon)" };
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ marginTop: 22 }}>
      <label htmlFor="pd-country" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#3D1C31" }}>{t.label}</label>
      <select id="pd-country" value={value} onChange={e => onChange(e.target.value)} style={{ marginTop: 8, height: 56, width: "100%", borderRadius: 14, border: "1.5px solid #E3CBD4", padding: "0 14px", fontSize: 17, background: "#fff" }}>
        {list.map(m => <option key={m.code} value={m.code} disabled={!m.registrationEnabled}>{m.flag} {ar ? m.nameAr : m.nameEn}{m.registrationEnabled ? "" : ` ${t.closed}`}</option>)}
      </select>
      <div style={{ marginTop: 8, fontSize: 13, color: "#8A5A6E", lineHeight: 1.5 }}>{t.note}{cur?.currency || ""}.</div>
      {cur && !cur.paidActivationEnabled && <div style={{ marginTop: 6, fontSize: 13, color: "#8A4B00" }}>{t.soon}</div>}
    </div>
  );
}
