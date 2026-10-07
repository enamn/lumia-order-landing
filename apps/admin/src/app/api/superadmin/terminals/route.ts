import { z } from "zod";
import { api } from "@/server/api";
import { jsonBody } from "@/server/api-body";
import { AppError } from "@/server/errors";
import { isSuperAdmin } from "@/server/superadmin";
import { listTerminalOrders, setTerminalStage } from "@/modules/superadmin/terminals";
export const dynamic = "force-dynamic";
const guard = async (userId: string) => { if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404); };
export async function GET(request: Request) { return api(request, async userId => { await guard(userId); return { orders: await listTerminalOrders() }; }); }
export async function PATCH(request: Request) {
  return api(request, async userId => { await guard(userId); const b = z.object({ id: z.string().min(8).max(64), stage: z.number(), tracking: z.string().optional() }).strict().parse(await jsonBody(request)); return setTerminalStage(userId, b.id, { stage: b.stage, ...(b.tracking !== undefined ? { tracking: b.tracking } : {}) }); });
}
