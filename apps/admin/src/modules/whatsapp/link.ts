import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { lumiaApi } from "@/server/lumia-api";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { linkTestMode, devLinkMode } from "@/modules/auth/phone";
import { saveMenu, type SaveCategory } from "@/modules/menu/import";

// Links the owner's own WhatsApp Business account (Meta Embedded Signup). Meta calls run in lumia-order-api;
// this module authorizes, stores the encrypted token and applies imports. Nothing here sends or stores customer messages.
const id = z.string().regex(/^\d{5,30}$/);
export const connectSchema = z.object({ code: z.string().min(1).max(2048), wabaId: id.optional(), phoneNumberId: id.optional(), mode: z.enum(["existing", "new"]).default("existing") }).strict();
export const applySchema = z.object({ name: z.enum(["lumia", "wa"]).optional(), logo: z.enum(["lumia", "wa"]).optional(), address: z.enum(["lumia", "wa"]).optional() }).strict();
export const catalogUseSchema = z.object({ mode: z.enum(["use", "replace"]) }).strict();

// Deterministic sample data so every screen can be exercised locally without Meta (WHATSAPP_LINK_TEST_MODE only, never production).
const TEST_PROFILE = { name: "Burger House Sharjah", phone: "+971 55 XXX 8210", address: "Al Majaz, Sharjah", logoUrl: null as string | null };
const TEST_CATALOG = { categories: [
  { name: "Burgers", items: [["Classic Burger", 28], ["Chicken Burger", 25], ["Cheese Burger", 30], ["Double Smash", 38], ["BBQ Burger", 33]] },
  { name: "Combos", items: [["Classic Combo", 38], ["Chicken Combo", 35], ["Family Box", 129]] },
  { name: "Sides", items: [["Fries", 10], ["Onion Rings", 14]] },
  { name: "Drinks", items: [["Pepsi", 5], ["Fresh Orange", 14]] },
].map(c => ({ name: c.name, items: c.items.map(([name, price]) => ({ name: name as string, price: price as number })) })) };
const isTestAccount = (a: { phoneNumberId: string | null }) => Boolean(a.phoneNumberId?.startsWith("test-")) && linkTestMode();

async function currentAccount(businessId: string) { return db.whatsAppAccount.findFirst({ where: { businessId }, orderBy: { createdAt: "desc" } }); }

export async function getWhatsAppStatus(userId: string, businessId: string) {
  await authorize(userId, businessId);
  const a = await currentAccount(businessId);
  if (!a) return { status: "none" as const };
  return { status: a.status === "CONNECTED" ? "connected" as const : "disconnected" as const, displayPhoneNumber: a.displayPhoneNumber ?? "", verifiedName: a.verifiedName ?? "", connectedAt: a.connectedAt };
}

async function fetchCatalog(a: { phoneNumberId: string | null; wabaId: string | null; accessTokenEncrypted: string | null }) {
  if (isTestAccount(a)) return TEST_CATALOG;
  if (!a.wabaId || !a.accessTokenEncrypted) return { categories: [] };
  const r = await lumiaApi<typeof TEST_CATALOG>("/internal/whatsapp/catalog", { accessToken: decryptSecret(a.accessTokenEncrypted), wabaId: a.wabaId }, 30000);
  return r.ok ? r.data : { categories: [] };
}

const linkErrors: Record<string, [string, string, number]> = {
  WHATSAPP_LINK_INVALID_CODE: ["WHATSAPP_LINK_INVALID_CODE", "Permission was cancelled before setup finished.", 400],
  WHATSAPP_LINK_PERMISSIONS_MISSING: ["WHATSAPP_LINK_PERMISSIONS_MISSING", "Permission was cancelled before setup finished.", 403],
  WHATSAPP_LINK_MISMATCH: ["WHATSAPP_LINK_MISMATCH", "The business account you selected isn't available right now.", 403],
  WHATSAPP_LINK_CHOOSE_ONE: ["WHATSAPP_LINK_CHOOSE_ONE", "Please select exactly one WhatsApp Business account and try again.", 400],
  WHATSAPP_LINK_NO_NUMBER: ["WHATSAPP_LINK_NO_NUMBER", "That WhatsApp Business account needs exactly one phone number. Select an account with a single number.", 400],
  WHATSAPP_LINK_NOT_CONFIGURED: ["WHATSAPP_LINK_NOT_CONFIGURED", "WhatsApp linking is not available yet. Please try again later.", 503],
};

export async function connectWhatsApp(userId: string, businessId: string, input: unknown, requestId: string) {
  const data = connectSchema.parse(input);
  await authorize(userId, businessId, "business.manage");
  if ((data.code === "dev" && !devLinkMode()) || (data.code === "test" && !linkTestMode())) throw new AppError("WHATSAPP_LINK_INVALID_CODE", "Permission was cancelled before setup finished.", 400); // simulated codes only exist in local development modes
  let link: { accessToken: string; wabaId: string; phoneNumberId: string; displayPhoneNumber: string; verifiedName: string; permissions: string[] };
  if (data.code === "test" && linkTestMode()) {
    link = { accessToken: "test-token", wabaId: "100000000000001", phoneNumberId: `test-${businessId}`, displayPhoneNumber: TEST_PROFILE.phone, verifiedName: TEST_PROFILE.name, permissions: ["whatsapp_business_management", "whatsapp_business_messaging"] };
  } else {
    const r = await lumiaApi<typeof link>("/internal/whatsapp/connect", { code: data.code, ...(data.wabaId ? { wabaId: data.wabaId } : {}), ...(data.phoneNumberId ? { phoneNumberId: data.phoneNumberId } : {}), mode: data.mode }, 60000);
    if (!r.ok) { const e = r.code ? linkErrors[r.code] : undefined; throw new AppError(e?.[0] ?? "WHATSAPP_LINK_FAILED", e?.[1] ?? "We couldn't connect WhatsApp. Please try again.", e?.[2] ?? 502); }
    link = r.data;
  }
  const encrypted = encryptSecret(link.accessToken);
  await transaction(async tx => {
    const { business } = await authorize(userId, businessId, "business.manage", tx);
    const owner = await tx.whatsAppAccount.findFirst({ where: { phoneNumberId: link.phoneNumberId } });
    if (owner && owner.businessId !== businessId) {
      if (owner.status === "CONNECTED") throw new AppError("WHATSAPP_NUMBER_IN_USE", "This WhatsApp number is already connected to another restaurant.", 409);
      await tx.whatsAppAccount.delete({ where: { id: owner.id } }); // released by a previous owner
    }
    const fields = { provider: "META_CLOUD_API", phoneNumberId: link.phoneNumberId, wabaId: link.wabaId, displayPhoneNumber: link.displayPhoneNumber, verifiedName: link.verifiedName, permissions: link.permissions, status: "CONNECTED", accessTokenEncrypted: encrypted, connectedAt: new Date(), disconnectedAt: null };
    const mine = await tx.whatsAppAccount.findFirst({ where: { businessId }, orderBy: { createdAt: "desc" } });
    if (mine) await tx.whatsAppAccount.update({ where: { id: mine.id }, data: fields }); else await tx.whatsAppAccount.create({ data: { businessId, ...fields } });
    await tx.onboardingSession.updateMany({ where: { businessId }, data: { lastActivityAt: new Date() } });
    const session = await tx.onboardingSession.findUnique({ where: { businessId } });
    if (session) await tx.onboardingStep.updateMany({ where: { onboardingSessionId: session.id, stepKey: "WHATSAPP" }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "WhatsAppAccount", entityId: link.phoneNumberId, action: "whatsapp.connected", requestId, afterData: { wabaId: link.wabaId, permissions: link.permissions } } });
  });
  const catalog = await fetchCatalog({ phoneNumberId: link.phoneNumberId, wabaId: link.wabaId, accessTokenEncrypted: encrypted }).catch(() => ({ categories: [] }));
  return { status: "connected" as const, displayPhoneNumber: link.displayPhoneNumber, verifiedName: link.verifiedName, catalogItems: catalog.categories.reduce((n, c) => n + c.items.length, 0) };
}

export async function getImportInfo(userId: string, businessId: string) {
  const { business } = await authorize(userId, businessId, "business.manage");
  const a = await currentAccount(businessId);
  if (!a || a.status !== "CONNECTED") throw new AppError("WHATSAPP_NOT_CONNECTED", "Connect WhatsApp first.", 409);
  let profile = { name: a.verifiedName ?? "", phone: a.displayPhoneNumber ?? "", address: "", logoUrl: null as string | null };
  if (isTestAccount(a)) profile = TEST_PROFILE;
  else if (a.accessTokenEncrypted && a.phoneNumberId) {
    const r = await lumiaApi<{ address: string; logoUrl: string | null }>("/internal/whatsapp/profile", { accessToken: decryptSecret(a.accessTokenEncrypted), phoneNumberId: a.phoneNumberId }, 30000);
    if (r.ok) profile = { ...profile, address: r.data.address, logoUrl: r.data.logoUrl };
  }
  const catalog = await fetchCatalog(a);
  const location = await db.location.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } });
  const items = await db.catalogItem.count({ where: { catalog: { businessId }, status: "ACTIVE" } });
  const cats = await db.catalogCategory.count({ where: { catalog: { businessId }, items: { some: { status: "ACTIVE" } } } });
  return {
    profile: { name: profile.name, phone: profile.phone, address: profile.address, hasLogo: Boolean(profile.logoUrl) },
    catalog: { total: catalog.categories.reduce((n, c) => n + c.items.length, 0), categories: catalog.categories.map(c => ({ name: c.name, count: c.items.length, sample: c.items.slice(0, 4).map(i => i.name) })) },
    lumia: { name: business.name, hasLogo: Boolean(business.logoUrl), address: location?.addressLine1 ?? "", items, categories: cats },
  };
}

export async function applyImport(userId: string, businessId: string, input: unknown, requestId: string) {
  const choices = applySchema.parse(input);
  const info = await getImportInfo(userId, businessId); // re-reads the profile server-side; the browser never supplies values
  const a = (await currentAccount(businessId))!;
  let logoUrl: string | null = null;
  if (choices.logo === "wa" && info.profile.hasLogo) {
    if (isTestAccount(a)) logoUrl = null;
    else if (a.accessTokenEncrypted && a.phoneNumberId) { const r = await lumiaApi<{ logoUrl: string | null }>("/internal/whatsapp/profile", { accessToken: decryptSecret(a.accessTokenEncrypted), phoneNumberId: a.phoneNumberId }, 30000); if (r.ok) logoUrl = r.data.logoUrl; }
  }
  await transaction(async tx => {
    const { business } = await authorize(userId, businessId, "business.manage", tx);
    const data: Record<string, unknown> = {};
    if (choices.name === "wa" && info.profile.name) data.name = info.profile.name;
    if (logoUrl) data.logoUrl = logoUrl;
    if (Object.keys(data).length) await tx.business.update({ where: { id: businessId }, data: { ...data, revision: { increment: 1 } } });
    if (choices.address === "wa" && info.profile.address) { const loc = await tx.location.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } }); if (loc) await tx.location.update({ where: { id: loc.id }, data: { addressLine1: info.profile.address } }); }
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Business", entityId: businessId, action: "whatsapp.import.applied", requestId, afterData: { name: choices.name ?? "lumia", logo: choices.logo ?? "lumia", address: choices.address ?? "lumia" } } });
  });
  return { ok: true };
}

export async function useCatalog(userId: string, businessId: string, input: unknown, requestId: string) {
  const { mode } = catalogUseSchema.parse(input);
  await authorize(userId, businessId, "operations.manage");
  const a = await currentAccount(businessId);
  if (!a || a.status !== "CONNECTED") throw new AppError("WHATSAPP_NOT_CONNECTED", "Connect WhatsApp first.", 409);
  const catalog = await fetchCatalog(a);
  const categories: SaveCategory[] = catalog.categories.filter(c => c.items.length).map(c => ({ name: c.name, items: c.items.map(i => ({ name: i.name, price: i.price ?? 0 })) }));
  if (!categories.length) throw new AppError("WHATSAPP_CATALOG_EMPTY", "No WhatsApp catalog was found.", 404);
  return transaction(async tx => { const { business } = await authorize(userId, businessId, "operations.manage", tx); return saveMenu(tx, business, userId, businessId, categories, requestId, "menu.imported.whatsapp", mode === "replace"); });
}

export async function disconnectWhatsApp(userId: string, businessId: string, requestId: string) {
  await authorize(userId, businessId, "business.manage");
  const a = await currentAccount(businessId);
  if (!a || a.status !== "CONNECTED") return { status: "disconnected" as const };
  if (!isTestAccount(a) && a.accessTokenEncrypted && a.wabaId) {
    const r = await lumiaApi("/internal/whatsapp/disconnect", { accessToken: decryptSecret(a.accessTokenEncrypted), wabaId: a.wabaId }, 30000);
    if (!r.ok) throw new AppError("WHATSAPP_DISCONNECT_FAILED", "We couldn't disconnect WhatsApp. Please try again.", 502);
  }
  await transaction(async tx => {
    const { business } = await authorize(userId, businessId, "business.manage", tx);
    await tx.whatsAppAccount.update({ where: { id: a.id }, data: { status: "DISCONNECTED", accessTokenEncrypted: null, disconnectedAt: new Date() } });
    const session = await tx.onboardingSession.findUnique({ where: { businessId } });
    if (session) await tx.onboardingStep.updateMany({ where: { onboardingSessionId: session.id, stepKey: "WHATSAPP" }, data: { status: "PENDING", completedAt: null } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "WhatsAppAccount", entityId: a.phoneNumberId ?? a.id, action: "whatsapp.disconnected", requestId } });
  });
  return { status: "disconnected" as const };
}
