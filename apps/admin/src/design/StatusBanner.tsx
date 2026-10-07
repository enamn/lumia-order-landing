"use client";
// A notice at the top of the dashboard in the same style as the setup banner: a title, one or two lines, and an optional button.
import React from "react";
export function StatusBanner({ title, body, action, onAction, ar }: { title: string; body: string; action?: string; onAction?: () => void; ar?: boolean }) {
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ flex: "none", borderRadius: 20, background: "linear-gradient(135deg,#FFEEF2 0%,#FCE8F5 50%,#F1E6FF 100%)", padding: "22px 24px", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: "#1A0815" }}>{title}</h2>
        <p style={{ fontSize: 14, color: "#3D1C31", lineHeight: 1.5, margin: "8px 0 0", maxWidth: 640 }}>{body}</p>
      </div>
      {action && onAction && <button type="button" onClick={onAction} style={{ height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "linear-gradient(90deg,#FF5577,#C93DFF)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", flex: "none" }}>{action}</button>}
    </div>
  );
}
