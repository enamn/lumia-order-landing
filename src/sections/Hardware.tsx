import { ScaledTerminal, Terminal } from '../components/Terminal';
import { TERMINAL_SPECS, TERMINAL_SPECS_AR } from '../data';
import { useT } from '../i18n';
import { Aed } from '../components/Money';

const FLOW_AR = ['العميل يطلب عبر واتساب', 'ذكاء لوميا أوردر يفهم الطلب ويؤكده', 'المطعم يستلم الطلب على جهاز لوميا أوردر', 'الموظف يقبل الطلب أو يرفضه', 'يُطبع الإيصال تلقائياً', 'المطبخ يبدأ التحضير'];
const FLOW: [string, boolean][] = [
  ['Customer orders on WhatsApp', false],
  ['Lumia Order AI understands and confirms the order', false],
  ['The restaurant receives the order on the Lumia Order Terminal', true],
  ['Staff accepts or rejects the order', false],
  ['Receipt prints automatically', true],
  ['Kitchen starts preparation', false],
];

export function TerminalIntro() {
  const t = useT();
  return (
    <section id="terminal" className="section">
      <div className="wrap grid" style={{ ['--min' as string]: '420px', gap: 'clamp(48px,6vw,88px)', alignItems: 'center' }}>
        <div style={{ justifySelf: 'center', width: 300, maxWidth: '100%', borderRadius: 28, background: 'var(--soft)', padding: '20px 0 12px', overflow: 'hidden' }}>
          <Terminal screen="accepted" eta={45} receipt />
        </div>
        <div>
          <span className="badge" style={{ fontSize: 11, letterSpacing: '.16em' }}>{t('RECOMMENDED FOR RESTAURANTS', 'موصى به للمطاعم')}</span>
          <h2 className="h2" style={{ marginTop: 18 }}>{t('Your dedicated Lumia Order Terminal', 'جهاز لوميا أوردر المخصص لك')}</h2>
          <p className="lead" style={{ marginTop: 18, maxWidth: 520 }}>
            {t("Receive, accept and print WhatsApp orders from one dedicated device — without relying on an employee's personal phone.", 'استقبل طلبات واتساب واقبلها واطبعها من جهاز واحد مخصص — دون الاعتماد على هاتف موظف الشخصي.')}
          </p>
          <ol className="tsteps" style={{ listStyle: 'none' }}>
            {FLOW.map(([text, key], i) => (
              <li key={text} className="tstep">
                <div className="tstep__rail">
                  <span className={`tstep__num${key ? ' is-key' : ''}`}>{i + 1}</span>
                  {i < FLOW.length - 1 && <span className="tstep__line" />}
                </div>
                <span className="tstep__text" style={key ? { fontWeight: 600 } : undefined}>{t(text, FLOW_AR[i]!)}</span>
              </li>
            ))}
          </ol>
          <p className="muted" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)', fontSize: 14, lineHeight: 1.5, maxWidth: 360 }}>{t('Estimated delivery: 10–15 business days.', 'التوصيل المتوقع: 10–15 يوم عمل.')}</p>
          <a href="#pricing" className="btn btn--primary btn--md" style={{ marginTop: 24 }}>{t('See plans', 'شاهد الباقات')}</a>
        </div>
      </div>
    </section>
  );
}

export function Device() {
  const t = useT();
  const specs = t(TERMINAL_SPECS, TERMINAL_SPECS_AR);
  return (
    <section id="device" className="section section--soft">
      <div className="wrap">
        <div className="split" style={{ gap: '20px 64px' }}>
          <div>
            <h2 className="h2">{t('Lumia Order Terminal', 'جهاز لوميا أوردر')}</h2>
          </div>
          <p className="lead">
            {t('A dedicated restaurant order-management terminal with an integrated thermal printer. Orders ring out loud, staff accept at the counter, and the receipt prints automatically. You can still manage everything from the web dashboard.', 'جهاز مخصص لإدارة طلبات المطعم مع طابعة حرارية مدمجة. تُنبَّه بالطلبات بصوت عالٍ، ويقبلها الموظف عند الكاونتر، ويُطبع الإيصال تلقائياً. ويمكنك إدارة كل شيء من لوحة التحكم على الويب أيضاً.')}
          </p>
        </div>

        <div className="grid" style={{ ['--min' as string]: '300px', gap: 20, marginTop: 'clamp(36px,4vw,52px)' }}>
          <figure>
            <div className="stage-box">
              <ScaledTerminal scale={0.62} offsetTop={-20} screen="new2" ring />
            </div>
            <figcaption className="eyebrow" style={{ marginTop: 14 }}>{t('Front', 'من الأمام')}</figcaption>
          </figure>
          <figure>
            <div className="stage-box" style={{ background: 'radial-gradient(70% 60% at 50% 40%,#fff 0%,#F7EEF4 100%)' }}>
              <ScaledTerminal scale={0.62} offsetTop={-10} extraTransform="rotateY(-28deg) rotateX(6deg)" screen="ready" />
            </div>
            <figcaption className="eyebrow" style={{ marginTop: 14 }}>{t('3/4 view', 'زاوية ثلاثة أرباع')}</figcaption>
          </figure>
          <figure>
            <div className="stage-box" style={{ background: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#F4EBEF 0%,#EFE3E9 64%,#D9CCC6 64%,#CDBFB9 100%)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: '64%', height: 6, background: 'rgba(255,255,255,.55)' }} />
              <ScaledTerminal scale={0.52} offsetTop={28} screen="accepted" eta={45} receipt />
              <span className="photo-slot">{t('Placeholder · real terminal photo to be supplied', 'مكان مؤقت · ستُضاف صورة الجهاز الحقيقية')}</span>
            </div>
            <figcaption className="eyebrow" style={{ marginTop: 14 }}>{t('At the counter (illustration)', 'عند الكاونتر (رسم توضيحي)')}</figcaption>
          </figure>
        </div>

        <div className="grid" style={{ ['--min' as string]: '240px', gap: '0 24px', marginTop: 'clamp(32px,4vw,48px)' }}>
          {specs.map((s) => (
            <div key={s} className="spec"><span className="check">✓</span>{s}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Channels() {
  const t = useT();
  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2">{t('Run Lumia Order your way.', 'شغّل لوميا أوردر بطريقتك.')}</h2>
        <div className="grid" style={{ ['--min' as string]: '340px', gap: 20, marginTop: 'clamp(36px,4vw,52px)', maxWidth: 960 }}>
          <div className="channel gradient-border">
            <div className="channel__art" style={{ background: 'var(--soft)' }}>
              <ScaledTerminal scale={0.4} offsetTop={4} screen="new2" receipt />
            </div>
            <div className="channel__head">
              <h3 className="h3">{t('Lumia Order Terminal', 'جهاز لوميا أوردر')}</h3>
              <span className="badge">{t('RECOMMENDED', 'موصى به')}</span>
            </div>
            <p>{t('The recommended way to receive and manage orders. A dedicated device with loud alerts and built-in receipt printing.', 'الطريقة الموصى بها لاستقبال الطلبات وإدارتها. جهاز مخصص بتنبيهات عالية وطباعة إيصالات مدمجة.')}</p>
          </div>

          <div className="channel channel--plain">
            <div className="channel__art" style={{ background: 'var(--tint-2)' }}>
              <BrowserMock />
            </div>
            <div className="channel__head">
              <h3 className="h3">{t('Web Dashboard', 'لوحة التحكم على الويب')}</h3>
              <span className="badge" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{t('EVERY PLAN', 'في كل الباقات')}</span>
            </div>
            <p>
              {t('Runs in any browser, including on mobile. Menu, restaurant information, delivery areas and fees, opening hours, order and customer history, analytics, staff, WhatsApp configuration, terminal management, billing and settings.', 'تعمل في أي متصفح بما في ذلك الجوال. القائمة، ومعلومات المطعم، ومناطق التوصيل ورسومه، وساعات العمل، وسجل الطلبات والعملاء، والتحليلات، والموظفون، وإعداد واتساب، وإدارة الأجهزة، والفوترة والإعدادات.')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrowserMock() {
  const t = useT();
  const orders: [string, number, string, boolean][] = [
    ['#1048', 82, t('Samer · New', 'سامر · جديد'), true],
    ['#1047', 64, t('Noura · Accepted', 'نورة · مقبول'), false],
    ['#1046', 58, t('Omar · Preparing', 'عمر · قيد التحضير'), false],
  ];
  return (
    <div style={{ position: 'absolute', inset: '16px 16px 0', background: '#fff', borderRadius: '12px 12px 0 0', border: '1px solid var(--line)', borderBottom: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#EAD9E1' }} />)}
        <span className="muted" style={{ marginInlineStart: 8, fontSize: 10 }}>app.lumiaorder.com</span>
      </div>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ flex: '0 0 84px', padding: '10px 6px', borderInlineEnd: '1px solid var(--line-3)', fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[['Orders', 'الطلبات'], ['Menu', 'القائمة'], ['Customers', 'العملاء'], ['Delivery', 'التوصيل'], ['Settings', 'الإعدادات']].map(([n, a], i) => (
            <div key={n} style={i === 0 ? { padding: '5px 7px', borderRadius: 6, background: 'var(--tint)', fontWeight: 600 } : { padding: '5px 7px', color: 'var(--muted)' }}>{t(n!, a!)}</div>
          ))}
        </div>
        <div className="tabnum" style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11 }}>
          {orders.map(([id, amt, who, sel]) => (
            <div key={id} style={{ borderRadius: 8, padding: 8, ...(sel ? { boxShadow: '0 0 0 1.5px #FF5577' } : { border: '1px solid var(--line-3)' }) }}>
              <div className="row-between"><span className="mono">{id}</span><b><Aed n={amt} /></b></div>
              <div className="muted">{who}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
