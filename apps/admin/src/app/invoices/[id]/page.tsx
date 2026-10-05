import { pageContext } from "@/server/page-context";
import { getInvoice } from "@/modules/billing/service";
export const dynamic = "force-dynamic";
const aed = (minor: number) => `AED ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
// A printable tax invoice for one payment. The seller's details come from LUMIA_LEGAL_NAME / LUMIA_TRN / LUMIA_ADDRESS.
export default async function Invoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string }> }) {
  const { id } = await params; const ctx = await pageContext((await searchParams).businessId);
  const inv = await getInvoice(ctx.user.id, ctx.business.id, id);
  const lines = inv.lines as unknown as { name: string; unitMinor: number; quantity: number }[], to = (inv.billedTo ?? {}) as { name?: string; trn?: string | null; address?: string; email?: string | null };
  const seller = { name: process.env.LUMIA_LEGAL_NAME ?? "Lumia Order", trn: process.env.LUMIA_TRN, address: process.env.LUMIA_ADDRESS };
  const cell = { padding: "8px 0", borderBottom: "1px solid #F0E4E8" } as const;
  return <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 24px", fontFamily: "Geist, system-ui, sans-serif", color: "#1A0815" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
      <div><h1 style={{ fontSize: 28, margin: 0 }}>Tax invoice</h1><p style={{ color: "#8A5A6E", margin: "6px 0 0" }}>{inv.number}</p></div>
      <div style={{ textAlign: "right", fontSize: 14, lineHeight: 1.6 }}><b>{seller.name}</b>{seller.address && <div>{seller.address}</div>}{seller.trn && <div>TRN {seller.trn}</div>}</div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", margin: "28px 0", fontSize: 14, lineHeight: 1.6 }}>
      <div><div style={{ color: "#8A5A6E" }}>Billed to</div><b>{to.name}</b>{to.address && <div>{to.address}</div>}{to.trn && <div>TRN {to.trn}</div>}{to.email && <div>{to.email}</div>}</div>
      <div style={{ textAlign: "right" }}><div style={{ color: "#8A5A6E" }}>Date</div>{date(inv.createdAt)}<div style={{ color: "#8A5A6E", marginTop: 8 }}>Period</div>{date(inv.periodStart)} – {date(inv.periodEnd)}</div>
    </div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}><thead><tr style={{ textAlign: "left", color: "#8A5A6E", fontSize: 13 }}><th style={cell}>Description</th><th style={{ ...cell, textAlign: "right" }}>Qty</th><th style={{ ...cell, textAlign: "right" }}>Unit</th><th style={{ ...cell, textAlign: "right" }}>Amount</th></tr></thead>
      <tbody>{lines.map((l, i) => <tr key={i}><td style={cell}>{l.name}</td><td style={{ ...cell, textAlign: "right" }}>{l.quantity}</td><td style={{ ...cell, textAlign: "right" }}>{aed(l.unitMinor)}</td><td style={{ ...cell, textAlign: "right" }}>{aed(l.unitMinor * l.quantity)}</td></tr>)}</tbody></table>
    <div style={{ marginLeft: "auto", maxWidth: 280, marginTop: 16, fontSize: 15, lineHeight: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{aed(inv.subtotalMinor)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>VAT (5%)</span><span>{aed(inv.vatMinor)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 18, borderTop: "1px solid #1A0815" }}><span>Total paid</span><span>{aed(inv.totalMinor)}</span></div>
    </div>
    <p style={{ color: "#8A5A6E", fontSize: 13, marginTop: 32 }}>Paid by card. Use your browser’s print function to save this invoice as a PDF.</p>
  </main>;
}
