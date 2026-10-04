import { redirect } from "next/navigation";
// Orders and Settings are part of the dashboard now (no full page reload when switching).
export default async function Page({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  redirect(`/dashboard?page=settings${businessId ? `&businessId=${businessId}` : ""}`);
}
