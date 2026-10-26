"use client";
import { useEffect, useRef, useState } from "react";
import PinMap from "./PinMap";
import { COUNTRY_CENTER, GOOGLE_KEY, coordsFromText, loadGoogle, parseCoords } from "./google-maps";
import { regionFrom } from "@/modules/market/regions";
import { isCountryCode } from "@/modules/market/countries";

// "Where is the branch?": type the restaurant or street, pick a suggestion, then drag the pin to the entrance.
// Google Places and Google Maps when a key is set; OpenStreetMap search and map otherwise (same behaviour, nothing else changes).
export interface Picked { coords: string; address?: string; area?: string; region?: string; label?: string }
interface Option { id: string; main: string; secondary: string; pick: () => Promise<Picked> }

const INK = "#1A0815", MUTED = "#8A5A6E", LINE = "#ECD9E0", OK = "#16704A", ERR = "#B42318";
const T = {
  en: { label: "Branch location", hint: "Search the restaurant or the street, pick a match, then drag the pin to the entrance.", ph: "Search your restaurant or address", none: "No match. Try the building or area name, or click the map to drop the pin.", fail: "Search is not available right now. Click the map to drop the pin.", noPin: "No pin yet. Search above, or click the map.", set: "Pin set", me: "Use my current location", meNote: "Do this from inside the branch.", paste: "Paste a Google Maps link", use: "Use link", link: "https://maps.app.goo.gl/…", badLink: "We couldn’t find a location in that link. Paste a link that shows the pin, or “latitude, longitude”.", locFail: "We couldn’t get this device’s location. Allow location access, or search instead.", clear: "Clear search", searching: "Searching…", finding: "Finding the address…" },
  ar: { label: "موقع الفرع", hint: "ابحث عن المطعم أو الشارع، اختر النتيجة، ثم اسحب الدبوس إلى المدخل.", ph: "ابحث عن مطعمك أو عنوانه", none: "لا توجد نتيجة. جرّب اسم المبنى أو المنطقة، أو اضغط على الخريطة لوضع الدبوس.", fail: "البحث غير متاح الآن. اضغط على الخريطة لوضع الدبوس.", noPin: "لم يتم تحديد دبوس بعد. ابحث بالأعلى أو اضغط على الخريطة.", set: "تم تحديد الدبوس", me: "استخدم موقعي الحالي", meNote: "افعل ذلك من داخل الفرع.", paste: "الصق رابط خرائط جوجل", use: "استخدم الرابط", link: "https://maps.app.goo.gl/…", badLink: "لم نجد موقعًا في هذا الرابط. الصق رابطًا يظهر الدبوس أو «خط العرض، خط الطول».", locFail: "تعذّر تحديد موقع هذا الجهاز. اسمح بالوصول إلى الموقع أو استخدم البحث.", clear: "مسح البحث", searching: "جارٍ البحث…", finding: "جارٍ إيجاد العنوان…" },
};
const pin = (c: string) => <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: "none", color: c }}><path d="M10 17.5s5.5-4.8 5.5-9a5.5 5.5 0 0 0-11 0c0 4.2 5.5 9 5.5 9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="10" cy="8.5" r="1.9" stroke="currentColor" strokeWidth="1.6" /></svg>;


// Address, area and region for the form, from what a map lookup returned. Google keeps some Gulf neighbourhoods and cities in Arabic only:
// an English dashboard shows only what exists in English, an Arabic one keeps everything.
const arabic = (t: string) => /[\u0600-\u06FF]/.test(t);
function formValues(cc: string, ar: boolean | undefined, p: { area: string; formatted: string; short?: string; regionTexts: string[] }) {
  const region = isCountryCode(cc) ? regionFrom(cc, ...p.regionTexts, p.formatted) ?? "" : "";
  const kept = p.formatted.split(/\s+[-\u2013]\s+|,\s*/).filter(x => x && !arabic(x)).join(", "), short = p.short ?? "";
  const address = ar ? p.formatted : [short && !arabic(short) ? short : kept, region].filter((x, i, a) => x && !(i && a[0]!.includes(x))).join(", ");
  return { address, area: ar || !arabic(p.area) ? p.area : "", region };
}

function GoogleMapPin({ coords, onMove, center, height }: { coords: string; onMove: (c: string) => void; center: [number, number]; height: number }) {
  const el = useRef<HTMLDivElement>(null), st = useRef<{ map: any; marker: any } | null>(null), cb = useRef(onMove);
  cb.current = onMove;
  useEffect(() => {
    let dead = false;
    (async () => {
      const g = await loadGoogle(); const { Map } = await g.importLibrary("maps"), { AdvancedMarkerElement } = await g.importLibrary("marker");
      if (dead || !el.current || st.current) return;
      const at = parseCoords(coords), map = new Map(el.current, { center: { lat: (at ?? center)[0], lng: (at ?? center)[1] }, zoom: at ? 17 : 11, mapId: "DEMO_MAP_ID", disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative", clickableIcons: false });
      const dot = document.createElement("div"); dot.innerHTML = '<svg width="34" height="42" viewBox="0 0 20 24" fill="none"><path d="M10 23s7-6.3 7-11.6A7 7 0 0 0 3 11.4C3 16.7 10 23 10 23z" fill="#FF5577" stroke="#fff" stroke-width="1.2"/><circle cx="10" cy="11" r="2.8" fill="#fff"/></svg>';
      const marker = new AdvancedMarkerElement({ map: at ? map : null, position: at ? { lat: at[0], lng: at[1] } : null, content: dot, gmpDraggable: true });
      const out = (p: any) => cb.current(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
      marker.addListener("dragend", () => out({ lat: marker.position.lat, lng: marker.position.lng }));
      map.addListener("click", (e: any) => { const p = { lat: e.latLng.lat(), lng: e.latLng.lng() }; marker.position = p; marker.map = map; out(p); });
      st.current = { map, marker };
    })().catch(() => undefined);
    return () => { dead = true; st.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { // the pin moved from outside (a suggestion, a link, this device)
    const s = st.current, at = parseCoords(coords); if (!s || !at) return;
    s.marker.position = { lat: at[0], lng: at[1] }; s.marker.map = s.map; s.map.setCenter({ lat: at[0], lng: at[1] }); if ((s.map.getZoom() ?? 0) < 16) s.map.setZoom(17);
  }, [coords]);
  return <div ref={el} style={{ height, width: "100%", borderRadius: 14, border: "1px solid #ECEAEB", overflow: "hidden", background: "#F4F2EF" }} />;
}

export default function PlacePicker({ country, coords, onPick, ar, businessId, height = 260, address, showLabel = true }: { country: string; coords: string; onPick: (p: Picked) => void; ar?: boolean; businessId?: string; height?: number; address?: string; showLabel?: boolean }) {
  const tx = ar ? T.ar : T.en, cc = country.toUpperCase(), center = COUNTRY_CENTER[cc] ?? COUNTRY_CENTER.AE!;
  const [q, setQ] = useState(""), [opts, setOpts] = useState<Option[]>([]), [open, setOpen] = useState(false), [act, setAct] = useState(-1), [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [useGoogle, setUseGoogle] = useState(!!GOOGLE_KEY);
  const [finding, setFinding] = useState(false), [paste, setPaste] = useState(false), [link, setLink] = useState(""), [note, setNote] = useState(""), [picked, setPicked] = useState(address ?? "");
  const seq = useRef(0), timer = useRef<any>(null), token = useRef<any>(null), box = useRef<HTMLDivElement>(null);
  const pinned = !!parseCoords(coords);

  useEffect(() => { const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", off); return () => document.removeEventListener("mousedown", off); }, []);

  async function googleOptions(text: string): Promise<Option[]> {
    const g = await loadGoogle(), places = await g.importLibrary("places");
    token.current ??= new places.AutocompleteSessionToken();
    const r = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: text, sessionToken: token.current, includedRegionCodes: [cc.toLowerCase()], language: ar ? "ar" : "en" });
    return r.suggestions.filter((s: any) => s.placePrediction).slice(0, 6).map((s: any): Option => {
      const p = s.placePrediction;
      return { id: p.placeId, main: p.mainText?.text ?? p.text.text, secondary: p.secondaryText?.text ?? "", pick: async () => {
        const place = new places.Place({ id: p.placeId, requestedLanguage: ar ? "ar" : "en", requestedRegion: cc.toLowerCase() }); await place.fetchFields({ fields: ["displayName", "formattedAddress", "shortFormattedAddress", "location", "addressComponents"] }); token.current = null;
        const comp = (t: string) => (place.addressComponents ?? []).find((c: any) => c.types.includes(t))?.longText ?? "";
        const v = formValues(cc, ar, { area: comp("sublocality_level_1") || comp("sublocality") || comp("neighborhood") || comp("locality"), formatted: place.formattedAddress ?? "", short: place.shortFormattedAddress ?? "", regionTexts: [comp("administrative_area_level_1"), comp("locality")] });
        return { coords: `${place.location.lat().toFixed(6)}, ${place.location.lng().toFixed(6)}`, address: v.address, area: v.area, region: v.region, label: place.displayName ?? p.mainText?.text ?? "" };
      } };
    });
  }
  async function osmOptions(text: string): Promise<Option[]> {
    const url = businessId ? `/api/v1/businesses/${businessId}/geocode?q=${encodeURIComponent(text)}` : `/api/v1/geocode?country=${cc}&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { credentials: "same-origin" }); const j = await res.json();
    if (!res.ok) throw new Error(j?.error?.message ?? "FAILED");
    return (j.data as { label: string; latitude: number; longitude: number }[]).map((r, i): Option => { const parts = r.label.split(", "); return { id: String(i), main: parts[0]!, secondary: parts.slice(1, 4).join(", "), pick: async () => ({ coords: `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`, address: r.label, region: isCountryCode(cc) ? regionFrom(cc, r.label) ?? "" : "", label: parts[0]! }) }; });
  }
  function search(text: string) {
    setQ(text); setMsg(""); setAct(-1); clearTimeout(timer.current);
    if (text.trim().length < 3) { setOpts([]); setOpen(false); setBusy(false); return; }
    setBusy(true);
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        let list: Option[];
        try { list = useGoogle ? await googleOptions(text) : await osmOptions(text); }
        catch (e) { if (useGoogle) { setUseGoogle(false); list = await osmOptions(text); } else throw e; } // a key that is wrong or not allowed here: fall back to the free search
        if (mine !== seq.current) return;
        setOpts(list); setOpen(true); setMsg(list.length ? "" : tx.none);
      } catch { if (mine === seq.current) { setOpts([]); setOpen(true); setMsg(tx.fail); } }
      if (mine === seq.current) setBusy(false);
    }, 260);
  }
  async function choose(o: Option) {
    setOpen(false); setBusy(true);
    try { const p = await o.pick(); setQ(o.main); setPicked(p.address ?? o.main); onPick(p); setNote(""); } catch { setMsg(tx.fail); setOpen(true); }
    setBusy(false);
  }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setAct(i => Math.min(i + 1, opts.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAct(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (open && opts[act]) { e.preventDefault(); void choose(opts[act]!); } else e.preventDefault(); }
    else if (e.key === "Escape") setOpen(false);
  };
  const lookup = useRef(0);
  // The pin was placed or dragged: use the point at once, then fill in the address, area and region found there.
  const move = (c: string) => {
    setNote(""); onPick({ coords: c });
    const at = parseCoords(c); if (!at) return;
    const mine = ++lookup.current; setFinding(true);
    void (async () => {
      let found: { address: string; area: string; region: string } | null = null;
      const viaOsm = async () => {
        const res = await fetch(`/api/v1/geocode?lat=${at[0]}&lng=${at[1]}`, { credentials: "same-origin" }), j = await res.json();
        if (res.ok && j.data) found = formValues(cc, ar, { area: j.data.area || j.data.city, formatted: j.data.display, regionTexts: [j.data.state, j.data.city] });
      };
      try {
        if (useGoogle) {
          try {
            const g = await loadGoogle(), { Geocoder } = await g.importLibrary("geocoding");
            const r = (await new Geocoder().geocode({ location: { lat: at[0], lng: at[1] }, language: ar ? "ar" : "en" })).results?.[0];
            if (r) { const comp = (t: string) => r.address_components.find((x: any) => x.types.includes(t))?.long_name ?? ""; found = formValues(cc, ar, { area: comp("sublocality_level_1") || comp("sublocality") || comp("neighborhood") || comp("locality"), formatted: r.formatted_address ?? "", regionTexts: [comp("administrative_area_level_1"), comp("locality")] }); }
          } catch { await viaOsm(); } // the Geocoding API is not turned on for this key, or Google is not reachable: use the free lookup
        } else await viaOsm();
      } catch { /* the pin stays where it is; the owner can type the address */ }
      if (mine !== lookup.current) return;
      setFinding(false);
      if (found && (found.address || found.area || found.region)) { setPicked(found.address); onPick({ coords: c, address: found.address, area: found.area, region: found.region }); }
    })();
  };
  const here = () => {
    if (!navigator.geolocation) { setNote(tx.locFail); return; }
    navigator.geolocation.getCurrentPosition(p => move(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`), () => setNote(tx.locFail), { enableHighAccuracy: true, timeout: 15000 });
  };
  const useLink = () => { const c = coordsFromText(link); if (c) { move(c); setPaste(false); setLink(""); } else setNote(tx.badLink); };
  const btn: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "#3D1C31", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "#E3CBD4", padding: "6px 0" };

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        {showLabel && <span style={{ fontSize: 14, fontWeight: 500, color: "#3D1C31" }}>{tx.label}</span>}
        <p style={{ fontSize: 13, color: MUTED, marginTop: showLabel ? 2 : 0, lineHeight: 1.45 }}>{tx.hint}</p>
      </div>
      <div ref={box} style={{ position: "relative" }}>
        <span style={{ position: "absolute", insetInlineStart: 13, top: 15, color: MUTED, pointerEvents: "none" }}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7" /><path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>
        <input role="combobox" aria-expanded={open} aria-controls="place-list" aria-autocomplete="list" aria-activedescendant={act >= 0 ? `place-${act}` : undefined} aria-label={tx.ph} value={q} placeholder={tx.ph} autoComplete="off" onChange={e => search(e.target.value)} onKeyDown={key} onFocus={() => { if (opts.length || msg) setOpen(true); }}
          style={{ height: 48, width: "100%", paddingInlineStart: 40, paddingInlineEnd: 40, borderRadius: 12, border: `1.5px solid ${LINE}`, background: "#fff", fontSize: 15, color: INK }} className="place-input" />
        {q && <button type="button" aria-label={tx.clear} onClick={() => { setQ(""); setOpts([]); setOpen(false); setMsg(""); }} style={{ position: "absolute", insetInlineEnd: 6, top: 6, width: 36, height: 36, borderRadius: 10, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>}
        {open && (opts.length > 0 || msg) && (
          <ul id="place-list" role="listbox" style={{ position: "absolute", zIndex: 20, insetInline: 0, top: 54, margin: 0, padding: 4, listStyle: "none", maxHeight: 300, overflowY: "auto", background: "#fff", border: "1px solid #F0E4E8", borderRadius: 14, boxShadow: "0 14px 30px -14px rgba(120,20,80,.32), 0 2px 6px rgba(26,8,21,.06)" }}>
            {opts.map((o, i) => (
              <li key={o.id} id={`place-${i}`} role="option" aria-selected={i === act} onMouseDown={e => { e.preventDefault(); void choose(o); }} onMouseEnter={() => setAct(i)}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 10px", borderRadius: 10, cursor: "pointer", background: i === act ? "#FBF3F8" : "transparent" }}>
                <span style={{ marginTop: 2 }}>{pin(MUTED)}</span>
                <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 15, fontWeight: 600, color: INK }}>{o.main}</span>{o.secondary && <span style={{ display: "block", fontSize: 13, color: MUTED, marginTop: 1, lineHeight: 1.35 }}>{o.secondary}</span>}</span>
              </li>
            ))}
            {!opts.length && msg && <li role="presentation" style={{ padding: "12px 10px", fontSize: 14, color: "#6B3A00" }}>{msg}</li>}
          </ul>
        )}
        {busy && <span style={{ position: "absolute", insetInlineEnd: 44, top: 15, fontSize: 12, color: MUTED }} aria-live="polite">{tx.searching}</span>}
      </div>
      {useGoogle ? <GoogleMapPin coords={coords} onMove={move} center={center} height={height} /> : <PinMap value={coords} onPick={move} center={center} height={height} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {pinned ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: OK }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}><path d="m5 10.5 3.2 3.2L15 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{tx.set}{finding && <span style={{ color: MUTED, fontWeight: 400 }}>{` · ${tx.finding}`}</span>}<span style={{ color: "#3D1C31", fontWeight: 400 }}>{picked ? ` · ${picked}` : ""}</span><span style={{ display: "block", color: MUTED, fontWeight: 400, fontSize: 12, fontVariantNumeric: "tabular-nums" }} dir="ltr">{coords}</span></span>
          </div>
        ) : <span style={{ fontSize: 14, color: MUTED }}>{tx.noPin}</span>}
        {note && <span role="alert" style={{ fontSize: 13, color: ERR }}>{note}</span>}
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 18 }}>
          <button type="button" onClick={here} style={btn}>{tx.me}</button>
          <button type="button" onClick={() => { setPaste(v => !v); setNote(""); }} style={btn} aria-expanded={paste}>{tx.paste}</button>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{tx.meNote}</span>
        {paste && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); useLink(); } }} placeholder={tx.link} dir="ltr" aria-label={tx.paste} style={{ flex: "1 1 220px", height: 44, padding: "0 12px", borderRadius: 10, border: `1.5px solid ${LINE}`, background: "#fff", fontSize: 15 }} className="place-input" />
            <button type="button" onClick={useLink} style={{ height: 44, padding: "0 16px", borderRadius: 10, border: `1.5px solid ${LINE}`, background: "#fff", fontWeight: 500, fontSize: 14 }}>{tx.use}</button>
          </div>
        )}
      </div>
    </div>
  );
}
