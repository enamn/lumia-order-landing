"use client";
import { useRef, useState } from "react";
import { productScreen, type MenuProduct } from "@/modules/messages/menu-presentation";
import { PhoneFrame } from "@/design/PhoneFrame";
import { preferenceQuestion, type carouselBatch } from "@/modules/messages/menu-carousel";
type Data = { name: string; currency: string; branches: { id: string; name: string }[]; menu: MenuProduct[]; locale: "ar" | "en"; batch: ReturnType<typeof carouselBatch> };
export function MenuPreview({ businessId }: { businessId: string }) {
  const [data, setData] = useState<Data | null>(null), [lang, setLang] = useState<"ar" | "en">("ar"), [branch, setBranch] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [detail, setDetail] = useState(""), [advice, setAdvice] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  async function load(page = 0, selectedBranch = branch, locale = lang) {
    setBusy(true); setError("");
    try {
      const q = new URLSearchParams({ locale, page: String(page), ...(selectedBranch ? { branch: selectedBranch } : {}) });
      const response = await fetch(`/api/v1/businesses/${businessId}/ai/menu-preview?${q}`);
      const json = await response.json(); if (!response.ok) throw Error(json.error?.message || "Preview could not be loaded.");
      setData(json.data ?? json); setDetail(""); setAdvice(false); track.current?.scrollTo({ left: 0 });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const ar = data?.locale === "ar";
  return <details className="ai-more menu-preview"><summary>Preview customer menu</summary>
    <div className="menu-preview-layout"><div className="menu-preview-side">
    <p className="muted">Preview the response to a menu question. No messages, media uploads, or orders are sent.</p>
    <div className="menu-preview-controls"><label>Language <select className="input" value={lang} disabled={busy} onChange={e => { const locale = e.target.value as "ar" | "en"; setLang(locale); if (data) void load(0, branch, locale); }}><option value="ar">العربية</option><option value="en">English</option></select></label>
      {data && <label>Branch <select className="input" value={branch} disabled={busy} onChange={e => { setBranch(e.target.value); void load(0, e.target.value); }}><option value="">Shared menu</option>{data.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <button type="button" className="button button-outline button-sm" disabled={busy} onClick={() => void load()}>{busy ? "Loading…" : data ? "Restart preview" : "Open preview"}</button></div>
    {error && <p role="alert" className="error-message">{error}</p>}
    </div>
    <div className="menu-preview-slot">
    {data ? <div style={{ margin: "16px 0" }}><PhoneFrame name={data.name} ar={ar} caption={ar ? "معاينة فقط — في المحادثة الحقيقية، تقدر تطلب أو تسأل بنص أو فويس." : "Preview only. In the real chat, customers can order or ask by text or voice."}>
      <div className="menu-preview-question">{ar ? "شو عندك؟" : "What do you have?"}</div>
      <div className="menu-preview-bubble"><p>{data.batch.cards.length ? data.batch.text : ar ? "ما في أصناف متاحة حالياً." : "No items are available right now."}</p>
        <div className="menu-carousel-track" ref={track}>{data.batch.cards.map(card => <article className="menu-carousel-card" key={card.itemId} dir={ar ? "rtl" : "ltr"}>
          <img src={card.imageUrl ?? ""} alt={`${card.name} — ${card.price}`}/><div className="menu-carousel-caption"><strong>{card.name}</strong><span>{card.price}</span></div>
          <button type="button" onClick={() => { const item = data.menu.find(i => i.itemId === card.itemId); if (item) setDetail(productScreen(item, data.locale, data.currency).text.replace(/\*/g, "")); }}>{card.buttonTitle}</button>
        </article>)}</div>
      </div>
      {data.batch.cards.length > 0 && <div className="menu-preview-bubble menu-preview-followup"><p>{data.batch.hint}</p>
        <div className="menu-preview-choices">{data.batch.navigation.map(n => <button type="button" disabled={busy} key={n.title} onClick={() => void load("page" in n.action ? n.action.page ?? 0 : 0)}>{n.title}</button>)}</div>
      </div>}
      {detail && <div className="menu-preview-bubble menu-preview-followup"><p>{detail}</p></div>}
      {advice && <><div className="menu-preview-question">{ar ? "نعم" : "Yes"}</div><div className="menu-preview-bubble"><p>{preferenceQuestion(data.menu, data.locale)}</p></div></>}
      {!advice && data.batch.cards.length > 0 && <button type="button" className="button button-outline button-sm" onClick={() => setAdvice(true)}>{ar ? "مثال: الرد بنعم لطلب النصيحة" : "Example: say yes to advice"}</button>}
    </PhoneFrame></div> : <div className="menu-preview-empty" aria-hidden="true"><span>{lang === "ar" ? "ستظهر المعاينة هنا" : "The preview appears here"}</span></div>}
    </div></div>
  </details>;
}
