export const steps = ["BUSINESS", "WHATSAPP", "CATALOG", "ORDERS", "DELIVERY", "AI_AGENT", "DEVICE", "TEST"] as const;
export const stepLabels: Record<string, string> = { BUSINESS: "Business profile", WHATSAPP: "Connect WhatsApp", CATALOG: "Build your menu", ORDERS: "Order preferences", DELIVERY: "Delivery areas", AI_AGENT: "Meet your AI assistant", DEVICE: "Connect a terminal", TEST: "Test & go live" };
export interface ReadinessFacts { profileComplete: boolean; activeLocation: boolean; whatsappConnected: boolean; activeCatalog: boolean; availableItem: boolean; activeAgent: boolean; orderSettings: boolean }
export function evaluateReadiness(facts: ReadinessFacts) {
  const checks = [
    [facts.profileComplete, "BUSINESS_PROFILE_INCOMPLETE", "BUSINESS"], [facts.activeLocation, "ACTIVE_LOCATION_REQUIRED", "BUSINESS"],
    [facts.whatsappConnected, "WHATSAPP_NOT_CONNECTED", "WHATSAPP"], [facts.activeCatalog, "CATALOG_REQUIRED", "CATALOG"],
    [facts.availableItem, "AVAILABLE_ITEM_REQUIRED", "CATALOG"], [facts.activeAgent, "AI_AGENT_INACTIVE", "AI_AGENT"],
    [facts.orderSettings, "ORDER_SETTINGS_REQUIRED", "ORDERS"],
  ] as const;
  const missing = checks.filter(([ok]) => !ok).map(([, code, step]) => ({ code, step }));
  return { ready: missing.length === 0, missing };
}
