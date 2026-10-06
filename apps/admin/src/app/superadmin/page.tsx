import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/server/page-context";
import { isSuperAdmin } from "@/server/superadmin";
import SuperAdminDashboard from "./dashboard";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lumia Order · Super admin", robots: { index: false, follow: false } };

// Only the phone numbers in SUPER_ADMIN_PHONES get in; everyone else (and anyone signed out) sees an ordinary "not found".
export default async function SuperAdminPage() {
  const user = await requireUser();
  if (!(await isSuperAdmin(user.id))) notFound();
  return <SuperAdminDashboard />;
}
