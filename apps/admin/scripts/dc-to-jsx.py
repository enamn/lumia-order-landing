#!/usr/bin/env python3
"""Convert the Claude Design template (design/flow-v2.dc.html) into React.

Every inline style value is kept exactly as designed; `{{ path }}` bindings become `vm.path`,
<sc-if>/<sc-for> become conditionals/maps, and `style-hover` becomes generated :hover CSS.
Outputs: src/design/DcTemplate.tsx and src/design/dc-hover.css. Run: python3 scripts/dc-to-jsx.py
"""
import html, json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
# Optional args: <design file> <component name> <hover class prefix> <hover css file>. Defaults build the main flow.
ARGS = sys.argv[1:] + [None] * 4
SRC_NAME = ARGS[0] or "flow-v2.dc.html"; COMPONENT = ARGS[1] or "DcTemplate"; PREFIX = ARGS[2] or "dch"; HOVER_CSS = ARGS[3] or "dc-hover.css"
src = (root / "design" / SRC_NAME).read_text()
body = src[src.index("</helmet>") + len("</helmet>"): src.index('<script type="text/x-dc"')]
body = body.replace("</x-dc>", "").strip()
body = re.sub(r"<!--.*?-->", "", body, flags=re.S)

TAG = re.compile(r"<(/?)([A-Za-z][\w-]*)((?:\s+[^\s=>/]+(?:=\"[^\"]*\")?)*)\s*(/?)>", re.S)
ATTR = re.compile(r"([^\s=>/]+)(?:=\"([^\"]*)\")?", re.S)

class Node:
    def __init__(s, tag, attrs): s.tag, s.attrs, s.children = tag, attrs, []

top = Node("#root", [])
stack = [top]; pos = 0
for m in TAG.finditer(body):
    if m.start() > pos: stack[-1].children.append(body[pos:m.start()])
    pos = m.end(); closing, tag, attrs, selfc = m.groups()
    if closing:
        while len(stack) > 1 and stack[-1].tag != tag: stack.pop()
        if len(stack) > 1: stack.pop()
    else:
        node = Node(tag, [(a, v) for a, v in ATTR.findall(attrs)])
        stack[-1].children.append(node)
        if not selfc: stack.append(node)
if pos < len(body): stack[-1].children.append(body[pos:])

hover = {}   # (pseudo, declarations) -> class name
def hover_class(decl, pseudo="hover"):
    if (pseudo, decl) not in hover: hover[(pseudo, decl)] = f"{PREFIX}{len(hover)}"
    return hover[(pseudo, decl)]

EXPR = re.compile(r"\{\{\s*(.*?)\s*\}\}")
def X(expr, scope):
    if expr in ("true", "false", "null", "undefined"): return expr
    head = expr.split(".")[0]
    return expr if head in scope else "vm." + expr

def tpl_string(value, scope):
    """string containing {{ }} -> JS template literal"""
    out = ""; last = 0
    for m in EXPR.finditer(value):
        out += value[last:m.start()].replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
        out += "${" + X(m.group(1), scope) + "}"; last = m.end()
    out += value[last:].replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    return "`" + out + "`"

def attr_name(n):
    if n == "for": return "htmlFor"
    if n in ("inputmode", "autofocus", "autocomplete", "maxlength", "minlength", "tabindex", "readonly", "novalidate", "colspan", "rowspan"): return {"inputmode": "inputMode", "autofocus": "autoFocus", "autocomplete": "autoComplete", "maxlength": "maxLength", "minlength": "minLength", "tabindex": "tabIndex", "readonly": "readOnly", "novalidate": "noValidate", "colspan": "colSpan", "rowspan": "rowSpan"}[n]
    if n.startswith(("data-", "aria-")): return n
    return re.sub(r"-([a-z])", lambda m: m.group(1).upper(), n)

def attrs_jsx(node, scope):
    out = []; hov = None; foc = None
    for name, val in node.attrs:
        if name.startswith("hint-placeholder"): continue
        if name == "style-hover": hov = val; continue
        if name == "style-focus": foc = val; continue
        if name == "style":
            out.append("style={S(" + (tpl_string(val, scope) if "{{" in val else json.dumps(val)) + ")}"); continue
        an = attr_name(name)
        if val is None: out.append(an); continue
        m = re.fullmatch(r"\{\{\s*(.*?)\s*\}\}", val)
        if m:
            e = X(m.group(1), scope)
            out.append(f"{an}={{{'!!' + e if an == 'disabled' else e}}}")
        elif "{{" in val: out.append(f"{an}={{{tpl_string(val, scope)}}}")
        elif an in ("maxLength", "minLength", "rows", "cols", "tabIndex") and val.isdigit(): out.append(f"{an}={{{val}}}")
        else: out.append(f"{an}={json.dumps(html.unescape(val))}")
    classes = []
    for pseudo, val in (("hover", hov), ("focus", foc)):
        if val: classes.append(hover_class(";".join(f"{d.strip()} !important" for d in val.split(";") if d.strip()), pseudo))
    if classes: out.append(f'className="{" ".join(classes)}"')
    return (" " + " ".join(out)) if out else ""

def text_jsx(text, scope, first, last):
    parts = []; pos = 0
    pieces = []
    for m in EXPR.finditer(text):
        pieces.append(("t", text[pos:m.start()])); pieces.append(("e", m.group(1))); pos = m.end()
    pieces.append(("t", text[pos:]))
    for i, (k, v) in enumerate(pieces):
        if k == "e": parts.append("{" + X(v, scope) + "}"); continue
        v = html.unescape(re.sub(r"\s+", " ", v))
        if i == 0 and first: v = v.lstrip()
        if i == len(pieces) - 1 and last: v = v.rstrip()
        if v.strip() == "" and (i == 0 or i == len(pieces) - 1): 
            if v and 0 < i < len(pieces) - 1: pass
            else: v = ""
        if v: parts.append("{" + json.dumps(v) + "}" if re.search(r"[{}<>]", v) or v != v.strip() else v)
    return "".join(parts)

def emit(node, scope, ind):
    pad = "  " * ind
    if isinstance(node, str): return ""
    a = dict(node.attrs)
    kids = []
    items = node.children
    real = [i for i, c in enumerate(items) if not (isinstance(c, str) and c.strip() == "")]
    for i, c in enumerate(items):
        if isinstance(c, str):
            if c.strip() == "": continue
            kids.append(pad + "  " + text_jsx(c, scope, i == real[0], i == real[-1]))
        else:
            k = emit(c, scope, ind + 1)
            if k: kids.append(k)
    inner = "\n".join(kids)
    if node.tag == "sc-if":
        cond = X(EXPR.fullmatch(a["value"]).group(1), scope)
        return f"{pad}{{{cond} && (\n{pad}  <>\n{inner}\n{pad}  </>\n{pad})}}"
    if node.tag == "sc-for":
        lst = X(EXPR.fullmatch(a["list"]).group(1), scope); var = a["as"]
        real = [i for i, c in enumerate(items) if not (isinstance(c, str) and c.strip() == "")]
        inner = "\n".join(emit(c, scope | {var}, ind + 2) if not isinstance(c, str) else (pad + "    " + text_jsx(c, scope | {var}, i == real[0], i == real[-1]) if c.strip() else "") for i, c in enumerate(items))
        inner = "\n".join(l for l in inner.split("\n") if l.strip())
        return f"{pad}{{({lst} as any[]).map(({var}: any, __i: number) => (\n{pad}  <Fragment key={{__i}}>\n{inner}\n{pad}  </Fragment>\n{pad}))}}"
    at = attrs_jsx(node, scope)
    if not kids: return f"{pad}<{node.tag}{at} />"
    return f"{pad}<{node.tag}{at}>\n{inner}\n{pad}</{node.tag}>"

tree = "\n".join(k for k in (emit(c, frozenset(), 3) for c in top.children if not isinstance(c, str)) if k)
(root / "src/design").mkdir(exist_ok=True)
(root / f"src/design/{COMPONENT}.tsx").write_text(
    f'// GENERATED by scripts/dc-to-jsx.py from design/{SRC_NAME}. Do not edit by hand; change the design and re-run.\n'
    '/* eslint-disable */\nimport { Fragment } from "react";\nimport { S } from "./style";\n\n'
    f'export function {COMPONENT}({{ vm }}: {{ vm: any }}) {{\n  return (\n    <>\n' + tree + '\n    </>\n  );\n}\n')
(root / f"src/design/{HOVER_CSS}").write_text("/* GENERATED by scripts/dc-to-jsx.py from the design's style-hover attributes. */\n" + "\n".join(f".{c}:{ps}{{{d}}}" for (ps, d), c in hover.items()) + "\n")
print("nodes ok; hover rules:", len(hover), "bytes:", len(tree))
