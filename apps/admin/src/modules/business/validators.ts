import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
const phone = z.union([z.literal(""), z.string().regex(/^\+[1-9]\d{6,14}$/, "Use international format, e.g. +971501234567")]);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const hoursSchema = z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), isClosed: z.boolean(), openTime: time, closeTime: time }).strict()).length(7).refine(rows => new Set(rows.map(r => r.dayOfWeek)).size === 7, "Provide each day once");
export const createBusinessSchema = z.object({ name: text(120).min(2), locationName: text(120).min(2), businessType: z.literal("RESTAURANT").default("RESTAURANT"), logoUrl: z.string().max(200000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG or JPG image.").optional() }).strict();
export const locationSchema = z.object({ id: z.string().uuid(), name: text(120).min(2), addressLine1: text(240), city: text(100), emirate: text(100), hours: hoursSchema }).strict();
export const profileSchema = z.object({
  revision: z.number().int().nonnegative(), name: text(120).min(2), nameAr: text(120), phone,
  email: z.union([z.literal(""), z.email()]), vatRegistered: z.boolean(), taxRegistrationNumber: text(30), location: locationSchema,
}).strict().refine(data => !data.vatRegistered || /^\d{15}$/.test(data.taxRegistrationNumber), { path: ["taxRegistrationNumber"], message: "Enter your 15-digit UAE tax registration number" });
export const locationUpdateSchema = z.object({ revision: z.number().int().nonnegative(), location: locationSchema }).strict();
export const memberSchema = z.object({ phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international WhatsApp number."), role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]) }).strict();
export type BusinessProfile = z.infer<typeof profileSchema>;
