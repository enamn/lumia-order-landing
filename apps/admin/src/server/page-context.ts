import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { getBusiness, listBusinesses } from "@/modules/business/service";
import { AppError } from "./errors";
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const user = await db.user.findFirst({ where: { id: session.user.id, status: "ACTIVE", phoneNumberVerified: true } });
  if (!user) redirect("/login");
  return session.user;
}
export async function pageContext(businessId?: string) {
  const user = await requireUser();
  const businesses = await listBusinesses(user.id);
  const selected = businessId ?? businesses[0]?.id;
  if (!selected) redirect("/onboarding");
  try { const business = await getBusiness(user.id, selected); return { user, business, businesses }; }
  catch (error) { if (error instanceof AppError && error.status === 404) notFound(); throw error; }
}
