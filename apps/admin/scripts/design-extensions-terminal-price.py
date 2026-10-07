#!/usr/bin/env python3
"""Plans screen: the struck-through regular terminal price comes from the market's prices (and is hidden where none is set) instead of a fixed "AED 699". Run after design-extensions-terminal.py, then dc-to-jsx.py. Idempotent (marker LUMIA-TERMINAL-PRICE)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-TERMINAL-PRICE" in s: print("terminal price extension already applied"); raise SystemExit
old = '<span style="font-size:14px;color:#8A5A6E;text-decoration:line-through">AED 699</span>'
assert s.count(old) == 1
s = s.replace(old, '<sc-if value="{{ sub.hasRegular }}" hint-placeholder-val="{{ true }}"><span style="font-size:14px;color:#8A5A6E;text-decoration:line-through">{{ sub.termRegular }}</span></sc-if>')
s = s.replace("<!-- LUMIA-TERMINAL -->", "<!-- LUMIA-TERMINAL --><!-- LUMIA-TERMINAL-PRICE -->", 1)
p.write_text(s)
print("terminal price extension applied")
