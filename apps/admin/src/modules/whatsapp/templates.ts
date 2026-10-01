import { z } from "zod";
import { db } from "@/server/db";
import { authorize } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { decryptSecret } from "@/server/crypto";
import { lumiaApi } from "@/server/lumia-api";

const variableCount = (body: string) => {
  const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(match => Number(match[1]));
  if (!matches.length) return 0;
  const max = Math.max(...matches);
  if (new Set(matches).size !== max || matches.some(value => value < 1 || value > max)) {
    throw new AppError("INVALID_TEMPLATE_VARIABLES", "Template variables must be sequential, starting with {{1}}.", 422);
  }
  return max;
};

export const createTemplateSchema = z.object({
  name: z.string().trim().min(3).max(512).regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores only."),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]).default("UTILITY"),
  language: z.enum(["en_US", "ar"]).default("en_US"),
  body: z.string().trim().min(10).max(1024),
  examples: z.array(z.string().trim().min(1).max(256)).max(20).default([]),
}).strict();

type TemplateResult = { id: string; status: string; category: string };

async function reviewCredentials(businessId: string) {
  const wabaId = process.env.META_REVIEW_WABA_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const reviewBusinessId = process.env.META_REVIEW_BUSINESS_ID;
  if (!wabaId || !accessToken || !reviewBusinessId || businessId !== reviewBusinessId) return null;
  return { wabaId, accessToken, review: true as const };
}

async function credentialsFor(businessId: string) {
  const account = await db.whatsAppAccount.findFirst({ where: { businessId, status: "CONNECTED" }, orderBy: { createdAt: "desc" } });
  if (account?.wabaId && account.accessTokenEncrypted) return { wabaId: account.wabaId, accessToken: decryptSecret(account.accessTokenEncrypted), review: false as const };
  return reviewCredentials(businessId);
}

export async function templateCapability(userId: string, businessId: string) {
  await authorize(userId, businessId, "business.manage");
  const credentials = await credentialsFor(businessId);
  return { enabled: Boolean(credentials), reviewMode: Boolean(credentials?.review) };
}

async function createOnReviewAccount(credentials: { wabaId: string; accessToken: string }, payload: object) {
  const graphVersion = process.env.META_GRAPH_VERSION ?? process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v25.0";
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${graphVersion}/${credentials.wabaId}/message_templates`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AppError("META_UNAVAILABLE", "Meta is temporarily unavailable. Try again.", 502);
  }
  const json = await response.json().catch(() => null) as { id?: string; status?: string; category?: string; error?: { code?: number; error_subcode?: number } } | null;
  if (!response.ok || !json?.id) {
    if (json?.error?.code === 190) {
      throw new AppError("META_TOKEN_INVALID", "The Meta access token has expired or is invalid. Update it before creating a template.", 409);
    }
    const duplicate = json?.error?.code === 2388023;
    throw new AppError(duplicate ? "TEMPLATE_REJECTED" : "META_TEMPLATE_FAILED", duplicate ? "Meta rejected this template. Use a unique name and check the content." : "Meta could not create this template. Try again.", response.status >= 400 && response.status < 500 ? 422 : 502);
  }
  return { id: json.id, status: json.status ?? "PENDING", category: json.category ?? "UTILITY" } satisfies TemplateResult;
}

export async function createMessageTemplate(userId: string, businessId: string, input: unknown, requestId: string) {
  const data = createTemplateSchema.parse(input);
  const { business } = await authorize(userId, businessId, "business.manage");
  const expected = variableCount(data.body);
  if (data.examples.length !== expected) throw new AppError("INVALID_TEMPLATE_EXAMPLES", `Provide ${expected} example value${expected === 1 ? "" : "s"} for this template.`, 422);
  const credentials = await credentialsFor(businessId);
  if (!credentials) throw new AppError("WHATSAPP_NOT_CONFIGURED", "Connect WhatsApp before managing message templates.", 409);
  const payload = {
    name: data.name,
    category: data.category,
    language: data.language,
    components: [{ type: "BODY", text: data.body, ...(expected ? { example: { body_text: [data.examples] } } : {}) }],
  };
  let result: TemplateResult;
  if (credentials.review) result = await createOnReviewAccount(credentials, payload);
  else {
    const response = await lumiaApi<TemplateResult>("/internal/whatsapp/templates", { accessToken: credentials.accessToken, wabaId: credentials.wabaId, template: payload }, 30000);
    if (!response.ok) throw new AppError("META_TEMPLATE_FAILED", "Meta could not create this template. Try again.", response.status >= 400 && response.status < 500 ? 422 : 502);
    result = response.data;
  }
  await db.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "WhatsAppTemplate", entityId: result.id, action: "whatsapp.template.created", requestId, afterData: { name: data.name, category: result.category, language: data.language, status: result.status, reviewMode: credentials.review } } });
  return { ...result, name: data.name, language: data.language, reviewMode: credentials.review };
}
