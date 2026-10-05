import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness } from "../src/modules/business/service";
import { addItem, createBranchMenu, getMenu, getMenuScopes, removeBranchMenu, setItemAvailability } from "../src/modules/menu/service";
import { catalogIdFor } from "../src/modules/menu/catalog";
import { confirmImport } from "../src/modules/menu/import";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("one menu for all branches, or a menu for each branch on Pro", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string, main: string, second: string;
  const names = async (branch?: string | null) => (await getMenu(owner, biz, branch)).flatMap(c => c.items.map(i => i.name)).sort();
  const setPlan = (plan: string) => db.subscription.upsert({ where: { id: `sub-${suffix}` }, create: { id: `sub-${suffix}`, businessId: biz, plan, billing: "monthly", status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000), startedAt: new Date() }, update: { plan } });
  beforeAll(async () => {
    await ensureMongoIndexes();
    owner = (await db.user.create({ data: { name: "mn", email: `mn-${suffix}@test.invalid`, phoneNumber: "+97150555" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Menu Burgers", locationName: "Main" }, "t")).id;
    main = (await db.location.findFirstOrThrow({ where: { businessId: biz } })).id;
    second = (await db.location.create({ data: { businessId: biz, name: "Second", code: `S${suffix}`.toUpperCase(), status: "ACTIVE" } })).id;
    await addItem(owner, biz, { name: "Classic", category: "Burgers", price: 28 }, "r1");
    await addItem(owner, biz, { name: "Fries", category: "Sides", price: 12 }, "r2");
  });
  afterAll(async () => { await db.$disconnect(); });

  it("Starter and Plus have one menu: a branch is ignored and a branch menu cannot be created", async () => {
    for (const plan of ["starter", "plus"]) {
      await setPlan(plan);
      expect(await names(second)).toEqual(["Classic", "Fries"]);
      expect((await getMenuScopes(owner, biz)).menuPerBranch).toBe(false);
      await expect(createBranchMenu(owner, biz, second, { copy: true }, "r")).rejects.toMatchObject({ code: "NOT_PRO" });
      await expect(addItem(owner, biz, { name: "X", category: "Y", price: 1 }, "r", second)).rejects.toMatchObject({ code: "NOT_PRO" });
    }
  });
  it("Pro: a branch without its own menu uses the shared one; editing it first needs a menu of its own", async () => {
    await setPlan("pro");
    expect(await names(second)).toEqual(["Classic", "Fries"]);
    expect(await catalogIdFor(db, biz, second)).toBe(await catalogIdFor(db, biz, null));
    await expect(addItem(owner, biz, { name: "X", category: "Y", price: 1 }, "r", second)).rejects.toMatchObject({ code: "BRANCH_MENU_MISSING" });
    await expect(addItem(owner, biz, { name: "X", category: "Y", price: 1 }, "r", "no-such-branch")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getMenuScopes(owner, biz)).toMatchObject({ menuPerBranch: true, branches: [{ id: main, hasOwnMenu: false }, { id: second, hasOwnMenu: false }] });
  });
  it("creates a branch menu as a copy of the shared one, then the two are edited independently", async () => {
    expect(await createBranchMenu(owner, biz, second, { copy: true }, "r")).toEqual({ branchId: second, items: 2 });
    await expect(createBranchMenu(owner, biz, second, { copy: true }, "r")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await names(second)).toEqual(["Classic", "Fries"]);
    await addItem(owner, biz, { name: "Branch Special", category: "Burgers", price: 40 }, "r", second);
    await addItem(owner, biz, { name: "Shared Shake", category: "Drinks", price: 15 }, "r");
    expect(await names(second)).toEqual(["Branch Special", "Classic", "Fries"]);
    expect(await names(null)).toEqual(["Classic", "Fries", "Shared Shake"]);
    expect(await names(main)).toEqual(["Classic", "Fries", "Shared Shake"]); // main has no menu of its own
    const own = (await getMenu(owner, biz, second)).flatMap(c => c.items).find(i => i.name === "Classic")!;
    await setItemAvailability(owner, biz, own.id, { isAvailable: false }, "r");
    expect((await getMenu(owner, biz, null)).flatMap(c => c.items).find(i => i.name === "Classic")!.isAvailable).toBe(true); // the copy is separate
    expect(await getMenuScopes(owner, biz)).toMatchObject({ branches: [{ id: main, hasOwnMenu: false }, { id: second, hasOwnMenu: true, items: 3 }] });
  });
  it("an import goes to the menu it was made for", async () => {
    await confirmImport(owner, biz, { categories: [{ name: "Desserts", nameAr: "", items: [{ name: "Brownie", nameAr: "", price: 18 }] }] }, "r", second);
    expect(await names(second)).toContain("Brownie"); expect(await names(null)).not.toContain("Brownie");
  });
  it("removing a branch menu sends the branch back to the shared one; a downgrade ignores branch menus but keeps them", async () => {
    await setPlan("plus"); expect(await names(second)).toEqual(["Classic", "Fries", "Shared Shake"]);
    await setPlan("pro"); expect(await names(second)).toContain("Branch Special");
    await removeBranchMenu(owner, biz, second, "r");
    expect(await names(second)).toEqual(["Classic", "Fries", "Shared Shake"]);
    await expect(removeBranchMenu(owner, biz, second, "r")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
