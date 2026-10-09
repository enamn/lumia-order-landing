"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// The terminal drawing of the pairing panel, copied from the settings design: the real terminal photo with the scan screen (and the "Connected" screen) laid over its display.
import React from "react";
import QRCode from "qrcode";
const ce = React.createElement;

export function TerminalArt({ scanned }: { scanned: boolean }) {
    const logo = (sz: number) => ce('svg', { width: sz, height: sz, viewBox: '0 0 100 100', fill: 'none', style: { display: 'block' } },
      ce('defs', null, ce('linearGradient', { id: 'gTQ', x1: 10, y1: 10, x2: 90, y2: 90, gradientUnits: 'userSpaceOnUse' }, ce('stop', { offset: 0, stopColor: '#FF5577' }), ce('stop', { offset: 1, stopColor: '#C93DFF' }))),
      ce('path', { d: 'M32 10H68a22 22 0 0 1 22 22v36a22 22 0 0 1-22 22H36L17 95l4-13a22 22 0 0 1-11-14V32a22 22 0 0 1 22-22z', stroke: 'url(#gTQ)', strokeWidth: 8, strokeLinejoin: 'round' }),
      ce('path', { d: 'M28 30V66H40', stroke: '#1A0815', strokeWidth: 10, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      ce('circle', { cx: 64, cy: 55, r: 11, stroke: 'url(#gTQ)', strokeWidth: 10 }));
    const mini = ce('div', { key: 'mini', style: { position: 'absolute', inset: 34, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 } },
      [1,1,1,0,1,1,1, 1,0,1,1,1,0,1, 1,1,1,0,1,1,1, 0,1,0,1,0,1,0, 1,1,1,0,1,0,1, 1,0,1,1,0,1,1, 1,1,1,0,1,1,0].map((on, i) => ce('span', { key: i, style: { borderRadius: 3, background: on ? '#1A0815' : 'transparent' } })));
    const corners = ['0 0', '1 0', '0 1', '1 1'].map((c, i) => { const [cx, cy] = c.split(' ').map(Number);
      return ce('span', { key: 'c' + i, style: { position: 'absolute', width: 36, height: 36, [cx ? 'right' : 'left']: 10, [cy ? 'bottom' : 'top']: 10,
        ['border' + (cy ? 'Bottom' : 'Top')]: '5px solid #FF5577', ['border' + (cx ? 'Right' : 'Left')]: '5px solid #FF5577',
        ['border' + (cy ? 'Bottom' : 'Top') + (cx ? 'Right' : 'Left') + 'Radius']: 12, animation: 'lo-breathe 1.6s ease-in-out infinite' } }); });
    const scanning = ce('div', { key: 'sc', style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center' } },
      ce('div', { style: { fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' } }, 'Scan restaurant code'),
      ce('div', { style: { position: 'relative', width: 210, height: 210, borderRadius: 22, background: '#fff', boxShadow: '0 10px 24px -14px rgba(120,20,80,.45)', overflow: 'hidden' } },
        mini, ...corners,
        ce('div', { style: { position: 'absolute', left: 14, right: 14, top: 0, height: 34, background: 'linear-gradient(180deg,rgba(255,85,119,0),rgba(255,85,119,.22) 70%,#FF5577 96%,rgba(255,85,119,0))', animation: 'lo-tscan 1.8s ease-in-out infinite' } })),
      ce('div', { style: { fontSize: 16, color: '#8A5A6E' } }, 'Scanning...'));
    const done = ce('div', { key: 'ok', style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', animation: 'lo-pop .45s ease-out both' } },
      ce('span', { style: { width: 120, height: 120, borderRadius: '50%', background: '#1F9D57', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 14px #E4F4EC' } },
        ce('svg', { width: 60, height: 60, viewBox: '0 0 20 20', fill: 'none' }, ce('path', { d: 'M5 10.5l3.2 3.2L15 7', stroke: '#fff', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
      ce('div', { style: { fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 12 } }, 'Connected'),
      ce('div', { style: { fontSize: 17, color: '#8A5A6E', lineHeight: 1.4 } }, 'Ready for orders'));
    const screen = ce('div', { key: 'scr', style: { position: 'absolute', left: 28, top: 130.8, width: 95.6, height: 191.7, overflow: 'hidden', borderRadius: 1 } },
      ce('div', { style: { width: 262, height: 525.5, transform: 'scale(.365)', transformOrigin: '0 0', background: scanned ? 'linear-gradient(180deg,#FFFFFF 0%,#EEF8F2 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#FDF4F8 62%,#F6ECFF 100%)', padding: '0 16px 20px', display: 'flex', flexDirection: 'column', color: '#1A0815', fontFamily: "'Geist',system-ui,sans-serif" } },
        ce('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 54, flex: 'none' } }, logo(28), ce('span', { style: { fontSize: 16, fontWeight: 600 } }, 'Lumia Order')),
        scanned ? done : scanning));
    return ce('div', { key: 'term', style: { position: 'relative', width: 150, height: 356, animation: scanned ? 'none' : 'lo-tbob 2.4s ease-in-out infinite', filter: 'drop-shadow(0 22px 22px rgba(26,8,21,.28))' } },
      ce('img', { src: '/brand/terminal.png', alt: 'Lumia Order terminal', style: { position: 'absolute', inset: 0, width: 150, height: 'auto', display: 'block' } }),
      screen);
  }

// A real QR code in the style of the design: rounded square modules, rounded finder squares and the Lumia mark in the middle (error correction level H leaves room for it).
export function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const m = React.useMemo(() => { try { return QRCode.create(text, { errorCorrectionLevel: "H" }); } catch { return null; } }, [text]);
  if (!m) return null;
  const n = m.modules.size, cell = size / (n + 2), off = cell, data = m.modules.data as unknown as ArrayLike<number>;
  const inFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const mid = n / 2, logo = Math.ceil(n * 0.2) / 2 + 0.5; // the middle fifth is left for the logo
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!data[y * n + x] || inFinder(x, y) || (Math.abs(x + 0.5 - mid) < logo && Math.abs(y + 0.5 - mid) < logo)) continue;
    rects.push(ce("rect", { key: `${x}-${y}`, x: off + x * cell + 0.3, y: off + y * cell + 0.3, width: cell - 0.6, height: cell - 0.6, rx: cell * 0.28, fill: "#1A0815" }));
  }
  const finder = (fx: number, fy: number, k: string) => ce("g", { key: k },
    ce("rect", { x: off + fx * cell + cell * 0.5, y: off + fy * cell + cell * 0.5, width: cell * 6, height: cell * 6, rx: cell * 1.6, fill: "none", stroke: "#1A0815", strokeWidth: cell }),
    ce("rect", { x: off + (fx + 2) * cell, y: off + (fy + 2) * cell, width: cell * 3, height: cell * 3, rx: cell * 0.9, fill: "#1A0815" }));
  const lg = size * 0.2;
  return ce("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { display: "block" }, role: "img", "aria-label": "QR code to connect the terminal" },
    ...rects, finder(0, 0, "f1"), finder(n - 7, 0, "f2"), finder(0, n - 7, "f3"),
    ce("defs", { key: "d" }, ce("linearGradient", { id: "lqg", x1: 0, y1: 0, x2: 1, y2: 1 }, ce("stop", { offset: 0, stopColor: "#FF5577" }), ce("stop", { offset: 1, stopColor: "#C93DFF" }))),
    ce("rect", { key: "w", x: size / 2 - lg / 2 - 4, y: size / 2 - lg / 2 - 4, width: lg + 8, height: lg + 8, rx: 12, fill: "#fff" }),
    ce("rect", { key: "g", x: size / 2 - lg / 2, y: size / 2 - lg / 2, width: lg, height: lg, rx: 10, fill: "url(#lqg)" }),
    ce("path", { key: "p", d: `M${size / 2 - lg * 0.17} ${size / 2 - lg * 0.25}v${lg * 0.5}h${lg * 0.36}`, stroke: "#fff", strokeWidth: 3.4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }));
}
