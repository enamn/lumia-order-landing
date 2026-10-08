import { useState } from 'react';
import { Brand, LogoMark } from '../components/Logo';
import { FAQ, LOGIN_URL, NAV_LINKS, SIGNUP_URL } from '../data';

export function Header() {
  return (
    <header className="header">
      <div className="wrap header__inner">
        <Brand />
        <nav className="header__nav" aria-label="Main">
          {NAV_LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className="header__actions">
          <a href={LOGIN_URL} className="header__signin">Sign in</a>
          <a href={SIGNUP_URL} className="btn btn--primary btn--sm">Start free</a>
        </div>
      </div>
    </header>
  );
}

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section">
      <div className="wrap grid" style={{ ['--min' as string]: '380px', gap: '40px 72px', alignItems: 'start' }}>
        <h2 className="h2" style={{ fontSize: 'clamp(30px,3.6vw,46px)', letterSpacing: '-0.035em', lineHeight: 1.05 }}>
          Questions from restaurant owners.
        </h2>
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {FAQ.map(([q, a], i) => {
            const isOpen = open === i;
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
  return (
    <section id="start" className="section section--soft" style={{ paddingBlock: 'clamp(80px,11vw,150px)' }}>
      <div className="wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 'clamp(28px,3vw,40px)' }}>
          <span style={{ background: 'var(--wa)', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: 14 }}>2 chicken burgers please</span>
          <span className="muted">→</span>
          <LogoMark size={30} />
          <span className="muted">→</span>
          <span className="note--ok" style={{ borderRadius: 10, padding: '8px 12px', fontSize: 14 }}>✓ Order #1048 confirmed</span>
          <span className="muted">→</span>
          <span style={{ background: 'var(--ink)', color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 14, fontWeight: 500 }}>🔊 Lumia Order Terminal</span>
        </div>
        <h2 className="h1" style={{ fontSize: 'clamp(44px,7vw,96px)', maxWidth: 1000 }}>
          Your next order could start with a <span className="grad-text">message.</span>
        </h2>
        <p className="lead" style={{ fontSize: 'clamp(17px,1.6vw,20px)', marginTop: 26, maxWidth: 580 }}>
          Let Lumia handle the conversation while your team focuses on the food.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 34 }}>
          <a href={SIGNUP_URL} className="btn btn--primary btn--lg">Meet your AI ordering employee</a>
          <a href={SIGNUP_URL} className="btn btn--ghost btn--lg" style={{ padding: '0 24px' }}>Start free for 14 days</a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer id="contact" className="footer">
      <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '32px 64px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Brand size={26} small />
        <nav className="footer__links" aria-label="Footer">
          {NAV_LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          <a href="#contact">Contact</a>
        </nav>
      </div>
      <div className="wrap footer__legal">
        <LegalLinks />
        <span>Lumia Order is developed and operated by Afkar IO FZE LLC · <a href="mailto:partners@afkario.com">partners@afkario.com</a></span>
      </div>
    </footer>
  );
}

export function LegalLinks() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px' }}>
      <a href="/privacy">Privacy Policy</a>
      <a href="/data-deletion">Data Deletion</a>
      <a href="/terms">Terms</a>
    </div>
  );
}
