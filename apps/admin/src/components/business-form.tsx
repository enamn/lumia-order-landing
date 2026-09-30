"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Building2, MapPin, Clock3, ArrowRight } from "lucide-react";
import { type BusinessProfile, profileSchema, locationUpdateSchema } from "@/modules/business/validators";
import { SaveQueue } from "@/lib/save-queue";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function BusinessForm({ businessId, initial, role }: { businessId: string; initial: BusinessProfile; role: string }) {
  const [form, setForm] = useState(initial); const [state, setState] = useState("saved"); const [error, setError] = useState(""); const [conflict, setConflict] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const revision = useRef(initial.revision); const latest = useRef(initial); const dirty = useRef(false);
  const editable = ["OWNER", "ADMIN", "MANAGER"].includes(role); const manageBusiness = ["OWNER", "ADMIN"].includes(role);
  const queue = useRef<SaveQueue<BusinessProfile> | null>(null);
  if (!queue.current) queue.current = new SaveQueue(async value => {
    const payload = manageBusiness ? { ...value, revision: revision.current } : { revision: revision.current, location: value.location };
    const parsed = (manageBusiness ? profileSchema : locationUpdateSchema).safeParse(payload);
    if (!parsed.success) throw Error(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(". "));
    const path = manageBusiness ? `/api/v1/businesses/${businessId}` : `/api/v1/businesses/${businessId}/locations/${value.location.id}`;
    const response = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
    const json = await response.json();
    if (!response.ok) { if (json.error.code === "STALE_REVISION") setConflict(true); throw Error(json.error.message); }
    revision.current = json.data.revision;
  }, (next, err) => { if (next === "saved" && timer.current) return; setState(next); dirty.current = next !== "saved"; if (next === "error") setError(err instanceof Error ? err.message : "Connection lost. Your edits are still here."); else setError(""); });
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); if (timer.current) clearTimeout(timer.current); };
  }, []);
  function change(next: BusinessProfile) {
    latest.current = next; setForm(next); dirty.current = true; setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; queue.current?.enqueue(latest.current); }, 700);
  }
  function location(key: keyof BusinessProfile["location"], value: unknown) { change({ ...form, location: { ...form.location, [key]: value } }); }
  function field(label: string, key: "name" | "nameAr" | "phone" | "email" | "taxRegistrationNumber", placeholder = "") { return <label>{label}<Input disabled={!manageBusiness} value={form[key]} placeholder={placeholder} onChange={e => change({ ...form, [key]: e.target.value })}/></label>; }
  return <div className="profile-layout"><div><div className="save-bar"><span>Changes save automatically</span><span role="status" className={state === "saved" ? "saved" : ""}>{state === "saved" ? <><Check size={15}/> Saved</> : state === "error" ? "Changes not saved" : "Saving…"}</span></div>{error && <div className="error-message" role="alert">{error}<div>{conflict ? <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload latest version</Button> : <Button variant="outline" size="sm" onClick={() => { if (timer.current) clearTimeout(timer.current); timer.current = null; queue.current?.enqueue(latest.current); queue.current?.retry(); }}>Retry save</Button>}</div></div>}
    <section className="panel form-section"><h2><Building2 size={19}/>Business details</h2><p className="muted">Help customers get to know your business.</p><div className="form-grid">{field("Business name", "name")}{field("Business name in Arabic (optional)", "nameAr")}{field("Business phone", "phone", "+971501234567")}{field("Business email (optional)", "email", "hello@yourbusiness.com")}</div><label className="checkbox-label"><input type="checkbox" disabled={!manageBusiness} checked={form.vatRegistered} onChange={e => change({ ...form, vatRegistered: e.target.checked })}/>This business is VAT registered</label>{form.vatRegistered && field("Tax registration number", "taxRegistrationNumber", "15-digit TRN")}</section>
    <section className="panel form-section"><h2><MapPin size={19}/>Your location</h2><p className="muted">Where the good things happen.</p><div className="form-grid">{([['Location name','name'],['Street address','addressLine1'],['City','city'],['Emirate','emirate']] as const).map(([label, key]) => <label key={key}>{label}<Input disabled={!editable} value={form.location[key]} onChange={e => location(key, e.target.value)}/></label>)}</div></section>
    <section className="panel form-section"><h2><Clock3 size={19}/>Business hours</h2><p className="muted">All times are in Asia/Dubai. Closing before opening means overnight.</p><div className="hours-list">{form.location.hours.map((h, index) => <div className="hours-row" key={h.dayOfWeek}><label className="checkbox-label"><input type="checkbox" aria-label={`${days[h.dayOfWeek]} open`} checked={!h.isClosed} disabled={!editable} onChange={e => location("hours", form.location.hours.map((row, i) => i === index ? { ...row, isClosed: !e.target.checked } : row))}/>{days[h.dayOfWeek]}</label>{h.isClosed ? <span className="muted">Closed</span> : <div><Input type="time" aria-label={`${days[h.dayOfWeek]} opening time`} disabled={!editable} value={h.openTime} onChange={e => location("hours", form.location.hours.map((row, i) => i === index ? { ...row, openTime: e.target.value } : row))}/><span>to</span><Input type="time" aria-label={`${days[h.dayOfWeek]} closing time`} disabled={!editable} value={h.closeTime} onChange={e => location("hours", form.location.hours.map((row, i) => i === index ? { ...row, closeTime: e.target.value } : row))}/></div>}</div>)}</div></section>
    <div className="form-actions">{state === "saved" ? <Button asChild><Link href={`/onboarding?businessId=${businessId}`}>Back to setup<ArrowRight size={17}/></Link></Button> : <Button disabled>Save changes to continue</Button>}</div></div><aside className="form-aside"><span className="sparkle-large">✦</span><h3>Your business.<br/>Your way.</h3><p>These details form the foundation of your Lumia workspace. You can update them as your business grows.</p><div className="aside-fact"><span>Business type</span><strong>Restaurant</strong></div><div className="aside-fact"><span>Currency</span><strong>AED · UAE Dirham</strong></div><div className="aside-fact"><span>Timezone</span><strong>Asia/Dubai</strong></div>{!manageBusiness && <p>Your {role.toLowerCase()} role {editable ? "can edit location details and business hours." : "has read-only access."}</p>}</aside></div>;
}
