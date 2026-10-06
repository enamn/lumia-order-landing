import { db } from "./db";

// Super admins are the verified phone numbers listed in SUPER_ADMIN_PHONES (comma-separated, international format). They sign in like everyone else
// (phone number and the WhatsApp code), so nothing about the role is stored in the database or can be granted from inside the app.
export const superAdminPhones = (env = process.env.SUPER_ADMIN_PHONES) => new Set((env ?? "").split(",").map(p => p.trim().replace(/[\s-]/g, "")).filter(p => /^\+[1-9]\d{7,14}$/.test(p)));
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const phones = superAdminPhones(); if (!phones.size) return false;
  const u = await db.user.findFirst({ where: { id: userId, status: "ACTIVE", phoneNumberVerified: true }, select: { phoneNumber: true } });
  return !!u && phones.has(u.phoneNumber);
}
