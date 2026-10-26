import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { confirmImport } from "../src/modules/menu/import";
const enabled = process.env.RUN_DB_TESTS === "true";
const LOGO = "data:image/png;base64,iVBORw0KGgo=";
const menu = { categories: [{ name: "Drinks", nameAr: "مشروبات", items: [{ name: "Cola", nameAr: "كولا", price: 7 }] }] };

describe.skipIf(!enabled)("using the name and logo found with a menu", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  afterAll(async () => { await db.$disconnect(); });
  const user = async (n: string) => (await db.user.create({ data: { name: n, email: `${n}-${suffix}@test.invalid`, phoneNumber: `+97150${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-7)}`, phoneNumberVerified: true } })).id;

  it("saves the chosen name and logo with the menu, and leaves them alone when not chosen", async () => {
    const owner = await user("mr-owner"), b = await createBusiness(owner, { name: "Old Name", locationName: "Main" }, "t");
    await confirmImport(owner, b.id, menu, "t"); // nothing chosen
    expect(await db.business.findUniqueOrThrow({ where: { id: b.id }, select: { name: true, logoUrl: true } })).toEqual({ name: "Old Name", logoUrl: null });
    await confirmImport(owner, b.id, { ...menu, restaurant: { name: "Starbucks", logo: LOGO } }, "t");
    expect(await db.business.findUniqueOrThrow({ where: { id: b.id }, select: { name: true, logoUrl: true } })).toEqual({ name: "Starbucks", logoUrl: LOGO });
    await confirmImport(owner, b.id, { ...menu, restaurant: { logo: LOGO.replace("png", "jpeg") } }, "t"); // logo only: the name stays
    expect((await db.business.findUniqueOrThrow({ where: { id: b.id }, select: { name: true } })).name).toBe("Starbucks");
  });
  it("refuses a logo that is not a small PNG/JPG image, and refuses it for someone who cannot manage the business", async () => {
    const owner = await user("mr-owner2"), other = await user("mr-other"), b = await createBusiness(owner, { name: "Guarded", locationName: "Main" }, "t");
    await expect(confirmImport(owner, b.id, { ...menu, restaurant: { logo: "data:text/html;base64,PGI+" } }, "t")).rejects.toBeTruthy();
    await expect(confirmImport(owner, b.id, { ...menu, restaurant: { logo: "https://evil.example/logo.png" } }, "t")).rejects.toBeTruthy();
    await expect(confirmImport(other, b.id, { ...menu, restaurant: { name: "Hijacked" } }, "t")).rejects.toBeTruthy();
    expect((await db.business.findUniqueOrThrow({ where: { id: b.id }, select: { name: true } })).name).toBe("Guarded");
  });
});
