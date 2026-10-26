# Lumia Order terminal: how it connects

For the Android app. The terminal pairs once with a restaurant, then keeps one WebSocket open to receive messages.

## 1. Pairing (once)

The restaurant opens Settings → Devices → **Connect device**. The dashboard shows a QR code and a 6-digit code ("482 913"), valid for **10 minutes**, usable **once**.

The QR code holds a link: `lumia-pair://v1?c=<6 digits>&h=<app address, URL-encoded>`
(example: `lumia-pair://v1?c=482913&h=https%3A%2F%2Fapp.order.lumia.ae`). Typing the 6 digits does the same.

The terminal then calls (no sign-in):

```
POST {app address}/api/public/devices/pair
Content-Type: application/json
{ "code": "482913", "serial": "<unique device serial, 6-80 chars>", "model": "Lumia T1", "appVersion": "1.0.0", "name": "optional" }
```

Success `200`:

```
{ "data": { "deviceId": "...", "key": "lumd_...", "business": { "id", "name" }, "branch": { "id", "name" },
            "realtime": "wss://<realtime host>/ws/device", "api": "https://app.order.lumia.ae" } }
```

* **`key` is shown once.** Store it in the Android Keystore / encrypted storage. The server keeps only a hash.
* Errors: `404 INVALID_CODE` (wrong, used or expired), `409 DEVICE_IN_USE` (this serial is connected to another restaurant), `429 TOO_MANY_ATTEMPTS` (10 wrong codes from one address in 10 minutes), `422 VALIDATION_ERROR`.
* Pairing the same serial again with a new code re-issues the key.

## 2. The live connection

```
GET {realtime}?since=<ms since epoch of the last event you saw>      (WebSocket upgrade)
Authorization: Bearer lumd_...
```

* Wrong or revoked key: HTTP `401` on the upgrade. Close code `4403` means the restaurant disconnected this terminal: **forget the key and show the connect screen.**
* Keep the connection open all day. On any drop, reconnect (start at 1 s, double up to 30 s, **plus a random 0-1 s so thousands of terminals do not return at the same instant**) with `since=<last event time>`. The server replays what you missed; **de-duplicate by event `id`**.
* Send `{"type":"ping"}` every **30 s**. The dashboard shows "Online" while it hears from you within 90 s. The server answers `{"type":"pong"}`.

### Server → terminal

```
{ "type": "hello", "serverTime": "ISO", "deviceId", "name", "business": {id,name}, "branch": {id,name} }
{ "type": "event", "id": "uuid", "event": "<name>", "payload": { ... }, "at": "ISO" }
{ "type": "pong", "at": "ISO" }
{ "type": "error", "code": "INVALID_JSON" }
```

Events sent today:

| event | payload | what to do |
|---|---|---|
| `print.test` | `{ at }` | print a short test receipt, then send `print.result` |
| `device.updated` | `{ name, locationId, branch }` | the restaurant renamed this terminal, moved it to another branch, or edited its branch (`branch` is the branch name): show the new name and reload the open orders |
| `device.revoked` | `{}` | disconnected from the dashboard: forget the key (the socket closes with 4403) |

| `order.new` | order snapshot (below) | a customer confirmed an order for this branch: **sound the alarm**, show Accept / Reject, `ack` it |
| `order.updated` | order snapshot + `by` (`{type:"DEVICE",deviceId}` or `{type:"USER"}`) | the order changed (here or in the dashboard): update the card, stop the alarm if it was decided elsewhere |
| `print.order` | order snapshot + `jobId` | print the receipt (dashboard "Print receipt"), then send `print.result` with the same `jobId` |

**Order snapshot** (everything needed to show and print, no extra call): `orderId, number, status, fulfillment (DELIVERY|PICKUP|DINE_IN), createdAt, prepMinutes, promisedAt, business {name, trn}, branch {id, name, phone}, customer {name, phone}, address {text, label, city, instructions, map} | null, note, currency, subtotalMinor, discountMinor, discountCode, deliveryFeeMinor, taxMinor, totalMinor, items [{name, variant, quantity, unitMinor, totalMinor, notes, modifiers[]}]`. Money is in minor units (fils).

Statuses: `AWAITING_BUSINESS_CONFIRMATION` (new) → `ACCEPTED` → `PREPARING` → `READY` → `OUT_FOR_DELIVERY` (delivery only) → `COMPLETED`; or `REJECTED` / `CANCELLED`.

### Terminal → server

```
{ "type": "ping", "appVersion": "1.0.1" }
{ "type": "ack", "id": "<event id>" }                       // received (used by orders soon)
{ "type": "print.result", "ok": true, "jobId": "...", "orderId": "..." }   // or { "ok": false, "reason": "PAPER_OUT" | "OFFLINE" | "OTHER" }; jobId/orderId echo the print.order they answer
```

`ack` of an event is passed to the dashboard as `order.ack` (the order reached the terminal).

## 2b. Orders over REST (Bearer `lumd_...`, no cookie)

```
GET  {api}/api/device/orders                      → data: [order snapshot, ...]   open orders of this terminal's branch (catch up after a long offline time)
POST {api}/api/device/orders/:orderId/status      { "status": "ACCEPTED", "prepMinutes": 25 }
                                                  { "status": "REJECTED", "reason": "Sold out" }
                                                  { "status": "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "COMPLETED" | "CANCELLED" }
```

`prepMinutes` (5-180) is the time the customer is told (and is saved as `promisedAt`). Same rules as the dashboard: the first to decide wins; a late change gets `409 INVALID_TRANSITION`: refresh the card from the next `order.updated`. A terminal only handles orders of its own branch (`404` otherwise). `401` = key revoked: forget it.

Close codes: `4403` revoked (forget the key); `4409` another connection of this terminal replaced this one (a terminal keeps one live connection: reconnect after 5+ s, and never run two apps with one key); `1001` the service is restarting (reconnect with backoff, replay fills the gap); `1008` too many messages (max 120 per 10 s, messages max 16 KB). HTTP `503` on the upgrade: this instance is full, retry.

### Leaving from the terminal

`POST {api}/api/device/unpair` with `Authorization: Bearer lumd_...` (empty body). The key stops working and the terminal disappears from the dashboard list at once. Then forget the key locally. If the terminal is offline it can still forget locally; the restaurant then removes it from the dashboard.

## 3. How the pieces run

* **Web app** (`apps/admin`): pairing and device screens, REST under `/api/v1/businesses/:id/devices…`, the public pairing endpoint, and it writes messages into the `device_events` collection.
* **Realtime service** (`npm run realtime` in `apps/admin`, `src/realtime/server.ts`): holds the WebSockets and sends the `device_events` rows on, so several copies can run together. Needs the same `DATABASE_URL` and `BETTER_AUTH_SECRET` as the web app, and `PORT`. `GET /health` answers `{"ok":true}`.
* The web app needs `REALTIME_URL` (for example `wss://realtime.order.lumia.ae`) so it can hand dashboards and terminals the right address. Locally it defaults to `ws://localhost:3001`.
* Deploying needs the database tables created (`npm run db:setup` in `apps/admin`) and the realtime service deployed as its own Cloud Run service. Neither is done yet.

## 4. Scale

Measured with `scripts/realtime-load.ts` (local, server and simulated terminals in one process): 1,000 terminals connect in ~1 s and all get an order event within ~0.5 s; 5,000: ~6 s to connect, ~1 s to deliver; a restart with everyone reconnecting at once finishes in ~6 s for 5,000. Memory ~0.4 MB per 1,000 terminals plus the Node baseline.

What makes that hold, and how it grows without a rebuild:
* **Events are rows in `device_events`** (the durable log; replay on reconnect reads it). A small `EventSource` (`src/realtime/source.ts`) only tells the socket server which rows are new. Today it polls (one indexed query every 0.5 s per instance, none while nobody is connected, reads 2 s back to catch slow writes, widens its page for big bursts).
* **Next step (thousands to tens of thousands): a change-stream source** (MongoDB pushes inserts; the replica set is already required): add one class implementing `EventSource`, pass it in `main.ts`. No change to terminals, the web app or the socket server.
* **After that (many instances): a Redis source**: `publish()` also notifies Redis and each instance subscribes only to the channels it holds. Same `EventSource` seam.
* **Instances are stateless** (only their open sockets live in memory): add instances behind the load balancer to add capacity. Each instance caps itself (`MAX_CONNECTIONS`, default 5000) and answers `503` when full.
* Heartbeats (`lastSeenAt`) and online/offline notices are written in batches, so database writes do not grow with the number of terminals pinging.
* Cloud Run: concurrency 1000 or more per instance, request timeout 3600 s (the platform drops sockets after an hour: terminals reconnect and replay, which they already do), `minInstances: 1`, session affinity not needed. On SIGTERM the service tells every client `1001` and flushes what is pending.
