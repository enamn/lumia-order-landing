import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { pairDevice, realtimeTicket, startPairing } from "../src/modules/devices/service";
import { openOrdersForDevice, printOrder } from "../src/modules/devices/orders";
import { confirmPendingOrder, setOrderStatus, setOrderStatusByDevice } from "../src/modules/orders/service";
import { startRealtime, type Realtime } from "../src/realtime/server";
const enabled = process.env.RUN_DB_TESTS === "true";

const open = (url: string, headers: Record<string, string> = {}) => new Promise<{ ws: WebSocket; msgs: any[] }>((resolve, reject) => {
  const ws = new WebSocket(url, { headers }), msgs: any[] = [];
  ws.on("message", m => msgs.push(JSON.parse(String(m)))); ws.on("open", () => resolve({ ws, msgs })); ws.on("error", reject);
});
const until = async (cond: () => boolean, ms = 3000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error("timed out"); await new Promise(r => setTimeout(r, 25)); } };

describe.skipIf(!enabled)("orders on the terminal", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string, branch: string, otherBranch: string, rt: Realtime;
  let key = "", device: { id: string; businessId: string; locationId: string }, customerId = "";
  const user = async (n: string) => (await db.user.create({ data: { name: n, email: `${n}-${suffix}@test.invalid`, phoneNumber: `+97150${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-7)}`, phoneNumberVerified: true } })).id;
  const pending = async (locationId: string, number: string) => (await db.order.create({ data: { businessId: biz, locationId, customerId, orderNumber: number, fulfillmentType: "PICKUP", status: "AWAITING_CUSTOMER_CONFIRMATION", subtotalMinor: 5000, totalMinor: 5000, items: { create: [{ itemNameSnapshot: "Burger", quantity: 2, unitPriceMinor: 2500, subtotalMinor: 5000, taxAmountMinor: 0, totalMinor: 5000 }] } } })).id;

  beforeAll(async () => {
    owner = await user("to-owner"); const b = await createBusiness(owner, { name: "Terminal Grill", locationName: "Main" }, "t"); biz = b.id;
    branch = (await db.location.findFirstOrThrow({ where: { businessId: biz } })).id;
    otherBranch = (await db.location.create({ data: { businessId: biz, name: "Second", code: "SEC" } })).id;
    customerId = (await db.customer.create({ data: { businessId: biz, displayName: "Sara", phone: "+971501234567" } })).id;
    const p = await startPairing(owner, biz, {}), paired = await pairDevice({ code: p.code, serial: `ORD-TERM-${suffix}` }, "10.0.0.9");
    key = paired.key; device = { id: paired.deviceId, businessId: biz, locationId: branch };
    rt = await startRealtime({ port: 0, pollMs: 40 });
  });
  afterAll(async () => { await rt.close(); await db.$disconnect(); });

  it("a confirmed order reaches the terminals of its branch only, and the dashboard; the terminal accepts with a time and the dashboard hears it", async () => {
    const dev = await open(`ws://127.0.0.1:${rt.port}/ws/device`, { authorization: `Bearer ${key}` });
    const dash = await open(`ws://127.0.0.1:${rt.port}/ws/dashboard?ticket=${encodeURIComponent((await realtimeTicket(owner, biz)).ticket)}`);
    await until(() => dev.msgs.some(m => m.type === "hello") && dash.msgs.some(m => m.type === "hello"));

    const elsewhere = await pending(otherBranch, "2001"); await confirmPendingOrder({ businessId: biz, orderId: elsewhere });
    const mine = await pending(branch, "2002");
    expect(dev.msgs.some(m => m.event === "order.new")).toBe(false); // a pending order is not the restaurant's yet
    await confirmPendingOrder({ businessId: biz, orderId: mine });
    await until(() => dev.msgs.some(m => m.event === "order.new" && m.payload.orderId === mine));
    await until(() => dash.msgs.some(m => m.event === "order.new" && m.payload.orderId === mine));
    expect(dev.msgs.some(m => m.event === "order.new" && m.payload.orderId === elsewhere)).toBe(false);
    const ev = dev.msgs.find(m => m.event === "order.new" && m.payload.orderId === mine);
    expect(ev.payload).toMatchObject({ number: "2002", status: "AWAITING_BUSINESS_CONFIRMATION", fulfillment: "PICKUP", totalMinor: 5000, customer: { name: "Sara" }, branch: { id: branch }, business: { name: "Terminal Grill" } });
    expect(ev.payload.items).toEqual([expect.objectContaining({ name: "Burger", quantity: 2 })]);

    dev.ws.send(JSON.stringify({ type: "ack", id: ev.id }));
    await until(() => dash.msgs.some(m => m.event === "order.ack" && m.payload.eventId === ev.id && m.payload.deviceId === device.id));

    expect(await openOrdersForDevice(device)).toEqual([expect.objectContaining({ orderId: mine })]);

    // terminal accepts with a time; the order keeps it and both sides are told
    expect(await setOrderStatusByDevice(device, mine, { status: "ACCEPTED", prepMinutes: 25 }, "r1")).toMatchObject({ status: "ACCEPTED" });
    const o = await db.order.findUniqueOrThrow({ where: { id: mine }, include: { history: true } });
    expect(o).toMatchObject({ status: "ACCEPTED", prepMinutes: 25, acceptedByDeviceId: device.id }); expect(o.promisedAt!.getTime() - Date.now()).toBeGreaterThan(24 * 60_000);
    expect(o.history.at(-1)).toMatchObject({ changedByType: "DEVICE", changedByUserId: device.id });
    await until(() => dash.msgs.some(m => m.event === "order.updated" && m.payload.orderId === mine && m.payload.status === "ACCEPTED" && m.payload.by.type === "DEVICE"));
    await until(() => dev.msgs.some(m => m.event === "order.updated" && m.payload.status === "ACCEPTED" && m.payload.prepMinutes === 25));

    // first wins: the dashboard trying to reject it now is told it is too late
    await expect(setOrderStatus(owner, biz, mine, { status: "REJECTED" }, "r2")).rejects.toMatchObject({ status: 409, code: "INVALID_TRANSITION" });
    // a terminal cannot touch another branch's order
    await expect(setOrderStatusByDevice(device, elsewhere, { status: "ACCEPTED" }, "r3")).rejects.toMatchObject({ status: 404 });
    dev.ws.close(); dash.ws.close();
  });

  it("the dashboard's Print receipt goes to online terminals of the branch, with a job id the terminal answers with", async () => {
    const orderId = (await db.order.findFirstOrThrow({ where: { businessId: biz, orderNumber: "2002" } })).id;
    await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date(Date.now() - 10 * 60_000) } });
    await expect(printOrder(owner, biz, orderId)).rejects.toMatchObject({ code: "DEVICE_OFFLINE" });
    const dev = await open(`ws://127.0.0.1:${rt.port}/ws/device`, { authorization: `Bearer ${key}` });
    const dash = await open(`ws://127.0.0.1:${rt.port}/ws/dashboard?ticket=${encodeURIComponent((await realtimeTicket(owner, biz)).ticket)}`);
    await until(() => dev.msgs.some(m => m.type === "hello") && dash.msgs.some(m => m.type === "hello"));
    const sent = await printOrder(owner, biz, orderId); expect(sent.sent).toBe(1);
    await until(() => dev.msgs.some(m => m.event === "print.order" && m.payload.jobId === sent.jobId && m.payload.number === "2002"));
    dev.ws.send(JSON.stringify({ type: "print.result", ok: true, jobId: sent.jobId, orderId }));
    await until(() => dash.msgs.some(m => m.event === "print.result" && m.payload.jobId === sent.jobId && m.payload.ok === true));
    dev.ws.close(); dash.ws.close();
  });
});
