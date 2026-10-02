import { pageContext } from "@/server/page-context";
import { can } from "@/server/authorization";
import { Shell } from "@/components/shell";
import { Inbox } from "@/components/inbox";
import { AiSettings } from "@/components/ai-settings";
export const dynamic = "force-dynamic";
export default async function Messages({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const ctx = await pageContext((await searchParams).businessId); const b = ctx.business;
  return <Shell {...ctx} role={b.role}><div className="page-heading"><div><h1>Messages</h1><p className="muted">Customer WhatsApp messages and your replies, from your own business number.</p></div></div><AiSettings key={`ai-${b.id}`} businessId={b.id} canManage={can(b.role, "business.manage")}/><Inbox key={b.id} businessId={b.id} canReply={can(b.role, "operations.manage")}/></Shell>;
}
