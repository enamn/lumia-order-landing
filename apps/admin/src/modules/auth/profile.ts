import { z } from "zod";
import { db } from "@/server/db";
export const profileLanguageSchema = z.object({ language: z.enum(["en", "ar"]) }).strict();
// Dashboard language (English / Arabic RTL) is stored per user.
export async function setLanguage(userId: string, input: unknown) {
  const { language } = profileLanguageSchema.parse(input);
  await db.user.update({ where: { id: userId }, data: { preferredLanguage: language } });
  return { language };
}
