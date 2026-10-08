import { useEffect, type ReactNode } from 'react';
import { LogoMark } from '../components/Logo';
import { LegalLinks } from '../sections/Chrome';

export const PRIVACY_EMAIL = 'privacy@lumia.ae';
const LAST_UPDATED = '28 September 2026';

function Email() {
  return <a className="legal__email" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;
}

function List({ items }: { items: string[] }) {
  return <ul className="legal__list">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function LegalLayout({ title, eyebrow = 'Legal', children }: { title: string; eyebrow?: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — Lumia Order`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="wrap">
          <a href="/" className="brand" aria-label="Lumia Order home">
            <LogoMark size={30} />
            <span className="brand__word"><b>Lumia</b><span>Order</span></span>
          </a>
          <a href="/" className="legal-back">← Back to site</a>
        </div>
      </header>
      <main className="legal">
        <div className="eyebrow eyebrow--lg">{eyebrow}</div>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="legal-footer">
        <div className="wrap footer__legal">
          <LegalLinks />
          <span>Lumia Order is developed and operated by Afkar IO FZE LLC · <a href="mailto:partners@afkario.com">partners@afkario.com</a></span>
        </div>
      </footer>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="legal__date">Last updated: {LAST_UPDATED}</p>
      <p className="legal__intro">
        Lumia Order is a restaurant ordering platform developed and operated by Afkar IO FZE LLC. This policy explains how Lumia Order processes personal information when restaurants use the service and when their customers order through WhatsApp. It covers the Lumia Order platform, the web dashboard, the Lumia Order Terminal and this website.
      </p>
      <div className="legal__body">
        <Section title="1. Restaurant information">
          <p>When a restaurant uses Lumia Order, we may process:</p>
          <List items={['Restaurant name', 'Account and contact information', 'Branch details', 'Menu items and prices', 'Opening hours', 'Delivery areas and fees', 'Staff accounts', 'Subscription information']} />
        </Section>
        <Section title="2. WhatsApp information">
          <p>Lumia Order may process data received through the WhatsApp Business Platform, including:</p>
          <List items={['Phone number / WhatsApp identifier', 'Customer messages', 'Timestamps', 'Voice messages', 'Images or documents sent during an order', 'Order-related conversation information']} />
        </Section>
        <Section title="3. Customer order information">
          <p>When a customer places an order, Lumia Order may process:</p>
          <List items={['Customer name', 'Phone number', 'Ordered items', 'Quantities', 'Special instructions', 'Delivery address / location', 'Order total', 'Payment status', 'Order history']} />
        </Section>
        <Section title="4. AI processing">
          <p>Text and voice messages may be processed using AI services, including third-party AI providers, in order to:</p>
          <List items={['Understand customer requests', 'Extract order information', 'Answer customers', 'Create and update orders']} />
        </Section>
        <Section title="5. Technical data">
          <p>We may collect technical data such as:</p>
          <List items={['IP address', 'Browser / device type', 'Terminal identifiers', 'Application version', 'Diagnostic logs', 'Authentication and security events']} />
          <p>On our public website we count visits, the pricing section being viewed and clicks on sign-up buttons. We do this without cookies and do not keep your IP address: we keep only your country and an anonymous code that changes every day. We do not count visitors whose browser sends Do Not Track or Global Privacy Control.</p>
        </Section>
        <Section title="6. Purpose of processing">
          <p>We use this information to:</p>
          <List items={['Provide Lumia Order', 'Receive and manage orders', 'Respond through WhatsApp', 'Process AI text and voice requests', 'Show orders to restaurants', 'Print orders', 'Maintain order and customer history', 'Provide support', 'Operate subscriptions', 'Protect against abuse and security issues', 'Meet legal obligations']} />
        </Section>
        <Section title="7. WhatsApp Business Platform">
          <p>
            Lumia Order integrates with the WhatsApp Business Platform provided by Meta. WhatsApp-related data may also be processed according to the applicable Meta and WhatsApp terms and policies. Lumia Order is an independent service and is not owned by or officially endorsed by Meta.
          </p>
        </Section>
        <Section title="8. Third-party services">
          <p>Lumia Order may use service providers for functions such as:</p>
          <List items={['WhatsApp messaging', 'Cloud infrastructure', 'AI processing', 'Payment processing', 'Email', 'Customer support', 'Device management', 'Diagnostics']} />
          <p>These providers process information on our behalf and only as needed to deliver their service.</p>
        </Section>
        <Section title="9. Data retention">
          <p>
            Lumia Order retains personal information only for as long as necessary to provide the service, maintain required business records, resolve disputes, prevent abuse and comply with applicable legal obligations.
          </p>
        </Section>
        <Section title="10. Data deletion">
          <p>
            You can request deletion of personal information associated with Lumia Order. See the <a href="/data-deletion">Data Deletion</a> page for instructions.
          </p>
        </Section>
        <Section title="11. Contact">
          <p>For privacy questions or requests, contact us at <Email />.</p>
        </Section>
      </div>
    </LegalLayout>
  );
}

export function DataDeletionPage() {
  return (
    <LegalLayout title="Lumia Order Data Deletion" eyebrow="Legal · /data-deletion">
      <div className="legal__intro" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
        <p>Users can request deletion of personal information associated with Lumia Order.</p>
        <p>
          To request deletion, contact Lumia Order using the privacy contact information provided below and include enough information for us to identify the relevant account or WhatsApp interaction.
        </p>
        <p>We may request additional information only when necessary to verify the request and protect against unauthorized deletion.</p>
        <p>Eligible data will be deleted or de-identified unless retention is required by applicable law.</p>
      </div>
      <div className="legal__contact">
        <div className="eyebrow">Privacy contact</div>
        <div style={{ marginTop: 10 }}>
          <a className="legal__email" style={{ background: '#fff', fontSize: 15, padding: '4px 8px', borderRadius: 6 }} href={`mailto:${PRIVACY_EMAIL}?subject=Data%20deletion%20request`}>
            {PRIVACY_EMAIL}
          </a>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', marginTop: 14 }}>
          Please include your restaurant account name or the WhatsApp number you used to order.
        </div>
      </div>
      <p className="muted" style={{ fontSize: 15, marginTop: 28 }}>
        See also our <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="legal__date">Last updated: {LAST_UPDATED}</p>
      <p className="legal__intro">
        These terms govern the use of Lumia Order, including the platform, the web dashboard, the Lumia Order Terminal and this website. Lumia Order is a restaurant ordering platform developed and operated by Afkar IO FZE LLC. By creating an account or using the service, the restaurant ("you") agrees to these terms.
      </p>
      <div className="legal__body">
        <Section title="1. The service">
          <p>
            Lumia Order lets restaurants receive customer orders through WhatsApp. Lumia uses AI to understand text and voice messages, structure them into orders based on the restaurant's approved menu, confirm them with the customer and deliver them to the restaurant through the web dashboard or the Lumia Order Terminal.
          </p>
        </Section>
        <Section title="2. Accounts">
          <p>
            You must provide accurate account and restaurant information and keep your login credentials secure. You are responsible for all activity under your account, including actions taken by your staff accounts.
          </p>
        </Section>
        <Section title="3. Plans, trial and billing">
          <List items={['Plans are billed monthly or yearly in advance', 'New accounts may start with a 14-day free trial', 'Lumia Order takes 0% commission per order under the published plans', 'Prices are shown in AED and may change with prior notice', 'Subscriptions renew automatically until cancelled', 'Fees already paid are non-refundable unless required by law']} />
        </Section>
        <Section title="4. Fair use of AI ordering">
          <p>
            AI ordering is included in every plan, subject to fair-use terms. We may contact you, limit usage or suggest a different plan if usage is significantly beyond what is typical for your plan or harms the service for others.
          </p>
        </Section>
        <Section title="5. Your menu and your orders">
          <p>
            Lumia works from the menu, prices, options, availability and delivery rules that you approve. You are responsible for keeping this information accurate, for preparing and delivering orders, for food quality and safety, and for complying with laws that apply to your business. The sale of food is between you and your customer; Lumia Order is not a party to it.
          </p>
          <p>
            Customers confirm each order before it is sent to you, and you accept or reject every order. AI can make mistakes, so please review orders before accepting them.
          </p>
        </Section>
        <Section title="6. WhatsApp Business Platform">
          <p>
            Lumia Order integrates with the WhatsApp Business Platform provided by Meta. You must comply with the applicable WhatsApp Business and Meta terms and policies, including messaging and opt-in rules. Lumia Order is an independent service and is not owned by or officially endorsed by Meta.
          </p>
        </Section>
        <Section title="7. Lumia Order Terminal">
          <p>
            The Lumia Order Terminal is an optional device sold for a one-time price. Estimated delivery is 10–15 business days and may vary depending on stock availability. Launch and plan-based terminal prices apply as published at the time of purchase. Every plan also works with the web dashboard.
          </p>
        </Section>
        <Section title="8. Acceptable use">
          <p>You must not use Lumia Order to:</p>
          <List items={['Send spam or unsolicited messages', 'Sell prohibited or illegal products', 'Mislead or defraud customers', 'Interfere with or reverse-engineer the service', 'Access other accounts or data without permission', 'Violate any applicable law']} />
        </Section>
        <Section title="9. Data and privacy">
          <p>
            Our <a href="/privacy">Privacy Policy</a> explains how personal information is processed. You keep ownership of your restaurant and customer data, and you grant us the rights needed to process it to provide the service.
          </p>
        </Section>
        <Section title="10. Availability and changes">
          <p>
            We work to keep Lumia Order available and reliable, but we do not guarantee uninterrupted service. We may update or improve features over time and will give notice of material changes to these terms.
          </p>
        </Section>
        <Section title="11. Limitation of liability">
          <p>
            To the extent permitted by law, Lumia Order is provided "as is", and Afkar IO is not liable for indirect or consequential losses, lost profits or lost orders. Our total liability is limited to the fees you paid for the service in the three months before the claim.
          </p>
        </Section>
        <Section title="12. Cancellation and termination">
          <p>
            You can cancel your subscription at any time; access continues until the end of the paid period. We may suspend or close accounts that breach these terms. You can request deletion of your data as described on the <a href="/data-deletion">Data Deletion</a> page.
          </p>
        </Section>
        <Section title="13. Governing law">
          <p>These terms are governed by the laws of the United Arab Emirates.</p>
        </Section>
        <Section title="14. Contact">
          <p>For questions about these terms, contact us at <Email />.</p>
        </Section>
      </div>
    </LegalLayout>
  );
}
