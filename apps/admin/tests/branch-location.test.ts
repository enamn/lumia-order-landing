import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("the first branch chosen while signing up", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  afterAll(async () => { await db.$disconnect(); });
  const user = async (n: string) => (await db.user.create({ data: { name: n, email: `${n}-${suffix}@test.invalid`, phoneNumber: `+97150${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-7)}`, phoneNumberVerified: true } })).id;

  it("keeps the address, area, region and pin of the place that was picked", async () => {
    const owner = await user("bl-owner"), b = await createBusiness(owner, { name: "Pin Grill", locationName: "Main branch", location: { address: "Marina Walk, Dubai Marina, Dubai", area: "Dubai Marina", region: "Dubai", latitude: 25.0805, longitude: 55.1403 } }, "t");
    const l = await db.location.findFirstOrThrow({ where: { businessId: b.id } });
    expect(l).toMatchObject({ name: "Main branch", addressLine1: "Marina Walk, Dubai Marina, Dubai", city: "Dubai Marina", emirate: "Dubai", latitude: 25.0805, longitude: 55.1403 });
  });
  it("ignores a region that is not one of the country's, and works without any location", async () => {
    const owner = await user("bl-owner2"), b = await createBusiness(owner, { name: "No Pin Grill", locationName: "Main branch", location: { region: "Atlantis", latitude: 25.2, longitude: 55.3 } }, "t");
    expect((await db.location.findFirstOrThrow({ where: { businessId: b.id } })).emirate).toBe("");
    const owner3 = await user("bl-owner3"), c = await createBusiness(owner3, { name: "Plain Grill", locationName: "Main branch" }, "t");
    expect((await db.location.findFirstOrThrow({ where: { businessId: c.id } })).latitude).toBeNull();
  });
  it("rejects a pin outside the world", async () => {
    const owner = await user("bl-owner4");
    await expect(createBusiness(owner, { name: "Bad Pin", locationName: "Main branch", location: { latitude: 120, longitude: 55 } }, "t")).rejects.toBeTruthy();
  });
});
