"use client";
import { useEffect, useState } from "react";

type Settings = { enabled: boolean; instructions: string; tone: string };
async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? json.message ?? "Something went wrong. Please try again.");
  return json.data ?? json;
}

// Owner control for the AI assistant that answers customers from the menu. Only owners and admins can change it.
export function AiSettings({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const path = `/api/v1/businesses/${businessId}/ai`;
  const [s, setS] = useState<Settings | null>(null); const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(() => { call(path).then((d: Settings) => { setS(d); setInstructions(d.instructions); }).catch(() => setError("We couldn’t load the AI settings.")); }, [path]);
  async function save(next: Partial<Settings> & { enabled: boolean }) {
    setBusy(true); setError(""); setSaved(false);
    try { const d: Settings = await call(path, "POST", { enabled: next.enabled, instructions: next.instructions ?? instructions }); setS(d); setInstructions(d.instructions); setSaved(true); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!s) return error ? <p role="alert" className="error-message">{error}</p> : null;
  return <section className="panel ai-panel" aria-label="AI assistant">
    <div className="ai-head">
      <div><h2>AI assistant</h2><p className="muted">Answers customers’ WhatsApp questions from your menu, in Arabic or English. Orders and anything it can’t answer are passed to you.</p></div>
      <button type="button" role="switch" aria-checked={s.enabled} className={`ai-switch${s.enabled ? " on" : ""}`} disabled={!canManage || busy} onClick={() => save({ enabled: !s.enabled })}><span/></button>
    </div>
    {canManage && <details className="ai-more"><summary>Notes for the assistant</summary>
      <label>Anything it should know (opening hours, delivery areas, offers)<textarea className="input" rows={3} maxLength={1500} value={instructions} onChange={e => { setInstructions(e.target.value); setSaved(false); }} placeholder="We are open 11am–midnight. We deliver to Al Majaz and Al Khan."/></label>
      <button type="button" className="button button-outline button-sm" disabled={busy || instructions === s.instructions} onClick={() => save({ enabled: s.enabled })}>{busy ? "Saving…" : "Save notes"}</button>
      {saved && <span className="saved"> Saved</span>}
    </details>}
    {error && <p role="alert" className="error-message">{error}</p>}
  </section>;
}
