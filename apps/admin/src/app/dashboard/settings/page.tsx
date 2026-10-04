import { pageContext } from "@/server/page-context";
import { getSettings } from "@/modules/settings/service";
import { Shell } from "@/components/shell";
import SettingsApp from "@/design/SettingsApp";
export const dynamic = "force-dynamic";
export default async function Settings({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const ctx = await pageContext((await searchParams).businessId);
  const s = await getSettings(ctx.user.id, ctx.business.id);
  return <Shell {...ctx} role={ctx.business.role}><SettingsApp businessId={ctx.business.id} query={`?businessId=${ctx.business.id}`} initial={{ sections: s.sections, menu: { ...s.menu, updatedAt: s.menu.updatedAt?.toISOString() ?? null }, whatsapp: s.whatsapp }}/></Shell>;
}
