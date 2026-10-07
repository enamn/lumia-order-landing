import { useState } from 'react';
import { Terminal } from '../components/Terminal';
import { PLANS, SIGNUP_URL, TERMINAL_PRICES, type Billing, type Plan } from '../data';
import { money, usePriceInfo, type PriceInfo } from '../pricing';

export function Pricing() {
  const [billing, setBilling] = useState<Billing>('yearly');
  const info = usePriceInfo();

  return (
    <section id="pricing" className="section section--soft">
      <div className="wrap">
        <div className="split">
          <div>
            <div className="eyebrow eyebrow--lg">Pricing</div>
            <h2 className="h2" style={{ marginTop: 14 }}>Simple plans. 0% commission.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div className="billing" role="tablist" aria-label="Billing period">
              <button role="tab" aria-selected={billing === 'monthly'} className={billing === 'monthly' ? 'is-on' : ''} onClick={() => setBilling('monthly')}>
                Monthly
              </button>
              <button role="tab" aria-selected={billing === 'yearly'} className={billing === 'yearly' ? 'is-on' : ''} onClick={() => setBilling('yearly')} style={{ paddingInlineEnd: 14 }}>
                Yearly<span className="pill-ok">Save 2 months</span>
              </button>
            </div>
            <div className="muted" style={{ fontSize: 14 }}>0% commission on orders · AI ordering included, subject to fair-use terms</div>
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{priceNote(info)}</div>
          </div>
        </div>

        <div className="grid" style={{ ['--min' as string]: '320px', gap: 16, marginTop: 'clamp(32px,4vw,48px)', alignItems: 'stretch' }}>
          {PLANS.map((p) => <PlanCard key={p.name} plan={p} billing={billing} info={info} />)}
        </div>

        <div className="grid" style={{ ['--min' as string]: '300px', marginTop: 16, background: '#fff', border: '1px solid var(--line)', borderRadius: 24, padding: 'clamp(24px,3vw,32px)', gap: '28px 48px', alignItems: 'start' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ flex: 'none', width: 84, height: 150, position: 'relative', overflow: 'hidden' }} aria-hidden="true">
              <div style={{ position: 'absolute', top: -18, left: '50%', marginLeft: -150, transform: 'scale(.28)', transformOrigin: 'top center', height: 704 }}>
                <Terminal screen="new2" />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 21, fontWeight: 600 }}>Lumia Order Terminal</span>
                <span className="badge">RECOMMENDED</span>
              </div>
              <div className="price-strike" style={{ marginTop: 12 }}>AED 699</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="price-big" style={{ fontSize: 'clamp(32px,3.2vw,40px)' }}>AED 599</span>
                <span className="pill-ok">Launch offer</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5 }}>
                One-time device price. Optional: every plan works with the web dashboard.
              </div>
            </div>
          </div>
          <div>
            <div className="eyebrow">Terminal price with a {billing} plan</div>
            <div className="tabnum" style={{ marginTop: 10, borderTop: '1px solid var(--line)' }}>
              {TERMINAL_PRICES[billing].map(([plan, price]) => (
                <div key={plan} className="tprice-row">
                  <span>{plan}</span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span className="muted" style={{ fontSize: 13, textDecoration: 'line-through' }}>AED 699</span>
                    <span style={{ fontWeight: 600 }}>{price}</span>
                  </span>
                </div>
              ))}
              <div className="tprice-row"><span>Additional terminal</span><span style={{ fontWeight: 600 }}>AED 599</span></div>
              <div className="tprice-row" style={{ borderBottom: 0 }}>
                <span>Multi-branch deployments</span>
                <a href="#contact" style={{ fontWeight: 600, color: 'var(--violet)' }}>Contact sales</a>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>
              <b style={{ fontWeight: 600 }}>Estimated delivery: 10–15 business days</b>
              <div className="muted">Delivery time may vary depending on stock availability.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// What the note under the toggle says: where the prices come from, and what is not open yet.
function priceNote(info: PriceInfo | null) {
  if (info?.local) return `Prices in ${info.currency} for ${info.countryName}. Terminal prices are in UAE dirhams (AED).${info.paidOpen ? '' : ` Paid plans in ${info.countryName} open soon: you can start your free trial now.`}`;
  if (info && info.detected && info.detected !== 'AE' && info.countryName !== 'United Arab Emirates') return `Prices in UAE dirhams (AED). Local-currency plans for ${info.countryName} are coming soon.`;
  return 'Prices in UAE dirhams (AED). Saudi Arabia, Oman, Bahrain, Qatar and Kuwait: local-currency plans are coming soon.';
}

function PlanCard({ plan, billing, info }: { plan: Plan; billing: Billing; info: PriceInfo | null }) {
  // Amounts in the visitor's currency when approved prices exist for it; otherwise the AED list price.
  const key = plan.name.toLowerCase() as 'starter' | 'plus' | 'pro', local = info?.local ? info.plans[key] : null;
  const cur = local && info ? info.currency : 'AED', dec = local && info ? info.decimals : 2;
  const m = local ? local.monthly : plan.amounts.month, y = local ? local.yearly : plan.amounts.year;
  const price = { month: money(m, cur, dec), year: money(y, cur, dec), strike: money(m * 12, cur, dec), perMonth: money(Math.round(y / 12), cur, dec) };
  return (
    <div className={`plan${plan.highlight ? ' gradient-border' : ''}`}>
      <div className="row-between" style={{ alignItems: 'center', gap: 8 }}>
        <span className="plan__name">{plan.name}</span>
        {plan.highlight && <span className="badge">{plan.highlight}</span>}
      </div>
      <p className="plan__desc">{plan.description}</p>

      <div className="plan__price tabnum">
        {billing === 'yearly' ? (
          <>
            <div className="price-strike">{price.strike}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="price-big">{price.year}</span><span className="plan__per">/ year</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--ink-2)' }}>≈ {price.perMonth}/month, billed annually</span>
              <span className="pill-ok">Save 2 months</span>
            </div>
          </>
        ) : (
          <>
            <div className="price-strike" style={{ visibility: 'hidden' }} aria-hidden="true">·</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="price-big">{price.month}</span><span className="plan__per">/ month</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>Billed monthly</div>
          </>
        )}
      </div>

      <div className="plan__rule" style={plan.inherits ? { marginBottom: 0 } : undefined} />
      {plan.inherits && <div style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 10px' }}>{plan.inherits}</div>}
      <div className="plan__features">
        {plan.features.map((f) => (
          <div key={f}><span className="check">✓</span><span>{f}</span></div>
        ))}
      </div>
      <div className="plan__cta">
        <a href={SIGNUP_URL} className="btn btn--primary btn--md btn--block" data-track={/free/i.test(plan.cta) ? 'free_trial' : 'signup'} data-loc={`plan:${plan.name.toLowerCase()}`}>{plan.cta}</a>
      </div>
    </div>
  );
}
