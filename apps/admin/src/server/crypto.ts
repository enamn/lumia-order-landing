import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./errors";
// AES-256-GCM for secrets stored in MongoDB (customers' WhatsApp access tokens). Key: WHATSAPP_TOKEN_ENCRYPTION_KEY, 32 bytes, base64.
function key() {
  const raw = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY; const buf = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (buf.length !== 32) throw new AppError("ENCRYPTION_NOT_CONFIGURED", "Secure storage is not configured yet. Please try again later.", 503);
  return buf;
}
export function encryptSecret(plain: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
export function decryptSecret(stored: string) {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new AppError("ENCRYPTION_FAILED", "Stored connection could not be read. Reconnect WhatsApp.", 500);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch (e) { if (e instanceof AppError) throw e; throw new AppError("ENCRYPTION_FAILED", "Stored connection could not be read. Reconnect WhatsApp.", 500); }
}
