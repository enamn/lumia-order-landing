#!/usr/bin/env python3
"""Adds the few app-only states the design does not draw (errors, add-item dialog, hidden "Today" card) to design/flow-v2.dc.html.
Idempotent: skips if already applied. Re-run after re-importing the design from Claude Design, then run dc-to-jsx.py."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "design/flow-v2.dc.html"
s = p.read_text()
if "LUMIA-EXT" in s: print("extensions already applied"); raise SystemExit
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:70], s.count(old))
    s = s.replace(old, new)
ERR = 'font-size:14px;color:#B4233B'
# 1 name step: server errors
rep('>Enter your restaurant name to continue</div>', '>{{ nameErrText }}</div>')
# 2 menu upload: error banner under the drop zone
rep('''    </label>
    <div style="flex:{{ L.spacer }};min-height:28px"></div>''', '''    </label>
    <!-- LUMIA-EXT menu error -->
    <sc-if value="{{ menuErr }}" hint-placeholder-val="{{ false }}"><div role="alert" style="margin-top:12px;''' + ERR + '''">{{ menuErr }}</div></sc-if>
    <div style="flex:{{ L.spacer }};min-height:28px"></div>''')
# 3 hide the Today card until messages/orders are stored
j = s.index('{{ waToday }}'); k = s.rfind('<sc-if value="{{ waIsConnected }}"', 0, j)
s = s[:k] + '<!-- LUMIA-EXT today hidden --><sc-if value="{{ waShowToday }}"' + s[k + len('<sc-if value="{{ waIsConnected }}"'):]
# 4 ready step: confirm error
rep('''    <div style="flex:{{ L.spacer }};min-height:24px"></div>''', '''    <sc-if value="{{ readyErr }}" hint-placeholder-val="{{ false }}"><div role="alert" style="margin-top:12px;''' + ERR + '''">{{ readyErr }}</div></sc-if>
    <div style="flex:{{ L.spacer }};min-height:24px"></div>''')
# 5 dashboard: page-level error under the setup banner
rep('''      <sc-if value="{{ pageMenu }}" hint-placeholder-val="{{ true }}">''', '''      <!-- LUMIA-EXT dash error -->
      <sc-if value="{{ dashErr }}" hint-placeholder-val="{{ false }}"><div role="alert" style="''' + ERR + '''">{{ dashErr }}</div></sc-if>
      <sc-if value="{{ pageMenu }}" hint-placeholder-val="{{ true }}">''') if s.count('      <sc-if value="{{ pageMenu }}" hint-placeholder-val="{{ true }}">') == 1 else None
# 6 wire the buttons the design leaves as no-ops
rep('onClick="{{ noop }}" style="height:44px;padding:0 18px;border-radius:12px;border:1.5px solid #ECD9E0;background:#fff;font-weight:500;font-size:15px" style-hover="background:#FBF3F8">{{ t.addItem }}', 'onClick="{{ openAddItem }}" style="height:44px;padding:0 18px;border-radius:12px;border:1.5px solid #ECD9E0;background:#fff;font-weight:500;font-size:15px" style-hover="background:#FBF3F8">{{ t.addItem }}')
rep('>Add item manually</button>', '>Add item manually</button>')
s = s.replace('<button type="button" onClick="{{ noop }}" style="height:46px;padding:0 20px;border-radius:12px;border:1.5px solid #ECD9E0;background:#fff;font-weight:500;font-size:15px" style-hover="background:#FBF3F8">Add item manually', '<button type="button" onClick="{{ openAddItem }}" style="height:46px;padding:0 20px;border-radius:12px;border:1.5px solid #ECD9E0;background:#fff;font-weight:500;font-size:15px" style-hover="background:#FBF3F8">Add item manually')
a = s.index('+ {{ t.addAr }}'); b = s.rfind('onClick="{{ noop }}"', 0, a); s = s[:b] + 'onClick="{{ it.editAr }}"' + s[b + len('onClick="{{ noop }}"'):]
# 6b WhatsApp catalog counts
for old, new in [(">37</span>", ">{{ waCatTotal }}</span>"), (">products · 5 categories</span>", ">products · {{ waCatCount }} categories</span>"), ("by 37 products from", "by {{ waCatTotal }} products from")]: s = s.replace(old, new)
# 6c real legal links
s = s.replace('href="#terms"', 'href="{{ termsUrl }}"').replace('href="#privacy"', 'href="{{ privacyUrl }}"')
# 7 add-item / add-Arabic-name dialog (styled like the design's confirm dialogs)
DLG = '''
<!-- LUMIA-EXT edit dialog -->
<sc-if value="{{ dlg.open }}" hint-placeholder-val="{{ false }}">
<div dir="ltr" style="position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:20px">
  <div onClick="{{ dlg.cancel }}" style="position:absolute;inset:0;background:rgba(26,8,21,.36)"></div>
  <form role="dialog" aria-modal="true" aria-label="{{ dlg.title }}" data-screen-label="09 Edit dialog" onSubmit="{{ dlg.submit }}" noValidate="{{ true }}" style="position:relative;width:100%;max-width:420px;background:#fff;border-radius:20px;padding:26px 24px 22px;box-shadow:0 30px 80px -30px rgba(26,8,21,.45);display:flex;flex-direction:column">
    <h2 style="font-size:22px;font-weight:600;letter-spacing:-0.03em">{{ dlg.title }}</h2>
    <p style="font-size:15px;line-height:1.5;color:#3D1C31;margin-top:8px;text-wrap:pretty">{{ dlg.hint }}</p>
    <sc-for list="{{ dlg.fields }}" as="f" hint-placeholder-count="3">
      <label style="display:block;font-size:14px;font-weight:500;color:#3D1C31;margin-top:16px">{{ f.label }}
        <input type="text" value="{{ f.value }}" onChange="{{ f.onChange }}" placeholder="{{ f.placeholder }}" dir="{{ f.dir }}" inputMode="{{ f.mode }}" autoFocus="{{ f.focus }}" style="display:block;margin-top:8px;height:48px;width:100%;border-radius:12px;border:1.5px solid #E3CBD4;padding:0 14px;font-size:16px;background:#fff"></input>
      </label>
    </sc-for>
    <sc-if value="{{ dlg.error }}" hint-placeholder-val="{{ false }}"><div role="alert" style="margin-top:12px;''' + ERR + '''">{{ dlg.error }}</div></sc-if>
    <div style="display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:24px">
      <button type="button" onClick="{{ dlg.cancel }}" style="flex:1 1 120px;height:48px;padding:0 18px;border-radius:12px;border:1.5px solid #ECD9E0;background:#fff;font-weight:500;font-size:15px" style-hover="background:#FBF3F8">Cancel</button>
      <button type="submit" disabled="{{ dlg.busy }}" style="flex:1 1 160px;height:48px;padding:0 18px;border-radius:12px;background:linear-gradient(90deg,#FF5577,#C93DFF);color:#fff;font-weight:600;font-size:15px;opacity:{{ dlg.op }}">{{ dlg.saveLabel }}</button>
    </div>
  </form>
</div>
</sc-if>
'''
marker = '<!-- WhatsApp connection drawer -->'
rep(marker, DLG + '\n' + marker)
# 9 orders page: error banner above the status tabs
TABS = '\n        <div style="display:flex;gap:8px;overflow-x:auto;flex:none;padding-bottom:2px;scrollbar-width:none">'
rep(TABS, '\n        <sc-if value="{{ ordErr }}" hint-placeholder-val="{{ false }}"><div role="alert" style="font-size:14px;color:#B4233B">{{ ordErr }}</div></sc-if>' + TABS)
# 10 orders page: loader (shown only when loading is slow)
rep('<sc-if value="{{ ord.empty }}" hint-placeholder-val="{{ false }}">', '<sc-if value="{{ ordLoading }}" hint-placeholder-val="{{ false }}">{{ loaderNode }}</sc-if>\n          <sc-if value="{{ ord.empty }}" hint-placeholder-val="{{ false }}">')
# 11 overview: shared loader while the numbers load (only when slow), numbers hidden until they arrive
rep('      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:12px">\n        <sc-for list="{{ stats }}"', '      <sc-if value="{{ ovLoading }}" hint-placeholder-val="{{ false }}">{{ loaderNode }}</sc-if>\n      <sc-if value="{{ ovReady }}" hint-placeholder-val="{{ true }}">\n      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:12px">\n        <sc-for list="{{ stats }}"')
rep('        </section>\n      </div>\n      </sc-if>\n\n      <!-- LUMIA-EXT dash error -->', '        </section>\n      </div>\n      </sc-if>\n      </sc-if>\n\n      <!-- LUMIA-EXT dash error -->')
# 8 the design embeds the Settings file with <dc-import>; the app renders its Settings component in that slot
import re as _re
s, _n = _re.subn(r'<dc-import name="Lumia Order Restaurant Settings"[^>]*></dc-import>', '<div style="flex:1;min-width:0;height:100%">{{ settingsNode }}</div>', s); assert _n == 1
# 12 subscriptions. Payment is Stripe's hosted Checkout (no card fields in Lumia), the device preview becomes an icon, tracking is real data.
ICON = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#C0284F"><svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M5.5 8V3.5h9V8M5.5 14H3V8h14v6h-2.5M6 11h8v6H6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>'
s, _n = _re.subn(r'<div style="position:absolute;top:-?\d+px;left:50%;margin-left:-150px;transform:scale\([\d.]+\);transform-origin:top center;height:704px"><dc-import name="LumiaTerminal"[^>]*></dc-import></div>', ICON, s); assert _n == 2, _n
i = s.index('<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px">\n                <button type="button" onClick="{{ subQuick }}"'); j = s.index('<button type="submit" disabled="{{ sub.invalid }}"', i)
s = s[:i] + s[j:]
rep('Secure payment. Cancel anytime from Settings.</p>', 'You pay on Stripe’s secure page, so Lumia never sees your card. Cancel anytime from Manage billing.</p>\n              <sc-if value="{{ sub.err }}" hint-placeholder-val="{{ false }}"><div role="alert" style="font-size:14px;color:#B4233B">{{ sub.err }}</div></sc-if>')
rep('<span style="color:#3D1C31">Aramex · Tracking no. <span style="font-weight:600;color:#1A0815;font-variant-numeric:tabular-nums">4419 2071 553</span></span>', '<span style="color:#3D1C31">Tracking no. <span style="font-weight:600;color:#1A0815;font-variant-numeric:tabular-nums">{{ term.tracking }}</span></span>')
rep('<a href="#" onClick="{{ noopPrevent }}" style="font-weight:500">Track with courier</a>', '')
OLD_PAID = '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:#E4F4EC;color:#16704A;font-size:14px;font-weight:600"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="m5 10.5 3.2 3L15 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>{{ sub.paidName }} plan</div>'
rep(OLD_PAID, '<div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;background:{{ sub.paidBg }};color:{{ sub.paidFg }};font-size:14px;font-weight:600"><span style="display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="m5 10.5 3.2 3L15 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>{{ sub.paidName }} plan</span><span style="font-size:13px;font-weight:500">{{ sub.renewLine }}</span><sc-if value="{{ sub.canPortal }}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{ subPortal }}" style="align-self:flex-start;font-size:13px;font-weight:600;text-decoration:underline;text-underline-offset:3px">{{ sub.portalLabel }}</button></sc-if></div>')
p.write_text(s)
print("extensions applied")
