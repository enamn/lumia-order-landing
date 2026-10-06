import type { CountryCode } from "./countries";

// First-level administrative divisions of each GCC country (what an address form asks for), with the Arabic name and the words and well-known cities people use for them.
// This is region-level only. Cities, districts and streets are typed freely or come from the map lookup: this is not a complete national address database.
export interface Region { en: string; ar: string; words: RegExp }
const r = (en: string, ar: string, words: RegExp): Region => ({ en, ar, words });

export const REGIONS: Record<CountryCode, Region[]> = {
  AE: [
    r("Abu Dhabi", "أبوظبي", /abu\s*dhabi|أبو\s*ظبي|ابو\s*ظبي|ابوظبي|أبوظبي|al\s*ain|العين/i), r("Dubai", "دبي", /dubai|دبي|dxb/i), r("Sharjah", "الشارقة", /sharjah|sharja|الشارقة|الشارقه/i), r("Ajman", "عجمان", /ajman|عجمان/i),
    r("Umm Al Quwain", "أم القيوين", /umm\s*al\s*quwain|um\s*al\s*quwain|uaq|أم\s*القيوين|ام\s*القيوين/i), r("Ras Al Khaimah", "رأس الخيمة", /ras\s*al\s*khaimah|rak\b|رأس\s*الخيمة|راس\s*الخيمة|رأس\s*الخيمه/i), r("Fujairah", "الفجيرة", /fujairah|fujeirah|الفجيرة|الفجيره/i),
  ],
  SA: [
    r("Riyadh", "الرياض", /riyadh|الرياض/i), r("Makkah", "مكة المكرمة", /makkah|mecca|مكة|مكه|jeddah|jidda|جدة|جده|taif|الطائف/i), r("Madinah", "المدينة المنورة", /madinah|medina|المدينة|المدينه|yanbu|ينبع/i),
    r("Eastern Province", "المنطقة الشرقية", /eastern\s*province|ash\s*sharqiyah|الشرقية|الشرقيه|dammam|الدمام|khobar|الخبر|dhahran|الظهران|jubail|الجبيل|ahsa|al\s*hasa|الأحساء|الاحساء|qatif|القطيف/i),
    r("Qassim", "القصيم", /qassim|qasim|القصيم|buraidah|بريدة|unaizah|عنيزة/i), r("Asir", "عسير", /asir|aseer|عسير|abha|أبها|ابها|khamis\s*mushait|خميس\s*مشيط/i), r("Tabuk", "تبوك", /tabuk|تبوك/i), r("Hail", "حائل", /hail|ha'il|حائل/i),
    r("Northern Borders", "الحدود الشمالية", /northern\s*borders|الحدود\s*الشمالية|arar|عرعر/i), r("Jazan", "جازان", /jazan|jizan|جازان|جيزان/i), r("Najran", "نجران", /najran|نجران/i), r("Al Bahah", "الباحة", /al\s*bahah|al\s*baha|الباحة|الباحه/i), r("Al Jawf", "الجوف", /al\s*jawf|jouf|الجوف|sakaka|سكاكا/i),
  ],
  OM: [
    r("Muscat", "مسقط", /muscat|masqat|مسقط|seeb|السيب|bawshar|بوشر|mutrah|مطرح/i), r("Dhofar", "ظفار", /dhofar|zufar|ظفار|salalah|صلالة|صلاله/i), r("Musandam", "مسندم", /musandam|مسندم|khasab|خصب/i), r("Al Buraimi", "البريمي", /buraimi|buraymi|البريمي/i),
    r("Ad Dakhiliyah", "الداخلية", /dakhiliyah|dakhiliya|الداخلية|الداخليه|nizwa|نزوى/i), r("Al Batinah North", "شمال الباطنة", /batinah\s*north|north\s*batinah|شمال\s*الباطنة|sohar|صحار|shinas|شناص/i), r("Al Batinah South", "جنوب الباطنة", /batinah\s*south|south\s*batinah|جنوب\s*الباطنة|rustaq|الرستاق|barka|بركاء/i),
    r("Al Wusta", "الوسطى", /wusta|الوسطى|haima|هيماء/i), r("Ash Sharqiyah North", "شمال الشرقية", /sharqiyah\s*north|north\s*sharqiyah|شمال\s*الشرقية|ibra|إبراء|ابراء/i), r("Ash Sharqiyah South", "جنوب الشرقية", /sharqiyah\s*south|south\s*sharqiyah|جنوب\s*الشرقية|sur\b|صور/i), r("Ad Dhahirah", "الظاهرة", /dhahirah|dhahira|الظاهرة|ibri|عبري/i),
  ],
  BH: [
    r("Capital", "العاصمة", /capital|العاصمة|manama|المنامة/i), r("Muharraq", "المحرق", /muharraq|المحرق/i), r("Northern", "الشمالية", /northern|الشمالية|hamad\s*town|مدينة\s*حمد|budaiya|البديع/i), r("Southern", "الجنوبية", /southern|الجنوبية|riffa|الرفاع|isa\s*town|مدينة\s*عيسى|sitra|سترة/i),
  ],
  QA: [
    r("Doha", "الدوحة", /doha|الدوحة|الدوحه|west\s*bay|lusail|لوسيل/i), r("Al Rayyan", "الريان", /rayyan|الريان/i), r("Al Wakrah", "الوكرة", /wakrah|wakra|الوكرة|الوكره/i), r("Al Khor and Al Thakhira", "الخور والذخيرة", /khor|thakhira|الخور|الذخيرة/i),
    r("Umm Salal", "أم صلال", /umm\s*salal|أم\s*صلال|ام\s*صلال/i), r("Al Daayen", "الضعاين", /daayen|dayyen|الضعاين/i), r("Al Shamal", "الشمال", /shamal|الشمال/i), r("Al Shahaniya", "الشحانية", /shahaniya|shahaniyah|الشحانية/i),
  ],
  KW: [
    r("Al Asimah", "العاصمة", /asimah|capital|العاصمة|kuwait\s*city|مدينة\s*الكويت|sharq|شرق|salhiya|الصالحية/i), r("Hawalli", "حولي", /hawalli|hawally|حولي|salmiya|السالمية|rumaithiya|الرميثية|jabriya|الجابرية/i), r("Farwaniya", "الفروانية", /farwaniya|farwaniyah|الفروانية|khaitan|خيطان|jleeb|جليب/i),
    r("Ahmadi", "الأحمدي", /ahmadi|الأحمدي|الاحمدي|fahaheel|الفحيحيل|mangaf|المنقف|abu\s*halifa|أبو\s*حليفة/i), r("Jahra", "الجهراء", /jahra|jahraa|الجهراء/i), r("Mubarak Al-Kabeer", "مبارك الكبير", /mubarak\s*al[-\s]*kabeer|مبارك\s*الكبير|qurain|القرين|adan|العدان/i),
  ],
};

export const regionNames = (code: CountryCode) => REGIONS[code].map(x => x.en);
export const isRegionOf = (code: CountryCode, value: string) => regionNames(code).includes(value);
// The canonical region named in free text (English or Arabic) or by its exact name; null if none is recognised.
export function regionFrom(code: CountryCode, ...texts: (string | null | undefined)[]): string | null {
  const list = REGIONS[code];
  for (const t of texts) {
    if (!t) continue;
    const exact = list.find(x => x.en.toLowerCase() === t.trim().toLowerCase() || x.ar === t.trim()); if (exact) return exact.en;
    for (const x of list) if (x.words.test(t)) return x.en;
  }
  return null;
}
