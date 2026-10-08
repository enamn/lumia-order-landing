import { db } from "@/server/db";

export const META_REVIEW_FIELDS = [
  "phone_number_name_update",
  "account_review_update",
  "account_update",
  "business_status_update",
  "message_template_status_update",
  "message_template_quality_update",
  "template_category_update",
  "phone_number_quality_update",
] as const;

export async function listMetaEvents() {
  const events = await db.metaWebhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 100 });
  const accounts = await db.whatsAppAccount.findMany({
    select: { phoneNumberId: true, wabaId: true, displayPhoneNumber: true, verifiedName: true, business: { select: { name: true } } },
  });
  return {
    subscribedFields: ["messages", ...META_REVIEW_FIELDS],
    events: events.map(event => ({ ...event, account: accounts.find(account =>
      (event.phoneNumberId && account.phoneNumberId === event.phoneNumberId) ||
      (!event.phoneNumberId && event.wabaId && account.wabaId === event.wabaId)) ?? null })),
  };
}
