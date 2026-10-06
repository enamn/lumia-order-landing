// @ts-nocheck -- ported from the design's script (design/settings.dc.html); the view-model is untyped by design.
/* eslint-disable */
"use client";
// Restaurant settings: the markup is generated from the design (SettingsTemplate); this component keeps the page state,
// saves each page through /api/v1/businesses/:id/settings/:section and feeds the template its view-model.
import React from "react";
import "./dc-base.css";
import "./settings-hover.css";
import { SettingsTemplate } from "./SettingsTemplate";
import { EmailVerify } from "./EmailVerify";
import { logoToDataUrl } from "@/lib/logo";
import { ContentLoader } from "@/components/lumia-loader";

export interface SettingsProps {
  businessId: string;
  query: string;
  onPremium?: () => void; onSaved?: () => void;
  initial: { sections: any; emailVerified?: boolean; branchLimit?: number; branchBuy?: { priceAed: number; period: string; payNowMinor: number; card: string | null; hasCard: boolean } | null; menu: { categories: number; items: number; missingPrices: number; soldOut: number; updatedAt: string | null }; whatsapp: { connected: boolean; displayPhoneNumber: string } };
}
type Props = SettingsProps;

const SEC_PAGE = {"s0":"profile","s1":"profile","s2":"profile","s3":"profile","s4":"whatsapp","s5":"delivery","s6":"delivery","s7":"delivery","s8":"delivery","s9":"delivery","s10":"delivery","s11":"delivery","s12":"delivery","s13":"devices"};
async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? json.message ?? "Something went wrong. Please try again.");
  return json.data ?? json;
}
// Pulls "latitude, longitude" out of a pasted Google Maps link or plain coordinates.
function coordsFromText(text: string): string | null {
  const t = decodeURIComponent(text.trim());
  const m = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/.exec(t) ?? /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(t) ?? /[?&](?:q|ll|query)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(t) ?? /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/.exec(t);
  if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return null;
  return `${m[1]}, ${m[2]}`;
}

const EM = ['Sharjah', 'Ajman', 'Dubai', 'Abu Dhabi', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PAGES = [
  ['profile', 'Profile', 'M4 8h12l-1.2-4H5.2zM5 8v8.5h10V8M8.5 16.5v-4h3v4'],
  ['branches', 'Branches', 'M10 17.5s5.5-4.8 5.5-9a5.5 5.5 0 0 0-11 0c0 4.2 5.5 9 5.5 9zM10 10.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z'],
  ['whatsapp', 'WhatsApp', 'M3.5 16.5 4.6 13A7 7 0 1 1 7.3 15.6z'],
  ['delivery', 'Delivery', 'M2.5 5.5h9v8h-9zM11.5 8.5h3l3 3v2h-6M7 15a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM16 15a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z'],
  ['hours', 'Hours', 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6.5V10l2.5 1.5'],
  ['menu', 'Menu', 'M7 5.5h10M7 10h10M7 14.5h10M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01'],
  ['devices', 'Devices', 'M5.5 8V3.5h9V8M5.5 14H3V8h14v6h-2.5M6 11h8v6H6z'],
  ['payments', 'Payments', 'M2.5 5.5h15v9h-15zM10 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM5.5 8v4M14.5 8v4'],
];
const KEY: Record<string, string> = { profile: 'profile', branches: 'branches', whatsapp: 'wa', delivery: 'delivery', hours: 'hours', payments: 'pay' };
const OK: Record<string, string> = { profile: 'Restaurant profile saved.', branches: 'Branches saved.', whatsapp: 'WhatsApp settings saved.', delivery: 'Delivery settings saved.', hours: 'Working hours saved.', payments: 'Payment settings saved.' };
const TONE: Record<string, string[]> = { ok: ['#E6F4EC', '#16704A'], warn: ['#FFF1DC', '#8A4B00'], bad: ['#FDECEC', '#B42318'], neutral: ['#F6EEF2', '#3D1C31'] };
const clone = (o: any) => JSON.parse(JSON.stringify(o));
const fmt12 = (t: string) => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 && h < 24 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
const newBranch = (): any => ({ name: '', emirate: 'Dubai', area: '', address: '', phone: '', eta: '45', active: true, pin: false, coords: '' });
class SettingsApp extends React.Component<Props, any> {
  tt: any; ro?: ResizeObserver; _lastPage?: string;
  rootRef = React.createRef<HTMLDivElement>();
  mainRef = React.createRef<HTMLDivElement>();
  constructor(props: Props) {
    super(props);
    const d = props.initial.sections, hp = typeof location !== 'undefined' ? location.hash.slice(1) : '';
    this.state = { w: 1200, page: PAGES.some(p => p[0] === hp) ? hp : 'profile', draft: clone(d), saved: clone(d), toast: '', error: '', blocked: null, saving: false, adding: false, nb: newBranch(), pinMode: 'current', pinQ: '', calc: { branch: d.branches[0]?.id ?? '', emirate: 'Sharjah', area: '', dist: '7', sub: '45' }, menu: props.initial.menu, wa: props.initial.whatsapp };
  }

  componentDidMount() {
    this.measure(true);
    window.addEventListener('resize', this.onResize);
    history.replaceState(null, '', location.pathname + location.search + '#' + this.state.page);
  }
  componentDidUpdate() {
    if (this._lastPage !== this.state.page) { this._lastPage = this.state.page; if (this.mainRef.current) this.mainRef.current.scrollTop = 0; }
  }
  wrap = React.createRef<HTMLDivElement>();
  // Width of the area Settings fills inside the dashboard (not the whole window).
  measure = (first = false) => { const w = this.wrap.current?.clientWidth || window.innerWidth; if (first || w !== this.state.w) this.setState({ w, ...(first ? { mounted: true } : {}) }); };
  onResize = () => this.measure();
  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize); this.ro && this.ro.disconnect(); clearTimeout(this.tt); }

  upd(k, fn) { this.setState(s => { const v = clone(s.draft[k]); fn(v); return { draft: { ...s.draft, [k]: v }, toast: '', error: '' }; }); }
  dirtyOf(s, page) { const k = KEY[page]; return !!k && JSON.stringify(s.draft[k]) !== JSON.stringify(s.saved[k]); }
  go(p: string) { const s = this.state; if (p === s.page) return; if (this.dirtyOf(s, s.page)) { this.setState({ blocked: p }); return; } this.setState({ page: p, blocked: null, toast: '', error: '', adding: false }); history.replaceState(null, '', location.pathname + location.search + '#' + p); }
  // Pro: another branch for a monthly fee, paid with the card on file; the limit grows as soon as the payment goes through.
  async buyBranch(then: () => void) {
    const bb = this.props.initial.branchBuy; if (!bb) return;
    if (!bb.hasCard) { this.setState({ error: 'Add a card in Billing first to add a branch.' }); return; }
    if (!window.confirm(`Add a branch for AED ${bb.priceAed} a ${bb.period} (+ VAT)? You pay AED ${(bb.payNowMinor / 100).toFixed(2)} now for the rest of this period, charged to your card ending ${bb.card ?? ''}.`)) return;
    try { await api(`/api/v1/businesses/${this.props.businessId}/subscription/branch`, 'POST', { requestId: crypto.randomUUID() }); this.props.initial.branchLimit = (this.props.initial.branchLimit ?? 1) + 1; cache.delete(this.props.businessId); this.flash('Branch added to your plan.'); then(); }
    catch (e: any) { this.setState({ error: e.message }); }
  }
  flash(msg) { clearTimeout(this.tt); this.setState({ toast: msg }); this.tt = setTimeout(() => this.setState({ toast: '' }), 3000); }
  async save() {
    const s = this.state, k = KEY[s.page]; if (!k || s.saving) return;
    this.setState({ saving: true, error: '' });
    try {
      const res = await api(`/api/v1/businesses/${this.props.businessId}/settings/${k}`, 'PUT', s.draft[k]);
      const next = s.blocked;
      this.setState((st: any) => ({ draft: { ...st.draft, [k]: clone(res.value) }, saved: { ...st.saved, [k]: clone(res.value) }, error: '', blocked: null, saving: false, ...(next ? { page: next } : {}) }));
      this.flash(OK[s.page]); rememberSaved(this.props.businessId, k, res.value); this.props.onSaved?.();
      if (k === 'branches') this.refreshAfterBranches();
    } catch (e: any) { this.setState({ error: e?.message ?? 'We couldn’t save. Please try again.', saving: false }); }
  }
  // New branches get real ids on save; pick up the sections that refer to branches unless the owner is mid-edit.
  async refreshAfterBranches() {
    try {
      const fresh = await api(`/api/v1/businesses/${this.props.businessId}/settings`);
      this.setState((st: any) => { const draft = { ...st.draft }, saved = { ...st.saved }; for (const k of ['wa', 'delivery', 'hours']) if (JSON.stringify(draft[k]) === JSON.stringify(saved[k])) { draft[k] = clone(fresh.sections[k]); saved[k] = clone(fresh.sections[k]); } const calc = st.calc.branch && draft.branches.some((b: any) => b.id === st.calc.branch) ? st.calc : { ...st.calc, branch: draft.branches[0]?.id ?? '' }; return { draft, saved, calc }; });
    } catch { /* the next page load shows the latest */ }
  }
  discard() { const s = this.state, k = KEY[s.page]; const next = s.blocked; this.setState(st => ({ draft: { ...st.draft, [k]: clone(st.saved[k]) }, error: '', blocked: null, adding: false, ...(next ? { page: next } : {}) })); }

  renderVals() {
    const s = this.state, d = s.draft, sv = s.saved, wide = s.w >= 900, tw = s.w >= 560 ? s.w - (s.w >= 1000 ? 340 : 260) - 48 : s.w, tblWide = tw >= 700, M = s.menu, menuLevel = M.items === 0 ? 0 : M.missingPrices > 0 ? 2 : 4;
    const ce = React.createElement;
    const selStyle = (sm) => ({ height: sm ? 40 : 44, width: '100%', minWidth: 0, padding: '0 10px', borderRadius: sm ? 9 : 10, border: '1.5px solid #ECD9E0', background: '#fff', fontSize: sm ? 14 : 15 });
    const sel = (value, opts, onChange, sm = true, label) => ce('select', { value, onChange, style: selStyle(sm), 'aria-label': label }, opts.map(o => ce('option', { key: o.v, value: o.v }, o.l)));
    const emOpts = EM.map(e => ({ v: e, l: e }));
    const brOpts = d.branches.map(b => ({ v: b.id, l: b.name }));
    const bName = (id) => (d.branches.find(b => b.id === id) || {}).name || '—';
    const sw = (on, toggle, extra = {}) => ({ on, toggle, tBg: on ? 'linear-gradient(90deg,#FF5577,#C93DFF)' : '#EAD9E1', knob: on ? '20px' : '0px', ...extra });
    const radio = (list, cur, set) => list.map(([v, label, desc]) => { const on = cur === v; return { label, desc, on, bd: on ? '#C93DFF' : '#ECD9E0', bg: on ? '#FCF5FD' : '#fff', ring: on ? '#C93DFF' : '#D9BFCB', dotBg: on ? '#C93DFF' : 'transparent', pick: () => set(v) }; });
    const seg = (list, cur, set) => list.map(([v, label]) => { const on = cur === v; return { label, on, fw: on ? 600 : 500, bg: on ? '#fff' : 'transparent', fg: on ? '#1A0815' : '#8A5A6E', sh: on ? '0 1px 3px rgba(26,8,21,.12)' : 'none', pick: () => set(v) }; });
    const chip = (label, on, pick) => ({ label, on, pick, bg: on ? '#FDEAF2' : '#fff', fg: on ? '#8A2040' : '#3D1C31', bd: on ? '#F3B8CC' : '#ECD9E0' });
    const bind = (k, keys) => Object.fromEntries(keys.map(key => [key, { v: d[k][key] ?? '', set: (e) => { const v = e.target.value; this.upd(k, x => { x[key] = v; }); } }]));

    // completion (saved state)
    const P = sv.profile, profDone = !!(P.name && P.brand && P.phone && (!P.vat || P.trn.replace(/\D/g, '').length === 15));
    const act = sv.branches.filter(b => b.active), locDone = act.length > 0 && act.every(b => b.pin);
    const delDone = sv.delivery.status !== 'available' || !!sv.delivery.method;
    const menuDone = menuLevel >= 3, payDone = sv.pay.cod;
    const MENU_ST = ['No menu uploaded', 'AI extraction in progress', 'Needs review', 'Approved', 'Live'];
    const stepDefs = [
      ['Restaurant profile', profDone, profDone ? ['Complete', 'ok', 'Edit'] : ['Missing', 'bad', 'Complete profile'], 'profile'],
      ['Branch location', locDone, locDone ? ['Complete', 'ok', 'Edit'] : ['Missing', 'bad', 'Add location'], 'branches'],
      [ 'WhatsApp number', s.wa.connected, s.wa.connected ? ['Connected', 'ok', 'Manage'] : ['Not connected', 'bad', 'Connect'], 'whatsapp'],
      ['Menu', menuDone, menuDone ? [MENU_ST[menuLevel], 'ok', 'Edit menu'] : [MENU_ST[menuLevel], 'warn', 'Review menu'], 'menu'],
      ['Delivery settings', delDone, delDone ? ['Complete', 'ok', 'Edit'] : ['Missing', 'bad', 'Configure'], 'delivery'],
      ['Working hours', true, ['Complete', 'ok', 'Edit'], 'hours'],
      ['Payment method', payDone, payDone ? ['Complete', 'ok', 'Edit'] : ['Missing', 'bad', 'Turn on'], 'payments'],
    ];
    const steps = stepDefs.map(([label, done, [status, tone, action], page]) => ({ label, done, todo: !done, status, action, tbg: TONE[tone][0], tfg: TONE[tone][1], ring: tone === 'bad' ? '#E8A0A0' : '#E5B97A',
      bar: done ? '#16704A' : 'rgba(26,8,21,.12)', abd: done ? '#ECD9E0' : 'transparent', abg: done ? '#fff' : '#1A0815', afg: done ? '#1A0815' : '#fff', go: () => this.go(page) }));
    const doneN = steps.filter(x => x.done).length;
    const NOTE = { 'Branch location': 'Needed to calculate delivery distance and fees.', 'Delivery settings': 'Lumia AI cannot calculate delivery fees yet.', 'Menu': 'Lumia AI answers only from an approved menu.', 'Order device': 'Orders still appear in the dashboard, but they will not print.', 'Restaurant profile': 'Name, phone and VAT details.', 'Payment method': 'Customers need a way to pay.' };
    const todo = steps.filter(x => !x.done), todoSteps = todo.map((x, i) => ({ ...x, note: NOTE[x.label] || '', hasNote: !!NOTE[x.label], bt: i ? '1px solid #F3EEF1' : '0' }));
    const doneSteps = steps.filter(x => x.done);
    const isReady = profDone && locDone && menuDone && delDone;
    const ready = isReady ? { label: 'Ready to receive orders', short: 'Ready', bg: TONE.ok[0], fg: TONE.ok[1] } : { label: 'Not ready to receive orders', short: 'Not ready', bg: TONE.bad[0], fg: TONE.bad[1] };
    const warnings = [
      !delDone && ['Delivery settings are missing. Lumia AI cannot calculate delivery fees yet.', 'Configure', 'delivery'],
      !locDone && ['Add a branch location pin so Lumia can calculate delivery distance and fees.', 'Add location', 'branches'],
      !menuDone && ['Menu must be approved before Lumia AI can take orders.', 'Review menu', 'menu'],
    ].filter(Boolean).map(([text, action, p]) => ({ text, action, go: () => this.go(p) }));
    const flagOf: Record<string, boolean> = { profile: !profDone, branches: !locDone, delivery: !delDone, menu: !menuDone, payments: !payDone };
    const navAll = PAGES.map(([k, label, icon]) => { const on = s.page === k; const f = flagOf[k]; return { label, icon, flag: !!f, dot: k === 'devices' || k === 'menu' ? '#E39A2B' : '#E5484D', fw: on ? 600 : 500, fg: on ? '#1A0815' : '#3D1C31', bg: on ? '#FDEAF2' : 'transparent', bd: on ? '#FF5577' : 'transparent', pick: (e) => { e && e.preventDefault && e.preventDefault(); this.go(k); } }; });

    const nav = navAll;
    const navGroups = [{ hasLabel: true, label: 'Settings', count: '', items: navAll }];
    // profile
    const pr = d.profile, brand = pr.brand.trim() || 'Your restaurant';
    const initials = brand.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const GREET = { friendly: `Hi, welcome to ${brand}. What would you like to order today?`, formal: `Welcome to ${brand}. How may we help you with your order today?`, short: `Hi! What can we get you from ${brand}?` };
    const GREET_AR = { friendly: `أهلاً بك في ${brand}. ماذا تحب أن تطلب اليوم؟`, formal: `مرحباً بكم في ${brand}. كيف يمكننا مساعدتكم في طلبكم اليوم؟`, short: `أهلاً! ماذا نحضّر لك من ${brand}؟` };
    const greetBubbles = [pr.lang !== 'ar' && { text: GREET[pr.greet], dir: 'ltr' }, pr.lang !== 'en' && { text: GREET_AR[pr.greet], dir: 'rtl' }].filter(Boolean);
    const trnOk = pr.trn.replace(/\D/g, '').length === 15;

    // branches
    const pinMissing = d.branches.some(b => b.active && !b.pin);
    const branchCards = d.branches.map(b => ({ name: b.name, addr: `${b.area}, ${b.emirate}`, status: b.active ? 'Active' : 'Inactive', sbg: b.active ? TONE.ok[0] : TONE.neutral[0], sfg: b.active ? TONE.ok[1] : TONE.neutral[1], noPin: !b.pin,
            addPin: () => this.locate(c => this.upd('branches', x => { const t = x.find((y: any) => y.id === b.id); t.pin = true; t.coords = c; })),
      rows: [
        { k: 'Location pin', v: b.pin ? 'Added' : 'Missing', fg: b.pin ? '#16704A' : '#B42318' },
        { k: 'WhatsApp', v: s.wa.connected ? s.wa.displayPhoneNumber : 'Not connected', fg: s.wa.connected ? '#1A0815' : '#8A4B00' },
        { k: 'Delivery', v: d.delivery.status === 'available' ? 'Active' : d.delivery.status === 'pickup' ? 'Pickup only' : 'Paused', fg: '#1A0815' },
        { k: 'Working hours', v: 'Set', fg: '#1A0815' },
      ] }));
    const nbS = s.nb, setNb = (key, v) => this.setState(st => ({ nb: { ...st.nb, [key]: v } }));
    const nb = Object.fromEntries(['name', 'area', 'address', 'phone', 'eta'].map(k => [k, { v: nbS[k], set: (e) => setNb(k, e.target.value) }]));
    nb.emSel = sel(nbS.emirate, emOpts, (e) => setNb('emirate', e.target.value), false, 'Emirate');
    const setPin = () => {
      if (s.pinMode === 'paste') { const c = coordsFromText(s.pinQ); if (c) this.setState((st: any) => ({ nb: { ...st.nb, pin: true, coords: c }, error: '' })); else this.setState({ error: 'We couldn’t find a location in that link. Paste a Google Maps link that shows the pin, or "latitude, longitude".' }); }
      else this.locate((c: string) => this.setState((st: any) => ({ nb: { ...st.nb, pin: true, coords: c } })));
    };

    // whatsapp
    const W = d.wa;
    const routeOpts = radio([['one', 'This number belongs to one branch', 'All orders go to the branch you choose.'], ['all', 'This number handles all branches', "Lumia picks the branch from the customer's location."], ['selected', 'This number is for selected branches', 'Lumia picks between the branches you select.']], W.routing, (v) => this.upd('wa', x => { x.routing = v; }));
    const routeBranches = d.branches.map(b => W.routing === 'one' ? chip(b.name, W.one === b.id, () => this.upd('wa', x => { x.one = b.id; })) : chip(b.name, W.sel.includes(b.id), () => this.upd('wa', x => { x.sel = x.sel.includes(b.id) ? x.sel.filter(i => i !== b.id) : [...x.sel, b.id]; })));
    const waMap = W.routing === 'one' ? [bName(W.one)] : W.routing === 'all' ? ['All branches'] : [W.sel.map(bName).join(', ') || 'No branches selected'];
    const route = { pickBranches: W.routing !== 'all', pickLabel: W.routing === 'one' ? 'Branch' : 'Branches', note: W.routing === 'one' ? 'Customers outside this branch\'s delivery area are offered pickup.' : "AI will choose branch based on customer location." };

    // delivery
    const D = d.delivery, setD = (key, v) => this.upd('delivery', x => { x[key] = v; });
    const rowSet = (list, i, keys) => Object.fromEntries(keys.map(k => [k, (e) => { const v = e.target.value; this.upd('delivery', x => { x[list][i][k] = v; }); }]));
    const areas = D.areas.map((r, i) => ({ ...r, op: r.on ? 1 : 0.5, feePh: r.on ? '0' : 'Not served', onLabel: r.on ? 'Active' : 'Inactive',
      set: rowSet('areas', i, ['area', 'fee', 'min', 'eta']),
      emSel: sel(r.emirate, emOpts, (e) => { const v = e.target.value; this.upd('delivery', x => { x.areas[i].emirate = v; }); }, true, 'Emirate'),
      brSel: sel(r.branch, [{ v: '', l: 'Choose…' }, ...brOpts], (e) => { const v = e.target.value; this.upd('delivery', x => { x.areas[i].branch = v; }); }, true, 'Branch'),
      sw: sw(r.on, () => this.upd('delivery', x => { x.areas[i].on = !x.areas[i].on; })),
      remove: () => this.upd('delivery', x => { x.areas.splice(i, 1); }) }));
    const badRange = new Set(); { const r = D.ranges, hi = (x) => x.to === '' ? Infinity : +x.to; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].on && r[j].on && +r[i].from < hi(r[j]) && +r[j].from < hi(r[i])) { badRange.add(i); badRange.add(j); } }
    const ranges = D.ranges.map((r, i) => ({ ...r, op: r.on ? 1 : 0.5, bd: badRange.has(i) ? '#E5484D' : '#ECD9E0', onLabel: r.on ? 'Active' : 'Inactive', set: rowSet('ranges', i, ['from', 'to', 'fee', 'min', 'eta']),
      sw: sw(r.on, () => this.upd('delivery', x => { x.ranges[i].on = !x.ranges[i].on; })), remove: () => this.upd('delivery', x => { x.ranges.splice(i, 1); }) }));
    const C = s.calc, setC = (k) => (e) => { const v = e.target.value; this.setState(st => ({ calc: { ...st.calc, [k]: v } })); };
    const calc = { ...C, setArea: setC('area'), setDist: setC('dist'), setSub: setC('sub'), brSel: sel(C.branch, brOpts, setC('branch'), true, 'Branch'), emSel: sel(C.emirate, emOpts, setC('emirate'), true, 'Emirate') };
    const res = (() => {
      const sub = +C.sub || 0, dist = +C.dist || 0, bad = (head, msg) => ({ ok: false, head, msg, rows: [], fg: '#B42318' });
      const nope = `Sorry, we don't deliver to ${C.emirate} yet. You can order for pickup from ${bName(C.branch)}.`;
      if (!D.method) return bad('Choose a pricing method first', 'Lumia can\'t quote a delivery fee until a pricing method is set.');
      let fee, eta, br, min;
      if (D.method === 'area') { const r = D.areas.find(r => r.on && r.emirate === C.emirate && (/^all/i.test(r.area) || !C.area.trim() || r.area.toLowerCase() === C.area.trim().toLowerCase())); if (!r) return bad(`No delivery to ${C.emirate}`, nope); fee = +r.fee || 0; eta = r.eta || D.eta; br = r.branch || C.branch; min = +(r.min || D.minOrder) || 0; }
      else if (D.method === 'distance') { const r = D.ranges.find(r => r.on && dist >= +r.from && (r.to === '' || dist < +r.to)); if (!r) return bad(`No delivery at ${dist} km`, `Sorry, you're outside our delivery range. You can order for pickup from ${bName(C.branch)}.`); fee = +r.fee || 0; eta = r.eta || D.eta; br = C.branch; min = +(r.min || D.minOrder) || 0; }
      else if (D.method === 'free') { if (!D.freeEm.includes(C.emirate)) return bad(`No delivery to ${C.emirate}`, nope); fee = 0; eta = D.eta; br = D.freeBranch; min = +D.minOrder || 0; }
      else return { ok: true, head: 'Delivery available', fg: '#16704A', rows: [{ k: 'Fee', v: 'Confirmed by restaurant' }, { k: 'Branch', v: bName(C.branch) }], msg: D.manualMsg };
      if (sub < min) return bad(`Below minimum order (AED ${min})`, `The minimum order for delivery is AED ${min}. Add AED ${min - sub} more to continue.`);
      if (D.freeAbove && sub >= +D.freeAbove) fee = 0;
      return { ok: true, head: 'Delivery available', fg: '#16704A', rows: [{ k: 'Fee', v: fee ? `AED ${fee}` : 'Free' }, { k: 'ETA', v: `${eta} minutes` }, { k: 'Branch', v: bName(br) }],
        msg: `${fee ? `Delivery to ${C.emirate} is AED ${fee}.` : `Delivery to ${C.emirate} is free.`}\nEstimated delivery time: ${eta} minutes.\nMinimum order: AED ${min}.` };
    })();
    const distLock = D.method === 'distance';

    // hours
    const H = d.hours, setH = (fn) => this.upd('hours', fn);
    const list = H.mode === 'every' ? [H.every] : (H.scope === 'same' ? H.same : H.per[H.sel]);
    const pathOf = (x) => H.mode === 'every' ? [x.every] : (H.scope === 'same' ? x.same : x.per[x.sel]);
    const dayRows = list.map((r, i) => ({ ...r, closed: !r.open, hasBreak: r.open && r.brk, noBreak: !r.brk, canToggle: H.mode !== 'every', bt: i ? '1px solid #F3EEF1' : '0',
      sw: sw(r.open, () => setH(x => { const t = pathOf(x)[i]; t.open = !t.open; })),
      toggleBreak: () => setH(x => { const t = pathOf(x)[i]; t.brk = !t.brk; }),
      set: Object.fromEntries(['from', 'to', 'last', 'bFrom', 'bTo'].map(k => [k, (e) => { const v = e.target.value; setH(x => { pathOf(x)[i][k] = v; }); }])) }));
    const todayIdx = (new Date().getDay() + 6) % 7, today = H.mode === 'every' ? H.every : list[todayIdx];
    const nextOpen = (() => { if (H.mode === 'every') return `today at ${fmt12(H.every.from)}`; for (let k = 0; k < 7; k++) { const r = list[(todayIdx + k) % 7]; if (r.open) return k === 0 ? `today at ${fmt12(r.from)}` : `${k === 1 ? 'tomorrow' : 'on ' + r.day} at ${fmt12(r.from)}`; } return 'soon'; })();
    const hoursBubbles = H.mode === 'closed'
      ? [{ when: 'While temporarily closed', text: `Sorry, ${brand} is temporarily closed${H.closedUntil ? ` and reopens on ${new Date(H.closedUntil + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : ''}. We can't take orders right now.` }]
      : [
        today && today.open ? { when: 'When a customer asks today', text: `We are open today until ${fmt12(today.to)}.` } : { when: 'Today', text: 'We are closed today.' },
        { when: 'Outside opening hours', text: `Sorry, the restaurant is currently closed. It opens ${nextOpen}.` },
        today && today.open && { when: 'Near closing time', text: `The restaurant closes at ${fmt12(today.to)}. Please confirm your order now.` },
      ].filter(Boolean);

    // menu
    const menuSteps = ['No menu', 'Extracting', 'Needs review', 'Approved', 'Live'].map((label, i) => ({ label, bar: i <= menuLevel ? 'linear-gradient(90deg,#FF5577,#C93DFF)' : '#F0E4E8', fw: i === menuLevel ? 600 : 500, fg: i === menuLevel ? '#1A0815' : '#8A5A6E' }));
    const miss = M.missingPrices;
    const updated = M.updatedAt ? new Date(M.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    const menuStats = [['Categories', String(M.categories)], ['Items', String(M.items)], ['Missing prices', String(miss)], ['Out of stock', String(M.soldOut)], ['Last updated', updated]].map(([k, v]) => { const hot = k === 'Missing prices' && miss; return { k, v, bg: hot ? '#FFF1DC' : '#FAF6FA', fg: hot ? '#8A4B00' : '#1A0815', lfg: hot ? '#8A4B00' : '#8A5A6E' }; });
    const menuPrimary = { show: false, label: '', go: () => {} };

    // devices
    const deviceCards: any[] = [];

    // save bar
    const dirty = this.dirtyOf(s, s.page);
    const pageLabel = (PAGES.find(p => p[0] === s.page) || [])[1];
    const bar = { show: dirty || !!s.toast || !!s.error || s.saving, dirty, ok: !!s.toast && !dirty, okText: s.toast, err: !!s.error, errText: s.error,
      fg: s.blocked ? '#8A4B00' : '#3D1C31',
      dirtyText: s.blocked ? `Save or discard your ${pageLabel.toLowerCase()} changes before leaving.` : 'You have unsaved changes.',
      discardLabel: s.blocked ? 'Leave without saving' : 'Discard', save: () => this.save(), discard: () => this.discard() };

    const PV = d.pay;
    return {
      rootRef: this.rootRef, mainRef: this.mainRef, wide, narrow: !wide, tblWide, showAside: false, showTop: true, standalone: false, rootH: '100%', topTitleSize: wide ? '20px' : '16px',
      L: { split2: wide ? 'minmax(0,1.6fr) minmax(0,1fr)' : 'minmax(0,1fr)', barGap: '10px', pad: wide ? '24px 32px 48px' : '16px 16px 40px', split: s.w >= 560 ? `minmax(0,1fr) ${s.w >= 1000 ? 340 : 260}px` : 'minmax(0,1fr)',
        areaCols: tblWide ? '1.2fr 1.1fr .8fr .8fr .7fr 1.3fr 56px 40px' : 'minmax(0,1fr) minmax(0,1fr)',
        rangeCols: tblWide ? 'repeat(5,minmax(0,1fr)) 56px 40px' : 'minmax(0,1fr) minmax(0,1fr)',
        rowPad: tblWide ? '10px 0' : '14px 0', cellLbl: tblWide ? 'none' : 'block',
        dayCols: tblWide ? '160px minmax(0,1fr)' : 'minmax(0,1fr)', dayInner: tblWide ? 'repeat(3,minmax(0,1fr)) 80px' : 'minmax(0,1fr) minmax(0,1fr)',
        stepCols: 'repeat(5,minmax(0,1fr))', reserve: s.w >= 560 ? `${(s.w >= 1000 ? 340 : 260) + 20}px` : '0px' },
      acc: Object.fromEntries(Object.keys(SEC_PAGE).map(k => { const pgK = SEC_PAGE[k], first = Object.keys(SEC_PAGE).find(x => SEC_PAGE[x] === pgK); const cur = (s.openSec || {})[pgK]; const open = cur === undefined ? k === first : cur === k;
        return [k, { open, chev: open ? '180deg' : '0deg', toggle: (e) => { if (e && e.target && e.target.closest && e.target.closest('[role=switch]')) return; this.setState(st => ({ openSec: { ...(st.openSec || {}), [pgK]: open ? null : k } })); } }]; })),
      pg: Object.fromEntries(PAGES.map(([k]) => [k, s.page === k])),
      nav, navGroups, steps, ready, todoSteps, doneSteps, hasDone: doneSteps.length > 0, setupOpen: todo.length > 0, setupDone: todo.length === 0,
      warnings, hasWarnings: warnings.length > 0, progressLabel: `${doneN} of ${steps.length} steps completed`,
      brand, initials, markDirty: () => {},
      emailVerifyNode: React.createElement(EmailVerify, { key: String(this.props.initial.emailVerified), businessId: this.props.businessId, email: this.props.initial.sections.profile?.email ?? '', verified: !!this.props.initial.emailVerified, variant: 'settings', draft: pr.email, onVerified: (e: string) => { this.props.initial.emailVerified = true; this.props.initial.sections.profile = { ...this.props.initial.sections.profile, email: e }; this.props.onSaved?.(); } }),
      logoNode: pr.logo ? React.createElement('img', { src: pr.logo, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }) : initials,
      pickLogo: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; try { const url = await logoToDataUrl(f); this.upd('profile', (x: any) => { x.logo = url; }); } catch (e: any) { this.setState({ error: e?.message ?? 'We couldn’t read that image.' }); } }; i.click(); },
      prof: bind('profile', ['name', 'brand', 'cuisine', 'phone', 'support', 'email', 'trn']),
      vatSw: sw(pr.vat, () => this.upd('profile', x => { x.vat = !x.vat; })),
      trnBd: trnOk ? '#ECD9E0' : '#E5484D', trnHint: trnOk ? 'Shown on receipts.' : 'TRN must be 15 digits.', trnHintFg: trnOk ? '#8A5A6E' : '#B42318',
      langSeg: seg([['ar', 'Arabic'], ['en', 'English'], ['both', 'Both']], pr.lang, (v) => this.upd('profile', x => { x.lang = v; })),
      greetOpts: radio([['friendly', 'Friendly', 'Warm and casual'], ['formal', 'Formal', 'Polite and professional'], ['short', 'Short', 'Straight to the order']], pr.greet, (v) => this.upd('profile', x => { x.greet = v; })),
      greetBubbles,
      pinMissing, branchCards, adding: s.adding, notAdding: !s.adding,
      startAdd: () => { const open = () => this.setState({ adding: true, nb: newBranch(), pinQ: '', pinMode: 'current' }); if (d.branches.filter((b: any) => b.active).length < (this.props.initial.branchLimit ?? 1)) return open(); const bb = this.props.initial.branchBuy; if (bb) return this.buyBranch(open); if (this.props.onPremium) return this.props.onPremium(); open(); }, cancelAdd: () => this.setState({ adding: false }),
      confirmAdd: () => { const b = { ...s.nb, id: String(Date.now()) }; this.upd('branches', x => { x.push(b); }); this.setState({ adding: false }); },
      nb, nbStatus: seg([[true, 'Active'], [false, 'Inactive']], nbS.active, (v) => setNb('active', v)),
      pinModes: [['current', 'Use current location'], ['paste', 'Paste Google Maps link']].map(([k, l]) => ({ ...chip(l, s.pinMode === k, () => this.setState({ pinMode: k })) })),
      pm: { search: s.pinMode === 'search', paste: s.pinMode === 'paste', current: s.pinMode === 'current', map: s.pinMode === 'map' },
      pinQ: s.pinQ, onPinQ: (e) => this.setState({ pinQ: e.target.value }), setPin,
      mapClick: () => {}, mapCursor: 'default',
      mapHint: 'No pin yet',
      nbPinned: nbS.pin, nbNoPin: !nbS.pin, nbCoords: nbS.coords, nbInvalid: !nbS.name.trim(), nbOp: nbS.name.trim() ? 1 : 0.45,
      routeOpts, routeBranches, waMap, route, waFor: waMap[0],
      dStatusOpts: radio([['available', 'Delivery available', 'Lumia offers delivery and pickup.'], ['pickup', 'Pickup only', 'No delivery. Customers collect from the branch.'], ['paused', 'Delivery temporarily paused', 'Use when you are short on drivers.']], D.status, (v) => setD('status', v)),
      dl: { on: D.status === 'available', pickup: D.status === 'pickup', paused: D.status === 'paused', noMethod: !D.method, area: D.method === 'area', distance: D.method === 'distance', free: D.method === 'free', manual: D.method === 'manual' },
      methodOpts: radio([['area', 'By area / emirate', 'A fixed fee for each emirate or area.'], ['distance', 'By distance range', 'Fee grows with distance from the branch.'], ['free', 'Free delivery only', 'Free in the areas you choose.'], ['manual', 'Manual confirmation', 'You confirm the fee for each order.']], D.method, (v) => this.upd('delivery', x => { x.method = v; if (v === 'distance') x.pinReq = true; })),
      areas, ranges,
      addArea: () => this.upd('delivery', x => { x.areas.push({ emirate: 'Dubai', area: 'All areas', fee: '', min: x.minOrder, eta: x.eta, branch: '', on: true }); }),
      addRange: () => this.upd('delivery', x => { const last = x.ranges[x.ranges.length - 1]; x.ranges.push({ from: last ? (last.to || '') : '0', to: '', fee: '', min: x.minOrder, eta: x.eta, on: true }); }),
      freeEm: EM.map(e => chip(e, D.freeEm.includes(e), () => this.upd('delivery', x => { x.freeEm = x.freeEm.includes(e) ? x.freeEm.filter(i => i !== e) : [...x.freeEm, e]; }))),
      freeBrSel: sel(D.freeBranch, brOpts, (e) => setD('freeBranch', e.target.value), false, 'Branch'),
      dlf: bind('delivery', ['freeAreas', 'manualMsg', 'minOrder', 'freeAbove', 'eta']),
      confirmSw: sw(D.confirmFirst, () => setD('confirmFirst', !D.confirmFirst)),
      pinSw: sw(D.pinReq || distLock, () => !distLock && setD('pinReq', !D.pinReq), { locked: distLock, op: distLock ? 0.6 : 1 }),
      pinReqHint: distLock ? 'Required for distance pricing.' : 'Lumia asks for a WhatsApp location before confirming the address.', pinReqHintFg: '#8A5A6E',
      calc, res,
      hModeOpts: radio([['every', 'Same hours every day', 'One set of hours for the whole week.'], ['custom', 'Custom hours per day', 'Different hours or days off.'], ['closed', 'Temporarily closed', 'Lumia stops taking orders.']], H.mode, (v) => setH(x => { x.mode = v; })),
      scopeSeg: seg([['same', 'Same for all branches'], ['per', 'Different per branch']], H.scope, (v) => setH(x => { x.scope = v; })),
      perBranch: H.scope === 'per' && H.mode === 'custom',
      hBranchSeg: d.branches.filter(b => H.per[b.id]).map(b => chip(b.name, H.sel === b.id, () => setH(x => { x.sel = b.id; }))),
      hm: { closed: H.mode === 'closed', rows: H.mode !== 'closed' }, hf: bind('hours', ['closedUntil']), dayRows, hoursBubbles,
      menuSteps, menuStats, menuNotApproved: menuLevel < 3, menuPrimary, menuLive: menuLevel === 4,
      hasDevices: false, pairing: false, noDevicesIdle: true, deviceCards,
      startPair: () => this.flash('Order devices are coming soon.'), cancelPair: () => {}, finishPair: () => {},
      dashUrl: `/dashboard${this.props.query}`, menuUrl: `/dashboard?page=menu&businessId=${this.props.businessId}`,
      codSw: sw(PV.cod, () => this.upd('pay', x => { x.cod = !x.cod; })), noCod: !PV.cod,
      verifySw: sw(PV.verify, () => this.upd('pay', x => { x.verify = !x.verify; })),
      verifyHint: `Require phone verification for orders above AED ${PV.threshold || '…'}.`,
      payf: bind('pay', ['threshold']),
      bar,
    };
  }

  // Browser location for a branch pin ("lat, lng").
  locate(done: (coords: string) => void) {
    if (!navigator.geolocation) { this.setState({ error: 'This browser can’t share its location. Paste a Google Maps link instead.' }); return; }
    navigator.geolocation.getCurrentPosition(p => done(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`), () => this.setState({ error: 'We couldn’t get your location. Allow location access, or paste a Google Maps link instead.' }), { enableHighAccuracy: true, timeout: 15000 });
  }

  render() {
    // The layout depends on the width, so render only once it is known.
    return <div className="dc" ref={this.wrap} style={{ height: '100%' }}>{this.state.mounted ? <SettingsTemplate vm={this.renderVals()}/> : <div style={{ minHeight: '60vh' }}/>}</div>;
  }
}

export default SettingsApp;

// Settings are fetched ahead of time (see prefetchSettings) so opening the page is instant; a loader only appears if the fetch is slow.
type Loaded = SettingsProps["initial"];
const cache = new Map<string, { at: number; promise: Promise<Loaded>; data?: Loaded }>();
const FRESH_MS = 60_000;
export function prefetchSettings(businessId: string) {
  const hit = cache.get(businessId);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit;
  const entry: { at: number; promise: Promise<Loaded>; data?: Loaded } = { at: Date.now(), promise: api(`/api/v1/businesses/${businessId}/settings`).then((r: any) => ({ sections: r.sections, menu: r.menu, whatsapp: r.whatsapp, branchLimit: r.branchLimit, branchBuy: r.branchBuy, emailVerified: r.emailVerified })) };
  entry.promise.then(d => { entry.data = d; }, () => { if (cache.get(businessId) === entry) cache.delete(businessId); });
  cache.set(businessId, entry);
  return entry;
}
function rememberSaved(businessId: string, key: string, value: unknown) { const d = cache.get(businessId)?.data; if (d) { d.sections[key] = value; const e = cache.get(businessId)!; e.at = Date.now(); } }

export function SettingsLoader({ businessId, query, onPremium, onSaved }: { businessId: string; query: string; onPremium?: () => void; onSaved?: () => void }) {
  const [initial, setInitial] = React.useState<Loaded | null>(() => prefetchSettings(businessId).data ?? null);
  const [error, setError] = React.useState("");
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    let live = true; const entry = prefetchSettings(businessId);
    entry.promise.then(d => { if (live) setInitial(d); }).catch(e => { if (live) setError(e?.message ?? "We couldn’t load your settings."); });
    const t = setTimeout(() => { if (live) setSlow(true); }, 350); // no flash of a loader for fast loads
    return () => { live = false; clearTimeout(t); };
  }, [businessId]);
  if (error) return <div className="dc" style={{ padding: 32, color: "#B42318", fontSize: 15 }}>{error}</div>;
  if (!initial) return <div className="dc" style={{ opacity: slow ? 1 : 0, transition: "opacity .2s" }}><ContentLoader/></div>;
  return <SettingsApp businessId={businessId} query={query} initial={initial} onPremium={onPremium} onSaved={onSaved}/>;
}
