import { useState } from 'react';
import { Terminal } from '../components/Terminal';
import { PLANS, PLANS_AR, SIGNUP_URL, type Billing, type Plan } from '../data';
import { terminalOf, usePriceInfo, type PriceInfo } from '../pricing';
import { Money } from '../components/Money';
import { useLang, useT } from '../i18n';

export function Pricing() {
  const t = useT(), { lang } = useLang();
  const [billing, setBilling] = useState<Billing>('yearly');
  const info = usePriceInfo(), term = terminalOf(info);
  const off = term && term.monthly > 0 ? Math.round((1 - Math.min(...Object.values(term.yearly)) / term.monthly) * 100) : 0;

  return (
    <section id="pricing" className="section section--soft">
      <div className="wrap">
        <div className="split">
          <div>
            <div className="eyebrow eyebrow--lg">{t('Pricing', 'الأسعار')}</div>
            <h2 className="h2" style={{ marginTop: 14 }}>{t('Simple plans. 0% commission.', 'باقات بسيطة. 0% عمولة.')}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div className="billing" role="tablist" aria-label={t('Billing period', 'مدة الفوترة')}>
              <button role="tab" aria-selected={billing === 'monthly'} className={billing === 'monthly' ? 'is-on' : ''} onClick={() => setBilling('monthly')}>
                {t('Monthly', 'شهري')}
              </button>
              <button role="tab" aria-selected={billing === 'yearly'} className={billing === 'yearly' ? 'is-on' : ''} onClick={() => setBilling('yearly')} style={{ paddingInlineEnd: 14 }}>
                {t('Yearly', 'سنوي')}<span className="pill-ok">{t('Save 2 months', 'وفّر شهرين')}</span>
              </button>
            </div>
            <div className="muted" style={{ fontSize: 14 }}>{t('0% commission on orders · AI ordering included, subject to fair-use terms', '0% عمولة على الطلبات · الطلب بالذكاء الاصطناعي مشمول وفق شروط الاستخدام العادل')}</div>
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{priceNote(info, lang)}</div>
          </div>
        </div>

        <div className="grid" style={{ ['--min' as string]: '300px', marginTop: 'clamp(32px,4vw,48px)', background: '#fff', border: '1px solid var(--line)', borderRadius: 24, padding: 'clamp(24px,3vw,32px)', gap: '28px 48px', alignItems: 'start' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ flex: 'none', width: 84, height: 150, position: 'relative', overflow: 'hidden' }} aria-hidden="true">
              <div style={{ position: 'absolute', top: -18, left: '50%', marginLeft: -150, transform: 'scale(.28)', transformOrigin: 'top center', height: 704 }}>
                <Terminal screen="new2" />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 21, fontWeight: 600 }}>{t('Lumia Order Terminal', 'جهاز لوميا أوردر')}</span>
                <span className="badge">{t('RECOMMENDED', 'موصى به')}</span>
              </div>
              {off > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span className="pill-ok" style={{ fontSize: 14 }}>{t(`Up to ${off}% off`, `خصم حتى ${off}%`)}</span>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{t('Subscribe yearly and get the terminal for less.', 'اشترك سنوياً واحصل على الجهاز بسعر أقل.')}</span>
                </div>
              )}
              <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, maxWidth: 520 }}>
                {t('A dedicated device that rings, accepts and prints every order. Optional: every plan also works with the web dashboard.', 'جهاز مخصص يرنّ ويقبل ويطبع كل طلب. اختياري: كل الباقات تعمل أيضاً مع لوحة التحكم على الويب.')}
              </div>
            </div>
          </div>
        </div>
        <div className="grid" style={{ ['--min' as string]: '320px', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
          {PLANS.map((p, i) => <PlanCard key={p.name} plan={lang === 'ar' ? { ...p, ...PLANS_AR[i] } : p} billing={billing} info={info} />)}
        </div>

      </div>
    </section>
  );
}

// What the note under the toggle says: where the prices come from, and what is not open yet.
function priceNote(info: PriceInfo | null, lang: 'en' | 'ar') {
  const ar = lang === 'ar';
  if (info?.local) return ar
    ? `الأسعار بعملة ${info.currency} لـ ${info.countryName}.${info.paidOpen ? '' : ` الباقات المدفوعة في ${info.countryName} تفتح قريباً: يمكنك بدء التجربة المجانية الآن.`}`
    : `Prices in ${info.currency} for ${info.countryName}.${info.paidOpen ? '' : ` Paid plans in ${info.countryName} open soon: you can start your free trial now.`}`;
  if (info && info.detected && info.detected !== 'AE' && info.countryName !== 'United Arab Emirates') return ar
    ? `الأسعار بالدرهم الإماراتي (AED). باقات العملة المحلية لـ ${info.countryName} قريباً.`
    : `Prices in UAE dirhams (AED). Local-currency plans for ${info.countryName} are coming soon.`;
  return ar
    ? 'الأسعار بالدرهم الإماراتي (AED). السعودية وعُمان والبحرين وقطر والكويت: باقات العملة المحلية قريباً.'
    : 'Prices in UAE dirhams (AED). Saudi Arabia, Oman, Bahrain, Qatar and Kuwait: local-currency plans are coming soon.';
}

function PlanCard({ plan, billing, info }: { plan: Plan; billing: Billing; info: PriceInfo | null }) {
  const t = useT();
  // Amounts in the visitor's currency when approved prices exist for it; otherwise the AED list price.
  const key = plan.name.toLowerCase() as 'starter' | 'plus' | 'pro', local = info?.local ? info.plans[key] : null;
  const cur = local && info ? info.currency : 'AED', dec = local && info ? info.decimals : 2;
  const m = local ? local.monthly : plan.amounts.month, y = local ? local.yearly : plan.amounts.year;
  // Prices in whole units show as such (KWD 209); only amounts with a fraction show decimals (KWD 12.9). The per-month price keeps the decimals it needs.
  const frac = !Number.isInteger(m) || !Number.isInteger(y), scale = 100, perMonth = frac ? Math.round((y / 12) * scale) / scale : Math.round(y / 12);
  const M = (n: number) => <Money n={Math.round(n * scale) / scale} cur={cur} dec={dec} />;
  const price = { month: M(m), year: M(y), strike: M(m * 12), perMonth: M(perMonth) };
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
            <div className="price-strike">{price.month}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="price-big">{price.perMonth}</span><span className="plan__per">{t('/ month', '/ شهر')}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--ink-2)' }}>{t(<>Billed yearly: {price.year}</>, <>تُدفع سنوياً: {price.year}</>)}</span>
              <span className="pill-ok">{t('Save 2 months', 'وفّر شهرين')}</span>
            </div>
          </>
        ) : (
          <>
            <div className="price-strike" style={{ visibility: 'hidden' }} aria-hidden="true">·</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="price-big">{price.month}</span><span className="plan__per">{t('/ month', '/ شهر')}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{t('Billed monthly', 'تُدفع شهرياً')}</div>
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
        <a href={SIGNUP_URL} className="btn btn--primary btn--md btn--block" data-track={/free|مجان/i.test(plan.cta) ? 'free_trial' : 'signup'} data-loc={`plan:${plan.name.toLowerCase()}`}>{plan.cta}</a>
      </div>
    </div>
  );
}
