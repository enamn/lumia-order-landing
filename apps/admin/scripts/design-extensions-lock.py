#!/usr/bin/env python3
"""Locked state of the plans screen (trial over or plan ended): no Close button, a notice, and Log out. Run after design-extensions.py, then dc-to-jsx.py. Idempotent (marker LUMIA-LOCK)."""
import re
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-LOCK" in s: print("lock extension already applied"); raise SystemExit
m = re.search(r'<button type="button" onClick="\{\{ subClosePlans \}\}".*?</button>', s, re.S)
assert m and s.count('onClick="{{ subClosePlans }}"') == 1
close = m.group(0)
logout = '<sc-if value="{{ sub.locked }}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{ sub.logout }}" style="height:40px;padding:0 14px;border-radius:12px;border:1.5px solid #ECD9E0;font-size:14px;font-weight:600;flex:none" style-hover="background:#FBF3F8">{{ sub.logoutLabel }}</button></sc-if>'
s = s.replace(close, logout + '<sc-if value="{{ sub.canClose }}" hint-placeholder-val="{{ true }}">' + close + '</sc-if>')
old = '{{ sub.trialLine }}</p>'
assert s.count(old) == 1
s = s.replace(old, old + '\n              <sc-if value="{{ sub.locked }}" hint-placeholder-val="{{ false }}"><div role="alert" style="margin-top:12px;padding:12px 14px;border-radius:12px;background:#FFF1DC;color:#8A4B00;font-size:14px;font-weight:500;line-height:1.5">{{ sub.lockedMsg }}</div></sc-if>')
s = s.replace("</body>", "<!-- LUMIA-LOCK -->\n</body>", 1) if "</body>" in s else s + "\n<!-- LUMIA-LOCK -->\n"
p.write_text(s)
print("lock extension applied")
