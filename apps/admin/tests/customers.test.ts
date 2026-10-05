import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { listCustomers } from "../src/modules/customers/service";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("customers page data", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string, loc: string;
  beforeAll(async () => {
    owner = (await db.user.create({ data: { name: "cu", email: `cu-${suffix}@test.invalid`, phoneNumber: "+97150444" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Customer Burgers", locationName: "Main" }, "t")).id;
    loc = (await db.location.findFirstOrThrow({ where: { businessId: biz } })).id;
  });
  afterAll(async () => { await db.$disconnect(); });
  const order = async (customerId: string, n: string, status: string, total: number, label?: string, at = new Date()) => db.order.create({ data: { businessId: biz, locationId: loc, customerId, orderNumber: n, fulfillmentType: label ? "DELIVERY" : "PICKUP", status: status as never, subtotalMinor: total, totalMinor: total, createdAt: at, ...(label ? { deliveryDetails: { create: { recipientName: "x", recipientPhone: "+1", addressText: "somewhere", city: "Dubai", addressLabel: label } } } : {}) } });

  it("is for Plus and Pro only", async () => {
    await expect(listCustomers(owner, biz)).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
    await db.subscription.create({ data: { businessId: biz, plan: "plus", billing: "monthly", status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000), startedAt: new Date() } });
  });
  it("lists who ordered with orders, spend, last order, saved addresses with how often each was used, and opt-out", async () => {
    const a = await db.customer.create({ data: { businessId: biz, phone: "+971501110001", displayName: "Ahmed Al Mansoori" } });
    const b = await db.customer.create({ data: { businessId: biz, phone: "+971501110002", displayName: "", marketingOptOut: true } });
    const c = await db.customer.create({ data: { businessId: biz, phone: "+971501110003", displayName: "Never Ordered" } });
    const d = await db.customer.create({ data: { businessId: biz, phone: "+971501110004", displayName: "Only Pending" } });
    await order(a.id, "1", "COMPLETED", 12000, "Home", new Date(Date.now() - 86400000)); await order(a.id, "2", "ACCEPTED", 8000, "Home"); await order(a.id, "3", "REJECTED", 5000, "Work"); await order(a.id, "4", "COMPLETED", 3000, "work");
    await order(b.id, "5", "COMPLETED", 4000, undefined, new Date(Date.now() - 5 * 86400000));
    await order(d.id, "6", "AWAITING_CUSTOMER_CONFIRMATION", 9999);
    await db.customerAddress.createMany({ data: [{ customerId: a.id, label: "Home", addressText: "Villa 12, Al Nahda", city: "Al Nahda", emirate: "Dubai", isDefault: true }, { customerId: a.id, label: "Work", addressText: "Churchill Tower", city: "Business Bay", emirate: "Dubai" }, { customerId: a.id, label: "Gym", addressText: "Fitness First", city: "Dubai" }] });
    const { customers } = await listCustomers(owner, biz);
    expect(customers.map(x => x.phone)).toEqual(["+971501110001", "+971501110002"]); // newest order first; no order and unconfirmed review are not customers
    expect(customers[0]).toMatchObject({ name: "Ahmed Al Mansoori", orders: 3, spentMinor: 23000, optedOut: false }); // the rejected order is not counted
    expect(customers[0]!.addresses).toEqual([{ label: "Home", text: "Villa 12, Al Nahda, Dubai", uses: 2, isDefault: true }, { label: "Work", text: "Churchill Tower, Dubai", uses: 1, isDefault: false }, { label: "Gym", text: "Fitness First", uses: 0, isDefault: false }]);
    expect(customers[1]).toMatchObject({ name: "+971501110002", orders: 1, optedOut: true }); // no name: the number is shown
  });
});
