import { useCallback, useEffect, useRef, useState } from 'react';
import { Aed } from '../components/Money';
import { LogoMark } from '../components/Logo';
import { useT } from '../i18n';

/** One loop: the owner uploads the menu → Lumia analyses it → a customer asks → Lumia answers from it. */
const STEP_MS = [1400, 3600, 6200, 5400, 2600, 7000];
const TASKS = ['Reading the file', 'Finding categories', 'Matching prices', 'Spotting modifiers', 'Checking availability'];
const TASKS_AR = ['قراءة الملف', 'استخراج الفئات', 'مطابقة الأسعار', 'التقاط الإضافات', 'التحقق من التوفر'];
const AR_ITEMS: Record<string, string> = { Burgers: 'البرجر', Sides: 'الجانبيات', Drinks: 'المشروبات', 'Chicken Burger': 'برجر دجاج', 'Spicy Chicken Burger': 'برجر دجاج حار', 'Beef Burger': 'برجر لحم', Fries: 'بطاطس', 'Coca-Cola': 'كوكاكولا' };
const LAST = STEP_MS.length - 1;

const DOC: [string, [string, number][]][] = [
  ['Burgers', [['Chicken Burger', 25], ['Spicy Chicken Burger', 27], ['Beef Burger', 29]]],
  ['Sides', [['Fries', 12]]],
  ['Drinks', [['Coca-Cola', 6]]],
];

function useLoop(active: boolean) {
  const [s, setS] = useState(LAST);
  const timer = useRef<number | undefined>(undefined);
  const run = useCallback((n: number) => {
    window.clearTimeout(timer.current);
    setS(n);
    timer.current = window.setTimeout(() => run(n >= LAST ? 0 : n + 1), STEP_MS[n]);
  }, []);
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || !active) { window.clearTimeout(timer.current); if (still) setS(LAST); return; }
    run(0);
    return () => window.clearTimeout(timer.current);
  }, [active, run]);
  return s;
}

export function MenuImport() {
  const t = useT();
  const tr = (s: string) => t(s, AR_ITEMS[s] ?? s);
  let lineNo = 0;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const s = useLoop(visible);

  return (
    <section className="section mi mx">
      <div className="wrap">
        <div className="split">
          <h2 className="h2">{t('Upload the menu or product list you already have.', 'ارفع قائمتك أو قائمة منتجاتك التي لديك.')}</h2>
          <div>
            <p className="lead" style={{ fontSize: 'clamp(18px, 1.6vw, 21px)', color: 'var(--ink)', fontWeight: 500 }}>
              {t('Lumia reads it, builds it in your dashboard, and answers every customer from it.', 'يقرؤها لوميا، ويبنيها في لوحة التحكم، ويجيب كل عميل منها.')}
            </p>
            <p className="lead" style={{ fontSize: 16, marginTop: 10 }}>
              {t('It never invents a dish, a product or a price, and nothing goes live until you approve it.', 'لا يخترع طبقاً أو منتجاً ولا سعراً، ولا يُفعَّل شيء قبل أن توافق عليه.')}
            </p>
          </div>
        </div>

        <div className="mx__board" ref={ref}>
          <div className="mx__top">
            {/* 1 · the owner's menu */}
            <div className="mx__col">
              <h3 className="mi__cap">{t('1 · You upload your menu', '1 · ترفع قائمتك')}</h3>
              <div className="mx__types" aria-hidden="true">
                {['PDF', 'Excel', t('Photo', 'صورة'), t('Link', 'رابط')].map((x, i) => <span key={i} className={i === 0 ? 'is-on' : ''}>{x}</span>)}
              </div>
              <div className={`mi__doc${s >= 1 ? ' is-in' : ''}${s === 2 ? ' is-scan' : ''}`}>
                <div className="mi__docname">{t('Burger House', 'بيت البرجر')}</div>
                {DOC.map(([cat, items]) => (
                  <div key={cat} className="mi__cat">
                    <b>{tr(cat)}</b>
                    {items.map(([n, p]) => (
                      <div key={n} className="mi__line" style={{ ['--i' as string]: lineNo++ }}><span>{tr(n)}</span><i /><span><Aed n={p} /></span></div>
                    ))}
                  </div>
                ))}
                <span className="mi__scan" aria-hidden="true" />
              </div>
              <div className={`mi__up${s === 1 ? ' is-run' : ''}${s >= 2 ? ' is-done' : ''}`}>
                <span className="mi__upname" dir="ltr">burger-house-menu.pdf</span>
                <span className="mi__upstate">{s >= 2 ? t('Uploaded ✓', 'تم الرفع ✓') : s === 1 ? t('Uploading…', 'جارٍ الرفع…') : t('Choose a file', 'اختر ملفاً')}</span>
                <span className="mi__upbar"><i /></span>
              </div>
            </div>

            {/* Lumia in the middle */}
            <div className={`mx__mid mi__agent${s === 2 ? ' is-run' : ''}${s >= 3 ? ' is-done' : ''}`}>
              <div className="mi__orb mx__orb" aria-hidden="true">
                <span className={`mx__beam mx__beam--l${s === 1 || s === 2 ? ' is-on' : ''}`} aria-hidden="true"><i /></span>
                <span className={`mx__beam mx__beam--r${s === 3 ? ' is-on' : ''}`} aria-hidden="true"><i /></span>
                <span className="mi__orbit"><i /><i /><i /></span>
                <span className="mi__orbin"><LogoMark size={44} /></span>
              </div>
              <div className="mi__agentname">Lumia <span>{s === 2 ? t('is analysing…', 'يحلّل…') : s >= 3 ? t('understood your menu', 'فهم قائمتك') : t('waiting for a menu', 'بانتظار قائمة')}</span></div>
              <div className={`mx__tasks${s === 2 ? ' is-run' : ''}`} aria-live="polite">
                {TASKS.map((tk, k) => <span key={tk} style={{ ['--k' as string]: k }}>{t(tk, TASKS_AR[k]!)}</span>)}
              </div>
            </div>

            {/* 2 · what Lumia built */}
            <div className="mx__col">
              <h3 className="mi__cap">{t('2 · Lumia builds your menu', '2 · لوميا يبني قائمتك')}</h3>
              <div className={`mx__card${s >= 3 ? ' is-on' : ''}`}>
                <div className="mx__cardhead">
                  <b>{t('Your menu in Lumia', 'قائمتك في لوميا')}</b>
                  <span className="mx__sync">{t('✓ Synced to your dashboard', '✓ تمت المزامنة مع لوحة التحكم')}</span>
                </div>
                <div className="mx__rows">
                  {(() => { let r = 0; return DOC.map(([cat, items]) => (
                    <div key={cat}>
                      <div className="mx__cat">{tr(cat)}</div>
                      {items.map(([n, p]) => (
                        <div key={n} className={`mx__row${s >= 5 && n === 'Spicy Chicken Burger' ? ' is-src' : ''}`} style={{ ['--i' as string]: r++ }}>
                          <span className="mx__name">{tr(n)}</span>
                          <span className="mx__price"><Aed n={p} /></span>
                          <span className="mx__pill">{t('Available', 'متاح')}</span>
                        </div>
                      ))}
                    </div>
                  )); })()}
                </div>
                <div className="mx__sum">{t('5 items · 3 categories · 4 options', '5 أصناف · 3 فئات · 4 خيارات')}</div>
              </div>
            </div>
          </div>

          {/* 3 · a customer asks */}
          <div className="mx__ask">
            <div className="mx__askcap">
              <h3 className="mi__cap">{t('3 · A customer asks, Lumia answers from it', '3 · عميل يسأل، ولوميا يجيب من القائمة')}</h3>
              <p>{t('Prices, options and what is sold out. Every answer comes from the menu above, never from guesswork.', 'الأسعار والخيارات وما نفد. كل إجابة تأتي من القائمة أعلاه، لا من التخمين.')}</p>
            </div>
            <div className="mi__chat mx__chat">
              <div className="mi__chathead"><span>BH</span><b>{t('Burger House', 'بيت البرجر')}</b></div>
              <div className="mi__chatbody">
                <div className={`sbub sbub--out${s >= 4 ? ' is-on' : ''}`}>{t('Do you have a spicy chicken burger? How much?', 'عندكم برجر دجاج حار؟ بكم؟')}<span className="sbub__time">21:12 ✓✓</span></div>
                <div className={`mi__typing${s === 4 ? ' is-on' : ''}`}><i /><i /><i /></div>
                <div className={`sbub sbub--in${s >= 5 ? ' is-on' : ''}`}>
                  {t(<>Yes! The Spicy Chicken Burger is <b><Aed n={27} /></b>. Want it with large fries for <Aed n={12} />?</>, <>نعم! برجر الدجاج الحار بسعر <b><Aed n={27} /></b>. تريده مع بطاطس كبيرة بـ <Aed n={12} />؟</>)}
                  <span className="mi__src">{t('📄 from your menu', '📄 من قائمتك')}</span>
                  <span className="sbub__time">21:12</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
