import { db } from "../src/server/db";
export async function ensureMongoIndexes() {
  // Prisma's nullable @unique would allow only one null; use string-only indexes.
  for (const [collection, field] of [["messages", "externalMessageId"], ["payments", "providerPaymentId"], ["whatsapp_accounts", "phoneNumberId"]]) {
    await db.$runCommandRaw({ createIndexes: collection, indexes: [{ key: { [field]: 1 }, name: `${field}_unique_when_present`, unique: true, partialFilterExpression: { [field]: { $type: "string" } } }] });
  }
  // One subscription per restaurant, unique invoice numbers, and one invoice per renewal period (so a repeated job run cannot bill twice).
  await db.$runCommandRaw({ createIndexes: "subscriptions", indexes: [{ key: { businessId: 1 }, name: "subscription_per_business", unique: true }] });
  await db.$runCommandRaw({ createIndexes: "billing_invoices", indexes: [{ key: { number: 1 }, name: "invoice_number_unique", unique: true }, { key: { subscriptionId: 1, kind: 1, periodStart: 1 }, name: "invoice_per_period", unique: true, partialFilterExpression: { kind: "RENEWAL" } }] });
  await db.$runCommandRaw({ createIndexes: "phone_challenges", indexes: [{ key: { cleanupAt: 1 }, name: "phone_challenge_cleanup", expireAfterSeconds: 0 }] });
}
if (process.argv[1]?.endsWith("mongo-indexes.ts")) ensureMongoIndexes().then(() => console.log("MongoDB indexes ready.")).catch(() => { console.error("Index setup failed. Check MongoDB connectivity and index permissions."); process.exitCode = 1; }).finally(() => db.$disconnect());
