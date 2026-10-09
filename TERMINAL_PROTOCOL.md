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
* Keep the connection open all day. On any drop, reconnect (start at 1 s, double up to 30 s) with `since=<last event time>`. The server replays what you missed; **de-duplicate by event `id`**.
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
| `device.updated` | `{ name, locationId }` | the restaurant renamed or moved this terminal to another branch |
| `device.revoked` | `{}` | disconnected from the dashboard: forget the key (the socket closes with 4403) |

Coming next on the same connection (not built yet): `order.new` (a customer confirmed an order for this branch), `order.updated`.

### Terminal → server

```
{ "type": "ping", "appVersion": "1.0.1" }
{ "type": "ack", "id": "<event id>" }                       // received (used by orders soon)
{ "type": "print.result", "ok": true }                      // or { "ok": false, "reason": "PAPER_OUT" | "OFFLINE" | "OTHER" }
```

## 3. How the pieces run

* **Web app** (`apps/admin`): pairing and device screens, REST under `/api/v1/businesses/:id/devices…`, the public pairing endpoint, and it writes messages into the `device_events` collection.
* **Realtime service** (`npm run realtime` in `apps/admin`, `src/realtime/server.ts`): holds the WebSockets and sends the `device_events` rows on, so several copies can run together. Needs the same `DATABASE_URL` and `BETTER_AUTH_SECRET` as the web app, and `PORT`. `GET /health` answers `{"ok":true}`.
* The web app needs `REALTIME_URL` (for example `wss://realtime.order.lumia.ae`) so it can hand dashboards and terminals the right address. Locally it defaults to `ws://localhost:3001`.
* Deploying needs the database tables created (`npm run db:setup` in `apps/admin`) and the realtime service deployed as its own Cloud Run service. Neither is done yet.
