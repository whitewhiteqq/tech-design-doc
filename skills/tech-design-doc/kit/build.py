"""Build the pages of a design document: draw every figure once, then bake it into every page.

Usage:  python build.py [path/to/doc.json] [--keep-harness] [--no-check]
        python build.py --new-figure NAME TEMPLATE    writes figures/NAME.json from the example DATA
                                                       of kit/figures/TEMPLATE.js (needs Node)

Build in place: never copy the kit into a project. A project doc.json needs only "pages", e.g.
  {"pages": [{"shell": "design.html", "out": "design-built.html"}]}
"prelude", "runtime" and "style" default to the kit files, and "figures" to a "figures" folder next
to doc.json. A figure is either figures/NAME.js (a full script) or figures/NAME.json, which reuses a
kit template with your data and no JS:  {"template": "system", "data": { ...the DATA block... }}
A shell may hold <!--@@INCLUDE path/to/file.svg@@--> (path relative to the shell): the build inlines
that file, e.g. the .svg that scripts/cloud_diagram.py writes.

doc.json, every path relative to doc.json:
  {"figures": "figures", "prelude": "prelude.js", "icons": "icons.js", "runtime": "runtime.js",
   "style": "style.css",
   "pages": [{"shell": "shells/design-shell.html", "out": "../examples/relay-design.html"}]}
  "icons" is optional: the vendor marks that tools/make_icons.py writes (ICONS and svcIcon). With it,
  the harness loads that file after prelude.js and before the figure scripts, so a figure such as
  figures/services.js can draw a vendor mark. Without it, no figure may use svcIcon or ICONS.

Steps:
  1. Read every shell. A placeholder is an empty <svg id="fig-NAME"></svg>, and each one needs
     <figures>/NAME.js.
  2. Write ONE harness page: style.css, prelude.js, icons.js when doc.json names it, every named
     figure script, one placeholder each.
  3. Draw the harness once in headless Chrome, and read the drawn <svg> markup back from the DOM.
     Shells that name no figure (an explainer page with static SVG) need no draw and no Chrome.
  4. In every page, put the drawn markup into each placeholder, style.css into <!--@@STYLE@@--> and
     runtime.js into <!--@@SCRIPT@@-->. So a figure is byte-identical on every page that names it.
  5. Check every page, and write the pages only when every check passes.

The build fails, and writes no page, when: a placeholder names a figure with no script; a figure
script throws an error; a figure draws fewer than 10 elements; '</script' appears in inlined JS; a
built page fetches anything; a built page has more than one <script>; a built page has a duplicate id;
a figure script uses svcIcon or ICONS and doc.json names no icons file.
It warns, and still writes, when: a figure script uses document, window or Math.random instead of the
prelude API; a figure and its table twin disagree (tools/check_pages.py fails on that); a link
points at no id.

After it writes the pages, the build runs ../scripts/check_diagrams.py on each one (spacing and
overlap, measured in Chrome) and exits 1 on any FAIL. --no-check skips that, for a draft only.

--keep-harness  also write the harness next to doc.json as _harness.html. Open it in Chrome to
                debug a figure with DevTools.
Chrome: env CHROME, else the usual install paths of Chrome and Edge, else PATH.
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.dont_write_bytecode = True                   # no __pycache__ folder inside the kit
sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))
try:
    import check_pages as cp  # one definition of a valid page, for the build and for the checker
except ImportError:
    sys.exit("FAIL  build.py needs tools/check_pages.py next to it. Copy the whole kit folder.")

STYLE_MARK, SCRIPT_MARK = "<!--@@STYLE@@-->", "<!--@@SCRIPT@@-->"
INCLUDE = re.compile(r"<!--@@INCLUDE\s+(?P<path>[^@]+?)\s*@@-->")
KIT = Path(__file__).resolve().parent
STARTER_LEFTOVERS = ("TOPIC NAME", "ONE LINE: WHAT", "DECISION AS ONE", "THE CONSTRAINT THAT",
                     "READERS.", "ONE-LINE SCOPE", "Proposed · DATE", "<b>Owner:</b> TEAM", "QUESTION?",
                     "FIGURE NAME", "THE CONCLUSION", "SERVICE</td>")
DEFAULTS = {"prelude": "prelude.js", "runtime": "runtime.js", "style": "style.css"}
DATA_BLOCK = re.compile(r"^const DATA = \{.*?^\};[ 	]*$", re.S | re.M)
NAME_LINE = re.compile(r"^const NAME = '[^']*';", re.M)
PLACEHOLDER = re.compile(r"<svg\b(?P<attrs>" + cp.ATTRS + r")(?:/>|>\s*</svg\s*>)", re.I)
NAME_OK = re.compile(r"^[A-Za-z0-9_-]+$")
DOCTYPE = re.compile(r"^\s*<!doctype[^>]*>", re.I)
BAD_VALUE = re.compile(r'[\w:-]+="[^"]*\b(?:NaN|undefined|Infinity)\b[^"]*"'
                       r'|>[^<]*\b(?:NaN|undefined)\b[^<]*<')
MIN = cp.MIN_ELEMENTS
DRAW_FLAGS = ["--headless=new", "--disable-gpu", "--run-all-compositor-stages-before-draw",
              "--virtual-time-budget=4000"]
PRELUDE_API = "P, el, txt, tip, rnd, pol, at, measure, figure"
ICONS_API = "ICONS, svcIcon"                     # from icons.js, when doc.json names it
OFF_API = re.compile(r"\b(?:document|window|globalThis)\s*\.|\bMath\s*\.\s*random\s*\(")
USES_ICONS = re.compile(r"\bsvcIcon\s*\(|\bICONS\s*[.\[]")


def strip_js_comments(js: str) -> str:
    """The code of a figure script with its comments blanked out, line breaks kept. A rough cut for
    a lint: a '//' after a colon or a quote stays, so 'http://' in a string is not a comment."""
    js = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), js, flags=re.S)
    return re.sub(r"(?<![:'\"`\\])//[^\n]*", "", js)
CHROME_PATHS = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "%LOCALAPPDATA%/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]
CHROME_NAMES = ["google-chrome", "chromium", "chrome", "msedge", "google-chrome-stable",
                "chromium-browser"]

# The harness logs every error, and which script set the viewBox of which figure, into <pre id="tdd-log">.
LOGGER = """window.__tdd={cur:'(prelude)',errors:[],drawn:[],
  flush(){document.getElementById('tdd-log').textContent=JSON.stringify({errors:this.errors,drawn:this.drawn})}};
addEventListener('error',e=>{__tdd.errors.push({fig:__tdd.cur,msg:String(e.message||e.error),
  line:e.lineno||0,col:e.colno||0,stack:String(e.error&&e.error.stack||'')});__tdd.flush()});
addEventListener('unhandledrejection',e=>{const r=e.reason;__tdd.errors.push({fig:__tdd.cur,
  msg:'unhandled promise rejection: '+String(r&&r.message||r),line:0,col:0,stack:String(r&&r.stack||'')});
  __tdd.flush()});
new MutationObserver(ms=>{ms.forEach(m=>{if(m.target.id.startsWith('fig-'))
  __tdd.drawn.push({svg:m.target.id,by:__tdd.cur})});__tdd.flush()})
  .observe(document.body,{subtree:true,attributes:true,attributeFilter:['viewBox']});"""


class BuildError(Exception):
    pass


def find_chrome() -> str:
    """Chrome or Edge: env CHROME, then the usual install paths, then PATH."""
    env = os.environ.get("CHROME")
    if env:
        if Path(env).is_file():
            return env
        raise BuildError(f'CHROME is set to "{env}", but no file is there. Fix the path, or unset CHROME.')
    for p in CHROME_PATHS:
        if p.startswith("%LOCALAPPDATA%"):
            local = os.environ.get("LOCALAPPDATA")
            if not local:
                continue
            p = local.replace("\\", "/") + p[len("%LOCALAPPDATA%"):]
        if Path(p).is_file():
            return p
    for name in CHROME_NAMES:
        found = shutil.which(name)
        if found:
            return found
    raise BuildError("no Chrome or Edge found. Install Google Chrome, or set CHROME to the browser "
                     "program (for example CHROME=/usr/bin/chromium).")


def show(p: Path) -> str:
    return cp.show(p)


def read(p: Path, what: str) -> str:
    if not p.is_file():
        raise BuildError(f"{what} {show(p)} does not exist")
    return p.read_bytes().decode("utf-8-sig")


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def placeholders(text: str) -> list[tuple[int, int, str, str]]:
    """Every empty <svg id="fig-NAME"></svg> outside comments, scripts and styles:
    (start, end, NAME, the other attributes)."""
    spans, out = cp.skip_spans(text), []
    for m in PLACEHOLDER.finditer(text):
        idm = cp.ID_ATTR.search(m.group("attrs"))
        if idm and idm.group("id").startswith("fig-") and not cp.in_spans(m.start(), spans):
            extra = cp.ID_ATTR.sub("", m.group("attrs")).strip()
            out.append((m.start(), m.end(), idm.group("id")[4:], extra))
    return out


def draw(chrome: str, harness: str) -> str:
    """Load the harness in headless Chrome and return the DOM after the draw."""
    tmp = Path(tempfile.mkdtemp(prefix="tdd-build-"))
    try:
        page = tmp / "harness.html"
        page.write_text(harness, encoding="utf-8", newline="\n")
        cmd = [chrome, *DRAW_FLAGS, f"--user-data-dir={tmp / 'profile'}", "--no-first-run",
               "--no-default-browser-check", "--dump-dom", page.as_uri()]
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=180)
        except subprocess.TimeoutExpired:
            raise BuildError("Chrome did not finish the draw within 180 s. A figure script may loop "
                             "forever: run build.py --keep-harness and open _harness.html in Chrome")
    finally:
        for _ in range(10):                      # Chrome can hold the profile for a moment
            shutil.rmtree(tmp, ignore_errors=True)
            if not tmp.exists():
                break
            time.sleep(0.3)
    dom = r.stdout.decode("utf-8", errors="replace")
    if 'id="tdd-log"' not in dom:
        tail = r.stderr.decode("utf-8", errors="replace").strip().splitlines()[-8:]
        raise BuildError(f"Chrome returned no page (exit code {r.returncode}). Its last messages:\n"
                         + "\n".join("        " + t for t in tail))
    return dom


def main(argv: list[str]) -> int:
    if any(a in ("-h", "--help") for a in argv):
        print(__doc__)
        return 0
    if argv[:1] == ["--new-figure"]:
        if len(argv) != 3:
            print("usage: python build.py --new-figure NAME TEMPLATE")
            return 2
        return new_figure(argv[1], argv[2])
    flags = [a for a in argv if a.startswith("--")]
    args = [a for a in argv if not a.startswith("--")]
    if any(f not in ("--keep-harness", "--no-check") for f in flags) or len(args) > 1:
        print("usage: python build.py [path/to/doc.json] [--keep-harness] [--no-check]")
        return 2
    try:
        return build(Path(args[0] if args else "doc.json").resolve(), "--keep-harness" in flags,
                     "--no-check" in flags)
    except BuildError as e:
        print(f"FAIL  {e}")
        print("build stopped: no page written")
        return 1


def new_figure(name: str, template: str) -> int:
    """Write figures/<name>.json: the template's own example DATA, ready to edit."""
    tpl = KIT / "figures" / f"{template}.js"
    if not tpl.is_file() or not NAME_OK.match(name):
        names = ", ".join(sorted(p.stem for p in (KIT / "figures").glob("*.js")))
        print(f"FAIL  give a name of letters, digits, - and _, and one template of: {names}")
        return 1
    m = DATA_BLOCK.search(read(tpl, "the kit template"))
    node = shutil.which("node")
    if not m or not node:
        print("FAIL  needs Node on PATH to read the example DATA of the template")
        return 1
    js = m.group(0).replace("const DATA = ", "const D = ", 1) + "\nprocess.stdout.write(JSON.stringify(D, null, 1));"
    r = subprocess.run([node, "-e", js], capture_output=True, timeout=60)
    if r.returncode:
        print("FAIL  " + r.stderr.decode("utf-8", "replace")[-400:])
        return 1
    out = Path("figures") / f"{name}.json"
    if out.exists():
        print(f"FAIL  {show(out)} exists; remove it first")
        return 1
    out.parent.mkdir(exist_ok=True)
    data = json.loads(r.stdout.decode("utf-8"))
    out.write_text(json.dumps({"template": template, "data": data}, ensure_ascii=False, indent=1) + "\n",
                   encoding="utf-8")
    print(f"wrote {show(out)}: the example DATA of {template}. Replace it; read the header of "
          f"{show(tpl)} (above the DATA block) for every field")
    return 0


def build(doc_path: Path, keep_harness: bool, no_check: bool = False) -> int:
    # ── 1 · doc.json ─────────────────────────────────────────────────────────────────────────────
    if not doc_path.is_file():
        raise BuildError(f"{show(doc_path)} does not exist. Run build.py next to doc.json, or pass "
                         f"the path of doc.json")
    try:
        doc = json.loads(read(doc_path, "doc.json"))
    except json.JSONDecodeError as e:
        raise BuildError(f"{show(doc_path)} is not valid JSON: line {e.lineno}, column {e.colno}: {e.msg}")
    base = doc_path.parent
    doc.setdefault("figures", "figures")
    for k, name in DEFAULTS.items():                 # the kit's own files, so a project copies nothing
        doc.setdefault(k, str(KIT / name))
    bad = [f'"{k}" must be a path (a string)' for k in ("figures", "prelude", "runtime", "style")
           if not isinstance(doc.get(k), str) or not doc[k]]
    if "icons" in doc and (not isinstance(doc["icons"], str) or not doc["icons"]):
        bad.append('"icons", when present, must be a path (a string): the icons.js of tools/make_icons.py')
    pages = doc.get("pages")
    if not isinstance(pages, list) or not pages:
        bad.append('"pages" must be a list of {"shell": "...", "out": "..."}')
    else:
        bad += [f'pages[{i}] must be {{"shell": "...", "out": "..."}}' for i, pg in enumerate(pages)
                if not (isinstance(pg, dict) and isinstance(pg.get("shell"), str)
                        and isinstance(pg.get("out"), str))]
    if bad:
        raise BuildError(f"{show(doc_path)}: " + "; ".join(bad))

    figdir = (base / doc["figures"]).resolve()
    prelude_path, runtime_path, style_path = ((base / doc[k]).resolve()
                                              for k in ("prelude", "runtime", "style"))
    icons_path = (base / doc["icons"]).resolve() if doc.get("icons") else None
    shells = [(base / pg["shell"]).resolve() for pg in pages]
    outs = [(base / pg["out"]).resolve() for pg in pages]
    fails: list[str] = []
    warns: list[str] = []
    for out, n in Counter(outs).items():
        if n > 1:
            fails.append(f"{show(doc_path)}: {n} pages write to the same file {show(out)}")
    sources = set(shells) | {prelude_path, runtime_path, style_path} | ({icons_path} if icons_path else set())
    fails += [f"{show(doc_path)}: the out path {show(o)} is a source file; the build would overwrite it"
              for o in outs if o in sources]

    def figure_file(name: str) -> Path | None:
        for ext in (".js", ".json"):
            if (figdir / f"{name}{ext}").is_file():
                return figdir / f"{name}{ext}"
        return None

    # ── 2 · the shells and their placeholders ───────────────────────────────────────────────────
    shell_text: list[str] = []
    holes: list[list[tuple[int, int, str, str]]] = []
    for shell in shells:
        text = read(shell, "the shell")
        for inc in reversed(list(INCLUDE.finditer(text))):   # inline generated SVG before any check
            target = (shell.parent / inc.group("path")).resolve()
            if not target.is_file():
                fails.append(f"{show(shell)} line {line_of(text, inc.start())}: INCLUDE names "
                             f"{show(target)}, which does not exist")
                continue
            body = re.sub(r"^\s*<\?xml[^>]*>\s*", "", read(target, "the include"))
            text = text[:inc.start()] + body.strip() + text[inc.end():]
        shell_text.append(text)
        for mark, where in ((STYLE_MARK, "inside <head>"), (SCRIPT_MARK, "just before </body>")):
            n = text.count(mark)
            if n != 1:
                fails.append(f"{show(shell)}: {mark} appears {n} times; put it once, {where}")
        low = text.lower()
        if 0 <= low.find("</head>") < text.find(STYLE_MARK):
            warns.append(f"{show(shell)}: {STYLE_MARK} sits after </head>; put it inside <head>")
        if text.find(SCRIPT_MARK) >= 0 and text.find(SCRIPT_MARK) < low.find("<body"):
            warns.append(f"{show(shell)}: {SCRIPT_MARK} sits before <body>; the runtime then finds "
                         f"no figure. Put it just before </body>")
        left = [t for t in STARTER_LEFTOVERS if t in text]
        if left:
            warns.append(f"{show(shell)}: still holds starter placeholders ({', '.join(left[:4])}); "
                         f"replace every UPPERCASE placeholder")
        if not DOCTYPE.match(text):
            warns.append(f"{show(shell)}: no <!doctype html> at the top; the page renders in quirks mode")
        found = placeholders(text)
        names = [h[2] for h in found]
        for s, _, name, extra in found:
            if not NAME_OK.match(name):
                fails.append(f"{show(shell)} line {line_of(text, s)}: fig-{name}: a figure name uses "
                             f"only letters, digits, - and _")
            if extra:
                warns.append(f"{show(shell)} line {line_of(text, s)}: the placeholder fig-{name} "
                             f"carries [{extra}]; the drawn figure replaces the whole element, so "
                             f"those attributes are dropped")
        for name, n in Counter(names).items():
            if n > 1:
                fails.append(f"{show(shell)}: fig-{name} appears {n} times; a page holds each figure once")
        starts = {h[0] for h in found}
        for name, a, _ in cp.figure_spans(text):
            if a not in starts and 'data-generated=' not in text[a:a + 400]:
                warns.append(f"{show(shell)} line {line_of(text, a)}: fig-{name} holds markup, so it "
                             f"is not a placeholder and the build leaves it as it is. Make it "
                             f'<svg id="fig-{name}"></svg>')
        holes.append(found)

    order = list(dict.fromkeys(h[2] for found in holes for h in found))
    for shell, found in zip(shells, holes):
        for s, _, name, _ in found:
            if NAME_OK.match(name) and not figure_file(name):
                fails.append(f'{show(shell)} line {line_of(shell_text[shells.index(shell)], s)}: '
                             f'<svg id="fig-{name}"> names a figure with no script. Write '
                             f'{show(figdir / f"{name}.json")} ({{"template": "...", "data": {{...}}}}) '
                             f'or {show(figdir / f"{name}.js")}, or remove the placeholder')

    # ── 3 · the scripts and the style ───────────────────────────────────────────────────────────
    prelude = read(prelude_path, "the prelude")
    runtime = read(runtime_path, "the runtime")
    style = read(style_path, "the style sheet")
    if icons_path and not icons_path.is_file():
        raise BuildError(f'the icons file {show(icons_path)} does not exist (doc.json "icons"). Make it '
                         f"with python tools/make_icons.py --packs <dir> --map <icons.json> --out "
                         f"{show(icons_path)}, or remove the key")
    icons = read(icons_path, "the icons file") if icons_path else None
    if icons is not None and not re.search(r"\bconst\s+svcIcon\b", icons):
        fails.append(f"{show(icons_path)} defines no svcIcon(); write it with tools/make_icons.py")
    figjs: dict[str, str] = {}
    figsrc: dict[str, Path] = {}
    via_tpl: dict[Path, Path] = {}                 # figures/NAME.json -> the kit template it runs
    for n in order:
        f = figure_file(n) if NAME_OK.match(n) else None
        if not f:
            continue
        figsrc[n] = f
        if f.suffix == ".js":
            figjs[n] = read(f, "the figure script")
            continue
        try:                                         # NAME.json: a kit template with this data
            spec = json.loads(read(f, "the figure data"))
            tpl = KIT / "figures" / f"{spec['template']}.js"
            data = spec["data"]
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            fails.append(f'{show(f)}: needs {{"template": "<kit figure>", "data": {{...}}}} ({e})')
            continue
        if not tpl.is_file():
            names = ", ".join(sorted(p.stem for p in (KIT / "figures").glob("*.js")))
            fails.append(f"{show(f)}: no kit template '{spec['template']}'. Use one of: {names}")
            continue
        via_tpl[f] = tpl
        js = read(tpl, "the kit template")
        js = DATA_BLOCK.sub(lambda _: "const DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";", js, 1)
        js = js.replace("figures/${NAME}.js", "figures/${NAME}.json")   # errors name the file you edit
        figjs[n] = NAME_LINE.sub(lambda _: f"const NAME = '{n}';", js, 1)
    inlined = [(prelude_path, prelude), (runtime_path, runtime)]
    inlined += [(icons_path, icons)] if icons is not None else []
    inlined += [(figsrc[n], js) for n, js in figjs.items()]
    for path, js in inlined:
        m = re.search(r"</script", js, re.I)
        if m:
            fails.append(f"{show(path)} line {line_of(js, m.start())}: holds '</script', which ends "
                         f"an inline script early. Write '<\\/script' instead")
    m = re.search(r"</style", style, re.I)
    if m:
        fails.append(f"{show(style_path)} line {line_of(style, m.start())}: holds '</style', which "
                     f"ends the inline style early")
    for n, js in figjs.items():                       # a figure uses the prelude API and nothing else
        code = strip_js_comments(js)
        api = PRELUDE_API + (f", plus {ICONS_API} from {show(icons_path)}" if icons is not None else "")
        for hit in OFF_API.finditer(code):
            warns.append(f"{show(figsrc[n])} line {line_of(code, hit.start())}: uses "
                         f"{hit.group(0).rstrip('(. ')}; a figure script uses only the prelude API "
                         f"({api}). Measure text with measure(), and use rnd() for jitter")
        hit = USES_ICONS.search(code)
        if hit and icons is None:
            fails.append(f"{show(figsrc[n])} line {line_of(code, hit.start())}: draws vendor marks "
                         f"({ICONS_API}), and {show(doc_path)} names no icons file. Make one with "
                         f'python tools/make_icons.py, then add "icons": "icons.js" to doc.json')
    if fails:
        return report(fails, warns)

    # ── 4 · draw every figure once ──────────────────────────────────────────────────────────────
    label = {n: figsrc[n] for n in order}

    def rel(p: Path) -> str:                         # the sourceURL of one inlined script
        try:
            r = Path(os.path.relpath(p, base)).as_posix()
        except ValueError:                           # another drive on Windows
            r = p.as_posix()
        return r.replace(" ", "%20")

    harness = ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
               "<title>tech-design-doc figure harness</title>\n"
               f"<style>\n{style}\n</style>\n</head>\n<body>\n<pre id=\"tdd-log\"></pre>\n")
    harness += "".join(f'<figure class="slot"><div class="fig"><svg id="fig-{n}"></svg></div>'
                       f"</figure>\n" for n in order)
    harness += f"<script>\n{LOGGER}\n</script>\n"
    scripts: list[tuple[str, Path, int, int]] = []     # (sourceURL, file, first line, last line)

    def add_script(path: Path, js: str) -> None:
        nonlocal harness
        first = harness.count("\n") + 1
        harness += f"<script>{js}\n//# sourceURL={rel(path)}\n</script>\n"
        scripts.append((rel(path), path, first, first + js.count("\n")))

    add_script(prelude_path, prelude)
    if icons is not None:                            # the vendor marks: after the prelude, before the figures
        harness += "<script>__tdd.cur='(icons)'</script>\n"
        add_script(icons_path, icons)
    for n in order:
        harness += f"<script>__tdd.cur='{n}'</script>\n"
        add_script(label[n], figjs[n])
    harness += "<script>__tdd.cur='(end)';__tdd.flush()</script>\n</body>\n</html>\n"
    if keep_harness:
        kept = base / "_harness.html"
        kept.write_text(harness, encoding="utf-8", newline="\n")
        print(f"kept the harness: {show(kept)}")

    if order:
        chrome = find_chrome()
        dom = draw(chrome, harness)
    else:                                            # no shell names a figure: nothing to draw
        chrome, dom = "", '<pre id="tdd-log"></pre>'
    m = re.search(r'<pre id="tdd-log">(.*?)</pre>', dom, re.S)
    try:
        log = json.loads(html.unescape(m.group(1))) if m and m.group(1).strip() else {}
    except json.JSONDecodeError:
        log = {}
    errors, drawn_log = log.get("errors", []), log.get("drawn", [])
    found_svg = {n: dom[a:b] for n, a, b in reversed(cp.figure_spans(dom))}

    def where(e: dict) -> str:
        stack = e.get("stack", "")
        for url, path, _, _ in sorted(scripts, key=lambda s: s[1] in (prelude_path, icons_path)):
            hit = re.search(re.escape(url) + r":(\d+):(\d+)", stack)
            if hit:                                   # a frame in a figure: the line its author wrote
                return loc(path, hit.group(1), hit.group(2))
        line, col = e.get("line") or 0, e.get("col") or 0
        for url, path, first, last in scripts:
            if first <= line <= last + 1:
                col = max(1, col - len("<script>")) if line == first else col
                return loc(path, line - first + 1, col)
        return "the harness page"

    def loc(path: Path, line, col) -> str:
        if path in via_tpl:                       # a JSON figure: name the file the author edits
            return f"{show(path)} (a value in its \"data\"; the check is at {show(via_tpl[path])}:{line})"
        return f"{show(path)}:{line}:{col}"

    def message(e: dict) -> str:
        return re.sub(r"^Uncaught\s+", "", e.get("msg", "error"))

    for e in errors:
        if e.get("fig") not in label:
            fails.append(f"{where(e)}: {message(e)}")
    drawn: dict[str, str] = {}
    for n in order:
        markup = found_svg.get(n, "")
        count = cp.count_drawn(markup)
        own = [e for e in errors if e.get("fig") == n]
        by = [d.get("by") for d in drawn_log if d.get("svg") == f"fig-{n}"]
        for e in own:
            fails.append(f"{where(e)}: {message(e)}")
        if count < MIN:
            hint = ""
            if not own and not by:
                hint = (f" figure() never filled it: check that {show(label[n])} calls "
                        f"figure('{n}', {{h, label}}, draw)")
            elif not own and n not in by:
                hint = (f" {', '.join(show(label[b]) for b in by if b in label)} drew into fig-{n} "
                        f"instead of {show(label[n])}")
            fails.append(f"fig-{n} ({show(label[n])}) drew {count} elements; a figure draws at "
                         f"least {MIN}.{hint}")
            continue
        others = [b for b in by if b != n]
        if others:
            warns.append(f"fig-{n} was drawn by {', '.join(show(label[b]) for b in others if b in label)}"
                         f"; each figure file draws only its own figure")
        if len(by) > 1:
            warns.append(f"fig-{n} was drawn {len(by)} times; the last figure() call wins")
        head = cp.SVG_OPEN.match(markup)
        attrs = head.group("attrs") if head else ""
        lacks = [a for a in ("viewBox", "role", "aria-label") if f"{a}=" not in attrs]
        if lacks:
            warns.append(f"fig-{n} has no {', '.join(lacks)}: draw it through figure('{n}', "
                         f"{{h, label}}, draw)")
        odd = [hit.group(0)[:90] for hit in BAD_VALUE.finditer(markup)][:3]
        if odd:
            warns.append(f"fig-{n} holds NaN, undefined or Infinity, so a mark is lost or a label "
                         f"is wrong: " + " | ".join(odd))
        drawn[n] = markup
    if fails:
        return report(fails, warns)

    # ── 5 · bake, check, write ──────────────────────────────────────────────────────────────────
    built: list[tuple[Path, str, list[str]]] = []
    for shell, out, text, found in zip(shells, outs, shell_text, holes):
        edits = [(s, e, drawn[n]) for s, e, n, _ in found]
        i = text.index(STYLE_MARK)
        edits.append((i, i + len(STYLE_MARK), f"<style>\n{style.strip()}\n</style>"))
        i = text.index(SCRIPT_MARK)
        edits.append((i, i + len(SCRIPT_MARK), f"<script>\n{runtime.strip()}\n</script>"))
        page = text
        for s, e, new in sorted(edits, key=lambda x: x[0], reverse=True):
            page = page[:s] + new + page[e:]
        # the shell as doc.json names it, so the page bytes never depend on the folder you build from
        try:
            named = Path(os.path.relpath(shell, base)).as_posix()
        except ValueError:                           # another drive on Windows: the file name only
            named = shell.name
        note = (f"<!-- Built by build.py (tech-design-doc) from {named.replace('--', '- -')}, as "
                f"doc.json names it. Do not edit this file: edit the shell or a figure script, then "
                f"build again. -->")
        dt = DOCTYPE.match(page)
        page = page[:dt.end()] + "\n" + note + page[dt.end():] if dt else note + "\n" + page
        names = [h[2] for h in found]

        s, shell_scan = cp.scan(page), cp.scan(text)
        if cp.load_problems(s):
            src = [f"{show(shell)} {x}" for x in cp.load_problems(shell_scan)]
            src += [f"{show(style_path)} {x}" for x in cp.css_problems(style)]
            src += [f"{show(runtime_path)} {x}" for x in cp.js_problems(runtime)]
            for n in names:
                src += [f"fig-{n} {x}" for x in cp.load_problems(cp.scan(drawn[n]))]
            for x in src or [f"{show(out)} {x}" for x in cp.load_problems(s)]:
                fails.append(f"{x}: a built page loads nothing by itself. Inline it as a data: URI, "
                             f"or remove it")
        if len(s.scripts) != 1:
            fails.append(f"{show(out)}: {len(s.scripts)} <script> elements; a built page carries "
                         f"one, the runtime. Remove every other <script> from {show(shell)}")
        for value, n in Counter(i for i, _ in s.ids).items():
            if n < 2:
                continue
            in_shell = sum(1 for i, _ in shell_scan.ids if i == value)
            whose = [f"{show(shell)} x{in_shell}"] if in_shell else []
            whose += [f"fig-{f} x{k}" for f in names
                      if (k := sum(1 for i, _ in cp.scan(drawn[f]).ids if i == value))]
            hint = ("two INCLUDEd cloud diagrams share one output name: run cloud_diagram.py with a "
                    "different --out for one of them" if value.startswith(("fig-", "cd-")) and not whose[1:]
                    else "namespace an id inside a figure as fig-<name>-<part>")
            fails.append(f'{show(out)}: id="{value}" appears {n} times ({", ".join(whose)}). An id is '
                         f"unique in a page: {hint}")
        warns += [f"{show(out)} {x}" for x in cp.dangling_links(s)]
        twin_fails, twin_warns, _ = cp.twin_problems(page)    # tools/check_pages.py fails on these
        warns += [f"{show(out)} {x}" for x in twin_fails + twin_warns]
        built.append((out, page, names))
    if fails:
        return report(fails, warns)

    report([], warns)
    if order:
        print(f"drew {len(order)} figure{'s' if len(order) != 1 else ''} once with {chrome}: "
              + ", ".join(f"{n} ({cp.count_drawn(drawn[n])} elements)" for n in order))
    else:
        print("drew no figure: no shell names one, so Chrome did not run")
    if icons is not None:
        print(f"icons: {show(icons_path)} loaded after the prelude")
    for out, page, names in built:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page, encoding="utf-8", newline="\n")
        print(f"built {show(out)}: {len(page.encode('utf-8')):,} bytes, {len(names)} "
              f"figure{'s' if len(names) != 1 else ''} baked in ({', '.join(names) or 'none'})")
    if no_check:
        print("diagram check skipped (--no-check): run scripts/check_diagrams.py before delivery")
        return 0
    # every built page goes through the spacing and overlap check, as the reader will see it
    checker = KIT.parent / "scripts" / "check_diagrams.py"
    bad = 0
    for out, _, _ in built:
        r = subprocess.run([sys.executable, str(checker), str(out)], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=300)
        print(r.stdout.rstrip())
        bad += r.returncode != 0
    if bad:
        print("diagram check: FAIL. The page is written but NOT deliverable: fix each FAIL in its "
              "figures/NAME.json or spec (see reference/fixing-diagrams.md), then build again")
        return 1
    return 0


def report(fails: list[str], warns: list[str]) -> int:
    for w in warns:
        print(f"warn  {w}")
    for f in fails:
        print(f"FAIL  {f}")
    if fails:
        print(f"build stopped: {len(fails)} failure{'s' if len(fails) != 1 else ''}, no page written")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
