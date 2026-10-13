// A message that is only a greeting ("hi", "hello", "مرحبا", "السلام عليكم"...). These get an instant fixed welcome instead of a slow AI answer.
const GREETING = /^(h+i+|he+y+|hell+o+|hola|yo|good\s+(morning|afternoon|evening)|salam|salaam|assalam(u|o)?\s*(alaikum|alaykum|aleikum)?|marhaba|ahlan|hala|السلام\s*عليكم(\s*ورحمة\s*الله(\s*وبركاته)?)?|سلام(\s*عليكم)?|مرحبا|مرحبتين|اهلا(\s*وسهلا)?|هلا|هلو|هاي|صباح\s*الخير|مساء\s*الخير)$/iu;

// Arabic is compared without vowel marks (أهلاً = اهلا) and with one form of alef.
const plainArabic = (s: string) => s.replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا");

export function isGreeting(text: string): boolean {
  const t = plainArabic(text.trim());
  if (!t || t.length > 40) return false;
  return GREETING.test(t.replace(/[\s!.,،؟?~…\p{Extended_Pictographic}️‍]+$/gu, "").replace(/^[\s\p{Extended_Pictographic}️‍]+/gu, ""));
}

export function greetingText(lang: "en" | "ar", restaurant: string, customerName?: string): string {
  const first = (customerName ?? "").trim().split(/\s+/)[0] ?? "";
  return lang === "ar"
    ? `أهلاً${first ? ` ${first}` : ""} 👋 مرحباً بك في ${restaurant}. ماذا تحب أن تطلب اليوم؟`
    : `Hi${first ? ` ${first}` : ""}! 👋 Welcome to ${restaurant}. What would you like to order today?`;
}
