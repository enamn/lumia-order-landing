import { useEffect, useRef, useState } from 'react';
import { fade } from '../components/hooks';
import { WAVE } from '../data';
import { Aed } from '../components/Money';

export function Stats() {
  const stats = [
    ['0%', 'Commission'],
    ['24/7', 'AI ordering'],
    ['Text + Voice', 'Ordering'],
    ['Your WhatsApp', 'Your customers'],
  ];
  return (
    <section style={{ padding: 'clamp(56px,7vw,96px) 0 0' }}>
      <div className="wrap split" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: '20px 64px' }}>
        <h2 className="h2" style={{ fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.035em', lineHeight: 1.05 }}>
          Nothing reaches your restaurant until the customer confirms.
        </h2>
        <p className="lead" style={{ maxWidth: 520 }}>
          Lumia structures the order, checks it against your menu and shows the final order to the customer before sending it to your restaurant.
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
  const msgs = ['Menu?', 'Do you have chicken?', 'How much delivery?', '2 burgers', 'one without cheese', 'actually add fries', 'location?', 'how long?'];
  return (
    <section className="section">
      <div className="wrap grid" style={{ ['--min' as string]: '460px', gap: 'clamp(40px,6vw,88px)', alignItems: 'center' }}>
        <div>
          <h2 className="h2">Your customers already order on WhatsApp.</h2>
          <p style={{ fontSize: 'clamp(22px,2.2vw,28px)', lineHeight: 1.3, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 24, maxWidth: 480, textWrap: 'pretty' }}>
            Lumia handles the conversation. Your team handles the food.
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
              <span className="eyebrow-bar" />Organized by Lumia
            </div>
            <div className="card tabnum" style={{ padding: 20 }}>
              <div className="item" style={{ fontSize: 15 }}><span className="item__qty" style={{ width: 26 }}>2×</span><span>Chicken Burger</span></div>
              <div className="item__mod" style={{ paddingInlineStart: 36 }}>– 1 × No cheese</div>
              <div className="item" style={{ fontSize: 15, marginTop: 10 }}><span className="item__qty" style={{ width: 26 }}>1×</span><span>Fries</span></div>
              <div className="dashed" style={{ margin: '14px 0 10px' }} />
              <div className="row-between" style={{ fontSize: 15 }}><span className="muted">Delivery</span><span><Aed n={8} /></span></div>
              <div className="note note--ok" style={{ marginTop: 14, padding: '9px 12px' }}>Customer confirmed ✓</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Ownership() {
  const perks = ['Your WhatsApp', 'Your customer relationship', 'Your menu', 'Your delivery rules', 'Your brand', '0% Lumia commission per order'];
  return (
    <section className="section section--soft">
      <div className="wrap">
        <h2 className="h2" style={{ maxWidth: 820 }}>Your customers stay your customers.</h2>
        <div className="grid" style={{ gap: 'clamp(24px,3vw,40px)', marginTop: 'clamp(40px,5vw,60px)', alignItems: 'start' }}>
          <div className="flow">
            <div className="eyebrow" style={{ marginBottom: 18 }}>Traditional marketplace</div>
            <div className="flow__node">Customer</div>
            <div className="flow__link" />
            <div className="flow__node flow__node--mid">Marketplace</div>
            <div className="flow__link" />
            <div className="flow__node">Restaurant</div>
          </div>
          <div className="flow">
            <div className="eyebrow" style={{ marginBottom: 18, color: 'var(--ink)' }}>Lumia Order</div>
            <div className="flow__node flow__node--brand">Customer</div>
            <div className="flow__link flow__link--brand" style={{ background: 'linear-gradient(#FF5577,#E449B8)' }} />
            <div className="flow__node flow__node--brand">Your WhatsApp</div>
            <div className="flow__link flow__link--brand" style={{ background: 'linear-gradient(#E449B8,#C93DFF)' }} />
            <div className="flow__node flow__node--brand">Your Restaurant</div>
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

export function HowItWorks() {
  return (
    <section id="how" className="section">
      <div className="wrap">
        <div className="eyebrow eyebrow--lg">How it works</div>
        <h2 className="h2" style={{ marginTop: 14, maxWidth: 760 }}>From message to kitchen in four steps.</h2>
        <div className="how__bar" />
        <div className="grid">
          <Step n="01" color="#FF5577" title="Customer messages" text="Text or voice through WhatsApp.">
            <div className="how__demo">
              <div className="bubble">2 chicken burgers please</div>
              <div className="bubble" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span className="tri" style={{ borderColor: 'transparent transparent transparent var(--ink)', marginInlineStart: 0 }} />
                <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {[8, 14, 10, 16, 7, 12].map((h, i) => <span key={i} style={{ width: 2, height: h, background: '#5E7A58' }} />)}
                </span>
                <span className="mono" style={{ fontSize: 11 }}>0:13</span>
              </div>
            </div>
          </Step>
          <Step n="02" color="#EE4F97" title="Lumia understands" text="Lumia identifies every part of the order.">
            <div className="tags" style={{ marginTop: 20 }}>
              {['Products', 'Quantities', 'Variants', 'Modifiers', 'Delivery information'].map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          </Step>
          <Step n="03" color="#DC46C6" title="Customer confirms" text="Lumia sends the complete order and total. The customer confirms before submission.">
            <div className="how__demo">
              <div className="bubble bubble--in" style={{ border: '1px solid var(--line)' }}>Total <Aed n={82} />. Confirm?</div>
              <div className="bubble">Yes ✓</div>
            </div>
          </Step>
          <Step n="04" color="#C93DFF" title="Restaurant receives it" text="The confirmed order appears instantly. Accept or reject and select the ETA." last>
            <div className="how__demo" style={{ gap: 6 }}>
              <span className="tag" style={{ background: 'var(--grad)', color: '#fff', fontWeight: 500, padding: '7px 12px' }}>Lumia Order Terminal · recommended</span>
              <span className="tag" style={{ background: 'none', border: '1px solid var(--line-2)', padding: '7px 12px' }}>Web Dashboard</span>
            </div>
          </Step>
        </div>
      </div>
    </section>
  );
}

function Step({ n, color, title, text, last, children }: { n: string; color: string; title: string; text: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className="how__step" style={last ? { paddingInlineEnd: 0 } : undefined}>
      <div className="how__node" style={{ background: color }} />
      <div className="how__num">{n}</div>
      <h3 className="h3" style={{ marginTop: 8 }}>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

export function Voice() {
  // 0 = idle, 1 = transcribed, 2 = structured (3 = resting state, everything shown)
  const [stage, setStage] = useState(3);
  const [pos, setPos] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const play = () => {
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

  return (
    <section className="section section--soft">
      <div className="wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <h2 className="h2" style={{ fontSize: 'clamp(40px,6vw,80px)', letterSpacing: '-0.045em', lineHeight: 1 }}>
            They can say it.<br /><span className="grad-text">Lumia</span> can order it.
          </h2>
          <button className="btn btn--ghost" style={{ height: 48, padding: '0 20px', fontSize: 15 }} onClick={play}>
            ▶ Play voice message
          </button>
        </div>

        <div className="grid" style={{ ['--min' as string]: '300px', gap: 'clamp(16px,2vw,28px)', marginTop: 'clamp(40px,5vw,60px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">01 · WhatsApp voice message</div>
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
          <div className={fade(stage >= 1)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">02 · Transcription</div>
            <p style={{ fontSize: 'clamp(20px,2vw,24px)', lineHeight: 1.45, letterSpacing: '-0.01em', textWrap: 'pretty' }}>
              "Give me <span className="hl" style={{ background: 'rgba(255,85,119,.22)' }}>two spicy chicken burgers</span>,{' '}
              <span className="hl" style={{ background: 'rgba(228,73,184,.25)' }}>one without cheese</span>,{' '}
              <span className="hl" style={{ background: 'rgba(255,85,119,.22)' }}>fries</span> and{' '}
              <span className="hl" style={{ background: 'rgba(201,61,255,.25)' }}>three Pepsi</span>."
            </p>
          </div>
          <div className={fade(stage >= 2)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">03 · Structured Lumia Order</div>
            <div className="card" style={{ borderRadius: 18, padding: 20, fontSize: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div className="item"><span className="item__qty">2×</span><span>Spicy Chicken Burger</span></div>
                <div className="item__mod" style={{ fontSize: 14 }}>– 1 × No cheese</div>
              </div>
              <div className="item"><span className="item__qty">1×</span><span>Fries</span></div>
              <div className="item"><span className="item__qty">3×</span><span>Pepsi</span></div>
            </div>
          </div>
        </div>

        <div className="grid" style={{ ['--min' as string]: '300px', marginTop: 'clamp(40px,5vw,56px)', paddingTop: 'clamp(28px,3vw,36px)', borderTop: '1px solid var(--line-2)', gap: 'clamp(16px,2vw,28px)', alignItems: 'center' }}>
          <div>
            <div className="eyebrow">Built for the Gulf</div>
            <p style={{ fontSize: 18, lineHeight: 1.5, marginTop: 10, maxWidth: 360, textWrap: 'pretty' }}>
              Customers mix Arabic and English in one message. The order comes out the same.
            </p>
          </div>
          <div dir="rtl" lang="ar" style={{ justifySelf: 'start', background: 'var(--wa)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', fontFamily: "'Cairo',sans-serif", fontSize: 18, lineHeight: 1.6, maxWidth: 380 }}>
            مرحبا، بدي 2 chicken burger، واحد بدون pickles، و large fries.
          </div>
          <div className="card" style={{ borderRadius: 18, padding: '18px 20px', fontSize: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div className="item"><span className="item__qty">2×</span><span>Chicken Burger</span></div>
              <div className="item__mod" style={{ fontSize: 14 }}>– 1 × No pickles</div>
            </div>
            <div className="item"><span className="item__qty">1×</span><span>Large Fries</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Menu() {
  const [approved, setApproved] = useState(true);
  return (
    <section className="section">
      <div className="wrap">
        <div className="split">
          <h2 className="h2">Your menu. Your prices. Your rules.</h2>
          <div>
            <p style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>AI doesn't invent your menu.</p>
            <p className="lead" style={{ fontSize: 17, marginTop: 10 }}>
              Lumia works from the restaurant's approved products, prices, options and availability.
            </p>
          </div>
        </div>
        <div className="grid menu-card">
          <div>
            <div className="eyebrow">01 · UPLOAD</div>
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="mono" style={{ fontSize: 11, padding: 8, borderRadius: 6, background: 'var(--chip)', color: '#8A2040' }}>PDF</span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>MENU.PDF</span>
            </div>
            <small>PDF, Excel or a photo of your menu.</small>
          </div>
          <div>
            <div className="eyebrow">02 · LUMIA EXTRACTS CATEGORIES</div>
            <div className="tags" style={{ marginTop: 18 }}>
              {['Burgers', 'Pizza', 'Drinks', 'Sides'].map((t) => <span key={t} className="tag tag--soft">{t}</span>)}
            </div>
          </div>
          <div>
            <div className="eyebrow">03 · PRODUCTS · PRICES · MODIFIERS</div>
            <div className="tabnum" style={{ display: 'flex', flexDirection: 'column', marginTop: 12, fontSize: 14 }}>
              <div className="price-row"><span>Chicken Burger</span><span><Aed n={25} /></span></div>
              <div className="price-row"><span>Beef Burger</span><span><Aed n={29} /></span></div>
              <div className="price-row"><span>Fries</span><span><Aed n={12} /></span></div>
            </div>
            <div className="tags" style={{ gap: 5, marginTop: 10 }}>
              {['No pickles', 'Spicy', 'Large'].map((t) => (
                <span key={t} className="tag tag--soft" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6 }}>{t}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow">04 · RESTAURANT REVIEWS</div>
            <button
              onClick={() => setApproved((a) => !a)}
              aria-pressed={approved}
              style={{
                marginTop: 18, height: 48, borderRadius: 12, fontWeight: 600, fontSize: 15,
                background: approved ? 'var(--ok-bg)' : 'var(--grad)', color: approved ? 'var(--ok)' : '#fff',
                transition: 'background .25s, color .25s',
              }}
            >
              {approved ? 'APPROVED ✓' : 'Approve menu'}
            </button>
            <small style={{ marginTop: 10 }}>Lumia goes live only after you approve.</small>
          </div>
        </div>
      </div>
    </section>
  );
}
