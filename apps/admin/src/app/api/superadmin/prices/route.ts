import { api } from "@/server/api";
import { jsonBody } from "@/server/api-body";
import { AppError } from "@/server/errors";
import { UAE_BOOK } from "@/modules/billing/plans";
import { isSuperAdmin } from "@/server/superadmin";
import { itemsOf, enabledCurrencies, listMarketPrices, setMarketPrice, setMarketPriceList } from "@/modules/billing/pricing";
export const dynamic = "force-dynamic";
const guard = async (userId: string) => { if (!(await isSuperAdmin(userId))) throw new AppError("NOT_FOUND", "Endpoint not found.", 404); };
export async function GET(request: Request) { return api(request, async userId => { await guard(userId); return { uae: UAE_BOOK, items: itemsOf(), enabledCurrencies: [...enabledCurrencies()], prices: await listMarketPrices() }; }); }
export async function POST(request: Request) { return api(request, async userId => { await guard(userId); const body = await jsonBody(request) as { amounts?: unknown }; return body.amounts ? setMarketPriceList(userId, body) : setMarketPrice(userId, body); }); }
