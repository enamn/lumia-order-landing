import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { deliverText } from "@/modules/messages/reply";
import { langOf, type Lang, type Resolved } from "./draft";

type Tx = Parameters<Parameters<typeof transaction>[0]>[0];

async function nextOrderNumber(tx: Tx, businessId: string): Promise<string> {
  const last = await tx.order.findFirst({ where: { businessId }, orderBy: { createdAt: "desc" }, select: { orderNumber: true } });
  return String((Number.parseInt(last?.orderNumber ?? "", 10) || 1000) + 1);
}

// Creates the order from a confirmed draft. Called by the AI assistant after the customer confirmed the exact summary we showed.
export async function createOrderFromDraft(input: { businessId: string; conversationId: string; customerId: string; customerName: string; customerPhone: string; resolved: Resolved & { fulfillment: "delivery" | "pickup" }; branchId?: string | null }) {
  const { businessId, resolved: r } = input;
  for (let attempt = 0; ; attempt++) {
    try {
      return await transaction(async tx => {
        // The branch that serves this customer (nearest, or the one the delivery rule names); otherwise the first active branch.
        // Pro with a menu per branch: the order goes to the branch whose menu it was taken from.
        const wanted = input.branchId ?? (r.delivery?.status === "ok" ? r.delivery.branchId : null);
        const location = (wanted ? await tx.location.findFirst({ where: { id: wanted, businessId, status: "ACTIVE" } }) : null) ?? await tx.location.findFirst({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
        if (!location) throw new AppError("NO_LOCATION", "This business has no active location.", 409);
        const settings = await tx.orderSettings.findUnique({ where: { businessId } });
        const status: OrderStatus = settings?.requiresOrderAcceptance === false ? "ACCEPTED" : "AWAITING_BUSINESS_CONFIRMATION";
        const orderNumber = await nextOrderNumber(tx, businessId);
        const order = await tx.order.create({ data: {
          businessId, locationId: location.id, customerId: input.customerId, conversationId: input.conversationId, orderNumber, channel: "WHATSAPP",
          fulfillmentType: r.fulfillment === "delivery" ? "DELIVERY" : "PICKUP", status, subtotalMinor: r.subtotalMinor, deliveryFeeMinor: r.feeMinor, totalMinor: r.totalMinor, ...(r.delivery?.status === "ok" && r.delivery.manual ? { internalNotes: "Delivery fee not included: confirm it with the customer." } : {}),
          items: { create: r.lines.map(l => ({ catalogItemId: l.itemId, itemNameSnapshot: l.name || l.nameAr, quantity: l.quantity, unitPriceMinor: l.unitMinor, subtotalMinor: l.totalMinor, taxAmountMinor: 0, totalMinor: l.totalMinor, notes: l.notes || null })) },
          ...(r.fulfillment === "delivery" ? { deliveryDetails: { create: { recipientName: r.name || input.customerName || "Customer", recipientPhone: input.customerPhone, addressText: r.address, city: r.area || location.city, ...(r.emirate ? { emirate: r.emirate } : {}), ...(r.label ? { addressLabel: r.label } : {}), ...(r.pin ? { latitude: r.pin.latitude, longitude: r.pin.longitude } : {}) } } } : {}),
          history: { create: { newStatus: status, changedByType: "AI" } },
        }, select: { id: true, orderNumber: true, status: true, totalMinor: true } });
        await tx.conversation.update({ where: { id: input.conversationId }, data: { draftOrder: null } });
        // Remember the address under the name the customer gave it (Home, Work, ...), so next time it can simply be picked.
        if (r.fulfillment === "delivery" && r.address && r.label) {
          const fields = { addressText: r.address, city: r.area || location.city, emirate: r.emirate ?? null, ...(r.pin ? { latitude: r.pin.latitude, longitude: r.pin.longitude } : {}) };
          const have = (await tx.customerAddress.findMany({ where: { customerId: input.customerId } }));
          const same = have.find(a => a.label.toLowerCase() === r.label.toLowerCase());
          if (same) await tx.customerAddress.update({ where: { id: same.id }, data: fields });
          else if (have.length < 6) await tx.customerAddress.create({ data: { customerId: input.customerId, label: r.label, ...fields, isDefault: have.length === 0 } });
        }
        return order;
      });
    } catch (error) {
      // Two orders at the same moment can pick the same number; the unique index rejects one, so try the next number.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
      throw error;
    }
  }
}

export async function listOrders(userId: string, businessId: string) {
  await authorize(userId, businessId);
  const rows = await db.order.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 60, include: { items: true, history: { select: { newStatus: true, createdAt: true, reason: true }, orderBy: { createdAt: "asc" } }, customer: { select: { displayName: true, phone: true } }, deliveryDetails: { select: { addressText: true, addressLabel: true, recipientName: true, latitude: true, longitude: true } } } });
  return rows.map(o => ({ id: o.id, number: o.orderNumber, status: o.status, fulfillment: o.fulfillmentType, total: o.totalMinor / 100, currency: o.currencyCode, createdAt: o.createdAt, conversationId: o.conversationId, note: o.customerNotes ?? "", subtotal: o.subtotalMinor / 100, deliveryFee: o.deliveryFeeMinor / 100, history: o.history.map(h => ({ status: h.newStatus, at: h.createdAt, reason: h.reason ?? "" })), address: [o.deliveryDetails?.addressLabel ? `${o.deliveryDetails.addressLabel}: ${o.deliveryDetails.addressText}` : o.deliveryDetails?.addressText, o.deliveryDetails?.latitude != null ? `https://maps.google.com/?q=${o.deliveryDetails.latitude},${o.deliveryDetails.longitude}` : ""].filter(Boolean).join("\n"), customer: { name: o.deliveryDetails?.recipientName || o.customer.displayName || "", phone: o.customer.phone }, items: o.items.map(i => ({ name: i.itemNameSnapshot, quantity: i.quantity, notes: i.notes ?? "", total: i.totalMinor / 100 })) }));
}

const NEXT: Record<string, OrderStatus[]> = {
  AWAITING_BUSINESS_CONFIRMATION: ["ACCEPTED", "REJECTED"], ACCEPTED: ["PREPARING", "CANCELLED"], PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "COMPLETED"], OUT_FOR_DELIVERY: ["COMPLETED"],
};
export const statusSchema = z.object({ status: z.enum(["ACCEPTED", "REJECTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"]), reason: z.string().trim().max(300).optional(), prepMinutes: z.number().int().min(5).max(180).optional() }).strict();

const NOTICE: Partial<Record<OrderStatus, Record<Lang, (n: string, pickup: boolean, prep?: number) => string>>> = {
  ACCEPTED: { en: (n, _p, m) => `✅ Your order #${n} was accepted. ${m ? `It will be ready in about ${m} minutes.` : "We're getting it ready."}`, ar: (n, _p, m) => `✅ تم قبول طلبك رقم ${n}. ${m ? `سيكون جاهزاً خلال ${m} دقيقة تقريباً.` : "نقوم بتجهيزه الآن."}` },
  REJECTED: { en: n => `Sorry, we can't prepare order #${n} right now. Please contact us if you'd like to try again.`, ar: n => `عذراً، لا يمكننا تجهيز طلبك رقم ${n} حالياً. تواصل معنا إن أردت المحاولة مجدداً.` },
  CANCELLED: { en: n => `Your order #${n} was cancelled. Sorry for the trouble.`, ar: n => `تم إلغاء طلبك رقم ${n}. نعتذر عن الإزعاج.` },
  READY: { en: (n, p) => (p ? `🛍️ Your order #${n} is ready for pickup.` : `Your order #${n} is ready and will be on its way shortly.`), ar: (n, p) => (p ? `🛍️ طلبك رقم ${n} جاهز للاستلام.` : `طلبك رقم ${n} جاهز وسيكون في الطريق قريباً.`) },
  OUT_FOR_DELIVERY: { en: n => `🛵 Your order #${n} is on its way.`, ar: n => `🛵 طلبك رقم ${n} في الطريق إليك.` },
};

export async function setOrderStatus(userId: string, businessId: string, orderId: string, input: unknown, requestId: string) {
  const { status, reason, prepMinutes } = statusSchema.parse(input);
  const updated = await transaction(async tx => {
    const { business } = await authorize(userId, businessId, "operations.manage", tx);
    const order = await tx.order.findFirst({ where: { id: orderId, businessId }, include: { customer: { select: { phone: true } } } });
    if (!order) throw new AppError("NOT_FOUND", "Order not found.", 404);
    if (!(NEXT[order.status] ?? []).includes(status) || (status === "OUT_FOR_DELIVERY" && order.fulfillmentType !== "DELIVERY")) throw new AppError("INVALID_TRANSITION", "That change isn't possible for this order's current status.", 409);
    const result = await tx.order.update({ where: { id: orderId }, data: { status, history: { create: { previousStatus: order.status, newStatus: status, changedByType: "USER", changedByUserId: userId, reason: reason || null } } } });
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Order", entityId: orderId, action: `order.${status.toLowerCase()}`, requestId } });
    return { order: result, phone: order.customer.phone };
  });
  await notifyCustomer(businessId, updated.order.conversationId, updated.phone, status, updated.order.orderNumber, updated.order.fulfillmentType === "PICKUP", prepMinutes);
  return { id: updated.order.id, status: updated.order.status };
}

// Best effort: WhatsApp only lets us message within 24 hours of the customer's last message, and a failed notice must not undo the status change.
async function notifyCustomer(businessId: string, conversationId: string | null, phone: string, status: OrderStatus, number: string, pickup: boolean, prep?: number) {
  const notice = NOTICE[status]; if (!notice || !conversationId) return;
  try {
    const account = await db.whatsAppAccount.findFirst({ where: { businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
    const lastInbound = await db.message.findFirst({ where: { conversationId, direction: "INBOUND" }, orderBy: { createdAt: "desc" }, select: { textContent: true, createdAt: true } });
    if (!account || !lastInbound || Date.now() - lastInbound.createdAt.getTime() > 24 * 3600 * 1000) return;
    const text = notice[langOf(lastInbound.textContent ?? "")](number, pickup, prep);
    const messageId = await deliverText(account, phone, text); const now = new Date();
    await db.$transaction([
      db.message.create({ data: { conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "SYSTEM", messageType: "TEXT", textContent: text, status: "SENT", createdAt: now } }),
      db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    ]);
  } catch { console.error(JSON.stringify({ level: "error", code: "ORDER_NOTICE_FAILED" })); }
}
