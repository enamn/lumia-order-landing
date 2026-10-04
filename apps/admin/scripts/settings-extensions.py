#!/usr/bin/env python3
"""App-only tweaks to design/settings.dc.html: real links instead of the prototype's file names, no 'Upload new menu' button
(there is no re-upload flow yet), and a working logo upload. Idempotent. Re-run after re-importing the design, then run
python3 scripts/dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css"""
from pathlib import Path
import re
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-EXT logo" in s: print("settings extensions already applied"); raise SystemExit

def once(old, new):
    global s
    assert s.count(old) == 1, (old[:60], s.count(old))
    s = s.replace(old, new)

assert s.count('href="Lumia Order Pre-Dashboard Flow v2.dc.html#dash"') == 2
s = s.replace('href="Lumia Order Pre-Dashboard Flow v2.dc.html#dash"', 'href="{{ dashUrl }}"')
once('href="Lumia Order Pre-Dashboard Flow v2.dc.html#menu"', 'href="{{ menuUrl }}"')
s, n = re.subn(r'\s*<button type="button" onClick="\{\{ markDirty \}\}"[^>]*>Upload new menu</button>', '', s)
assert n == 1
# the profile logo: show the uploaded image and let the Upload button pick a file
once('flex:none">{{ initials }}</span>', 'flex:none;overflow:hidden">{{ logoNode }}</span>')
i = s.index('>Upload logo</button>'); j = s.rfind('onClick="{{ markDirty }}"', 0, i)
s = s[:j] + 'onClick="{{ pickLogo }}"' + s[j + len('onClick="{{ markDirty }}"'):]
once('<x-dc>', '<x-dc>\n<!-- LUMIA-EXT settings --><!-- LUMIA-EXT logo -->')
p.write_text(s); print("settings extensions applied")
