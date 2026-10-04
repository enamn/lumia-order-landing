"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
type BusinessOption = { id: string; name: string };
const icons = { Overview: "M3 10.5 10 4l7 6.5M5 9v7.5h10V9", Orders: "M4 5h12l-1.2 11H5.2zM7.5 8a2.5 2.5 0 0 0 5 0", Menu: "M5 4.5h10M5 10h10M5 15.5h6", Messages: "M4 5.5h12v8H9l-3.5 3v-3H4z", WhatsApp: "M4.6 15.4 3.5 17.5l2.4-.9A7.2 7.2 0 1 0 4.6 15.4z", Customers: "M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 16.5c.8-2.9 3.2-4.5 6-4.5s5.2 1.6 6 4.5", Delivery: "M10 17s-5.5-4.6-5.5-9a5.5 5.5 0 0 1 11 0c0 4.4-5.5 9-5.5 9zM10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", Settings: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" };
function Mark() {
  const id = useId();
  return <svg width="28" height="28" viewBox="0 0 100 100" fill="none" aria-hidden="true"><defs><linearGradient id={id} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#FF5577"/><stop offset="1" stopColor="#C93DFF"/></linearGradient></defs><path d="M32 10H68a22 22 0 0 1 22 22v36a22 22 0 0 1-22 22H36L17 95l4-13a22 22 0 0 1-11-14V32a22 22 0 0 1 22-22z" stroke={`url(#${id})`} strokeWidth="8" strokeLinejoin="round"/><path d="M28 30V66H40" stroke="#1A0815" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/><circle cx="64" cy="55" r="11" stroke={`url(#${id})`} strokeWidth="10"/></svg>;
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "L";
export function Shell({ children, business }: { children: React.ReactNode; business: BusinessOption & { logoUrl?: string | null; locations?: unknown }; businesses?: BusinessOption[]; user?: { name: string }; role?: string }) {
  const pathname = usePathname(); const router = useRouter(); const [error, setError] = useState("");
  const query = `?businessId=${business.id}`;
  const nav = [["Overview", "/dashboard"], ["Orders", "/dashboard?page=orders"], ["Menu", "/dashboard?page=menu"], ["WhatsApp", "/dashboard?page=whatsapp"], ["Customers", null], ["Settings", "/dashboard?page=settings"]] as const;
  const active = (href: string | null) => href !== null && !href.includes("?") && pathname === href;
  async function logout() { try { const result = await authClient.signOut(); if (result.error) throw Error(); router.push("/login"); router.refresh(); } catch { setError("Unable to sign out. Try again."); } }
  const item = ([label, href]: typeof nav[number], tab: boolean) => {
    const cls = `${tab ? "ds-tab" : "ds-link"}${active(href) ? " on" : ""}${href ? "" : " soon"}`;
    const body = <>{!tab && <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d={icons[label]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}{label}</>;
    return href ? <Link key={label} className={cls} href={href.includes("?") ? `${href}&businessId=${business.id}` : `${href}${query}`} aria-current={active(href) ? "page" : undefined}>{body}</Link> : <span key={label} className={cls} aria-disabled="true">{body}</span>;
  };
  const avatar = <span className="ds-avatar">{business.logoUrl ? <img src={business.logoUrl} alt=""/> : initials(business.name)}</span>;
  return <div className="ds-app">
    <aside className="ds-side"><div className="ds-brand"><Mark/><span><b>Lumia</b><span>Order</span></span></div><nav aria-label="Main navigation">{nav.map(n => item(n, false))}</nav><div className="ds-side-foot"><div className="ds-biz">{avatar}<span title={business.name}>{business.name}</span><button onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={16}/></button></div>{error && <p role="alert" className="ds-err">{error}</p>}</div></aside>
    <div className="ds-main"><header className="ds-top"><div><Mark/><span title={business.name}>{business.name}</span>{avatar}<button onClick={logout} aria-label="Sign out"><LogOut size={16}/></button></div><nav aria-label="Main navigation">{nav.map(n => item(n, true))}</nav></header><main className="ds-content">{children}</main></div>
  </div>;
}
