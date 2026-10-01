"use client";
import { useMemo, useState } from "react";

type Result = { id: string; status: string; category: string; name: string; language: string };
const initialBody = "Hi {{1}}, your order {{2}} from {{3}} has been confirmed. Total: AED {{4}}. We’ll notify you when it’s ready.";

export function WhatsAppTemplateForm({ businessId, enabled, reviewMode }: { businessId: string; enabled: boolean; reviewMode: boolean }) {
  const [name, setName] = useState("lumia_order_confirmation_review_01");
  const [body, setBody] = useState(initialBody);
  const [examples, setExamples] = useState(["Ahmad", "LO-1001", "Burger House", "48.00"]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState<Result | null>(null);
  const variables = useMemo(() => Math.max(0, ...[...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]))), [body]);
  const preview = body.replace(/\{\{(\d+)\}\}/g, (_, n) => examples[Number(n) - 1] || `{{${n}}}`);
  const changeExample = (index: number, value: string) => setExamples(current => { const next = [...current]; next[index] = value; return next; });
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/v1/businesses/${businessId}/whatsapp/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category: "UTILITY", language: "en_US", body, examples: examples.slice(0, variables) }) });
      const json = await response.json(); if (!response.ok) throw Error(json.error?.message ?? "Unable to create the template."); setResult(json.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create the template."); }
    finally { setBusy(false); }
  }
  return <div className="wt-grid">
    <form className="wt-card wt-form" onSubmit={submit}>
      <div className="wt-card-head"><div><span className="wt-kicker">WHATSAPP BUSINESS</span><h2>Create message template</h2></div><span className="wt-chip">Utility</span></div>
      {reviewMode && <div className="wt-note">Meta review workspace · Lumia Order test WhatsApp account</div>}
      {!enabled && <div className="wt-error">Connect WhatsApp before creating message templates.</div>}
      <label>Template name<input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} disabled={!enabled || busy}/><small>Lowercase letters, numbers and underscores.</small></label>
      <div className="wt-pair"><label>Category<input value="Utility" disabled/></label><label>Language<input value="English (US)" disabled/></label></div>
      <label>Message body<textarea rows={5} value={body} onChange={e => setBody(e.target.value)} disabled={!enabled || busy}/><small>Use sequential variables such as {"{{1}}"} and {"{{2}}"}.</small></label>
      {variables > 0 && <fieldset><legend>Example values</legend><div className="wt-examples">{Array.from({ length: variables }, (_, index) => <label key={index}><span>{`{{${index + 1}}}`}</span><input value={examples[index] ?? ""} onChange={e => changeExample(index, e.target.value)} disabled={!enabled || busy}/></label>)}</div></fieldset>}
      {error && <div className="wt-error" role="alert">{error}</div>}
      <button className="wt-primary" type="submit" disabled={!enabled || busy}>{busy ? "Creating with Meta…" : "Create template"}</button>
    </form>
    <aside className="wt-side">
      <div className="wt-card"><span className="wt-kicker">LIVE PREVIEW</span><div className="wt-phone"><div className="wt-phone-head">Burger House</div><div className="wt-bubble">{preview}</div><time>09:41 ✓✓</time></div></div>
      {result && <div className="wt-card wt-success" role="status"><span className="wt-success-icon">✓</span><div><span className="wt-kicker">CREATED IN META</span><h2>{result.name}</h2><dl><div><dt>Status</dt><dd>{result.status}</dd></div><div><dt>Template ID</dt><dd>{result.id}</dd></div><div><dt>Category</dt><dd>{result.category}</dd></div></dl><p>Open WhatsApp Manager to show the same template in your review recording.</p></div></div>}
    </aside>
  </div>;
}
