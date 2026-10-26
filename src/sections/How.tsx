import { useEffect, useRef, useState } from 'react';
import { Terminal } from '../components/Terminal';
import { Aed } from '../components/Money';
import { MINI_WAVE } from '../data';
import { LogoMark } from '../components/Logo';
import { useT } from '../i18n';

const STEPS_AR = [
  { title: 'العميل يرسل رسالة', text: 'نص أو صوت، مباشرة إلى رقم واتساب الخاص بك.' },
  { title: 'لوميا يفهم', text: 'يلتقط كل صنف وكمية ونوع وإضافة وتفصيل للتوصيل.' },
  { title: 'العميل يؤكد', text: 'يرسل لوميا الطلب كاملاً مع الإجمالي. لا يتحرك شيء قبل أن يقول العميل نعم.' },
  { title: 'فريقك يستلم', text: 'يرنّ الطلب على جهازك أو لوحة التحكم. اقبل، حدد الوقت، ويُطبع الإيصال.' },
];
const STEPS = [
  { title: 'Customer messages', text: 'Text or voice, straight to your own WhatsApp number.', color: '#ff5577' },
  { title: 'Lumia understands', text: 'Every product, quantity, variant, modifier and delivery detail is picked out.', color: '#ee4f97' },
  { title: 'Customer confirms', text: 'Lumia sends the complete order and total. Nothing moves until the customer says yes.', color: '#dc46c6' },
  { title: 'Your team receives it', text: 'The order rings on your terminal or dashboard. Accept, pick an ETA, and the receipt prints.', color: '#c93dff' },
] as const;
const AUTO_MS = 5200;

export function HowItWorks() {
  const t = useT();
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || still) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % STEPS.length), AUTO_MS);
    return () => window.clearTimeout(id);
  }, [visible, still, active]);

  const ar = t(false, true), S = STEPS.map((s, i) => (ar ? { ...s, ...STEPS_AR[i] } : s));

  return (
    <section id="how" className="section how2">
      <div className="wrap">
        <h2 className="h2 how2__title">{t('From message to ready order in four steps.', 'من الرسالة إلى الطلب الجاهز في أربع خطوات.')}</h2>
        <div ref={ref}>
          <div className="hstage">
            <div className="hbg" aria-hidden="true">
              <span className="hbg__ring hbg__ring--1" /><span className="hbg__ring hbg__ring--2" /><span className="hbg__ring hbg__ring--3" />
              <span className="hbg__logo"><LogoMark size={420} /></span>
              <span className="hbg__ai hbg__ai--1">AI</span><span className="hbg__ai hbg__ai--2">AI</span><span className="hbg__ai hbg__ai--3">AI</span>
              <span className="hbg__dot hbg__dot--1" /><span className="hbg__dot hbg__dot--2" /><span className="hbg__dot hbg__dot--3" /><span className="hbg__dot hbg__dot--4" /><span className="hbg__dot hbg__dot--5" />
            </div>

            <div className="hcap" key={active} aria-live="polite">
              <span className="hcap__n" style={{ color: STEPS[active].color }}>0{active + 1}</span>
              <h3>{S[active].title}</h3>
              <p>{S[active].text}</p>
            </div>

            <div className="hscenes">
            <div className={`hscene${active === 0 ? ' is-on' : ''}`} aria-hidden={active !== 0}>
              <div className="hchat">
                <div className="hpop hpop--out" style={{ ['--d' as string]: '0ms' }}>{t('2 chicken burgers please', 'من فضلك 2 برجر دجاج')}</div>
                <div className="hpop hpop--out hpop--voice" style={{ ['--d' as string]: '450ms' }}>
                  <span className="tri" style={{ borderColor: 'transparent transparent transparent #fff' }} />
                  <span className="hwave">{MINI_WAVE.map((h, i) => <span key={i} style={{ height: h, animationDelay: `${i * 45}ms` }} />)}</span>
                  <span className="mono">0:13</span>
                </div>
                <div className="hpop hpop--in" style={{ ['--d' as string]: '1100ms' }}>{t('Hi! One moment while I put that together…', 'أهلاً! لحظة وأجهّز لك الطلب…')}</div>
              </div>
            </div>

            <div className={`hscene${active === 1 ? ' is-on' : ''}`} aria-hidden={active !== 1}>
              <p className="hsay">
                {t(<>“Hi, can I get <mark style={{ ['--d' as string]: '300ms' }} className="mk mk--p">2 chicken burgers</mark>, <mark style={{ ['--d' as string]: '800ms' }} className="mk mk--m">one without pickles</mark>, <mark style={{ ['--d' as string]: '1300ms' }} className="mk mk--p">large fries</mark> and <mark style={{ ['--d' as string]: '1800ms' }} className="mk mk--p">2 Cokes</mark>?”</>, <>“مرحبا، أبغى <mark style={{ ['--d' as string]: '300ms' }} className="mk mk--p">2 برجر دجاج</mark>، <mark style={{ ['--d' as string]: '800ms' }} className="mk mk--m">واحد بدون مخلل</mark>، <mark style={{ ['--d' as string]: '1300ms' }} className="mk mk--p">بطاطس كبيرة</mark> و<mark style={{ ['--d' as string]: '1800ms' }} className="mk mk--p">2 كولا</mark>؟”</>)}
              </p>
              <div className="hparse">
                {t([['Chicken Burger', '2', 'No pickles on 1'], ['Fries', '1', 'Large'], ['Coca-Cola', '2', '—']], [['برجر دجاج', '2', 'واحد بدون مخلل'], ['بطاطس', '1', 'كبيرة'], ['كولا', '2', '—']]).map(([n, q, m], i) => (
                  <div key={n} className="hparse__row" style={{ ['--d' as string]: `${2300 + i * 260}ms` }}>
                    <span className="hparse__q">{q}×</span><span>{n}</span><span className="muted">{m}</span>
                  </div>
                ))}
                <div className="hparse__row hparse__row--ok" style={{ ['--d' as string]: '3200ms' }}>{t('Checked against your menu or products and availability ✓', 'تمت مطابقته مع قائمتك أو منتجاتك وتوفرها ✓')}</div>
              </div>
            </div>

            <div className={`hscene${active === 2 ? ' is-on' : ''}`} aria-hidden={active !== 2}>
              <div className="hchat">
                <div className="hpop hpop--in" style={{ ['--d' as string]: '0ms' }}>
                  {t(<>Your order #1048:<br />2 × Chicken Burger (1 no pickles)<br />1 × Large Fries · 2 × Coca-Cola<br />Delivery <Aed n={8} /></>, <>طلبك #1048:<br />2 × برجر دجاج (واحد بدون مخلل)<br />1 × بطاطس كبيرة · 2 × كولا<br />التوصيل <Aed n={8} /></>)}
                  <b style={{ display: 'block', marginTop: 4 }}>{t(<>Total <Aed n={82} />. Shall I confirm?</>, <>الإجمالي <Aed n={82} />. هل أؤكد الطلب؟</>)}</b>
                </div>
                <div className="hpop hpop--out" style={{ ['--d' as string]: '900ms' }}>{t('Yes, confirm ✓', 'نعم، أكّد ✓')}</div>
                <div className="hbadge" style={{ ['--d' as string]: '1500ms' }}>{t('Confirmed by customer — now it comes to you', 'أكّده العميل — والآن يصل إليك')}</div>
              </div>
            </div>

            <div className={`hscene hscene--term${active === 3 ? ' is-on' : ''}`} aria-hidden={active !== 3}>
              <div className="hterm"><Terminal screen={active === 3 ? 'new' : 'ready'} ring={active === 3} /></div>
              <div className="hside">
                <div className="hside__card" style={{ ['--d' as string]: '300ms' }}><span className="hside__k">{t('Alert', 'تنبيه')}</span>{t('The terminal rings until someone answers.', 'يرنّ الجهاز حتى يردّ أحد.')}</div>
                <div className="hside__card" style={{ ['--d' as string]: '700ms' }}><span className="hside__k">{t('Decide', 'قرار')}</span>{t('Accept or reject, then choose 30, 45 or 60 min.', 'اقبل أو ارفض، ثم اختر 30 أو 45 أو 60 دقيقة.')}</div>
                <div className="hside__card" style={{ ['--d' as string]: '1100ms' }}><span className="hside__k">{t('Print', 'طباعة')}</span>{t('The receipt prints. The customer is told on WhatsApp.', 'يُطبع الإيصال ويُبلَّغ العميل عبر واتساب.')}</div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
