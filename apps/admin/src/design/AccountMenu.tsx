"use client";
// The restaurant chip in the corner of the dashboard: it shows the restaurant and its plan as a small badge, and opens a menu with Settings, Billing and Log out.
import React from "react";

export interface MenuItem { key: string; label: string; icon: string; onPick: () => void; danger?: boolean }
const ICON: Record<string, string> = {
  settings: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4",
  billing: "M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 8.5h13M6.5 12h2.5",
  logout: "M8 4.5H5.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H8M12.5 7l3 3-3 3M15.5 10H8.5",
};
const BADGE: Record<string, React.CSSProperties> = {
  starter: { background: "#F6EEF2", color: "#3D1C31" },
  plus: { background: "#F1E6FF", color: "#6A1FA0" },
  pro: { background: "linear-gradient(90deg,#FF5577,#C93DFF)", color: "#fff" },
  due: { background: "#FFF1DC", color: "#8A4B00" },
};

export function AccountMenu({ variant, name, avatar, active, ar, items }: { variant: "sidebar" | "header"; name: string; avatar: React.ReactNode; active: boolean; ar: boolean; items: MenuItem[] }) {
  const [open, setOpen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("touchstart", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const side = variant === "sidebar";
  const avatarBox = <span style={{ width: 32, height: 32, borderRadius: 9, flex: "none", overflow: "hidden", background: "linear-gradient(135deg,#FF5577,#C93DFF)", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{avatar}</span>;
  return <div ref={box} dir={ar ? "rtl" : "ltr"} style={{ position: "relative", flex: side ? undefined : "none" }}>
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={side ? undefined : name} onClick={() => setOpen(o => !o)}
      style={side ? { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, textAlign: "start", background: open || active ? "#FBF3F8" : "transparent" } : { display: "flex", alignItems: "center", gap: 4, padding: 0, borderRadius: 9, outlineOffset: 2 }}>
      {avatarBox}
      {side && <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{name}</span></span>}
      {side && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flex: "none", transform: open ? "rotate(0)" : "rotate(180deg)", transition: "transform .15s" }}><path d="m4 10 4-4 4 4" stroke="#8A5A6E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
    {open && <div role="menu" style={{ position: "absolute", zIndex: 30, minWidth: side ? undefined : 220, ...(side ? { bottom: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0 } : { top: "calc(100% + 8px)", insetInlineEnd: 0 }), background: "#fff", border: "1px solid #F0E4E8", borderRadius: 14, boxShadow: "0 18px 40px -16px rgba(26,8,21,.35)", padding: 6, display: "flex", flexDirection: "column" }}>
      {!side && <div style={{ padding: "8px 10px 10px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #F6EEF2", marginBottom: 4 }}><span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span></div>}
      {items.map((it, i) => <React.Fragment key={it.key}>
        {it.danger && i > 0 && <div style={{ height: 1, background: "#F6EEF2", margin: "4px 6px" }} />}
        <button type="button" role="menuitem" onClick={() => { setOpen(false); it.onPick(); }} className="am-item" style={{ height: 40, padding: "0 10px", borderRadius: 9, display: "flex", alignItems: "center", gap: 12, fontSize: 15, fontWeight: 500, textAlign: "start", color: it.danger ? "#B42318" : "#1A0815" }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flex: "none" }}><path d={ICON[it.icon] ?? ""} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
        </button>
      </React.Fragment>)}
    </div>}
    <style>{`.am-item:hover,.am-item:focus-visible{background:#FBF3F8}`}</style>
  </div>;
}

// The plan, as one small word next to the Lumia Order logo (it opens Billing). Amber and clearer when a renewal failed.
export function PlanBadge({ label, kind, onClick }: { label: string; kind: "starter" | "plus" | "pro" | "due"; onClick: () => void }) {
  return <button type="button" onClick={onClick} title={label} style={{ fontSize: 12, fontWeight: 600, lineHeight: 1, padding: "4px 8px", borderRadius: 999, flex: "none", whiteSpace: "nowrap", cursor: "pointer", ...BADGE[kind] }}>{label}</button>;
}
