import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { db } from "../src/server/db";
import { createBusiness } from "../src/modules/business/service";
import { businessChannel, cancelPairing, deviceChannel, announceBranch, disconnectDevice, getPairing, listDevices, pairDevice, publish, realtimeTicket, signTicket, startPairing, testPrint, unpairDevice, updateDevice, verifyTicket } from "../src/modules/devices/service";
import { startRealtime, type Realtime } from "../src/realtime/server";
const enabled = process.env.RUN_DB_TESTS === "true";

const open = (url: string, headers: Record<string, string> = {}) => new Promise<{ ws: WebSocket; msgs: any[] }>((resolve, reject) => {
  const ws = new WebSocket(url, { headers }), msgs: any[] = [];
  ws.on("message", m => msgs.push(JSON.parse(String(m)))); ws.on("open", () => resolve({ ws, msgs })); ws.on("error", reject); ws.on("unexpected-response", (_r, res) => reject(new Error(`HTTP ${res.statusCode}`)));
});
const until = async (cond: () => boolean, ms = 3000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error("timed out"); await new Promise(r => setTimeout(r, 25)); } };

describe.skipIf(!enabled)("connecting a terminal", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, stranger: string, biz: string, rt: Realtime;
  const user = async (n: string) => (await db.user.create({ data: { name: n, email: `${n}-${suffix}@test.invalid`, phoneNumber: `+97150${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-7)}`, phoneNumberVerified: true } })).id;
  beforeAll(async () => { owner = await user("dv-owner"); stranger = await user("dv-other"); biz = (await createBusiness(owner, { name: "Pair Grill", locationName: "Main" }, "t")).id; rt = await startRealtime({ port: 0, pollMs: 40 }); });
  afterAll(async () => { await rt.close(); await db.$disconnect(); });

  let code = "", key = "", deviceId = "";
  it("shows a one-time code and QR text to the owner only, and keeps only a hash of the code", async () => {
    await expect(startPairing(stranger, biz, {})).rejects.toMatchObject({ status: 404 });
    const p = await startPairing(owner, biz, {}); code = p.code;
    expect(p.code).toMatch(/^\d{6}$/); expect(p.qr).toContain(`c=${code}`); expect(p.qr.startsWith("lumia-pair://v1?")).toBe(true);
    expect(p.expiresAt.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    const row = await db.pairingSession.findUniqueOrThrow({ where: { id: p.sessionId } }); expect(row.codeHash).not.toContain(code);
    expect(await getPairing(owner, biz, p.sessionId)).toMatchObject({ status: "OPEN" });
  });
  it("a new code cancels the old one; a canceled or expired code does not work", async () => {
    const first = await startPairing(owner, biz, {}), second = await startPairing(owner, biz, {});
    expect(await getPairing(owner, biz, first.sessionId)).toMatchObject({ status: "CANCELED" });
    await expect(pairDevice({ code: first.code, serial: "SERIAL-CANCEL-1" }, "10.0.0.1")).rejects.toMatchObject({ code: "INVALID_CODE" });
    await cancelPairing(owner, biz, second.sessionId);
    const third = await startPairing(owner, biz, {}); code = third.code;
    await db.pairingSession.update({ where: { id: third.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getPairing(owner, biz, third.sessionId)).toMatchObject({ status: "EXPIRED" });
    await expect(pairDevice({ code, serial: "SERIAL-EXPIRED-1" }, "10.0.0.1")).rejects.toMatchObject({ code: "INVALID_CODE" });
  });
  it("wrong codes are limited per address", async () => {
    for (let i = 0; i < 10; i++) await expect(pairDevice({ code: "000000", serial: "SERIAL-LIMIT-1" }, "10.9.9.9")).rejects.toMatchObject({ code: "INVALID_CODE" });
    const p = await startPairing(owner, biz, {});
    await expect(pairDevice({ code: p.code, serial: "SERIAL-LIMIT-1" }, "10.9.9.9")).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS", status: 429 });
    await cancelPairing(owner, biz, p.sessionId);
  });
  it("the terminal pairs with the code, gets its key once, and the dashboard is told", async () => {
    const p = await startPairing(owner, biz, {}); code = p.code;
    const r = await pairDevice({ code, serial: "SERIAL-PAIR-0001", model: "Lumia T1", appVersion: "1.0.0" }, "10.0.0.2");
    key = r.key; deviceId = r.deviceId;
    expect(key.startsWith("lumd_")).toBe(true); expect(r).toMatchObject({ business: { id: biz, name: "Pair Grill" }, branch: { name: "Main" } });
    const d = await db.device.findUniqueOrThrow({ where: { id: deviceId } }); expect(d.credentialHash).not.toBe(key); expect(d).toMatchObject({ status: "ACTIVE", name: "Kitchen terminal", model: "Lumia T1" });
    expect(await getPairing(owner, biz, p.sessionId)).toMatchObject({ status: "USED", deviceId });
    expect((await db.deviceEvent.findMany({ where: { channel: businessChannel(biz), type: "device.paired" } })).some(e => (e.payload as any).deviceId === deviceId)).toBe(true);
    await expect(pairDevice({ code, serial: "SERIAL-PAIR-0002" }, "10.0.0.2")).rejects.toMatchObject({ code: "INVALID_CODE" }); // one use only
  });
  it("lists the device with its branch and online state; rename and move it to a branch", async () => {
    const l = await listDevices(owner, biz); expect(l.devices).toHaveLength(1); expect(l.devices[0]).toMatchObject({ id: deviceId, online: true, serial: "SERIAL-PAIR-0001", model: "Lumia T1" });
    expect((await listDevices(owner, biz, new Date(Date.now() + 5 * 60_000))).devices[0]!.online).toBe(false); // no sign of life for 5 minutes
    expect(await updateDevice(owner, biz, deviceId, { name: "Counter terminal" })).toMatchObject({ name: "Counter terminal" });
    await expect(updateDevice(stranger, biz, deviceId, { name: "x" })).rejects.toMatchObject({ status: 404 });
    await expect(updateDevice(owner, biz, deviceId, { locationId: "nope" })).rejects.toMatchObject({ status: 404 });
  });
  it("a terminal that belongs to another restaurant cannot be paired until it is disconnected there", async () => {
    const other = await user("dv-owner2"), biz2 = (await createBusiness(other, { name: "Other Grill", locationName: "Main" }, "t")).id, p = await startPairing(other, biz2, {});
    await expect(pairDevice({ code: p.code, serial: "SERIAL-PAIR-0001" }, "10.0.0.3")).rejects.toMatchObject({ code: "DEVICE_IN_USE", status: 409 });
    await cancelPairing(other, biz2, p.sessionId);
  });
  it("tickets: a dashboard pass works for a minute, is bound to its restaurant, and cannot be forged", async () => {
    const t = (await realtimeTicket(owner, biz)).ticket; expect(verifyTicket(t)).toMatchObject({ businessId: biz, userId: owner });
    expect(verifyTicket(t, Date.now() + 61_000)).toBeNull(); expect(verifyTicket(t.slice(0, -2) + "xx")).toBeNull(); expect(verifyTicket("garbage")).toBeNull();
    await expect(realtimeTicket(stranger, biz)).rejects.toMatchObject({ status: 404 });
    expect(verifyTicket(signTicket(biz, owner, Date.now() - 120_000))).toBeNull();
  });
  it("live: the terminal connects with its key, receives events, a dashboard sees it come online, and a missed event is replayed", async () => {
    await expect(open(`ws://127.0.0.1:${rt.port}/ws/device`, { authorization: "Bearer lumd_wrong" })).rejects.toThrow("HTTP 401");
    await expect(open(`ws://127.0.0.1:${rt.port}/ws/dashboard?ticket=bad`)).rejects.toThrow("HTTP 401");
    const dash = await open(`ws://127.0.0.1:${rt.port}/ws/dashboard?ticket=${encodeURIComponent((await realtimeTicket(owner, biz)).ticket)}`);
    await until(() => dash.msgs.some(m => m.type === "hello"));
    const missedAt = Date.now() - 1; await new Promise(r => setTimeout(r, 15));
    await publish(deviceChannel(deviceId), "print.test", { n: 1 }); // sent while the terminal was offline
    const dev = await open(`ws://127.0.0.1:${rt.port}/ws/device?since=${missedAt}`, { authorization: `Bearer ${key}` });
    await until(() => dev.msgs.some(m => m.type === "hello" && m.deviceId === deviceId && m.business.name === "Pair Grill"));
    await until(() => dev.msgs.some(m => m.type === "event" && m.event === "print.test" && m.payload.n === 1)); // replayed
    await until(() => dash.msgs.some(m => m.type === "event" && m.event === "device.status" && m.payload.online === true));
    await publish(deviceChannel(deviceId), "print.test", { n: 2 });
    await until(() => dev.msgs.some(m => m.event === "print.test" && m.payload.n === 2)); // live
    dev.ws.send(JSON.stringify({ type: "ping" })); await until(() => dev.msgs.some(m => m.type === "pong"));
    expect(await testPrint(owner, biz, deviceId)).toEqual({ sent: true });
    await until(() => dev.msgs.filter(m => m.event === "print.test").length >= 3);
    dev.ws.send(JSON.stringify({ type: "print.result", ok: false, reason: "PAPER_OUT" }));
    await until(() => dash.msgs.some(m => m.event === "print.result" && m.payload.reason === "PAPER_OUT"));
    // disconnecting from the dashboard revokes the key and closes the terminal's connection
    const closed = new Promise<number>(res => dev.ws.on("close", c => res(c)));
    await disconnectDevice(owner, biz, deviceId);
    expect(await closed).toBe(4403);
    await until(() => dash.msgs.some(m => m.event === "device.removed"));
    await expect(open(`ws://127.0.0.1:${rt.port}/ws/device`, { authorization: `Bearer ${key}` })).rejects.toThrow("HTTP 401");
    expect((await listDevices(owner, biz)).devices).toHaveLength(0); dash.ws.close();
  });
  it("the terminal hears about renames and branch edits, and leaving from the terminal removes it from the dashboard", async () => {
    const p = await startPairing(owner, biz, {}), d = await pairDevice({ code: p.code, serial: "SERIAL-PAIR-0002" }, "10.0.0.4");
    const events = async (type: string) => db.deviceEvent.findMany({ where: { channel: deviceChannel(d.deviceId), type }, orderBy: { createdAt: "asc" } });
    await updateDevice(owner, biz, d.deviceId, { name: "Bar terminal" });
    expect((await events("device.updated")).at(-1)?.payload).toMatchObject({ name: "Bar terminal", branch: "Main" });
    await db.location.update({ where: { id: d.branch.id }, data: { name: "Main Street" } });
    await announceBranch(biz, d.branch.id);
    expect((await events("device.updated")).at(-1)?.payload).toMatchObject({ branch: "Main Street", locationId: d.branch.id });
    await unpairDevice({ id: d.deviceId, businessId: biz });
    expect((await listDevices(owner, biz)).devices).toHaveLength(0);
    expect((await events("device.revoked")).length).toBe(1);
    expect((await db.deviceEvent.findMany({ where: { channel: businessChannel(biz), type: "device.removed" } })).some(e => (e.payload as { deviceId?: string }).deviceId === d.deviceId)).toBe(true);
  });
});
