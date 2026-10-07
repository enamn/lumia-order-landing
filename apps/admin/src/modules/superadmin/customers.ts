import { db } from "@/server/db";
import { accessOf, trialInfo } from "@/modules/billing/service";

// Everyone on the platform: every restaurant with its owner and subscription, and every account (including people who signed in but never created a restaurant).
export async function listCustomers(now = new Date()) {
  const [businesses, users] = await Promise.all([
    db.business.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: { id: true, name: true, organizationId: true, countryCode: true, currencyCode: true, email: true, emailVerifiedAt: true, phone: true, createdAt: true } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 1000, select: { id: true, name: true, phoneNumber: true, phoneNumberVerified: true, status: true, createdAt: true, memberships: { where: { status: "ACTIVE" }, select: { organizationId: true, role: true } } } }),
  ]);
  const ids = businesses.map(b => b.id);
  const [subs, orders, customers, wa, owners] = await Promise.all([
    db.subscription.findMany({ where: { businessId: { in: ids } } }),
    db.order.groupBy({ by: ["businessId"], where: { businessId: { in: ids } }, _count: { _all: true } }),
    db.customer.groupBy({ by: ["businessId"], where: { businessId: { in: ids } }, _count: { _all: true } }),
    db.whatsAppAccount.findMany({ where: { businessId: { in: ids }, status: "CONNECTED" }, select: { businessId: true } }),
    db.membership.findMany({ where: { organizationId: { in: businesses.map(b => b.organizationId) }, role: "OWNER", status: "ACTIVE" }, select: { organizationId: true, user: { select: { phoneNumber: true, name: true } } } }),
  ]);
  const subOf = new Map(subs.map(s => [s.businessId, s])), nOrders = new Map(orders.map(o => [o.businessId, o._count._all])), nCust = new Map(customers.map(c => [c.businessId, c._count._all])), connected = new Set(wa.map(w => w.businessId)), ownerOf = new Map(owners.map(o => [o.organizationId, o.user]));
  const restaurants = businesses.map(b => {
    const s = subOf.get(b.id) ?? null, access = accessOf(s, b.createdAt, now.getTime()), trial = trialInfo(b.createdAt, now.getTime());
    const state = s ? (s.status === "ACTIVE" ? (s.cancelAtPeriodEnd ? "ending" : "subscribed") : s.status === "PAST_DUE" ? "past_due" : "ended") : access.active ? "trial" : "trial_ended";
    return { id: b.id, name: b.name, country: b.countryCode, currency: b.currencyCode, createdAt: b.createdAt, ownerPhone: ownerOf.get(b.organizationId)?.phoneNumber ?? b.phone ?? "", ownerName: ownerOf.get(b.organizationId)?.name ?? "", email: b.email ?? "", emailVerified: !!b.emailVerifiedAt,
      state, locked: !access.active, plan: s?.plan ?? "", billing: s?.billing ?? "", periodEnd: s?.currentPeriodEnd ?? null, trialEndsAt: s ? null : trial.endsAt, cardLast4: ((s?.card ?? null) as { last4?: string } | null)?.last4 ?? "", terminals: s?.terminals ?? 0,
      orders: nOrders.get(b.id) ?? 0, customers: nCust.get(b.id) ?? 0, whatsapp: connected.has(b.id) };
  });
  const withRestaurant = new Set(businesses.map(b => b.organizationId));
  const accounts = users.map(u => ({ id: u.id, name: u.name, phone: u.phoneNumber, verified: u.phoneNumberVerified, status: u.status, createdAt: u.createdAt, restaurants: u.memberships.filter(m => withRestaurant.has(m.organizationId)).length }));
  const count = (st: string[]) => restaurants.filter(r => st.includes(r.state)).length;
  return { summary: { restaurants: restaurants.length, trial: count(["trial"]), subscribed: count(["subscribed", "ending"]), pastDue: count(["past_due"]), lockedOrEnded: restaurants.filter(r => r.locked).length, usersWithoutRestaurant: accounts.filter(a => !a.restaurants).length, users: accounts.length }, restaurants, accounts };
}

export async function invoicesOf(businessId: string) {
  const rows = await db.billingInvoice.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, kind: true, status: true, totalMinor: true, currency: true, createdAt: true } });
  return rows;
}
