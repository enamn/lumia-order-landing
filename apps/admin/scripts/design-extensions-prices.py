#!/usr/bin/env python3
"""Plans screen: the terminal is optional (software only works fully) and is hidden where it is not sold. Run after design-extensions.py, then dc-to-jsx.py. Idempotent (marker LUMIA-PRICES)."""
from pathlib import Path
import re
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-PRICES" in s: print("prices extension already applied"); raise SystemExit
def wrap(open_tag_start, close_marker, flag, hint="true"):
    global s
    i = s.index(open_tag_start); j = s.index(close_marker, i) + len(close_marker)
    s = s[:i] + f'<sc-if value="{{{{ {flag} }}}}" hint-placeholder-val="{{{{ {hint} }}}}">' + s[i:j] + '</sc-if>' + s[j:]
# the terminal card in the payment step (a whole <section> up to its closing tag)
wrap('<section style="border:2px solid #FF5577;background:#FFF7FA;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:14px"', '</section>', 'sub.terminalOn')
# "+ Terminal ... one-time" on every plan card
wrap('<span style="font-size:13px;color:#8A2040;margin-top:8px;padding:6px 10px;border-radius:8px;background:#FDEAF2;align-self:flex-start">+ Terminal', '</span>', 'sub.terminalOn')
# the terminal row in the total
row = '<div style="display:flex;justify-content:space-between;gap:12px;color:#3D1C31"><span>{{ sub.termLine }}</span><span>{{ sub.termAmt }}</span></div>'
assert s.count(row) == 1
s = s.replace(row, '<sc-if value="{{ sub.hasTerm }}" hint-placeholder-val="{{ true }}">' + row + '</sc-if>')
# plans without a price yet (a market whose prices are not approved): a notice above the plans
anchor = '<h1 style="font-size:28px;font-weight:600;letter-spacing:-0.035em">Choose your plan</h1>'
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + '\n              <sc-if value="{{ sub.pricesSoon }}" hint-placeholder-val="{{ false }}"><div role="status" style="margin-top:10px;padding:12px 14px;border-radius:12px;background:#FFF1DC;color:#8A4B00;font-size:14px;font-weight:500;line-height:1.5">{{ sub.pricesSoonMsg }}</div></sc-if>')
s = s.replace("<!-- LUMIA-TAX -->", "<!-- LUMIA-TAX --><!-- LUMIA-PRICES -->", 1)
p.write_text(s)
print("prices extension applied")
