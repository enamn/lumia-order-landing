#!/usr/bin/env python3
"""Restaurant-name step: the operating country (a CountryPick slot). Run after design-extensions.py, then dc-to-jsx.py. Idempotent (marker LUMIA-COUNTRY)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-COUNTRY" in s: print("country extension already applied"); raise SystemExit
old = '''    <sc-if value="{{ nameErr }}" hint-placeholder-val="{{ false }}">
      <div role="alert" style="margin-top:10px;font-size:14px;color:#B4233B">{{ nameErrText }}</div>
    </sc-if>
'''
assert s.count(old) == 1
s = s.replace(old, old + '    {{ countryNode }}\n')
s = s.replace("<!-- LUMIA-EMAIL -->", "<!-- LUMIA-EMAIL --><!-- LUMIA-COUNTRY -->", 1)
p.write_text(s)
print("country extension applied")
