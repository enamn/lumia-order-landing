import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { whatsappAuth } from "./phone-auth";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "mongodb", transaction: true }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.APP_URL ?? "http://localhost:3000"],
  user: { additionalFields: { phoneNumber: { type: "string", required: true, input: false }, phoneNumberVerified: { type: "boolean", required: true, defaultValue: false, input: false }, status: { type: "string", defaultValue: "ACTIVE", input: false } } },
  plugins: [whatsappAuth()],
  advanced: { database: { generateId: "uuid" }, useSecureCookies: process.env.NODE_ENV === "production", defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60,
    customRules: { "/whatsapp/send-code": { window: 60, max: 5 }, "/whatsapp/verify-code": { window: 60, max: 15 } } },
  logger: { level: "error", log: (level) => { console.error(JSON.stringify({ level, code: "AUTH_ERROR" })); } },
});
