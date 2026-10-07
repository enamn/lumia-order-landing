import { z } from "zod";
import { api } from "@/server/api";
import { jsonBody } from "@/server/api-body";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { isSuperAdmin } from "@/server/superadmin";
import { addPolicy, getSupplier, listPolicies, pendingVatReviews, reviewVat, setSupplierRegistration } from "@/modules/tax/service";
export const dynamic = "force-dynamic";
const guard = async (userId: string) => { if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404); };
export async function GET(request: Request) {
  return api(request, async userId => {
    await guard(userId);
    const [supplier, policies, pending, audit] = await Promise.all([getSupplier(), listPolicies(), pendingVatReviews(), db.taxAudit.findMany({ orderBy: { at: "desc" }, take: 30 })]);
    return { supplier, policies, pending, audit: audit.map(a => ({ at: a.at, actorId: a.actorId, entity: a.entity, action: a.action, reason: a.reason })) };
  });
}
// One endpoint for the three things a super admin does with tax: set Afkar's UAE registration, approve a policy, review a customer's VAT number.
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("registration"), data: z.unknown() }), z.object({ action: z.literal("policy"), data: z.unknown() }), z.object({ action: z.literal("review"), businessId: z.string().min(8).max(64), data: z.unknown() }),
]);
export async function POST(request: Request) {
  return api(request, async userId => {
    await guard(userId); const b = bodySchema.parse(await jsonBody(request));
    if (b.action === "registration") return setSupplierRegistration(userId, b.data);
    if (b.action === "policy") return addPolicy(userId, b.data);
    return reviewVat(userId, b.businessId, b.data);
  });
}
