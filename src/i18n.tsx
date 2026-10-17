import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ar';

const KEY = 'lumia-lang';
function initial(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'ar' || q === 'en') return q;
    const s = localStorage.getItem(KEY);
    if (s === 'ar' || s === 'en') return s;
  } catch { /* storage can be blocked */ }
  return typeof navigator !== 'undefined' && /^ar/i.test(navigator.language) ? 'ar' : 'en';
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => undefined });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => { set(l); try { localStorage.setItem(KEY, l); } catch { /* optional */ } }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang; el.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'لوميا أوردر — موظف الطلبات بالذكاء الاصطناعي على واتساب' : 'Lumia Order — Your AI ordering employee on WhatsApp';
  }, [lang]);
  const v = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** `t('English', 'عربي')` picks the string for the current language. Works for JSX too. */
export function useT() {
  const { lang } = useLang();
  return useCallback(<T,>(en: T, ar: T): T => (lang === 'ar' ? ar : en), [lang]);
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <button className="langsw" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} lang={lang === 'ar' ? 'en' : 'ar'}>
      {lang === 'ar' ? 'EN' : 'عربي'}
    </button>
  );
}
