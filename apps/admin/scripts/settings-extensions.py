#!/usr/bin/env python3
"""App-only tweaks to design/settings.dc.html: real links instead of the prototype's file names, no 'Upload new menu' button
(there is no re-upload flow yet), and a working logo upload. Idempotent. Re-run after re-importing the design, then run
python3 scripts/dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css"""
from pathlib import Path
import re
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-EXT embedded" in s: print("settings extensions already applied"); raise SystemExit

def once(old, new):
    global s
    assert s.count(old) == 1, (old[:60], s.count(old))
    s = s.replace(old, new)

assert s.count('href="Lumia Order Pre-Dashboard Flow v2.dc.html#dash"') == 2, 'run against a fresh copy of the design'
s = s.replace('href="Lumia Order Pre-Dashboard Flow v2.dc.html#dash"', 'href="{{ dashUrl }}"')
once('href="Lumia Order Pre-Dashboard Flow v2.dc.html#menu"', 'href="{{ menuUrl }}"')
s, n = re.subn(r'\s*<button type="button" onClick="\{\{ markDirty \}\}"[^>]*>Upload new menu</button>', '', s)
assert n == 1
# the profile logo: show the uploaded image and let the Upload button pick a file
once('flex:none">{{ initials }}</span>', 'flex:none;overflow:hidden">{{ logoNode }}</span>')
i = s.index('>Upload logo</button>'); j = s.rfind('onClick="{{ markDirty }}"', 0, i)
s = s[:j] + 'onClick="{{ pickLogo }}"' + s[j + len('onClick="{{ markDirty }}"'):]
once('<x-dc>', '<x-dc>\n<!-- LUMIA-EXT settings --><!-- LUMIA-EXT logo -->')
# the Day / Opens / Closes / Last order header only fits when the rows are side by side (very wide screens); otherwise each cell carries its own label
once('<sc-if value="{{ wide }}" hint-placeholder-val="{{ true }}">\n                    <div style="display:grid;grid-template-columns:{{ L.dayCols }}', '<sc-if value="{{ hoursHead }}" hint-placeholder-val="{{ true }}">\n                    <div style="display:grid;grid-template-columns:{{ L.dayCols }}')
# Embedded in the dashboard: the app's own sidebar is already on the left, so Settings keeps only its sub-navigation
# (a column on wide screens, tabs on narrow ones), scrolls with the page and has a floating save bar.
ASIDE_START = s.index('<aside style="flex:0 0 248px')
NAV_START = s.index('<nav style="flex:1;overflow-y:auto', ASIDE_START)
NAV_END = s.index('</nav>', NAV_START) + len('</nav>')
ASIDE_END = s.index('</aside>', NAV_END)
s = s[:ASIDE_START] + '<aside style="flex:0 0 210px;position:sticky;top:24px;align-self:flex-start;display:flex;flex-direction:column">\n      ' + s[NAV_START:NAV_END].replace('flex:1;overflow-y:auto;padding:14px 12px;', 'padding:0;') + '\n    ' + s[ASIDE_END:]
once('<div ref="{{ rootRef }}" style="height:100vh;height:100dvh;display:flex;overflow:hidden;background:#fff;', '<div ref="{{ rootRef }}" style="display:flex;gap:28px;align-items:flex-start;background:#fff;')
once('<div style="flex:1;min-width:0;min-height:0;display:flex;flex-direction:column">', '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px">')
# narrow header: no back link, it is a tab strip under the page heading
i = s.index('<a href="{{ dashUrl }}" aria-label="Back to dashboard"'); j = s.index('</a>', i) + 4
s = s[:i] + s[j:]
s = s.replace('<header style="flex:none;background:#fff;border-bottom:1px solid #F0E4E8">', '<header style="flex:none;background:#fff;border-bottom:1px solid #F0E4E8;margin:0 -4px">', 1)
s = s.replace('<div style="height:56px;padding:0 16px;display:flex;align-items:center;gap:10px">', '<div style="height:48px;padding:0 4px;display:flex;align-items:center;gap:10px">', 1)
once('<main ref="{{ mainRef }}" style="flex:1;min-height:0;overflow-y:auto">', '<main ref="{{ mainRef }}" style="flex:1;min-width:0">')
once('<div style="max-width:960px;margin:0 auto;padding:{{ L.pad }};', '<div style="max-width:960px;padding:{{ L.pad }};')
once('<div style="flex:none;border-top:1px solid #F0E4E8;background:#fff;padding:12px 16px;box-shadow:0 -10px 24px -18px rgba(26,8,21,.3)">', '<div style="position:sticky;bottom:12px;z-index:5;border:1px solid #F0E4E8;border-radius:16px;background:#fff;padding:12px 16px;box-shadow:0 10px 30px -12px rgba(26,8,21,.28)">')
once('<div style="max-width:880px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px">', '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px">')
s = s.replace('<!-- LUMIA-EXT settings -->', '<!-- LUMIA-EXT settings --><!-- LUMIA-EXT embedded -->', 1)
p.write_text(s); print("settings extensions applied")
