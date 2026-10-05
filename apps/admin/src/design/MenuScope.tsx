"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Pro only: which menu the Menu page shows and edits: the one shared by all branches, or a branch's own. Starter and Plus have one menu and never see this.
import React from "react";

export type Scope = { menuPerBranch: boolean; branches: { id: string; name: string; active: boolean; hasOwnMenu: boolean; items: number }[] };
const box: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", border: "1px solid #F0E4E8", borderRadius: 14, background: "#FFF9FB", marginBottom: 16, maxWidth: 640 };
const btn: React.CSSProperties = { height: 38, padding: "0 14px", borderRadius: 10, border: "1.5px solid #ECD9E0", background: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" };
const note: React.CSSProperties = { fontSize: 14, color: "#6B4A5C", margin: 0, lineHeight: 1.45 };

export function MenuScope({ scope, branchId, busy, error, onPick, onCreate, onRemove }: { scope: Scope | null; branchId: string; busy: boolean; error: string; onPick: (id: string) => void; onCreate: (copy: boolean) => void; onRemove: () => void }) {
  if (!scope?.menuPerBranch || !scope.branches.length) return null;
  const sel = scope.branches.find(b => b.id === branchId);
  return <div style={box}>
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#3D1C31" }}>Menu for
      <select value={branchId} disabled={busy} onChange={e => onPick(e.target.value)} style={{ height: 40, borderRadius: 10, border: "1.5px solid #ECD9E0", background: "#fff", padding: "0 10px", fontSize: 15 }}>
        <option value="">All branches (shared menu)</option>
        {scope.branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.hasOwnMenu ? " · own menu" : ""}{b.active ? "" : " (off)"}</option>)}
      </select>
    </label>
    {sel && !sel.hasOwnMenu && <>
      <p style={note}>{sel.name} uses the shared menu, so changes you make here update it for every branch that doesn’t have its own menu.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={btn} disabled={busy} onClick={() => onCreate(true)}>Give {sel.name} its own menu (copy of the shared menu)</button>
        <button type="button" style={btn} disabled={busy} onClick={() => onCreate(false)}>Start an empty menu</button>
      </div>
    </>}
    {sel && sel.hasOwnMenu && <>
      <p style={note}>{sel.name} has its own menu ({sel.items} {sel.items === 1 ? "item" : "items"}). Changes here only affect this branch.</p>
      <div><button type="button" style={btn} disabled={busy} onClick={() => { if (window.confirm(`Use the shared menu for ${sel.name} again? Its own menu is set aside.`)) onRemove(); }}>Use the shared menu instead</button></div>
    </>}
    {!sel && <p style={note}>This menu is used by every branch that doesn’t have its own.</p>}
    {error && <div role="alert" style={{ fontSize: 14, color: "#B42318" }}>{error}</div>}
  </div>;
}
