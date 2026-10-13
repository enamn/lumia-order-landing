import { deviceApi } from "@/server/device-api";
import { openOrdersForDevice } from "@/modules/devices/orders";
export const dynamic = "force-dynamic";

// The open orders of the terminal's branch: used after being offline longer than the live connection can replay.
export const GET = (request: Request) => deviceApi(request, device => openOrdersForDevice(device));
