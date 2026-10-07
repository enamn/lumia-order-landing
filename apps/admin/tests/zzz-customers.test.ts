import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { applySession } from "../src/modules/billing/service";
import { quoteSignup } from "../src/modules/billing/plans";
import { invoicesOf, listCustomers } from "../src/modules/superadmin/customers";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("super admin: restaurants and users", () => {
  afterAll(async () => { await db.$disconnect(); });
  it("lists restaurants with owner, state and plan, and users who never created a restaurant", async () => {
    const mk = async () => (await db.user.create({ data: { name: "cust", email: `c-${crypto.randomUUID().slice(0, 8)}@test.invalid`, phoneNumber: "+97150" + String(Date.now() + Math.floor(Math.random() * 1e5)).slice(-7), phoneNumberVerified: true } }));
    const owner = await mk(), lonely = await mk();
    const biz = (await createBusiness(owner.id, { name: "List Grill", locationName: "Main" }, "t")).id;
    let all = await listCustomers(); let r = all.restaurants.find(x => x.id === biz)!;
    expect(r).toMatchObject({ name: "List Grill", country: "AE", state: "trial", locked: false, ownerPhone: owner.phoneNumber, plan: "" });
    expect(all.accounts.find(a => a.id === lonely.id)).toMatchObject({ restaurants: 0 }); expect(all.accounts.find(a => a.id === owner.id)).toMatchObject({ restaurants: 1 });
    await applySession(biz, { sessionId: "cs_c1", mode: "payment", complete: true, paid: true, customerId: "cus_c", paymentMethodId: null, paymentIntentId: "pi_c1", amountTotalMinor: quoteSignup("plus", "monthly", 0, 5).totalMinor, metadata: { businessId: biz, kind: "signup", plan: "plus", billing: "monthly", terminals: "0", taxRate: "5" } } as any);
    all = await listCustomers(); r = all.restaurants.find(x => x.id === biz)!;
    expect(r).toMatchObject({ state: "subscribed", plan: "plus", billing: "monthly", locked: false });
    expect((await invoicesOf(biz)).map(i => i.kind)).toEqual(["SIGNUP"]);
    await db.subscription.updateMany({ where: { businessId: biz }, data: { status: "CANCELED" } });
    expect((await listCustomers()).restaurants.find(x => x.id === biz)).toMatchObject({ state: "ended", locked: true });
    expect(all.summary.restaurants).toBeGreaterThan(0);
  });
});
