import { useCallback, useEffect, useRef, useState } from 'react';
import { SIGNUP_URL } from '../data';
import { Aed } from '../components/Money';
import { Terminal, type TerminalScreen } from '../components/Terminal';
import { useT } from '../i18n';

/** One loop: voice note → customer confirms → terminal rings → staff accept and pick an ETA → the receipt prints. */
const STEP_MS = [800, 1500, 1600, 1600, 1200, 2800, 1100, 1100, 1300, 800, 700, 600, 600, 1200, 3600, 2600];
const LAST = STEP_MS.length - 1;

function useStory() {
  const [step, setStep] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const run = useCallback((s: number) => {
    window.clearTimeout(timer.current);
    setStep(s);
    timer.current = window.setTimeout(() => run(s >= LAST ? 0 : s + 1), STEP_MS[s]);
  }, []);
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) { setStep(LAST); return; }
    run(0);
    return () => window.clearTimeout(timer.current);
  }, [run]);
  return { s: step, replay: () => run(0) };
}

const BARS = [6, 12, 18, 10, 22, 14, 24, 12, 8, 18, 22, 10, 6, 16, 20, 10, 8, 14, 18, 9];

export function Hero() {
  const t = useT();
  const { s, replay } = useStory();
  const printed = (n: number) => (s >= n ? ' is-on' : '');
  const screen: TerminalScreen = s < 5 ? 'ready' : s === 5 ? 'new' : s < 8 ? 'eta' : 'accepted';

  return (
    <section className="hero2">
      <div className="hero2__paper" aria-hidden="true" />
      <div className="wrap hero2__grid">
        <div className="hero2__copy">
          <h1 className="h1 hero2__title">
            {t(<>Meet your AI ordering <span className="grad-text">employee.</span></>, <>تعرّف على موظف الطلبات <span className="grad-text">بالذكاء الاصطناعي.</span></>)}
          </h1>
          <p className="hero2__tag">{t('It takes the order. Your team makes it.', 'هو يأخذ الطلب، وفريقك يحضّره.')}</p>
          <p className="hero2__lead">
            {t('Lumia Order handles customer orders through WhatsApp — from text and voice messages to confirmed, structured orders ready for your restaurant.', 'يتولى لوميا أوردر طلبات العملاء عبر واتساب — من الرسائل النصية والصوتية إلى طلبات مؤكدة ومنظّمة جاهزة لمطعمك.')}
          </p>
          <div className="hero__ctas">
            <a href={SIGNUP_URL} className="btn btn--primary" data-track="free_trial" data-loc="hero">{t('Start free', 'ابدأ مجاناً')}</a>
            <a href="#how" className="btn btn--ghost" style={{ padding: '0 22px' }}>{t('See how it works', 'شاهد كيف يعمل')} <span style={{ fontSize: 15 }}>↓</span></a>
          </div>
          <ul className="hero2__proof">
            <li>{t('14 days free', '14 يوماً مجاناً')}</li><li>{t('0% commission', '0% عمولة')}</li><li>{t('No credit card required', 'بدون بطاقة ائتمان')}</li>
          </ul>
        </div>

        <div id="demo" className="story" aria-label={t('Animated example: a WhatsApp voice note becomes a printed order', 'مثال متحرك: رسالة صوتية على واتساب تتحول إلى طلب مطبوع')}>
          {/* the customer's phone */}
          <div className="story__phone">
            <div className="story__head">
              <span className="story__avatar">BH</span>
              <span><b>{t('Burger House', 'بيت البرجر')}</b><i>{t('Business account', 'حساب تجاري')}</i></span>
            </div>
            <div className="story__chat">
              <div className={`sbub sbub--out${printed(1)}`}>
                <div className={`svoice${s === 1 || s === 2 ? ' is-playing' : ''}`}>
                  <span className="svoice__play"><span className="tri" /></span>
                  <span className="svoice__wave">{BARS.map((h, i) => <span key={i} style={{ height: h, animationDelay: `${i * 50}ms` }} />)}</span>
                  <span className="svoice__len">0:13</span>
                </div>
                <p className={`stext${printed(2)}`}>{t('Hi, can I get 2 chicken burgers, one without pickles, large fries and 2 Cokes?', 'مرحبا، أبغى 2 برجر دجاج، واحد بدون مخلل، وبطاطس كبيرة و2 كولا.')}</p>
                <span className="sbub__time">21:04 ✓✓</span>
              </div>

              <div className={`sbub sbub--in${s >= 3 ? ' is-on' : ''}`}>
                {t(<>Order #1048 · total <b><Aed n={82} /></b>. Shall I confirm?</>, <>الطلب #1048 · الإجمالي <b><Aed n={82} /></b>. هل أؤكده؟</>)}
                <span className="sbub__time">21:04</span>
              </div>
              <div className={`sbub sbub--out${s >= 4 ? ' is-on' : ''}`}>{t('Yes, confirm.', 'نعم، أكّد.')} <span className="sbub__time sbub__time--inline">21:05 ✓✓</span></div>
              <div className={`sbub sbub--in${s >= 8 ? ' is-on' : ''}`}>{t('Accepted! Ready in 45 minutes.', 'تم القبول! جاهز خلال 45 دقيقة.')}<span className="sbub__time">21:06</span></div>
            </div>
          </div>

          {/* the real terminal, with the receipt coming out of its top */}
          <div className="story__printer">
            <div className={`tdev${s === 5 ? ' is-ring' : ''}`}>
              <span className="device__waves" aria-hidden="true"><span className="wv wv--l"><i /><i /><i /></span><span className="wv wv--r"><i /><i /><i /></span></span>
              <Terminal screen={screen} eta={s >= 7 ? 45 : null} receipt={s >= 9 && s < 15} />
            </div>
            <div className={`story__alert${s >= 5 && s <= 12 ? ' is-on' : ''}`}><i /> {s < 8 ? t('New order · waiting for accept', 'طلب جديد · بانتظار القبول') : t('Accepted · printing the receipt', 'تم القبول · جارٍ طباعة الإيصال')}</div>
          </div>

          <button className="story__replay" onClick={replay} aria-label={t('Replay the animation', 'أعد تشغيل الحركة')}>{t('↻ Replay', '↻ إعادة')}</button>
        </div>
      </div>
    </section>
  );
}
