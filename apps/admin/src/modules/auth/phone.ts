import { z } from "zod";
import { isSupportedMobile } from "./countries";
// The transport and identity store accept only normalized international numbers.
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid international mobile number.");
const supportedMobile = z.string().refine(isSupportedMobile, "Enter a valid mobile number.");
export const sendCodeSchema = z.object({ phoneNumber: supportedMobile, language: z.enum(["en", "ar"]).default("en"), channel: z.enum(["whatsapp", "sms"]).default("whatsapp") }).strict();
export const verifyCodeSchema = z.object({ phoneNumber: supportedMobile, code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") }).strict();
export const OTP_SECONDS = 300;
export const RESEND_SECONDS = 60;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS_PER_HOUR = 5;
// Local testing only: skips the WhatsApp message and accepts a fixed code. Never active in production builds.
export const TEST_CODE = "111111";
export const authTestMode = () => process.env.AUTH_TEST_MODE === "true" && process.env.NODE_ENV !== "production";
// Separate switch for the WhatsApp linking simulation, so login can be in test mode while linking talks to the real Meta.
export const linkTestMode = () => process.env.WHATSAPP_LINK_TEST_MODE === "true" && process.env.NODE_ENV !== "production";
// Development only: link to a WhatsApp account you own with the API server token (see lumia-order-api WHATSAPP_DEV_LINK). Never in production.
export const devLinkMode = () => process.env.WHATSAPP_DEV_LINK === "true" && process.env.NODE_ENV !== "production";
