import type { CSSProperties } from "react";
// Parses an inline-style string from the design into a React style object (cached).
const cache = new Map<string, CSSProperties>();
export function S(css: string): CSSProperties {
  const hit = cache.get(css); if (hit) return hit;
  const style: Record<string, string> = {}; let depth = 0, start = 0;
  const flush = (end: number) => {
    const decl = css.slice(start, end); const i = decl.indexOf(":"); if (i < 0) return;
    const prop = decl.slice(0, i).trim(), value = decl.slice(i + 1).trim(); if (!prop || value === "") return;
    style[prop.startsWith("--") ? prop : prop.replace(/^-(webkit|moz|ms)-/, (_, v) => v[0].toUpperCase() + v.slice(1) + "-").replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  };
  for (let k = 0; k < css.length; k++) { const ch = css[k]; if (ch === "(") depth++; else if (ch === ")") depth--; else if (ch === ";" && depth === 0) { flush(k); start = k + 1; } }
  flush(css.length);
  // React warns when a shorthand and its longhand are mixed; the design's background shorthand already ends with the fallback colour.
  if (style.background && style.backgroundColor) delete style.backgroundColor;
  // Same for text-decoration: expand the shorthand so React can update it without a conflict warning.
  if (style.textDecoration && style.textDecorationColor) { style.textDecorationLine = style.textDecoration; delete style.textDecoration; }
  cache.set(css, style as CSSProperties); return style as CSSProperties;
}
