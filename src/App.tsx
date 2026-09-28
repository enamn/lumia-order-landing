import { Cta, Faq, Footer, Header } from './sections/Chrome';
import { Dashboard } from './sections/Dashboard';
import { Channels, Device, TerminalIntro } from './sections/Hardware';
import { Hero } from './sections/Hero';
import { Pricing } from './sections/Pricing';
import { HowItWorks, Menu, Ownership, Stats, Voice, WhatsAppChaos } from './sections/Story';

export default function App() {
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
