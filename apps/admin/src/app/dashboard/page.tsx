import { redirect } from "next/navigation";
import { pageContext, requireUser } from "@/server/page-context";
import { getMenu } from "@/modules/menu/service";
import { getWhatsAppStatus } from "@/modules/whatsapp/link";
import { can } from "@/server/authorization";
import { authTestMode, linkTestMode, devLinkMode } from "@/modules/auth/phone";
import { db } from "@/server/db";
import { isSuperAdmin } from "@/server/superadmin";
import FlowApp from "@/design/FlowApp";
export const dynamic = "force-dynamic";
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ businessId?: string; page?: string }> }) {
  const { businessId, page } = await searchParams;
  if (await isSuperAdmin((await requireUser()).id)) redirect("/superadmin"); // super admin numbers always land in the super admin
  const { business, user } = await pageContext(businessId);
  const [menu, wa, profile] = await Promise.all([getMenu(user.id, business.id), getWhatsAppStatus(user.id, business.id), db.user.findUnique({ where: { id: user.id }, select: { preferredLanguage: true } })]);
  return <FlowApp currency={business.currencyCode} superAdmin={await isSuperAdmin(user.id)} initialStep="dash" initialPage={page === "whatsapp" ? "WhatsApp" : page === "menu" ? "Menu" : page === "orders" ? "Orders" : page === "settings" ? "Settings" : page === "billing" ? "Billing" : page === "customers" ? "Customers" : page === "campaigns" ? "Campaigns" : "Overview"} testMode={authTestMode()} linkTestMode={linkTestMode()} devLink={devLinkMode()} linkMode={process.env.WHATSAPP_LINK_MODE === "new" ? "new" : "existing"} userPhone={user.phoneNumber as string} lang={profile?.preferredLanguage === "ar" ? "ar" : "en"}
    business={{ id: business.id, name: business.name, logoUrl: business.logoUrl, address: business.locations[0]?.addressLine1 ?? "" }} menu={menu} canEdit={can(business.role, "operations.manage")}
    wa={wa.status === "none" ? { status: "none", displayPhoneNumber: "", verifiedName: "" } : { status: wa.status, displayPhoneNumber: wa.displayPhoneNumber, verifiedName: wa.verifiedName }}
    marketingUrl={(process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:5173").replace(/\/$/, "")} meta={{ appId: process.env.NEXT_PUBLIC_META_APP_ID ?? "", configId: process.env.NEXT_PUBLIC_META_CONFIG_ID ?? "", graphVersion: process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v25.0" }}/>;
}
