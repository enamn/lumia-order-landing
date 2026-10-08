import { api } from "@/server/api";
import { AppError } from "@/server/errors";
import { isSuperAdmin } from "@/server/superadmin";
import { listMetaEvents } from "@/modules/superadmin/meta-events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return api(request, async userId => {
    if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404);
    return listMetaEvents();
  });
}
