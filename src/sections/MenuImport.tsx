import { useCallback, useEffect, useRef, useState } from 'react';
import { Aed } from '../components/Money';
import { LogoMark } from '../components/Logo';
import { useT } from '../i18n';

/** One stage, one loop: Lumia stays in the middle as the thinking engine while the steps fade in and out on either side.
 *  0 waiting · 1 the menu is uploaded · 2 Lumia reads it · 3 the menu is built · 4 a customer asks · 5 Lumia answers from the menu. */
const STEP_MS = [1500, 3400, 6200, 4600, 3200, 5600];
const TASKS = ['Reading the file', 'Finding categories', 'Matching prices', 'Spotting modifiers', 'Checking availability'];
const TASKS_AR = ['قراءة الملف', 'استخراج الفئات', 'مطابقة الأسعار', 'التقاط الإضافات', 'التحقق من التوفر'];
const AR_ITEMS: Record<string, string> = { Burgers: 'البرجر', Sides: 'الجانبيات', Drinks: 'المشروبات', 'Chicken Burger': 'برجر دجاج', 'Spicy Chicken Burger': 'برجر دجاج حار', 'Beef Burger': 'برجر لحم', Fries: 'بطاطس', 'Coca-Cola': 'كوكاكولا' };
const LAST = STEP_MS.length - 1;

const DOC: [string, [string, number][]][] = [
  ['Burgers', [['Chicken Burger', 25], ['Spicy Chicken Burger', 27], ['Beef Burger', 29]]],
  ['Sides', [['Fries', 12]]],
  ['Drinks', [['Coca-Cola', 6]]],
];


/** Lumia at the top of the triangle: the logo inside a ring, with small AI sparkles around it. The ring idles, speeds up while Lumia detects (reads the menu, reads the question) and settles when it sends its result out. */
const STAR = 'M50 0C54 30 70 46 100 50C70 54 54 70 50 100C46 70 30 54 0 50C30 46 46 30 50 0Z';
function LumiaTop({ mode }: { mode: 'idle' | 'listen' | 'think' | 'speak' }) {
  const star = (cls: string, k: number) => (
    <svg className={`mzs__s ${cls}`} viewBox="0 0 100 100" style={{ ['--k' as string]: k }}><path d={STAR} fill="url(#mzsg)" /></svg>
  );
  return (
    <div className={`mzs is-${mode}`} aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}><defs><linearGradient id="mzsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5577" /><stop offset="0.55" stopColor="#e449b8" /><stop offset="1" stopColor="#c93dff" /></linearGradient></defs></svg>
      <div className="mz__orbc">
        <div className="mi__orb mx__orb">
          <span className="mi__orbit"><i /><i /><i /></span>
          <span className="mi__orbin"><LogoMark size={52} /></span>
        </div>
      </div>
      {star('mzs__a', 1)}
      {star('mzs__b', 2)}
      {star('mzs__c', 3)}
    </div>
  );
}

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
  const steps = [t('1 · You upload your menu', '1 · ترفع قائمتك'), t('2 · Lumia detects and builds it', '2 · لوميا يكتشفها ويبنيها'), t('3 · A customer messages, Lumia answers', '3 · عميل يراسل، ولوميا يجيب')];
  const stepNow = s <= 1 ? 0 : s <= 3 ? 1 : 2;
  const captions = [
    t('Drop in the menu or product list you already have.', 'ضع قائمتك أو قائمة منتجاتك كما هي.'),
    t('PDF, Excel, a photo or a link. Nothing to retype.', 'PDF أو Excel أو صورة أو رابط. بلا إعادة كتابة.'),
    t('Lumia reads every line: categories, prices and options.', 'يقرأ لوميا كل سطر: الفئات والأسعار والخيارات.'),
    t('Your menu is built in the dashboard. Nothing goes live until you approve it.', 'تُبنى قائمتك في لوحة التحكم، ولا يُفعَّل شيء قبل أن توافق.'),
    t('Then a customer messages about a product.', 'ثم يراسل عميل عن منتج.'),
    t('Lumia answers only from your menu, never from guesswork.', 'يجيب لوميا من قائمتك فقط، لا من التخمين.'),
  ];
  const status = [t('waiting for a menu', 'بانتظار قائمة'), t('receiving your menu…', 'يستلم قائمتك…'), t('AI detecting your menu…', 'يكتشف قائمتك بالذكاء الاصطناعي…'), t('menu detected and built', 'اكتشف القائمة وبناها'), t('AI reading the message…', 'يقرأ الرسالة…'), t('answering from your menu', 'يجيب من قائمتك')];
  const on = (v: boolean, past: boolean) => `mz__layer${v ? ' is-on' : ''}${past ? ' is-past' : ''}`;
  const mode = s === 2 || s === 4 ? 'think' : s === 1 ? 'listen' : s === 3 || s === 5 ? 'speak' : 'idle';

  return (
    <section className="section mi mx mz">
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

        <div className="mx__board mz__stage" ref={ref}>
          <div className="mz__steps">
            {steps.map((x, k) => <span key={k} className={k === stepNow ? 'is-on' : ''}>{x}</span>)}
          </div>
          <p className="mz__cap" aria-live="polite"><span key={s}>{captions[s]}</span></p>

          <div className="mz__scene">
            {/* left: what comes in. First the menu, then the customer's message */}
            <div className="mz__slot mz__slot--in">
              <div className={on(s === 0, s > 0)}>
                <div className="mx__types" aria-hidden="true" style={{ justifyContent: 'center' }}>
                  {['PDF', 'Excel', t('Photo', 'صورة'), t('Link', 'رابط')].map((x, i) => <span key={i} className={i === 0 ? 'is-on' : ''}>{x}</span>)}
                </div>
                <div className="mz__drop"><b>{t('Choose a file', 'اختر ملفاً')}</b><span>{t('or drop your menu here', 'أو اسحب قائمتك إلى هنا')}</span></div>
              </div>
              <div className={on(s >= 1 && s <= 3, s > 3)}>
                <div className={`mi__doc is-in${s === 2 ? ' is-scan' : ''}`}>
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
                  <span className="mi__upstate">{s >= 2 ? t('Uploaded ✓', 'تم الرفع ✓') : t('Uploading…', 'جارٍ الرفع…')}</span>
                  <span className="mi__upbar"><i /></span>
                </div>
              </div>
              <div className={on(s >= 4, false)}>
                <div className="mi__chat mx__chat mz__chat">
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

            <div className={`mz__flow mz__flow--a${s === 1 || s === 2 || s === 4 ? ' is-on' : ''}`} aria-hidden="true">
              {[0, 1, 2, 3].map((k) => <i key={k} style={{ ['--d' as string]: `${k * 0.24}s` }} />)}
            </div>

            {/* Lumia stays in the middle, the whole time: the AI that detects */}
            <div className={`mz__core mi__agent${s === 2 || s === 4 ? ' is-run' : ''}${s === 3 || s === 5 ? ' is-done' : ''}`}>
              <LumiaTop mode={mode} />
              <div className="mi__agentname">Lumia <span key={s} className="mz__status">{status[s]}</span></div>
              <div className={`mx__tasks${s === 2 ? ' is-run' : ''}`} aria-live="polite">
                {TASKS.map((tk, k) => <span key={tk} style={{ ['--k' as string]: k }}>{t(tk, TASKS_AR[k]!)}</span>)}
              </div>
            </div>

            <div className={`mz__flow mz__flow--b${s >= 3 ? ' is-on' : ''}`} aria-hidden="true">
              {[0, 1, 2, 3].map((k) => <i key={k} style={{ ['--d' as string]: `${k * 0.24}s` }} />)}
            </div>

            {/* right: what comes out. First the built menu, then Lumia's answer */}
            <div className="mz__slot mz__slot--out">
              <div className="mz__layer is-on">
                <div className={`mx__card mz__dash${s >= 3 ? ' is-on' : ''}`}>
                  <div className="mx__cardhead">
                    <b>{t('Lumia dashboard', 'لوحة لوميا')}</b>
                    <span className="mx__sync">{t('✓ Synced to your dashboard', '✓ تمت المزامنة مع لوحة التحكم')}</span>
                  </div>
                  <div className={`mz__empty${s >= 3 ? ' is-off' : ''}`}>
                    <b>{t('No menu yet', 'لا توجد قائمة بعد')}</b>
                    <span>{t('Categories and products will appear here', 'ستظهر الفئات والمنتجات هنا')}</span>
                  </div>
                  <div className="mx__rows">
                    {(() => { let r = 0; return DOC.map(([cat, items]) => (
                      <div key={cat} className="mz__grp">
                        <div className="mx__cat">{tr(cat)}</div>
                        {items.map(([n, p]) => (
                          <div key={n} className={`mx__row${s === 5 && n === 'Spicy Chicken Burger' ? ' is-src' : ''}`} style={{ ['--i' as string]: r++ }}>
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
          </div>
        </div>
      </div>
    </section>
  );
}
