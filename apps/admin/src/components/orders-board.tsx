"use client";
import { useCallback, useEffect, useState } from "react";

type Order = { id: string; number: string; status: string; fulfillment: string; total: number; currency: string; createdAt: string; address: string; customer: { name: string; phone: string }; items: { name: string; quantity: number; notes: string; total: number }[] };
async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? json.message ?? "Something went wrong. Please try again.");
  return json.data ?? json;
}
const LABEL: Record<string, string> = { AWAITING_BUSINESS_CONFIRMATION: "New", ACCEPTED: "Accepted", PREPARING: "Preparing", READY: "Ready", OUT_FOR_DELIVERY: "Out for delivery", COMPLETED: "Completed", REJECTED: "Rejected", CANCELLED: "Cancelled" };
const ACTIVE = ["AWAITING_BUSINESS_CONFIRMATION", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];
const time = (iso: string) => new Date(iso).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
// [next status, button label, style]; the server enforces which changes are allowed.
function actions(o: Order): [string, string, string][] {
  switch (o.status) {
    case "AWAITING_BUSINESS_CONFIRMATION": return [["ACCEPTED", "Accept", "button-primary"], ["REJECTED", "Reject", "button-outline"]];
    case "ACCEPTED": return [["PREPARING", "Start preparing", "button-primary"], ["CANCELLED", "Cancel", "button-outline"]];
    case "PREPARING": return [["READY", "Mark ready", "button-primary"], ["CANCELLED", "Cancel", "button-outline"]];
    case "READY": return o.fulfillment === "DELIVERY" ? [["OUT_FOR_DELIVERY", "Out for delivery", "button-primary"]] : [["COMPLETED", "Picked up", "button-primary"]];
    case "OUT_FOR_DELIVERY": return [["COMPLETED", "Delivered", "button-primary"]];
    default: return [];
  }
}

// Orders the AI assistant took over WhatsApp. The customer is told on WhatsApp when an order is accepted, rejected, ready or on its way.
export function OrdersBoard({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const base = `/api/v1/businesses/${businessId}/orders`;
  const [orders, setOrders] = useState<Order[] | null>(null); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [tab, setTab] = useState<"active" | "done">("active");
  const load = useCallback(async () => { try { setOrders(await call(base)); } catch { /* keep the last list */ } }, [base]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  async function change(o: Order, status: string) {
    setBusy(o.id); setError("");
    try { await call(`${base}/${o.id}/status`, "POST", { status }); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  if (orders === null) return <p className="muted">Loading orders…</p>;
  const shown = orders.filter(o => (tab === "active") === ACTIVE.includes(o.status));
  const fresh = orders.filter(o => o.status === "AWAITING_BUSINESS_CONFIRMATION").length;
  return <div className="orders">
    <div className="orders-tabs" role="tablist">
      <button role="tab" aria-selected={tab === "active"} className={tab === "active" ? "on" : ""} onClick={() => setTab("active")}>Active{fresh > 0 && <i className="inbox-flag">{fresh} new</i>}</button>
      <button role="tab" aria-selected={tab === "done"} className={tab === "done" ? "on" : ""} onClick={() => setTab("done")}>History</button>
    </div>
    {error && <p role="alert" className="error-message">{error}</p>}
    {!shown.length ? <div className="panel inbox-empty"><h2>{tab === "active" ? "No active orders" : "No past orders yet"}</h2><p className="muted">{tab === "active" ? "When a customer orders on WhatsApp and confirms, the order appears here for you to accept." : "Completed, rejected and cancelled orders show here."}</p></div>
      : shown.map(o => <article key={o.id} className={`panel order-card${o.status === "AWAITING_BUSINESS_CONFIRMATION" ? " new" : ""}`}>
        <header><div><b>Order #{o.number}</b><span className="muted"> · {time(o.createdAt)}</span></div><span className={`pill${o.status === "COMPLETED" ? " pill-green" : o.status === "AWAITING_BUSINESS_CONFIRMATION" ? " pill-amber" : ""}`}>{LABEL[o.status] ?? o.status}</span></header>
        <p className="order-who"><b>{o.customer.name || o.customer.phone}</b>{o.customer.name && <span className="muted"> {o.customer.phone}</span>} · {o.fulfillment === "DELIVERY" ? "Delivery" : "Pickup"}</p>
        {o.fulfillment === "DELIVERY" && o.address && <p className="muted order-addr">📍 {o.address}</p>}
        <ul>{o.items.map((i, n) => <li key={n}><span>{i.quantity} × {i.name}{i.notes ? <em> ({i.notes})</em> : null}</span><span>{i.total} {o.currency}</span></li>)}</ul>
        <footer><b>Total {o.total} {o.currency}</b><span className="muted"> · cash on {o.fulfillment === "DELIVERY" ? "delivery" : "pickup"}</span>
          <span className="order-actions">{canManage && actions(o).map(([st, text, style]) => <button key={st} className={`button button-sm ${style}`} disabled={busy === o.id} onClick={() => change(o, st)}>{text}</button>)}</span></footer>
      </article>)}
  </div>;
}
