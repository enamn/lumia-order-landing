"use client";
// The campaign as it lands in the customer's WhatsApp. One phone, three shapes: a message, swipeable picks, a priced list.
// Always visible next to the form, so every choice shows its result straight away.
import React from "react";
import { formatMoney } from "@/modules/market/money";
import { PhoneFrame } from "./PhoneFrame";

export type CampaignItem = { id: string; name: string; nameAr?: string; category: string; categoryAr?: string; priceMinor: number; available: boolean; imageUrl?: string };
export type CampaignKind = "message" | "picks" | "list";

const WA_TEXT = "#111B21", WA_MUTED = "#667781", WA_LINE = "#E9EDEF", WA_ACTION = "#027EB5";
const css = `
.cv-btn{display:block;width:100%;text-align:center;border:0;background:#fff;color:${WA_ACTION};font:inherit;font-size:14px;font-weight:500;padding:10px 12px;border-radius:10px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.cv-rail{display:flex;gap:6px;overflow-x:auto;padding:0 0 4px;scroll-snap-type:x mandatory;scrollbar-width:none}
.cv-rail::-webkit-scrollbar{display:none}
`;

export function CampaignPreview(p: {
  ar: boolean; kind: CampaignKind; business: string; currency: string; text: string; offer: string; photo: string | null; items: CampaignItem[]; sample: string;
}) {
  const A = (en: string, ar: string) => (p.ar ? ar : en);
  const name = (i: CampaignItem) => (p.ar ? i.nameAr || i.name : i.name);
  const price = (m: number) => formatMoney(m, p.currency, p.ar ? "ar-AE-u-nu-latn" : "en-GB");
  const rtl = p.ar || /[؀-ۿ]/.test(p.text);
  const stop = A("Reply STOP to unsubscribe.", "أرسل «إيقاف» لإلغاء الاشتراك.");
  const bubble: React.CSSProperties = { maxWidth: "92%", background: "#fff", borderRadius: 10, borderStartStartRadius: 2, padding: 4, boxShadow: "0 1px 1px rgba(0,0,0,.08)", color: WA_TEXT, fontSize: 14, lineHeight: 1.45 };
  const copy: React.CSSProperties = { padding: "6px 8px 2px", display: "flex", flexDirection: "column", gap: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
  const small: React.CSSProperties = { fontSize: 12, color: WA_MUTED };
  const nums: React.CSSProperties = { direction: "ltr", unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" };
  const body = (p.text.trim() ? p.text.replace(/\{name\}/g, p.sample) : "") || A("Your message appears here", "ستظهر رسالتك هنا");
  const tile = (i: CampaignItem, h: number) => i.imageUrl ? <img src={i.imageUrl} alt="" style={{ display: "block", width: "100%", height: h, objectFit: "cover", borderRadius: 7 }} /> : <div style={{ height: h, borderRadius: 7, background: "#E5EEE2", color: "#1E3A2F", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, textAlign: "center", fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{name(i)}</div>;
  const total = p.items.reduce((n, i) => n + i.priceMinor, 0);

  return <PhoneFrame name={p.business} ar={p.ar} rtl={rtl} caption={A("Approximate. WhatsApp shows the final look.", "تقريبي. يعرض واتساب الشكل النهائي.")}>
    <style>{css}</style>
      {p.kind === "message" && <>
        <div style={bubble}>
          {p.photo && <img src={p.photo} alt="" style={{ display: "block", width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 7 }} />}
          <div style={copy}><span style={p.text.trim() ? undefined : { color: "#8696A0" }}>{body}</span>{p.offer && <b>{p.offer}</b>}<span style={small}>{p.business}</span><span style={small}>{stop}</span></div>
          <span style={{ display: "block", textAlign: "end", ...small, padding: "0 8px 2px", ...nums }}>12:30</span>
        </div>
        <div style={{ width: "92%" }}><span className="cv-btn">{A("Order now", "اطلب الآن")}</span></div>
      </>}

      {p.kind === "picks" && <>
        {!p.items.length ? <div style={{ ...bubble, padding: 12, color: WA_MUTED }}>{A("Pick items to see the cards", "اختر أصنافاً لتظهر البطاقات")}</div> : <div style={{ ...bubble, maxWidth: "100%", width: "100%" }}>
          <div style={copy}><span>{body}</span></div>
          <div className="cv-rail" style={{ padding: "6px 4px 4px" }}>
            {p.items.map(i => <div key={i.id} style={{ flex: "0 0 150px", scrollSnapAlign: "start", border: `1px solid ${WA_LINE}`, borderRadius: 9, padding: 4, background: "#fff" }}>
              {tile(i, 96)}
              <div style={{ padding: "6px 4px 2px" }}><div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{name(i)}</div><div style={{ ...small, ...nums }}>{price(i.priceMinor)}</div></div>
              <div style={{ borderTop: `1px solid ${WA_LINE}`, marginTop: 6, padding: "8px 0 4px", textAlign: "center", color: WA_ACTION, fontSize: 14, fontWeight: 500 }}>{A("Order", "اطلب")}</div>
            </div>)}
          </div>
          <div style={{ ...copy, paddingTop: 2 }}><span style={small}>{stop}</span></div>
        </div>}
        <div style={{ width: "100%" }}><span className="cv-btn">{A("See full menu", "المنيو الكامل")}</span></div>
      </>}

      {p.kind === "list" && <>
        {!p.items.length ? <div style={{ ...bubble, padding: 12, color: WA_MUTED }}>{A("Pick items to see the list", "اختر أصنافاً لتظهر القائمة")}</div> : <div style={{ ...bubble, width: "92%" }}>
          {p.items[0] && tile(p.items[0], 120)}
          <div style={copy}>
            <span>{body}</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {p.items.map(i => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: `1px dashed ${WA_LINE}` }}><span>{name(i)}</span><span style={nums}>{price(i.priceMinor)}</span></div>)}
              {p.items.length > 1 && <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0 0", fontWeight: 600 }}><span>{A("All together", "الكل معاً")}</span><span style={nums}>{price(total)}</span></div>}
            </div>
            <span style={small}>{stop}</span>
          </div>
        </div>}
        <div style={{ width: "92%", display: "flex", flexDirection: "column", gap: 4 }}><span className="cv-btn">{A("Order now", "اطلب الآن")}</span><span className="cv-btn">{A("Full menu", "المنيو الكامل")}</span></div>
      </>}
  </PhoneFrame>;
}
