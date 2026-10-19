"use client";
// SMS sign-in codes with Firebase Phone Authentication. Firebase sends the SMS (in the page language) and checks the code; the signed token it returns goes to /api/auth/firebase/verify.
// The Firebase web SDK is loaded only when someone asks for an SMS.
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "", authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "", appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};
export const firebaseSmsEnabled = () => !!(cfg.apiKey && cfg.projectId && cfg.appId);
let verifier: RecaptchaVerifier | null = null, holder: HTMLElement | null = null;
export type SmsFailure = "invalid-number" | "too-many" | "not-available" | "failed" | "incorrect" | "expired";
export function smsFailure(err: unknown): SmsFailure {
  const code = String((err as { code?: string })?.code ?? "");
  if (code === "auth/invalid-verification-code" || code === "auth/missing-verification-code") return "incorrect";
  if (code === "auth/code-expired" || code === "auth/session-expired") return "expired";
  if (code === "auth/invalid-phone-number" || code === "auth/missing-phone-number") return "invalid-number";
  if (code === "auth/too-many-requests") return "too-many";
  if (code === "auth/operation-not-allowed" || code === "auth/quota-exceeded" || code === "auth/unauthorized-domain" || code === "auth/configuration-not-found") return "not-available";
  return "failed";
}
export async function sendFirebaseSms(phoneNumber: string, language: "en" | "ar"): Promise<ConfirmationResult> {
  const [{ getApp, getApps, initializeApp }, { connectAuthEmulator, getAuth, RecaptchaVerifier, signInWithPhoneNumber }] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app = getApps().length ? getApp() : initializeApp(cfg);
  const auth = getAuth(app);
  auth.languageCode = language; // the SMS text is in the visitor's language
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR; // local testing only
  if (emulator && !(auth as unknown as { emulatorConfig?: unknown }).emulatorConfig) { connectAuthEmulator(auth, emulator, { disableWarnings: true }); auth.settings.appVerificationDisabledForTesting = true; }
  verifier?.clear(); holder?.remove();
  holder = document.createElement("div"); document.body.appendChild(holder);
  verifier = new RecaptchaVerifier(auth, holder, { size: "invisible" });
  try { return await signInWithPhoneNumber(auth, phoneNumber, verifier); }
  catch (e) { verifier.clear(); verifier = null; throw e; }
}
/** Confirms the 6-digit code and returns the signed token to send to our server. */
export async function confirmFirebaseCode(confirmation: ConfirmationResult, code: string): Promise<string> {
  const cred = await confirmation.confirm(code);
  return cred.user.getIdToken();
}
