"""Check built pages against the rules that every page of a design document keeps.

Usage:  python tools/check_pages.py <page.html> [more pages ...]

Per page:
  ids       every id is unique
  links     every href="#x" resolves to an id (or an <a name>) in the same page
  fetch     nothing loads by itself: no src= / poster= / background=, no srcset candidate (each
            one is read, not only the first), no <link href>, no <object data>, no SVG href to a
            file (<image>, <use>, <feImage>, <script>, a gradient ...), no @import, no url() or
            image-set() string other than data: or #fragment; and the script calls no fetch(),
            XMLHttpRequest, import() or WebSocket
  script    exactly one <script>, and `node --check` accepts it (skipped when node is absent)
  figures   every <svg id="fig-*"> holds at least 10 drawn elements (<title>, <desc> do not count)
  twins     a figure slot followed by a table twin (<details class="twin">) says what its table
            says: names, labels and values, not only counts. It reads the canonical first line
            of every <title> tooltip, "<a> · <b> · <c> — <prose>", in the grammar of the kit's
            figure templates:
              grid    "<row> · <column> · <n> places"      matrix: each count sits in its cell
              member  "<column> · <row> · full|limited|withheld", or "... · <value>" under a
                      table column of that name            stack, silhouettes
              flow    "<from> → <to> · cut|stays"          lineage: one table row per feed
              steps   "<n> · <from> → <to> ..."             system, sequence: a row per step
              link    "<item> · <value> → <group> (<role>)" mapping: a row per item
            A drawn line with no table row fails, and a table row the figure does not draw fails.
Across pages:
  shared    a fig-* that appears in more than one page is byte-identical in each

Warnings never fail the run: a relative link to a missing file, a numbered anchor (id="sec-6"), a
figure without role="img" or an aria-label, a figure slot without a kick, a claim or a legend, a
table twin with no tooltip line in a known grammar.

Exit code 0 when every check passes, 1 when one fails. build.py imports the checks from this file,
so the build and this tool judge a page the same way.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

MIN_ELEMENTS = 10
NOT_DRAWN = {"title", "desc", "metadata"}
ATTRS = r"""(?:[^>"']|"[^"]*"|'[^']*')*?"""
SVG_OPEN = re.compile(r"<svg\b(?P<attrs>" + ATTRS + r")(?P<self>/?)>", re.I)
SVG_TAG = re.compile(r"<(?P<close>/?)svg\b" + ATTRS + r"(?P<self>/?)>", re.I)
ID_ATTR = re.compile(r"""\bid\s*=\s*(["'])(?P<id>[^"']*)\1""", re.I)
SKIP_BLOCK = re.compile(r"<!--.*?-->|<(script|style)\b[^>]*>.*?</\1\s*>", re.S | re.I)
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.S)
CSS_URL = re.compile(r"""url\(\s*(["']?)(?P<u>.*?)\1\s*\)""", re.I | re.S)
JS_FETCH = re.compile(r"\bfetch\s*\(|\bXMLHttpRequest\b|\bimport\s*\(|\bimportScripts\s*\(|"
                      r"\bsendBeacon\s*\(|\bnew\s+(?:WebSocket|EventSource|Worker|SharedWorker)\b")
NUMBERED_ID = re.compile(r"^(?:(?:sec|section|chapter|part)[-_]?)?\d+(?:[-_.]\d+)*$", re.I)
SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*:|^//", re.I)


# ── markup helpers (build.py uses these too) ─────────────────────────────────────────────────────

def skip_spans(text: str) -> list[tuple[int, int]]:
    """The spans of comments, <script> and <style>: markup inside them is not markup."""
    return [m.span() for m in SKIP_BLOCK.finditer(text)]


def in_spans(pos: int, spans: list[tuple[int, int]]) -> bool:
    return any(a <= pos < b for a, b in spans)


def svg_end(text: str, start: int) -> int:
    """The end of the <svg> element that opens at start, nested <svg> included; -1 when unclosed."""
    depth = 0
    for m in SVG_TAG.finditer(text, start):
        if m.group("close"):
            depth -= 1
        elif not m.group("self"):
            depth += 1
        if depth <= 0:
            return m.end()
    return -1


def figure_spans(text: str) -> list[tuple[str, int, int]]:
    """Every <svg id="fig-NAME"> outside comments, scripts and styles: (NAME, start, end)."""
    spans, out = skip_spans(text), []
    for m in SVG_OPEN.finditer(text):
        idm = ID_ATTR.search(m.group("attrs"))
        if not idm or not idm.group("id").startswith("fig-") or in_spans(m.start(), spans):
            continue
        end = svg_end(text, m.start())
        out.append((idm.group("id")[4:], m.start(), end if end > 0 else len(text)))
    return out


def count_drawn(markup: str) -> int:
    """Drawn elements inside one <svg> element: every descendant except <title>, <desc>, <metadata>."""
    head = SVG_OPEN.match(markup)
    inner = markup[head.end():] if head else markup
    return sum(1 for t in re.findall(r"<([A-Za-z][\w:.-]*)", inner) if t.lower() not in NOT_DRAWN)


def short(value: str, n: int = 70) -> str:
    value = " ".join(value.split())
    return value if len(value) <= n else value[: n - 3] + "..."


def css_urls(css: str) -> list[tuple[str, int]]:
    """url() targets that load something (not data:, not #fragment), with their offset."""
    out = []
    for m in CSS_URL.finditer(css):
        u = m.group("u").strip()
        if u and not u.lower().startswith("data:") and not u.startswith("#"):
            out.append((u, m.start()))
    return out


IMAGE_SET = re.compile(r"(?:-webkit-)?image-set\(", re.I)
CSS_STRING = re.compile(r"""(["'])(?P<u>.*?)\1""", re.S)


def css_problems(css: str, line: int = 1) -> list[str]:
    """@import, loading url() and a bare string in image-set() in one CSS text; line = the line
    where that text starts."""
    body = CSS_COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), css)  # keep the line count
    at = lambda pos: line + body[:pos].count("\n")             # noqa: E731
    out = [f"line {at(m.start())}: @import in CSS" for m in re.finditer(r"@import\b", body, re.I)]
    out += [f"line {at(pos)}: url({short(u)}) in CSS" for u, pos in css_urls(body)]
    for m in IMAGE_SET.finditer(body):                          # image-set("a.png" 1x) loads a.png
        depth, i = 1, m.end()
        while i < len(body) and depth:
            depth += (body[i] == "(") - (body[i] == ")")
            i += 1
        inner = re.sub(r"url\(.*?\)", "", body[m.end():i], flags=re.I | re.S)   # url() is counted above
        out += [f"line {at(m.start())}: image-set(\"{short(s.group('u'))}\") in CSS"
                for s in CSS_STRING.finditer(inner)
                if s.group("u").strip() and not s.group("u").strip().lower().startswith("data:")]
    return out


def js_problems(js: str, line: int = 1) -> list[str]:
    return [f"line {line + js[:m.start()].count(chr(10))}: the script calls {m.group(0).strip()}"
            for m in JS_FETCH.finditer(js)]


def srcset_urls(value: str) -> list[str]:
    """Every candidate URL of a srcset, as the HTML spec splits it: a URL is a run without spaces,
    and a comma ends a candidate. A data: URL holds commas of its own, so a plain split on ","
    would cut it; "data:... 1x, https://x/b.png 2x" still fetches b.png."""
    urls, i, n = [], 0, len(value)
    while i < n:
        while i < n and (value[i].isspace() or value[i] == ","):
            i += 1
        j = i
        while j < n and not value[j].isspace():
            j += 1
        if j == i:
            break
        url, i = value[i:j], j
        if url.endswith(","):                           # "a.png," : a candidate with no descriptor
            urls.append(url.rstrip(","))
            continue
        urls.append(url)
        depth = 0                                       # skip the descriptors, up to the next comma
        while i < n and not (value[i] == "," and depth == 0):
            depth += (value[i] == "(") - (value[i] == ")" and depth > 0)
            i += 1
    return [u for u in urls if u]


VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source",
        "track", "wbr"}


class Scan(HTMLParser):
    """One pass over a page: ids, links, scripts, CSS, figure slots, and every attribute that loads."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[tuple[str, int]] = []
        self.anchors: set[str] = set()                   # <a name="...">
        self.hrefs: list[tuple[str, str, int]] = []      # (href, tag, line)
        self.loads: list[str] = []
        self.scripts: list[dict] = []                    # {"attrs", "text", "line"}
        self.css: list[tuple[str, int]] = []             # (css text, line where it starts)
        self.figs: list[dict] = []                       # {"id", "role", "label", "line"}
        self.slots: list[dict] = []                      # {"line", "has": set of parts}
        self._open_slots: list[tuple[dict, int]] = []    # (slot, figure depth when it opened)
        self._figure_depth = 0
        self._raw: str | None = None                     # "script" or "style" while inside one
        self._buf: list[str] = []
        self._raw_line = 0

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        a = {k.lower(): (v if v is not None else "") for k, v in attrs}
        classes = set(a.get("class", "").split())
        if "id" in a:
            self.ids.append((a["id"], line))
        if tag == "a" and a.get("name"):
            self.anchors.add(a["name"])
        for k in ("href", "xlink:href"):
            if k in a:
                self.hrefs.append((a[k].strip(), tag, line))
        self._loads(tag, a, line)
        if "style" in a:
            self.css.append((a["style"], line))
        if tag == "svg" and a.get("id", "").startswith("fig-"):
            self.figs.append({"id": a["id"], "role": a.get("role", ""),
                              "label": a.get("aria-label", "").strip(), "line": line})
            for slot, _ in self._open_slots:
                slot["has"].add("svg")
        if tag == "figure":
            self._figure_depth += 1
            if "slot" in classes:
                slot = {"line": line, "has": set()}
                self.slots.append(slot)
                self._open_slots.append((slot, self._figure_depth))
        if self._open_slots:
            slot = self._open_slots[-1][0]
            slot["has"] |= classes & {"kick", "claim", "srcline"}
            if tag == "figcaption":
                slot["has"].add("figcaption")
        if tag in ("script", "style"):
            self._raw, self._buf, self._raw_line = tag, [], line
            if tag == "script":
                self.scripts.append({"attrs": a, "text": "", "line": line})

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self._raw == tag:
            text = "".join(self._buf)
            if tag == "script":
                self.scripts[-1]["text"] = text
            else:
                self.css.append((text, self._raw_line))
            self._raw, self._buf = None, []
        if tag == "figure" and self._figure_depth:
            if self._open_slots and self._open_slots[-1][1] == self._figure_depth:
                self._open_slots.pop()
            self._figure_depth -= 1

    def handle_data(self, data):
        if self._raw:
            self._buf.append(data)

    def _loads(self, tag: str, a: dict[str, str], line: int) -> None:
        def loads(v: str) -> bool:
            v = v.strip().lower()
            return bool(v) and not v.startswith("data:")

        for k in ("src", "poster", "background"):
            if k in a and loads(a[k]):
                self.loads.append(f'line {line}: <{tag} {k}="{short(a[k])}">')
        for k in ("srcset", "imagesrcset"):                # every candidate, not only the first
            for u in srcset_urls(a.get(k, "")):
                if loads(u):
                    self.loads.append(f'line {line}: <{tag} {k}="... {short(u)} ...">')
        if tag == "link" and loads(a.get("href", "")):
            self.loads.append(f'line {line}: <link href="{short(a["href"])}">')
        if tag == "object" and loads(a.get("data", "")):
            self.loads.append(f'line {line}: <object data="{short(a["data"])}">')
        # SVG: an href on any element but a link loads what it names when that is not #local:
        # <image>, <use>, <feImage>, <script>, a gradient or pattern template, <textPath> ...
        if tag not in ("a", "area", "base", "link"):
            for k in ("href", "xlink:href"):
                v = a.get(k, "")
                if loads(v) and not v.strip().startswith("#"):
                    self.loads.append(f'line {line}: <{tag} {k}="{short(v)}">')
        for k, v in a.items():                       # SVG paint: fill="url(#g)" is local, fine
            if k != "style" and "url(" in v.lower():
                for u, _ in css_urls(v):
                    self.loads.append(f'line {line}: <{tag} {k}="url({short(u)})">')


def scan(text: str) -> Scan:
    s = Scan()
    s.feed(text)
    s.close()
    return s


# ── the checks ───────────────────────────────────────────────────────────────────────────────────

def load_problems(s: Scan) -> list[str]:
    out = list(s.loads)
    for css, line in s.css:
        out += css_problems(css, line)
    for sc in s.scripts:
        out += js_problems(sc["text"], sc["line"])
    return out


def duplicate_ids(s: Scan) -> list[str]:
    seen: dict[str, list[int]] = {}
    for i, line in s.ids:
        seen.setdefault(i, []).append(line)
    return [f'id="{i}" appears {len(lines)} times (lines {", ".join(map(str, lines[:6]))})'
            for i, lines in seen.items() if len(lines) > 1]


def dangling_links(s: Scan) -> list[str]:
    targets = {i for i, _ in s.ids} | s.anchors
    out = []
    for href, tag, line in s.hrefs:
        if not href.startswith("#"):
            continue
        frag = unquote(href[1:])
        if frag and frag.lower() != "top" and frag not in targets:
            out.append(f'line {line}: <{tag} href="{short(href)}"> points at no id in this page')
    return out


def in_page_links(s: Scan) -> int:
    return sum(1 for href, _, _ in s.hrefs if href.startswith("#"))


def missing_files(s: Scan, page: Path) -> list[str]:
    out = []
    for href, tag, line in s.hrefs:
        if not href or href.startswith("#") or SCHEME.match(href):
            continue
        target = unquote(href.split("#", 1)[0].split("?", 1)[0])
        if target and not (page.parent / target).exists():
            out.append(f'line {line}: <{tag} href="{short(href)}"> points at a file that does not exist')
    return out


def numbered_ids(s: Scan) -> list[str]:
    return [f'line {line}: id="{i}" is a number; anchor a section by name (id="gateway", not '
            f'id="sec-6"), so a reorder breaks no link' for i, line in s.ids if NUMBERED_ID.match(i)]


def figure_warnings(s: Scan) -> list[str]:
    out = []
    for f in s.figs:
        if f["role"] != "img":
            out.append(f'line {f["line"]}: {f["id"]} has no role="img"')
        if not f["label"]:
            out.append(f'line {f["line"]}: {f["id"]} has no aria-label; the label states the finding')
    parts = {"kick": "a kick", "claim": "a claim", "svg": "a fig-* svg",
             "srcline": "a srcline legend"}
    for slot in s.slots:
        lacks = [name for key, name in parts.items() if key not in slot["has"]]
        if lacks:
            out.append(f'line {slot["line"]}: figure slot lacks {", ".join(lacks)}')
    return out


def node_check(js: str, module: bool = False) -> tuple[bool | None, str]:
    """(True, note) when node accepts the script, (False, error) when not, (None, note) without node."""
    node = shutil.which("node")
    if not node:
        return None, "node is not installed, so the syntax check is skipped"
    fd, name = tempfile.mkstemp(suffix=".mjs" if module else ".js")
    try:
        with open(fd, "w", encoding="utf-8") as f:
            f.write(js)
        r = subprocess.run([node, "--check", name], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=60)
    finally:
        Path(name).unlink(missing_ok=True)
    if r.returncode == 0:
        return True, "node --check passed"
    lines = [ln for ln in (r.stderr or r.stdout).splitlines() if ln.strip()]
    return False, "node --check failed: " + " | ".join(lines[:5])


# ── table twins: the figure and its table must say the same thing ────────────────────────────────
# A checker that only counts (5 rows here, 5 rows there) passes a wrong label: "Raw log" for "Raw
# logs", or two swapped row names with the same total. So every comparison below matches names,
# labels and values, in both directions.

class Node:
    """One element of a small DOM: the twin check needs parents, siblings and text."""
    __slots__ = ("tag", "attrs", "kids", "parent", "line")

    def __init__(self, tag: str, attrs: dict[str, str] | None = None, parent: "Node | None" = None,
                 line: int = 0) -> None:
        self.tag, self.attrs, self.kids, self.parent, self.line = tag, attrs or {}, [], parent, line

    def walk(self):
        for k in self.kids:
            if isinstance(k, Node):
                yield k
                yield from k.walk()

    def raw(self) -> str:
        return "".join(k if isinstance(k, str) else k.raw() for k in self.kids)

    def text(self) -> str:
        return " ".join(self.raw().split())

    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())

    def next_element(self) -> "Node | None":
        """The next element sibling, when only white space lies between."""
        sibs = self.parent.kids if self.parent else []
        for k in sibs[sibs.index(self) + 1:]:
            if isinstance(k, Node):
                return k
            if k.strip():
                return None
        return None


class Tree(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = self.cur = Node("#root")

    def _node(self, tag, attrs) -> Node:
        n = Node(tag, {k.lower(): (v or "") for k, v in attrs}, self.cur, self.getpos()[0])
        self.cur.kids.append(n)
        return n

    def handle_starttag(self, tag, attrs):
        n = self._node(tag, attrs)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self._node(tag, attrs)

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.kids.append(data)


ARROW, SEP, DASH = " → ", " · ", " — "
COUNT = re.compile(r"^(\d+)(?:\s|$)")
NOTE = re.compile(r"\(note (\d+)\)\s*$")
PAREN = re.compile(r"\s*\(([^()]*)\)\s*$")
IN_MODES, OUT_MODES = {"full", "limited", "masked", "partial"}, {"withheld", "omitted", "hidden", "none"}
PART_MODES = {"limited", "masked", "partial"}


def norm(s: str) -> str:
    return " ".join(s.split()).casefold()


def grammar(parts: list[str]) -> str | None:
    if len(parts) == 2 and parts[0].count(ARROW) == 1 and ARROW not in parts[1]:
        return "flow"
    if len(parts) >= 2 and parts[0].isdigit() and ARROW in parts[1]:
        return "steps"
    if len(parts) == 2 and not parts[0].isdigit() and ARROW not in parts[0] and parts[1].count(ARROW) == 1:
        return "link"
    if len(parts) == 3 and not any(ARROW in p for p in parts):
        return "grid" if COUNT.match(parts[2]) else "member"
    return None


def twin_table(details: Node) -> tuple[list[str], list[tuple[list[str], set[str], int]]] | None:
    """(the head cells, [(the cells, the row classes, the line)]) of the first table in a twin."""
    table = next((n for n in details.walk() if n.tag == "table"), None)
    if table is None:
        return None
    head: list[str] = []
    body: list[tuple[list[str], set[str], int]] = []
    for tr in (n for n in table.walk() if n.tag == "tr"):
        cells = [c for c in tr.kids if isinstance(c, Node) and c.tag in ("td", "th")]
        if not cells:
            continue
        texts = [c.text() for c in cells]
        if not head and not body and all(c.tag == "th" for c in cells):
            head = texts
        else:
            body.append((texts, tr.classes(), tr.line))
    return head, body


def items_of(cell: str) -> list[tuple[str, bool]]:
    """A list cell, "SSO, Audit export (last 30 days)": [(name, carries a note)]; "none" is empty.
    A comma inside a note does not split it: "Audit export (30 days, admins only)" is one item."""
    out, pieces, depth, cur = [], [], 0, ""
    for ch in cell:
        depth += (ch == "(") - (ch == ")" and depth > 0)
        if ch == "," and depth == 0:
            pieces.append(cur)
            cur = ""
        else:
            cur += ch
    pieces.append(cur)
    for piece in (p.strip() for p in pieces):
        if not piece or norm(piece) in ("none", "—", "-", "no"):
            continue
        m = PAREN.search(piece)
        out.append((piece[:m.start()].strip(), True) if m else (piece, False))
    return out


def num(cell: str) -> int | None:
    m = COUNT.match(cell.strip())
    return int(m.group(1)) if m else None


def grid_twin(say, found, head, rows) -> tuple[list[str], str]:
    """matrix: "<row> · <column> · <n> places" against a table of counts, by row and column name."""
    fails: list[str] = []
    col_of = {norm(h): j for j, h in enumerate(head)}
    total_col = col_of.get("total")
    data = [r for r in rows if "total" not in r[1]]
    row_of = {norm(cells[0]): (cells, line) for cells, _, line in data}
    drawn: dict[tuple[str, str], int | None] = {}
    rname, cname = {}, {}
    for _, (r, c, v) in found:
        drawn[(norm(r), norm(c))] = num(v)
        rname.setdefault(norm(r), r)
        cname.setdefault(norm(c), c)
    fails += [f'{say}: the figure draws the row "{r}", and the table has no row of that name'
              for nr, r in rname.items() if nr not in row_of]
    fails += [f'{say}: the figure draws the column "{c}", and the table has no column of that name'
              for nc, c in cname.items() if nc not in col_of]
    for (nr, nc), v in drawn.items():
        if nr in row_of and nc in col_of:
            cells, line = row_of[nr]
            cell = cells[col_of[nc]] if col_of[nc] < len(cells) else ""
            if num(cell) != v:
                fails.append(f'{say}: "{rname[nr]} · {cname[nc]}" is {v} in the figure and "{cell}" in '
                             f'the table (line {line})')
    fails += [f'{say}: the table row "{cells[0]}" (line {line}) is not drawn'
              for cells, _, line in data if norm(cells[0]) not in rname]
    fails += [f'{say}: the table column "{h}" is not drawn'
              for j, h in enumerate(head[1:], 1) if j != total_col and norm(h) not in cname]
    for cells, cls, line in rows:                        # the totals of the table add up
        if total_col is not None and "total" not in cls and total_col < len(cells):
            s = sum(num(c) or 0 for j, c in enumerate(cells) if 0 < j != total_col)
            if num(cells[total_col]) is not None and num(cells[total_col]) != s:
                fails.append(f'{say}: the table row "{cells[0]}" totals {cells[total_col]}, and its '
                             f'cells add up to {s} (line {line})')
        if "total" in cls:
            for j in range(1, len(cells)):
                s = sum(num(r[0][j]) or 0 for r in data if j < len(r[0]))
                if num(cells[j]) is not None and num(cells[j]) != s:
                    fails.append(f'{say}: the total row "{cells[0]}" holds {cells[j]} under '
                                 f'"{head[j] if j < len(head) else j}", and that column adds up to {s} '
                                 f'(line {line})')
    return fails, f"{len(drawn)} cells, by row and column name"


def member_twin(say, found, head, rows) -> tuple[list[str], str]:
    """stack, silhouettes: "<column> · <row> · full|limited|withheld" against a table with one row
    per column of the figure, whose cells list what it holds; "<column> · <name> · <value>" against
    the table column of that name."""
    fails: list[str] = []
    head_of = {norm(h): j for j, h in enumerate(head)}
    owner_of = {norm(cells[0]): (cells, line) for cells, _, line in rows}
    value_cols = {head_of[norm(p[1])] for _, p in found if norm(p[1]) in head_of}
    held: dict[str, dict[str, tuple[str, str]]] = {}      # owner -> item -> (item as drawn, mode)
    missing: dict[str, str] = {}
    for full, (owner, item, v) in found:
        o, mode = norm(owner), norm(v)
        if o not in owner_of:
            missing.setdefault(o, owner)
            continue
        cells, line = owner_of[o]
        if norm(item) in head_of:                         # a value, under the table column of that name
            cell = cells[head_of[norm(item)]] if head_of[norm(item)] < len(cells) else ""
            if mode not in ("none", "—") and not re.search(r"(?<!\w)" + re.escape(mode) + r"(?!\w)", norm(cell)):
                fails.append(f'{say}: "{owner} · {item}" is "{v}" in the figure and "{cell}" in the '
                             f'table (line {line})')
        elif mode in IN_MODES:
            held.setdefault(o, {})[norm(item)] = (item, mode)
        elif mode not in OUT_MODES:
            fails.append(f'{say}: "{full.split(DASH)[0]}" ends in "{v}", which is no mode (full, limited, '
                         f'withheld) and no table column')
    fails += [f'{say}: the figure draws "{owner}", and the table has no row of that name'
              for owner in missing.values()]
    for o, (cells, line) in owner_of.items():
        listed: dict[str, tuple[str, bool, str]] = {}     # item -> (name, carries a limit, column kind)
        for j, cell in enumerate(cells[1:], 1):
            if j in value_cols:
                continue
            h = norm(head[j]) if j < len(head) else ""
            kind = ("out" if re.search(r"withheld|hidden|omitted|\bnot\b", h) else
                    "part" if re.search(r"limited|masked|partial", h) else "in")
            for name, noted in items_of(cell):
                listed[norm(name)] = (name, noted, kind)
        got = held.get(o, {})
        for ni, (name, noted, kind) in listed.items():
            mode = got.get(ni, ("", ""))[1]
            if kind == "out":
                if mode:
                    fails.append(f'{say}: the table lists "{name}" as withheld for "{cells[0]}" (line '
                                 f'{line}), and the figure draws it {mode}')
            elif not mode:
                fails.append(f'{say}: the table lists "{name}" for "{cells[0]}" (line {line}), and the '
                             f'figure does not draw it for "{cells[0]}"')
            elif (mode in PART_MODES) != (noted or kind == "part"):
                fails.append(f'{say}: "{cells[0]} · {name}" is {mode} in the figure, and the table '
                             f'{"notes no limit" if mode in PART_MODES else "notes a limit"} (line {line})')
        fails += [f'{say}: the figure draws "{cells[0]} · {item}" {mode}, and the table row "{cells[0]}" '
                  f'(line {line}) does not list it' for ni, (item, mode) in got.items() if ni not in listed]
    drawn_owners = {norm(p[0]) for _, p in found}
    fails += [f'{say}: the table row "{cells[0]}" (line {line}) is not drawn'
              for o, (cells, line) in owner_of.items() if o not in drawn_owners]
    return fails, f"{len(found)} marks, by column, row and mode"


def flow_twin(say, found, head, rows) -> tuple[list[str], str]:
    """lineage: "<from> → <to> · cut|stays" against a table row "<from> | <to> | <status> (n)"."""
    fails: list[str] = []
    drawn = {}
    for full, (pair, status) in found:
        a, b = (s.strip() for s in pair.split(ARROW))
        note = NOTE.search(full)
        drawn[(norm(a), norm(b))] = (a, b, norm(status), note.group(1) if note else "")
    table = {}
    for cells, _, line in rows:
        if len(cells) < 3:
            fails.append(f'{say}: the table row "{" | ".join(cells)}" (line {line}) needs a source, an '
                         f'output and a status')
            continue
        words, n = cells[2].split(), re.search(r"\((\d+)\)", cells[2])
        table[(norm(cells[0]), norm(cells[1]))] = (cells, norm(words[0]) if words else "",
                                                   n.group(1) if n else "", line)
    for key, (a, b, status, note) in drawn.items():
        if key not in table:
            fails.append(f'{say}: the figure draws "{a} → {b}", and the table has no row for it')
            continue
        cells, tstatus, tnote, line = table[key]
        if tstatus != status:
            fails.append(f'{say}: "{a} → {b}" is "{status}" in the figure and "{cells[2]}" in the table '
                         f'(line {line})')
        if tnote != note:
            fails.append(f'{say}: "{a} → {b}" carries note {note or "none"} in the figure and '
                         f'{tnote or "none"} in the table (line {line})')
    fails += [f'{say}: the table row "{cells[0]} → {cells[1]}" (line {line}) is not drawn'
              for key, (cells, _, _, line) in table.items() if key not in drawn]
    return fails, f"{len(drawn)} feeds, by source, output, status and note"


def steps_twin(say, found, head, rows) -> tuple[list[str], str]:
    """system, sequence: "<n> · <from> → <to> ..." against a table row that starts with <n>."""
    fails: list[str] = []
    drawn = {}
    for _, parts in found:
        a, b = (s.strip() for s in parts[1].split(ARROW, 1))
        drawn[parts[0]] = (a, b)
    table = {cells[0].strip(): (cells, line) for cells, _, line in rows if cells[0].strip().isdigit()}
    for n, (a, b) in drawn.items():
        if n not in table:
            fails.append(f'{say}: the figure draws step {n}, "{a} → {b}", and the table has no row {n}')
            continue
        cells, line = table[n]
        have = {norm(c) for c in cells} | {norm(x) for c in cells for x in c.split(",")}
        for who in (a, b):
            if not all(norm(x) in have for x in who.split(",")):
                fails.append(f'{say}: step {n} names "{who}" in the figure, and the table row {n} '
                             f'(line {line}) does not: {" | ".join(cells)}')
    fails += [f'{say}: the table row {n} (line {line}) is not drawn'
              for n, (_, line) in table.items() if n not in drawn]
    return fails, f"{len(drawn)} steps, by number and party"


def link_twin(say, found, head, rows) -> tuple[list[str], str]:
    """mapping: "<item> · <value> → <group> (<role>)" against a table row that names the item, the
    value and the group."""
    fails: list[str] = []
    drawn = {}
    for _, (item, link) in found:
        value, group = (s.strip() for s in link.split(ARROW, 1))
        drawn[(norm(item), norm(value))] = (item, value, group)
    table: dict[str, list[tuple[list[str], int]]] = {}
    for cells, _, line in rows:
        table.setdefault(norm(cells[0]), []).append((cells, line))

    def says(cells, value, group):
        have = {norm(c) for c in cells} | {norm(x) for c in cells for x in c.split(",")}
        return norm(value) in have and (norm(group) in have or norm(PAREN.sub("", group)) in have)

    for (ni, _), (item, value, group) in drawn.items():
        if not any(says(cells, value, group) for cells, _ in table.get(ni, [])):
            fails.append(f'{say}: the figure draws "{item} · {value} → {group}", and no table row says so')
    fails += [f'{say}: the table row "{" | ".join(cells)}" (line {line}) is not drawn'
              for ni, hits in table.items() for cells, line in hits
              if not any(k[0] == ni and says(cells, v, g) for k, (_, v, g) in drawn.items())]
    return fails, f"{len(drawn)} links, by item, value and group"


TWIN = {"grid": grid_twin, "member": member_twin, "flow": flow_twin, "steps": steps_twin, "link": link_twin}


def compare_twin(fig: str, lines: list[tuple[str, list[str]]], head: list[str],
                 body: list[tuple[list[str], set[str], int]]) -> tuple[list[str], str]:
    """(failures, what was compared) for one figure and its table twin; ([], "") when no tooltip line
    is in a known grammar. The grammar that most lines follow decides the comparison."""
    kinds: dict[str, list[tuple[str, list[str]]]] = {}
    for full, parts in lines:
        g = grammar(parts)
        if g:
            kinds.setdefault(g, []).append((full, parts))
    if not kinds:
        return [], ""
    kind, found = max(kinds.items(), key=lambda kv: len(kv[1]))
    rows = [r for r in body if any(c.strip() for c in r[0])]
    return TWIN[kind](f"fig-{fig} and its table twin", found, head, rows)


def twin_problems(text: str) -> tuple[list[str], list[str], list[str]]:
    """(fails, warnings, passes) of every figure slot that a table twin follows."""
    t = Tree()
    t.feed(text)
    t.close()
    fails, warns, oks = [], [], []
    for slot in (n for n in t.root.walk() if n.tag == "figure" and "slot" in n.classes()):
        svg = next((n for n in slot.walk() if n.tag == "svg" and n.attrs.get("id", "").startswith("fig-")), None)
        twin = slot.next_element()
        if svg is None or twin is None or twin.tag != "details" or "twin" not in twin.classes():
            continue
        fig = svg.attrs["id"][4:]
        table = twin_table(twin)
        if table is None:
            warns.append(f"line {twin.line}: the table twin of fig-{fig} holds no <table>")
            continue
        lines = []
        for n in svg.walk():
            if n.tag == "title" and n.text():
                full = n.text()
                lines.append((full, [p.strip() for p in full.split(DASH, 1)[0].split(SEP)]))
        f, what = compare_twin(fig, lines, *table)
        if not what:
            warns.append(f"line {twin.line}: fig-{fig} has a table twin, but no tooltip line in a known "
                         f"grammar, so nothing was compared")
            continue
        fails += f
        if not f:
            oks.append(f"fig-{fig} ({what})")
    return fails, warns, oks


# ── the command ──────────────────────────────────────────────────────────────────────────────────

def show(p: Path) -> str:
    """A path to print: relative when close by, else absolute; always with forward slashes."""
    try:
        r = Path(os.path.relpath(p)).as_posix()
    except ValueError:                                # another drive on Windows
        return p.as_posix()
    return p.as_posix() if r.startswith("../../") else r


def check_page(path: Path) -> tuple[list[str], list[str], list[str], dict[str, str]]:
    """(fails, warnings, passes, {figure name: markup}) for one page."""
    try:
        text = path.read_bytes().decode("utf-8-sig")
    except (OSError, UnicodeDecodeError) as e:
        return [f"cannot read the page: {e}"], [], [], {}
    s = scan(text)
    fails, warns, oks = [], [], []

    dup = duplicate_ids(s)
    fails += dup
    if not dup:
        oks.append(f"ids: {len(s.ids)}, all unique")

    bad = dangling_links(s)
    fails += bad
    if not bad:
        oks.append(f"links: {in_page_links(s)} in-page links, all resolve")

    loads = load_problems(s)
    fails += [f"loads {x}" for x in loads]
    if not loads:
        oks.append("fetch: nothing loads by itself")

    if len(s.scripts) != 1:
        fails.append(f"{len(s.scripts)} <script> elements; a built page carries exactly one, "
                     f"the runtime")
    else:
        sc = s.scripts[0]
        ok, note = node_check(sc["text"], sc["attrs"].get("type", "") == "module")
        size = len(sc["text"].encode("utf-8"))
        if ok is False:
            fails.append(f"script (line {sc['line']}): {note}")
        else:
            oks.append(f"script: one <script>, {size:,} bytes, {note}")

    figs: dict[str, str] = {}
    counts, low = [], []
    for name, a, b in figure_spans(text):
        markup = text[a:b]
        n = count_drawn(markup)
        counts.append(f"{name} {n}")
        if name in figs:
            continue                                   # a duplicate id; reported above
        figs[name] = markup
        if n < MIN_ELEMENTS:
            low.append(f"fig-{name} holds {n} drawn elements; a drawn figure holds at least "
                       f"{MIN_ELEMENTS}. Run build.py again, and read its errors")
    fails += low
    if not counts:
        oks.append("figures: none on this page")
    elif not low:
        oks.append(f"figures: {len(counts)}, each with {MIN_ELEMENTS} or more drawn elements "
                   f"({', '.join(counts)})")

    tf, tw, tok = twin_problems(text)
    fails += tf
    warns += tw
    if tok and not tf:
        oks.append(f"twins: {len(tok)} figure{'s' if len(tok) != 1 else ''} match their table twins: "
                   + "; ".join(tok))

    warns += missing_files(s, path) + numbered_ids(s) + figure_warnings(s)
    return fails, warns, oks, figs


def first_difference(a: str, b: str) -> str:
    i = next((k for k, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
    return f"first difference at character {i:,}: {a[max(0, i - 30):i + 40]!r} vs {b[max(0, i - 30):i + 40]!r}"


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv else 2
    pages = [Path(p).resolve() for p in argv]
    missing = [p for p in pages if not p.is_file()]
    if missing:
        print("\n".join(f"FAIL  no file at {show(p)}" for p in missing))
        return 1

    total_fail = total_warn = 0
    shared: dict[str, list[tuple[Path, str]]] = {}
    print(f"check_pages: {len(pages)} page{'s' if len(pages) != 1 else ''}")
    for page in pages:
        fails, warns, oks, figs = check_page(page)
        print(f"\n{show(page)}")
        for line in oks:
            print(f"  ok    {line}")
        for line in warns:
            print(f"  warn  {line}")
        for line in fails:
            print(f"  FAIL  {line}")
        total_fail += len(fails)
        total_warn += len(warns)
        for name, markup in figs.items():
            shared.setdefault(name, []).append((page, markup))

    multi = {n: v for n, v in shared.items() if len(v) > 1}
    if len(pages) > 1:
        print("\nacross pages")
        if not multi:
            print("  ok    no figure appears in more than one page")
        for name, copies in sorted(multi.items()):
            first_page, first = copies[0]
            where = ", ".join(p.name for p, _ in copies)
            differ = [(p, m) for p, m in copies[1:] if m != first]
            if not differ:
                print(f"  ok    fig-{name}: {len(first.encode('utf-8')):,} bytes, identical in {where}")
                continue
            for p, m in differ:
                total_fail += 1
                print(f"  FAIL  fig-{name} differs between {first_page.name} and {p.name} "
                      f"({len(first):,} vs {len(m):,} characters); {first_difference(first, m)}. "
                      f"Build every page from one doc.json, so both read the same drawn figure")

    print(f"\n{len(pages)} page{'s' if len(pages) != 1 else ''}, {total_fail} "
          f"failure{'s' if total_fail != 1 else ''}, {total_warn} warning{'s' if total_warn != 1 else ''}")
    return 1 if total_fail else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
