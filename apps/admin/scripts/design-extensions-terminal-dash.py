#!/usr/bin/env python3
"""Dashboard Overview: the terminal shipment card shows the terminal picture (public/brand/terminal.png) instead of the printer-icon placeholder of the export. Run after design-extensions-terminal.py, then dc-to-jsx.py. Idempotent (marker LUMIA-TERMINAL-DASH)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-TERMINAL-DASH" in s: print("terminal dashboard extension already applied"); raise SystemExit
start = '<div style="flex:none;width:44px;height:78px;position:relative;overflow:hidden;border-radius:8px;background:#FBF3F8">'
i = s.index(start); j = s.index('</svg></div></div>', i) + len('</svg></div></div>')
s = s[:i] + '<div style="flex:none;width:44px;height:78px;position:relative;overflow:hidden;border-radius:8px;background:#fff"><img src="/brand/terminal.png" alt="Lumia Order Terminal" width="44" height="78" style="display:block;width:100%;height:100%;object-fit:cover"></div>' + s[j:]
s = s.replace("<!-- LUMIA-TERMINAL -->", "<!-- LUMIA-TERMINAL --><!-- LUMIA-TERMINAL-DASH -->", 1)
p.write_text(s)
print("terminal dashboard extension applied")
