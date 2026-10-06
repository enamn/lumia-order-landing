#!/usr/bin/env python3
"""Settings: money labels show the restaurant's currency instead of a fixed "AED". Run after settings-extensions.py, then
python3 scripts/dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css. Idempotent (marker LUMIA-CURRENCY)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-CURRENCY" in s: print("settings currency extension already applied"); raise SystemExit
cut = s.rindex("<script")
head, tail = s[:cut], s[cut:]
n = head.count("(AED)") + head.count("for AED 24")
head = head.replace("(AED)", "({{ cur }})").replace("for AED 24", "for {{ cur }} 24")
head = head.replace("<x-dc>", "<x-dc>\n<!-- LUMIA-CURRENCY -->", 1)
p.write_text(head + tail)
print("settings currency extension applied:", n, "labels")
