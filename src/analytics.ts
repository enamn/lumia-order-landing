// Privacy-friendly site analytics for the landing page. No cookies, nothing stored in the browser, no IP address kept:
// the app that receives the events keeps only the country and an anonymous code that changes every day.
// Events: page_view, plans_view (the pricing section was on screen), cta_free_trial ("Start free" buttons),
// cta_signup (the other sign-up buttons), login_click. Browsers that send Do Not Track or Global Privacy Control are not counted.
type Name = 'page_view' | 'plans_view' | 'cta_free_trial' | 'cta_signup' | 'login_click';

const env = (import.meta as unknown as { env?: { VITE_TRACK_URL?: string; VITE_ADMIN_URL?: string; DEV?: boolean; PROD?: boolean } }).env;
const ADMIN = (env?.VITE_ADMIN_URL ?? (env?.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');
const ENDPOINT = env?.VITE_TRACK_URL ?? (ADMIN ? `${ADMIN}/api/public/track` : '');

const optedOut = () => {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
};

export function track(event: Name, loc?: string) {
  if (!ENDPOINT || optedOut()) return;
  const q = new URLSearchParams(location.search);
  const body = JSON.stringify({ event, loc, path: location.pathname, ref: document.referrer ? new URL(document.referrer).hostname : '', utm: q.get('utm_source') ?? q.get('ref') ?? '', w: window.innerWidth });
  try {
    // text/plain keeps this a "simple" cross-site request (no preflight); keepalive lets it finish while the browser is leaving for the sign-up page.
    void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(() => undefined);
  } catch { /* analytics must never break the page */ }
}

// Called once from the app: counts the visit, the pricing section coming into view, and clicks on anything marked data-track="free_trial|signup|login".
export function startAnalytics() {
  if (!ENDPOINT || optedOut()) return;
  if (!window.location.pathname.match(/^\/(privacy|terms|data-deletion)\/?$/)) track('page_view');
  const pricing = document.getElementById('pricing');
  if (pricing && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { track('plans_view'); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(pricing);
  }
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest?.('[data-track]');
    if (!el) return;
    const kind = el.getAttribute('data-track');
    const loc = el.getAttribute('data-loc') ?? undefined;
    if (kind === 'free_trial') track('cta_free_trial', loc);
    else if (kind === 'signup') track('cta_signup', loc);
    else if (kind === 'login') track('login_click', loc);
  }, { capture: true });
}
