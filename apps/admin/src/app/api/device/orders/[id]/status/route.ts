import { deviceApi } from "@/server/device-api";
import { setOrderStatusByDevice } from "@/modules/orders/service";
export const dynamic = "force-dynamic";

// The terminal accepts (with prepMinutes), rejects (with a reason) or moves an order on. Same rules as the dashboard: the first to decide wins, the other gets 409.
export const POST = (request: Request, context: { params: Promise<{ id: string }> }) =>
  deviceApi(request, async (device, requestId, body) => setOrderStatusByDevice(device, (await context.params).id, await body(), requestId));
