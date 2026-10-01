import { AppError } from "@/server/errors";
import { lumiaApi } from "@/server/lumia-api";

async function sendDirectMetaCode(phoneNumber: string, code: string, language: "en" | "ar") {
  if (process.env.NODE_ENV === "production") return null;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v25.0";
  const templateName = language === "ar" ? process.env.META_AUTH_TEMPLATE_NAME_AR : process.env.META_AUTH_TEMPLATE_NAME;
  const templateLanguage = language === "ar" ? process.env.META_AUTH_TEMPLATE_LANGUAGE_AR : process.env.META_AUTH_TEMPLATE_LANGUAGE;
  if (!accessToken || !phoneNumberId || !templateName || !templateLanguage) return null;
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber.replace(/^\+/, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
    });
  } catch {
    throw new AppError("WHATSAPP_SEND_FAILED", "We couldn’t reach WhatsApp. Please try again.", 502);
  }
  if (!response.ok) {
    const json = await response.json().catch(() => null) as { error?: { code?: number } } | null;
    if (json?.error?.code === 190) throw new AppError("META_TOKEN_INVALID", "WhatsApp authentication needs to be renewed.", 503);
    throw new AppError("WHATSAPP_SEND_FAILED", "We couldn’t send your WhatsApp code. Please wait a minute and try again.", 502);
  }
  return { deliveryLanguage: language } as const;
}

// Codes are generated and verified here; lumia-order-api delivers them through the WhatsApp Cloud API.
export async function sendWhatsAppCode(phoneNumber: string, code: string, language: "en" | "ar" = "en") {
  const localApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(process.env.LUMIA_API_URL ?? "http://localhost:4000");
  if (process.env.NODE_ENV !== "production" && localApi) {
    const localDelivery = await sendDirectMetaCode(phoneNumber, code, language);
    if (localDelivery) return localDelivery;
  }
  const result = await lumiaApi<{ deliveryLanguage: "en" | "ar" }>("/internal/whatsapp/verification-code", { to: phoneNumber, code, language }, 15000);
  if (result.ok) return result.data;
  const localDelivery = await sendDirectMetaCode(phoneNumber, code, language);
  if (localDelivery) return localDelivery;
  if (result.code === "WHATSAPP_NOT_CONFIGURED") throw new AppError("WHATSAPP_NOT_CONFIGURED", "WhatsApp verification is not configured yet. Please try again later.", 503);
  throw new AppError("WHATSAPP_SEND_FAILED", "We couldn’t send your WhatsApp code. Please wait a minute and try again.", 502);
}
// SMS fallback: delivered by lumia-order-api once an SMS provider is configured there.
export async function sendSmsCode(phoneNumber: string, code: string, language: "en" | "ar" = "en") {
  const result = await lumiaApi<{ deliveryLanguage: "en" | "ar" }>("/internal/sms/verification-code", { to: phoneNumber, code, language }, 15000);
  if (result.ok) return result.data;
  if (result.code === "SMS_NOT_CONFIGURED") throw new AppError("SMS_NOT_AVAILABLE", "SMS isn’t available yet. Use the WhatsApp code instead.", 503);
  throw new AppError("SMS_SEND_FAILED", "We couldn’t send your SMS code. Please wait a minute and try again.", 502);
}
