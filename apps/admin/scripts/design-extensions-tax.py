#!/usr/bin/env python3
"""Plan summary: the VAT row shows the real rate and is hidden when no VAT is charged. Run after design-extensions.py, then dc-to-jsx.py. Idempotent (marker LUMIA-TAX)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-TAX" in s: print("tax extension already applied"); raise SystemExit
old = '<div style="display:flex;justify-content:space-between;gap:12px;color:#3D1C31"><span>VAT (5%)</span><span>{{ sub.vat }}</span></div>'
assert s.count(old) == 1
s = s.replace(old, '<sc-if value="{{ sub.hasVat }}" hint-placeholder-val="{{ true }}">' + old.replace("VAT (5%)", "{{ sub.vatLabel }}") + '</sc-if>')
s = s.replace("<!-- LUMIA-COUNTRY -->", "<!-- LUMIA-COUNTRY --><!-- LUMIA-TAX -->", 1)
p.write_text(s)
print("tax extension applied")
