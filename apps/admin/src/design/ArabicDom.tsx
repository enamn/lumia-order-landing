"use client";
// Arabic for the whole dashboard. The screens are built from the designs' English text; with the language on Arabic this turns every
// English text, placeholder and label on the page into Arabic (dictionary in ar-dict.ts) and puts it back when the language is switched.
// Text that is already Arabic (the parts translated in code) and brand names are left alone.
import { useEffect, useLayoutEffect, useRef } from "react";
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect; // translate before the browser paints, so the English never shows first
import { AR, AR_PATTERNS } from "./ar-dict";

const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const textOrig = new WeakMap<Node, string>();
const attrOrig = new WeakMap<Element, Record<string, string>>();

export function translateText(raw: string): string | null {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw); if (!m) return null;
  const core = m[2]!; if (!core || !/[A-Za-z]{2}/.test(core) || /[؀-ۿ]/.test(core)) return null;
  const hit = AR[core] ?? AR[core.replace(/\s+/g, " ")];
  if (hit != null) return m[1] + hit + m[3];
  for (const [re, fn] of AR_PATTERNS) { const r = re.exec(core); if (r) return m[1] + fn(r) + m[3]; }
  return null;
}

function tNode(n: Node) {
  const cur = n.nodeValue ?? ""; if (textOrig.has(n) && n.nodeValue === (n as any).__ar) return;
  const out = translateText(cur);
  if (out != null && out !== cur) { textOrig.set(n, cur); (n as any).__ar = out; n.nodeValue = out; }
}
function tAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (!v) continue;
    const o = attrOrig.get(el)?.[a]; if (o != null && el.getAttribute(a) === (el as any)[`__ar_${a}`]) continue;
    const out = translateText(v);
    if (out != null && out !== v) { attrOrig.set(el, { ...(attrOrig.get(el) ?? {}), [a]: v }); (el as any)[`__ar_${a}`] = out; el.setAttribute(a, out); }
  }
}
function walk(root: Node) {
  if (root.nodeType === 3) { tNode(root); return; }
  if (root.nodeType !== 1) return;
  const el = root as Element; if (["SCRIPT", "STYLE", "TEXTAREA"].includes(el.tagName)) return;
  tAttrs(el);
  for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
}
function restore(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const o = textOrig.get(n); if (o != null && n.nodeValue === (n as any).__ar) { n.nodeValue = o; } textOrig.delete(n); delete (n as any).__ar; }
  (root as Element).querySelectorAll?.("[placeholder],[aria-label],[title],[alt]").forEach(el => { const o = attrOrig.get(el); if (o) for (const a of Object.keys(o)) if (el.getAttribute(a) === (el as any)[`__ar_${a}`]) el.setAttribute(a, o[a]!); attrOrig.delete(el); });
}

export function ArabicDom({ lang }: { lang: "en" | "ar" }) {
  const ref = useRef<HTMLSpanElement>(null);
  useBeforePaint(() => {
    const root = ref.current?.parentElement; if (!root) return;
    if (lang !== "ar") { restore(root); return; }
    walk(root);
    const mo = new MutationObserver(list => {
      mo.disconnect();
      for (const m of list) {
        if (m.type === "characterData") tNode(m.target);
        else if (m.type === "attributes") tAttrs(m.target as Element);
        else m.addedNodes.forEach(walk);
      }
      mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    });
    mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => { mo.disconnect(); restore(root); };
  }, [lang]);
  return <span ref={ref} hidden />;
}
