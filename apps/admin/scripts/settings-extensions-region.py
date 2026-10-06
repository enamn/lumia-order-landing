#!/usr/bin/env python3
"""Settings: the first-level address division is called by its country's name (Emirate, Region, Governorate, Municipality) instead of a fixed "Emirate".
Run after settings-extensions.py, then python3 scripts/dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css. Idempotent (marker LUMIA-REGION)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-REGION" in s: print("settings region extension already applied"); raise SystemExit
cut = s.rindex("<script"); head, tail = s[:cut], s[cut:]
n = head.count(">Emirate</span>")
head = head.replace(">Emirate</span>", ">{{ regionLabel }}</span>")
head = head.replace("<x-dc>", "<x-dc>\n<!-- LUMIA-REGION -->", 1)
p.write_text(head + tail)
print("settings region extension applied:", n, "labels")
