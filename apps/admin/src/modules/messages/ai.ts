import { z } from "zod";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize } from "@/server/authorization";
import { lumiaApi } from "@/server/lumia-api";
import { deliverText } from "./reply";

// The AI assistant answers customers' WhatsApp messages from the restaurant's own menu. It only replies when the owner turned it on,
// never keeps talking once a person has taken over, and hands anything it cannot answer (orders, complaints, unknown facts) to staff.
const HUMAN_ACTIVE_MS = 15 * 60 * 1000; const MAX_AI_PER_HOUR = 20;
export const aiSettingsSchema = z.object({ enabled: z.boolean(), instructions: z.string().trim().max(1500).optional(), tone: z.enum(["Friendly", "Professional", "Casual"]).optional() }).strict();

const agentFor = (businessId: string) => db.aiAgent.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } });
const view = (a: { status: string; instructions: string; tone: string } | null) => ({ enabled: a?.status === "ACTIVE", instructions: a?.instructions ?? "", tone: a?.tone ?? "Friendly" });

export async function getAiSettings(userId: string, businessId: string) { await authorize(userId, businessId); return view(await agentFor(businessId)); }

export async function setAiSettings(userId: string, businessId: string, input: unknown, requestId: string) {
  const data = aiSettingsSchema.parse(input);
  return transaction(async tx => {
    const { business } = await authorize(userId, businessId, "business.manage", tx);
    const existing = await tx.aiAgent.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } });
    const fields = { status: data.enabled ? "ACTIVE" : "DRAFT", ...(data.instructions !== undefined ? { instructions: data.instructions } : {}), ...(data.tone ? { tone: data.tone } : {}) };
    const agent = existing ? await tx.aiAgent.update({ where: { id: existing.id }, data: fields }) : await tx.aiAgent.create({ data: { businessId, ...fields } });
    // Instructions can hold business details, so the audit trail records only that the setting changed.
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "AiAgent", entityId: agent.id, action: data.enabled ? "ai.enabled" : "ai.disabled", requestId } });
    return view(agent);
  });
}

async function menuLines(businessId: string) {
  const catalog = await db.catalog.findFirst({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, include: { categories: true, items: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" }, take: 400 } } });
  if (!catalog) return [];
  const names = new Map(catalog.categories.map(c => [c.id, c.name]));
  return catalog.items.map(i => ({ category: (i.categoryId && names.get(i.categoryId)) || "Other", name: i.name, nameAr: i.nameAr ?? "", price: i.basePriceMinor / 100, available: i.isAvailable }));
}

export async function autoReply(t: { businessId: string; conversationId: string; externalMessageId: string }): Promise<"sent" | "skipped"> {
  const agent = await agentFor(t.businessId);
  if (agent?.status !== "ACTIVE") return "skipped";
  const account = await db.whatsAppAccount.findFirst({ where: { businessId: t.businessId, status: "CONNECTED" }, orderBy: { connectedAt: "desc" } });
  if (!account?.phoneNumberId || !account.accessTokenEncrypted) return "skipped";
  const conversation = await db.conversation.findFirst({ where: { id: t.conversationId, businessId: t.businessId }, include: { customer: { select: { phone: true } }, business: { select: { name: true } } } });
  if (!conversation || conversation.needsHuman === true) return "skipped";
  const now = Date.now();
  const recent = await db.message.findMany({ where: { conversationId: t.conversationId }, orderBy: { createdAt: "desc" }, take: 12, select: { externalMessageId: true, direction: true, senderType: true, textContent: true, createdAt: true } });
  // Answer only the newest customer message, and stay quiet while a person is actively replying.
  const latestInbound = recent.find(m => m.direction === "INBOUND");
  if (!latestInbound || latestInbound.externalMessageId !== t.externalMessageId || !latestInbound.textContent) return "skipped";
  if (recent.some(m => m.senderType === "STAFF" && now - m.createdAt.getTime() < HUMAN_ACTIVE_MS)) return "skipped";
  if (recent.filter(m => m.senderType === "AI" && now - m.createdAt.getTime() < 3600000).length >= MAX_AI_PER_HOUR) return "skipped";
  const history = recent.slice().reverse().filter(m => m.textContent && m.externalMessageId !== t.externalMessageId).map(m => ({ from: m.direction === "INBOUND" ? "customer" : "restaurant", text: m.textContent! }));
  const r = await lumiaApi<{ intent: string; language: string; reply: string; needsHuman: boolean }>("/internal/ai/reply", { businessName: conversation.business.name, tone: agent.tone, instructions: agent.instructions, menu: await menuLines(t.businessId), history, message: latestInbound.textContent }, 45000);
  if (!r.ok) { console.error(JSON.stringify({ level: "error", code: "AI_REPLY_REJECTED", status: r.status, apiCode: r.code })); return "skipped"; }
  if (r.data.needsHuman) await db.conversation.update({ where: { id: t.conversationId }, data: { needsHuman: true } });
  if (!r.data.reply) return "skipped";
  const messageId = await deliverText(account, conversation.customer.phone, r.data.reply);
  const at = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId: t.conversationId, externalMessageId: messageId, direction: "OUTBOUND", senderType: "AI", messageType: "TEXT", textContent: r.data.reply, status: "SENT", createdAt: at } }),
    db.conversation.update({ where: { id: t.conversationId }, data: { lastMessageAt: at } }),
  ]);
  return "sent";
}
