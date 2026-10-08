"""Check every diagram in a deliverable for spacing and overlap defects, as the reader will see it.

    python check_diagrams.py design.md                  # Mermaid blocks + linked .svg diagrams
    python check_diagrams.py design.built.html          # every figure in a built HTML page
    python check_diagrams.py img/deploy.svg             # one SVG
    python check_diagrams.py design.md --png _check     # also write a PNG of each Mermaid diagram

It renders each diagram in headless Chrome or Edge (Mermaid from the bundled vendor-js/mermaid.min.js,
offline) and measures the drawn boxes, so it sees what the reader sees. See diagram_check.js for
the rules. FAIL lines are defects: fix the source (the Mermaid block, figures/NAME.json, the cloud
spec) and run again until it prints "0 FAIL". WARN lines are worth a look in the PNG.

Exit code: 0 clean, 1 at least one FAIL (or a Mermaid block that does not parse), 2 usage error.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = Path(__file__).resolve().parent
CHECKER = HERE / "diagram_check.js"
MERMAID = HERE.parent / "vendor-js" / "mermaid.min.js"
sys.path.insert(0, str(HERE))
from cloud_diagram import find_browser, render_png  # noqa: E402

MERMAID_BLOCK = re.compile(r"^```mermaid[ \t]*\n(.*?)^```", re.S | re.M)
IMG_LINK = re.compile(r"!\[[^\]]*\]\(([^)\s]+)\)")
FREEZE = "<style>*{animation:none!important;transition:none!important}</style>"

RUNNER = """
<pre id="cd-result"></pre>
<script>@@CHECKER@@</script>
<script>
async function cdRun() {
  const out = [], errs = [];
  @@PREP@@
  const svgs = [...document.querySelectorAll('svg')].filter(s => !s.parentElement.closest('svg'))
    .filter(s => s.querySelectorAll('text,foreignObject,rect,path,line,circle,image,polygon').length >= 6);
  for (const s of svgs) {
    const name = s.id || s.getAttribute('aria-label') || s.closest('[id]')?.id || 'svg';
    try { out.push({name, ...checkSvg(s)}); } catch (e) { errs.push(name + ': ' + e.message); }
  }
  document.getElementById('cd-result').textContent = JSON.stringify({out, errs, mermaid: window.cdMermaid || []});
}
window.addEventListener('load', () => setTimeout(() => cdRun(), 400));
</script>
"""

MERMAID_PREP = """
  window.cdMermaid = [];
  if (window.mermaid) {
    // SVG text labels (not HTML in foreignObject): exact boxes to measure, valid XML to save
    mermaid.initialize({startOnLoad: false, securityLevel: 'loose', theme: 'default', htmlLabels: false,
                        flowchart: {htmlLabels: false}, state: {htmlLabels: false}});
    const blocks = JSON.parse(document.getElementById('cd-src').textContent);
    for (let i = 0; i < blocks.length; i++) {
      const host = document.createElement('div');
      host.id = 'mermaid-' + (i + 1); host.style.margin = '24px';
      document.body.appendChild(host);
      try {
        const {svg} = await mermaid.render('cd-m' + (i + 1), blocks[i]);
        host.innerHTML = svg;
        window.cdMermaid.push({i: i + 1, ok: true, svg: host.innerHTML});
      } catch (e) {
        window.cdMermaid.push({i: i + 1, ok: false, error: String(e.message || e).split('\\n').slice(0, 3).join(' ')});
        host.remove();
      }
    }
  }
"""


def runner(prep: str) -> str:
    return RUNNER.replace("@@CHECKER@@", CHECKER.read_text(encoding="utf-8")).replace("@@PREP@@", prep)


def run_chrome(page: Path) -> dict:
    browser = find_browser()
    if not browser:
        raise SystemExit("check_diagrams.py needs Chrome or Edge (set CHROME=<path>)")
    with tempfile.TemporaryDirectory() as prof:
        cmd = [browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
               f"--user-data-dir={prof}", "--window-size=1280,900", "--virtual-time-budget=15000",
               "--run-all-compositor-stages-before-draw", "--dump-dom", page.resolve().as_uri()]
        r = subprocess.run(cmd, capture_output=True, timeout=240)
    dom = r.stdout.decode("utf-8", "replace")
    m = re.search(r'<pre id="cd-result">(.*?)</pre>', dom, re.S)
    if not m or not m.group(1).strip():
        raise SystemExit(f"the browser returned no result for {page.name} (exit {r.returncode})")
    return json.loads(html.unescape(m.group(1)))


def page_for_html(src: Path, tmp: Path) -> Path:
    text = src.read_text(encoding="utf-8")
    inject = FREEZE + runner("")
    text = re.sub(r"</body>", lambda _: inject + "</body>", text, count=1, flags=re.I) if re.search(
        r"</body>", text, re.I) else text + inject
    page = src.with_name(f".cd-check-{src.stem}.html")          # same folder: relative links still load
    page.write_text(text, encoding="utf-8")
    return page


def page_for_svgs(svgs: list[Path], mermaid: list[str], tmp: Path) -> Path:
    body = []
    for s in svgs:
        body.append(f'<div style="margin:24px">{re.sub(r"^\s*<[?]xml[^>]*>", "", s.read_text(encoding="utf-8"))}</div>')
    head = f'<script src="{MERMAID.as_uri()}"></script>' if mermaid else ""
    data = json.dumps(mermaid).replace("</", "<\\/")      # a "</script" inside a block cannot end the tag
    src = f'<script type="application/json" id="cd-src">{data}</script>'
    page = tmp / "check.html"
    page.write_text("<!doctype html><html><head><meta charset='utf-8'>" + head + FREEZE +
                    "</head><body style='margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif'>" +
                    "\n".join(body) + src + runner(MERMAID_PREP if mermaid else "") +
                    "</body></html>", encoding="utf-8")
    return page


def check(path: Path, png_dir: Path | None) -> tuple[int, int, list[str]]:
    lines, nfail, nwarn = [], 0, 0
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        made = None
        if path.suffix.lower() in (".html", ".htm"):
            made = page = page_for_html(path, tmp)
            blocks = []
        elif path.suffix.lower() == ".svg":
            page, blocks = page_for_svgs([path], [], tmp), []
        else:
            text = path.read_text(encoding="utf-8")
            blocks = [m.group(1) for m in MERMAID_BLOCK.finditer(text)]
            svgs = []
            for link in IMG_LINK.findall(text):
                p = (path.parent / link).resolve()
                svg = p.with_suffix(".svg")
                if svg.exists() and svg not in svgs:
                    svgs.append(svg)
            if not blocks and not svgs:
                return 0, 0, [f"{path.name}: no Mermaid block and no linked .svg diagram to check"]
            if blocks and not MERMAID.exists():
                raise SystemExit(f"missing {MERMAID}; download mermaid.min.js (see vendor-js/README.md)")
            page = page_for_svgs(svgs, blocks, tmp)
        try:
            res = run_chrome(page)
        finally:
            if made:
                made.unlink(missing_ok=True)
    for m in res.get("mermaid", []):
        if not m["ok"]:
            nfail += 1
            lines.append(f"FAIL  mermaid block {m['i']}: does not parse: {m['error']}")
        elif png_dir:
            png_dir.mkdir(parents=True, exist_ok=True)
            svg_text = m["svg"]
            vb = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', svg_text)
            w, h = (int(float(vb.group(1))) + 2, int(float(vb.group(2))) + 2) if vb else (1200, 800)
            svg_text = re.sub(r'style="max-width:[^"]*"', f'style="width:{w}px;height:{h}px"', svg_text, count=1)
            f = png_dir / f"{path.stem}-mermaid-{m['i']}.html"
            f.write_text("<!doctype html><meta charset='utf-8'><body style='margin:0;background:#fff'>"
                         + svg_text + "</body>", encoding="utf-8")
            if render_png(f, f.with_suffix(".png"), w, h, page=True):
                lines.append(f"      mermaid block {m['i']}: {f.with_suffix('.png')}")
    for e in res.get("errs", []):
        lines.append(f"WARN  could not check {e}")
        nwarn += 1
    for fig in res.get("out", []):
        name = fig["name"]
        name = f"mermaid block {name[4:]}" if re.fullmatch(r"cd-m\d+", name) else name
        for f in fig["fails"]:
            lines.append(f"FAIL  {name}: {f}")
        for w in fig["warns"]:
            lines.append(f"WARN  {name}: {w}")
        nfail += len(fig["fails"])
        nwarn += len(fig["warns"])
    n = len(res.get("out", []))
    lines.insert(0, f"{path.name}: {n} diagram{'s' if n != 1 else ''} checked, {nfail} FAIL, {nwarn} WARN")
    return nfail, nwarn, lines


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--png", type=Path, help="write a PNG of each Mermaid diagram into this folder")
    a = ap.parse_args(argv)
    total = 0
    for f in a.files:
        if not f.exists():
            print(f"no file {f}", file=sys.stderr)
            return 2
        nfail, _, lines = check(f, a.png)
        print("\n".join(lines))
        total += nfail
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
