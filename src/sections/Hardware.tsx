import { ScaledTerminal, Terminal } from '../components/Terminal';
import { TERMINAL_SPECS } from '../data';
import { money, terminalOf, usePriceInfo } from '../pricing';

const FLOW: [string, boolean][] = [
  ['Customer orders on WhatsApp', false],
  ['Lumia Order AI understands and confirms the order', false],
  ['The restaurant receives the order on the Lumia Order Terminal', true],
  ['Staff accepts or rejects the order', false],
  ['Receipt prints automatically', true],
  ['Kitchen starts preparation', false],
];

export function TerminalIntro() {
  const info = usePriceInfo(), term = terminalOf(info);
  return (
    <section id="terminal" className="section">
      <div className="wrap grid" style={{ ['--min' as string]: '420px', gap: 'clamp(48px,6vw,88px)', alignItems: 'center' }}>
        <div style={{ justifySelf: 'center', width: 300, maxWidth: '100%', borderRadius: 28, background: 'var(--soft)', padding: '20px 0 12px', overflow: 'hidden' }}>
          <Terminal screen="accepted" eta={45} receipt />
        </div>
        <div>
          <span className="badge" style={{ fontSize: 11, letterSpacing: '.16em' }}>RECOMMENDED FOR RESTAURANTS</span>
          <h2 className="h2" style={{ marginTop: 18 }}>Your dedicated Lumia Order Terminal</h2>
          <p className="lead" style={{ marginTop: 18, maxWidth: 520 }}>
            Receive, accept and print WhatsApp orders from one dedicated device — without relying on an employee's personal phone.
          </p>
          <ol className="tsteps" style={{ listStyle: 'none' }}>
            {FLOW.map(([text, key], i) => (
              <li key={text} className="tstep">
                <div className="tstep__rail">
                  <span className={`tstep__num${key ? ' is-key' : ''}`}>{i + 1}</span>
                  {i < FLOW.length - 1 && <span className="tstep__line" />}
                </div>
                <span className="tstep__text" style={key ? { fontWeight: 600 } : undefined}>{text}</span>
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 28px', marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
            <div>
              {term ? (
                <>
                  {term.regular ? <div className="price-strike">{money(term.regular, term.currency, term.decimals)}</div> : null}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span className="price-big">{money(term.monthly, term.currency, term.decimals)}</span>
                    {term.regular ? <span className="pill-ok">Launch offer</span> : null}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 16, color: 'var(--ink-2)' }}>Terminal prices for {info?.countryName} are coming soon.</div>
              )}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)', maxWidth: 260 }}>
              {term ? <>From {money(term.yearly.pro, term.currency, term.decimals)} with a yearly Pro plan.<br /></> : null}Estimated delivery: 10–15 business days.
            </div>
          </div>
          <a href="#pricing" className="btn btn--primary btn--md" style={{ marginTop: 24 }}>See terminal pricing</a>
        </div>
      </div>
    </section>
  );
}

export function Device() {
  return (
    <section id="device" className="section section--soft">
      <div className="wrap">
        <div className="split" style={{ gap: '20px 64px' }}>
          <div>
            <div className="eyebrow">Hardware</div>
            <h2 className="h2" style={{ marginTop: 14 }}>Lumia Order Terminal</h2>
          </div>
          <p className="lead">
            A dedicated restaurant order-management terminal with an integrated thermal printer. Orders ring out loud, staff accept at the counter, and the receipt prints automatically. You can still manage everything from the web dashboard.
          </p>
        </div>

        <div className="grid" style={{ ['--min' as string]: '300px', gap: 20, marginTop: 'clamp(36px,4vw,52px)' }}>
          <figure>
            <div className="stage-box">
              <ScaledTerminal scale={0.62} offsetTop={-20} screen="new2" ring />
            </div>
            <figcaption className="eyebrow" style={{ marginTop: 14 }}>Front</figcaption>
          </figure>
          <figure>
            <div className="stage-box" style={{ background: 'radial-gradient(70% 60% at 50% 40%,#fff 0%,#F7EEF4 100%)' }}>
              <ScaledTerminal scale={0.62} offsetTop={-10} extraTransform="rotateY(-28deg) rotateX(6deg)" screen="ready" />
            </div>
            <figcaption className="eyebrow" style={{ marginTop: 14 }}>3/4 view</figcaption>
          </figure>
          <figure>
            <div className="stage-box" style={{ background: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#F4EBEF 0%,#EFE3E9 64%,#D9CCC6 64%,#CDBFB9 100%)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: '64%', height: 6, background: 'rgba(255,255,255,.55)' }} />
              <ScaledTerminal scale={0.52} offsetTop={28} screen="accepted" eta={45} receipt />
            </div>
            <figcaption className="eyebrow" style={{ marginTop: 14 }}>At the counter</figcaption>
          </figure>
        </div>

        <div className="grid" style={{ ['--min' as string]: '240px', gap: '0 24px', marginTop: 'clamp(32px,4vw,48px)' }}>
          {TERMINAL_SPECS.map((s) => (
            <div key={s} className="spec"><span className="check">✓</span>{s}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Channels() {
  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2">Run Lumia Order your way.</h2>
        <div className="grid" style={{ ['--min' as string]: '340px', gap: 20, marginTop: 'clamp(36px,4vw,52px)', maxWidth: 960 }}>
          <div className="channel gradient-border">
            <div className="channel__art" style={{ background: 'var(--soft)' }}>
              <ScaledTerminal scale={0.4} offsetTop={4} screen="new2" receipt />
            </div>
            <div className="channel__head">
              <h3 className="h3">Lumia Order Terminal</h3>
              <span className="badge">RECOMMENDED</span>
            </div>
            <p>The recommended way to receive and manage orders. A dedicated device with loud alerts and built-in receipt printing.</p>
          </div>

          <div className="channel channel--plain">
            <div className="channel__art" style={{ background: 'var(--tint-2)' }}>
              <BrowserMock />
            </div>
            <div className="channel__head">
              <h3 className="h3">Web Dashboard</h3>
              <span className="badge" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>EVERY PLAN</span>
            </div>
            <p>
              Runs in any browser, including on mobile. Menu, restaurant information, delivery areas and fees, opening hours, order and customer history, analytics, staff, WhatsApp configuration, terminal management, billing and settings.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrowserMock() {
  const orders: [string, string, string, boolean][] = [
    ['#1048', 'AED 82', 'Samer · New', true],
    ['#1047', 'AED 64', 'Noura · Accepted', false],
    ['#1046', 'AED 58', 'Omar · Preparing', false],
  ];
  return (
    <div style={{ position: 'absolute', inset: '16px 16px 0', background: '#fff', borderRadius: '12px 12px 0 0', border: '1px solid var(--line)', borderBottom: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#EAD9E1' }} />)}
        <span className="muted" style={{ marginInlineStart: 8, fontSize: 10 }}>app.lumiaorder.com</span>
      </div>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ flex: '0 0 84px', padding: '10px 6px', borderInlineEnd: '1px solid var(--line-3)', fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {['Orders', 'Menu', 'Customers', 'Delivery', 'Settings'].map((n, i) => (
            <div key={n} style={i === 0 ? { padding: '5px 7px', borderRadius: 6, background: 'var(--tint)', fontWeight: 600 } : { padding: '5px 7px', color: 'var(--muted)' }}>{n}</div>
          ))}
        </div>
        <div className="tabnum" style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11 }}>
          {orders.map(([id, amt, who, sel]) => (
            <div key={id} style={{ borderRadius: 8, padding: 8, ...(sel ? { boxShadow: '0 0 0 1.5px #FF5577' } : { border: '1px solid var(--line-3)' }) }}>
              <div className="row-between"><span className="mono">{id}</span><b>{amt}</b></div>
              <div className="muted">{who}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
