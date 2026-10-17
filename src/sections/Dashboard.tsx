import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '../components/Logo';
import { Aed } from '../components/Money';
import { useT } from '../i18n';

type Item = { name: string; price: number; on: boolean };
const MENU: [string, Item[]][] = [
  ['Burgers', [
    { name: 'Chicken Burger', price: 25, on: true },
    { name: 'Spicy Chicken Burger', price: 27, on: true },
    { name: 'Beef Burger', price: 29, on: true },
  ]],
  ['Sides & drinks', [
    { name: 'Fries', price: 12, on: true },
    { name: 'Coca-Cola', price: 6, on: true },
  ]],
];
const BEEF = 'Beef Burger';
const AR_CAT: Record<string, string> = { Burgers: 'البرجر', 'Sides & drinks': 'جانبيات ومشروبات' };
const AR_NAME: Record<string, string> = { 'Chicken Burger': 'برجر دجاج', 'Spicy Chicken Burger': 'برجر دجاج حار', 'Beef Burger': 'برجر لحم', Fries: 'بطاطس', 'Coca-Cola': 'كوكاكولا' };

function Toggle({ on, onClick, label, auto }: { on: boolean; onClick: () => void; label: string; auto?: string }) {
  return <button className={`toggle${on ? ' is-on' : ''}`} data-auto={auto} onClick={onClick} role="switch" aria-checked={on} aria-label={label} />;
}

export function Dashboard() {
  const t = useT();
  const [accepting, setAccepting] = useState(true);
  const [items, setItems] = useState<Record<string, boolean>>(() => Object.fromEntries(MENU.flatMap(([, l]) => l.map((i) => [i.name, i.on]))));
  const [flash, setFlash] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [cur, setCur] = useState({ x: 20, y: 300, show: false, click: false });

  const flip = (name: string) => {
    setItems((m) => ({ ...m, [name]: !m[name] }));
    setFlash(name); window.setTimeout(() => setFlash(''), 700);
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => { ids.push(window.setTimeout(fn, ms)); };
    const moveTo = (sel: string) => {
      const root = wrapRef.current, t = root?.querySelector<HTMLElement>(sel);
      if (!root || !t) return;
      const a = root.getBoundingClientRect(), b = t.getBoundingClientRect();
      setCur((c) => ({ ...c, show: true, x: b.left - a.left + b.width * 0.55, y: b.top - a.top + b.height * 0.6 }));
    };
    const click = () => { setCur((c) => ({ ...c, click: true })); at(280, () => setCur((c) => ({ ...c, click: false }))); };
    const loop = () => {
      setItems((m) => ({ ...m, [BEEF]: true })); setCur((c) => ({ ...c, show: false }));
      at(1800, () => moveTo('[data-auto=beef]'));
      at(2700, () => { click(); flip(BEEF); });
      at(6200, () => moveTo('[data-auto=beef]'));
      at(7000, () => { click(); flip(BEEF); });
      at(7900, () => setCur((c) => ({ ...c, show: false })));
      at(10600, loop);
    };
    loop();
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [auto, visible]);

  const all = MENU.flatMap(([, l]) => l);
  const offN = all.filter((i) => !items[i.name]).length;
  const beefOn = items[BEEF];

  return (
    <section className="section section--soft" style={{ paddingBlock: 'clamp(72px,10vw,120px)' }}>
      <div className="wrap">
        <div className="split">
          <h2 className="h2">{t("You're always in control.", 'أنت دائماً المتحكّم.')}</h2>
          <p className="lead">{t("Sold out of something? One tap and Lumia stops offering it — instantly, on every chat. Tap it back on when it's ready.", 'نفد صنف؟ لمسة واحدة ويتوقف لوميا عن عرضه فوراً في كل المحادثات. أعده بلمسة عندما يتوفر.')}</p>
        </div>

        <div className="dash" ref={wrapRef} onPointerDown={() => { if (auto) { setAuto(false); setCur((c) => ({ ...c, show: false })); } }}>
          <span className={`dcursor${cur.show ? ' is-show' : ''}${cur.click ? ' is-click' : ''}`} style={{ transform: `translate(${cur.x}px, ${cur.y}px)` }} aria-hidden="true"><svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2l16 10-7 2 4 9-3 1.5-4-9-6 5z" fill="#1a0815" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>
          <div className="dash__top">
            <LogoMark size={24} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{t('Burger House', 'بيت البرجر')}</span>
            <span className="muted" style={{ fontSize: 13 }}>{t('Al Majaz, Sharjah', 'المجاز، الشارقة')}</span>
            <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="dash__reset" onClick={() => { setItems(Object.fromEntries(all.map((i) => [i.name, true]))); setAuto(true); }}>{t('RESET', 'إعادة')}</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <nav className="dash__side" aria-label="Dashboard">
              {[['Orders', 'الطلبات'], ['Menu', 'القائمة'], ['Customers', 'العملاء'], ['Delivery', 'التوصيل'], ['Settings', 'الإعدادات']].map(([n, a]) => (
                <div key={n} className={n === 'Menu' ? 'is-on' : ''}>{t(n!, a!)}</div>
              ))}
            </nav>

            <div className="dash__main">
              <div className="mc__head">
                <h3>{t('Menu', 'القائمة')}</h3>
                <div className="mc__counts tabnum"><span>{all.length - offN} {t('available', 'متاح')}</span><span>{offN} {t('sold out', 'نفد')}</span></div>
              </div>
              <div className="mc__list">
                {MENU.map(([cat, list]) => (
                  <div key={cat}>
                    <div className="mc__cat">{t(cat, AR_CAT[cat] ?? cat)}</div>
                    {list.map((it) => {
                      const on = items[it.name];
                      return (
                        <div key={it.name} className={`mc__item${on ? '' : ' is-off'}${flash === it.name ? ' is-flash' : ''}`}>
                          <span className="mc__name">{t(it.name, AR_NAME[it.name] ?? it.name)}</span>
                          <span className="mc__price tabnum"><Aed n={it.price} /></span>
                          <span className="mc__st">{on ? t('Available', 'متاح') : t('Sold out', 'نفد')}</span>
                          <Toggle on={on} auto={it.name === BEEF ? 'beef' : undefined} onClick={() => flip(it.name)} label={`Toggle ${it.name} availability`} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="dash__panel">
              <div className="eyebrow">{t('WHAT YOUR CUSTOMER SEES', 'ما يراه عميلك')}</div>
              <div className="mc__chat" aria-live="polite">
                <div className="sbub sbub--out">{t('Can I get a Beef Burger?', 'أبغى برجر لحم؟')}<span className="sbub__time">21:20 ✓✓</span></div>
                {beefOn ? (
                  <div key="yes" className="sbub sbub--in">{t(<>Sure! The Beef Burger is <b><Aed n={29} /></b>. How many would you like?</>, <>أكيد! برجر اللحم بسعر <b><Aed n={29} /></b>. كم تريد؟</>)}<span className="sbub__time">21:20</span></div>
                ) : (
                  <div key="no" className="sbub sbub--in">{t(<>Sorry, the Beef Burger is sold out today. Would you like the Chicken Burger (<Aed n={25} />) instead?</>, <>عذراً، برجر اللحم نفد اليوم. هل تريد برجر الدجاج (<Aed n={25} />) بدلاً منه؟</>)}<span className="sbub__time">21:20</span></div>
                )}
              </div>
              <div className="mc__cap">{t('Lumia reads this list live. It never offers a sold-out item.', 'يقرأ لوميا هذه القائمة مباشرة، ولا يعرض أبداً صنفاً نفد.')}</div>
              <div className="dash__line" style={{ padding: '12px 0 8px', marginTop: 12 }}>
                <span style={{ fontWeight: 500 }}>{t('Accepting orders', 'استقبال الطلبات')}</span>
                <Toggle on={accepting} onClick={() => setAccepting((a) => !a)} label="Toggle accepting orders" />
              </div>
              <div className="eyebrow" style={{ marginTop: 10 }}>{t('DELIVERY AREAS', 'مناطق التوصيل')}</div>
              <div className="price-row"><span>{t('Sharjah', 'الشارقة')}</span><span style={{ fontWeight: 500 }}><Aed n={8} /></span></div>
              <div className="price-row"><span>{t('Ajman', 'عجمان')}</span><span style={{ fontWeight: 500 }}><Aed n={12} /></span></div>
              <div className="price-row muted" style={{ borderBottom: 0 }}><span>{t('Dubai', 'دبي')}</span><span>{t('Not available', 'غير متاح')}</span></div>
            </div>
          </div>
        </div>

        <div className="grid" style={{ ['--min' as string]: '360px', marginTop: 'clamp(28px,3vw,40px)', gap: '20px 48px', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 'clamp(24px,2.4vw,30px)', fontWeight: 600, letterSpacing: '-0.03em' }}>{t('Make repeat orders easier.', 'اجعل الطلبات المتكررة أسهل.')}</h3>
            <p className="lead" style={{ fontSize: 16, marginTop: 10, maxWidth: 460 }}>
              {t('With confirmed customer information, Lumia can make future orders faster. It always asks before reusing a saved address.', 'بمعلومات العميل المؤكدة، يجعل لوميا الطلبات القادمة أسرع، ويسأل دائماً قبل إعادة استخدام عنوان محفوظ.')}
            </p>
          </div>
          <div style={{ background: 'var(--wa-bg)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: 12, padding: '8px 12px' }}>{t('Welcome back, Samer 👋', 'أهلاً بعودتك يا سامر 👋')}</div>
            <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: 12, padding: '8px 12px', maxWidth: '90%' }}>
              {t('Would you like delivery to your previously confirmed address in Al Majaz?', 'هل تريد التوصيل إلى عنوانك المؤكد سابقاً في المجاز؟')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
