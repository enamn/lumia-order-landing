import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "@/server/db";
import { authenticateDevice, businessChannel, deviceChannel, publish, touchDevice, verifyTicket } from "@/modules/devices/service";

// The live connections. Terminals connect to /ws/device with their key, open dashboards to /ws/dashboard with a short-lived ticket.
// The web app never talks to the sockets directly: it writes a DeviceEvent (see publish) and this service sends it on, so any number of instances can run side by side.
// Messages are JSON. Server to client: {type:"hello"}, {type:"event", id, event, payload, at}, {type:"pong"}, {type:"error", code}.
// Terminal to server: {type:"ping"} (every 30 s), {type:"ack", id}, {type:"print.result", ok, reason?}.
interface Conn { ws: WebSocket; kind: "device" | "dashboard"; id: string; businessId: string; channel: string; alive: boolean; lastTouch: number }
export interface Realtime { server: Server; port: number; close: () => Promise<void>; connections: () => number }

const send = (ws: WebSocket, msg: unknown) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
const MAX_REPLAY = 200, KEEP_DAYS = 7;

export async function startRealtime(opts: { port?: number; pollMs?: number } = {}): Promise<Realtime> {
  const pollMs = opts.pollMs ?? 500, conns = new Set<Conn>(), wss = new WebSocketServer({ noServer: true });
  let cursor = new Date(), seen = new Set<string>(), polling = false, closed = false;

  const eventMessage = (e: { id: string; type: string; payload: unknown; createdAt: Date }) => ({ type: "event", id: e.id, event: e.type, payload: e.payload, at: e.createdAt.toISOString() });
  const status = (businessId: string, deviceId: string, online: boolean) => publish(businessChannel(businessId), "device.status", { deviceId, online }).catch(() => undefined);

  // Delivers every new event to the connections subscribed to its channel.
  async function poll() {
    if (polling || closed) return; polling = true;
    try {
      const rows = await db.deviceEvent.findMany({ where: { createdAt: { gte: cursor } }, orderBy: { createdAt: "asc" }, take: 500 });
      for (const e of rows) {
        if (seen.has(e.id)) continue;
        seen.add(e.id); if (e.createdAt > cursor) cursor = e.createdAt;
        for (const c of conns) if (c.channel === e.channel) {
          send(c.ws, eventMessage(e));
          if (e.type === "device.revoked") setTimeout(() => c.ws.close(4403, "revoked"), 200); // the terminal has been disconnected from the dashboard
        }
      }
      if (seen.size > 5000) seen = new Set(rows.map(r => r.id));
    } catch (err) { console.error(JSON.stringify({ level: "error", code: "REALTIME_POLL_FAILED", message: err instanceof Error ? err.message : String(err) })); }
    polling = false;
  }
  const timer = setInterval(poll, pollMs);
  const cleaner = setInterval(() => { void db.deviceEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } }).catch(() => undefined); }, 3_600_000);
  const pinger = setInterval(() => { for (const c of conns) { if (!c.alive) { c.ws.terminate(); continue; } c.alive = false; try { c.ws.ping(); } catch { /* closing */ } } }, 25_000);

  // A client that was offline asks for what it missed: events of its channel after the time it last saw one.
  async function replay(c: Conn, since: number) {
    if (!Number.isFinite(since) || since <= 0) return;
    const rows = await db.deviceEvent.findMany({ where: { channel: c.channel, createdAt: { gt: new Date(since) } }, orderBy: { createdAt: "asc" }, take: MAX_REPLAY });
    for (const e of rows) send(c.ws, eventMessage(e));
  }

  const server = createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); return; }
    res.writeHead(404); res.end();
  });
  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://realtime"), reject = (code: number) => { socket.write(`HTTP/1.1 ${code} ${code === 401 ? "Unauthorized" : "Not Found"}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    try {
      let conn: Omit<Conn, "ws"> | null = null, hello: Record<string, unknown> = {};
      if (url.pathname === "/ws/device") {
        const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1] ?? url.searchParams.get("key");
        const d = await authenticateDevice(bearer);
        if (!d) return reject(401);
        const [business, branch] = await Promise.all([db.business.findUnique({ where: { id: d.businessId }, select: { id: true, name: true } }), db.location.findUnique({ where: { id: d.locationId }, select: { id: true, name: true } })]);
        conn = { kind: "device", id: d.id, businessId: d.businessId, channel: deviceChannel(d.id), alive: true, lastTouch: Date.now() };
        hello = { deviceId: d.id, name: d.name, business, branch };
      } else if (url.pathname === "/ws/dashboard") {
        const t = verifyTicket(url.searchParams.get("ticket") ?? "");
        if (!t) return reject(401);
        conn = { kind: "dashboard", id: t.userId, businessId: t.businessId, channel: businessChannel(t.businessId), alive: true, lastTouch: Date.now() };
      } else return reject(404);
      const since = Number(url.searchParams.get("since") ?? 0), c0 = conn;
      wss.handleUpgrade(req, socket, head, ws => {
        const c: Conn = { ...c0, ws }; conns.add(c);
        send(ws, { type: "hello", serverTime: new Date().toISOString(), ...hello });
        ws.on("pong", () => { c.alive = true; });
        ws.on("message", raw => {
          let m: { type?: string; appVersion?: string } = {};
          try { m = JSON.parse(String(raw)); } catch { return send(ws, { type: "error", code: "INVALID_JSON" }); }
          c.alive = true;
          if (m.type === "ping") {
            send(ws, { type: "pong", at: new Date().toISOString() });
            if (c.kind === "device" && Date.now() - c.lastTouch > 20_000) { c.lastTouch = Date.now(); void touchDevice(c.id, { appVersion: m.appVersion }); }
          } else if (m.type === "print.result" && c.kind === "device") void publish(businessChannel(c.businessId), "print.result", { deviceId: c.id, ...(m as object) }).catch(() => undefined);
          // "ack" needs no work yet: the order feed will use it to tell the dashboard an order reached the terminal.
        });
        ws.on("close", () => {
          conns.delete(c);
          if (c.kind === "device" && ![...conns].some(x => x.kind === "device" && x.id === c.id)) void status(c.businessId, c.id, false);
        });
        if (c.kind === "device") { void touchDevice(c.id, {}); void status(c.businessId, c.id, true); }
        void replay(c, since);
      });
    } catch (err) { console.error(JSON.stringify({ level: "error", code: "REALTIME_UPGRADE_FAILED", message: err instanceof Error ? err.message : String(err) })); reject(401); }
  });

  await new Promise<void>(resolve => server.listen(opts.port ?? 0, resolve));
  const port = (server.address() as { port: number }).port;
  return {
    server, port, connections: () => conns.size,
    close: async () => { closed = true; clearInterval(timer); clearInterval(cleaner); clearInterval(pinger); for (const c of conns) c.ws.terminate(); wss.close(); await new Promise<void>(r => server.close(() => r())); },
  };
}
