import { createHash } from "node:crypto";
import { db } from "../src/server/db";

import { createBusiness, getBusiness, updateBusiness } from "../src/modules/business/service";
import { toProfile } from "../src/modules/business/presenter";
const id = (key: string) => { const hex = createHash("sha256").update(`lumia-demo:${key}`).digest("hex"); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`; };
async function seed() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true") throw Error("Demo seed requires ALLOW_DEMO_SEED=true outside production.");
  const phoneNumber = process.env.DEMO_PHONE_NUMBER;
  if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) throw Error("Set DEMO_PHONE_NUMBER to a development-only E.164 number.");
  const email = "owner@lumia-demo.test";
  // Development fixture only. Signing in still requires a real WhatsApp code.
  const user = await db.user.upsert({ where: { phoneNumber }, create: { name: "Ahmad", email, phoneNumber, phoneNumberVerified: true }, update: {} });
  const business = await createBusiness(user.id, { name: "Lumia Demo Restaurant", locationName: "Sharjah Branch" }, "demo-seed");
  const profile = toProfile(await getBusiness(user.id, business.id));
  await updateBusiness(user.id, business.id, { ...profile, phone: "+971501234567", location: { ...profile.location, addressLine1: "Al Majaz 2", city: "Sharjah", emirate: "Sharjah" } }, "demo-seed");
  const catalog = await db.catalog.upsert({ where: { id: id("catalog") }, create: { id: id("catalog"), businessId: business.id, name: "Main Menu", status: "ACTIVE" }, update: {} });
  const menu: Record<string, [string, string, string][]> = {
    Burgers: [["Chicken Burger", "برجر دجاج", "28.00"], ["Classic Beef Burger", "برجر لحم", "34.00"], ["Mushroom Burger", "برجر مشروم", "38.00"]],
    Pizza: [["Margherita", "مارغريتا", "32.00"], ["Pepperoni Pizza", "بيتزا بيبروني", "42.00"], ["Garden Pizza", "بيتزا خضار", "36.00"]],
    Drinks: [["Fresh Orange Juice", "عصير برتقال", "14.00"], ["Cola", "كولا", "7.00"], ["Mineral Water", "مياه", "5.00"]],
    Desserts: [["Chocolate Brownie", "براوني", "18.00"], ["Cheesecake", "تشيز كيك", "22.00"]],
  };
  for (const [categoryName, items] of Object.entries(menu)) {
    const category = await db.catalogCategory.upsert({ where: { id: id(categoryName) }, create: { id: id(categoryName), catalogId: catalog.id, name: categoryName }, update: {} });
    for (const [name, nameAr, basePrice] of items) await db.catalogItem.upsert({ where: { id: id(name) }, create: { id: id(name), catalogId: catalog.id, categoryId: category.id, name, nameAr, basePriceMinor: Math.round(Number(basePrice) * 100), taxBehavior: "VAT_EXEMPT" }, update: {} });
  }
  for (const [name, price, isDefault] of [["Regular", "28.00", true], ["Double", "38.00", false]] as const) await db.itemVariant.upsert({ where: { id: id(`variant-${name}`) }, create: { id: id(`variant-${name}`), catalogItemId: id("Chicken Burger"), name, priceMinor: Math.round(Number(price) * 100), isDefault }, update: {} });
  await db.modifierGroup.upsert({ where: { id: id("extras") }, create: { id: id("extras"), catalogItemId: id("Chicken Burger"), name: "Make it yours", maxSelections: 2 }, update: {} });
  for (const [name, priceDelta] of [["Extra cheese", "5.00"], ["Mushrooms", "3.00"]]) await db.modifierOption.upsert({ where: { id: id(name) }, create: { id: id(name), modifierGroupId: id("extras"), name, priceDeltaMinor: Math.round(Number(priceDelta) * 100) }, update: {} });
  await db.aiAgent.upsert({ where: { id: id("agent") }, create: { id: id("agent"), businessId: business.id, name: "Lumia", status: "DRAFT", languages: ["ar", "en"], tone: "Friendly" }, update: {} });
  await db.deliveryZone.upsert({ where: { id: id("delivery") }, create: { id: id("delivery"), locationId: profile.location.id, name: "Al Majaz & Al Khan", deliveryFeeMinor: 700, minimumOrderMinor: 2500, configuration: { areas: ["Al Majaz", "Al Khan"], city: "Sharjah" } }, update: {} });
  await db.device.upsert({ where: { serialNumber: "LUMIA-DEMO-001" }, create: { businessId: business.id, locationId: profile.location.id, serialNumber: "LUMIA-DEMO-001", name: "Demo terminal", status: "INACTIVE" }, update: {} });
  console.log("Demo workspace ready. Use your DEMO_PHONE_NUMBER and a WhatsApp code to sign in. Ordering integrations remain inactive.");
}
seed().catch(() => { console.error("Demo seed failed. Check database connectivity, seed opt-in, and the development phone configuration."); process.exitCode = 1; }).finally(() => db.$disconnect());
