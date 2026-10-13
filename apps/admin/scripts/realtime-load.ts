// Load check for the realtime service: N simulated terminals connect, receive an order each, ping, and survive a restart.
// Local only (refuses any database that is not on this machine):
//   ulimit -n 10240; DATABASE_URL='mongodb://127.0.0.1:27017/lumia_load?replicaSet=rs0&directConnection=true' node --import tsx scripts/realtime-load.ts 1000
import WebSocket from "ws";
import { db } from "@/server/db";
import { createBusiness } from "@/modules/business/service";
import { hashKey, deviceChannel } from "@/modules/devices/service";
import { startRealtime, type Realtime } from "@/realtime/server";

const N = Number(process.argv[2] ?? 1000), url = process.env.DATABASE_URL ?? "";
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error("Refusing to run: DATABASE_URL must be a local MongoDB."); process.exit(1); }
const ms = (t: number) => `${Math.round(performance.now() - t)} ms`;
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const owner = (await db.user.create({ data: { name: "load", email: `load-${suffix}@test.invalid`, phoneNumber: `+97150${String(Date.now()).slice(-7)}`, phoneNumberVerified: true } })).id;
  const biz = (await createBusiness(owner, { name: "Load Grill", locationName: "Main" }, "t")).id;
  const branch = (await db.location.findFirstOrThrow({ where: { businessId: biz } })).id;
  const keys = Array.from({ length: N }, (_, i) => `lumd_load${suffix}${i}`);
  await db.device.createMany({ data: keys.map((k, i) => ({ businessId: biz, locationId: branch, name: `T${i}`, serialNumber: `LOAD-${suffix}-${i}`, credentialHash: hashKey(k), status: "ACTIVE" })) });
  const rows = await db.device.findMany({ where: { businessId: biz }, select: { id: true, credentialHash: true } });
  const idOf = new Map(rows.map(d => [d.credentialHash, d.id])); const deviceIds = keys.map(k => idOf.get(hashKey(k))!);

  let rt: Realtime = await startRealtime({ port: 0, flushMs: 1000 }); let port = rt.port;
  const sockets: WebSocket[] = [], got = new Map<number, number>(), lat: number[] = []; let sentAt = 0;
  const connect = (i: number) => new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/device`, { headers: { authorization: `Bearer ${keys[i]}` } }); sockets[i] = ws;
    ws.on("message", m => { const e = JSON.parse(String(m)); if (e.type === "hello") resolve(); if (e.event === "order.new") { lat.push(performance.now() - sentAt); got.set(i, (got.get(i) ?? 0) + 1); } });
    ws.on("error", reject);
  });
  const all = async (f: (i: number) => Promise<void>, batch = 100) => { for (let i = 0; i < N; i += batch) await Promise.all(Array.from({ length: Math.min(batch, N - i) }, (_, j) => f(i + j))); };

  let t = performance.now(); await all(connect); console.log(`connect ${N} terminals: ${ms(t)} (server sees ${rt.connections()})`);

  // one order event to every terminal
  t = performance.now(); sentAt = performance.now();
  await db.deviceEvent.createMany({ data: deviceIds.map(id => ({ channel: deviceChannel(id), type: "order.new", payload: { number: "1", items: [] } })) });
  while (got.size < N && performance.now() - t < 20000) await new Promise(r => setTimeout(r, 20));
  console.log(`order.new to ${got.size}/${N}: all delivered after ${ms(t)}; latency from insert p50 ${Math.round(pct(lat, .5))} ms, p99 ${Math.round(pct(lat, .99))} ms`);

  // everyone pings; the heartbeat batch writes them with a few queries
  const before = Date.now(); sockets.forEach(ws => ws.send(JSON.stringify({ type: "ping", appVersion: "load" })));
  await new Promise(r => setTimeout(r, 2500));
  const seen = await db.device.count({ where: { businessId: biz, lastSeenAt: { gte: new Date(before) }, appVersion: "load" } });
  console.log(`heartbeats: ${seen}/${N} recorded in the database`);

  // restart: everyone is told to reconnect, then they all come back at once
  t = performance.now(); const closes = sockets.map(ws => new Promise<number>(r => ws.on("close", c => r(c)))); await rt.close();
  const codes = await Promise.all(closes); console.log(`restart: ${ms(t)}, closed with 1001: ${codes.filter(c => c === 1001).length}/${N}`);
  rt = await startRealtime({ port: 0 }); port = rt.port; got.clear();
  t = performance.now(); await all(connect, 200); console.log(`reconnect storm ${N}: ${ms(t)} (server sees ${rt.connections()})`);

  console.log(`memory: ${Math.round(process.memoryUsage().rss / 1e6)} MB (server and ${N} clients in one process)`);
  sockets.forEach(ws => ws.terminate()); await rt.close();
  await db.deviceEvent.deleteMany({}); await db.device.deleteMany({ where: { businessId: biz } });
  await db.$disconnect(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
