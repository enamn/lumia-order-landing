"use client";
// Proportions of an iPhone 16 Pro screen (402 x 874 points); `width` is the whole phone in px.
// The one phone every customer preview in the dashboard is shown in: an iPhone with WhatsApp's light iOS look.
// Put the chat bubbles inside; anything that explains the preview goes in `caption`, which sits outside the frame.
import React from "react";

const BLUE = "#0A7CFF";
const glyph = (d: string, w: number) => <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export function PhoneFrame({ name, ar = false, width = 310, rtl, caption, children }: { name: string; ar?: boolean; width?: number; rtl?: boolean; caption?: React.ReactNode; children: React.ReactNode }) {
  const A = (en: string, a: string) => (ar ? a : en);
  return <figure style={{ margin: "0 auto", width: `min(100%, ${width}px)`, display: "flex", flexDirection: "column", gap: 10 }}>
    <style>{`.pf-chat::-webkit-scrollbar{display:none}`}</style>
    <div style={{ borderRadius: 52, background: "#0F0F12", padding: 9, boxShadow: "0 28px 50px -28px rgba(26,8,21,.5), inset 0 0 0 1.5px #2A2A30" }}>
      <div style={{ position: "relative", borderRadius: 43, overflow: "hidden", background: "#EFEAE2", width: "100%", aspectRatio: "402 / 874", display: "flex", flexDirection: "column" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 92, height: 26, borderRadius: 999, background: "#000", zIndex: 3 }} />
        <div dir="ltr" style={{ background: "#F7F7F7", padding: "14px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 600, color: "#000", height: 46, flex: "none", fontVariantNumeric: "tabular-nums" }}>
          <span>9:41</span>
          <span aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="17" height="11" viewBox="0 0 17 11" fill="#000"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round"><path d="M1 4a9 9 0 0 1 13 0M3.4 6.4a5.6 5.6 0 0 1 8.2 0" /><circle cx="7.5" cy="9" r="1" fill="#000" stroke="none" /></svg>
            <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke="#000" opacity=".4" /><rect x="2" y="2" width="19" height="8" rx="2.2" fill="#000" /><rect x="24" y="4" width="1.6" height="4" rx=".8" fill="#000" opacity=".4" /></svg>
          </span>
        </div>
        <div dir={ar ? "rtl" : "ltr"} style={{ background: "#F7F7F7", borderBottom: "0.5px solid #D6D6D6", padding: "6px 14px 8px", display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: ar ? "scaleX(-1)" : undefined, flex: "none" }}><path d="M10 2 2 10l8 8" /></svg>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#FF8FA8,#C98BF2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flex: "none" }}>{(name || "?").slice(0, 1).toUpperCase()}</span>
          <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, lineHeight: 1.25 }}><span style={{ fontSize: 15, fontWeight: 600, color: "#000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span><span style={{ fontSize: 12, color: "#8A8A8E" }}>{A("Business account", "حساب تجاري")}</span></span>
          {glyph("M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 10l6-3v10l-6-3", 22)}{glyph("M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2", 20)}
        </div>
        <div className="pf-chat" dir={rtl ?? ar ? "rtl" : "ltr"} style={{ flex: 1, overflowY: "auto", padding: "14px 12px 16px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, scrollbarWidth: "none" }}>
          <span style={{ alignSelf: "center", fontSize: 12, fontWeight: 500, color: "#54656F", background: "rgba(255,255,255,.75)", padding: "3px 10px", borderRadius: 8, marginBottom: 4 }}>{A("Today", "اليوم")}</span>
          {children}
        </div>
        <div dir="ltr" style={{ background: "#F7F7F7", borderTop: "0.5px solid #D6D6D6", padding: "8px 12px 6px", display: "flex", alignItems: "center", gap: 10, flex: "none" }} aria-hidden="true">
          {glyph("M12 5v14M5 12h14", 22)}<span style={{ flex: 1, height: 34, borderRadius: 18, border: "0.5px solid #D0D0D0", background: "#fff", color: "#9A9AA0", fontSize: 15, display: "flex", alignItems: "center", padding: "0 12px" }}>{A("Message", "رسالة")}</span>{glyph("M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3", 22)}
        </div>
        <div aria-hidden="true" style={{ background: "#F7F7F7", paddingBottom: 8, display: "flex", justifyContent: "center", flex: "none" }}><span style={{ width: 118, height: 5, borderRadius: 3, background: "#000" }} /></div>
      </div>
    </div>
    {caption && <figcaption style={{ fontSize: 13, color: "#6B5B4E", textAlign: "center", lineHeight: 1.5, padding: "0 8px" }}>{caption}</figcaption>}
  </figure>;
}
