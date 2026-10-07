#!/usr/bin/env python3
"""Settings > Devices: a "Connect" button on the terminal card (the pairing screen with the QR code and the text code still needs its design). Run after settings-extensions-terminal.py, then dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css. Idempotent (marker LUMIA-TERMINAL-CONNECT)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-TERMINAL-CONNECT" in s: print("settings terminal connect extension already applied"); raise SystemExit
cut = s.rindex("<script"); head, tail = s[:cut], s[cut:]
end = '</dl></div></article></sc-if>'
assert head.count(end) == 1
btn = '</dl><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button type="button" onClick="{{ startPair }}" style="height:44px;padding:0 20px;border-radius:12px;background:linear-gradient(90deg,#FF5577,#C93DFF);color:#fff;font-weight:600;font-size:15px" style-hover="background:linear-gradient(90deg,#F2446A,#B52EEA)">Connect</button></div></div></article></sc-if>'
head = head.replace(end, btn, 1)
head = head.replace("<!-- LUMIA-TERMINAL -->", "<!-- LUMIA-TERMINAL --><!-- LUMIA-TERMINAL-CONNECT -->", 1)
p.write_text(head + tail)
print("settings terminal connect extension applied")
