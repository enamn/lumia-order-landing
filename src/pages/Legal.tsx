import { useEffect, type ReactNode } from 'react';
import { Header, LegalLinks } from '../sections/Chrome';
import { useT } from '../i18n';

export const PRIVACY_EMAIL = 'privacy@lumia.ae';
const LAST_UPDATED = '28 September 2026';
const LAST_UPDATED_AR = '28 سبتمبر 2026';

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

function LegalLayout({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  const t = useT();
  useEffect(() => {
    document.title = `${title} — ${t('Lumia Order', 'لوميا أوردر')}`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="legal-page">
      <Header />
      <main className="legal">
        <div className="eyebrow eyebrow--lg">{eyebrow ?? t('Legal', 'قانوني')}</div>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="legal-footer">
        <div className="wrap footer__legal">
          <LegalLinks />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>{t(<>Built for bold ideas. Lumia is a product of <a href="https://afkario.com/" target="_blank" rel="noopener">Afkar IO FZE LLC</a>.</>, <>صُنع للأفكار الجريئة. لوميا منتج من <a href="https://afkario.com/" target="_blank" rel="noopener">Afkar IO FZE LLC</a>.</>)}</span>
            <span>{t('© 2026 Lumia. All rights reserved.', '© 2026 لوميا. جميع الحقوق محفوظة.')}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function PrivacyPage() {
  const t = useT();
  return (
    <LegalLayout title={t('Privacy Policy', 'سياسة الخصوصية')}>
      <p className="legal__date">{t('Last updated:', 'آخر تحديث:')} {t(LAST_UPDATED, LAST_UPDATED_AR)}</p>
      <p className="legal__intro">
        {t(
          'Lumia Order is a restaurant ordering platform developed and operated by Afkar IO FZE LLC. This policy explains how Lumia Order processes personal information when restaurants use the service and when their customers order through WhatsApp. It covers the Lumia Order platform, the web dashboard, the Lumia Order Terminal and this website.',
          'لوميا أوردر منصة لطلبات المطاعم من تطوير وتشغيل Afkar IO FZE LLC. توضح هذه السياسة كيف يعالج لوميا أوردر المعلومات الشخصية عندما تستخدم المطاعم الخدمة وعندما يطلب عملاؤها عبر واتساب. وتشمل منصة لوميا أوردر ولوحة التحكم على الويب وجهاز لوميا أوردر وهذا الموقع.'
        )}
      </p>
      <div className="legal__body">
        <Section title={t('1. Restaurant information', '1. معلومات المطعم')}>
          <p>{t('When a restaurant uses Lumia Order, we may process:', 'عندما يستخدم المطعم لوميا أوردر، قد نعالج:')}</p>
          <List items={t(['Restaurant name', 'Account and contact information', 'Branch details', 'Menu items and prices', 'Opening hours', 'Delivery areas and fees', 'Staff accounts', 'Subscription information'], ['اسم المطعم', 'معلومات الحساب والتواصل', 'تفاصيل الفروع', 'أصناف القائمة وأسعارها', 'ساعات العمل', 'مناطق التوصيل ورسومه', 'حسابات الموظفين', 'معلومات الاشتراك'])} />
        </Section>
        <Section title={t('2. WhatsApp information', '2. معلومات واتساب')}>
          <p>{t('Lumia Order may process data received through the WhatsApp Business Platform, including:', 'قد يعالج لوميا أوردر البيانات الواردة عبر منصة واتساب للأعمال، ومنها:')}</p>
          <List items={t(['Phone number / WhatsApp identifier', 'Customer messages', 'Timestamps', 'Voice messages', 'Images or documents sent during an order', 'Order-related conversation information'], ['رقم الهاتف / معرّف واتساب', 'رسائل العملاء', 'الأوقات والتواريخ', 'الرسائل الصوتية', 'الصور أو المستندات المرسلة أثناء الطلب', 'معلومات المحادثة المتعلقة بالطلب'])} />
        </Section>
        <Section title={t('3. Customer order information', '3. معلومات طلبات العملاء')}>
          <p>{t('When a customer places an order, Lumia Order may process:', 'عندما يقدّم العميل طلباً، قد يعالج لوميا أوردر:')}</p>
          <List items={t(['Customer name', 'Phone number', 'Ordered items', 'Quantities', 'Special instructions', 'Delivery address / location', 'Order total', 'Payment status', 'Order history'], ['اسم العميل', 'رقم الهاتف', 'الأصناف المطلوبة', 'الكميات', 'التعليمات الخاصة', 'عنوان التوصيل / الموقع', 'إجمالي الطلب', 'حالة الدفع', 'سجل الطلبات'])} />
        </Section>
        <Section title={t('4. AI processing', '4. المعالجة بالذكاء الاصطناعي')}>
          <p>{t('Text and voice messages may be processed using AI services, including third-party AI providers, in order to:', 'قد تُعالج الرسائل النصية والصوتية باستخدام خدمات الذكاء الاصطناعي، ومنها خدمات مزوّدين من أطراف ثالثة، بهدف:')}</p>
          <List items={t(['Understand customer requests', 'Extract order information', 'Answer customers', 'Create and update orders'], ['فهم طلبات العملاء', 'استخراج معلومات الطلب', 'الرد على العملاء', 'إنشاء الطلبات وتحديثها'])} />
        </Section>
        <Section title={t('5. Technical data', '5. البيانات التقنية')}>
          <p>{t('We may collect technical data such as:', 'قد نجمع بيانات تقنية مثل:')}</p>
          <List items={t(['IP address', 'Browser / device type', 'Terminal identifiers', 'Application version', 'Diagnostic logs', 'Authentication and security events'], ['عنوان IP', 'نوع المتصفح / الجهاز', 'معرّفات الجهاز الطرفي', 'إصدار التطبيق', 'سجلات التشخيص', 'أحداث المصادقة والأمان'])} />
          <p>{t(
            'On our public website we count visits, the pricing section being viewed and clicks on sign-up buttons. We do this without cookies and do not keep your IP address: we keep only your country and an anonymous code that changes every day. We do not count visitors whose browser sends Do Not Track or Global Privacy Control.',
            'في موقعنا العام نحتسب الزيارات ومشاهدة قسم الأسعار والنقرات على أزرار التسجيل. نفعل ذلك دون ملفات تعريف الارتباط ولا نحتفظ بعنوان IP الخاص بك، بل نحتفظ فقط ببلدك ورمز مجهول يتغير كل يوم. ولا نحتسب الزوار الذين يرسل متصفحهم إشارة عدم التتبع (Do Not Track) أو التحكم العالمي في الخصوصية (Global Privacy Control).'
          )}</p>
        </Section>
        <Section title={t('6. Purpose of processing', '6. أغراض المعالجة')}>
          <p>{t('We use this information to:', 'نستخدم هذه المعلومات من أجل:')}</p>
          <List items={t(['Provide Lumia Order', 'Receive and manage orders', 'Respond through WhatsApp', 'Process AI text and voice requests', 'Show orders to restaurants', 'Print orders', 'Maintain order and customer history', 'Provide support', 'Operate subscriptions', 'Protect against abuse and security issues', 'Meet legal obligations'], ['تقديم لوميا أوردر', 'استقبال الطلبات وإدارتها', 'الرد عبر واتساب', 'معالجة الطلبات النصية والصوتية بالذكاء الاصطناعي', 'عرض الطلبات للمطاعم', 'طباعة الطلبات', 'الاحتفاظ بسجل الطلبات والعملاء', 'تقديم الدعم', 'إدارة الاشتراكات', 'الحماية من إساءة الاستخدام والمشكلات الأمنية', 'الوفاء بالالتزامات القانونية'])} />
        </Section>
        <Section title={t('7. WhatsApp Business Platform', '7. منصة واتساب للأعمال')}>
          <p>{t(
            'Lumia Order integrates with the WhatsApp Business Platform provided by Meta. WhatsApp-related data may also be processed according to the applicable Meta and WhatsApp terms and policies. Lumia Order is an independent service and is not owned by or officially endorsed by Meta.',
            'يتكامل لوميا أوردر مع منصة واتساب للأعمال التي تقدمها شركة Meta. وقد تُعالج البيانات المتعلقة بواتساب أيضاً وفق شروط وسياسات Meta وواتساب المعمول بها. لوميا أوردر خدمة مستقلة، وليست مملوكة لشركة Meta ولا معتمدة رسمياً منها.'
          )}</p>
        </Section>
        <Section title={t('8. Third-party services', '8. خدمات الأطراف الثالثة')}>
          <p>{t('Lumia Order may use service providers for functions such as:', 'قد يستعين لوميا أوردر بمزوّدي خدمات لوظائف مثل:')}</p>
          <List items={t(['WhatsApp messaging', 'Cloud infrastructure', 'AI processing', 'Payment processing', 'Email', 'Customer support', 'Device management', 'Diagnostics'], ['رسائل واتساب', 'البنية التحتية السحابية', 'المعالجة بالذكاء الاصطناعي', 'معالجة المدفوعات', 'البريد الإلكتروني', 'دعم العملاء', 'إدارة الأجهزة', 'التشخيص'])} />
          <p>{t('These providers process information on our behalf and only as needed to deliver their service.', 'يعالج هؤلاء المزوّدون المعلومات نيابةً عنا وبالقدر اللازم فقط لتقديم خدمتهم.')}</p>
        </Section>
        <Section title={t('9. Data retention', '9. الاحتفاظ بالبيانات')}>
          <p>{t(
            'Lumia Order retains personal information only for as long as necessary to provide the service, maintain required business records, resolve disputes, prevent abuse and comply with applicable legal obligations.',
            'يحتفظ لوميا أوردر بالمعلومات الشخصية فقط للمدة اللازمة لتقديم الخدمة، والاحتفاظ بالسجلات التجارية المطلوبة، وحل النزاعات، ومنع إساءة الاستخدام، والامتثال للالتزامات القانونية المعمول بها.'
          )}</p>
        </Section>
        <Section title={t('10. Data deletion', '10. حذف البيانات')}>
          <p>{t(
            <>You can request deletion of personal information associated with Lumia Order. See the <a href="/data-deletion">Data Deletion</a> page for instructions.</>,
            <>يمكنك طلب حذف المعلومات الشخصية المرتبطة بلوميا أوردر. راجع صفحة <a href="/data-deletion">حذف البيانات</a> للاطلاع على الخطوات.</>
          )}</p>
        </Section>
        <Section title={t('11. Contact', '11. التواصل')}>
          <p>{t(<>For privacy questions or requests, contact us at <Email />.</>, <>للاستفسارات أو الطلبات المتعلقة بالخصوصية، تواصل معنا على <Email />.</>)}</p>
        </Section>
      </div>
    </LegalLayout>
  );
}

export function DataDeletionPage() {
  const t = useT();
  return (
    <LegalLayout title={t('Lumia Order Data Deletion', 'حذف بيانات لوميا أوردر')} eyebrow={t('Legal · /data-deletion', 'قانوني · /data-deletion')}>
      <div className="legal__intro" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
        <p>{t('Users can request deletion of personal information associated with Lumia Order.', 'يمكن للمستخدمين طلب حذف المعلومات الشخصية المرتبطة بلوميا أوردر.')}</p>
        <p>
          {t(
            'To request deletion, contact Lumia Order using the privacy contact information provided below and include enough information for us to identify the relevant account or WhatsApp interaction.',
            'لطلب الحذف، تواصل مع لوميا أوردر عبر معلومات التواصل الخاصة بالخصوصية أدناه، وأرفق معلومات كافية لنتمكن من تحديد الحساب أو محادثة واتساب المعنية.'
          )}
        </p>
        <p>{t('We may request additional information only when necessary to verify the request and protect against unauthorized deletion.', 'قد نطلب معلومات إضافية فقط عند الضرورة للتحقق من الطلب والحماية من الحذف غير المصرّح به.')}</p>
        <p>{t('Eligible data will be deleted or de-identified unless retention is required by applicable law.', 'ستُحذف البيانات المؤهلة أو تُجرَّد من هوية صاحبها ما لم يوجب القانون المعمول به الاحتفاظ بها.')}</p>
      </div>
      <div className="legal__contact">
        <div className="eyebrow">{t('Privacy contact', 'التواصل بشأن الخصوصية')}</div>
        <div style={{ marginTop: 10 }}>
          <a className="legal__email" style={{ background: '#fff', fontSize: 15, padding: '4px 8px', borderRadius: 6 }} href={`mailto:${PRIVACY_EMAIL}?subject=Data%20deletion%20request`}>
            {PRIVACY_EMAIL}
          </a>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', marginTop: 14 }}>
          {t('Please include your restaurant account name or the WhatsApp number you used to order.', 'يرجى ذكر اسم حساب مطعمك أو رقم واتساب الذي استخدمته للطلب.')}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 15, marginTop: 28 }}>
        {t(<>See also our <a href="/privacy">Privacy Policy</a>.</>, <>راجع أيضاً <a href="/privacy">سياسة الخصوصية</a>.</>)}
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  const t = useT();
  return (
    <LegalLayout title={t('Terms of Service', 'شروط الخدمة')}>
      <p className="legal__date">{t('Last updated:', 'آخر تحديث:')} {t(LAST_UPDATED, LAST_UPDATED_AR)}</p>
      <p className="legal__intro">
        {t(
          'These terms govern the use of Lumia Order, including the platform, the web dashboard, the Lumia Order Terminal and this website. Lumia Order is a restaurant ordering platform developed and operated by Afkar IO FZE LLC. By creating an account or using the service, the restaurant ("you") agrees to these terms.',
          'تحكم هذه الشروط استخدام لوميا أوردر، بما في ذلك المنصة ولوحة التحكم على الويب وجهاز لوميا أوردر وهذا الموقع. لوميا أوردر منصة لطلبات المطاعم من تطوير وتشغيل Afkar IO FZE LLC. بإنشاء حساب أو استخدام الخدمة، يوافق المطعم («أنت») على هذه الشروط.'
        )}
      </p>
      <div className="legal__body">
        <Section title={t('1. The service', '1. الخدمة')}>
          <p>{t(
            "Lumia Order lets restaurants receive customer orders through WhatsApp. Lumia uses AI to understand text and voice messages, structure them into orders based on the restaurant's approved menu, confirm them with the customer and deliver them to the restaurant through the web dashboard or the Lumia Order Terminal.",
            'يتيح لوميا أوردر للمطاعم استقبال طلبات العملاء عبر واتساب. يستخدم لوميا الذكاء الاصطناعي لفهم الرسائل النصية والصوتية، وتنظيمها في طلبات بناءً على قائمة المطعم المعتمدة، وتأكيدها مع العميل، وإيصالها إلى المطعم عبر لوحة التحكم على الويب أو جهاز لوميا أوردر.'
          )}</p>
        </Section>
        <Section title={t('2. Accounts', '2. الحسابات')}>
          <p>{t(
            'You must provide accurate account and restaurant information and keep your login credentials secure. You are responsible for all activity under your account, including actions taken by your staff accounts.',
            'يجب عليك تقديم معلومات دقيقة عن الحساب والمطعم والحفاظ على أمان بيانات تسجيل الدخول. أنت مسؤول عن كل نشاط يتم عبر حسابك، بما في ذلك ما تقوم به حسابات موظفيك.'
          )}</p>
        </Section>
        <Section title={t('3. Plans, trial and billing', '3. الباقات والتجربة والفوترة')}>
          <List items={t(['Plans are billed monthly or yearly in advance', 'New accounts may start with a 14-day free trial', 'Lumia Order takes 0% commission per order under the published plans', 'Prices are shown in AED and may change with prior notice', 'Subscriptions renew automatically until cancelled', 'Fees already paid are non-refundable unless required by law'], ['تُفوتر الباقات شهرياً أو سنوياً مقدماً', 'قد تبدأ الحسابات الجديدة بتجربة مجانية لمدة 14 يوماً', 'لا يتقاضى لوميا أوردر أي عمولة (0%) على الطلب ضمن الباقات المعلنة', 'تُعرض الأسعار بالدرهم الإماراتي وقد تتغير بإشعار مسبق', 'تُجدَّد الاشتراكات تلقائياً حتى يتم إلغاؤها', 'الرسوم المدفوعة سابقاً غير قابلة للاسترداد ما لم يوجب القانون ذلك'])} />
        </Section>
        <Section title={t('4. Fair use of AI ordering', '4. الاستخدام العادل للطلب بالذكاء الاصطناعي')}>
          <p>{t(
            'AI ordering is included in every plan, subject to fair-use terms. We may contact you, limit usage or suggest a different plan if usage is significantly beyond what is typical for your plan or harms the service for others.',
            'الطلب بالذكاء الاصطناعي مشمول في كل باقة وفق شروط الاستخدام العادل. وقد نتواصل معك أو نحدّ من الاستخدام أو نقترح باقة مختلفة إذا تجاوز استخدامك بشكل كبير المعتاد لباقتك أو أضرّ بالخدمة المقدمة للآخرين.'
          )}</p>
        </Section>
        <Section title={t('5. Your menu and your orders', '5. قائمتك وطلباتك')}>
          <p>{t(
            'Lumia works from the menu, prices, options, availability and delivery rules that you approve. You are responsible for keeping this information accurate, for preparing and delivering orders, for food quality and safety, and for complying with laws that apply to your business. The sale of food is between you and your customer; Lumia Order is not a party to it.',
            'يعمل لوميا اعتماداً على القائمة والأسعار والخيارات والتوفر وقواعد التوصيل التي تعتمدها. أنت مسؤول عن إبقاء هذه المعلومات دقيقة، وعن تحضير الطلبات وتوصيلها، وعن جودة الطعام وسلامته، وعن الالتزام بالقوانين المطبقة على نشاطك. بيع الطعام يتم بينك وبين عميلك، ولوميا أوردر ليس طرفاً فيه.'
          )}</p>
          <p>{t(
            'Customers confirm each order before it is sent to you, and you accept or reject every order. AI can make mistakes, so please review orders before accepting them.',
            'يؤكد العملاء كل طلب قبل إرساله إليك، وأنت تقبل كل طلب أو ترفضه. قد يخطئ الذكاء الاصطناعي، لذا يرجى مراجعة الطلبات قبل قبولها.'
          )}</p>
        </Section>
        <Section title={t('6. WhatsApp Business Platform', '6. منصة واتساب للأعمال')}>
          <p>{t(
            'Lumia Order integrates with the WhatsApp Business Platform provided by Meta. You must comply with the applicable WhatsApp Business and Meta terms and policies, including messaging and opt-in rules. Lumia Order is an independent service and is not owned by or officially endorsed by Meta.',
            'يتكامل لوميا أوردر مع منصة واتساب للأعمال التي تقدمها شركة Meta. يجب عليك الالتزام بشروط وسياسات واتساب للأعمال وMeta المعمول بها، بما فيها قواعد المراسلة والموافقة المسبقة. لوميا أوردر خدمة مستقلة، وليست مملوكة لشركة Meta ولا معتمدة رسمياً منها.'
          )}</p>
        </Section>
        <Section title={t('7. Lumia Order Terminal', '7. جهاز لوميا أوردر')}>
          <p>{t(
            'The Lumia Order Terminal is an optional device sold for a one-time price. Estimated delivery is 10–15 business days and may vary depending on stock availability. Launch and plan-based terminal prices apply as published at the time of purchase. Every plan also works with the web dashboard.',
            'جهاز لوميا أوردر جهاز اختياري يُباع بسعر لمرة واحدة. التوصيل المتوقع من 10 إلى 15 يوم عمل وقد يختلف حسب توفر المخزون. تُطبَّق أسعار الجهاز عند الإطلاق وحسب الباقة كما هي معلنة وقت الشراء. وتعمل كل الباقات أيضاً مع لوحة التحكم على الويب.'
          )}</p>
        </Section>
        <Section title={t('8. Acceptable use', '8. الاستخدام المقبول')}>
          <p>{t('You must not use Lumia Order to:', 'يُحظر عليك استخدام لوميا أوردر من أجل:')}</p>
          <List items={t(['Send spam or unsolicited messages', 'Sell prohibited or illegal products', 'Mislead or defraud customers', 'Interfere with or reverse-engineer the service', 'Access other accounts or data without permission', 'Violate any applicable law'], ['إرسال رسائل مزعجة أو غير مرغوب فيها', 'بيع منتجات محظورة أو غير قانونية', 'تضليل العملاء أو الاحتيال عليهم', 'التدخل في الخدمة أو إجراء هندسة عكسية لها', 'الوصول إلى حسابات أو بيانات أخرى دون إذن', 'مخالفة أي قانون معمول به'])} />
        </Section>
        <Section title={t('9. Data and privacy', '9. البيانات والخصوصية')}>
          <p>{t(
            <>Our <a href="/privacy">Privacy Policy</a> explains how personal information is processed. You keep ownership of your restaurant and customer data, and you grant us the rights needed to process it to provide the service.</>,
            <>توضح <a href="/privacy">سياسة الخصوصية</a> لدينا كيفية معالجة المعلومات الشخصية. تحتفظ بملكية بيانات مطعمك وعملائك، وتمنحنا الحقوق اللازمة لمعالجتها من أجل تقديم الخدمة.</>
          )}</p>
        </Section>
        <Section title={t('10. Availability and changes', '10. التوفر والتغييرات')}>
          <p>{t(
            'We work to keep Lumia Order available and reliable, but we do not guarantee uninterrupted service. We may update or improve features over time and will give notice of material changes to these terms.',
            'نعمل على إبقاء لوميا أوردر متاحاً وموثوقاً، لكننا لا نضمن خدمة دون انقطاع. وقد نحدّث الميزات أو نحسّنها مع الوقت، وسنخطرك بالتغييرات الجوهرية على هذه الشروط.'
          )}</p>
        </Section>
        <Section title={t('11. Limitation of liability', '11. حدود المسؤولية')}>
          <p>{t(
            'To the extent permitted by law, Lumia Order is provided "as is", and Afkar IO is not liable for indirect or consequential losses, lost profits or lost orders. Our total liability is limited to the fees you paid for the service in the three months before the claim.',
            'بالقدر الذي يسمح به القانون، يُقدَّم لوميا أوردر «كما هو»، ولا تتحمل Afkar IO المسؤولية عن الخسائر غير المباشرة أو التبعية أو فوات الأرباح أو الطلبات الفائتة. وتقتصر مسؤوليتنا الإجمالية على الرسوم التي دفعتها مقابل الخدمة خلال الأشهر الثلاثة السابقة للمطالبة.'
          )}</p>
        </Section>
        <Section title={t('12. Cancellation and termination', '12. الإلغاء والإنهاء')}>
          <p>{t(
            <>You can cancel your subscription at any time; access continues until the end of the paid period. We may suspend or close accounts that breach these terms. You can request deletion of your data as described on the <a href="/data-deletion">Data Deletion</a> page.</>,
            <>يمكنك إلغاء اشتراكك في أي وقت، ويستمر الوصول حتى نهاية الفترة المدفوعة. وقد نعلّق أو نغلق الحسابات التي تخالف هذه الشروط. ويمكنك طلب حذف بياناتك كما هو موضح في صفحة <a href="/data-deletion">حذف البيانات</a>.</>
          )}</p>
        </Section>
        <Section title={t('13. Governing law', '13. القانون الحاكم')}>
          <p>{t('These terms are governed by the laws of the United Arab Emirates.', 'تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة.')}</p>
        </Section>
        <Section title={t('14. Contact', '14. التواصل')}>
          <p>{t(<>For questions about these terms, contact us at <Email />.</>, <>للاستفسار عن هذه الشروط، تواصل معنا على <Email />.</>)}</p>
        </Section>
      </div>
    </LegalLayout>
  );
}
