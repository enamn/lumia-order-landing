#!/usr/bin/env python3
"""Settings → Profile: a verify-the-email row under the Email field. Run after settings-extensions.py, then
python3 scripts/dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css. Idempotent (marker LUMIA-EMAIL)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-EMAIL" in s: print("settings email extension already applied"); raise SystemExit
old = 'onChange="{{ prof.email.set }}" style="height:44px;width:100%;padding:0 12px;border-radius:10px;border:1.5px solid #ECD9E0;background:#fff;font-size:15px" style-focus="border-color:#C93DFF"></input></label>'
assert s.count(old) == 1
s = s.replace(old, old[:-len("</label>")] + '{{ emailVerifyNode }}</label>')
s = s.replace("<x-dc>", "<x-dc>\n<!-- LUMIA-EMAIL -->", 1)
p.write_text(s)
print("settings email extension applied")
