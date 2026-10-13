import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { businessChannel, deviceChannel, publish } from "./service";

// Orders on the terminal: what a terminal needs to show and print an order is sent with the event (a snapshot), so it never has to ask again.
// Terminals of the order's branch get it on their own channel; open dashboards get the same message on the business channel to refresh live.
export const OPEN_STATUSES = ["AWAITING_BUSINESS_CONFIRMATION", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;

export async function orderSnapshot(orderId: string) {
  const o = await db.order.findUnique({ where: { id: orderId }, include: {
    items: { include: { modifiers: true } }, deliveryDetails: true, customer: { select: { displayName: true, phone: true } },
    location: { select: { name: true, phone: true } }, business: { select: { name: true, taxRegistrationNumber: true } },
  } });
  if (!o) return null;
  const d = o.deliveryDetails;
  return {
    orderId: o.id, number: o.orderNumber, status: o.status, fulfillment: o.fulfillmentType, createdAt: o.createdAt.toISOString(),
    prepMinutes: o.prepMinutes, promisedAt: o.promisedAt?.toISOString() ?? null,
    business: { name: o.business.name, trn: o.business.taxRegistrationNumber ?? null }, branch: { id: o.locationId, name: o.location.name, phone: o.location.phone ?? null },
    customer: { name: d?.recipientName || o.customer.displayName || "", phone: o.customer.phone },
    address: d ? { text: d.addressText ?? "", label: d.addressLabel ?? null, city: d.city ?? null, instructions: d.deliveryInstructions ?? null, map: d.latitude != null && d.longitude != null ? `https://maps.google.com/?q=${d.latitude},${d.longitude}` : null } : null,
    note: o.customerNotes ?? "",
    currency: o.currencyCode, subtotalMinor: o.subtotalMinor, discountMinor: o.discountTotalMinor, discountCode: o.discountCode ?? null, deliveryFeeMinor: o.deliveryFeeMinor, taxMinor: o.taxTotalMinor, totalMinor: o.totalMinor,
    items: o.items.map(i => ({ name: i.itemNameSnapshot, variant: i.variantNameSnapshot ?? null, quantity: i.quantity, unitMinor: i.unitPriceMinor, totalMinor: i.totalMinor, notes: i.notes ?? "", modifiers: i.modifiers.map(m => ({ name: m.nameSnapshot, quantity: m.quantity, totalMinor: m.totalMinor })) })),
  };
}
export type OrderSnapshot = NonNullable<Awaited<ReturnType<typeof orderSnapshot>>>;

// Call after the order's transaction has committed: the realtime service polls, and must never see an order that could still roll back.
export async function emitOrder(orderId: string, type: "order.new" | "order.updated", extra: Record<string, unknown> = {}) {
  try {
    const snap = await orderSnapshot(orderId); if (!snap) return;
    const devices = await db.device.findMany({ where: { locationId: snap.branch.id, status: "ACTIVE" }, select: { id: true } });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { businessId: true } });
    const payload = { ...snap, ...extra };
    await Promise.all([...devices.map(d => publish(deviceChannel(d.id), type, payload)), publish(businessChannel(order.businessId), type, payload)]);
  } catch { console.error(JSON.stringify({ level: "error", code: "ORDER_EVENT_FAILED", type })); } // a failed push must not undo the order
}

// The dashboard's "Print receipt": sent to the terminals of the order's branch; each answers with print.result carrying the jobId.
export async function printOrder(userId: string, businessId: string, orderId: string, now = new Date()) {
  await authorize(userId, businessId, "operations.manage");
  const snap = await db.order.findFirst({ where: { id: orderId, businessId, status: { not: "AWAITING_CUSTOMER_CONFIRMATION" } }, select: { id: true } }).then(o => (o ? orderSnapshot(o.id) : null));
  if (!snap) throw new AppError("NOT_FOUND", "Order not found.", 404);
  const since = new Date(now.getTime() - 90_000);
  const devices = await db.device.findMany({ where: { locationId: snap.branch.id, businessId, status: "ACTIVE", lastSeenAt: { gte: since } }, select: { id: true } });
  if (!devices.length) throw new AppError("DEVICE_OFFLINE", "No terminal is online for this branch. Turn it on and check its internet connection.", 409);
  const jobId = crypto.randomUUID();
  await Promise.all(devices.map(d => publish(deviceChannel(d.id), "print.order", { ...snap, jobId })));
  return { sent: devices.length, jobId };
}

// The terminal's own view of the open orders of its branch, to catch up after being offline longer than the replay window.
export async function openOrdersForDevice(device: { businessId: string; locationId: string }) {
  const rows = await db.order.findMany({ where: { businessId: device.businessId, locationId: device.locationId, status: { in: [...OPEN_STATUSES] } }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true } });
  return (await Promise.all(rows.map(r => orderSnapshot(r.id)))).filter(Boolean);
}
