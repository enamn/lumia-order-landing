#!/usr/bin/env python3
"""Dashboard menu: the currency in front of a price input follows the restaurant (dirham sign, riyal sign, or ISO code) instead of a fixed "AED". Run after design-extensions.py, then dc-to-jsx.py. Idempotent (marker LUMIA-CURSIGN)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-CURSIGN" in s: print("currency sign extension already applied"); raise SystemExit
old = 'flex:none">AED<input type="text"'
assert s.count(old) == 1, s.count(old)
s = s.replace(old, 'flex:none">{{ curSign }}<input type="text"')
s = s.replace("<!-- LUMIA-TERMINAL -->", "<!-- LUMIA-TERMINAL --><!-- LUMIA-CURSIGN -->", 1)
p.write_text(s)
print("currency sign extension applied")
