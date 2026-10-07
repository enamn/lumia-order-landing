#!/usr/bin/env python3
"""Plans screen: the terminal card says what is true. "Optional" (not "Required"), a different text for a restaurant that already owns a terminal, and no delivery address until a terminal is added. Run after design-extensions-prices.py, then dc-to-jsx.py. Idempotent (marker LUMIA-TERMINAL)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-TERMINAL" in s: print("terminal extension already applied"); raise SystemExit
badge = 'border-radius:999px;background:#1A0815;color:#fff">Required</span>'
assert s.count(badge) == 1; s = s.replace(badge, 'border-radius:999px;background:#1A0815;color:#fff">{{ sub.termBadge }}</span>')
text = "Every subscription includes at least one terminal."
assert s.count(text) == 1; s = s.replace(text, "{{ sub.termDesc }}")
start = '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:14px;font-weight:500;color:#3D1C31">Delivery address for the terminal</span>'
end = '<span style="font-size:13px;color:#8A5A6E;margin-top:-4px">Estimated delivery: 10–15 business days.</span>'
i = s.index(start); j = s.index(end, i) + len(end)
s = s[:i] + '<sc-if value="{{ sub.hasTerm }}" hint-placeholder-val="{{ true }}">' + s[i:j] + '</sc-if>' + s[j:]
# the picture: the design only has a printer-icon placeholder in this box (no image file), so draw the device like the landing page does
old = s[s.index('<div style="flex:none;width:64px;height:112px;position:relative;overflow:hidden;border-radius:10px;background:#fff">'):]
old = old[:old.index('</svg></div></div>') + len('</svg></div></div>')]
art = ('<div style="flex:none;width:64px;height:112px;position:relative;overflow:hidden;border-radius:10px;background:#fff"><svg width="64" height="112" viewBox="0 0 64 112" role="img" aria-label="Lumia Order Terminal">'
  '<defs><linearGradient id="lt-scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#f6ecff"/></linearGradient><linearGradient id="lt-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF5577"/><stop offset="1" stop-color="#C93DFF"/></linearGradient></defs>'
  '<ellipse cx="32" cy="108" rx="20" ry="3" fill="#28081e" opacity=".25"/>'
  '<rect x="9" y="4" width="46" height="102" rx="10" fill="#1b1b1e"/><rect x="9" y="4" width="46" height="26" rx="10" fill="#2a2a2e"/><rect x="12" y="22" width="40" height="8" fill="#151517"/>'
  '<text x="32" y="19" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#fff">lumia</text>'
  '<rect x="13" y="30" width="38" height="2" rx="1" fill="#070707"/><rect x="13" y="35" width="38" height="65" rx="4" fill="#060607"/><rect x="15" y="37" width="34" height="61" rx="2" fill="url(#lt-scr)"/>'
  '<rect x="15" y="45" width="34" height="9" fill="url(#lt-g)"/><rect x="19" y="60" width="20" height="3" rx="1.5" fill="#E9D5DF"/><rect x="19" y="67" width="26" height="3" rx="1.5" fill="#F0E4E8"/><rect x="19" y="74" width="16" height="3" rx="1.5" fill="#F0E4E8"/><rect x="19" y="86" width="26" height="7" rx="3.5" fill="#1A0815"/></svg></div>')
s = s.replace(old, art, 1)
s = s.replace("<!-- LUMIA-PRICES -->", "<!-- LUMIA-PRICES --><!-- LUMIA-TERMINAL -->", 1)
p.write_text(s)
print("terminal extension applied")
