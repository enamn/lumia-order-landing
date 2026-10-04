import { pageContext } from "@/server/page-context";
import { getSettings } from "@/modules/settings/service";
import SettingsApp from "@/design/SettingsApp";
export const dynamic = "force-dynamic";
export default async function Settings({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { business, user } = await pageContext((await searchParams).businessId);
  const s = await getSettings(user.id, business.id);
  return <SettingsApp businessId={business.id} query={`?businessId=${business.id}`} initial={{ sections: s.sections, menu: { ...s.menu, updatedAt: s.menu.updatedAt?.toISOString() ?? null }, whatsapp: s.whatsapp }}/>;
}
