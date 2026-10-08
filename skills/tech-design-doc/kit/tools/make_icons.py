"""Inline official vendor icons into icons.js, so a figure script can draw a vendor mark.

Usage:  python tools/make_icons.py --packs <dir> --map <icons.json> --out <icons.js>

  --packs  the folder that holds the vendor packs: each pack is a zip as you downloaded it, or a
           folder you unzipped. The skill keeps its copies in vendor-icons/ (see its README.md).
  --map    a JSON object, one entry per mark the figures use:
             "lambda": {"pack": "aws-icons.zip",
                        "match": "Arch_AWS-Lambda_64.svg",
                        "label": "AWS Lambda",
                        "credit": "AWS Architecture Icons, release 07312026"}
           key     the name a figure passes to svcIcon(); letters, digits, - and _
           pack    a zip file or a folder inside --packs
           match   a file name, or a glob over the path inside the pack ("*/64/Arch_AWS-Lambda_64.svg").
                   Case does not count. It must match exactly one .svg file.
           label   the product name as the vendor writes it. A figure prints it near the mark.
           credit  optional: the credit line for the pack. Without it, the tool uses the top folder
                   inside the pack (or the pack name) and warns.
  --out    the icons.js to write: the ICONS object and svcIcon(parent, key, x, y, size).

Why a build step. build.py fails a page that fetches anything, so a mark cannot be an <img>, a
<use href> to a file, or a CDN sprite. Each mark sits in the page as literal SVG, and this tool
puts that SVG into icons.js once.

What the tool changes, and what it never changes (the vendor terms: vendor-icons/README.md):
  changes  the XML prolog, comments, <metadata>, and the vendor <title> and <desc> are removed
           (they are layer names from the export tool, and inside a figure they become the hover
           tooltip). Every id gets the prefix "<key>-", and every reference to it follows, so two
           marks never share an id; svcIcon() adds a second prefix for each copy it draws. Every
           class gets the same prefix, so no page rule can reach into a mark. Runs of white space
           become one space.
  never    a path, a fill, a stroke, a stop, a transform or the viewBox. The root <svg> keeps its
           presentation attributes (fill="none" on a Microsoft mark matters), and svcIcon() draws
           the mark as a nested <svg> with the vendor viewBox, so nothing is recoloured, cropped,
           distorted or redrawn.
The tool refuses a mark that holds a <style> block (its rules would reach the whole page), a
<script>, an on...= handler, a <foreignObject>, or anything that loads a file.
It proves the "never" list on every run: it compares every element and every drawing attribute of
its output with the vendor file (ids, classes and references aside), and it stops when one differs.

The output holds no absolute path and no date, so the same packs and map give the same bytes on any
machine. Run it from the kit folder:
  python tools/make_icons.py --packs ../vendor-icons --map icons.relay.json --out icons.js
Then add "icons": "icons.js" to doc.json, and build.
"""
from __future__ import annotations

import argparse
import difflib
import fnmatch
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.dont_write_bytecode = True                   # no __pycache__ folder inside the kit

KEY_OK = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
FIELDS = {"pack", "match", "label", "credit"}

PROLOG = re.compile(r"<\?xml\b.*?\?>", re.S | re.I)
DOCTYPE = re.compile(r"<!DOCTYPE\b[^>]*>", re.I)
COMMENT = re.compile(r"<!--.*?-->", re.S)
# the export tool's layer names and editor data, not artwork
META = re.compile(r"<(title|desc|metadata)\b[^>]*?(?:/>|>.*?</\1\s*>)", re.S | re.I)
EDITOR = re.compile(r"<(sodipodi:namedview)\b[^>]*?(?:/>|>.*?</\1\s*>)", re.S | re.I)
OPEN_SVG = re.compile(r"<svg\b(?P<attrs>(?:[^>\"']|\"[^\"]*\"|'[^']*')*)>", re.I)
CLOSE_SVG = re.compile(r"</svg\s*>\s*$", re.I)
ATTR = re.compile(r"([A-Za-z_:][\w:.-]*)\s*=\s*(\"[^\"]*\"|'[^']*')")
# root attributes that place or name the file, not the artwork: svcIcon() sets its own
ROOT_DROP = {"width", "height", "x", "y", "version", "id", "role", "focusable", "xml:space",
             "baseprofile", "viewbox", "enable-background"}


class IconError(Exception):
    pass


def show(p: Path) -> str:
    """A path to print, always with forward slashes."""
    return p.as_posix()


# ── the packs ────────────────────────────────────────────────────────────────────────────────────

def junk(name: str) -> bool:
    """macOS archive leftovers, not vendor files."""
    parts = PurePosixPath(name).parts
    return (not parts or parts[0] == "__MACOSX" or parts[-1].startswith("._")
            or parts[-1] in (".DS_Store", "Thumbs.db"))


class Pack:
    """One vendor pack: a zip as downloaded, or a folder."""

    def __init__(self, packs: Path, name: str) -> None:
        self.name = name
        self.path = packs / name
        if self.path.is_file() and zipfile.is_zipfile(self.path):
            self.zip = zipfile.ZipFile(self.path)
            self.files = sorted(n for n in self.zip.namelist() if not n.endswith("/") and not junk(n))
        elif self.path.is_dir():
            self.zip = None
            self.files = sorted(p.relative_to(self.path).as_posix() for p in self.path.rglob("*")
                                if p.is_file() and not junk(p.relative_to(self.path).as_posix()))
        else:
            have = sorted(p.name for p in packs.iterdir() if p.suffix.lower() == ".zip" or p.is_dir())
            raise IconError(f'no pack "{name}" in {show(packs)}. It holds: {", ".join(have) or "nothing"}. '
                            f"Download the pack from the vendor page (vendor-icons/README.md lists them), "
                            f"put it in {show(packs)}, or fix \"pack\" in the map")

    def read(self, inner: str) -> str:
        data = self.zip.read(inner) if self.zip else (self.path / inner).read_bytes()
        return data.decode("utf-8-sig")

    def find(self, key: str, match: str) -> str:
        """The one .svg file that match names; a clear error for none or several."""
        pat = match.strip().replace("\\", "/").lower()
        if "/" in pat:
            hits = [f for f in self.files if fnmatch.fnmatchcase(f.lower(), pat)
                    or fnmatch.fnmatchcase(f.lower(), "*/" + pat.lstrip("/"))]
        else:
            hits = [f for f in self.files if fnmatch.fnmatchcase(PurePosixPath(f).name.lower(), pat)]
        svg = [f for f in hits if f.lower().endswith(".svg")]
        if len(svg) == 1:
            return svg[0]
        if not svg and hits:
            raise IconError(f'"{key}": "{match}" matches only {", ".join(PurePosixPath(h).name for h in hits[:4])} '
                            f"in {self.name}. make_icons inlines SVG only: match the .svg file")
        if len(svg) > 1:
            listed = "\n".join(f"        {f}" for f in svg[:8])
            more = f"\n        ... and {len(svg) - 8} more" if len(svg) > 8 else ""
            pick = PurePosixPath(next((f for f in svg if "/64/" in f), svg[-1]))
            example = f"*/{pick.parent.name}/{pick.name}" if pick.parent.name else pick.name
            raise IconError(f'"{key}": "{match}" matches {len(svg)} SVG files in {self.name}. Name one, '
                            f'for example with its folder: "{example}".\n{listed}{more}')
        names = sorted({PurePosixPath(f).name for f in self.files if f.lower().endswith(".svg")})
        stem = PurePosixPath(pat).name.replace("*", "").replace("?", "")
        close = difflib.get_close_matches(stem, [n.lower() for n in names], n=5, cutoff=0.45)
        hint = ("\n      close names: " + ", ".join(n for n in names if n.lower() in close)) if close else ""
        raise IconError(f'"{key}": "{match}" matches no file in {self.name} ({len(names)} SVG files).{hint}')

    def credit_default(self, inner: str) -> str:
        top = PurePosixPath(inner).parts
        return top[0] if len(top) > 1 else Path(self.name).stem


# ── one mark ─────────────────────────────────────────────────────────────────────────────────────

TAG = re.compile(r"<([A-Za-z][\w:.-]*)((?:[^>\"']|\"[^\"]*\"|'[^']*')*?)/?>")
NOT_DRAWING = {"id", "class", "href", "xlink:href"}     # renamed on purpose; the rest must not change


def drawing(markup: str) -> Counter:
    """Every element and every drawing attribute of a mark: a path, a fill, a stop, a transform. Ids,
    classes and references are left out, because make_icons renames them on purpose; white space
    inside a value counts as one space. Two marks with the same drawing look the same."""
    out: Counter = Counter()
    for m in TAG.finditer(markup):
        tag = m.group(1).lower()
        out[(tag, "", "")] += 1
        for name, raw in ATTR.findall(m.group(2)):
            if name.lower() in NOT_DRAWING:
                continue
            value = re.sub(r"""url\(\s*["']?\s*#[^)"']*["']?\s*\)""", "url(#)", " ".join(raw[1:-1].split()))
            out[(tag, name.lower(), value)] += 1
    return out


def norm_quotes(body: str) -> str:
    """id='x' -> id="x", and url('#x') / url("#x") -> url(#x), so one prefix rule finds them all.
    Only the quoting changes, never the value."""
    body = re.sub(r"(\s(?:id|href|xlink:href|class))\s*=\s*'([^']*)'", r'\1="\2"', body)
    return re.sub(r"""url\(\s*["']\s*(#[^"')]+?)\s*["']\s*\)""", r"url(\1)", body)


def convert(key: str, src: str, where: str) -> tuple[str, dict[str, str], str, int, int]:
    """(viewBox, root presentation attributes, inner markup, ids prefixed, elements) for one vendor SVG."""
    def stop(msg: str) -> IconError:
        return IconError(f'"{key}" ({where}): {msg}')

    body = EDITOR.sub("", META.sub("", COMMENT.sub("", DOCTYPE.sub("", PROLOG.sub("", src)))))
    opening = OPEN_SVG.search(body)
    if not opening:
        raise stop("no <svg> element")
    inner = body[opening.end():]
    end = CLOSE_SVG.search(inner)
    if not end:
        raise stop("the root <svg> is not closed at the end of the file")
    inner = inner[:end.start()].strip()
    original = inner                                   # the artwork as the vendor drew it

    root: dict[str, str] = {}
    view_box = ""
    width = height = ""
    for name, raw in ATTR.findall(opening.group("attrs")):
        value, low = raw[1:-1], name.lower()
        if low == "viewbox":
            view_box = " ".join(value.replace(",", " ").split())
        elif low == "width":
            width = value
        elif low == "height":
            height = value
        if low in ROOT_DROP or low.startswith(("xmlns", "aria-", "data-")):
            continue
        root[name] = value
    if not view_box:
        w, h = (re.fullmatch(r"\s*([\d.]+)\s*(?:px)?\s*", v or "") for v in (width, height))
        if not (w and h):
            raise stop("no viewBox, and no width and height in px to make one from")
        view_box = f"0 0 {w.group(1)} {h.group(1)}"
    vb = view_box.split()
    if len(vb) != 4 or not all(re.fullmatch(r"-?[\d.]+(?:e-?\d+)?", v) for v in vb) or float(vb[2]) <= 0 \
            or float(vb[3]) <= 0:
        raise stop(f'the viewBox "{view_box}" is not four numbers with a width and a height above 0')

    low = inner.lower()
    for bad, why in (("<style", "it holds a <style> block, whose rules would reach the whole page. "
                               "Use another export of the mark"),
                     ("<script", "it holds a <script>"),
                     ("<foreignobject", "it holds a <foreignObject>, which can carry HTML")):
        if bad in low:
            raise stop(why)
    if re.search(r"\son[a-z]+\s*=", inner, re.I) or re.search(r"\son[a-z]+\s*=", opening.group("attrs"), re.I):
        raise stop("it holds an on...= event handler")

    inner = norm_quotes(inner)
    for m in re.finditer(r"""(?:\s(?:xlink:)?href)\s*=\s*"([^"]*)"|url\(\s*([^)]*?)\s*\)""", inner, re.I):
        ref = (m.group(1) if m.group(1) is not None else m.group(2)).strip()
        if ref and not ref.startswith("#") and not ref.lower().startswith("data:"):
            raise stop(f'it loads "{ref[:60]}"; a page loads nothing by itself')
    if re.search(r"@import\b", inner, re.I):
        raise stop("it holds @import")

    # one namespace per mark: every id, and every reference to it
    ids = sorted(set(re.findall(r'\sid="([^"]+)"', inner)), key=len, reverse=True)
    pre = f"{key}-"
    for raw in ids:
        new, q = pre + raw, re.escape(raw)
        inner = re.sub(r'(\s)id="' + q + '"', lambda m: f'{m.group(1)}id="{new}"', inner)
        inner = re.sub(r"url\(#" + q + r"\)", lambda m: f"url(#{new})", inner)
        inner = re.sub(r'(\s(?:xlink:)?href)="#' + q + '"', lambda m: f'{m.group(1)}="#{new}"', inner)
    left = [r for r in re.findall(r"url\(#([^)]+)\)", inner) if not r.startswith(pre)]
    left += [r for r in re.findall(r'\s(?:xlink:)?href="#([^"]+)"', inner) if not r.startswith(pre)]
    if left:
        raise stop(f"it refers to an id it does not define: {', '.join(sorted(set(left))[:4])}")
    inner = re.sub(r'(\sclass)="([^"]*)"', lambda m: m.group(1) + '="' + " ".join(pre + c for c in m.group(2).split()) + '"',
                   inner)
    if "class" in root:
        root["class"] = " ".join(pre + c for c in root["class"].split())

    inner = re.sub(r">\s+<", "><", inner)
    inner = re.sub(r"\s+", " ", inner).strip()
    if not re.search(r"<(path|rect|circle|ellipse|polygon|polyline|line|g|use|image|text)\b", inner, re.I):
        raise stop("it draws nothing: no path, shape or group inside the root <svg>")
    # the proof of the licence rule: the output draws exactly what the vendor file draws
    before, after = drawing(original), drawing(inner)
    if before != after:
        lost = [f"{t} {a}={v[:40]!r}" if a else f"<{t}>" for t, a, v in (before - after)][:3]
        new = [f"{t} {a}={v[:40]!r}" if a else f"<{t}>" for t, a, v in (after - before)][:3]
        raise stop(f"the inlined mark differs from the vendor file (lost: {lost or 'nothing'}; "
                   f"new: {new or 'nothing'}). make_icons must never change the artwork: fix the tool")
    return view_box, root, inner, len(ids), sum(n for (t, a, _), n in after.items() if not a)


# ── icons.js ─────────────────────────────────────────────────────────────────────────────────────

SVC_ICON = r"""/* svcIcon(parent, key, x, y, size) draws one mark, unmodified, as a nested <svg>: its top-left corner
   at (x, y), its longest side `size` user units, the vendor viewBox kept. It returns that <svg>.
   Each copy gets its own id prefix, "<figure id>-<n>-", so a mark drawn twice, or in two figures of
   one page, never repeats an id. The vendor rules: never recolour, crop, rotate or redraw a mark;
   print the product name (ICONS[key].label) near it; keep the credit line inside the figure. */
const svcIcon = (parent, key, x, y, size) => {
  const o = ICONS[key];
  if (!o) throw new Error(`svcIcon: icons.js has no mark "${key}". It has ${Object.keys(ICONS).join(', ')}. ` +
    'Add the mark to the map, and run tools/make_icons.py again');
  if (!(typeof size === 'number' && size > 0)) throw new Error(`svcIcon('${key}'): size must be a number above 0`);
  const [, , w, h] = o.vb.split(' ').map(Number), k = size / Math.max(w, h);
  const host = parent.closest ? parent.closest('svg[id]') : null;
  const scope = host ? host.id : 'icon';
  const n = (svcIcon.copies[scope] = (svcIcon.copies[scope] || 0) + 1);
  const s = el(parent, 'svg', { ...o.a, x, y, width: w * k, height: h * k, viewBox: o.vb });
  s.innerHTML = o.g.replace(/(\sid="|url\(#|href="#)/g, `$1${scope}-${n}-`);
  return s;
};
svcIcon.copies = {};
"""


def js(value) -> str:
    """A JavaScript literal: JSON, with every non-ASCII character escaped."""
    return json.dumps(value, ensure_ascii=True)


def safe_comment(text: str) -> str:
    """Text that cannot end the block comment it sits in."""
    return text.replace("*/", "* /")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Inline official vendor icons into icons.js.")
    ap.add_argument("--packs", required=True, metavar="DIR", help="the folder that holds the vendor packs")
    ap.add_argument("--map", required=True, metavar="FILE", help="the JSON map: key -> {pack, match, label, credit}")
    ap.add_argument("--out", required=True, metavar="FILE", help="the icons.js to write")
    a = ap.parse_args(argv)
    packs, map_path, out = Path(a.packs).resolve(), Path(a.map).resolve(), Path(a.out).resolve()
    try:
        return run(packs, map_path, out)
    except IconError as e:
        print(f"FAIL  {e}")
        print("make_icons stopped: no file written")
        return 1


def run(packs: Path, map_path: Path, out: Path) -> int:
    if not packs.is_dir():
        raise IconError(f"--packs {show(packs)} is not a folder. Point it at the folder that holds the "
                        f"vendor zips (the skill keeps them in vendor-icons/)")
    if not map_path.is_file():
        raise IconError(f"--map {show(map_path)} does not exist")
    try:
        spec = json.loads(map_path.read_bytes().decode("utf-8-sig"))
    except json.JSONDecodeError as e:
        raise IconError(f"{map_path.name} is not valid JSON: line {e.lineno}, column {e.colno}: {e.msg}")
    if not isinstance(spec, dict) or not spec:
        raise IconError(f'{map_path.name} must be a JSON object: {{"key": {{"pack": ..., "match": ..., "label": ...}}}}')

    bad = []
    for key, entry in spec.items():
        if not KEY_OK.match(key):
            bad.append(f'"{key}": a key uses letters, digits, - and _, and starts with a letter')
            continue
        if not isinstance(entry, dict):
            bad.append(f'"{key}": the entry must be an object {{"pack", "match", "label"}}')
            continue
        bad += [f'"{key}": "{f}" must be a non-empty string' for f in ("pack", "match", "label")
                if not isinstance(entry.get(f), str) or not entry[f].strip()]
        if "credit" in entry and (not isinstance(entry["credit"], str) or not entry["credit"].strip()):
            bad.append(f'"{key}": "credit", when present, must be a non-empty string')
        bad += [f'"{key}": unknown field "{f}"; the fields are pack, match, label, credit'
                for f in entry if f not in FIELDS]
    if bad:
        raise IconError(f"{map_path.name}:\n      " + "\n      ".join(bad))

    opened: dict[str, Pack] = {}
    rows, made, warns = [], [], []
    for key, entry in spec.items():
        pack = opened.get(entry["pack"]) or opened.setdefault(entry["pack"], Pack(packs, entry["pack"]))
        inner = pack.find(key, entry["match"])
        view_box, root, body, n_ids, n_el = convert(key, pack.read(inner), f"{pack.name}: {inner}")
        credit = entry.get("credit", "").strip()
        if not credit:
            credit = pack.credit_default(inner)
            warns.append(f'"{key}" has no "credit"; the figure prints "{credit}". Set "credit" in '
                         f"{map_path.name} to the vendor's own words")
        rows.append(f"  {js(key)}: {{label: {js(entry['label'].strip())}, credit: {js(credit)}, "
                    f"vb: {js(view_box)}, a: {js(root)},\n    g: {js(body)}}},")
        made.append((key, entry["label"].strip(), pack.name, inner, len(body), n_ids, credit, n_el))

    credits: dict[str, list[str]] = {}
    for key, label, _, _, _, _, credit, _ in made:
        credits.setdefault(credit, []).append(label)
    width = max(len(k) for k, *_ in made)
    lines = [safe_comment(f"     {k:<{width}}  {lab}  <-  {pk}: {inner}") for k, lab, pk, inner, *_ in made]
    header = "\n".join([
        f"/* tech-design-doc · icons.js · official vendor marks, inlined. GENERATED by tools/make_icons.py",
        f"   from {map_path.name}. Do not edit it: change the map, and run make_icons.py again.",
        "",
        "   Use: a figure script calls svcIcon(parent, key, x, y, size), and prints ICONS[key].label near",
        "   the mark and ICONS[key].credit in a credit line inside the figure. doc.json loads this file",
        '   after prelude.js and before the figure scripts, through its "icons" key. No built page carries',
        "   this file: the build bakes the drawn marks into the figure.",
        "",
        "   The rules (the vendor terms; read vendor-icons/README.md): every mark is the vendor's own file,",
        "   inlined unmodified. Its ids and classes carry a prefix, and its <title> and <desc> are gone; no",
        "   path, fill, stop or viewBox is changed. Never recolour, crop, rotate or redraw a mark. These",
        "   marks are the only colours outside the palette.",
        "",
        "   Marks:",
        *lines,
        "   Credit lines:",
        *[safe_comment(f"     {c}: {', '.join(sorted(n))}") for c, n in sorted(credits.items())],
        "*/",
    ])
    text = header + "\nconst ICONS = {\n" + "\n".join(rows) + "\n};\n\n" + SVC_ICON
    if "</script" in text.lower():
        raise IconError("the output holds '</script', which would end the build harness script early")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8", newline="\n")

    for w in warns:
        print(f"warn  {w}")
    print(f"wrote {out.name}: {len(made)} mark{'s' if len(made) != 1 else ''}, {out.stat().st_size:,} bytes, "
          f"from {map_path.name}")
    for key, label, pk, inner, size, n_ids, _, n_el in made:
        print(f"  {key:<{width}}  {label:<22} {size:>6,} bytes  {n_el:>3} elements unchanged  "
              f"{n_ids:>2} ids prefixed  <-  {pk}: {inner}")
    for credit, names in sorted(credits.items()):
        print(f"  credit  {credit}: {', '.join(sorted(names))}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
