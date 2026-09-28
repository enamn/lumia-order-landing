import { Cta, Faq, Footer, Header } from './sections/Chrome';
import { DataDeletionPage, PrivacyPage, TermsPage } from './pages/Legal';
import { Dashboard } from './sections/Dashboard';
import { Channels, Device, TerminalIntro } from './sections/Hardware';
import { Hero } from './sections/Hero';
import { Pricing } from './sections/Pricing';
import { HowItWorks, Menu, Ownership, Stats, Voice, WhatsAppChaos } from './sections/Story';

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

export default function App() {
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
        <Menu />
        <Dashboard />
        <TerminalIntro />
        <Device />
        <Channels />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
