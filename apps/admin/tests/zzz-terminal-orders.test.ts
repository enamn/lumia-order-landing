import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { applySession, getSubscription } from "../src/modules/billing/service";
import { quoteSignup } from "../src/modules/billing/plans";
import { listTerminalOrders, setTerminalStage } from "../src/modules/superadmin/terminals";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("terminal orders in the super admin", () => {
  afterAll(async () => { await db.$disconnect(); });
  it("lists terminal purchases, moves the delivery stage with a tracking number, and the restaurant sees it", async () => {
    const mk = async (p: string) => (await db.user.create({ data: { name: "t", email: `t-${crypto.randomUUID().slice(0, 8)}@test.invalid`, phoneNumber: p + String(Date.now() + Math.floor(Math.random() * 1e5)).slice(-7), phoneNumberVerified: true } })).id;
    const admin = await mk("+97150"), owner = await mk("+97150");
    const biz = (await createBusiness(owner, { name: "Terminal Grill", locationName: "Main" }, "t")).id;
    await applySession(biz, { sessionId: "cs_t1", mode: "payment", complete: true, paid: true, customerId: "cus_t", paymentMethodId: null, paymentIntentId: "pi_t1", amountTotalMinor: quoteSignup("plus", "yearly", 2, 5).totalMinor, metadata: { businessId: biz, kind: "signup", plan: "plus", billing: "yearly", terminals: "2", terminalAddress: "Shop 4, Sharjah", taxRate: "5" } } as any);
    const mine = (await listTerminalOrders()).find(o => o.restaurant === "Terminal Grill")!;
    expect(mine).toMatchObject({ quantity: 2, address: "Shop 4, Sharjah", stage: 0, stageName: "Order placed", country: "AE" });
    await setTerminalStage(admin, mine.id, { stage: 2, tracking: "AWB123" });
    expect((await getSubscription(owner, biz)).terminal).toMatchObject({ stage: 2, tracking: "AWB123" });
    await setTerminalStage(admin, mine.id, { stage: 4 });
    const done = (await listTerminalOrders()).find(o => o.id === mine.id)!;
    expect(done).toMatchObject({ stage: 4, stageName: "Delivered", tracking: "AWB123" }); expect(done.dates.filter(Boolean)).toHaveLength(5);
    await setTerminalStage(admin, mine.id, { stage: 1, tracking: "" }); // moved back by mistake: later days and the tracking number are cleared
    expect((await listTerminalOrders()).find(o => o.id === mine.id)).toMatchObject({ stage: 1, tracking: "" });
    await expect(setTerminalStage(admin, mine.id, { stage: 9 })).rejects.toBeTruthy();
    await expect(setTerminalStage(admin, "no-such-order-id", { stage: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.auditLog.count({ where: { entityId: mine.id, action: "terminal.stage" } })).toBe(3);
  });
});
