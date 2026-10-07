import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { listBusinesses } from "@/modules/business/service";
import { authTestMode, linkTestMode, devLinkMode } from "@/modules/auth/phone";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/server/superadmin";
import FlowApp from "@/design/FlowApp";
export const dynamic = "force-dynamic";
// Phone → WhatsApp code → restaurant name → menu (the design's pre-dashboard flow). A signed-in owner who already has a restaurant goes straight to the dashboard.
export default async function Login() {
  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn = session?.user.status === "ACTIVE" && session.user.phoneNumberVerified;
  if (signedIn && (await isSuperAdmin(session.user.id))) redirect("/superadmin");
  if (signedIn && (await listBusinesses(session.user.id)).length) redirect("/dashboard");
  return <FlowApp initialStep={signedIn ? "name" : "phone"} testMode={authTestMode()} linkTestMode={linkTestMode()} devLink={devLinkMode()} linkMode={process.env.WHATSAPP_LINK_MODE === "new" ? "new" : "existing"} lang="en" menu={[]} canEdit wa={{ status: "none", displayPhoneNumber: "", verifiedName: "" }} marketingUrl={(process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:5173").replace(/\/$/, "")} meta={{ appId: process.env.NEXT_PUBLIC_META_APP_ID ?? "", configId: process.env.NEXT_PUBLIC_META_CONFIG_ID ?? "", graphVersion: process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v25.0" }} {...(signedIn ? { userPhone: session.user.phoneNumber as string } : {})}/>;
}
