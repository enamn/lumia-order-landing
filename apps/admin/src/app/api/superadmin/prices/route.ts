import { api } from "@/server/api";
import { jsonBody } from "@/server/api-body";
import { AppError } from "@/server/errors";
import { isSuperAdmin } from "@/server/superadmin";
import { itemsOf, enabledCurrencies, listMarketPrices, setMarketPrice } from "@/modules/billing/pricing";
export const dynamic = "force-dynamic";
const guard = async (userId: string) => { if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404); };
export async function GET(request: Request) { return api(request, async userId => { await guard(userId); return { items: itemsOf(), enabledCurrencies: [...enabledCurrencies()], prices: await listMarketPrices() }; }); }
export async function POST(request: Request) { return api(request, async userId => { await guard(userId); return setMarketPrice(userId, await jsonBody(request)); }); }
