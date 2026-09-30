import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal, type TerminalScreen } from '../components/Terminal';
import { fade, useWide } from '../components/hooks';
import { AI_STAGES, DEMO_CAPTIONS, DEMO_DURATIONS, DEMO_LAST_STEP, MINI_WAVE, SIGNUP_URL } from '../data';

type Props = { autoplay?: boolean; speed?: number };

function useDemo(autoplay: boolean, speed: number) {
  const [step, setStep] = useState(autoplay ? 0 : DEMO_LAST_STEP);
  const timer = useRef<number | undefined>(undefined);

  const run = useCallback(
    (s: number) => {
      window.clearTimeout(timer.current);
      setStep(s);
      if (!autoplay && s >= DEMO_LAST_STEP) return;
      timer.current = window.setTimeout(() => run(s >= DEMO_LAST_STEP ? 0 : s + 1), DEMO_DURATIONS[s] / speed);
    },
    [autoplay, speed],
  );

  useEffect(() => {
    if (autoplay) run(0);
    return () => window.clearTimeout(timer.current);
  }, [autoplay, run]);

  return { step, replay: () => run(0) };
}

export function Hero({ autoplay = true, speed = 1 }: Props) {
  const wide = useWide();
  const { step: s, replay } = useDemo(autoplay, speed);

  const status =
    s < 2 ? { text: 'Waiting for a message', bg: 'var(--tint)', fg: 'var(--muted)', ls: 'normal' }
    : s < 7 ? { text: 'Processing…', bg: 'var(--chip-2)', fg: '#8A2040', ls: 'normal' }
    : s === 7 ? { text: 'Waiting for customer confirmation', bg: 'var(--chip)', fg: '#8A2040', ls: 'normal' }
    : { text: '✓ CUSTOMER CONFIRMED', bg: 'var(--ok-bg)', fg: 'var(--ok)', ls: '.08em' };

  const tScreen: TerminalScreen = s < 10 ? 'ready' : s === 10 ? 'new' : s < 13 ? 'eta' : 'accepted';
  const progress = s >= 6 ? 1 : s >= 2 ? (s - 1) * 0.18 : 0;

  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero__top">
          <div>
            <div className="hero__kicker eyebrow eyebrow--lg">
              <span className="eyebrow-bar" />
              AI ordering on WhatsApp
            </div>
            <h1 className="h1">
              Meet your AI ordering <span className="grad-text">employee.</span>
            </h1>
            <p className="hero__tagline">It takes the order. Your team makes it.</p>
          </div>
          <div style={{ paddingBottom: 4 }}>
            <p className="hero__copy">
              Lumia Order handles customer orders through WhatsApp — from text and voice messages to confirmed, structured orders ready for your restaurant.
            </p>
            <div className="hero__ctas">
              <a href={SIGNUP_URL} className="btn btn--primary">Start free</a>
              <a href="#demo" className="btn btn--ghost" style={{ padding: '0 22px' }}>
                See it in action <span style={{ fontSize: 15 }}>↓</span>
              </a>
            </div>
            <div className="hero__fine">
              <span>14 days free</span><span>·</span><span>0% commission</span><span>·</span><span>No credit card required</span>
            </div>
          </div>
        </div>

        <div id="demo" className="demo">
          <div className="demo__bar">
            <div className="demo__step" aria-live="polite">
              <span className="mono">{String(s).padStart(2, '0')} / {DEMO_LAST_STEP}</span>
              <span className="demo__caption">{DEMO_CAPTIONS[s]}</span>
            </div>
            <button className="demo__replay" onClick={replay}>↻ Replay</button>
          </div>

          <div className="demo__cols">
            {/* 01 — customer chat */}
            <div className="demo__col">
              <div className="demo__label eyebrow">
                <span className={`demo__dot${[1, 7, 8, 13].includes(s) ? ' is-on' : ''}`} />
                01 · Customer on WhatsApp
              </div>
              <div className="wa">
                <div className="wa__head">
                  <div className="wa__avatar">BH</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Burger House</div>
                    <div className="muted" style={{ fontSize: 12 }}>Business account</div>
                  </div>
                </div>
                <div className="wa__body">
                  <div className={fade(s >= 1, 'msg msg--out')} style={{ width: '88%' }}>
                    <div className="voice">
                      <span className="voice__play"><span className="tri" /></span>
                      <span className="voice__wave">
                        {MINI_WAVE.map((h, i) => <span key={i} style={{ height: h }} />)}
                      </span>
                      <span className="voice__len">🎙 0:13</span>
                    </div>
                    <div className="voice__tx">
                      <div className="mono">VOICE MESSAGE</div>
                      Hi, can I get 2 chicken burgers, one without pickles, large fries and 2 Cokes?
                    </div>
                    <div className="msg__time">21:04 ✓✓</div>
                  </div>

                  <div style={{ position: 'relative', alignSelf: 'flex-start', maxWidth: '88%' }}>
                    <div className="typing" style={{ opacity: s >= 2 && s < 7 ? 1 : 0 }}>
                      <span /><span /><span />
                    </div>
                    <div className={fade(s >= 7, 'msg msg--in')} style={{ maxWidth: '100%' }}>
                      <div>Here's your order #1048:</div>
                      <div style={{ marginTop: 4, color: 'var(--ink-2)' }}>
                        2 × Chicken Burger (1 no pickles)<br />1 × Large Fries<br />2 × Coca-Cola
                      </div>
                      <div style={{ marginTop: 4, color: 'var(--ink-2)' }}>Subtotal AED 74 · Delivery AED 8</div>
                      <div style={{ marginTop: 2, fontWeight: 600 }}>Total AED 82. Shall I confirm?</div>
                      <div className="msg__time">21:04</div>
                    </div>
                  </div>

                  <div className={fade(s >= 8, 'msg msg--out')} style={{ padding: '8px 11px 6px' }}>
                    Yes, confirm.<span style={{ fontSize: 11, color: '#5E7A58', marginInlineStart: 8 }}>21:05 ✓✓</span>
                  </div>

                  <div className={fade(s >= 13, 'msg msg--in')}>
                    Your order #1048 has been accepted 🎉<br />Estimated time: 45 minutes.
                    <div className="msg__time">21:05</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 02 — Lumia AI */}
            <div className="demo__col">
              <div className="demo__label eyebrow">
                <span className={`demo__dot${s >= 2 && s <= 9 ? ' is-on' : ''}`} />
                02 · Lumia Order AI
              </div>
              <div className="card ai">
                <div className="ai__stages">
                  {AI_STAGES.map((label, i) => {
                    const state = s > 2 + i ? 'is-done' : s === 2 + i ? 'is-active' : '';
                    return (
                      <div key={label} className={`stage ${state}`}>
                        <span className="stage__mark">{state === 'is-done' ? '✓' : ''}</span>
                        {label}
                      </div>
                    );
                  })}
                </div>
                <div className="ai__rule" />
                <div className="row-between" style={{ alignItems: 'center' }}>
                  <div className="mono" style={{ fontSize: 13, letterSpacing: '.12em', fontWeight: 500 }}>ORDER #1048</div>
                  <div className="ai__progress" style={{ transform: `scaleX(${progress})` }} />
                </div>
                <div className="ai__items">
                  <div className={fade(s >= 4)}>
                    <div className="item"><span className="item__qty">2×</span><span>Chicken Burger</span></div>
                    <div className="item__mod">1 × No pickles</div>
                  </div>
                  <div className={fade(s >= 5, 'item')}><span className="item__qty">1×</span><span>Large Fries</span></div>
                  <div className={fade(s >= 5, 'item')}><span className="item__qty">2×</span><span>Coca-Cola</span></div>
                </div>
                <div className="dashed" style={{ margin: '16px 0 12px' }} />
                <div className="ai__totals tabnum" style={{ opacity: s >= 6 ? 1 : 0 }}>
                  <div className="row-between"><span>Subtotal</span><span>AED 74</span></div>
                  <div className="row-between"><span>Delivery</span><span>AED 8</span></div>
                  <div className="row-between ai__total"><span>Total</span><span>AED 82</span></div>
                </div>
                <div className="ai__status" style={{ background: status.bg, color: status.fg, letterSpacing: status.ls }}>
                  {status.text}
                </div>
                <div className="ai__travel" style={{ opacity: s >= 9 ? 1 : 0 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                    {s >= 10 ? 'Delivered to Lumia Order Terminal ✓' : 'Sending to restaurant…'}
                  </div>
                  <div className="ai__track">
                    <div className="ai__pill" style={{ transform: `translateX(${s >= 10 ? (wide ? 220 : 200) : 0}px)` }}>#1048</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 03 — terminal */}
            <div className="demo__col">
              <div className="demo__label eyebrow">
                <span className={`demo__dot${s >= 10 ? ' is-on' : ''}`} />
                03 · Lumia Order Terminal
              </div>
              <Terminal screen={tScreen} eta={s >= 12 ? 45 : null} ring={s === 10} receipt={s >= 13} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
