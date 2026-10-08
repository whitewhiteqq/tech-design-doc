"""Draw a cloud deployment diagram with the OFFICIAL vendor icons, from one JSON spec.

    python cloud_diagram.py img/deploy.spec.json      # writes img/deploy.{svg,png,drawio,md,mmd}
    python cloud_diagram.py spec.json --out docs/img/deploy --no-png --strict

One spec gives five files that always agree:
    <out>.svg     inline it in HTML (build.py: <!--@@INCLUDE ...svg@@-->), or attach it
    <out>.png     2x render (Chrome or Edge, headless) for Confluence and Markdown previews
    <out>.drawio  editable in draw.io and the Confluence draw.io macro; each icon is the vendor SVG
    <out>.md      a Markdown snippet: the image, the draw.io link, the icon credit
    <out>.mmd     a Mermaid twin of the topology, for review and diffs (no icons)

Each icon is the vendor file, unmodified, embedded as a data: URI image. Nothing recolours, crops or
redraws a mark, and two packs can never clash on ids or CSS classes. See ../reference/cloud-diagrams.md
for the spec format and ../vendor-icons/README.md for the terms.

The tool prints lint warnings (a node inside a group it does not belong to, an edge through a node
or on top of another edge, a label over a node, border or title). Fix the spec until it prints none,
then look at the PNG once.
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

sys.dont_write_bytecode = True                   # no __pycache__ inside the skill
sys.path.insert(0, str(Path(__file__).resolve().parent))
import icons as iconlib  # noqa: E402

# ---------------------------------------------------------------- geometry
ICON = 56          # icon edge, px
NODE_W = 156       # node box width: icon plus the label under it
GAP_X = 64         # space between two node boxes in a row
GAP_Y = 44         # space between two node boxes in a column
PAD = 20           # group padding
HEAD = 30          # group header (icon + label) height
MARGIN = 24
TITLE_H = 40
FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
LINE = 15          # label line height
SUB_LINE = 13

INK = "#1B2430"
MUTED = "#5B6676"

EDGE_KINDS = {     # colour, dash, width, legend text
    "main":    ("#1A5FB4", "",      2.0, "Request path"),
    "async":   ("#1A5FB4", "7 5",   1.6, "Asynchronous / event"),
    "failure": ("#B42318", "6 4",   1.6, "Failure / retry / dead-letter"),
    "monitor": ("#7A869A", "2 4",   1.4, "Logs, metrics, alarms"),
}

# Group styles. AWS styles follow the AWS group conventions and draw the official group icon.
GROUPS = {
    "aws-cloud":      {"stroke": "#232F3E", "fill": "#FFFFFF", "dash": "",    "icon": "aws-group/aws-cloud-logo"},
    "aws-account":    {"stroke": "#E7157B", "fill": "#FFFFFF", "dash": "",    "icon": "aws-group/aws-account"},
    "region":         {"stroke": "#00A4A6", "fill": "#FFFFFF", "dash": "6 4", "icon": "aws-group/region"},
    "az":             {"stroke": "#00A4A6", "fill": "#FFFFFF", "dash": "8 4", "icon": None},
    "vpc":            {"stroke": "#8C4FFF", "fill": "#FFFFFF", "dash": "",    "icon": "aws-group/virtual-private-cloud-vpc"},
    "public-subnet":  {"stroke": "#7AA116", "fill": "#F2F6E8", "dash": "",    "icon": "aws-group/public-subnet"},
    "private-subnet": {"stroke": "#00A4A6", "fill": "#E6F6F7", "dash": "",    "icon": "aws-group/private-subnet"},
    "asg":            {"stroke": "#ED7100", "fill": "#FFFFFF", "dash": "6 4", "icon": "aws-group/auto-scaling-group"},
    "data-center":    {"stroke": "#7D8998", "fill": "#FFFFFF", "dash": "",    "icon": "aws-group/corporate-data-center"},
    "azure-subscription": {"stroke": "#0078D4", "fill": "#FFFFFF", "dash": "", "icon": "azure/subscriptions"},
    "azure-rg":       {"stroke": "#0078D4", "fill": "#F3F8FD", "dash": "6 4", "icon": "azure/resource-groups"},
    "azure-vnet":     {"stroke": "#50A0E6", "fill": "#FFFFFF", "dash": "",    "icon": "azure/virtual-networks"},
    "gcp-project":    {"stroke": "#4285F4", "fill": "#FFFFFF", "dash": "",    "icon": None},
    "gcp-region":     {"stroke": "#4285F4", "fill": "#F1F6FE", "dash": "6 4", "icon": None},
    "external":       {"stroke": "#9AA5B1", "fill": "#F7F8FA", "dash": "4 4", "icon": None},
    "generic":        {"stroke": "#7D8998", "fill": "#FFFFFF", "dash": "",    "icon": None},
}

ROUTES = ("h", "v", "hv", "vh", "L1", "L2", "u", "c")

PACK_CREDIT = {
    "aws-icons.zip": "AWS Architecture Icons (release 07312026)",
    "azure-icons.zip": "Microsoft Azure icons (V24)",
    "entra-icons.zip": "Microsoft Entra architecture icons (Oct 2023)",
    "power-platform-icons.zip": "Microsoft Power Platform icons",
    "gcp-core-icons.zip": "Google Cloud icons",
    "gcp-category-icons.zip": "Google Cloud icons",
}


def text_w(s: str, size: float = 12, bold: bool = False) -> float:
    """Approximate width of a label in px. Good enough to wrap and to lint."""
    cjk = sum(1 for c in s if unicodedata.east_asian_width(c) in "WF")
    narrow = sum(1 for c in s if c in "iljtfr.,:;'| ()[]")
    wide = sum(1 for c in s if c.isupper() or c in "mwMW@")
    em = (len(s) - narrow - wide - cjk) * 0.55 + narrow * 0.32 + wide * 0.72 + cjk * 1.0
    return em * size * (1.06 if bold else 1.0)


def wrap(s: str, width: float, size: float = 12, bold: bool = False) -> list[str]:
    lines, cur = [], ""
    words = []
    for word in s.split():                 # a token wider than the line (or CJK text) breaks per character
        while text_w(word, size, bold) > width and len(word) > 1:
            cut = len(word)
            while cut > 1 and text_w(word[:cut], size, bold) > width:
                cut -= 1
            words.append(word[:cut])
            word = word[cut:]
        words.append(word)
    for word in words:
        trial = f"{cur} {word}".strip()
        if cur and text_w(trial, size, bold) > width:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    return lines + ([cur] if cur else [])


def esc(s: str) -> str:
    return html.escape(s, quote=True)


# ---------------------------------------------------------------- model
class Spec:
    def __init__(self, raw: dict, index: dict):
        self.raw = raw
        self.title = raw.get("title", "")
        self.index = index
        if not raw.get("nodes"):
            raise SystemExit('the spec needs a non-empty "nodes" list')
        for i, n in enumerate(raw["nodes"]):
            if "id" not in n:
                raise SystemExit(f'node #{i} needs "id"')
        for i, g in enumerate(raw.get("groups", [])):
            if "id" not in g:
                raise SystemExit(f'group #{i} needs "id"')
        for i, e in enumerate(raw.get("edges", [])):
            if "from" not in e or "to" not in e:
                raise SystemExit(f'edge #{i} needs "from" and "to"')
        self.nodes = {n["id"]: dict(n) for n in raw["nodes"]}
        self.groups = {g["id"]: dict(g) for g in raw.get("groups", [])}
        self.edges = [dict(e) for e in raw.get("edges", [])]
        self.icons: dict[str, dict] = {}   # icon key -> resolved entry with data uri
        self.warnings: list[str] = []
        self._check()

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def icon(self, key: str) -> dict:
        if key not in self.icons:
            entry = iconlib.resolve(key, self.index)
            svg = iconlib.read_svg(entry)
            entry["b64"] = base64.b64encode(svg).decode("ascii")
            entry["uri"] = "data:image/svg+xml;base64," + entry["b64"]
            vb = re.search(rb'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', svg)
            entry["aspect"] = float(vb.group(2)) / float(vb.group(1)) if vb else 1.0   # height / width
            self.icons[key] = entry
        return self.icons[key]

    def _check(self) -> None:
        seen = {}
        for n in self.nodes.values():
            at = n.get("at")
            if not (isinstance(at, list) and len(at) == 2 and all(isinstance(v, int) and v >= 0 for v in at)):
                raise SystemExit(f"node '{n['id']}' needs \"at\": [column, row], two whole numbers from 0")
            cell = tuple(n["at"])
            if cell in seen:
                raise SystemExit(f"nodes '{seen[cell]}' and '{n['id']}' share cell {list(cell)}")
            seen[cell] = n["id"]
            if n.get("icon"):
                ent = self.icon(n["icon"])
                n.setdefault("label", ent["title"])
            n.setdefault("label", n["id"])
        for g in self.groups.values():
            g.setdefault("style", "generic")
            for k in ("stroke", "fill", "dash", "icon", "label"):
                if k in g and not isinstance(g[k], str):
                    raise SystemExit(f"group '{g['id']}': \"{k}\" must be a string, e.g. \"dash\": \"6 4\" "
                                     f"(or \"\" for a solid line)")
            if g["style"] not in GROUPS:
                raise SystemExit(f"group '{g['id']}': unknown style '{g['style']}'. Use one of: {', '.join(GROUPS)}")
            for m in g.get("contains", []):
                if m not in self.nodes and m not in self.groups:
                    raise SystemExit(f"group '{g['id']}' contains unknown id '{m}'")
            icon = g.get("icon", GROUPS[g["style"]]["icon"])
            if icon:
                self.icon(icon)
        self.parent: dict[str, str] = {}
        for g in self.groups.values():
            for m in g.get("contains", []):
                if m in self.parent:
                    raise SystemExit(f"'{m}' sits in two groups: '{self.parent[m]}' and '{g['id']}'")
                self.parent[m] = g["id"]
        for gid in self.groups:
            seen_up, cur = {gid}, gid
            while cur in self.parent:
                cur = self.parent[cur]
                if cur in seen_up:
                    raise SystemExit(f"group '{gid}' sits inside itself (a cycle in \"contains\")")
                seen_up.add(cur)
        for e in self.edges:
            for end in ("from", "to"):
                if e[end] not in self.nodes:
                    raise SystemExit(f"edge {e['from']} -> {e['to']}: unknown node '{e[end]}'")
            if e["from"] == e["to"]:
                raise SystemExit(f"edge {e['from']} -> {e['to']}: an edge needs two different nodes")
            if e.get("via") and e["via"] not in ROUTES:
                raise SystemExit(f"edge {e['from']} -> {e['to']}: via must be one of {', '.join(ROUTES)}")
            e.setdefault("kind", "main")
            if e["kind"] not in EDGE_KINDS:
                raise SystemExit(f"edge {e['from']} -> {e['to']}: kind must be one of {', '.join(EDGE_KINDS)}")

    # all node ids inside a group, at any depth
    def members(self, gid: str) -> list[str]:
        out = []
        for m in self.groups[gid].get("contains", []):
            out += self.members(m) if m in self.groups else [m]
        return out

    def depth(self, gid: str) -> int:
        d = 0
        while gid in self.parent:
            gid = self.parent[gid]
            d += 1
        return d


# ---------------------------------------------------------------- layout
class Layout:
    def __init__(self, spec: Spec):
        self.s = spec
        nodes = spec.nodes.values()
        self.ncols = max(n["at"][0] for n in nodes) + 1
        self.nrows = max(n["at"][1] for n in nodes) + 1
        self._label_lines()
        self._grid()
        self._nodes()
        self._groups()

    def _label_lines(self):
        for n in self.s.nodes.values():
            n["_lines"] = wrap(n["label"], NODE_W - 6, 12, True)
            n["_sub"] = wrap(n.get("sub", ""), NODE_W - 6, 10.5) if n.get("sub") else []
            n["_h"] = ICON + 6 + len(n["_lines"]) * LINE + len(n["_sub"]) * SUB_LINE

    def _span(self, gid):
        cells = [self.s.nodes[m]["at"] for m in self.s.members(gid)]
        if not cells:
            raise SystemExit(f"group '{gid}' holds no node")
        return (min(c[0] for c in cells), max(c[0] for c in cells),
                min(c[1] for c in cells), max(c[1] for c in cells))

    def _grid(self):
        spans = {g: self._span(g) for g in self.s.groups}
        self.spans = spans
        def nest(k, v):
            """The deepest chain of nested groups whose span side k sits at v: the borders to fit."""
            best = 0
            for g, sp in spans.items():
                if sp[k] != v:
                    continue
                n, cur = 1, g
                while cur in self.s.parent:
                    cur = self.s.parent[cur]
                    n += spans[cur][k] == v
                best = max(best, n)
            return best
        open_c = [nest(0, c) for c in range(self.ncols)]
        close_c = [nest(1, c) for c in range(self.ncols)]
        open_r = [nest(2, r) for r in range(self.nrows)]
        close_r = [nest(3, r) for r in range(self.nrows)]
        row_h = [max([n["_h"] for n in self.s.nodes.values() if n["at"][1] == r] or [ICON]) for r in range(self.nrows)]
        self.col_x, x = [], MARGIN + PAD * open_c[0]
        for c in range(self.ncols):
            self.col_x.append(x)
            x += NODE_W + (GAP_X + PAD * (close_c[c] + (open_c[c + 1] if c + 1 < self.ncols else 0)))
        self.width = x - GAP_X + MARGIN
        top = MARGIN + (TITLE_H if self.s.title else 0)
        self.row_y, y = [], top + (PAD + HEAD) * open_r[0]
        for r in range(self.nrows):
            self.row_y.append(y)
            y += row_h[r] + (GAP_Y + PAD * close_r[r] + ((PAD + HEAD) * open_r[r + 1] if r + 1 < self.nrows else 0))
        self.row_h = row_h
        self.body_bottom = y - GAP_Y

    def _nodes(self):
        for n in self.s.nodes.values():
            c, r = n["at"]
            x, y = self.col_x[c], self.row_y[r]
            n["_box"] = (x, y, NODE_W, n["_h"])
            cx = x + NODE_W / 2
            n["_icon"] = (cx - ICON / 2, y, ICON, ICON)
            n["_cx"], n["_cy"] = cx, y + ICON / 2
            tw = max([text_w(l, 12, True) for l in n["_lines"]] + [text_w(l, 10.5) for l in n["_sub"]] + [ICON])
            n["_obs"] = [n["_icon"] if n.get("icon") else (x + 10, y, NODE_W - 20, ICON),
                         (cx - tw / 2 - 2, y + ICON + 2, tw + 4, n["_h"] - ICON - 2)]
            half = ICON / 2 if n.get("icon") else NODE_W / 2 - 10     # an external box is wider than an icon
            n["_ports"] = {
                "L": (cx - half - 3, y + ICON / 2), "R": (cx + half + 3, y + ICON / 2),
                "T": (cx, y - 3), "B": (cx, y + n["_h"] + 4),
            }

    def _groups(self):
        def box(gid):
            g = self.s.groups[gid]
            if "_box" in g:
                return g["_box"]
            xs, ys, xe, ye = [], [], [], []
            for m in g.get("contains", []):
                bx, by, bw, bh = box(m) if m in self.s.groups else self.s.nodes[m]["_box"]
                xs.append(bx); ys.append(by); xe.append(bx + bw); ye.append(by + bh)
            st = {**GROUPS[g["style"]], **{k: g[k] for k in ("icon",) if k in g}}
            need = (34 if st["icon"] else 8) + text_w(g.get("label", gid), 12.5, True) + 10
            w = max(max(xe) - min(xs) + 2 * PAD, need)
            g["_box"] = (min(xs) - PAD, min(ys) - PAD - HEAD, w, max(ye) - min(ys) + 2 * PAD + HEAD)
            return g["_box"]
        for gid in self.s.groups:
            box(gid)
        right = max([g["_box"][0] + g["_box"][2] for g in self.s.groups.values()] + [self.width - MARGIN])
        bottom = max([g["_box"][1] + g["_box"][3] for g in self.s.groups.values()] + [self.body_bottom])
        self.width = right + MARGIN
        self.height = bottom + MARGIN


# ---------------------------------------------------------------- routing
def _inside(px, py, box, m=0):
    x, y, w, h = box
    return x - m < px < x + w + m and y - m < py < y + h + m


def _seg_hits(a, b, box):
    """True when the axis-aligned segment a-b passes through box."""
    x, y, w, h = box
    if a[1] == b[1]:
        lo, hi = sorted((a[0], b[0]))
        return y < a[1] < y + h and lo < x + w and hi > x
    lo, hi = sorted((a[1], b[1]))
    return x < a[0] < x + w and lo < y + h and hi > y


class Router:
    def __init__(self, spec: Spec, lay: Layout):
        self.s, self.l = spec, lay
        self.used: dict[tuple, int] = {}
        self.segs: list[tuple] = []      # segments of the edges routed so far

    def _gutter_x(self, c_from, c_to):
        """x of the vertical channel just before column c_to, on the side facing c_from."""
        if c_to > c_from:
            return self.l.col_x[c_to] - (self.l.col_x[c_to] - (self.l.col_x[c_to - 1] + NODE_W)) / 2
        return self.l.col_x[c_to] + NODE_W + (self.l.col_x[c_to + 1] - (self.l.col_x[c_to] + NODE_W)) / 2

    def _gutter_y(self, r_from, r_to):
        if r_to > r_from:
            return self.l.row_y[r_to] - (self.l.row_y[r_to] - (self.l.row_y[r_to - 1] + self.l.row_h[r_to - 1])) / 2
        return self.l.row_y[r_to] + self.l.row_h[r_to] + (
            (self.l.row_y[r_to + 1] if r_to + 1 < self.l.nrows else self.l.row_y[r_to] + self.l.row_h[r_to] + 2 * GAP_Y)
            - (self.l.row_y[r_to] + self.l.row_h[r_to])) / 2

    def _offset(self, key):
        n = self.used.get(key, 0)
        self.used[key] = n + 1
        return ((n + 1) // 2) * 8 * (1 if n % 2 else -1)

    @staticmethod
    def _nudged(ports, d):
        """The ports moved d px along their side: L/R up or down, T/B left or right."""
        return {k: ((x, y + d) if k in "LR" else (x + d, y)) for k, (x, y) in ports.items()}

    def _candidates(self, a, b, nudge=0):
        (sc, sr), (tc, tr) = a["at"], b["at"]
        pa, pb = self._nudged(a["_ports"], nudge), self._nudged(b["_ports"], nudge)
        cands = []
        if sr == tr:
            if tc > sc:
                cands.append(("h", [pa["R"], pb["L"]]))
            else:
                cands.append(("h", [pa["L"], pb["R"]]))
            low = max(pa["B"][1], pb["B"][1]) + 12          # just under the labels: stays inside the groups
            gy = max(self._gutter_y(sr, sr + 1), low) if sr + 1 < self.l.nrows else low
            cands.append(("u", [pa["B"], (pa["B"][0], gy), (pb["B"][0], gy), pb["B"]]))
        elif sc == tc:
            if tr > sr:
                cands.append(("v", [pa["B"], pb["T"]]))
            else:
                cands.append(("v", [pa["T"], pb["B"]]))
            gx = self._gutter_x(sc + 1 if sc + 1 < self.l.ncols else sc - 1, sc)
            side = "R" if gx > a["_cx"] else "L"
            cands.append(("c", [pa[side], (gx, pa[side][1]), (gx, pb[side][1]), pb[side]]))
        else:
            right, down = tc > sc, tr > sr
            # horizontal first: leave by the side, turn in the gutter before the target column
            gx = self._gutter_x(sc, tc)
            s_port = pa["R" if right else "L"]
            t_port = pb["L" if right else "R"]
            cands.append(("hv", [s_port, (gx, s_port[1]), (gx, t_port[1]), t_port]))
            # vertical first: leave by the bottom or top, turn in the gutter before the target row
            gy = self._gutter_y(sr, tr)
            s_port = pa["B" if down else "T"]
            t_port = pb["T" if down else "B"]
            cands.append(("vh", [s_port, (s_port[0], gy), (t_port[0], gy), t_port]))
            # L shapes: one bend
            t1, s2 = pb["T" if down else "B"], pa["B" if down else "T"]
            cands.append(("L1", [pa["R" if right else "L"], (t1[0], pa["R" if right else "L"][1]), t1]))
            cands.append(("L2", [s2, (s2[0], pb["L" if right else "R"][1]), pb["L" if right else "R"]]))
        return cands

    def _cost(self, pts, a, b):
        """(nodes crossed, segments shared with earlier edges, edges crossed)."""
        hits = shared = crossed = 0
        for n in self.s.nodes.values():
            for p, q in zip(pts, pts[1:]):
                for k, ob in enumerate(n["_obs"]):
                    if (n is a or n is b) and k == 0:
                        continue          # an edge may touch its own icon
                    if _seg_hits(p, q, ob):
                        hits += 1
        for p, q in zip(pts, pts[1:]):
            for u, v in self.segs:
                if _collinear_overlap(p, q, u, v):
                    shared += 1
                elif _crosses(p, q, u, v):
                    crossed += 1
        return hits, shared, crossed

    def route(self, e):
        a, b = self.s.nodes[e["from"]], self.s.nodes[e["to"]]
        scored = []
        for rank, nudge in enumerate((0, 12, -12, 20, -20)):
            cands = self._candidates(a, b, nudge)
            if e.get("via"):
                cands = [c for c in cands if c[0] == e["via"]] or cands
            scored += [(self._cost(p, a, b), rank, len(p), i, k, p) for i, (k, p) in enumerate(cands)]
            best = min(scored)
            if best[0][:2] == (0, 0):     # no node crossed, no shared segment: stop at the smallest nudge
                break
        (hits, shared, _), _, _, _, kind, pts = min(scored)
        pts = [list(p) for p in pts]
        # spread parallel edges that share a channel
        if kind in ("hv", "c") and len(pts) == 4:
            off = self._offset(("x", round(pts[1][0])))
            pts[1][0] += off; pts[2][0] += off
        elif kind in ("vh", "u") and len(pts) == 4:
            off = self._offset(("y", round(pts[1][1])))
            pts[1][1] += off; pts[2][1] += off
        if hits:
            self.s.warn(f"edge {e['from']} -> {e['to']} passes through {hits} node(s); move a node or set \"via\"")
        if shared:
            self.s.warn(f"edge {e['from']} -> {e['to']} runs on top of another edge; move a node or set \"via\"")
        e["_pts"] = [tuple(p) for p in pts]
        self.segs += list(zip(e["_pts"], e["_pts"][1:]))
        e["_route"] = kind
        return e["_pts"]


def _collinear_overlap(p, q, u, v, near=16):
    """Two parallel segments closer than `near` px that run side by side: they read as one line."""
    if abs(p[1] - q[1]) < 0.5 and abs(u[1] - v[1]) < 0.5 and abs(p[1] - u[1]) < near:
        lo, hi = sorted((p[0], q[0])); ulo, uhi = sorted((u[0], v[0]))
        return min(hi, uhi) - max(lo, ulo) > 3
    if abs(p[0] - q[0]) < 0.5 and abs(u[0] - v[0]) < 0.5 and abs(p[0] - u[0]) < near:
        lo, hi = sorted((p[1], q[1])); ulo, uhi = sorted((u[1], v[1]))
        return min(hi, uhi) - max(lo, ulo) > 3
    return False


def _crosses(p, q, u, v):
    """A horizontal and a vertical segment cross strictly inside both."""
    if abs(p[1] - q[1]) < 0.5 and abs(u[0] - v[0]) < 0.5:
        h, w = (p, q), (u, v)
    elif abs(p[0] - q[0]) < 0.5 and abs(u[1] - v[1]) < 0.5:
        h, w = (u, v), (p, q)
    else:
        return False
    x, (y0, y1) = w[0][0], sorted((w[0][1], w[1][1]))
    y, (x0, x1) = h[0][1], sorted((h[0][0], h[1][0]))
    return x0 + 1 < x < x1 - 1 and y0 + 1 < y < y1 - 1


def label_size(e):
    lab, step = e.get("label", ""), e.get("step")
    return (text_w(lab, 10.5) if lab else 0) + (8 if lab else 0) + (18 if step else 0), 18


def group_header(g):
    st = {**GROUPS[g["style"]], **{k: g[k] for k in ("icon",) if k in g}}
    x, y, w, _ = g["_box"]
    return (x, y, (34 if st["icon"] else 8) + text_w(g.get("label", ""), 12.5, True) + 4, 26)


def group_borders(g, t=3):
    x, y, w, h = g["_box"]
    return [(x - t, y - t, w + 2 * t, 2 * t), (x - t, y + h - t, w + 2 * t, 2 * t),
            (x - t, y - t, 2 * t, h + 2 * t), (x + w - t, y - t, 2 * t, h + 2 * t)]


def place_labels(spec):
    """Put each step disc and label on its own edge where it covers no node, group border, group
    title, other label or other edge. Sets e["_lab"] = (x, y, w, h); warns when no spot is clean."""
    placed = []
    obstacles = [ob for n in spec.nodes.values() for ob in n["_obs"]]
    for g in spec.groups.values():
        obstacles += group_borders(g) + [group_header(g)]
    for e in spec.edges:
        if not e.get("label") and not e.get("step"):
            continue
        w, h = label_size(e)
        others = [(u, v) for f in spec.edges if f is not e for u, v in zip(f["_pts"], f["_pts"][1:])]
        segs = sorted(zip(e["_pts"], e["_pts"][1:]),
                      key=lambda pq: -(abs(pq[0][0] - pq[1][0]) + abs(pq[0][1] - pq[1][1])))
        best = None
        for rank, (p, q) in enumerate(segs):
            ln = abs(p[0] - q[0]) + abs(p[1] - q[1])
            room = (w if p[1] == q[1] else h) + 16
            if ln < room and rank:
                continue
            for k, t in enumerate((0.5, 0.35, 0.65, 0.22, 0.78)):
                x, y = p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t
                box = (x - w / 2, y - h / 2, w, h)
                bad = sum(_overlap(box, ob) for ob in obstacles) + sum(_overlap(box, ob) for ob in placed)
                bad += sum(_seg_hits(u, v, box) for u, v in others)
                if best is None or (bad, rank, k) < best[:3]:
                    best = (bad, rank, k, box)
                if bad == 0:
                    break
            if best[0] == 0:
                break
        e["_lab"] = best[3]
        placed.append(best[3])
        if best[0]:
            spec.warn(f"the label or step disc of edge {e['from']} -> {e['to']} covers a node, a border, a "
                      f"group title or another edge; shorten the label, or move a node")


# ---------------------------------------------------------------- lint
def lint(spec: Spec, lay: Layout):
    for gid, g in spec.groups.items():
        mine = set(spec.members(gid))
        for nid, n in spec.nodes.items():
            if nid not in mine and _inside(n["_cx"], n["_cy"], g["_box"]):
                spec.warn(f"node '{nid}' sits inside group '{gid}' but is not a member; move it or add it to the group")
    gl = list(spec.groups.items())
    for i, (ga, a) in enumerate(gl):
        for gb, b in gl[i + 1:]:
            if ga in _ancestors(spec, gb) or gb in _ancestors(spec, ga):
                continue
            ax, ay, aw, ah = a["_box"]; bx, by, bw, bh = b["_box"]
            if ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah:
                spec.warn(f"groups '{ga}' and '{gb}' overlap; give them separate columns or rows")
    for gid, g in spec.groups.items():
        hb = group_header(g)
        if hb[2] > g["_box"][2]:
            spec.warn(f"the label of group '{gid}' is wider than its box; shorten it")
        for e in spec.edges:
            if any(_seg_hits(p, q, hb) for p, q in zip(e["_pts"], e["_pts"][1:])):
                spec.warn(f"edge {e['from']} -> {e['to']} crosses the title of group '{gid}'; move a node")


def _overlap(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def _ancestors(spec, gid):
    out = []
    while gid in spec.parent:
        gid = spec.parent[gid]
        out.append(gid)
    return out


def fit_groups(spec):
    """Grow each group, innermost first, so it encloses the edges between its own members."""
    for gid in sorted(spec.groups, key=spec.depth, reverse=True):
        g = spec.groups[gid]
        mine = set(spec.members(gid))
        x, y, w, h = g["_box"]
        x1, y1 = x + w, y + h
        for e in spec.edges:
            if e["from"] in mine and e["to"] in mine:
                for px, py in e["_pts"]:
                    x, x1 = min(x, px - 12), max(x1, px + 12)
                    y1 = max(y1, py + 12)
        for m in g.get("contains", []):
            if m in spec.groups:
                cx, cy, cw, ch = spec.groups[m]["_box"]
                x, x1, y1 = min(x, cx - PAD), max(x1, cx + cw + PAD), max(y1, cy + ch + PAD)
        g["_box"] = (x, y, x1 - x, y1 - y)


def finish_canvas(spec, lay):
    """Grow the canvas to every routed point and label, then reserve the footer: legend, then credit."""
    xs = [p[0] for e in spec.edges for p in e["_pts"]]
    xs += [e["_lab"][0] + e["_lab"][2] for e in spec.edges if "_lab" in e]
    ys = [p[1] for e in spec.edges for p in e["_pts"]]
    ys += [e["_lab"][1] + e["_lab"][3] for e in spec.edges if "_lab" in e]
    ys += [g["_box"][1] + g["_box"][3] for g in spec.groups.values()]
    xs += [g["_box"][0] + g["_box"][2] for g in spec.groups.values()]
    body = max([lay.height - MARGIN] + [y + 6 for y in ys])
    used = [k for k in EDGE_KINDS if any(e["kind"] == k for e in spec.edges)]
    legend_w = sum(44 + text_w(EDGE_KINDS[k][3], 10.5) for k in used)
    credit_w = text_w(credit_line(spec), 9.5)
    lay.width = max(lay.width, max(xs + [0]) + MARGIN, legend_w + 2 * MARGIN, credit_w + 2 * MARGIN)
    lay.legend_y = body + 26
    lay.credit_y = lay.legend_y + (16 if used else 0)
    lay.W, lay.H = round(lay.width), round(lay.credit_y + 14)


# ---------------------------------------------------------------- SVG
def render_svg(spec: Spec, lay: Layout, pfx: str = "cd") -> str:
    """pfx namespaces the marker ids, so two diagrams can sit in one HTML page."""
    W, H = lay.W, lay.H
    fid = "fig-" + pfx[3:]
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" id="{fid}" data-generated="cloud_diagram" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         f'font-family="{FONT}" role="img" aria-label="{esc(spec.title or "Deployment diagram")}">',
         f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>', "<defs>"]
    for kind, (col, _, _, _) in EDGE_KINDS.items():
        o.append(f'<marker id="{pfx}-arr-{kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
                 f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{col}"/></marker>')
    o.append("</defs>")
    if spec.title:
        o.append(f'<text x="{MARGIN}" y="{MARGIN + 18}" font-size="17" font-weight="600" fill="{INK}">{esc(spec.title)}</text>')

    for gid in sorted(spec.groups, key=spec.depth):
        g = spec.groups[gid]
        st = {**GROUPS[g["style"]], **{k: g[k] for k in ("stroke", "fill", "dash", "icon") if k in g}}
        x, y, w, h = g["_box"]
        dash = f' stroke-dasharray="{st["dash"]}"' if st["dash"] else ""
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{st["fill"]}" stroke="{st["stroke"]}" stroke-width="1.5"{dash}/>')
        tx = x + 8
        if st["icon"]:
            ic = spec.icon(st["icon"])
            o.append(f'<image x="{x}" y="{y}" width="26" height="26" href="{ic["uri"]}"/>')
            tx = x + 34
        o.append(f'<text x="{tx}" y="{y + 18}" font-size="12.5" font-weight="600" fill="{st["stroke"] if st["stroke"] != "#FFFFFF" else INK}">{esc(g.get("label", gid))}</text>')

    for e in spec.edges:
        col, dash, wd, _ = EDGE_KINDS[e["kind"]]
        d = "M" + " L".join(f"{p[0]:.1f},{p[1]:.1f}" for p in e["_pts"])
        da = f' stroke-dasharray="{dash}"' if dash else ""
        o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{wd}"{da} stroke-linejoin="round" marker-end="url(#{pfx}-arr-{e["kind"]})"/>')

    for n in spec.nodes.values():
        x, y, w, h = n["_icon"]
        if n.get("icon"):
            o.append(f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{spec.icons[n["icon"]]["uri"]}"/>')
        else:
            bx = n["_box"][0] + 10
            o.append(f'<rect x="{bx}" y="{y}" width="{NODE_W - 20}" height="{ICON}" rx="8" fill="#F1F3F6" stroke="#9AA5B1" stroke-width="1.2"/>')
            o.append(f'<text x="{n["_cx"]}" y="{y + ICON / 2 + 4}" font-size="11" fill="{MUTED}" text-anchor="middle">External</text>')
        ty = y + ICON + 6 + 11
        for line in n["_lines"]:
            o.append(f'<text x="{n["_cx"]}" y="{ty}" font-size="12" font-weight="600" fill="{INK}" text-anchor="middle">{esc(line)}</text>')
            ty += LINE
        for line in n["_sub"]:
            o.append(f'<text x="{n["_cx"]}" y="{ty - 1}" font-size="10.5" fill="{MUTED}" text-anchor="middle">{esc(line)}</text>')
            ty += SUB_LINE

    for e in spec.edges:
        if not e.get("label") and not e.get("step"):
            continue
        col = EDGE_KINDS[e["kind"]][0]
        x0, y0, w, _ = e["_lab"]
        y = y0 + 9
        lab = e.get("label", "")
        step = e.get("step")
        o.append(f'<rect x="{x0:.1f}" y="{y - 9:.1f}" width="{w:.1f}" height="18" rx="3" fill="#FFFFFF" opacity="0.94"/>')
        if step:
            o.append(f'<circle cx="{x0 + 9:.1f}" cy="{y:.1f}" r="8" fill="{col}"/>'
                     f'<text x="{x0 + 9:.1f}" y="{y + 3.5:.1f}" font-size="10" font-weight="700" fill="#FFFFFF" text-anchor="middle">{esc(str(step))}</text>')
        if lab:
            o.append(f'<text x="{x0 + (18 if step else 0) + 4:.1f}" y="{y + 3.5:.1f}" font-size="10.5" fill="{col}">{esc(lab)}</text>')

    # legend + credit
    used = [k for k in EDGE_KINDS if any(e["kind"] == k for e in spec.edges)]
    lx, ly = MARGIN, lay.legend_y
    for k in used:
        col, dash, wd, text = EDGE_KINDS[k]
        da = f' stroke-dasharray="{dash}"' if dash else ""
        o.append(f'<line x1="{lx}" y1="{ly - 4}" x2="{lx + 26}" y2="{ly - 4}" stroke="{col}" stroke-width="{wd}"{da}/>')
        o.append(f'<text x="{lx + 32}" y="{ly}" font-size="10.5" fill="{MUTED}">{esc(text)}</text>')
        lx += 44 + text_w(text, 10.5)
    credit = credit_line(spec)
    if credit:
        o.append(f'<text x="{MARGIN}" y="{lay.credit_y}" font-size="9.5" fill="{MUTED}">{esc(credit)}</text>')
    o.append("</svg>")
    return "\n".join(o)


def edge_text(e) -> str:
    """'3. conditional write', '3' or 'conditional write': the plain-text label of an edge."""
    step, lab = e.get("step"), e.get("label", "")
    return f"{step}. {lab}" if step and lab else str(step or lab)


def credit_line(spec: Spec) -> str:
    packs = []
    for ent in spec.icons.values():
        c = PACK_CREDIT.get(ent["pack"], ent["pack"])
        if c not in packs:
            packs.append(c)
    return ("Icons: " + "; ".join(packs)) if packs else ""


# ---------------------------------------------------------------- draw.io
def render_drawio(spec: Spec, lay: Layout) -> str:
    cells, nid = [], [2]

    def new_id():
        nid[0] += 1
        return f"c{nid[0]}"

    def cell(value, style, x, y, w, h, vertex=True, extra=""):
        cid = new_id()
        kind = 'vertex="1"' if vertex else 'edge="1"'
        cells.append(f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" {kind} parent="1"{extra}>'
                     f'<mxGeometry x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" as="geometry"/></mxCell>')
        return cid

    def img_style(uri_b64):
        # draw.io splits a style on ';', so the data URI drops ';base64' (draw.io's own format)
        return f"shape=image;aspect=fixed;imageAspect=1;image=data:image/svg+xml,{uri_b64};"

    if spec.title:
        cell(f"<b>{esc(spec.title)}</b>", "text;html=1;align=left;verticalAlign=middle;fontSize=17;fontColor=#1B2430;",
             MARGIN, MARGIN, 600, 26)
    for gid in sorted(spec.groups, key=spec.depth):
        g = spec.groups[gid]
        st = {**GROUPS[g["style"]], **{k: g[k] for k in ("stroke", "fill", "dash", "icon") if k in g}}
        x, y, w, h = g["_box"]
        dash = f"dashed=1;dashPattern={st['dash'].replace(' ', ' ')};" if st["dash"] else "dashed=0;"
        label = f"<b>{esc(g.get('label', gid))}</b>"
        cell(label, f"rounded=0;whiteSpace=wrap;html=1;fillColor={st['fill']};strokeColor={st['stroke']};strokeWidth=1.5;{dash}"
                    f"verticalAlign=top;align=left;spacingLeft={34 if st['icon'] else 8};spacingTop=0;fontSize=12.5;"
                    f"fontColor={st['stroke']};container=0;pointerEvents=0;", x, y, w, h)
        if st["icon"]:
            cell("", img_style(spec.icon(st["icon"])["b64"]) + "editable=0;", x, y, 26, 26)
    ids = {}
    for n in spec.nodes.values():
        x, y, w, h = n["_icon"]
        label = "<b>" + "<br>".join(esc(l) for l in n["_lines"]) + "</b>"
        if n["_sub"]:
            label += '<br><font style="font-size:10.5px" color="#5B6676">' + "<br>".join(esc(l) for l in n["_sub"]) + "</font>"
        # one vertex = the icon plus the label under it, so a port below the label is the vertex edge
        asp = spec.icons[n["icon"]]["aspect"] if n.get("icon") else 1.0     # never distort a mark
        iw, ih = (ICON, ICON * asp) if asp <= 1 else (ICON / asp, ICON)
        text = ("shape=label;html=1;fillColor=none;strokeColor=none;verticalAlign=bottom;align=center;"
                f"spacing=0;spacingBottom=2;fontSize=12;fontColor=#1B2430;imageAlign=center;imageVerticalAlign=top;"
                f"imageWidth={iw:.1f};imageHeight={ih:.1f};")
        nx, nw = _vx(n)
        if n.get("icon"):
            ids[n["id"]] = cell(label, text + f"image=data:image/svg+xml,{spec.icons[n['icon']]['b64']};", nx, y, nw, n["_h"] + 4)
        else:
            cell("External", "rounded=1;arcSize=14;html=1;fillColor=#F1F3F6;strokeColor=#9AA5B1;fontSize=11;"
                 "fontColor=#5B6676;editable=1;", nx, y, nw, ICON)
            ids[n["id"]] = cell(label, text, nx, y, nw, n["_h"] + 4)
    for e in spec.edges:
        col, dash, wd, _ = EDGE_KINDS[e["kind"]]
        a, b = spec.nodes[e["from"]], spec.nodes[e["to"]]
        pts = e["_pts"]
        ex = _rel(pts[0], a)
        tx = _rel(pts[-1], b)
        lab = edge_text(e)
        style = (f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;html=1;endArrow=block;endFill=1;"
                 f"strokeColor={col};strokeWidth={wd};fontColor={col};fontSize=10.5;labelBackgroundColor=#FFFFFF;"
                 + (f"dashed=1;dashPattern={dash};" if dash else "")
                 + f"exitX={ex[0]:.3f};exitY={ex[1]:.3f};exitPerimeter=0;"
                 + f"entryX={tx[0]:.3f};entryY={tx[1]:.3f};entryPerimeter=0;")
        cid = new_id()
        way = "".join(f'<mxPoint x="{p[0]:.1f}" y="{p[1]:.1f}"/>' for p in pts[1:-1])
        cells.append(f'<mxCell id="{cid}" value="{esc(esc(lab))}" style="{style}" edge="1" parent="1" '
                     f'source="{ids[e["from"]]}" target="{ids[e["to"]]}"><mxGeometry relative="1" as="geometry">'
                     + (f'<Array as="points">{way}</Array>' if way else "") + "</mxGeometry></mxCell>")
    credit = credit_line(spec)
    if credit:
        cell(esc(credit), "text;html=1;align=left;fontSize=9.5;fontColor=#5B6676;", MARGIN,
             lay.credit_y - 12, max(520, text_w(credit, 9.5) + 20), 18)
    W, H = lay.W, lay.H
    return ('<mxfile host="tech-design-doc" type="device">\n'
            f'<diagram id="deployment" name="{esc(spec.title or "Deployment")}">'
            f'<mxGraphModel dx="{W}" dy="{H}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
            f'fold="1" page="1" pageScale="1" pageWidth="{W}" pageHeight="{H}" math="0" shadow="0"><root>'
            '<mxCell id="0"/><mxCell id="1" parent="0"/>\n' + "\n".join(cells) +
            "\n</root></mxGraphModel></diagram></mxfile>\n")


def _vx(n):
    """x and width of a node's draw.io vertex: the icon (or the external box) column."""
    return (n["_icon"][0], ICON) if n.get("icon") else (n["_box"][0] + 10, NODE_W - 20)


def _rel(p, n):
    """(relX, relY, 0) of a port point against the draw.io vertex (icon + label)."""
    x, w = _vx(n)
    y, h = n["_icon"][1], n["_h"] + 4
    rx = min(max((p[0] - x) / w, 0), 1)
    ry = min(max((p[1] - y) / h, 0), 1)
    return rx, ry, 0.0


# ---------------------------------------------------------------- Mermaid + Markdown
def render_mermaid(spec: Spec) -> str:
    direction = spec.raw.get("mermaid_direction", "LR")
    out = [f"flowchart {direction}"]
    sid = lambda s: "n_" + "".join(ch if ch.isalnum() else "_" for ch in s)
    q = lambda s: str(s).replace("&", "#amp;").replace('"', "#quot;").replace("<", "#lt;").replace(">", "#gt;")

    def node_line(n, ind):
        label = q(n["label"]) + (f"<br/><small>{q(n['sub'])}</small>" if n.get("sub") else "")
        shape = ('["', '"]') if n.get("icon") else ('(["', '"])')
        return f'{ind}{sid(n["id"])}{shape[0]}{label}{shape[1]}'

    def emit(gid, ind):
        g = spec.groups[gid]
        out.append(f'{ind}subgraph {sid(gid)}["{q(g.get("label", gid))}"]')
        for m in g.get("contains", []):
            if m in spec.groups:
                emit(m, ind + "  ")
            else:
                out.append(node_line(spec.nodes[m], ind + "  "))
        out.append(f"{ind}end")

    for n in spec.nodes.values():
        if n["id"] not in spec.parent:
            out.append(node_line(n, "  "))
    for gid in spec.groups:
        if gid not in spec.parent:
            emit(gid, "  ")
    arrow = {"main": "-->", "async": "-.->", "failure": "-.->", "monitor": "-.->"}
    for e in spec.edges:
        lab = q(edge_text(e))
        a = arrow[e["kind"]]
        out.append(f'  {sid(e["from"])} {a}' + (f'|"{lab}"|' if lab else "") + f' {sid(e["to"])}')
    return "\n".join(out)


def render_md(spec: Spec, out: Path, has_png: bool, prefix: str) -> str:
    img = prefix + out.name + (".png" if has_png else ".svg")
    dio = prefix + out.name + ".drawio"
    return "\n".join([
        f"![{spec.title or 'Deployment diagram'}]({img})",
        "",
        f"Editable source: [{out.name}.drawio]({dio}) "
        "(attach it to the Confluence page and open it with the draw.io macro).",
        "",
        f"*{credit_line(spec)}.*",
        "",
    ])


# ---------------------------------------------------------------- PNG
def find_browser() -> str | None:
    env = os.environ.get("CHROME")
    cands = [env] if env else []
    cands += [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
    for c in cands:
        if c and Path(c).exists():
            return c
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome", "msedge", "microsoft-edge"):
        if shutil.which(name):
            return shutil.which(name)
    return None


def render_png(svg_path: Path, png_path: Path, w: int, h: int, page: bool = False) -> bool:
    """Screenshot svg_path at 2x. page=True: svg_path is already an HTML page to shoot as it is."""
    browser = find_browser()
    if not browser:
        print("  png: skipped, no Chrome or Edge found (set CHROME=<path>)")
        return False
    with tempfile.TemporaryDirectory() as prof:
        if page:
            page = svg_path
        else:
            page = Path(prof) / "page.html"
            page.write_text(f'<!doctype html><html><body style="margin:0;background:#fff">'
                            f'<img src="{svg_path.resolve().as_uri()}" width="{w}" height="{h}"></body></html>',
                            encoding="utf-8")
        cmd = [browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
               f"--user-data-dir={prof}", "--force-device-scale-factor=2", f"--window-size={w},{h}",
               f"--screenshot={png_path.resolve()}", page.resolve().as_uri()]
        try:
            subprocess.run(cmd, capture_output=True, timeout=90)
        except (OSError, subprocess.TimeoutExpired) as err:
            print(f"  png: failed ({err})")
            return False
    ok = png_path.exists() and png_path.stat().st_size > 0
    if not ok:
        print("  png: the browser wrote no file")
    return ok


# ---------------------------------------------------------------- main
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec", type=Path)
    ap.add_argument("--out", type=Path, help="output path without extension (default: next to the spec)")
    ap.add_argument("--no-png", action="store_true")
    ap.add_argument("--strict", action="store_true", help="exit 2 when lint prints a warning")
    ap.add_argument("--link-prefix", help="path from the doc to the images, used in <out>.md (default: "
                    "'img/' when the output folder is named img, images, assets or diagrams, else '')")
    a = ap.parse_args(argv)

    try:
        raw = json.loads(a.spec.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        print(f"cannot read {a.spec}: {err}", file=sys.stderr)
        return 1
    try:
        spec = Spec(raw, iconlib.load_index())
    except KeyError as err:
        print(err.args[0], file=sys.stderr)
        return 1
    lay = Layout(spec)
    router = Router(spec, lay)
    order = list(EDGE_KINDS)
    for e in sorted(spec.edges, key=lambda e: order.index(e["kind"])):
        router.route(e)
    fit_groups(spec)
    place_labels(spec)
    lint(spec, lay)
    finish_canvas(spec, lay)

    out = a.out or a.spec.with_name(a.spec.name[:-5] if a.spec.name.endswith(".json") else a.spec.name)
    if out.name.endswith(".spec"):
        out = out.with_name(out.name[:-5])
    out.parent.mkdir(parents=True, exist_ok=True)
    path = lambda ext: out.with_name(out.name + ext)       # keeps dots in a name such as deploy.v2
    pfx = "cd-" + "".join(ch if ch.isalnum() else "-" for ch in out.name.lower())
    path(".svg").write_text(render_svg(spec, lay, pfx), encoding="utf-8")
    path(".drawio").write_text(render_drawio(spec, lay), encoding="utf-8")
    path(".mmd").write_text(render_mermaid(spec) + "\n", encoding="utf-8")
    W, H = lay.W, lay.H
    has_png = False if a.no_png else render_png(path(".svg"), path(".png"), W, H)
    prefix = a.link_prefix
    if prefix is None:
        folder = out.resolve().parent.name
        prefix = folder + "/" if folder.lower() in ("img", "images", "assets", "diagrams") else ""
    path(".md").write_text(render_md(spec, out, has_png, prefix), encoding="utf-8")
    if not a.no_png and find_browser():        # the measured check, as the reader sees the SVG
        from check_diagrams import check as measured_check
        _, _, found = measured_check(path(".svg"), None)
        for line in found[1:]:
            if line.startswith(("FAIL", "WARN")):
                spec.warn("measured: " + line.split(": ", 1)[-1] if ": " in line else line)

    print(f"wrote {out}.svg, .drawio, .mmd, .md" + (", .png" if has_png else "") + f"  ({W}x{H}px, "
          f"{len(spec.nodes)} nodes, {len(spec.groups)} groups, {len(spec.edges)} edges, {len(spec.icons)} official icons)")
    for wmsg in spec.warnings:
        print(f"  lint: {wmsg}")
    return 2 if (a.strict and spec.warnings) else 0


if __name__ == "__main__":
    sys.exit(main())
