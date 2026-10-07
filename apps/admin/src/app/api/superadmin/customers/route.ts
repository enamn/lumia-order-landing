import { api } from "@/server/api";
import { AppError } from "@/server/errors";
import { isSuperAdmin } from "@/server/superadmin";
import { invoicesOf, listCustomers } from "@/modules/superadmin/customers";
export const dynamic = "force-dynamic";
const guard = async (userId: string) => { if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404); };
export async function GET(request: Request) {
  return api(request, async userId => { await guard(userId); const id = new URL(request.url).searchParams.get("invoices"); return id ? { invoices: await invoicesOf(id) } : listCustomers(); });
}
