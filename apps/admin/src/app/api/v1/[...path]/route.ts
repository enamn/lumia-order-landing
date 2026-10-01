import { api, jsonBody } from "@/server/api";
import { getMenu, addItem, setItemAvailability } from "@/modules/menu/service";
import { extractMenu, confirmImport } from "@/modules/menu/import";
import { setLanguage } from "@/modules/auth/profile";
import { connectWhatsApp, getWhatsAppStatus, getImportInfo, applyImport, useCatalog, disconnectWhatsApp } from "@/modules/whatsapp/link";
import { createMessageTemplate } from "@/modules/whatsapp/templates";
import { getMessageStats, listConversations } from "@/modules/messages/inbound";
import { AppError } from "@/server/errors";
import { createBusiness, getBusiness, listBusinesses, updateBusiness, updateLocation, readiness, completeOnboarding, members, setMember } from "@/modules/business/service";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return api(request, async (userId, requestId) => {
    const { path } = await context.params;
    const [resource, businessId, section, subId, subId2] = path;
    const method = request.method;
    if (resource === "me" && path.length === 1 && method === "PATCH") return setLanguage(userId, await jsonBody(request));
    if (resource !== "businesses") throw new AppError("NOT_FOUND", "Endpoint not found.", 404);
    if (path.length === 1) {
      if (method === "GET") return listBusinesses(userId);
      if (method === "POST") return createBusiness(userId, await jsonBody(request, 262144), requestId);
    }
    if (path.length === 2) {
      if (method === "GET") return getBusiness(userId, businessId);
      if (method === "PATCH") return updateBusiness(userId, businessId, await jsonBody(request), requestId);
    }
    if (section === "locations" && path.length === 4) {
      if (method === "PATCH") return updateLocation(userId, businessId, subId, await jsonBody(request), requestId);
      if (method === "GET") { const b = await getBusiness(userId, businessId); const location = b.locations.find(l => l.id === subId); if (!location) throw new AppError("NOT_FOUND", "Location not found.", 404); return location; }
    }
    if (section === "onboarding") {
      if (method === "GET" && path.length === 3) { const b = await getBusiness(userId, businessId); return { ...b.onboarding, readiness: await readiness(userId, businessId) }; }
      if (method === "GET" && subId === "readiness" && path.length === 4) return readiness(userId, businessId);
      if (method === "POST" && subId === "complete" && path.length === 4) return completeOnboarding(userId, businessId);
    }
    if (section === "members" && path.length === 3) {
      if (method === "GET") return members(userId, businessId);
      if (method === "POST") return setMember(userId, businessId, await jsonBody(request), requestId);
    }
    if (section === "whatsapp") {
      if (method === "GET" && path.length === 3) return getWhatsAppStatus(userId, businessId);
      if (method === "GET" && subId === "stats" && path.length === 4) return getMessageStats(userId, businessId);
      if (method === "POST" && subId === "connect" && path.length === 4) return connectWhatsApp(userId, businessId, await jsonBody(request), requestId);
      if (method === "GET" && subId === "import" && path.length === 4) return getImportInfo(userId, businessId);
      if (method === "POST" && subId === "import" && subId2 === "apply" && path.length === 5) return applyImport(userId, businessId, await jsonBody(request), requestId);
      if (method === "POST" && subId === "catalog" && subId2 === "use" && path.length === 5) return useCatalog(userId, businessId, await jsonBody(request), requestId);
      if (method === "POST" && subId === "disconnect" && path.length === 4) return disconnectWhatsApp(userId, businessId, requestId);
      if (method === "POST" && subId === "templates" && path.length === 4) return createMessageTemplate(userId, businessId, await jsonBody(request), requestId);
    }
    if (section === "conversations" && method === "GET" && path.length === 3) return listConversations(userId, businessId);
    if (section === "menu") {
      if (method === "GET" && path.length === 3) return getMenu(userId, businessId);
      if (subId === "import" && method === "POST" && path.length === 4) return extractMenu(userId, businessId, await jsonBody(request, 12 * 1048576));
      if (subId === "import" && subId2 === "confirm" && method === "POST" && path.length === 5) return confirmImport(userId, businessId, await jsonBody(request, 262144), requestId);
      if (subId === "items" && method === "POST" && path.length === 4) return addItem(userId, businessId, await jsonBody(request), requestId);
      if (subId === "items" && method === "PATCH" && path.length === 5) return setItemAvailability(userId, businessId, subId2, await jsonBody(request), requestId);
    }
    throw new AppError("NOT_FOUND", "Endpoint not found.", 404);
  });
}
export { handle as GET, handle as POST, handle as PATCH };
