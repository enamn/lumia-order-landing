import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateDevice, businessChannel, deviceChannel, publish, touchDevice, verifyTicket } from "@/modules/devices/service";
import { pollingSource, type EventRow, type EventSource } from "./source";

// The live connections. Terminals connect to /ws/device with their key, open dashboards to /ws/dashboard with a short-lived ticket.
// The web app never talks to the sockets directly: it writes a DeviceEvent (see publish) and this service sends it on, so any number of instances can run side by side.
// Messages are JSON. Server to client: {type:"hello"}, {type:"event", id, event, payload, at}, {type:"pong"}, {type:"error", code}.
// Terminal to server: {type:"ping"} (every 30 s), {type:"ack", id}, {type:"print.result", ok, reason?, jobId?, orderId?}.
//
// Built for thousands of connections per instance, and to grow by swapping parts, not rebuilding (see source.ts and TERMINAL_PROTOCOL.md, "Scale"):
//  - how new events are noticed is an EventSource (polling today, change stream or Redis later); events reach their channel's connections through a Map, never a scan of all sockets;
//  - heartbeats are written to the database in one batch every few seconds, not one write per ping;
//  - online/offline notices are inserted in batches, so a restart that reconnects everyone does not make thousands of single writes;
//  - a terminal has one live connection (a new one replaces the old), a slow or noisy client is cut off, message size and total connections are capped;
//  - nothing but the connections lives in memory, so more instances behind the load balancer is all that scaling out takes.
interface Conn { ws: WebSocket; kind: "device" | "dashboard"; id: string; businessId: string; channel: string; alive: boolean; msgs: number; windowStart: number; orderEvents: Set<string> }
export interface Realtime { server: Server; port: number; close: () => Promise<void>; connections: () => number }
export interface RealtimeOptions { port?: number; pollMs?: number; flushMs?: number; maxConnections?: number; source?: EventSource }

const MAX_REPLAY = 200, KEEP_DAYS = 7, MAX_PAYLOAD = 16 * 1024, MAX_BUFFERED = 1_000_000, RATE_WINDOW_MS = 10_000, RATE_MAX = 120, STATUS_BATCH_MS = 200;
const sendRaw = (ws: WebSocket, text: string) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > MAX_BUFFERED) { ws.terminate(); return; } // a client that is not reading: drop it, it reconnects and replays
  ws.send(text);
};
const send = (ws: WebSocket, msg: unknown) => sendRaw(ws, JSON.stringify(msg));

export async function startRealtime(opts: RealtimeOptions = {}): Promise<Realtime> {
  const flushMs = opts.flushMs ?? 5000, maxConnections = opts.maxConnections ?? Number(process.env.MAX_CONNECTIONS ?? 5000);
  const source = opts.source ?? pollingSource(opts.pollMs ?? Number(process.env.REALTIME_POLL_MS ?? 500));
  const conns = new Set<Conn>(), byChannel = new Map<string, Set<Conn>>(), wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

  const add = (c: Conn) => { conns.add(c); let s = byChannel.get(c.channel); if (!s) byChannel.set(c.channel, s = new Set()); s.add(c); };
  const remove = (c: Conn) => { conns.delete(c); const s = byChannel.get(c.channel); if (s) { s.delete(c); if (!s.size) byChannel.delete(c.channel); } };

  // Online/offline notices for the dashboard, inserted together.
  let statusQueue: Prisma.DeviceEventCreateManyInput[] = [], statusTimer: ReturnType<typeof setTimeout> | null = null;
  async function flushStatus() {
    if (statusTimer) clearTimeout(statusTimer); statusTimer = null; const rows = statusQueue; statusQueue = []; if (!rows.length) return;
    await db.deviceEvent.createMany({ data: rows }).catch(() => undefined);
  }
  const status = (businessId: string, deviceId: string, online: boolean) => {
    statusQueue.push({ channel: businessChannel(businessId), type: "device.status", payload: { deviceId, online } });
    statusTimer ??= setTimeout(() => void flushStatus(), STATUS_BATCH_MS);
  };

  // Heartbeats: remember who pinged, write "last seen" for all of them at once.
  const dirty = new Map<string, string | undefined>();
  async function flushSeen() {
    if (!dirty.size) return; const batch = new Map(dirty); dirty.clear(); const now = new Date();
    const byVersion = new Map<string, string[]>(); for (const [id, v] of batch) { const k = v ? v.slice(0, 30) : ""; byVersion.set(k, [...(byVersion.get(k) ?? []), id]); }
    for (const [version, ids] of byVersion) await db.device.updateMany({ where: { id: { in: ids } }, data: { lastSeenAt: now, ...(version ? { appVersion: version } : {}) } }).catch(() => undefined);
  }

  const eventMessage = (e: EventRow) => JSON.stringify({ type: "event", id: e.id, event: e.type, payload: e.payload, at: e.createdAt.toISOString() });
  // Remembers which order events this connection was sent, so only their acknowledgements are passed on to the dashboard.
  function deliver(c: Conn, e: EventRow, text = eventMessage(e)) {
    if (e.type.startsWith("order.") && c.kind === "device") { c.orderEvents.add(e.id); if (c.orderEvents.size > 200) c.orderEvents.delete(c.orderEvents.values().next().value as string); }
    sendRaw(c.ws, text);
  }
  // New events from the source: each goes to the connections subscribed to its channel.
  source.start(rows => {
    for (const e of rows) {
      const targets = byChannel.get(e.channel); if (!targets) continue;
      const text = eventMessage(e); // built once, sent to each
      for (const c of targets) {
        deliver(c, e, text);
        if (e.type === "device.revoked") setTimeout(() => c.ws.close(4403, "revoked"), 200); // the terminal has been disconnected from the dashboard
      }
    }
  }, () => conns.size > 0);

  const seenTimer = setInterval(() => void flushSeen(), flushMs);
  const cleaner = setInterval(() => { void db.deviceEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } }).catch(() => undefined); }, 3_600_000);
  const pinger = setInterval(() => { for (const c of conns) { if (!c.alive) { c.ws.terminate(); continue; } c.alive = false; try { c.ws.ping(); } catch { /* closing */ } } }, 25_000);

  // A client that was offline asks for what it missed: events of its channel after the time it last saw one.
  async function replay(c: Conn, since: number) {
    if (!Number.isFinite(since) || since <= 0) return;
    const rows = await db.deviceEvent.findMany({ where: { channel: c.channel, createdAt: { gt: new Date(since) } }, orderBy: { createdAt: "asc" }, take: MAX_REPLAY });
    for (const e of rows) deliver(c, e);
  }

  const server = createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, connections: conns.size })); return; }
    res.writeHead(404); res.end();
  });
  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://realtime"), reject = (code: number) => { socket.write(`HTTP/1.1 ${code} ${code === 401 ? "Unauthorized" : code === 503 ? "Service Unavailable" : "Not Found"}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    try {
      if (conns.size >= maxConnections) return reject(503); // this instance is full: the client retries and lands on another
      let conn: Omit<Conn, "ws"> | null = null, hello: Record<string, unknown> = {};
      const base = { alive: true, msgs: 0, windowStart: Date.now(), orderEvents: new Set<string>() };
      if (url.pathname === "/ws/device") {
        const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1] ?? url.searchParams.get("key");
        const d = await authenticateDevice(bearer);
        if (!d) return reject(401);
        const [business, branch] = await Promise.all([db.business.findUnique({ where: { id: d.businessId }, select: { id: true, name: true } }), db.location.findUnique({ where: { id: d.locationId }, select: { id: true, name: true } })]);
        conn = { kind: "device", id: d.id, businessId: d.businessId, channel: deviceChannel(d.id), ...base };
        hello = { deviceId: d.id, name: d.name, business, branch };
      } else if (url.pathname === "/ws/dashboard") {
        const t = verifyTicket(url.searchParams.get("ticket") ?? "");
        if (!t) return reject(401);
        conn = { kind: "dashboard", id: t.userId, businessId: t.businessId, channel: businessChannel(t.businessId), ...base };
      } else return reject(404);
      const since = Number(url.searchParams.get("since") ?? 0), c0 = conn;
      wss.handleUpgrade(req, socket, head, ws => {
        const c: Conn = { ...c0, ws };
        // One live connection per terminal: a new one replaces an older one that may be a dead socket the network never closed.
        if (c.kind === "device") for (const old of byChannel.get(c.channel) ?? []) old.ws.close(4409, "replaced");
        add(c);
        send(ws, { type: "hello", serverTime: new Date().toISOString(), ...hello });
        ws.on("pong", () => { c.alive = true; });
        ws.on("message", raw => {
          const now = Date.now();
          if (now - c.windowStart > RATE_WINDOW_MS) { c.windowStart = now; c.msgs = 0; }
          if (++c.msgs > RATE_MAX) return ws.close(1008, "too many messages");
          let m: { type?: string; appVersion?: string; id?: unknown } = {};
          try { m = JSON.parse(String(raw)); } catch { return send(ws, { type: "error", code: "INVALID_JSON" }); }
          c.alive = true;
          if (m.type === "ping") {
            send(ws, { type: "pong", at: new Date().toISOString() });
            if (c.kind === "device") dirty.set(c.id, m.appVersion ?? dirty.get(c.id)); // written with the next batch
          } else if (m.type === "print.result" && c.kind === "device") void publish(businessChannel(c.businessId), "print.result", { deviceId: c.id, ...(m as object) }).catch(() => undefined);
          // The terminal received an order event: tell the dashboard (other acknowledgements need no work).
          else if (m.type === "ack" && c.kind === "device" && typeof m.id === "string" && c.orderEvents.delete(m.id)) void publish(businessChannel(c.businessId), "order.ack", { deviceId: c.id, eventId: m.id }).catch(() => undefined);
        });
        ws.on("close", () => {
          remove(c);
          if (c.kind === "device" && !(byChannel.get(c.channel)?.size)) status(c.businessId, c.id, false);
        });
        if (c.kind === "device") { void touchDevice(c.id, {}); status(c.businessId, c.id, true); }
        void replay(c, since);
      });
    } catch (err) { console.error(JSON.stringify({ level: "error", code: "REALTIME_UPGRADE_FAILED", message: err instanceof Error ? err.message : String(err) })); reject(401); }
  });

  await new Promise<void>(resolve => server.listen(opts.port ?? 0, resolve));
  const port = (server.address() as { port: number }).port;
  return {
    server, port, connections: () => conns.size,
    // Stopping: tell everyone to reconnect (1001 = going away; terminals back off and replay), write what is pending, then end.
    close: async () => {
      source.stop(); clearInterval(seenTimer); clearInterval(cleaner); clearInterval(pinger);
      for (const c of conns) c.ws.close(1001, "restarting");
      await Promise.all([flushSeen(), flushStatus()]);
      await new Promise(r => setTimeout(r, conns.size ? 300 : 0)); for (const c of conns) c.ws.terminate();
      wss.close(); await new Promise<void>(r => server.close(() => r()));
    },
  };
}
