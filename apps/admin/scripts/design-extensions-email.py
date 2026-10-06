#!/usr/bin/env python3
"""Dashboard: a banner at the top of the content area asking for a verified contact email. Run after design-extensions.py, then dc-to-jsx.py. Idempotent (marker LUMIA-EMAIL)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-EMAIL" in s: print("email banner extension already applied"); raise SystemExit
old = '<main style="flex:1;min-width:0;min-height:0;overflow-y:auto;padding:{{ L.dashPad }};display:flex;flex-direction:column;gap:26px">'
assert s.count(old) == 1
s = s.replace(old, old + '\n      {{ emailBannerNode }}')
s = s.replace("<!-- LUMIA-LOCK -->", "<!-- LUMIA-LOCK --><!-- LUMIA-EMAIL -->", 1) if "<!-- LUMIA-LOCK -->" in s else s + "\n<!-- LUMIA-EMAIL -->\n"
p.write_text(s)
print("email banner extension applied")
