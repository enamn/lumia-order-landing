#!/usr/bin/env python3
"""Settings > Devices: the restaurant's ordered terminal is shown as a card with the terminal picture (public/brand/terminal.png) and its delivery status, and the empty state uses the picture instead of the printer-icon placeholder.
Run after settings-extensions.py, then python3 scripts/dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css. Idempotent (marker LUMIA-TERMINAL)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-TERMINAL" in s: print("settings terminal extension already applied"); raise SystemExit
cut = s.rindex("<script"); head, tail = s[:cut], s[cut:]
# empty state: the picture instead of the pink printer icon
i = head.index('<span style="width:56px;height:56px;border-radius:16px;background:#FDEAF2;display:flex;align-items:center;justify-content:center"><svg width="26" height="26" viewBox="0 0 20 20" fill="none">')
j = head.index('</svg></span>', i) + len('</svg></span>')
img = '<img src="/brand/terminal.png" alt="Lumia Order Terminal" width="72" height="126" style="display:block;width:72px;height:126px;object-fit:cover;border-radius:12px;background:#fff">'
head = head[:i] + img + head[j:]
# the ordered terminal, above the device grid
grid = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:16px">'
assert head.count(grid) == 1
card = ('<sc-if value="{{ termShow }}" hint-placeholder-val="{{ false }}"><article style="border:1px solid #F0E4E8;border-radius:16px;padding:18px 20px;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">'
  '<img src="/brand/terminal.png" alt="Lumia Order Terminal" width="72" height="126" style="flex:none;display:block;width:72px;height:126px;object-fit:cover;border-radius:12px;background:#fff;border:1px solid #F0E4E8">'
  '<div style="flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:10px">'
  '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px"><h2 style="font-size:17px;font-weight:600;letter-spacing:-0.015em">Lumia Order Terminal</h2>'
  '<span style="display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:500;background:{{ termPillBg }};color:{{ termPillFg }}">{{ termLabel }}</span></div>'
  '<p style="font-size:14px;color:#3D1C31;line-height:1.5">{{ termMsg }}</p>'
  '<dl style="display:flex;flex-direction:column"><sc-for list="{{ termRows }}" as="r" hint-placeholder-count="0"><div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #F3EEF1;font-size:14px"><dt style="color:#8A5A6E">{{ r.k }}</dt><dd style="font-weight:500;text-align:end">{{ r.v }}</dd></div></sc-for></dl>'
  '</div></article></sc-if>\n            ')
head = head.replace(grid, card + grid, 1)
head = head.replace("<x-dc>", "<x-dc>\n<!-- LUMIA-TERMINAL -->", 1)
p.write_text(head + tail)
print("settings terminal extension applied")
