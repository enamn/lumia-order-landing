import { pageContext } from "@/server/page-context";
import { can } from "@/server/authorization";
import { Shell } from "@/components/shell";
import { OrdersBoard } from "@/components/orders-board";
export const dynamic = "force-dynamic";
export default async function Orders({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const ctx = await pageContext((await searchParams).businessId); const b = ctx.business;
  return <Shell {...ctx} role={b.role}><div className="page-heading"><div><span className="eyebrow">WHATSAPP ORDERS</span><h1>Orders.</h1><p className="muted">Orders your customers confirmed on WhatsApp. Accepting, rejecting or marking an order ready notifies the customer.</p></div></div><OrdersBoard key={b.id} businessId={b.id} canManage={can(b.role, "operations.manage")}/></Shell>;
}
