import { useState } from 'react';
import { Brand, LogoMark } from '../components/Logo';
import { FAQ, FAQ_AR, LOGIN_URL, NAV_LINKS, NAV_LINKS_AR, SIGNUP_URL } from '../data';
import { LangSwitch, useLang, useT } from '../i18n';

export function Header() {
  const [open, setOpen] = useState(false);
  const t = useT(), { lang } = useLang();
  const label = (href: string, en: string) => (lang === 'ar' ? NAV_LINKS_AR[href] ?? en : en);
  return (
    <header className="header">
      <div className="wrap header__inner">
        <Brand />
        <nav className="header__nav" aria-label="Main">
          {NAV_LINKS.map(([href, l]) => <a key={href} href={href}>{label(href, l)}</a>)}
        </nav>
        <div className="header__actions">
          <LangSwitch />
          <a href={LOGIN_URL} className="header__signin" data-track="login" data-loc="header">{t('Sign in', 'تسجيل الدخول')}</a>
          <a href={SIGNUP_URL} className="btn btn--primary btn--sm" data-track="free_trial" data-loc="header">{t('Start free', 'ابدأ مجاناً')}</a>
          <button className="header__menu" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? t('Close menu', 'إغلاق القائمة') : t('Open menu', 'فتح القائمة')} onClick={() => setOpen(!open)}><span /></button>
        </div>
      </div>
      <nav id="mobile-nav" className="header__panel" data-open={open} aria-label="Mobile">
        {NAV_LINKS.map(([href, l]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label(href, l)}</a>)}
        <a href={LOGIN_URL} data-track="login" data-loc="mobile-menu">{t('Sign in', 'تسجيل الدخول')}</a>
      </nav>
    </header>
  );
}

export function Faq() {
  const [open, setOpen] = useState(0);
  const tr = useT(), { lang } = useLang();
  const list = lang === 'ar' ? FAQ_AR : FAQ;
  return (
    <section id="faq" className="section">
      <div className="wrap grid" style={{ ['--min' as string]: '380px', gap: '40px 72px', alignItems: 'start' }}>
        <h2 className="h2" style={{ fontSize: 'clamp(30px,3.6vw,46px)', letterSpacing: '-0.035em', lineHeight: 1.05 }}>
          {tr('Questions from restaurant owners.', 'أسئلة من أصحاب المطاعم.')}
        </h2>
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {list.map(([q, a0], i) => {
            const isOpen = open === i, a = a0;
            return (
              <div key={q} style={{ borderBottom: '1px solid var(--line)' }}>
                <button className="faq__q" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                  {q}
                  <span className="faq__icon" style={{ transform: `rotate(${isOpen ? 45 : 0}deg)` }} aria-hidden="true">+</span>
                </button>
                {isOpen && <p id={`faq-${i}`} className="faq__a">{a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Cta() {
  const t = useT();
  return (
    <section id="start" className="section section--soft" style={{ paddingBlock: 'clamp(80px,11vw,150px)' }}>
      <div className="wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 'clamp(28px,3vw,40px)' }}>
          <span style={{ background: 'var(--wa)', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: 14 }}>{t('2 chicken burgers please', 'من فضلك 2 برجر دجاج')}</span>
          <span className="muted arr">→</span>
          <LogoMark size={30} />
          <span className="muted arr">→</span>
          <span className="note--ok" style={{ borderRadius: 10, padding: '8px 12px', fontSize: 14 }}>{t('✓ Order #1048 confirmed', '✓ تم تأكيد الطلب #1048')}</span>
          <span className="muted arr">→</span>
          <span style={{ background: 'var(--ink)', color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 14, fontWeight: 500 }}>{t('🔊 Lumia Order Terminal', '🔊 جهاز لوميا أوردر')}</span>
        </div>
        <h2 className="h1" style={{ fontSize: 'clamp(44px,7vw,96px)', maxWidth: 1000 }}>
          {t(<>Your next order could start with a <span className="grad-text">message.</span></>, <>طلبك القادم قد يبدأ <span className="grad-text">برسالة.</span></>)}
        </h2>
        <p className="lead" style={{ fontSize: 'clamp(17px,1.6vw,20px)', marginTop: 26, maxWidth: 580 }}>
          {t('Let Lumia handle the conversation while your team focuses on the food.', 'اترك المحادثة للوميا، وفريقك يتفرغ للطعام.')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 34 }}>
          <a href={SIGNUP_URL} className="btn btn--primary btn--lg" data-track="signup" data-loc="closing">{t('Meet your AI ordering employee', 'تعرّف على موظف الطلبات بالذكاء الاصطناعي')}</a>
          <a href={SIGNUP_URL} className="btn btn--ghost btn--lg" style={{ padding: '0 24px' }} data-track="free_trial" data-loc="closing">{t('Start free for 14 days', 'ابدأ مجاناً لمدة 14 يوماً')}</a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const t = useT(), { lang } = useLang();
  return (
    <footer id="contact" className="footer">
      <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '32px 64px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Brand size={26} small />
        <nav className="footer__links" aria-label="Footer">
          {NAV_LINKS.map(([href, l]) => <a key={href} href={href}>{lang === 'ar' ? NAV_LINKS_AR[href] ?? l : l}</a>)}
          <a href="#contact">{t('Contact', 'تواصل معنا')}</a>
        </nav>
      </div>
      <div className="wrap footer__legal">
        <LegalLinks />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{t(<>Built for bold ideas. Lumia is a product of <a href="https://afkario.com/" target="_blank" rel="noopener">Afkar IO FZE LLC</a>.</>, <>صُنع للأفكار الجريئة. لوميا منتج من <a href="https://afkario.com/" target="_blank" rel="noopener">Afkar IO FZE LLC</a>.</>)}</span>
          <span>{t('© 2026 Lumia. All rights reserved.', '© 2026 لوميا. جميع الحقوق محفوظة.')}</span>
        </span>
      </div>
    </footer>
  );
}

export function LegalLinks() {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px' }}>
      <a href="/privacy">{t('Privacy Policy', 'سياسة الخصوصية')}</a>
      <a href="/data-deletion">{t('Data Deletion', 'حذف البيانات')}</a>
      <a href="/terms">{t('Terms', 'الشروط')}</a>
    </div>
  );
}
