import { useState } from 'react';
import { LogoMark } from '../components/Logo';

type DashState = 'new' | 'eta' | 'done' | 'rejected';

const CHIP: Record<DashState, [string, string, string]> = {
  new: ['NEW', '#FF9B3D', '#1A0815'],
  eta: ['NEW', '#FF9B3D', '#1A0815'],
  done: ['ACCEPTED', '#E4F4EC', '#16704A'],
  rejected: ['REJECTED', '#F3EEF1', '#8A5A6E'],
};

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={`toggle${on ? ' is-on' : ''}`} onClick={onClick} role="switch" aria-checked={on} aria-label={label} />;
}

export function Dashboard() {
  const [dash, setDash] = useState<DashState>('new');
  const [eta, setEta] = useState<number | null>(null);
  const [accepting, setAccepting] = useState(true);
  const [avail, setAvail] = useState([
    { name: 'Chicken Burger', on: true },
    { name: 'Beef Burger', on: false },
    { name: 'Fries', on: true },
  ]);

  const isPending = dash === 'new' || dash === 'eta';
  const tabs: [string, number][] = [
    ['NEW', isPending ? 2 : 1],
    ['ACCEPTED', dash === 'done' ? 2 : 1],
    ['PREPARING', 1],
    ['COMPLETED', 2],
  ];
  const [chip, chipBg, chipFg] = CHIP[dash];
  const selRing = dash === 'done' ? '#3CC48A' : dash === 'rejected' ? '#E3CBD4' : '#FF5577';
  const stateLabel = { new: 'New', eta: 'New', done: `Accepted · ${eta} min`, rejected: 'Rejected' }[dash];

  return (
    <section className="section section--soft" style={{ paddingBlock: 'clamp(72px,10vw,120px)' }}>
      <div className="wrap">
        <div className="split">
          <h2 className="h2">You're always in control.</h2>
          <p className="lead">Orders, availability and delivery rules in one dashboard. Accept order #1048 below to try it.</p>
        </div>

        <div className="dash">
          <div className="dash__top">
            <LogoMark size={24} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>Burger House</span>
            <span className="muted" style={{ fontSize: 13 }}>Al Majaz, Sharjah</span>
            <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {isPending && <span className="dash__alert">🔊 New Order Alert</span>}
              <button className="dash__reset" onClick={() => { setDash('new'); setEta(null); }}>RESET</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <nav className="dash__side" aria-label="Dashboard">
              {['Orders', 'Menu', 'Customers', 'Delivery', 'Settings'].map((n, i) => (
                <div key={n} className={i === 0 ? 'is-on' : ''}>{n}</div>
              ))}
            </nav>

            <div className="dash__main">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tabs.map(([label, n], i) => (
                  <div key={label} className={`dash__tab${i === 0 ? ' is-on' : ''}`}>{label}<b>{n}</b></div>
                ))}
              </div>
              <div className="grid tabnum" style={{ ['--min' as string]: '220px', gap: 14, marginTop: 16, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="ocard" style={{ boxShadow: `0 0 0 2px ${selRing}` }}>
                    <div className="row-between"><span className="mono" style={{ fontWeight: 500 }}>#1048</span><span style={{ fontWeight: 600 }}>AED 82</span></div>
                    <div className="muted" style={{ marginTop: 4 }}>Samer · {stateLabel}</div>
                  </div>
                  <div className="ocard">
                    <div className="row-between"><span className="mono">#1049</span><span style={{ fontWeight: 600 }}>AED 46</span></div>
                    <div className="muted" style={{ marginTop: 4 }}>Fatima · New</div>
                  </div>
                  <div className="ocard muted">
                    <div className="row-between"><span className="mono">#1046</span><span>AED 58</span></div>
                    <div style={{ marginTop: 4 }}>Omar · Preparing</div>
                  </div>
                </div>

                <div className="odetail">
                  <div className="row-between" style={{ alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>#1048</span>
                    <span className="ochip" style={{ background: chipBg, color: chipFg }}>{chip}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 17, marginTop: 12 }}>Samer</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.6 }}>
                    2 Chicken Burgers<br />1 Fries<br />2 Coca-Cola
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 10 }}>AED 82</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Delivery</div>
                  <div style={{ fontSize: 14 }}>Al Majaz 2, Sharjah</div>

                  {dash === 'new' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                      <button className="obtn obtn--line" onClick={() => setDash('rejected')}>Reject</button>
                      <button className="obtn btn--primary" onClick={() => { setDash('eta'); setEta(null); }}>Accept</button>
                    </div>
                  )}
                  {dash === 'eta' && (
                    <div style={{ marginTop: 16 }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Select ETA</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                        {[30, 45, 60].map((n) => (
                          <button key={n} className={`obtn obtn--eta${eta === n ? ' is-on' : ''}`} onClick={() => setEta(n)} aria-pressed={eta === n}>
                            {n} min
                          </button>
                        ))}
                      </div>
                      <button
                        className="obtn"
                        disabled={!eta}
                        onClick={() => eta && setDash('done')}
                        style={{ width: '100%', marginTop: 8, background: eta ? 'var(--grad)' : 'var(--wa-bg)', color: eta ? '#fff' : 'var(--muted)', cursor: eta ? 'pointer' : 'not-allowed' }}
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                  {dash === 'done' && <div className="note note--ok">✓ Accepted · ETA {eta} min · Customer notified</div>}
                  {dash === 'rejected' && <div className="note note--off">Rejected · Samer was notified on WhatsApp</div>}
                </div>
              </div>
            </div>

            <div className="dash__panel">
              <div className="eyebrow">RESTAURANT STATUS</div>
              <div className="dash__line" style={{ padding: '10px 0 14px' }}>
                <span style={{ fontWeight: 500 }}>Accepting orders</span>
                <Toggle on={accepting} onClick={() => setAccepting((a) => !a)} label="Toggle accepting orders" />
              </div>
              <div className="eyebrow" style={{ marginTop: 16 }}>MENU AVAILABILITY</div>
              {avail.map((it, i) => (
                <div key={it.name} className="dash__line">
                  <div>
                    <div style={{ fontWeight: 500 }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: it.on ? 'var(--ok)' : 'var(--muted)' }}>{it.on ? 'Available' : 'Sold Out'}</div>
                  </div>
                  <Toggle
                    on={it.on}
                    label={`Toggle ${it.name} availability`}
                    onClick={() => setAvail((list) => list.map((a, j) => (j === i ? { ...a, on: !a.on } : a)))}
                  />
                </div>
              ))}
              <div className="eyebrow" style={{ marginTop: 16 }}>DELIVERY AREAS</div>
              <div className="price-row"><span>Sharjah</span><span style={{ fontWeight: 500 }}>AED 8</span></div>
              <div className="price-row"><span>Ajman</span><span style={{ fontWeight: 500 }}>AED 12</span></div>
              <div className="price-row muted" style={{ borderBottom: 0 }}><span>Dubai</span><span>Not available</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <div className="mini">
                  <div className="muted" style={{ fontSize: 11.5 }}>Minimum Order</div>
                  <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>AED 40</div>
                </div>
                <div className="mini">
                  <div className="muted" style={{ fontSize: 11.5 }}>Payment</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>Cash on Delivery ✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid" style={{ ['--min' as string]: '360px', marginTop: 'clamp(28px,3vw,40px)', gap: '20px 48px', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 'clamp(24px,2.4vw,30px)', fontWeight: 600, letterSpacing: '-0.03em' }}>Make repeat orders easier.</h3>
            <p className="lead" style={{ fontSize: 16, marginTop: 10, maxWidth: 460 }}>
              With confirmed customer information, Lumia can make future orders faster. It always asks before reusing a saved address.
            </p>
          </div>
          <div style={{ background: 'var(--wa-bg)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: 12, padding: '8px 12px' }}>Welcome back, Samer 👋</div>
            <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: 12, padding: '8px 12px', maxWidth: '90%' }}>
              Would you like delivery to your previously confirmed address in Al Majaz?
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
