"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Lumia Order pre-dashboard flow + dashboard. Logic ported from the design's script (design/flow-v2.dc.html) and wired to the real APIs.
// The markup comes from the generated DcTemplate; this component only builds the view-model it binds to.
import React from "react";
import "./dc-base.css";
import "./dc-hover.css";
import { DcTemplate } from "./DcTemplate";
import { PageLoader } from "@/components/lumia-loader";
import { authClient } from "@/lib/auth-client";
import { logoToDataUrl } from "@/lib/logo";
import { COUNTRIES, groupDigits as fmt, maskPhone } from "@/modules/auth/countries";

export interface FlowProps {
  initialStep: "phone" | "name" | "dash";
  testMode: boolean;
  linkTestMode: boolean;
  devLink: boolean;
  linkMode: "existing" | "new";
  userPhone?: string;
  lang: "en" | "ar";
  business?: { id: string; name: string; logoUrl: string | null; address: string };
  menu: MenuCat[];
  canEdit: boolean;
  wa: { status: "none" | "connected" | "disconnected"; displayPhoneNumber: string; verifiedName: string };
  meta: { appId: string; configId: string; graphVersion: string };
  marketingUrl: string;
  initialPage?: "Menu" | "WhatsApp";
}
export interface MenuCat { id: string; name: string; nameAr: string; items: { id: string; name: string; nameAr: string; priceMinor: number; isAvailable: boolean }[] }
type Item = { id: string; n: string; ar: string; p: number; on: boolean };
type Cat = { id: string; cat: string; catAr: string; items: Item[] };
type Draft = { cat: string; catAr: string; arOnly: boolean; items: { n: string; ar: string; arOnly: boolean; p: string; flag: boolean }[] };

const PHASES = ["Reading your menu", "Finding categories", "Extracting items and prices", "Organizing your menu"];
const NAV_AR: Record<string, string> = { Orders: "الطلبات", Menu: "القائمة", Messages: "الرسائل", WhatsApp: "واتساب", Customers: "العملاء", Delivery: "التوصيل", Settings: "الإعدادات", "Sign out": "تسجيل الخروج" };
const T_EN = { menu: "Menu", items: "items", categories: "categories", created: "Created by Lumia AI", addItem: "Add item", search: "Search items", all: "All items", soldOut: "Sold out", addAr: "Add Arabic name", noResults: "No items match your search.", setupTitle: "Get Lumia ready to receive orders", continueSetup: "Continue setup", setup: ["Restaurant created", "Menu added", ["Connect WhatsApp", "WhatsApp connected"], "Set delivery & order settings", "Test Lumia"] as any[] };
const T_AR = { menu: "القائمة", items: "صنف", categories: "فئات", created: "أنشأتها Lumia AI", addItem: "إضافة صنف", search: "ابحث عن صنف", all: "كل الأصناف", soldOut: "نفد", addAr: "أضف الاسم بالعربية", noResults: "لا توجد أصناف مطابقة لبحثك.", setupTitle: "جهّز Lumia لاستقبال الطلبات", continueSetup: "متابعة الإعداد", setup: ["تم إنشاء المطعم", "تمت إضافة القائمة", ["ربط واتساب", "تم ربط واتساب"], "إعداد التوصيل والطلبات", "تجربة Lumia"] as any[] };
const aed = (p: number | string) => "AED " + p;
const money = (minor: number) => (minor % 100 ? (minor / 100).toFixed(2) : String(minor / 100));
const toCats = (menu: MenuCat[]): Cat[] => menu.map(c => ({ id: c.id, cat: c.name || c.nameAr, catAr: c.name ? c.nameAr : "", items: c.items.map(i => ({ id: i.id, n: i.name || i.nameAr, ar: i.name ? i.nameAr : "", p: i.priceMinor / 100, on: i.isAvailable })) }));
const count = (m: { items: unknown[] }[]) => m.reduce((a, c) => a + c.items.length, 0);
const priceNum = (v: string) => { const n = Number(v.replace(",", ".")); return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null; };
const toBase64 = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1] ?? ""); r.onerror = () => reject(Error("We couldn’t read that file.")); r.readAsDataURL(file); });

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(body !== undefined || method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error?.message ?? json.message ?? "Something went wrong. Please try again."), { code: json.error?.code ?? json.code });
  return json.data ?? json;
}

declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

export default class FlowApp extends React.Component<FlowProps, any> {
  phoneRef = React.createRef<HTMLInputElement>(); otpRef = React.createRef<HTMLInputElement>(); nameRef = React.createRef<HTMLInputElement>(); devRef = React.createRef<HTMLDivElement>();
  timers: any[] = []; tick: any; statsTimer: any; ro?: ResizeObserver; prevStep?: string; connectToken = 0;
  noopFn = () => {};
  constructor(props: FlowProps) {
    super(props);
    const business = props.business;
    this.state = {
      step: props.initialStep, num: "", cc: 0, focused: false, invalid: false, srvErr: "", sending: false, ccOpen: false, e164: "",
      digits: "", otpFocused: false, otpErr: null, otpFail: "", verifying: false, resendAt: 0, now: Date.now(), note: null,
      name: business?.name ?? "", nameFocused: false, nameErr: false, nameFail: "", logo: business?.logoUrl ?? null, drag: false, fileName: "", menuErr: "", readyErr: "", busy: false,
      phase: 0, menuDone: count(toCats(props.menu)) > 0, cat: "All", menu: toCats(props.menu), draft: [] as Draft[], open: {} as Record<number, boolean>, businessId: business?.id ?? null, address: business?.address ?? "",
      page: props.initialPage ?? "Menu", wa: null, waStatus: props.wa.status, waErrText: "", waCatalog: false, waName: props.wa.verifiedName, waPhone: props.wa.displayPhoneNumber, waInfo: null, catOpen: false, confirmReplace: false, confirmDisc: false, choices: {} as Record<string, string>,
      lang: props.lang, q: "", w: 1200, mounted: false, stats: null as null | { messagesReceived: number; aiReplies: number; ordersCreated: number }, dashErr: "", dlg: { open: false } as any,
    };
  }
  later(ms: number, fn: () => void) { const t = setTimeout(fn, ms); this.timers.push(t); return t; }
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
  onResize = () => { const w = document.documentElement.clientWidth || window.innerWidth; if (w !== this.state.w) this.setState({ w }); };
  componentDidMount() {
    window.addEventListener("resize", this.onResize); this.setState({ w: document.documentElement.clientWidth || window.innerWidth, mounted: true }); requestAnimationFrame(this.onResize);
    if (window.ResizeObserver) { this.ro = new ResizeObserver(this.onResize); this.ro.observe(document.documentElement); }
    this.tick = setInterval(() => { if (this.state.step === "otp") this.setState({ now: Date.now() }); }, 1000);
    this.statsTimer = setInterval(() => { if (this.state.step === "dash" && this.state.page === "WhatsApp" && this.state.waStatus === "connected") this.loadStats(); }, 15000);
    if (this.state.step === "dash" && this.state.page === "WhatsApp") this.loadStats();
    if (this.state.step === "phone") this.focus(this.phoneRef); if (this.state.step === "name") this.focus(this.nameRef);
  }
  componentWillUnmount() { window.removeEventListener("resize", this.onResize); this.ro?.disconnect(); clearInterval(this.tick); clearInterval(this.statsTimer); this.clearTimers(); }
  componentDidUpdate() { if (this.prevStep !== this.state.step) { this.prevStep = this.state.step; if (this.devRef.current) this.devRef.current.scrollTop = 0; window.scrollTo(0, 0); } }
  focus(ref: React.RefObject<HTMLElement | null>) { setTimeout(() => ref.current?.focus(), 60); }
  go(step: string, extra: any = {}) {
    this.setState({ step, ...extra });
    if (step === "dash") window.history.replaceState(null, "", "/dashboard");
    if (step === "otp") { this.setState({ resendAt: Date.now() + 30000, now: Date.now(), digits: "", otpErr: null, otpFail: "", note: null }); this.focus(this.otpRef); }
    if (step === "name") this.focus(this.nameRef); if (step === "phone") this.focus(this.phoneRef);
  }
  // ---- data helpers
  async refreshMenu() {
    const data: MenuCat[] = await api(`/api/v1/businesses/${this.state.businessId}/menu`);
    const menu = toCats(data); this.setState({ menu, menuDone: count(menu) > 0 });
  }
  loadStats = () => { if (this.state.businessId) api(`/api/v1/businesses/${this.state.businessId}/whatsapp/stats`).then(stats => this.setState({ stats })).catch(() => undefined); };
  async refreshBusiness() {
    const b = await api(`/api/v1/businesses/${this.state.businessId}`);
    this.setState({ name: b.name, logo: b.logoUrl ?? null, address: b.locations?.[0]?.addressLine1 ?? "" });
  }
  fail = (e: unknown, key = "dashErr") => this.setState({ [key]: e instanceof Error ? e.message : "Something went wrong. Please try again." });
  // ---- phone / otp
  sendCode = async (e?: any, channel: "whatsapp" | "sms" = "whatsapp") => {
    e?.preventDefault?.(); const { num, cc, sending } = this.state; const c = COUNTRIES[cc];
    if (sending) return;
    if (!c.re.test(num)) { this.setState({ invalid: true, srvErr: "" }); this.focus(this.phoneRef); return; }
    this.setState({ sending: true, invalid: false, srvErr: "", ccOpen: false });
    try {
      const r = await api("/api/auth/whatsapp/send-code", "POST", { phoneNumber: c.dial + num, language: "en", channel });
      this.setState({ sending: false, e164: c.dial + num }); this.go("otp");
      this.setState({ resendAt: Date.now() + (r.resendAfter ?? 30) * 1000, note: r.testMode ? "Test mode: no message was sent. Enter 111111." : null });
    } catch (err) { this.setState({ sending: false, invalid: true, srvErr: err instanceof Error ? err.message : "We couldn’t send the code. Please try again." }); }
  };
  async verify(code: string) {
    if (this.state.verifying || this.state.otpErr === "expired") return;
    this.setState({ verifying: true, otpErr: null, otpFail: "", note: null });
    try {
      const r = await api("/api/auth/whatsapp/verify-code", "POST", { phoneNumber: this.state.e164, code });
      if (String(r.redirectTo).startsWith("/dashboard")) { window.location.assign("/dashboard"); return; }
      this.setState({ verifying: false }); this.go("verified"); this.later(1300, () => this.go("name"));
    } catch (err: any) {
      if (err.code === "INVALID_CODE") { this.setState({ verifying: false, otpErr: "incorrect" }); this.focus(this.otpRef); }
      else if (err.code === "CODE_EXPIRED") this.setState({ verifying: false, otpErr: "expired", resendAt: 0 });
      else this.setState({ verifying: false, otpFail: err.message, digits: "" });
    }
  }
  async resend(channel: "whatsapp" | "sms") {
    try {
      const r = await api("/api/auth/whatsapp/send-code", "POST", { phoneNumber: this.state.e164, language: "en", channel });
      this.setState({ digits: "", otpErr: null, otpFail: "", resendAt: Date.now() + (r.resendAfter ?? 30) * 1000, now: Date.now(), note: r.testMode ? "Test mode: no message was sent. Enter 111111." : channel === "sms" ? `Code sent by SMS to ${maskPhone(this.state.e164)}.` : "New code sent to your WhatsApp." });
      this.focus(this.otpRef);
    } catch (err) { this.setState({ otpFail: err instanceof Error ? err.message : "We couldn’t send the code. Please try again.", note: null }); }
  }
  // ---- name / menu
  submitName = async (e: any) => {
    e.preventDefault(); const name = this.state.name.trim();
    if (!name) { this.setState({ nameErr: true, nameFail: "" }); this.focus(this.nameRef); return; }
    this.setState({ busy: true });
    try {
      const b = await api("/api/v1/businesses", "POST", { name, locationName: "Main branch", businessType: "RESTAURANT", ...(this.state.logo?.startsWith("data:") ? { logoUrl: this.state.logo } : {}) });
      this.setState({ busy: false, businessId: b.id }); this.go("menu", { menuErr: "" });
    } catch (err) { this.setState({ busy: false, nameErr: true, nameFail: err instanceof Error ? err.message : "Please try again." }); }
  };
  onLogo = async (e: any) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { this.setState({ logo: await logoToDataUrl(f), nameErr: false, nameFail: "" }); } catch (err) { this.setState({ nameErr: true, nameFail: err instanceof Error ? err.message : "Try another image." }); } };
  async takeFile(f?: File) {
    if (!f) return;
    if (!["application/pdf", "image/png", "image/jpeg"].includes(f.type)) { this.setState({ menuErr: "Use a PDF, JPG or PNG file.", drag: false }); return; }
    if (f.size > 8 * 1048576) { this.setState({ menuErr: "That file is too large. Use a file under 8 MB.", drag: false }); return; }
    this.clearTimers(); this.setState({ fileName: f.name, drag: false, step: "processing", phase: 0, menuErr: "" });
    this.later(2600, () => this.setState({ phase: 1 })); this.later(5200, () => this.setState({ phase: 2 })); this.later(9400, () => this.setState({ phase: 3 }));
    try {
      const draft = await api(`/api/v1/businesses/${this.state.businessId}/menu/import`, "POST", { fileName: f.name, mediaType: f.type, data: await toBase64(f) });
      this.clearTimers();
      const cats: Draft[] = draft.categories.map((c: any) => ({ cat: c.name || c.nameAr, catAr: c.name ? c.nameAr : "", arOnly: !c.name, items: c.items.map((i: any) => ({ n: i.name || i.nameAr, ar: i.name ? i.nameAr : "", arOnly: !i.name, p: i.price == null ? "" : String(i.price), flag: Boolean(i.flagged) })) }));
      this.setState({ step: "ready", draft: cats, open: { 0: true, 1: true }, readyErr: "" });
    } catch (err) { this.clearTimers(); this.setState({ step: "menu", menuErr: err instanceof Error ? err.message : "We couldn’t read that menu." }); }
  }
  confirmMenu = async () => {
    const draft: Draft[] = this.state.draft; if (draft.some(c => c.items.some(i => i.flag)) || this.state.busy) return;
    this.setState({ busy: true, readyErr: "" });
    try {
      await api(`/api/v1/businesses/${this.state.businessId}/menu/import/confirm`, "POST", { categories: draft.map(c => ({ name: c.arOnly ? "" : c.cat, nameAr: c.arOnly ? c.cat : c.catAr, items: c.items.map(i => ({ name: i.arOnly ? "" : i.n, nameAr: i.arOnly ? i.n : i.ar, price: priceNum(i.p) ?? 0 })) })) });
      await this.refreshMenu(); this.setState({ busy: false }); this.go("dash", { cat: "All" });
    } catch (err) { this.setState({ busy: false, readyErr: err instanceof Error ? err.message : "Could not save the menu." }); }
  };
  // ---- dashboard actions
  toggleItem(item: Item) {
    const set = (on: boolean) => this.setState((st: any) => ({ menu: st.menu.map((c: Cat) => ({ ...c, items: c.items.map(i => i.id === item.id ? { ...i, on } : i) })) }));
    const next = !item.on; set(next); this.setState({ dashErr: "" });
    api(`/api/v1/businesses/${this.state.businessId}/menu/items/${item.id}`, "PATCH", { isAvailable: next }).catch(e => { set(!next); this.fail(e); });
  }
  openDialog(cfg: { title: string; hint: string; fields: { key: string; label: string; placeholder: string; dir?: string; mode?: string; value?: string }[]; saveLabel: string; save: (v: Record<string, string>) => Promise<void> }) {
    const values: Record<string, string> = {}; cfg.fields.forEach(f => { values[f.key] = f.value ?? ""; });
    this.setState({ dlg: { open: true, ...cfg, values, error: "", busy: false } });
  }
  closeDialog = () => this.setState({ dlg: { open: false } });
  submitDialog = async (e: any) => {
    e?.preventDefault?.(); const d = this.state.dlg; if (!d.open || d.busy) return;
    this.setState({ dlg: { ...d, busy: true, error: "" } });
    try { await d.save(d.values); this.closeDialog(); } catch (err) { this.setState((st: any) => ({ dlg: { ...st.dlg, busy: false, error: err instanceof Error ? err.message : "Something went wrong." } })); }
  };
  openAddItem = () => this.openDialog({ title: "Add item", hint: "Fill one language or both. Leave the other empty if you don’t have it.", saveLabel: "Add to menu",
    fields: [{ key: "name", label: "Name (English)", placeholder: "Classic Burger" }, { key: "nameAr", label: "الاسم (عربي)", placeholder: "برجر كلاسيك", dir: "rtl" }, { key: "category", label: "Category", placeholder: "Burgers", value: this.state.cat !== "All" ? this.state.menu.find((c: Cat) => c.id === this.state.cat)?.cat ?? "" : "" }, { key: "price", label: "Price (AED)", placeholder: "28", mode: "decimal" }],
    save: async v => {
      const price = priceNum(v.price ?? ""); if (price === null) throw Error("Enter a price, for example 28.");
      await api(`/api/v1/businesses/${this.state.businessId}/menu/items`, "POST", { name: v.name ?? "", nameAr: v.nameAr ?? "", category: v.category ?? "", categoryAr: "", price });
      await this.refreshMenu(); this.setState({ cat: "All", q: "" });
    } });
  editAr = (item: Item) => this.openDialog({ title: "Add Arabic name", hint: item.n, saveLabel: "Save", fields: [{ key: "nameAr", label: "الاسم (عربي)", placeholder: "الاسم بالعربية", dir: "rtl", value: item.ar }],
    save: async v => { await api(`/api/v1/businesses/${this.state.businessId}/menu/items/${item.id}`, "PATCH", { nameAr: (v.nameAr ?? "").trim() }); await this.refreshMenu(); } });
  signOut = async () => { try { await authClient.signOut(); } finally { window.location.assign("/login"); } };
  setLang(lang: "en" | "ar") { this.setState({ lang }); api("/api/v1/me", "PATCH", { language: lang }).catch(() => undefined); }
  // ---- WhatsApp
  openWA = (e?: any) => { e?.preventDefault?.(); if (this.devRef.current) this.devRef.current.scrollTop = 0; this.setState({ wa: "intro", catOpen: false, confirmReplace: false, waErrText: "" }); };
  loadFb(): Promise<any> {
    return new Promise((resolve, reject) => {
      const { appId, graphVersion } = this.props.meta;
      const ready = () => { window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion }); resolve(window.FB); };
      if (window.FB) return ready();
      window.fbAsyncInit = ready;
      if (!document.getElementById("facebook-jssdk")) { const s = document.createElement("script"); s.id = "facebook-jssdk"; s.async = true; s.src = "https://connect.facebook.net/en_US/sdk.js"; s.onerror = () => reject(Error("We couldn’t load Meta. Check your connection and try again.")); document.body.appendChild(s); }
    });
  }
  // Opens Meta's popup (Facebook Login for Business with the Embedded Signup configuration). The one-time code is all we need:
  // the API reads which WhatsApp account and number the owner shared from the token itself. If Meta also posts the ids we pass them along.
  embeddedSignup(): Promise<{ code: string; wabaId?: string; phoneNumberId?: string }> {
    const { appId, configId } = this.props.meta;
    if (!appId || !configId) return Promise.reject(Object.assign(Error("WhatsApp linking is not available yet. Please try again later."), { code: "WHATSAPP_LINK_NOT_CONFIGURED" }));
    return this.loadFb().then(FB => new Promise((resolve, reject) => {
      let ids: { wabaId?: string; phoneNumberId?: string } = {};
      const onMessage = (ev: MessageEvent) => {
        if (!/^https:\/\/(www|web)\.facebook\.com$/.test(ev.origin)) return;
        try { const d = JSON.parse(ev.data); if (d.type === "WA_EMBEDDED_SIGNUP" && d.data?.waba_id && d.data?.phone_number_id) ids = { wabaId: String(d.data.waba_id), phoneNumberId: String(d.data.phone_number_id) }; } catch { /* not ours */ }
      };
      window.addEventListener("message", onMessage);
      FB.login((resp: any) => {
        const finish = () => window.removeEventListener("message", onMessage);
        if (resp?.authResponse?.code) { setTimeout(() => { finish(); resolve({ code: resp.authResponse.code, ...ids }); }, 1200); } // brief grace period for the optional ids message
        else { finish(); reject(Object.assign(Error("Permission was cancelled before setup finished."), { code: "CANCELLED" })); }
      }, { config_id: configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: this.props.linkMode === "existing" ? "whatsapp_business_app_onboarding" : "", sessionInfoVersion: "3" } });
    }));
  }
  startConnect = async () => {
    const token = ++this.connectToken; this.clearTimers(); this.setState({ wa: "connecting", waErrText: "" });
    try {
      const input = this.props.linkTestMode ? { code: "test" } : this.props.devLink ? { code: "dev" } : { ...(await this.embeddedSignup()), mode: this.props.linkMode };
      const r = await api(`/api/v1/businesses/${this.state.businessId}/whatsapp/connect`, "POST", input);
      if (token !== this.connectToken) return;
      this.setState({ wa: "success", waStatus: "connected", waName: r.verifiedName, waPhone: r.displayPhoneNumber, waCatalog: r.catalogItems > 0, waInfo: null });
      api(`/api/v1/businesses/${this.state.businessId}/whatsapp/import`).then(info => token === this.connectToken && this.setState({ waInfo: info })).catch(() => undefined);
    } catch (err: any) {
      if (token !== this.connectToken) return;
      if (err.code === "WHATSAPP_NUMBER_IN_USE") this.setState({ wa: "inUse" });
      else this.setState({ wa: "error", waErrText: err.message });
    }
  };
  applyChoices = async (ch: Record<string, string>) => {
    try {
      await api(`/api/v1/businesses/${this.state.businessId}/whatsapp/import/apply`, "POST", { name: ch.name, logo: ch.logo, address: ch.address });
      await this.refreshBusiness(); this.setState({ wa: "catalog", catOpen: false });
    } catch (err) { this.setState({ wa: "error", waErrText: err instanceof Error ? err.message : "Could not import the information." }); }
  };
  useCatalog = async () => {
    const mode = this.state.menuDone ? "replace" : "use";
    try { await api(`/api/v1/businesses/${this.state.businessId}/whatsapp/catalog/use`, "POST", { mode }); await this.refreshMenu(); this.setState({ wa: null, confirmReplace: false, cat: "All", page: "Menu" }); }
    catch (err) { this.setState({ wa: "error", waErrText: err instanceof Error ? err.message : "Could not import the catalog.", confirmReplace: false }); }
  };
  doDisconnect = async () => {
    this.setState({ confirmDisc: false, busy: true });
    try { await api(`/api/v1/businesses/${this.state.businessId}/whatsapp/disconnect`, "POST", {}); this.setState({ busy: false, waStatus: "disconnected" }); }
    catch (err) { this.setState({ busy: false }); this.fail(err); }
  };

  renderVals() {
    const s = this.state; const p = this.props; const c = COUNTRIES[s.cc];
    const narrow = s.w < 600; const wide = s.step === "processing" || s.step === "ready"; const isDash = s.step === "dash";
    const wash = "radial-gradient(55% 45% at 0% 0%,#FFE9EF 0%,rgba(255,233,239,0) 100%),radial-gradient(50% 50% at 100% 100%,#F1E6FF 0%,rgba(241,230,255,0) 100%),#fff";
    const stickL = narrow ? { stick: "sticky", stickSh: "0 -12px 16px -12px rgba(26,8,21,.12)", aiTop: "48px" } : { stick: "static", stickSh: "none", aiTop: "28px" };
    const fullCard = { cardW: "100%", cardMinH: "100%", cardBd: "0", cardRadius: "0", cardShadow: "none", spacer: "1", headTop: "36px", stAlign: "stretch", stPad: "0", previewH: "240px", dashPadX: "20px", dashPad: "20px 20px 40px" };
    const L: any = narrow ? { pageBg: "#fff", pageAlign: "stretch", pagePad: "0", devW: "100%", devH: "auto", devMinH: "100dvh", devRadius: "0", devBd: "0", devShadow: "none", devOv: "visible", devBg: "#fff", ...fullCard, cardPad: "20px 20px calc(20px + env(safe-area-inset-bottom))" }
      : { pageBg: isDash ? "#fff" : wash, pageAlign: "stretch", pagePad: "0", devW: "100%", devH: "auto", devMinH: "100vh", devRadius: "0", devBd: "0", devShadow: "none", devOv: "visible", devBg: "transparent", cardW: wide ? "540px" : "448px", cardMinH: s.step === "verified" ? "420px" : "auto", cardBd: "1px solid #ECD9E0", cardRadius: "24px", cardShadow: "0 1px 2px rgba(26,8,21,.04), 0 30px 80px -40px rgba(138,32,64,.28)", cardPad: "40px", spacer: "0", headTop: "32px", stAlign: "center", stPad: "64px 24px", previewH: "260px", dashPadX: "28px", dashPad: "28px 32px 48px" };
    Object.assign(L, stickL); L.devTf = "none"; L.drawerW = narrow ? "100%" : "460px"; L.secTop = narrow ? "97px" : "0px";
    const ring = (err: boolean, foc: boolean, busy: boolean) => err ? { bd: "#B4233B", ring: "0 0 0 4px rgba(180,35,59,.12)", bg: "#fff", op: 1 } : foc && !busy ? { bd: "#FF5577", ring: "0 0 0 4px rgba(255,85,119,.14)", bg: "#fff", op: 1 } : { bd: "#E3CBD4", ring: "none", bg: busy ? "#FBF3F8" : "#fff", op: busy ? 0.7 : 1 };
    const masked = maskPhone(s.e164 || p.userPhone || c.dial + " " + fmt("501234567", c.groups));
    const remain = Math.max(0, Math.ceil((s.resendAt - s.now) / 1000)); const expired = s.otpErr === "expired"; const activeIdx = Math.min(s.digits.length, 5);
    const boxes = Array.from({ length: 6 }, (_, i) => { const ch = s.digits[i] || ""; const active = s.otpFocused && !s.verifying && i === activeIdx && !expired; const err = s.otpErr === "incorrect"; return { ch, caret: active && !ch, bd: err ? "#B4233B" : active ? "#FF5577" : ch ? "#D9BFCB" : "#E3CBD4", ring: err ? "0 0 0 3px rgba(180,35,59,.10)" : active ? "0 0 0 4px rgba(255,85,119,.14)" : "none", bg: err ? "#FFF7F8" : expired ? "#FBF3F8" : "#fff" }; });
    const otpMsg = s.otpErr === "incorrect" ? { show: true, fg: "#B4233B", text: "That code isn't correct. Check the latest WhatsApp message and try again." } : expired ? { show: true, fg: "#B4233B", text: "This code has expired. Request a new one." } : s.otpFail ? { show: true, fg: "#B4233B", text: s.otpFail } : s.note ? { show: true, fg: "#16704A", text: s.note } : { show: false, fg: "", text: "" };
    const ce = React.createElement;
    const star = (k: string, sz: number, st: any) => ce("svg", { key: k, width: sz, height: sz, viewBox: "0 0 16 16", style: { position: "absolute", ...st } }, ce("path", { d: "M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8z", fill: "url(#gAI)" }));
    const face = "M32 10H68a22 22 0 0 1 22 22v36a22 22 0 0 1-22 22H36L17 95l4-13a22 22 0 0 1-11-14V32a22 22 0 0 1 22-22z";
    const aiLogo = ce("div", { key: "ai", style: { position: "relative", width: 168, height: 168, display: "flex", alignItems: "center", justifyContent: "center" } },
      ce("svg", { key: "defs", width: 0, height: 0, style: { position: "absolute" } }, ce("defs", null, ce("linearGradient", { id: "gAI", x1: 0, y1: 0, x2: 1, y2: 1 }, ce("stop", { offset: 0, stopColor: "#FF5577" }), ce("stop", { offset: 1, stopColor: "#C93DFF" })))),
      ce("div", { key: "glow", style: { position: "absolute", inset: 22, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,85,119,.45),rgba(201,61,255,.25) 55%,rgba(201,61,255,0) 72%)", filter: "blur(10px)", animation: "lo-breathe 2.4s ease-in-out infinite" } }),
      ce("div", { key: "track", style: { position: "absolute", inset: 6, borderRadius: "50%", border: "1px solid #F0E4E8" } }),
      ce("div", { key: "ring", style: { position: "absolute", inset: 6, borderRadius: "50%", background: "conic-gradient(from 0deg,rgba(255,85,119,0),#FF5577 40%,#C93DFF 70%,rgba(201,61,255,0) 72%)", WebkitMask: "radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px))", mask: "radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px))", animation: "lo-rot 1.8s linear infinite" } }),
      ce("div", { key: "core", style: { position: "relative", width: 96, height: 96, borderRadius: 28, background: "#fff", boxShadow: "0 18px 40px -18px rgba(138,32,64,.45)", display: "flex", alignItems: "center", justifyContent: "center", animation: "lo-bob 2.4s ease-in-out infinite" } },
        ce("svg", { width: 62, height: 62, viewBox: "0 0 100 100", fill: "none" },
          ce("path", { d: face, stroke: "#F3E6EC", strokeWidth: 8, strokeLinejoin: "round" }),
          ce("path", { d: face, stroke: "url(#gAI)", strokeWidth: 8, strokeLinejoin: "round", strokeLinecap: "round", pathLength: 100, strokeDasharray: 100, style: { animation: "lo-draw 2.6s ease-in-out infinite" } }),
          ce("path", { d: "M28 30V66H40", stroke: "#1A0815", strokeWidth: 10, strokeLinecap: "round", strokeLinejoin: "round" }),
          ce("circle", { cx: 64, cy: 55, r: 11, stroke: "url(#gAI)", strokeWidth: 10, style: { transformOrigin: "64px 55px", animation: "lo-breathe 1.2s ease-in-out infinite" } }))),
      ce("div", { key: "orb", style: { position: "absolute", left: "50%", top: "50%", width: 0, height: 0, animation: "lo-orbit 3.2s linear infinite" } }, star("o1", 14, { left: -7, top: -7 })),
      star("s1", 16, { right: 14, top: 18, animation: "lo-twinkle 1.6s ease-in-out infinite" }), star("s2", 10, { left: 20, bottom: 26, animation: "lo-twinkle 1.6s ease-in-out .6s infinite" }), star("s3", 8, { left: 30, top: 24, animation: "lo-twinkle 1.6s ease-in-out 1.1s infinite" }));
    const pulse = ce("span", { key: "pl", style: { width: 12, height: 12, borderRadius: "50%", background: "linear-gradient(135deg,#FF5577,#C93DFF)", animation: "lo-pulse 1.1s ease-in-out infinite", display: "block" } });
    const shimmer = ce("span", { key: "shm", style: { background: "linear-gradient(90deg,#1A0815 0%,#1A0815 35%,#FF5577 45%,#C93DFF 55%,#1A0815 65%,#1A0815 100%)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "lo-shimmer 1.8s linear infinite" } }, PHASES[Math.min(s.phase, 3)]);
    // review (draft menu)
    const draft: Draft[] = s.draft; const flagN = draft.reduce((n, c) => n + c.items.filter(i => i.flag).length, 0);
    const setItem = (ci: number, ii: number, patch: any) => this.setState((st: any) => ({ draft: st.draft.map((c: Draft, a: number) => a !== ci ? c : { ...c, items: c.items.map((i, b) => b === ii ? { ...i, ...patch } : i) }) }));
    const review = draft.map((g, gi) => { const open = !!s.open[gi]; const fl = g.items.filter(i => i.flag).length; return { cat: g.cat, label: `${g.items.length} items`, open, rot: open ? "180deg" : "0deg", bt: gi ? "1px solid #F0E4E8" : "0", flagged: fl > 0, flagLabel: fl === 1 ? "1 to check" : `${fl} to check`, toggle: () => this.setState((st: any) => ({ open: { ...st.open, [gi]: !st.open[gi] } })),
      items: g.items.map((it, ii) => ({ n: it.n, price: it.p, flag: it.flag, bd: it.flag ? "#F2B45C" : "#ECD9E0", bg: it.flag ? "#FFF9F0" : "#fff", onPrice: (e: any) => setItem(gi, ii, { p: e.target.value.replace(/[^\d.]/g, ""), flag: false }), ok: () => setItem(gi, ii, { flag: priceNum(it.p) === null }) })) }; });
    // dashboard data
    const waOn = s.waStatus === "connected"; const M: Cat[] = s.menu; const ar = s.lang === "ar"; const T: any = ar ? T_AR : T_EN;
    const qRaw = s.q.trim(), q = qRaw.toLowerCase(); const match = (i: Item) => i.n.toLowerCase().includes(q) || i.ar.includes(qRaw);
    const catName = (g: Cat) => ar ? (g.catAr || g.cat) : g.cat;
    const sections = M.filter(g => q || s.cat === "All" || g.id === s.cat).map(g => {
      const its = g.items.filter(i => !q || match(i)); const soldN = its.filter(i => !i.on).length;
      return { name: catName(g), alt: ar ? (g.catAr ? g.cat : "") : g.catAr, meta: its.length + " " + T.items + (soldN ? " · " + soldN + " " + T.soldOut : ""),
        items: its.map((i, idx) => { const alt = ar ? (i.ar ? i.n : null) : (i.ar || null); return { main: ar ? (i.ar || i.n) : i.n, alt, hasAlt: !!alt, noAlt: !alt && p.canEdit, on: i.on, sold: !i.on, price: aed(money(Math.round(i.p * 100))), bt: idx ? "1px solid #F3EEF1" : "0", nameFg: i.on ? "#1A0815" : "#8A5A6E", tBg: i.on ? "linear-gradient(90deg,#FF5577,#C93DFF)" : "#EAD9E1", knob: i.on ? (ar ? "-20px" : "20px") : "0px", toggle: () => p.canEdit && this.toggleItem(i), editAr: () => this.editAr(i) }; }) };
    }).filter(g => g.items.length);
    const langFor = (short: boolean) => [["en", "EN"], ["ar", short ? "ع" : "العربية"]].map(([k, label]) => { const on = s.lang === k; return { label, on, fw: on ? 600 : 500, bg: on ? "#fff" : "transparent", fg: on ? "#1A0815" : "#8A5A6E", sh: on ? "0 1px 2px rgba(26,8,21,.12)" : "none", pick: () => this.setLang(k as any) }; });
    const nm = s.name.trim() || "Burger House"; const initials = nm.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
    const setupItems: [string, boolean, any?][] = [["Restaurant created", true], ["Menu added", s.menuDone], [waOn ? "WhatsApp connected" : "Connect WhatsApp", waOn, this.openWA], ["Set delivery & order settings", false], ["Test Lumia", false]];
    const doneN = setupItems.filter(x => x[1]).length;
    // WhatsApp import screens
    const info = s.waInfo; const waInitials = (s.waName || nm).split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
    const waCat: { name: string; count: number; sample: string[] }[] = info?.catalog.categories ?? [];
    const lumiaVals = info ? info.lumia : { name: nm, hasLogo: !!s.logo, address: s.address, items: count(M), categories: M.length };
    const waProfile = info ? info.profile : { name: s.waName, phone: s.waPhone, address: "", hasLogo: false };
    const ch: Record<string, string> = { name: "lumia", logo: lumiaVals.hasLogo ? "lumia" : "wa", address: "wa", ...s.choices };
    const pickC = (k: string, v: string) => this.setState((st: any) => ({ choices: { ...st.choices, [k]: v } }));
    const diffs: [string, string, string, string][] = [["name", "Restaurant name", nm, waProfile.name || s.waName], ["logo", "Logo", lumiaVals.hasLogo ? "Your uploaded logo" : "No logo", "WhatsApp profile photo"], ["address", "Address", lumiaVals.address || "Not set", waProfile.address || "Not set"]];
    const waImport = [{ label: "Logo", value: "Profile photo", isLogo: true, tag: waProfile.hasLogo ? (lumiaVals.hasLogo ? "Different" : "New") : "" }, { label: "Business name", value: waProfile.name || s.waName, tag: nm === (waProfile.name || s.waName) ? "" : "Different" }, { label: "Phone", value: s.waPhone, tag: "" }, { label: "Address", value: waProfile.address || "Not shared", tag: waProfile.address ? (lumiaVals.address ? (lumiaVals.address === waProfile.address ? "" : "Different") : "New") : "" }, { label: "Catalog", value: `${info?.catalog.total ?? 0} products found`, tag: "" }]
      .map((r, i) => ({ ...r, bt: i ? "1px solid #F3EEF1" : "0", tagBg: r.tag === "New" ? "#E4F4EC" : "#FFF4E5", tagFg: r.tag === "New" ? "#16704A" : "#8A4B00" }));
    const dlg = s.dlg.open ? { open: true, title: s.dlg.title, hint: s.dlg.hint, error: s.dlg.error, busy: s.dlg.busy, op: s.dlg.busy ? 0.6 : 1, saveLabel: s.dlg.busy ? "Saving…" : s.dlg.saveLabel, cancel: this.closeDialog, submit: this.submitDialog,
      fields: s.dlg.fields.map((f: any, i: number) => ({ label: f.label, placeholder: f.placeholder, dir: f.dir ?? "ltr", mode: f.mode ?? "text", focus: i === 0, value: s.dlg.values[f.key] ?? "", onChange: (e: any) => this.setState((st: any) => ({ dlg: { ...st.dlg, values: { ...st.dlg.values, [f.key]: e.target.value } } })) })) } : { open: false, fields: [] };
    const NAV: [string, string][] = [["Orders", "M4 5h12l-1.2 11H5.2zM7.5 8a2.5 2.5 0 0 0 5 0"], ["Menu", "M5 4.5h10M5 10h10M5 15.5h6"], ["WhatsApp", "M4.6 15.4 3.5 17.5l2.4-.9A7.2 7.2 0 1 0 4.6 15.4z"], ["Messages", "M4 5.5h12v8H9l-3.5 3v-3H4z"], ["Customers", "M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 16.5c.8-2.9 3.2-4.5 6-4.5s5.2 1.6 6 4.5"], ["Delivery", "M10 17s-5.5-4.6-5.5-9a5.5 5.5 0 0 1 11 0c0 4.4-5.5 9-5.5 9zM10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"], ["Settings", "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"], ["Sign out", "M8 4.5H5.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H8M12.5 7l3 3-3 3M15.5 10H8.5"]];
    const noop = (e?: any) => e?.preventDefault?.();
    return {
      termsUrl: `${p.marketingUrl}/terms`, privacyUrl: `${p.marketingUrl}/privacy`,
      L, isFlow: !isDash, canBack: ["otp", "name", "menu"].includes(s.step),
      is: { phone: s.step === "phone", otp: s.step === "otp", verified: s.step === "verified", name: s.step === "name", menu: s.step === "menu", processing: s.step === "processing", ready: s.step === "ready", dash: isDash },
      back: () => { const prev = ({ otp: "phone", name: "phone", menu: s.businessId && p.initialStep === "dash" ? "dash" : "name" } as any)[s.step]; this.clearTimers(); this.setState({ verifying: false }); this.go(prev); },
      devRef: this.devRef, noop,
      // phone
      cc: c, phoneRef: this.phoneRef, sending: s.sending, ccOpen: s.ccOpen, pf: ring(s.invalid, s.focused, s.sending), phoneDisplay: fmt(s.num, c.groups), phoneValid: c.re.test(s.num) && !s.sending, phoneInvalid: s.invalid, phoneHint: !s.invalid,
      phoneInvalidMsg: s.srvErr || (s.num ? `Enter a valid ${c.label} mobile number, e.g. ${c.ex}` : "Enter your mobile number to continue"), spinnerSend: null, sendLabel: s.sending ? "Sending code…" : "Continue",
      countries: COUNTRIES.map((x, i) => ({ ...x, bg: i === s.cc ? "#FDEAF2" : "transparent", pick: () => { this.setState({ cc: i, ccOpen: false, num: s.num.slice(0, x.len), invalid: false, srvErr: "" }); this.focus(this.phoneRef); } })), toggleCC: () => this.setState({ ccOpen: !s.ccOpen }),
      onPhone: (e: any) => { let d = e.target.value.replace(/\D/g, ""); const dial = c.dial.slice(1); if (d.startsWith("00" + dial)) d = d.slice(2 + dial.length); else if (d.startsWith(dial) && d.length > c.len) d = d.slice(dial.length); if (d.startsWith("0")) d = d.slice(1); this.setState({ num: d.slice(0, c.len), invalid: false, srvErr: "" }); },
      phoneFocus: () => this.setState({ focused: true, ccOpen: false }), phoneBlur: () => this.setState({ focused: false }), sendCode: (e: any) => this.sendCode(e),
      // otp
      masked, boxes, otpRef: this.otpRef, digits: s.digits, verifying: s.verifying, otpMsg, otpOp: s.verifying || expired ? 0.55 : 1, focusOtp: () => this.otpRef.current?.focus(),
      onOtp: (e: any) => { const d = e.target.value.replace(/\D/g, "").slice(0, 6); this.setState({ digits: d, otpErr: expired ? "expired" : null, otpFail: "", note: null }); if (d.length === 6 && !expired) this.verify(d); },
      otpFocus: () => this.setState({ otpFocused: true }), otpBlur: () => this.setState({ otpFocused: false }), verifyNow: () => this.verify(s.digits),
      verifyDisabled: s.digits.length < 6 || s.verifying || expired, verifyOp: (s.digits.length < 6 || expired) && !s.verifying ? 0.45 : 1, spinnerVerify: null, verifyLabel: s.verifying ? "Verifying…" : "Verify",
      resendDisabled: remain > 0 && !expired, resendFg: remain > 0 && !expired ? "#8A5A6E" : "#1A0815", resendLabel: remain > 0 && !expired ? `Resend code in 0:${String(remain).padStart(2, "0")}` : "Resend code",
      resend: () => this.resend("whatsapp"), sms: () => this.resend("sms"), changeNumber: () => { this.clearTimers(); this.setState({ verifying: false }); this.go("phone"); },
      // name
      nameRef: this.nameRef, name: s.name, nameErr: s.nameErr, nameErrText: s.nameFail || "Enter your restaurant name to continue", nf: ring(s.nameErr, s.nameFocused, false), onName: (e: any) => this.setState({ name: e.target.value, nameErr: false, nameFail: "" }),
      nameFocus: () => this.setState({ nameFocused: true }), nameBlur: () => this.setState({ nameFocused: false }), submitName: this.submitName,
      logo: s.logo, noLogo: !s.logo, logoImg: s.logo ? ce("img", { key: "lg", src: s.logo, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }) : null, logoBtn: s.logo ? "Change logo" : "Upload logo", logoTile: { bd: s.logo ? "transparent" : "#E3CBD4" }, onLogo: this.onLogo, initials, nameOrDefault: nm,
      // menu upload / processing
      dz: s.drag ? { bd: "#FF5577", bg: "#FFF5F8" } : { bd: "#E3CBD4", bg: "#FFFBFC" }, menuErr: s.menuErr,
      dragOver: (e: any) => { e.preventDefault(); if (!s.drag) this.setState({ drag: true }); }, dragLeave: () => this.setState({ drag: false }), drop: (e: any) => { e.preventDefault(); this.takeFile(e.dataTransfer.files?.[0]); }, onMenuFile: (e: any) => { const f = e.target.files?.[0]; e.target.value = ""; this.takeFile(f); },
      manual: () => this.go("dash", { menuDone: count(M) > 0, cat: "All" }), noMenu: () => this.go("dash", { menuDone: count(M) > 0, cat: "All" }),
      fileName: s.fileName, pulse, aiLogo, shimmer, phases: PHASES.map((label, i) => ({ label, done: i < s.phase, active: i === s.phase, pending: i > s.phase, fg: i > s.phase ? "#8A5A6E" : "#1A0815", fw: i === s.phase ? 600 : 400, plain: i !== s.phase })),
      // ready
      totalItems: s.step === "dash" ? count(M) : count(draft), totalCats: s.step === "dash" ? M.length : draft.length, review, hasFlags: flagN > 0, confirmOp: flagN > 0 || s.busy ? 0.45 : 1, readyErr: s.readyErr,
      flagMsg: flagN === 1 ? "1 price needs a quick check before you confirm." : `${flagN} prices need a quick check before you confirm.`, confirmMenu: this.confirmMenu, toMenuUpload: () => this.go("menu", { menuErr: "" }),
      // dash
      dir: ar ? "rtl" : "ltr", t: T, langs: langFor(false), langsShort: langFor(true), menuMeta: count(M) + " " + T.items + " · " + M.length + " " + T.categories,
      q: s.q, hasQ: !!s.q, onSearch: (e: any) => this.setState({ q: e.target.value }), clearSearch: () => this.setState({ q: "" }), sections, noResults: sections.length === 0, dashErr: s.dashErr,
      cats: [["All", T.all, count(M)], ...M.map(g => [g.id, catName(g), g.items.length])].map(([k, label, n]: any) => { const on = !q && s.cat === k; return { label, count: n, on, pick: () => this.setState({ cat: k, q: "" }), bg: on ? "#FDEAF2" : "transparent", fg: on ? "#8A2040" : "#3D1C31", fw: on ? 600 : 400, countFg: on ? "#8A2040" : "#8A5A6E", chipBg: on ? "#1A0815" : "#fff", chipFg: on ? "#fff" : "#3D1C31", chipBd: on ? "#1A0815" : "#ECD9E0" }; }),
      menuDone: s.menuDone && count(M) > 0, menuEmpty: !(s.menuDone && count(M) > 0), dashNarrow: narrow, dashWide: !narrow, openAddItem: p.canEdit ? this.openAddItem : noop, dlg,
      nav: NAV.map(([l, icon]) => { const on = l === s.page; return { label: ar ? NAV_AR[l] : l, icon, pick: (e: any) => { e?.preventDefault?.(); if (l === "Menu" || l === "WhatsApp") { this.setState({ page: l }); if (l === "WhatsApp") this.loadStats(); } else if (l === "Orders") window.location.assign(`/dashboard/orders?businessId=${this.state.businessId}`); else if (l === "Messages") window.location.assign(`/dashboard/messages?businessId=${this.state.businessId}`); else if (l === "Settings") window.location.assign("/dashboard/settings"); else if (l === "Sign out") this.signOut(); }, fg: on ? "#8A2040" : "#3D1C31", fw: on ? 600 : 400, bg: on ? "#FDEAF2" : "transparent", bd: on ? "#FF5577" : "transparent" }; }),
      setup: setupItems.map(([label0, done, fn], i) => { const lb = T.setup[i]; const label = Array.isArray(lb) ? lb[done ? 1 : 0] : lb; return { label, done, todo: !done, fg: done ? "#1A0815" : "#3D1C31", ul: !done && fn ? "underline" : "none", pick: fn || this.noopFn, bar: i < doneN ? "#16704A" : "rgba(26,8,21,.12)" }; }),
      setupLabel: ar ? `${doneN} من 5 مكتملة` : `${doneN} of 5 completed`, waSetupLabel: `${doneN} of 5 completed`,
      // whatsapp
      pageMenu: s.page === "Menu", pageWA: s.page === "WhatsApp", waOpen: !!s.wa, wa: { intro: s.wa === "intro", connecting: s.wa === "connecting", success: s.wa === "success", import: s.wa === "import", review: s.wa === "review", catalog: s.wa === "catalog", error: s.wa === "error", inUse: s.wa === "inUse" },
      waLabel: ({ intro: "08 WhatsApp · Connect", connecting: "08a WhatsApp · Connecting", success: "08b WhatsApp · Connected", import: "08c WhatsApp · Import info", review: "08d WhatsApp · Review differences", catalog: "08e WhatsApp · Catalog found", error: "08g WhatsApp · Error", inUse: "08h WhatsApp · Number in use" } as any)[s.wa] || "08 WhatsApp",
      waClose: () => { this.connectToken++; this.clearTimers(); this.setState({ wa: null, confirmReplace: false }); }, openWA: this.openWA, startConnect: this.startConnect, continueSetup: () => { if (!waOn) this.openWA(); },
      cancelConnect: () => { this.connectToken++; this.setState({ wa: "intro" }); },
      waRing: ce("div", { key: "war", style: { position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg,rgba(255,85,119,0),#FF5577 40%,#C93DFF 70%,rgba(201,61,255,0) 72%)", WebkitMask: "radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px))", mask: "radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px))", animation: "lo-rot 1.4s linear infinite" } }),
      waSteps: ["Sign in with Meta", "Select your business", "Choose your WhatsApp number", "Approve Lumia access"].map((label, i) => ({ n: i + 1, label })),
      waCatalog: s.waCatalog, waNoCatalog: !s.waCatalog, waName: s.waName, waPhone: s.waPhone, waInitials,
      successContinue: () => this.setState({ wa: s.waCatalog ? "import" : null }), manageConnection: () => { this.setState({ wa: null, page: "WhatsApp" }); this.loadStats(); },
      waImport, useAll: () => this.applyChoices({ name: "wa", logo: waProfile.hasLogo ? "wa" : "lumia", address: waProfile.address ? "wa" : "lumia" }), toReview: () => this.setState({ wa: "review" }), toImport: () => this.setState({ wa: "import" }),
      waDiffs: diffs.map(([k, label, lv, wv]) => ({ label, opts: [["lumia", "Keep Lumia version", lv], ["wa", "Use WhatsApp version", wv]].map(([v, src, value]) => { const on = ch[k] === v; return { src, value, on, bd: on ? "#FF5577" : "#ECD9E0", bg: on ? "#FFF5F8" : "#fff", dotBd: on ? "5px solid #FF5577" : "1.5px solid #D9BFCB", fg: value === "Not set" || value === "No logo" ? "#8A5A6E" : "#1A0815", pick: () => pickC(k, v as string) }; }) })),
      saveChoices: () => this.applyChoices(ch), lumiaItems: lumiaVals.items, lumiaCats: lumiaVals.categories, catOpen: s.catOpen, catBtn: s.catOpen ? "Hide WhatsApp catalog" : "Review WhatsApp catalog", toggleCat: () => this.setState({ catOpen: !s.catOpen }),
      waCatTotal: info?.catalog.total ?? 0, waCatCount: waCat.length,
      waCatList: waCat.map((g, i) => ({ cat: g.name, label: `${g.count} products`, sample: g.sample.join(", ") + (g.count > g.sample.length ? "…" : ""), bt: i ? "1px solid #F3EEF1" : "0" })),
      askReplace: () => this.setState({ confirmReplace: true }), cancelReplace: () => this.setState({ confirmReplace: false }), confirmReplace: s.confirmReplace, useCatalog: this.useCatalog, waFinish: () => this.setState({ wa: null }),
      waErrText: s.waErrText || "The business account you selected isn't available right now.",
      waIsConnected: waOn, waIsDisconnected: s.waStatus === "disconnected", waIsNone: s.waStatus === "none", waPagePhone: s.waStatus === "none" ? "Not connected yet" : s.waPhone,
      waStat: waOn ? { label: "Connected", fg: "#16704A", dot: "#25D366", ring: "#25D366" } : s.waStatus === "disconnected" ? { label: "Disconnected", fg: "#3D1C31", dot: "transparent", ring: "#8A5A6E" } : { label: "Not connected", fg: "#3D1C31", dot: "transparent", ring: "#B79AA6" },
      waShowToday: waOn, waToday: [["Messages received", s.stats?.messagesReceived ?? 0], ["AI replies", s.stats?.aiReplies ?? 0], ["Orders created", s.stats?.ordersCreated ?? 0]].map(([label, v], i) => ({ label, v, bt: i ? "1px solid #EFE3E9" : "0" })), confirmDisc: s.confirmDisc, askDisconnect: () => this.setState({ confirmDisc: true }), cancelDisconnect: () => this.setState({ confirmDisc: false }), doDisconnect: this.doDisconnect,
      reconnect: () => { this.openWA(); this.startConnect(); },
      openTemplates: () => window.location.assign(`/dashboard/whatsapp/templates?businessId=${s.businessId}`),
    };
  }
  render() {
    // The layout depends on the viewport width, so render only once it is known (avoids a flash of the wide layout on phones).
    if (!this.state.mounted) return <div className="dc" style={{ minHeight: "100vh" }}/>;
    const vm = this.renderVals();
    return <div className="dc" lang={this.state.step === "dash" ? this.state.lang : "en"}><DcTemplate vm={vm}/><PageLoader show={this.state.sending || this.state.verifying || this.state.busy} label={this.state.sending ? "Sending code…" : this.state.verifying ? "Verifying…" : "Saving…"}/></div>;
  }
}
