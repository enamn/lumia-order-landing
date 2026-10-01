import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness, getBusiness } from "../src/modules/business/service";
import { connectWhatsApp, getWhatsAppStatus, getImportInfo, applyImport, useCatalog, disconnectWhatsApp } from "../src/modules/whatsapp/link";
import { decryptSecret } from "../src/server/crypto";
import { getMenu } from "../src/modules/menu/service";
import { createMessageTemplate } from "../src/modules/whatsapp/templates";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("WhatsApp linking", () => {
  const suffix = crypto.randomUUID(); let serial = 500;
  let owner: string, staff: string, other: string, a: string, b: string;
  const meta = { code: "the-code", wabaId: "100200300400500", phoneNumberId: "200300400500600" };
  const link = { accessToken: "biz-token-abc", wabaId: meta.wabaId, phoneNumberId: meta.phoneNumberId, displayPhoneNumber: "+971 55 123 8210", verifiedName: "Real Name", permissions: ["whatsapp_business_management", "whatsapp_business_messaging"] };
  let calls: { url: string; body: any }[];
  const mockApi = (handlers: Record<string, (body: any) => Response> = {}) => vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname; const body = JSON.parse(String(init.body)); calls.push({ url: path, body });
    if (handlers[path]) return handlers[path](body);
    if (path === "/internal/whatsapp/connect") return Response.json(link);
    if (path === "/internal/whatsapp/catalog") return Response.json({ categories: [{ name: "Burgers", items: [{ name: "Classic", price: 28 }, { name: "Free", price: null }] }] });
    if (path === "/internal/whatsapp/profile") return Response.json({ address: "Al Majaz", about: "", email: "", logoUrl: "data:image/png;base64,aGk=" });
    return Response.json({ ok: true });
  }));
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_DEV_LINK = "false";
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const mk = (name: string) => db.user.create({ data: { name, email: `${name}-${suffix}@test.invalid`, phoneNumber: `+97150888${String(serial++).padStart(4, "0")}`, phoneNumberVerified: true } });
    [owner, staff, other] = (await Promise.all(["own", "stf", "oth"].map(mk))).map(u => u.id);
    const [x, y] = await Promise.all([createBusiness(owner, { name: "Alpha", locationName: "Main" }, "t"), createBusiness(other, { name: "Beta", locationName: "Main" }, "t")]); a = x.id; b = y.id;
    await db.membership.create({ data: { organizationId: x.organizationId, userId: staff, role: "STAFF" } });
  });
  beforeEach(() => { calls = []; vi.unstubAllGlobals(); mockApi(); });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("connects: stores the token encrypted, never returns it, completes the WHATSAPP step", async () => {
    const result = await connectWhatsApp(owner, a, meta, "t");
    expect(result).toEqual({ status: "connected", displayPhoneNumber: "+971 55 123 8210", verifiedName: "Real Name", catalogItems: 2 });
    expect(calls[0]).toMatchObject({ url: "/internal/whatsapp/connect", body: meta });
    const row = await db.whatsAppAccount.findFirstOrThrow({ where: { businessId: a } });
    expect(row.status).toBe("CONNECTED"); expect(row.accessTokenEncrypted).not.toContain("biz-token"); expect(decryptSecret(row.accessTokenEncrypted!)).toBe("biz-token-abc");
    expect(row.permissions).toContain("whatsapp_business_messaging");
    expect(JSON.stringify(await getWhatsAppStatus(owner, a))).not.toContain("biz-token");
    const step = (await getBusiness(owner, a)).onboarding!.steps.find(s => s.stepKey === "WHATSAPP");
    expect(step?.status).toBe("COMPLETED");
  });
  it("only owners/admins can connect; other tenants cannot see it", async () => {
    await expect(connectWhatsApp(staff, a, meta, "t")).rejects.toMatchObject({ status: 403 });
    await expect(getWhatsAppStatus(other, a)).rejects.toMatchObject({ status: 404 });
    await expect(connectWhatsApp(other, a, meta, "t")).rejects.toMatchObject({ status: 404 });
  });
  it("creates a validated message template through the server and audits it", async () => {
    mockApi({ "/internal/whatsapp/templates": body => {
      expect(body.accessToken).toBe("biz-token-abc");
      expect(body.wabaId).toBe(meta.wabaId);
      expect(body.template).toMatchObject({ name: "lumia_order_confirmation_review_01", category: "UTILITY", language: "en_US", components: [{ type: "BODY", example: { body_text: [["Ahmad", "LO-1001"]] } }] });
      return Response.json({ id: "template-123", status: "PENDING", category: "UTILITY" });
    } });
    const result = await createMessageTemplate(owner, a, { name: "lumia_order_confirmation_review_01", category: "UTILITY", language: "en_US", body: "Hi {{1}}, order {{2}} is confirmed.", examples: ["Ahmad", "LO-1001"] }, "template-request");
    expect(result).toMatchObject({ id: "template-123", status: "PENDING", name: "lumia_order_confirmation_review_01" });
    expect(await db.auditLog.findFirst({ where: { businessId: a, action: "whatsapp.template.created", entityId: "template-123" } })).not.toBeNull();
    await expect(createMessageTemplate(staff, a, { name: "valid_name", body: "Hi there, your order is ready.", examples: [] }, "t")).rejects.toMatchObject({ status: 403 });
    await expect(createMessageTemplate(owner, a, { name: "valid_name", body: "Hi {{2}}, your order is ready.", examples: ["Ahmad", "LO-1001"] }, "t")).rejects.toMatchObject({ code: "INVALID_TEMPLATE_VARIABLES" });
  });
  it("rejects a number already connected to another restaurant, and maps API failures to friendly errors", async () => {
    await expect(connectWhatsApp(other, b, meta, "t")).rejects.toMatchObject({ code: "WHATSAPP_NUMBER_IN_USE", status: 409 });
    mockApi({ "/internal/whatsapp/connect": () => Response.json({ error: { code: "WHATSAPP_LINK_PERMISSIONS_MISSING" } }, { status: 403 }) });
    await expect(connectWhatsApp(owner, a, meta, "t")).rejects.toMatchObject({ status: 403, message: "Permission was cancelled before setup finished." });
    mockApi({ "/internal/whatsapp/connect": () => Response.json({ error: { code: "WHATSAPP_LINK_MISMATCH" } }, { status: 403 }) });
    await expect(connectWhatsApp(owner, a, meta, "t")).rejects.toMatchObject({ message: "The business account you selected isn't available right now." });
    await expect(connectWhatsApp(owner, a, { code: "test" }, "t")).rejects.toMatchObject({ code: "WHATSAPP_LINK_INVALID_CODE" }); // no test bypass outside AUTH_TEST_MODE
  });
  it("import info compares WhatsApp against Lumia; apply re-reads the profile server-side", async () => {
    const info = await getImportInfo(owner, a);
    expect(info.profile).toMatchObject({ name: "Real Name", address: "Al Majaz", hasLogo: true }); expect(info.catalog.total).toBe(2); expect(info.lumia).toMatchObject({ name: "Alpha", hasLogo: false, items: 0 });
    await applyImport(owner, a, { name: "wa", logo: "wa", address: "wa" }, "t");
    const business = await db.business.findUniqueOrThrow({ where: { id: a } }); expect(business.name).toBe("Real Name"); expect(business.logoUrl).toBe("data:image/png;base64,aGk=");
    expect((await db.location.findFirstOrThrow({ where: { businessId: a } })).addressLine1).toBe("Al Majaz");
    await expect(applyImport(owner, a, { name: "wa", price: 1 }, "t")).rejects.toBeDefined();
    await expect(applyImport(staff, a, { name: "wa" }, "t")).rejects.toMatchObject({ status: 403 });
  });
  it("uses the catalog as the menu, and replace archives the old items", async () => {
    expect((await useCatalog(owner, a, { mode: "use" }, "t")).created).toBe(2);
    expect((await getMenu(owner, a)).flatMap(c => c.items.map(i => i.name)).sort()).toEqual(["Classic", "Free"]);
    expect((await getMenu(owner, a)).flatMap(c => c.items).find(i => i.name === "Free")?.priceMinor).toBe(0);
    mockApi({ "/internal/whatsapp/catalog": () => Response.json({ categories: [{ name: "Drinks", items: [{ name: "Pepsi", price: 5 }] }] }) });
    await useCatalog(owner, a, { mode: "replace" }, "t");
    expect((await getMenu(owner, a)).flatMap(c => c.items.map(i => i.name))).toEqual(["Pepsi"]);
    mockApi({ "/internal/whatsapp/catalog": () => Response.json({ categories: [] }) });
    await expect(useCatalog(owner, a, { mode: "use" }, "t")).rejects.toMatchObject({ code: "WHATSAPP_CATALOG_EMPTY" });
  });
  it("disconnect unsubscribes, drops the token, keeps business data and allows reconnecting", async () => {
    await disconnectWhatsApp(owner, a, "t");
    expect(calls.at(-1)).toMatchObject({ url: "/internal/whatsapp/disconnect", body: { accessToken: "biz-token-abc", wabaId: meta.wabaId } });
    const row = await db.whatsAppAccount.findFirstOrThrow({ where: { businessId: a } }); expect(row.status).toBe("DISCONNECTED"); expect(row.accessTokenEncrypted).toBeNull();
    expect((await getWhatsAppStatus(owner, a)).status).toBe("disconnected");
    expect((await getMenu(owner, a)).length).toBeGreaterThan(0);
    // the released number can now be linked by another restaurant
    await connectWhatsApp(other, b, meta, "t"); expect((await getWhatsAppStatus(other, b)).status).toBe("connected");
    await disconnectWhatsApp(other, b, "t"); await connectWhatsApp(owner, a, meta, "t"); expect((await getWhatsAppStatus(owner, a)).status).toBe("connected");
  });
  it("the dev code is refused unless dev link is on, and works (via the API) when it is", async () => {
    await expect(connectWhatsApp(other, b, { code: "dev" }, "t")).rejects.toMatchObject({ code: "WHATSAPP_LINK_INVALID_CODE" });
    await disconnectWhatsApp(owner, a, "t"); // free the number used by earlier tests
    vi.stubEnv("WHATSAPP_DEV_LINK", "true"); const n = calls.length; const r = await connectWhatsApp(other, b, { code: "dev" }, "t");
    expect(r.verifiedName).toBe("Real Name"); expect(calls[n]).toMatchObject({ url: "/internal/whatsapp/connect", body: { code: "dev", mode: "existing" } });
    await disconnectWhatsApp(other, b, "t"); vi.stubEnv("NODE_ENV", "production"); await expect(connectWhatsApp(other, b, { code: "dev" }, "t")).rejects.toMatchObject({ code: "WHATSAPP_LINK_INVALID_CODE" }); vi.unstubAllEnvs();
  });
  it("test mode simulates a full connection without Meta, and is ignored in production", async () => {
    vi.stubEnv("WHATSAPP_LINK_TEST_MODE", "true"); const before = calls.length;
    const r = await connectWhatsApp(other, b, { code: "test" }, "t");
    expect(r).toMatchObject({ verifiedName: "Burger House Sharjah", catalogItems: 12 }); expect(calls.length).toBe(before);
    expect((await getImportInfo(other, b)).catalog.total).toBe(12);
    await disconnectWhatsApp(other, b, "t"); expect(calls.length).toBe(before);
    vi.stubEnv("NODE_ENV", "production"); await expect(connectWhatsApp(other, b, { code: "test" }, "t")).rejects.toMatchObject({ code: "WHATSAPP_LINK_INVALID_CODE" }); vi.unstubAllEnvs();
  });
});
