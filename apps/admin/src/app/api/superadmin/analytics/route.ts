import { api } from "@/server/api";
import { AppError } from "@/server/errors";
import { isSuperAdmin } from "@/server/superadmin";
import { analyticsSummary } from "@/modules/superadmin/analytics";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(request, async userId => {
    if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404); // not even a hint that it exists
    return analyticsSummary(Number(new URL(request.url).searchParams.get("days") ?? 30));
  });
}
