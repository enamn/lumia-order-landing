"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Pro only: which menu the Menu page shows and edits: the one shared by all branches, or a branch's own. Starter and Plus have one menu and never see this.
// One row of tabs (All branches, then each branch) and a single line that says what the selected tab means and what can be done with it.
import React from "react";

export type Scope = { menuPerBranch: boolean; branches: { id: string; name: string; active: boolean; hasOwnMenu: boolean; items: number }[] };
const T = {
  en: { menuFor: "Menu for", all: "All branches", shared: "Shared menu", own: "Own menu", off: "off",
    allNote: "Used by every branch that doesn’t have its own menu.",
    usesShared: (n: string) => `${n} uses the shared menu. Changes here update it for every branch without its own menu.`,
    hasOwn: (n: string, c: number) => `${n} has its own menu (${c} ${c === 1 ? "item" : "items"}). Changes here only affect this branch.`,
    give: (n: string) => `Give ${n} its own menu`, copy: "Copy the shared menu", empty: "Start empty", back: "Use the shared menu instead",
    confirm: (n: string) => `Use the shared menu for ${n} again? Its own menu is set aside.` },
  ar: { menuFor: "قائمة", all: "كل الفروع", shared: "القائمة المشتركة", own: "قائمة خاصة", off: "متوقف",
    allNote: "يستخدمها كل فرع ليست له قائمة خاصة.",
    usesShared: (n: string) => `${n} يستخدم القائمة المشتركة. التعديلات هنا تُحدّثها لكل فرع ليست له قائمة خاصة.`,
    hasOwn: (n: string, c: number) => `${n} له قائمة خاصة (${c} ${c === 1 ? "صنف" : "أصناف"}). التعديلات هنا تخص هذا الفرع فقط.`,
    give: (n: string) => `امنح ${n} قائمة خاصة`, copy: "نسخة من القائمة المشتركة", empty: "ابدأ بقائمة فارغة", back: "استخدام القائمة المشتركة بدلاً منها",
    confirm: (n: string) => `استخدام القائمة المشتركة لفرع ${n} مجدداً؟ ستُحفظ قائمته الخاصة جانباً.` },
};
const btn: React.CSSProperties = { height: 36, padding: "0 14px", borderRadius: 10, border: "1.5px solid #D9BCC9", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#1A0815" };
const pill = (own: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: own ? "#E4F4EC" : "#F1E6FF", color: own ? "#16704A" : "#6A1FA0", flex: "none" });

export function MenuScope({ scope, branchId, busy, error, onPick, onCreate, onRemove, ar }: { scope: Scope | null; branchId: string; busy: boolean; error: string; onPick: (id: string) => void; onCreate: (copy: boolean) => void; onRemove: () => void; ar?: boolean }) {
  if (!scope?.menuPerBranch || !scope.branches.length) return null;
  const t = ar ? T.ar : T.en, sel = scope.branches.find(b => b.id === branchId);
  const tabs = [{ id: "", label: t.all, own: false, off: false }, ...scope.branches.map(b => ({ id: b.id, label: b.name, own: b.hasOwnMenu, off: !b.active }))];
  return <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
    <div role="tablist" aria-label={t.menuFor} style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "#F1E6EC", width: "fit-content", maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none" }}>
      {tabs.map(x => { const on = x.id === branchId; return (
        <button key={x.id || "all"} type="button" role="tab" aria-selected={on} disabled={busy} onClick={() => onPick(x.id)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 10, whiteSpace: "nowrap", flex: "none", fontSize: 15, fontWeight: on ? 700 : 500, color: on ? "#1A0815" : "#4A2A3C", background: on ? "#fff" : "transparent", boxShadow: on ? "0 1px 3px rgba(26,8,21,.18)" : "none", opacity: x.off ? 0.6 : 1, cursor: "pointer" }}>
          {x.label}
          {x.own && <span aria-label={t.own} title={t.own} style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#FF5577,#C93DFF)", flex: "none" }} />}
          {x.off && <span style={{ fontSize: 12, fontWeight: 600, color: "#8A5A6E" }}>{t.off}</span>}
        </button>); })}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", fontSize: 14.5, color: "#2A1020", lineHeight: 1.5 }}>
      <span style={pill(!!sel?.hasOwnMenu)}>{sel?.hasOwnMenu ? t.own : t.shared}</span>
      <span style={{ flex: "1 1 280px", minWidth: 0 }}>{!sel ? t.allNote : sel.hasOwnMenu ? t.hasOwn(sel.name, sel.items) : t.usesShared(sel.name)}</span>
      {sel && !sel.hasOwnMenu && <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{t.give(sel.name)}:</span>
        <button type="button" style={btn} disabled={busy} onClick={() => onCreate(true)}>{t.copy}</button>
        <button type="button" style={{ ...btn, fontWeight: 500 }} disabled={busy} onClick={() => onCreate(false)}>{t.empty}</button>
      </span>}
      {sel?.hasOwnMenu && <button type="button" style={{ ...btn, fontWeight: 500 }} disabled={busy} onClick={() => { if (window.confirm(t.confirm(sel.name))) onRemove(); }}>{t.back}</button>}
    </div>
    {error && <div role="alert" style={{ fontSize: 14, color: "#B42318" }}>{error}</div>}
  </div>;
}
