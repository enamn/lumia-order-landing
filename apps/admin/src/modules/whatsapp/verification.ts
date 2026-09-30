import { AppError } from "@/server/errors";
import { lumiaApi } from "@/server/lumia-api";
// Codes are generated and verified here; lumia-order-api delivers them through the WhatsApp Cloud API.
export async function sendWhatsAppCode(phoneNumber: string, code: string, language: "en" | "ar" = "en") {
  const result = await lumiaApi<{ deliveryLanguage: "en" | "ar" }>("/internal/whatsapp/verification-code", { to: phoneNumber, code, language }, 15000);
  if (result.ok) return result.data;
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
