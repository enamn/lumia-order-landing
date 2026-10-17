import { useEffect } from 'react';
import { Cta, Faq, Footer, Header } from './sections/Chrome';
import { DataDeletionPage, PrivacyPage, TermsPage } from './pages/Legal';
import { Dashboard } from './sections/Dashboard';
import { Channels, TerminalIntro } from './sections/Hardware';
import { Hero } from './sections/Hero';
import { Pricing } from './sections/Pricing';
import { HowItWorks } from './sections/How';
import { MenuImport } from './sections/MenuImport';
import { Ownership, Stats, Voice, WhatsAppChaos } from './sections/Story';

const PAGES: Record<string, () => React.JSX.Element> = {
  '/privacy': PrivacyPage,
  '/data-deletion': DataDeletionPage,
  '/terms': TermsPage,
};

// Old footer links used hash anchors (e.g. /#data-deletion); send those to the real pages.
function redirectLegacyHash() {
  const target = '/' + window.location.hash.slice(1);
  if (window.location.pathname === '/' && PAGES[target]) window.location.replace(target);
}
redirectLegacyHash();
window.addEventListener('hashchange', redirectLegacyHash);

function useReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('main > section:not(.hero) > .wrap > *'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((el, i) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.style.setProperty('--i', String(i % 3));
      el.classList.add('reveal');
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
}

export default function App() {
  useReveal();
  const Page = PAGES[window.location.pathname.replace(/\/+$/, '')];
  if (Page) return <Page />;

  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Stats />
        <WhatsAppChaos />
        <Ownership />
        <HowItWorks />
        <Voice />
        <MenuImport />
        <Dashboard />
        <TerminalIntro />
        <Channels />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
