import { api } from "@/server/api";
import { jsonBody } from "@/server/api-body";
import { AppError } from "@/server/errors";
import { isSuperAdmin } from "@/server/superadmin";
import { listMarkets, setMarketFlags, FLAG_KEYS } from "@/modules/market/service";
import { z } from "zod";
export const dynamic = "force-dynamic";
const guard = async (userId: string) => { if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404); };
export async function GET(request: Request) { return api(request, async userId => { await guard(userId); return listMarkets(); }); }
const patchSchema = z.object({ code: z.string().length(2), reason: z.string().min(5).max(300), flags: z.object(Object.fromEntries(FLAG_KEYS.map(k => [k, z.boolean().optional()]))).strict() }).strict();
export async function PATCH(request: Request) {
  return api(request, async userId => { await guard(userId); const b = patchSchema.parse(await jsonBody(request)); await setMarketFlags(userId, b.code, b.flags, b.reason); return listMarkets(); });
}
