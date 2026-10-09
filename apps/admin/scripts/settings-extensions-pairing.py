#!/usr/bin/env python3
"""Settings > Devices: the connect panel of the new design (QR code, terminal drawing, steps, the code to type) instead of the old typed-code box, and a device badge that says Online or Offline.
Run after settings-extensions-terminal-connect.py, then python3 scripts/dc-to-jsx.py settings.dc.html SettingsTemplate dcs settings-hover.css. Idempotent (marker LUMIA-PAIRING)."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/settings.dc.html"
s = p.read_text()
if "LUMIA-PAIRING" in s: print("settings pairing extension already applied"); raise SystemExit
cut = s.rindex("<script"); head, tail = s[:cut], s[cut:]
a = head.index('<sc-if value="{{ pairing }}"'); b = head.index('<sc-if value="{{ noDevicesIdle }}"')
panel = '''<sc-if value="{{ pairing }}" hint-placeholder-val="{{ false }}">
              <section style="border:1.5px solid #E3CBD4;border-radius:16px;padding:22px;display:flex;flex-wrap:wrap;gap:28px;align-items:center">
                <div style="position:relative;width:236px;height:236px;flex:none;border-radius:20px;background:#fff;border:1px solid #ECD9E0;box-shadow:0 22px 44px -26px rgba(138,32,64,.45);display:flex;align-items:center;justify-content:center;overflow:hidden">
                  {{ pairQr }}
                </div>
                <div style="width:180px;height:380px;flex:none;display:flex;align-items:center;justify-content:center">
                  {{ pairTerm }}
                </div>
                <div style="flex:1 1 260px;display:flex;flex-direction:column;gap:14px">
                  <h2 style="font-size:17px;font-weight:600;letter-spacing:-0.015em">{{ pairTitle }}</h2>
                  <p style="font-size:14px;color:#3D1C31;line-height:1.5;text-wrap:pretty">{{ pairSub }}</p>
                  <ol style="list-style:none;display:flex;flex-direction:column;gap:10px">
                    <sc-for list="{{ pairSteps }}" as="st" hint-placeholder-count="3">
                      <li style="display:flex;align-items:center;gap:12px;font-size:14px"><span style="width:26px;height:26px;border-radius:50%;background:#FAF6FA;color:#8A5A6E;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;flex:none">{{ st.n }}</span><span>{{ st.label }}</span></li>
                    </sc-for>
                  </ol>
                  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:13px;color:#8A5A6E"><span>Can't scan? Enter code</span><span style="font-size:15px;font-weight:600;color:#1A0815;font-variant-numeric:tabular-nums;padding:4px 10px;border-radius:8px;background:#FAF6FA">{{ pairCode }}</span><span>· {{ pairNote }}</span></div>
                  <sc-if value="{{ pairError }}" hint-placeholder-val="{{ false }}"><div role="alert" style="font-size:14px;color:#B42318">{{ pairError }}</div></sc-if>
                  <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <sc-if value="{{ pairExpired }}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{ newPairCode }}" style="height:44px;padding:0 18px;border-radius:12px;background:linear-gradient(90deg,#FF5577,#C93DFF);color:#fff;font-weight:600;font-size:15px">New code</button></sc-if>
                    <button type="button" onClick="{{ cancelPair }}" style="height:44px;padding:0 18px;border-radius:12px;border:1.5px solid #ECD9E0;background:#fff;font-weight:500;font-size:15px" style-hover="background:#FBF3F8">Cancel</button>
                  </div>
                </div>
              </section>
            </sc-if>
            '''
head = head[:a] + panel + head[b:]
old = '<span style="display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:500;background:#E6F4EC;color:#16704A"><span style="width:7px;height:7px;border-radius:50%;background:currentColor"></span>Online</span>'
assert head.count(old) == 1
head = head.replace(old, '<span style="display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:500;background:{{ v.badgeBg }};color:{{ v.badgeFg }}"><span style="width:7px;height:7px;border-radius:50%;background:currentColor"></span>{{ v.badge }}</span>')
head = head.replace("<!-- LUMIA-TERMINAL -->", "<!-- LUMIA-TERMINAL --><!-- LUMIA-PAIRING -->", 1)
p.write_text(head + tail)
print("settings pairing extension applied")
