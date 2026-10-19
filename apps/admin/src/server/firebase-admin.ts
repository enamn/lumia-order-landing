import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { AppError } from "./errors";
// SMS sign-in uses Firebase Phone Authentication. The browser gets the code by SMS and confirms it with Firebase; this checks the signed token Firebase returns.
// Only the project id is needed to check a token (Google's public keys do the rest).
const MAX_AGE_MS = 10 * 60 * 1000;
export function firebaseProjectId() { return (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim(); }
export async function verifiedFirebasePhone(idToken: string): Promise<string> {
  const projectId = firebaseProjectId();
  if (!projectId) throw new AppError("SMS_NOT_AVAILABLE", "SMS isn’t available yet. Use the WhatsApp code instead.", 503);
  if (process.env.NODE_ENV === "production") delete process.env.FIREBASE_AUTH_EMULATOR_HOST; // the emulator accepts unsigned tokens: never in production
  const app = getApps().find(a => a.name === "lumia-phone") ?? initializeApp({ projectId }, "lumia-phone");
  let decoded;
  try { decoded = await getAuth(app).verifyIdToken(idToken); } catch { throw new AppError("INVALID_CODE", "That code isn’t correct. Check the latest message and try again.", 400); }
  const phone = decoded.phone_number;
  if (decoded.firebase?.sign_in_provider !== "phone" || typeof phone !== "string" || decoded.aud !== projectId) throw new AppError("INVALID_CODE", "That code isn’t correct. Check the latest message and try again.", 400);
  if (Date.now() - decoded.auth_time * 1000 > MAX_AGE_MS) throw new AppError("CODE_EXPIRED", "This code has expired. Request a new code.", 400);
  return phone;
}
