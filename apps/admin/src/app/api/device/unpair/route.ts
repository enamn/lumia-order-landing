import { deviceApi } from "@/server/device-api";
import { unpairDevice } from "@/modules/devices/service";
export const dynamic = "force-dynamic";

// The terminal's Disconnect button: the terminal leaves the restaurant, and the dashboard list updates at once.
export const POST = (request: Request) => deviceApi(request, device => unpairDevice(device));
