import { useEffect, useRef, useState } from 'react';
import { fade } from '../components/hooks';
import { WAVE } from '../data';
import { Aed } from '../components/Money';
import { useT } from '../i18n';

export function Stats() {
  const t = useT();
  const stats = [
    ['0%', t('Commission', 'عمولة')],
    ['24/7', t('AI ordering', 'طلبات بالذكاء الاصطناعي')],
    [t('Text + Voice', 'نص + صوت'), t('Ordering', 'للطلبات')],
    [t('Your WhatsApp', 'واتساب الخاص بك'), t('Your customers', 'عملاؤك')],
  ];
  return (
    <section style={{ padding: 'clamp(56px,7vw,96px) 0 0' }}>
      <div className="wrap split" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: '20px 64px' }}>
        <h2 className="h2" style={{ fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.035em', lineHeight: 1.05 }}>
          {t('Nothing reaches your restaurant until the customer confirms.', 'لا يصل أي طلب إلى مطعمك قبل أن يؤكده العميل.')}
        </h2>
        <p className="lead" style={{ maxWidth: 520 }}>
          {t('Lumia structures the order, checks it against your menu and shows the final order to the customer before sending it to your restaurant.', 'ينظّم لوميا الطلب ويطابقه مع قائمتك ويعرض الطلب النهائي على العميل قبل إرساله إلى مطعمك.')}
        </p>
      </div>
      <div className="wrap" style={{ marginTop: 'clamp(40px,5vw,64px)' }}>
        <div className="grid stats">
          {stats.map(([big, small]) => (
            <div key={big} className="stat"><b>{big}</b><span>{small}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhatsAppChaos() {
  const t = useT();
  const msgs = t(['Menu?', 'Do you have chicken?', 'How much delivery?', '2 burgers', 'one without cheese', 'actually add fries', 'location?', 'how long?'], ['القائمة؟', 'عندكم دجاج؟', 'كم التوصيل؟', '2 برجر', 'واحد بدون جبنة', 'وزيدوا بطاطس', 'الموقع؟', 'كم تأخذ؟']);
  return (
    <section className="section">
      <div className="wrap grid" style={{ ['--min' as string]: '460px', gap: 'clamp(40px,6vw,88px)', alignItems: 'center' }}>
        <div>
          <h2 className="h2">{t('Your customers already order on WhatsApp.', 'عملاؤك يطلبون عبر واتساب أصلاً.')}</h2>
          <p style={{ fontSize: 'clamp(22px,2.2vw,28px)', lineHeight: 1.3, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 24, maxWidth: 480, textWrap: 'pretty' }}>
            {t('Lumia handles the conversation. Your team handles the food.', 'لوميا يتولى المحادثة، وفريقك يتولى الطعام.')}
          </p>
        </div>
        <div className="grid" style={{ ['--min' as string]: '230px', gap: 16, alignItems: 'center' }}>
          <div style={{ background: 'var(--wa-bg)', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 14 }}>
            {msgs.map((m) => (
              <div key={m} className="bubble" style={{ alignSelf: 'flex-end', padding: '6px 10px' }}>{m}</div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="eyebrow-bar" />{t('Organized by Lumia', 'نظّمه لوميا')}
            </div>
            <div className="card tabnum" style={{ padding: 20 }}>
              <div className="item" style={{ fontSize: 15 }}><span className="item__qty" style={{ width: 26 }}>2×</span><span>{t('Chicken Burger', 'برجر دجاج')}</span></div>
              <div className="item__mod" style={{ paddingInlineStart: 36 }}>{t('– 1 × No cheese', '– 1 × بدون جبنة')}</div>
              <div className="item" style={{ fontSize: 15, marginTop: 10 }}><span className="item__qty" style={{ width: 26 }}>1×</span><span>{t('Fries', 'بطاطس')}</span></div>
              <div className="dashed" style={{ margin: '14px 0 10px' }} />
              <div className="row-between" style={{ fontSize: 15 }}><span className="muted">{t('Delivery', 'التوصيل')}</span><span><Aed n={8} /></span></div>
              <div className="note note--ok" style={{ marginTop: 14, padding: '9px 12px' }}>{t('Customer confirmed ✓', 'أكّد العميل ✓')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Ownership() {
  const t = useT();
  const perks = t(['Your WhatsApp', 'Your customer relationship', 'Your menu', 'Your delivery rules', 'Your brand', '0% Lumia commission per order'], ['واتساب الخاص بك', 'علاقتك بعملائك', 'قائمتك', 'قواعد التوصيل لديك', 'علامتك التجارية', '0% عمولة من لوميا على كل طلب']);
  return (
    <section className="section section--soft">
      <div className="wrap">
        <h2 className="h2" style={{ maxWidth: 820 }}>{t('Your customers stay your customers.', 'عملاؤك يبقون عملاءك.')}</h2>
        <div className="grid" style={{ gap: 'clamp(24px,3vw,40px)', marginTop: 'clamp(40px,5vw,60px)', alignItems: 'start' }}>
          <div className="flow">
            <div className="eyebrow" style={{ marginBottom: 18 }}>{t('Traditional marketplace', 'التطبيقات التقليدية')}</div>
            <div className="flow__node">{t('Customer', 'العميل')}</div>
            <div className="flow__link" />
            <div className="flow__node flow__node--mid">{t('Marketplace', 'التطبيق الوسيط')}</div>
            <div className="flow__link" />
            <div className="flow__node">{t('Restaurant', 'المطعم')}</div>
          </div>
          <div className="flow">
            <div className="eyebrow" style={{ marginBottom: 18, color: 'var(--ink)' }}>Lumia Order</div>
            <div className="flow__node flow__node--brand">{t('Customer', 'العميل')}</div>
            <div className="flow__link flow__link--brand" style={{ background: 'linear-gradient(#FF5577,#E449B8)' }} />
            <div className="flow__node flow__node--brand">{t('Your WhatsApp', 'واتساب الخاص بك')}</div>
            <div className="flow__link flow__link--brand" style={{ background: 'linear-gradient(#E449B8,#C93DFF)' }} />
            <div className="flow__node flow__node--brand">{t('Your Restaurant', 'مطعمك')}</div>
          </div>
          <div className="checklist">
            {perks.map((p) => (
              <div key={p}><span className="check">✓</span>{p}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Voice() {
  const t = useT();
  // 0 = idle, 1 = transcribed, 2 = structured (3 = resting state, everything shown)
  const [stage, setStage] = useState(3);
  const [pos, setPos] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const loop = useRef<number | undefined>(undefined);
  const played = useRef(false);
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => () => { window.clearInterval(timer.current); window.clearTimeout(loop.current); }, []);

  const play = () => {
    window.clearTimeout(loop.current);
    window.clearInterval(timer.current);
    let p = 0;
    setStage(0);
    setPos(0);
    timer.current = window.setInterval(() => {
      p += 1;
      if (p <= WAVE.length) {
        setPos(p);
        setStage(p > 10 ? 1 : 0);
      } else if (p === 32) setStage(2);
      else if (p > 34) {
        window.clearInterval(timer.current);
        setStage(3);
        setPos(null);
      }
    }, 90);
  };
  const auto = useRef(false);
  auto.current = visible && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto.current || played.current) return;
    played.current = true;
    play();
  }, [visible]);

  return (
    <section className="section section--soft" ref={ref}>
      <div className="wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <h2 className="h2" style={{ fontSize: 'clamp(40px,6vw,80px)', letterSpacing: '-0.045em', lineHeight: 1 }}>
            {t(<>They can say it.<br /><span className="grad-text">Lumia</span> can order it.</>, <>هم يقولونها.<br /><span className="grad-text">لوميا</span> يطلبها.</>)}
          </h2>
          <button className="btn btn--ghost" style={{ height: 48, padding: '0 20px', fontSize: 15 }} onClick={play}>
            {t('↻ Replay voice message', '↻ أعد تشغيل الرسالة الصوتية')}
          </button>
        </div>

        <div className="grid" style={{ ['--min' as string]: '300px', gap: 'clamp(16px,2vw,28px)', marginTop: 'clamp(40px,5vw,60px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">{t('01 · WhatsApp voice message', '01 · رسالة صوتية على واتساب')}</div>
            <div className="card vplayer">
              <div className="vplayer__btn"><span className="tri" /></div>
              <div className="vplayer__wave">
                {WAVE.map((h, i) => (
                  <span key={i} style={{ height: h, background: pos == null ? '#D9BFCB' : i < pos ? '#FF5577' : '#EAD9E1' }} />
                ))}
              </div>
              <span className="mono muted" style={{ fontSize: 13 }}>🎙 0:13</span>
            </div>
          </div>
          <div className={`${fade(stage >= 1)} vsay${stage >= 1 && stage < 3 ? ' is-run' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">{t('02 · Transcription', '02 · تحويل الصوت إلى نص')}</div>
            <p style={{ fontSize: 'clamp(20px,2vw,24px)', lineHeight: 1.45, letterSpacing: '-0.01em', textWrap: 'pretty' }}>
              {t(<>"Give me <span className="hl" style={{ background: 'rgba(255,85,119,.22)' }}>two spicy chicken burgers</span>,{' '}
              <span className="hl" style={{ background: 'rgba(228,73,184,.25)' }}>one without cheese</span>,{' '}
              <span className="hl" style={{ background: 'rgba(255,85,119,.22)' }}>fries</span> and{' '}
              <span className="hl" style={{ background: 'rgba(201,61,255,.25)' }}>three Pepsi</span>."</>, <>"أعطني <span className="hl" style={{ background: 'rgba(255,85,119,.22)' }}>اثنين برجر دجاج حار</span>،{' '}
              <span className="hl" style={{ background: 'rgba(228,73,184,.25)' }}>واحد بدون جبنة</span>،{' '}
              <span className="hl" style={{ background: 'rgba(255,85,119,.22)' }}>بطاطس</span> و{' '}
              <span className="hl" style={{ background: 'rgba(201,61,255,.25)' }}>ثلاث بيبسي</span>."</>)}
            </p>
          </div>
          <div className={`${fade(stage >= 2)} vorder${stage >= 2 && stage < 3 ? ' is-run' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">{t('03 · Structured Lumia Order', '03 · طلب لوميا منظّم')}</div>
            <div className="card" style={{ borderRadius: 18, padding: 20, fontSize: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div className="item"><span className="item__qty">2×</span><span>{t('Spicy Chicken Burger', 'برجر دجاج حار')}</span></div>
                <div className="item__mod" style={{ fontSize: 14 }}>{t('– 1 × No cheese', '– 1 × بدون جبنة')}</div>
              </div>
              <div className="item"><span className="item__qty">1×</span><span>{t('Fries', 'بطاطس')}</span></div>
              <div className="item"><span className="item__qty">3×</span><span>{t('Pepsi', 'بيبسي')}</span></div>
            </div>
          </div>
        </div>


        <div className="grid" style={{ ['--min' as string]: '300px', marginTop: 'clamp(40px,5vw,56px)', paddingTop: 'clamp(28px,3vw,36px)', borderTop: '1px solid var(--line-2)', gap: 'clamp(16px,2vw,28px)', alignItems: 'center' }}>
          <div>
            <div className="eyebrow">{t('Built for the Gulf', 'مصمم للخليج')}</div>
            <p style={{ fontSize: 18, lineHeight: 1.5, marginTop: 10, maxWidth: 360, textWrap: 'pretty' }}>
              {t('Customers mix Arabic and English in one message. The order comes out the same.', 'يخلط العملاء العربية والإنجليزية في رسالة واحدة، ويخرج الطلب منظّماً بالدقة نفسها.')}
            </p>
          </div>
          <div dir="rtl" lang="ar" style={{ justifySelf: 'start', background: 'var(--wa)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', fontFamily: "'Cairo',sans-serif", fontSize: 18, lineHeight: 1.6, maxWidth: 380 }}>
            مرحبا، بدي 2 chicken burger، واحد بدون pickles، و large fries.
          </div>
          <div className="card" style={{ borderRadius: 18, padding: '18px 20px', fontSize: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div className="item"><span className="item__qty">2×</span><span>{t('Chicken Burger', 'برجر دجاج')}</span></div>
              <div className="item__mod" style={{ fontSize: 14 }}>{t('– 1 × No pickles', '– 1 × بدون مخلل')}</div>
            </div>
            <div className="item"><span className="item__qty">1×</span><span>{t('Large Fries', 'بطاطس كبيرة')}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

