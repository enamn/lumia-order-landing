"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Conv = { id: string; needsHuman?: boolean; lastMessageAt: string; customer: { name: string; phone: string }; lastMessage: { direction: string; text: string; type: string } | null };
type Msg = { id: string; direction: string; senderType: string; type: string; text: string; status: string; createdAt: string };
type Thread = { id: string; needsHuman?: boolean; customer: { name: string; phone: string }; canReply: boolean; windowEndsAt: string | null; messages: Msg[] };

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error?.message ?? json.message ?? "Something went wrong. Please try again."), { code: json.error?.code ?? json.code });
  return json.data ?? json;
}
const time = (iso: string) => new Date(iso).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
const title = (c: { name: string; phone: string }) => c.name || c.phone;
const describe = (text: string, type: string) => text || (type.toUpperCase() === "REQUEST_WELCOME" ? "👋 Opened the chat" : `[${type.toLowerCase()} message]`);

// Shows what customers send to the restaurant's WhatsApp number and lets staff reply from the same number.
export function Inbox({ businessId, canReply }: { businessId: string; canReply: boolean }) {
  const base = `/api/v1/businesses/${businessId}/conversations`;
  const [list, setList] = useState<Conv[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState(""); const [sending, setSending] = useState(false); const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => { try { setList(await call(base)); } catch { /* keep the last list */ } }, [base]);
  const loadThread = useCallback(async (id: string) => { try { setThread(await call(`${base}/${id}`)); } catch { /* keep the last thread */ } }, [base]);

  useEffect(() => { loadList(); const t = setInterval(loadList, 8000); return () => clearInterval(t); }, [loadList]);
  useEffect(() => { if (!selected) return; setThread(null); setError(""); loadThread(selected); const t = setInterval(() => loadThread(selected), 6000); return () => clearInterval(t); }, [selected, loadThread]);
  useEffect(() => { if (!selected && list?.length) setSelected(list[0]!.id); }, [list, selected]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [thread?.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!selected || !text.trim() || sending) return;
    setSending(true); setError("");
    try { await call(`${base}/${selected}/messages`, "POST", { text }); setText(""); await Promise.all([loadThread(selected), loadList()]); }
    catch (err) { setError((err as Error).message); } finally { setSending(false); }
  }

  if (list === null) return <p className="muted">Loading conversations…</p>;
  if (!list.length) return <div className="panel inbox-empty"><h2>No conversations yet</h2><p className="muted">When a customer messages your WhatsApp number, the conversation appears here and you can reply.</p></div>;
  const open = thread && thread.id === selected ? thread : null;
  return <div className="inbox panel">
    <aside className="inbox-list" aria-label="Conversations">{list.map(c => <button key={c.id} type="button" className={`inbox-row${c.id === selected ? " on" : ""}`} onClick={() => setSelected(c.id)}>
      <span className="inbox-avatar">{title(c.customer).slice(0, 1).toUpperCase()}</span>
      <span className="inbox-meta"><b>{title(c.customer)}{c.needsHuman && <i className="inbox-flag">Needs you</i>}</b><small>{c.lastMessage ? `${c.lastMessage.direction === "OUTBOUND" ? "You: " : ""}${describe(c.lastMessage.text, c.lastMessage.type)}` : ""}</small></span>
      <time>{time(c.lastMessageAt)}</time>
    </button>)}</aside>
    <section className="inbox-thread" aria-label="Conversation">
      {!open ? <p className="muted inbox-pad">Loading…</p> : <>
        <header><b>{title(open.customer)}</b><span className="muted">{open.customer.phone}</span>{open.needsHuman && <i className="inbox-flag">Needs you</i>}</header>
        <div className="inbox-msgs" role="log" aria-live="polite">{open.messages.map(m => <div key={m.id} className={`inbox-msg ${m.direction === "OUTBOUND" ? "out" : "in"}`}><p>{describe(m.text, m.type)}</p><small>{time(m.createdAt)}{m.senderType === "AI" ? " · AI" : m.direction === "OUTBOUND" ? " · You" : ""}{m.direction === "OUTBOUND" ? ` · ${m.status.toLowerCase()}` : ""}</small></div>)}<div ref={end}/></div>
        {canReply && open.canReply ? <form className="inbox-compose" onSubmit={send}>
          <textarea className="input" rows={2} maxLength={4096} value={text} onChange={e => setText(e.target.value)} placeholder="Write a reply…" aria-label="Reply" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}/>
          <button className="button button-primary" disabled={sending || !text.trim()}>{sending ? "Sending…" : "Send"}</button>
        </form> : <p className="inbox-note muted">{!canReply ? "Your role can read conversations but not reply." : "The 24-hour reply window has closed. You can reply again when the customer messages you."}</p>}
        {error && <p role="alert" className="error-message inbox-err">{error}</p>}
      </>}
    </section>
  </div>;
}
