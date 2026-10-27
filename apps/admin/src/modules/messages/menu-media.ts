import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { decryptSecret } from "@/server/crypto";
import { lumiaApi } from "@/server/lumia-api";
import { AppError } from "@/server/errors";
import { cardFingerprint, renderMenuCard, type CardInput } from "./menu-card-image";

export async function menuCardMedia(input: CardInput & { businessId: string; account: { phoneNumberId: string | null; accessTokenEncrypted: string | null } }): Promise<{ id: string } | { link: string }> {
  // Real catalog photographs remain current, and Meta fetches them directly.
  if (input.item.imageUrl?.startsWith("https://")) return { link: input.item.imageUrl };
  if (!input.account.phoneNumberId || !input.account.accessTokenEncrypted) throw new AppError("WHATSAPP_NOT_CONNECTED", "Connect WhatsApp first.", 409);
  const id = createHash("sha256").update(JSON.stringify([input.businessId, input.account.phoneNumberId, input.item.itemId, input.locale, cardFingerprint(input)])).digest("hex");
  const cached = await db.whatsAppMenuMedia.findUnique({ where: { id } });
  if (cached && cached.expiresAt > new Date()) return { id: cached.mediaId };
  const png = await renderMenuCard(input);
  const uploaded = await lumiaApi<{ mediaId: string }>("/internal/whatsapp/media", { accessToken: decryptSecret(input.account.accessTokenEncrypted), phoneNumberId: input.account.phoneNumberId, mimeType: "image/png", data: png.toString("base64") }, 40000);
  if (!uploaded.ok) throw new AppError(uploaded.code ?? "MEDIA_UPLOAD_FAILED", "The menu card image could not be prepared.", uploaded.status || 502);
  // A short cache lifetime also bounds stale Meta upload references. Price/name/locale changes get a new content key.
  const expiresAt = new Date(Date.now() + 24 * 3600000);
  await db.whatsAppMenuMedia.upsert({ where: { id }, create: { id, businessId: input.businessId, phoneNumberId: input.account.phoneNumberId, mediaId: uploaded.data.mediaId, expiresAt }, update: { mediaId: uploaded.data.mediaId, expiresAt } });
  return { id: uploaded.data.mediaId };
}
