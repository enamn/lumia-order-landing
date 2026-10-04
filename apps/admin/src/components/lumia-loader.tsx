"use client";
import { useId, useEffect, useState } from "react";
import { createPortal } from "react-dom";
// Loading animation: the Lumia "Lo" mark. Its bubble outline draws itself and the ring breathes (keyframes in globals.css).
// Use `light` on the pink→violet buttons, where the colored mark would disappear.
export function LumiaLoader({ size = 24, light = false, label }: { size?: number; light?: boolean; label?: string }) {
  const id = useId(); const face = "M32 10H68a22 22 0 0 1 22 22v36a22 22 0 0 1-22 22H36L17 95l4-13a22 22 0 0 1-11-14V32a22 22 0 0 1 22-22z";
  const stroke = light ? "#fff" : `url(#${id})`;
  return <svg className="lumia-loader" width={size} height={size} viewBox="0 0 100 100" fill="none" role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {!light && <defs><linearGradient id={id} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#FF5577"/><stop offset="1" stopColor="#C93DFF"/></linearGradient></defs>}
    <path d={face} stroke={light ? "rgba(255,255,255,.35)" : "#F3E6EC"} strokeWidth="8" strokeLinejoin="round"/>
    <path className="ai-draw" d={face} stroke={stroke} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" pathLength={100} strokeDasharray={100}/>
    <path d="M28 30V66H40" stroke={light ? "#fff" : "#1A0815"} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    <circle className="ai-dot" cx="64" cy="55" r="11" stroke={stroke} strokeWidth="10"/>
  </svg>;
}

// Page-loading loader: the Lumia mark in the centre of the screen on a soft pink-to-violet glow (same look as PageLoader).
// Rendered into <body> so it is centred on the screen and above everything, whatever transforms the surrounding layout has.
function useBody() { const [el, setEl] = useState<HTMLElement | null>(null); useEffect(() => setEl(document.body), []); return el; }
export function ContentLoader({ label = "Loading" }: { label?: string }) {
  const body = useBody(); if (!body) return null;
  return createPortal(<div className="content-loader" role="status" aria-live="polite" aria-label={label}><LumiaLoader size={72}/></div>, body);
}

// Full-screen loader: the Lumia mark centred on the screen while an action runs. Blocks interaction underneath.
export function PageLoader({ show, label }: { show: boolean; label?: string }) {
  const body = useBody();
  if (!show || !body) return null;
  return createPortal(<div className="page-loader" role="status" aria-live="polite" aria-label={label ?? "Loading"}><LumiaLoader size={72}/>{label && <p>{label}</p>}</div>, body);
}
