#!/usr/bin/env python3
"""Both designs set their own font on the page root (inline), which hides the dashboard's rule that adds the dirham font. Put the dirham font into those font lists.
Run after the other extensions, then dc-to-jsx.py (flow) and dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css. Idempotent (marker LUMIA-DIRHAM-FONT)."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent / "design"
old = "font-family:'Geist','IBM Plex Sans Arabic',system-ui,sans-serif"
new = "font-family:'Geist','Dirham-Sans','IBM Plex Sans Arabic',system-ui,sans-serif"
for name in ("flow-v2.dc.html", "settings.dc.html"):
    p = root / name; s = p.read_text()
    if "LUMIA-DIRHAM-FONT" in s: print(name, "already applied"); continue
    n = s.count(old); s = s.replace(old, new)
    s = s.replace("<x-dc>", "<x-dc>\n<!-- LUMIA-DIRHAM-FONT -->", 1) if "<x-dc>" in s else s.replace("<!-- LUMIA-TERMINAL -->", "<!-- LUMIA-TERMINAL --><!-- LUMIA-DIRHAM-FONT -->", 1)
    p.write_text(s); print(name, "applied:", n, "font lists")
