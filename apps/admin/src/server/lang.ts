import { cookies } from "next/headers";
// The language of this browser: what the visitor chose (saved in a cookie so the server can render the right language from the first byte),
// otherwise Arabic. Nothing is guessed from the browser's own language.
export type Lang = "en" | "ar";
export async function savedLang(): Promise<Lang | null> { const v = (await cookies()).get("lumia_lang")?.value; return v === "en" || v === "ar" ? v : null; }
export async function pageLang(profile?: string | null): Promise<Lang> { return (await savedLang()) ?? (profile === "en" || profile === "ar" ? profile : "ar"); }
