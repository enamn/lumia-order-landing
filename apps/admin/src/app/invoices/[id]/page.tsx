import { pageContext } from "@/server/page-context";
import { getInvoice } from "@/modules/billing/service";
import { getSupplier } from "@/modules/tax/service";
import { formatMoney } from "@/modules/market/money";
export const dynamic = "force-dynamic";
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
// A printable invoice for one payment. It is a "tax invoice" only when the seller was registered for VAT when it was issued (the decision stored on the invoice says so).
// The seller is Afkar IO (the platform tax profile); its registration number is shown only when the invoice was issued under one.
export default async function Invoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string }> }) {
  const { id } = await params; const ctx = await pageContext((await searchParams).businessId);
  const inv = await getInvoice(ctx.user.id, ctx.business.id, id);
  const lines = inv.lines as unknown as { name: string; unitMinor: number; quantity: number }[], to = (inv.billedTo ?? {}) as { name?: string; trn?: string | null; address?: string; email?: string | null };
  const supplier = await getSupplier(), decision = (inv.taxDecision ?? null) as { supplierRegistration?: { number: string } | null; destinationTreatment?: string; uaeTreatment?: string; appliedRatePercent?: number; ratePercent?: number } | null;
  const seller = { name: supplier.legalName || process.env.LUMIA_LEGAL_NAME || "Afkar IO", trn: decision?.supplierRegistration?.number ?? (decision ? undefined : process.env.LUMIA_TRN), address: process.env.LUMIA_ADDRESS };
  const aed = (minor: number) => formatMoney(minor, inv.currency), isTaxInvoice = inv.vatMinor > 0 || !!decision?.supplierRegistration;
  const rate = decision?.appliedRatePercent ?? decision?.ratePercent ?? (inv.subtotalMinor ? Math.round(inv.vatMinor / inv.subtotalMinor * 10000) / 100 : 0);
  const note = inv.vatMinor > 0 ? "" : decision?.destinationTreatment === "REVERSE_CHARGE" ? "Reverse charge: the customer accounts for any VAT due in its own country." : decision?.destinationTreatment === "LOCAL_VAT_NOT_IMPLEMENTED" ? "No VAT is charged on this invoice." : "No VAT is charged on this invoice: the supplier is not registered for VAT.";
  const cell = { padding: "8px 0", borderBottom: "1px solid #F0E4E8" } as const;
  return <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 24px", fontFamily: "Geist, system-ui, sans-serif", color: "#1A0815" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
      <div><h1 style={{ fontSize: 28, margin: 0 }}>{isTaxInvoice ? "Tax invoice" : "Invoice"}</h1><p style={{ color: "#8A5A6E", margin: "6px 0 0" }}>{inv.number}</p></div>
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
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{inv.vatMinor > 0 ? `VAT (${rate}%)` : "VAT"}</span><span>{inv.vatMinor > 0 ? aed(inv.vatMinor) : "None"}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 18, borderTop: "1px solid #1A0815" }}><span>Total paid</span><span>{aed(inv.totalMinor)}</span></div>
    </div>
    {note && <p style={{ fontSize: 13, marginTop: 16 }}>{note}</p>}
    <p style={{ color: "#8A5A6E", fontSize: 13, marginTop: 32 }}>Paid by card. Use your browser’s print function to save this invoice as a PDF.</p>
  </main>;
}
