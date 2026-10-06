import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { entitlementsFor } from "@/modules/billing/service";

// Customers who ordered from the restaurant on WhatsApp, with what they ordered and the addresses they saved. Plus and Pro only.
const COUNTED = new Set(["AWAITING_BUSINESS_CONFIRMATION", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED"]);
export interface CustomerRow { id: string; name: string; phone: string; orders: number; spentMinor: number; lastOrderAt: string | null; optedOut: boolean; addresses: { label: string; text: string; uses: number; isDefault: boolean }[] }

export async function requireCustomers(businessId: string) {
  if (!(await entitlementsFor(businessId)).customers) throw new AppError("PLAN_REQUIRED", "Customers and campaigns are available on the Plus and Pro plans.", 403);
}
export async function listCustomers(userId: string, businessId: string): Promise<{ customers: CustomerRow[] }> {
  await authorize(userId, businessId);
  await requireCustomers(businessId);
  // A customer is anyone with an order that reached the restaurant (a review the customer never confirmed does not count).
  const orders = await db.order.findMany({ where: { businessId, status: { not: "AWAITING_CUSTOMER_CONFIRMATION" } }, select: { customerId: true, status: true, totalMinor: true, createdAt: true, deliveryDetails: { select: { addressLabel: true } } }, orderBy: { createdAt: "desc" }, take: 20000 });
  const by = new Map<string, { orders: number; spent: number; last: Date; labels: Map<string, number> }>();
  for (const o of orders) {
    const e = by.get(o.customerId) ?? { orders: 0, spent: 0, last: o.createdAt, labels: new Map<string, number>() };
    if (COUNTED.has(o.status)) { e.orders++; e.spent += o.totalMinor; const l = o.deliveryDetails?.addressLabel?.toLowerCase(); if (l) e.labels.set(l, (e.labels.get(l) ?? 0) + 1); }
    if (o.createdAt > e.last) e.last = o.createdAt;
    by.set(o.customerId, e);
  }
  const ids = [...by.keys()];
  const [customers, addresses] = await Promise.all([db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, phone: true, marketingOptOut: true } }), db.customerAddress.findMany({ where: { customerId: { in: ids } }, orderBy: { isDefault: "desc" } })]);
  const rows: CustomerRow[] = customers.map(c => {
    const e = by.get(c.id)!;
    return { id: c.id, name: c.displayName?.trim() || c.phone, phone: c.phone, orders: e.orders, spentMinor: e.spent, lastOrderAt: e.last.toISOString(), optedOut: c.marketingOptOut === true, addresses: addresses.filter(a => a.customerId === c.id).map(a => ({ label: a.label, text: [a.addressText, a.emirate && !a.addressText.includes(a.emirate) ? a.emirate : ""].filter(Boolean).join(", "), uses: e.labels.get(a.label.toLowerCase()) ?? 0, isDefault: a.isDefault })) };
  });
  return { customers: rows.sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? "")) };
}

// Who a campaign can reach: everyone with an order that reached the restaurant, in one light query (the Customers page needs the totals, a campaign does not).
export async function campaignAudience(businessId: string): Promise<{ id: string; name: string; phone: string; optedOut: boolean }[]> {
  const rows = await db.customer.findMany({ where: { businessId, orders: { some: { status: { not: "AWAITING_CUSTOMER_CONFIRMATION" } } } }, select: { id: true, displayName: true, phone: true, marketingOptOut: true }, take: 5000 });
  return rows.map(c => ({ id: c.id, name: c.displayName?.trim() || c.phone, phone: c.phone, optedOut: c.marketingOptOut === true }));
}
