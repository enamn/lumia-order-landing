import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";

// Connecting a terminal: the restaurant presses Connect, the dashboard shows a QR code and a 6-digit code, the terminal sends the code and receives a key of its own.
// The code is stored only as a hash and is valid for 10 minutes, once. The key is shown to the terminal once and stored only as a hash.
export const PAIRING_MINUTES = 10, ONLINE_SECONDS = 90, MAX_BAD_CODES = 10;
const secret = () => process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-in-production";
const hashCode = (code: string) => createHmac("sha256", secret()).update(`pairing|${code}`).digest("hex");
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const realtimeUrl = () => (process.env.REALTIME_URL ?? "ws://localhost:3001").replace(/\/$/, "");

// ---- live messages (read by the realtime service, which sends them on) ----
export const deviceChannel = (deviceId: string) => `device:${deviceId}`;
export const businessChannel = (businessId: string) => `business:${businessId}`;
export async function publish(channel: string, type: string, payload: Record<string, unknown> = {}) {
  return db.deviceEvent.create({ data: { channel, type, payload: payload as Prisma.InputJsonValue } });
}

// ---- tickets: a short-lived pass that lets a signed-in dashboard open its live connection (the realtime service has no access to the sign-in cookie) ----
export function signTicket(businessId: string, userId: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ b: businessId, u: userId, exp: now + 60_000 })).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(`ticket|${body}`).digest("base64url")}`;
}
export function verifyTicket(ticket: string, now = Date.now()): { businessId: string; userId: string } | null {
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret()).update(`ticket|${body}`).digest("base64url");
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const t = JSON.parse(Buffer.from(body, "base64url").toString()) as { b: string; u: string; exp: number }; return t.exp > now ? { businessId: t.b, userId: t.u } : null; } catch { return null; }
}
export async function realtimeTicket(userId: string, businessId: string) {
  await authorize(userId, businessId, "read");
  return { ticket: signTicket(businessId, userId), url: `${realtimeUrl()}/ws/dashboard` };
}

// ---- pairing, from the dashboard ----
export async function startPairing(userId: string, businessId: string, input: unknown, now = new Date()) {
  const { locationId } = z.object({ locationId: z.string().max(64).optional() }).strict().parse(input ?? {});
  await authorize(userId, businessId, "business.manage");
  const locations = await db.location.findMany({ where: { businessId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  const branch = locationId ? locations.find(l => l.id === locationId) : locations[0];
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found.", 404);
  await db.pairingSession.updateMany({ where: { businessId, status: "OPEN" }, data: { status: "CANCELED" } }); // one open code at a time
  let code = "", codeHash = "";
  for (let i = 0; i < 20; i++) {
    code = String(randomInt(0, 1_000_000)).padStart(6, "0"); codeHash = hashCode(code);
    if (!(await db.pairingSession.findFirst({ where: { codeHash, status: "OPEN", expiresAt: { gt: now } }, select: { id: true } }))) break;
  }
  const expiresAt = new Date(now.getTime() + PAIRING_MINUTES * 60_000);
  const s = await db.pairingSession.create({ data: { businessId, locationId: branch.id, createdBy: userId, codeHash, expiresAt } });
  // What the QR code holds: the code and the address of this app. The terminal app turns it into the same request as typing the code.
  return { sessionId: s.id, code, expiresAt, branch, qr: `lumia-pair://v1?c=${code}&h=${encodeURIComponent(appUrl())}` };
}
export async function getPairing(userId: string, businessId: string, sessionId: string, now = new Date()) {
  await authorize(userId, businessId, "read");
  const s = await db.pairingSession.findFirst({ where: { id: sessionId, businessId } });
  if (!s) throw new AppError("NOT_FOUND", "Pairing not found.", 404);
  const expired = s.status === "OPEN" && s.expiresAt <= now;
  return { status: expired ? "EXPIRED" : s.status, deviceId: s.deviceId, expiresAt: s.expiresAt };
}
export async function cancelPairing(userId: string, businessId: string, sessionId: string) {
  await authorize(userId, businessId, "business.manage");
  await db.pairingSession.updateMany({ where: { id: sessionId, businessId, status: "OPEN" }, data: { status: "CANCELED" } });
  return { canceled: true };
}

// ---- pairing, from the terminal (no sign-in: the code is the proof) ----
const pairSchema = z.object({ code: z.string().regex(/^\d{6}$/, "The code has 6 digits."), serial: z.string().trim().min(6).max(80), model: z.string().trim().max(60).optional(), appVersion: z.string().trim().max(30).optional(), name: z.string().trim().max(60).optional() }).strict();
async function tooManyAttempts(ip: string, now: number) {
  const key = `pair:${createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 16)}`, window = 10 * 60_000;
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (row && now - Number(row.lastRequest) < window && row.count >= MAX_BAD_CODES) return true;
  return false;
}
async function countBadAttempt(ip: string, now: number) {
  const key = `pair:${createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 16)}`, window = 10 * 60_000;
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || now - Number(row.lastRequest) >= window) await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, lastRequest: BigInt(now) }, update: { count: 1, lastRequest: BigInt(now) } });
  else await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
}
export async function pairDevice(input: unknown, ip: string, now = new Date()) {
  const b = pairSchema.parse(input);
  if (await tooManyAttempts(ip, now.getTime())) throw new AppError("TOO_MANY_ATTEMPTS", "Too many wrong codes. Wait a few minutes and try again.", 429);
  const session = await db.pairingSession.findFirst({ where: { codeHash: hashCode(b.code), status: "OPEN", expiresAt: { gt: now } } });
  if (!session) { await countBadAttempt(ip, now.getTime()); throw new AppError("INVALID_CODE", "This code is wrong or has expired. Ask the restaurant to show a new one.", 404); }
  const business = await db.business.findUniqueOrThrow({ where: { id: session.businessId }, select: { id: true, name: true } });
  const branch = await db.location.findUniqueOrThrow({ where: { id: session.locationId }, select: { id: true, name: true } });
  const key = `lumd_${randomBytes(32).toString("base64url")}`;
  const existing = await db.device.findUnique({ where: { serialNumber: b.serial } });
  if (existing && existing.status === "ACTIVE" && existing.businessId !== business.id) throw new AppError("DEVICE_IN_USE", "This terminal is connected to another restaurant. It has to be disconnected there first.", 409);
  const count = await db.device.count({ where: { businessId: business.id, status: "ACTIVE" } });
  const data = { businessId: business.id, locationId: branch.id, credentialHash: hashKey(key), status: "ACTIVE", revokedAt: null, model: b.model ?? null, appVersion: b.appVersion ?? null, lastSeenAt: now };
  const device = existing
    ? await db.device.update({ where: { id: existing.id }, data: { ...data, ...(existing.businessId === business.id ? {} : { name: b.name || `Terminal ${count + 1}` }) } })
    : await db.device.create({ data: { ...data, name: b.name || (count ? `Terminal ${count + 1}` : "Kitchen terminal"), serialNumber: b.serial, deviceType: "ORDER_TERMINAL" } });
  await db.pairingSession.update({ where: { id: session.id }, data: { status: "USED", deviceId: device.id } });
  await publish(businessChannel(business.id), "device.paired", { sessionId: session.id, deviceId: device.id, name: device.name });
  return { deviceId: device.id, key, business, branch, realtime: `${realtimeUrl()}/ws/device`, api: appUrl() };
}
// The terminal's own key: who is calling?
export async function authenticateDevice(key: string | null | undefined) {
  if (!key || !key.startsWith("lumd_") || key.length > 100) return null;
  const d = await db.device.findFirst({ where: { credentialHash: hashKey(key), status: "ACTIVE" } });
  return d ?? null;
}
export async function touchDevice(deviceId: string, info: { appVersion?: string } = {}, now = new Date()) {
  await db.device.update({ where: { id: deviceId }, data: { lastSeenAt: now, ...(info.appVersion ? { appVersion: info.appVersion.slice(0, 30) } : {}) } }).catch(() => undefined);
}

// ---- the devices of a restaurant, in the dashboard ----
const isOnline = (lastSeenAt: Date | null, now: Date) => !!lastSeenAt && now.getTime() - lastSeenAt.getTime() < ONLINE_SECONDS * 1000;
export async function listDevices(userId: string, businessId: string, now = new Date()) {
  await authorize(userId, businessId, "read");
  const [rows, branches] = await Promise.all([db.device.findMany({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }), db.location.findMany({ where: { businessId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } })]);
  return { branches, devices: rows.map(d => ({ id: d.id, name: d.name, locationId: d.locationId, online: isOnline(d.lastSeenAt, now), serial: d.serialNumber, model: d.model ?? "", appVersion: d.appVersion ?? "", lastSeenAt: d.lastSeenAt, pairedAt: d.createdAt })) };
}
export async function updateDevice(userId: string, businessId: string, deviceId: string, input: unknown) {
  const b = z.object({ name: z.string().trim().min(1).max(60).optional(), locationId: z.string().max(64).optional() }).strict().parse(input);
  await authorize(userId, businessId, "business.manage");
  const d = await db.device.findFirst({ where: { id: deviceId, businessId, status: "ACTIVE" } });
  if (!d) throw new AppError("NOT_FOUND", "Device not found.", 404);
  if (b.locationId && !(await db.location.findFirst({ where: { id: b.locationId, businessId }, select: { id: true } }))) throw new AppError("NOT_FOUND", "Branch not found.", 404);
  const u = await db.device.update({ where: { id: d.id }, data: { ...(b.name ? { name: b.name } : {}), ...(b.locationId ? { locationId: b.locationId } : {}) } });
  if (b.locationId && b.locationId !== d.locationId) await publish(deviceChannel(d.id), "device.updated", { name: u.name, locationId: u.locationId });
  return { id: u.id, name: u.name, locationId: u.locationId };
}
export async function disconnectDevice(userId: string, businessId: string, deviceId: string, now = new Date()) {
  await authorize(userId, businessId, "business.manage");
  const d = await db.device.findFirst({ where: { id: deviceId, businessId, status: "ACTIVE" } });
  if (!d) throw new AppError("NOT_FOUND", "Device not found.", 404);
  await db.device.update({ where: { id: d.id }, data: { status: "REVOKED", credentialHash: null, revokedAt: now } });
  await publish(deviceChannel(d.id), "device.revoked", {}); // the terminal returns to its connect screen
  await publish(businessChannel(businessId), "device.removed", { deviceId: d.id });
  return { disconnected: true };
}
export async function testPrint(userId: string, businessId: string, deviceId: string, now = new Date()) {
  await authorize(userId, businessId, "operations.manage");
  const d = await db.device.findFirst({ where: { id: deviceId, businessId, status: "ACTIVE" } });
  if (!d) throw new AppError("NOT_FOUND", "Device not found.", 404);
  if (!isOnline(d.lastSeenAt, now)) throw new AppError("DEVICE_OFFLINE", "This terminal is offline. Turn it on and check its internet connection.", 409);
  await publish(deviceChannel(d.id), "print.test", { at: now.toISOString() });
  return { sent: true };
}
