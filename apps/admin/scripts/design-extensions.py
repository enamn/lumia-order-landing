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
i = s.index('<span style="font-family')  # placeholder to keep linters quiet
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
p.write_text(s)
print("extensions applied")
