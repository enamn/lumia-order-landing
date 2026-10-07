import { LogoMark } from './Logo';
import './terminal.css';
import { Aed } from './Money';

export type TerminalScreen = 'boot' | 'ready' | 'new' | 'new2' | 'eta' | 'accepted';

/**
 * Optional product photo of the terminal. When set (e.g. '/assets/lumia-terminal.png'),
 * it replaces the CSS-drawn hardware; the live screen and receipt still render on top.
 */
const TERMINAL_PHOTO: string | null = null;

type Props = {
  screen?: TerminalScreen;
  eta?: number | null;
  ring?: boolean;
  receipt?: boolean;
};

export function Terminal({ screen = 'ready', eta = null, ring = false, receipt = false }: Props) {
  const etaLabel = `${eta ?? 45} min`;

  return (
    <div className="term" role="img" aria-label={`Lumia Order Terminal showing the ${screen} screen`}>
      <div className="term__ring" style={{ opacity: ring ? 1 : 0 }} />
      <div className="term__shadow" />

      {TERMINAL_PHOTO ? (
        <img className="term__photo" src={TERMINAL_PHOTO} alt="" />
      ) : (
        <>
          <div className="term__body" />
          <div className="term__head">
            <div className="term__panel">
              <LogoMark size={40} ink="#fff" />
              <div>
                <b>Lumia</b>
                <span>Order</span>
              </div>
            </div>
          </div>
          <div className="term__slot" />
          <div className="term__bezel" />
        </>
      )}

      <div className="term__screen">
        <div className="term__scale">
          <div className="ts">
            <div className="ts__status">
              <span>21:05</span>
              <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3CC48A' }} />
                <span className="ts__batt"><i /></span>
              </span>
            </div>
            <ScreenContent screen={screen} eta={eta} etaLabel={etaLabel} />
            <div className="ts__glare" />
          </div>
        </div>
      </div>

      <div className="term__receipt-wrap">
        <div className="term__receipt-clip" style={{ height: receipt ? 216 : 0 }}>
          <div className="term__receipt">
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '-0.02em' }}>Lumia Order</div>
            <div style={{ fontSize: 10, fontWeight: 500 }}>#1048 · Samer</div>
            <hr />
            <div>2 x Chicken Burger</div>
            <div style={{ paddingInlineStart: 10 }}>1 x No pickles</div>
            <div>1 x Large Fries</div>
            <div>2 x Coca-Cola</div>
            <hr />
            <div className="row-between" style={{ fontWeight: 500 }}>
              <span>TOTAL</span>
              <span><Aed n={82} fixed /></span>
            </div>
            <div>ETA {etaLabel}</div>
          </div>
        </div>
      </div>
      <div className="term__lip" style={{ opacity: receipt ? 1 : 0 }} />
    </div>
  );
}

function ScreenContent({ screen, eta, etaLabel }: { screen: TerminalScreen; eta: number | null; etaLabel: string }) {
  switch (screen) {
    case 'boot':
      return (
        <div className="ts__center" style={{ gap: 16 }}>
          <LogoMark size={72} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0.95 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.035em' }}>Lumia</span>
            <span style={{ fontSize: 20, letterSpacing: '-0.01em' }}>Order</span>
          </div>
          <div style={{ width: 90, height: 3, borderRadius: 2, background: 'var(--line)', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: '45%', height: '100%', background: 'var(--grad)' }} />
          </div>
        </div>
      );

    case 'ready':
      return (
        <>
          <div className="row-between" style={{ alignItems: 'center', padding: '8px 0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <LogoMark size={20} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Burger House</span>
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--ok)' }}>Open</span>
          </div>
          <div className="ts__center">
            <div style={{ width: 84, height: 84, borderRadius: '50%', padding: 3, background: 'var(--grad-diag)' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#3CC48A', boxShadow: '0 0 0 6px #E4F4EC' }} />
              </div>
            </div>
            <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 6 }}>Ready for orders</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45, maxWidth: 190 }}>
              Orders appear here after the customer confirms.
            </div>
          </div>
          <div
            className="row-between"
            style={{ background: '#fff', borderRadius: 12, padding: '10px 12px', fontSize: 11.5, boxShadow: '0 1px 0 rgba(26,8,21,.04),0 8px 18px -12px rgba(120,20,80,.35)' }}
          >
            <span><span className="mono">#1047</span> · Accepted</span>
            <span className="muted">12 min ago</span>
          </div>
        </>
      );

    case 'new':
      return (
        <>
          <div className="ts__banner">
            <span style={{ fontSize: 11, letterSpacing: '.08em', fontWeight: 500, whiteSpace: 'nowrap' }}>🔊 NEW ORDER</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>#1048</span>
          </div>
          <div className="ts__label" style={{ marginTop: 12 }}>Customer</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Samer</div>
          <div className="ts__label" style={{ marginTop: 10 }}>Order</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div>2 × Chicken Burger</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', paddingInlineStart: 14 }}>1 × No pickles</div>
            <div>1 × Large Fries</div>
            <div>2 × Coca-Cola</div>
          </div>
          <div className="dashed" style={{ margin: '8px 0' }} />
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <span className="ts__label">Total</span>
            <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em' }}><Aed n={82} fixed /></span>
          </div>
          <div className="ts__label" style={{ marginTop: 6 }}>Delivery</div>
          <div style={{ fontSize: 12.5 }}>Al Majaz 2, Sharjah</div>
          <div className="ts__actions" style={{ marginTop: 'auto' }}>
            <div className="ts__btn ts__btn--line" style={{ height: 52 }}>REJECT</div>
            <div className="ts__btn ts__btn--grad" style={{ height: 52 }}>ACCEPT</div>
          </div>
        </>
      );

    case 'new2':
      return (
        <>
          <div className="ts__banner">
            <span style={{ fontSize: 11, letterSpacing: '.08em', fontWeight: 500, whiteSpace: 'nowrap' }}>🔊 NEW ORDER</span>
            <span style={{ fontSize: 11, opacity: 0.9 }}>now</span>
          </div>
          <div className="ts__center" style={{ gap: 6 }}>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'var(--muted)' }}>#1052</div>
            <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}><Aed n={96} /></div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Customer confirmed on WhatsApp</div>
          </div>
          <div className="ts__actions">
            <div className="ts__btn ts__btn--line" style={{ height: 56, fontSize: 14, letterSpacing: 0 }}>Reject</div>
            <div className="ts__btn ts__btn--grad" style={{ height: 56, fontSize: 14, letterSpacing: 0 }}>Accept</div>
          </div>
        </>
      );

    case 'eta':
      return (
        <>
          <div
            className="row-between"
            style={{ margin: '0 -14px', padding: '11px 14px', background: '#fff', borderBottom: '1px solid var(--line-3)', alignItems: 'center', fontSize: 12.5 }}
          >
            <span><span className="mono" style={{ fontWeight: 500 }}>#1048</span> · Samer</span>
            <span style={{ fontWeight: 600 }}><Aed n={82} fixed /></span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 18 }}>Choose ETA</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Sent to the customer on WhatsApp.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {[30, 45, 60].map((n) => (
              <div key={n} className={`ts__eta${eta === n ? ' is-on' : ''}`}>{n} min</div>
            ))}
          </div>
          <div className="ts__btn ts__btn--grad" style={{ marginTop: 'auto', height: 54, letterSpacing: '.08em' }}>CONFIRM</div>
        </>
      );

    case 'accepted':
      return (
        <>
          <div className="ts__center">
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--ok-bg)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 600 }}>✓</div>
            <div className="mono" style={{ fontSize: 14, letterSpacing: '.14em', fontWeight: 500, marginTop: 6 }}>ORDER ACCEPTED</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>#1048 · ETA {etaLabel}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Customer notified automatically.</div>
          </div>
          <div className="ts__btn ts__btn--line" style={{ height: 44, border: '1px solid var(--line-2)', fontSize: 12.5, fontWeight: 500, letterSpacing: 0 }}>
            Back to orders
          </div>
        </>
      );
  }
}

/** Terminal scaled down inside a centered stage (the design reuses it at several sizes). */
export function ScaledTerminal({ scale, offsetTop = 0, extraTransform = '', ...props }: Props & { scale: number; offsetTop?: number; extraTransform?: string }) {
  return (
    <div className="stage-box__center" style={extraTransform ? { perspective: 1100 } : undefined}>
      <div style={{ transform: `scale(${scale}) ${extraTransform}`, transformOrigin: 'top center', marginTop: offsetTop, height: 704 }}>
        <Terminal {...props} />
      </div>
    </div>
  );
}
