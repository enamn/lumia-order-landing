#!/usr/bin/env python3
"""Plans screen: the terminal card keeps the design ("Required", its wording) but for a restaurant that already owns a terminal says "Optional" with its own text, and shows no delivery address until a terminal is added. Run after design-extensions-prices.py, then dc-to-jsx.py. Idempotent (marker LUMIA-TERMINAL)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-TERMINAL" in s: print("terminal extension already applied"); raise SystemExit
badge = 'border-radius:999px;background:#1A0815;color:#fff">Required</span>'
assert s.count(badge) == 1; s = s.replace(badge, 'border-radius:999px;background:#1A0815;color:#fff">{{ sub.termBadge }}</span>')
text = "The Lumia Order terminal for your restaurant. Orders are handled from your dashboard. Every subscription includes at least one terminal."
assert s.count(text) == 1; s = s.replace(text, "{{ sub.termDesc }}")
start = '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:14px;font-weight:500;color:#3D1C31">Delivery address for the terminal</span>'
end = '<span style="font-size:13px;color:#8A5A6E;margin-top:-4px">Estimated delivery: 10–15 business days.</span>'
i = s.index(start); j = s.index(end, i) + len(end)
s = s[:i] + '<sc-if value="{{ sub.hasTerm }}" hint-placeholder-val="{{ true }}">' + s[i:j] + '</sc-if>' + s[j:]
s = s.replace("<!-- LUMIA-PRICES -->", "<!-- LUMIA-PRICES --><!-- LUMIA-TERMINAL -->", 1)
p.write_text(s)
print("terminal extension applied")
