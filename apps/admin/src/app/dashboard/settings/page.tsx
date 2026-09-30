import { pageContext } from "@/server/page-context";
import { members } from "@/modules/business/service";
import { can } from "@/server/authorization";
import { toProfile } from "@/modules/business/presenter";
import { Shell } from "@/components/shell";
import { BusinessForm } from "@/components/business-form";
import { Members } from "@/components/members";
export const dynamic = "force-dynamic";
export default async function Settings({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) { const ctx = await pageContext((await searchParams).businessId); const b = ctx.business; const team = can(b.role, "users.manage") ? await members(ctx.user.id, b.id) : null; return <Shell {...ctx} role={b.role}><div className="page-heading"><div><span className="eyebrow">YOUR WORKSPACE, YOUR WAY</span><h1>Business settings.</h1><p className="muted">Keep your details up to date and your team connected.</p></div><span className="pill">{b.role.toLowerCase()}</span></div><BusinessForm key={b.id} businessId={b.id} initial={toProfile(b)} role={b.role}/>{team && <Members businessId={b.id} initial={team} owner={b.role === "OWNER"}/>}</Shell>; }
