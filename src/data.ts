export const DEMO_DURATIONS = [800, 1600, 1000, 1000, 1000, 1000, 1300, 1800, 1400, 1300, 1600, 1200, 1100, 4400];
export const DEMO_LAST_STEP = DEMO_DURATIONS.length - 1;

export const DEMO_CAPTIONS = [
  'Waiting for a customer',
  'Customer sends a WhatsApp voice message',
  'Lumia is listening',
  'Lumia understands the order',
  'Lumia checks your menu or products',
  'Lumia checks availability',
  'Lumia calculates the order',
  'Lumia sends the order and total to the customer',
  'Customer confirms',
  'The confirmed order travels to your Lumia Order Terminal',
  'The POS plays the new-order alert',
  'You tap Accept',
  'You select 45 min',
  'Customer receives the confirmation',
];

export const AI_STAGES = ['Listening', 'Understanding order', 'Checking menu or products', 'Checking availability', 'Calculating order'];

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
  amounts: { month: number; year: number }; // list price in AED; the pricing section shows the visitor's own currency when it has approved prices
};

export const PLANS: Plan[] = [
  {
    name: 'Starter',
    description: 'For small restaurants, home kitchens and small stores starting with AI-powered WhatsApp ordering.',
    features: [
      '1 restaurant or store / branch',
      '1 WhatsApp Business number',
      'AI text ordering',
      'AI voice ordering',
      'Menu and product management',
      'Order dashboard',
      'Delivery zones and delivery fees',
      'Opening hours',
      'Basic customer history',
      '1 staff account',
      'Basic analytics',
      '0% commission on orders',
    ],
    cta: 'Start free',
    amounts: { month: 149, year: 1490 },
  },
  {
    name: 'Plus',
    description: 'For growing restaurants and stores that need more staff access and better customer insights.',
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
    amounts: { month: 249, year: 2490 },
  },
  {
    name: 'Pro',
    description: 'For established restaurants, supermarkets and multi-branch operations.',
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
    amounts: { month: 399, year: 3990 },
  },
];

export const FAQ: [string, string][] = [
  ['Does Lumia Order replace my WhatsApp number?', "No. Lumia Order connects your business's supported WhatsApp Business ordering experience to the Lumia platform, so customers keep messaging the number they know."],
  ['Can customers send voice messages?', 'Yes. Lumia turns supported voice messages into the same structured order as a text message.'],
  ["What happens if Lumia doesn't understand an order?", 'Lumia asks the customer to clarify rather than guessing.'],
  ['Does Lumia invent menu items or products?', "No. Lumia works only from your approved menu or product list."],
  ['Does the customer confirm first?', 'Yes. The customer confirms the structured order before it is sent to your restaurant or store.'],
  ['Can I accept or reject orders?', 'Yes. You accept or reject every order and select the ETA.'],
  ['Can I set delivery fees?', 'Yes. Set a fee per area or by distance from your branch, mark areas as unavailable and add a minimum order.'],
  ['Which countries does Lumia Order work in?', 'Businesses in the UAE can subscribe today. Businesses in Saudi Arabia, Oman, Bahrain, Qatar and Kuwait can create an account and set up their menu or products, with local-currency plans opening soon. Prices on this page are in UAE dirhams (AED).'],
  ['Can I mark products sold out?', 'Yes. Switch the product off and Lumia stops offering it.'],
  ['Does Lumia charge commission?', 'Lumia Order charges a subscription and takes 0% commission per order under these plans.'],
  ['Are AI orders unlimited?', 'AI ordering included, subject to fair-use terms.'],
  ['What is the Lumia Order Terminal?', 'A dedicated order-management terminal for restaurants and stores, with an integrated thermal printer, used to receive, accept and print orders.'],
  ['Do I need the terminal?', 'No. You can manage Lumia Order through the web dashboard in any browser. The terminal is the recommended setup for a dedicated, always-on order station with built-in printing.'],
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
  'Preconfigured for your business',
];

export const NAV_LINKS = [
  ['#demo', 'Product'],
  ['#how', 'How it works'],
  ['#terminal', 'Terminal'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
] as const;

// Business-owner app (apps/admin). Set VITE_ADMIN_URL at build time (e.g. https://app.order.lumia.ae).
// Without it, production keeps the old in-page anchors so no visitor is sent to a dead link; local dev defaults to localhost:3000.
const env = (import.meta as unknown as { env?: { VITE_ADMIN_URL?: string; DEV?: boolean } }).env;
const ADMIN_URL = (env?.VITE_ADMIN_URL ?? (env?.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');
export const SIGNUP_URL = ADMIN_URL ? `${ADMIN_URL}/signup` : '#pricing';
export const LOGIN_URL = ADMIN_URL ? `${ADMIN_URL}/login` : '#signin';

// ---- Arabic copy (same order as the English arrays above) ----
export const PLANS_AR: Pick<Plan, 'description' | 'inherits' | 'features' | 'cta' | 'highlight'>[] = [
  {
    description: 'للمطاعم الصغيرة والمطابخ المنزلية والمتاجر الصغيرة التي تبدأ بالطلب عبر واتساب بالذكاء الاصطناعي.',
    features: [
      'مطعم أو متجر / فرع واحد', 'رقم واتساب للأعمال واحد', 'طلبات نصية بالذكاء الاصطناعي', 'طلبات صوتية بالذكاء الاصطناعي',
      'إدارة القائمة والمنتجات', 'لوحة متابعة الطلبات', 'مناطق التوصيل ورسومه', 'ساعات العمل', 'سجل أساسي للعملاء', 'حساب موظف واحد', 'تحليلات أساسية', '0% عمولة على الطلبات',
    ],
    cta: 'ابدأ مجاناً',
  },
  {
    description: 'للمطاعم والمتاجر النامية التي تحتاج صلاحيات موظفين أكثر ورؤية أفضل لعملائها.',
    inherits: 'كل ما في Starter، بالإضافة إلى:',
    features: ['حتى 3 حسابات موظفين', 'سجل كامل للعملاء', 'تحليلات متقدمة', 'العروض / حملات العملاء', 'أتمتة أساسية', '0% عمولة على الطلبات'],
    cta: 'ابدأ مع Plus',
  },
  {
    description: 'للمطاعم والمتاجر الكبرى الراسخة والعمليات متعددة الفروع.',
    inherits: 'كل ما في Plus، بالإضافة إلى:',
    highlight: 'الباقة الأعلى',
    features: ['حتى 3 فروع', 'حتى 3 أرقام واتساب للأعمال', 'حتى 10 حسابات موظفين', 'أتمتة متقدمة', 'إدارة متعددة الفروع', 'دعم ذو أولوية', 'تهيئة بمساعدة فريقنا', '0% عمولة على الطلبات'],
    cta: 'ابدأ مع Pro',
  },
];

export const FAQ_AR: [string, string][] = [
  ['هل يستبدل لوميا أوردر رقم واتساب الخاص بي؟', 'لا. يربط لوميا أوردر تجربة الطلب عبر واتساب للأعمال في نشاطك بمنصة لوميا، فيبقى عملاؤك يراسلون الرقم الذي يعرفونه.'],
  ['هل يستطيع العملاء إرسال رسائل صوتية؟', 'نعم. يحوّل لوميا الرسائل الصوتية المدعومة إلى طلب منظّم تماماً كالرسالة النصية.'],
  ['ماذا يحدث إذا لم يفهم لوميا الطلب؟', 'يطلب لوميا من العميل التوضيح بدلاً من التخمين.'],
  ['هل يخترع لوميا أصنافاً أو منتجات غير موجودة؟', 'لا. يعمل لوميا فقط من قائمتك أو قائمة منتجاتك المعتمدة.'],
  ['هل يؤكد العميل الطلب أولاً؟', 'نعم. يؤكد العميل الطلب المنظّم قبل إرساله إلى مطعمك أو متجرك.'],
  ['هل أستطيع قبول الطلبات أو رفضها؟', 'نعم. أنت تقبل كل طلب أو ترفضه وتحدد وقت التجهيز المتوقع.'],
  ['هل أستطيع تحديد رسوم التوصيل؟', 'نعم. حدّد رسماً لكل منطقة أو حسب المسافة عن فرعك، وأوقف المناطق غير المتاحة، وضع حداً أدنى للطلب.'],
  ['في أي الدول يعمل لوميا أوردر؟', 'يمكن للأنشطة التجارية في الإمارات الاشتراك اليوم. أما في السعودية وعُمان والبحرين وقطر والكويت فيمكنها إنشاء حساب وإعداد قائمتها أو منتجاتها، مع باقات بالعملة المحلية قريباً. الأسعار في هذه الصفحة بالدرهم الإماراتي (AED).'],
  ['هل أستطيع تعليم صنف على أنه نفد؟', 'نعم. أوقف الصنف ويتوقف لوميا عن عرضه فوراً.'],
  ['هل يتقاضى لوميا عمولة؟', 'لوميا أوردر اشتراك شهري أو سنوي ولا يأخذ أي عمولة (0%) على الطلبات ضمن هذه الباقات.'],
  ['هل طلبات الذكاء الاصطناعي غير محدودة؟', 'الطلبات بالذكاء الاصطناعي مشمولة، وفق شروط الاستخدام العادل.'],
  ['ما هو جهاز لوميا أوردر؟', 'جهاز مخصص لإدارة طلبات المطاعم والمتاجر مع طابعة حرارية مدمجة، لاستقبال الطلبات وقبولها وطباعتها.'],
  ['هل أحتاج إلى الجهاز؟', 'لا. يمكنك إدارة لوميا أوردر من لوحة التحكم على الويب في أي متصفح. الجهاز هو الإعداد الموصى به لمحطة طلبات مخصصة تعمل دائماً مع طباعة مدمجة.'],
  ['كم يستغرق توصيل الجهاز؟', 'التوصيل المتوقع خلال 10–15 يوم عمل، وقد يختلف حسب توفر المخزون.'],
];

export const TERMINAL_SPECS_AR = [
  'شاشة لمس 5.5 بوصة', 'Android 13', 'Wi-Fi', 'دعم 4G / شريحة SIM', 'طابعة حرارية مدمجة 58 مم', 'تنبيهات عالية الصوت للطلبات الجديدة',
  'تشغيل تلقائي للوميا أوردر', 'وضع الكشك (Kiosk)', 'إدارة الجهاز عن بُعد', 'مسح QR / الباركود', 'جهاز بعلامة لوميا أوردر', 'مُهيّأ مسبقاً لنشاطك',
];

export const NAV_LINKS_AR: Record<string, string> = { '#demo': 'المنتج', '#how': 'كيف يعمل', '#terminal': 'الجهاز', '#pricing': 'الأسعار', '#faq': 'الأسئلة الشائعة' };
