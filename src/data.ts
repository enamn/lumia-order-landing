export const DEMO_DURATIONS = [800, 1600, 1000, 1000, 1000, 1000, 1300, 1800, 1400, 1300, 1600, 1200, 1100, 4400];
export const DEMO_LAST_STEP = DEMO_DURATIONS.length - 1;

export const DEMO_CAPTIONS = [
  'Waiting for a customer',
  'Customer sends a WhatsApp voice message',
  'Lumia is listening',
  'Lumia understands the order',
  'Lumia checks your menu',
  'Lumia checks availability',
  'Lumia calculates the order',
  'Lumia sends the order and total to the customer',
  'Customer confirms',
  'The confirmed order travels to your Lumia Order Terminal',
  'The POS plays the new-order alert',
  'Restaurant taps Accept',
  'Restaurant selects 45 min',
  'Customer receives the confirmation',
];

export const AI_STAGES = ['Listening', 'Understanding order', 'Checking menu', 'Checking availability', 'Calculating order'];

export const WAVE = [8, 14, 22, 12, 26, 18, 30, 16, 10, 20, 28, 14, 8, 18, 24, 12, 20, 30, 16, 10, 22, 14, 8, 12, 18, 24, 10, 6];
export const MINI_WAVE = [6, 12, 18, 10, 20, 14, 22, 12, 8, 16, 20, 10, 6, 14, 18, 10, 8, 12];

export type Billing = 'monthly' | 'yearly';

export type Plan = {
  name: string;
  description: string;
  inherits?: string;
  features: string[];
  cta: string;
  highlight?: string;
  price: { month: string; year: string; strike: string; perMonth: string };
};

export const PLANS: Plan[] = [
  {
    name: 'Starter',
    description: 'For small restaurants and home kitchens starting with AI-powered WhatsApp ordering.',
    features: [
      '1 restaurant / branch',
      '1 WhatsApp Business number',
      'AI text ordering',
      'AI voice ordering',
      'Menu management',
      'Order dashboard',
      'Delivery zones and delivery fees',
      'Opening hours',
      'Basic customer history',
      '1 staff account',
      'Basic analytics',
      '0% commission on orders',
    ],
    cta: 'Start free',
    price: { month: 'AED 149', year: 'AED 1,490', strike: 'AED 1,788', perMonth: 'AED 124' },
  },
  {
    name: 'Plus',
    description: 'For growing restaurants that need more staff access and better customer insights.',
    inherits: 'Everything in Starter, plus:',
    features: [
      'Up to 3 staff accounts',
      'Full customer history',
      'Advanced analytics',
      'Promotions / customer campaigns',
      'Basic automation',
      '0% commission on orders',
    ],
    cta: 'Start with Plus',
    price: { month: 'AED 249', year: 'AED 2,490', strike: 'AED 2,988', perMonth: 'AED 208' },
  },
  {
    name: 'Pro',
    description: 'For established restaurants and multi-branch operations.',
    inherits: 'Everything in Plus, plus:',
    highlight: 'HIGHEST PLAN',
    features: [
      'Up to 3 branches',
      'Up to 3 WhatsApp Business numbers',
      'Up to 10 staff accounts',
      'Advanced automation',
      'Multi-branch management',
      'Priority support',
      'Assisted onboarding',
      '0% commission on orders',
    ],
    cta: 'Start with Pro',
    price: { month: 'AED 399', year: 'AED 3,990', strike: 'AED 4,788', perMonth: 'AED 333' },
  },
];

export const TERMINAL_PRICES: Record<Billing, [string, string][]> = {
  yearly: [
    ['Starter Yearly', 'AED 549'],
    ['Plus Yearly', 'AED 499'],
    ['Pro Yearly', 'AED 399'],
  ],
  monthly: [
    ['Starter Monthly', 'AED 599'],
    ['Plus Monthly', 'AED 599'],
    ['Pro Monthly', 'AED 599'],
  ],
};

export const FAQ: [string, string][] = [
  ['Does Lumia Order replace my WhatsApp number?', "No. Lumia Order connects your restaurant's supported WhatsApp Business ordering experience to the Lumia platform, so customers keep messaging the number they know."],
  ['Can customers send voice messages?', 'Yes. Lumia turns supported voice messages into the same structured order as a text message.'],
  ["What happens if Lumia doesn't understand an order?", 'Lumia asks the customer to clarify rather than guessing.'],
  ['Does Lumia invent menu items?', "No. Lumia works from the restaurant's approved menu."],
  ['Does the customer confirm first?', 'Yes. The customer confirms the structured order before it is sent to the restaurant.'],
  ['Can I accept or reject orders?', 'Yes. You accept or reject every order and select the ETA.'],
  ['Can I set delivery fees?', 'Yes. Set a fee per area, mark areas as unavailable and add a minimum order.'],
  ['Can I mark products sold out?', 'Yes. Switch the product off and Lumia stops offering it.'],
  ['Does Lumia charge commission?', 'Lumia Order charges a subscription and takes 0% commission per order under these plans.'],
  ['Are AI orders unlimited?', 'AI ordering included, subject to fair-use terms.'],
  ['What is the Lumia Order Terminal?', 'A dedicated restaurant order-management terminal with an integrated thermal printer, used to receive, accept and print orders.'],
  ['Do I need the terminal?', 'No. You can manage Lumia Order through the web dashboard in any browser. The terminal is the recommended setup for a dedicated, always-on order station with built-in printing.'],
  ['How much is the terminal?', 'AED 599 at launch (regular price AED 699). With a yearly plan it is AED 549 on Starter, AED 499 on Plus and AED 399 on Pro. Additional terminals are AED 599.'],
  ['How long does terminal delivery take?', 'Estimated delivery is 10–15 business days. Delivery time may vary depending on stock availability.'],
];

export const TERMINAL_SPECS = [
  '5.5-inch touchscreen',
  'Android 13',
  'Wi-Fi',
  '4G / SIM support',
  'Built-in 58 mm thermal printer',
  'Loud incoming-order notifications',
  'Automatic Lumia Order startup',
  'Kiosk mode',
  'Remote device management',
  'QR / barcode scanning',
  'Lumia Order branded hardware',
  'Preconfigured for the restaurant',
];

export const NAV_LINKS = [
  ['#demo', 'Product'],
  ['#how', 'How it works'],
  ['#terminal', 'Terminal'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
] as const;
