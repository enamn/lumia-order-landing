import { pageContext } from "@/server/page-context";
import { Shell } from "@/components/shell";
import { BusinessForm } from "@/components/business-form";
import { toProfile } from "@/modules/business/presenter";
export const dynamic = "force-dynamic";
export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) { const ctx = await pageContext((await searchParams).businessId); return <Shell {...ctx} role={ctx.business.role}><div className="page-heading"><div><span className="eyebrow">STEP 01 · THE FOUNDATION</span><h1>Make it your business.</h1><p className="muted">A few details now. A better experience for every customer.</p></div><span className="pill">Business profile</span></div><BusinessForm key={ctx.business.id} businessId={ctx.business.id} initial={toProfile(ctx.business)} role={ctx.business.role}/></Shell>; }
