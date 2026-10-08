"""Print a built page to an A4 PDF with headless Chrome, and render every PDF page to PNG on request.

Usage:  python tools/pdf.py <page.html> <out.pdf> [--png <dir>] [--max-pages N]

It prints the page count and the size of each page in mm.
  --png <dir>     render every page to <dir>/page-01.png ... with PyMuPDF (pip install pymupdf).
                  Without PyMuPDF the tool says so and skips the render.
  --max-pages N   exit 1 when the PDF has more than N pages (the brief: --max-pages 3).

A4 comes from the page itself: style.css holds @page{size:A4}. The tool warns when a page is not A4.
Headless Chrome fires beforeprint, so runtime.js opens every table twin before the print, as a
browser does. Chrome: env CHROME, else the usual install paths of Chrome and Edge, else PATH.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.dont_write_bytecode = True                   # no __pycache__ folder inside the kit
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
try:
    from build import BuildError, find_chrome, show  # one Chrome discovery for the whole kit
except ImportError:
    sys.exit("FAIL  pdf.py needs build.py one folder up (the kit folder). Copy the whole kit folder.")

PT_PER_MM = 72 / 25.4
A4_MM = (210.0, 297.0)


def pdf_pages(pdf: Path) -> list[tuple[float, float]]:
    """(width, height) in mm of every page: PyMuPDF when installed, else the PDF's MediaBox entries."""
    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf
        except ImportError:
            pymupdf = None
    if pymupdf:
        with pymupdf.open(pdf) as doc:
            return [(p.rect.width / PT_PER_MM, p.rect.height / PT_PER_MM) for p in doc]
    data = pdf.read_bytes()
    n = len(re.findall(rb"/Type\s*/Page(?![A-Za-z])", data))
    boxes = re.findall(rb"/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]", data)
    sizes = [((float(c) - float(a)) / PT_PER_MM, (float(d) - float(b)) / PT_PER_MM) for a, b, c, d in boxes]
    return sizes[:n] if len(sizes) >= n else sizes + [(0.0, 0.0)] * (n - len(sizes))


def render_png(pdf: Path, outdir: Path, dpi: int = 110) -> list[Path] | None:
    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf
        except ImportError:
            return None
    outdir.mkdir(parents=True, exist_ok=True)
    files = []
    with pymupdf.open(pdf) as doc:
        for i, page in enumerate(doc, 1):
            f = outdir / f"page-{i:02d}.png"
            page.get_pixmap(dpi=dpi).save(f)
            files.append(f)
    return files


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Print a built page to an A4 PDF with headless Chrome.")
    ap.add_argument("page", help="the built page (.html)")
    ap.add_argument("out", help="the PDF to write")
    ap.add_argument("--png", metavar="DIR", help="render every PDF page to DIR/page-NN.png")
    ap.add_argument("--max-pages", type=int, metavar="N", help="exit 1 when the PDF has more than N pages")
    a = ap.parse_args(argv)

    page, out = Path(a.page).resolve(), Path(a.out).resolve()
    if not page.is_file():
        print(f"FAIL  no file at {show(page)}")
        return 1
    try:
        chrome = find_chrome()
    except BuildError as e:
        print(f"FAIL  {e}")
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.unlink(missing_ok=True)                      # never report an old PDF as a new one
    profile = Path(tempfile.mkdtemp(prefix="tdd-pdf-"))
    try:
        r = subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--run-all-compositor-stages-before-draw",
             "--no-pdf-header-footer", "--virtual-time-budget=4000", f"--user-data-dir={profile}",
             "--no-first-run", "--no-default-browser-check", f"--print-to-pdf={out}", page.as_uri()],
            capture_output=True, timeout=300)
    except subprocess.TimeoutExpired:
        print("FAIL  Chrome did not finish the print within 300 s")
        return 1
    finally:
        for _ in range(10):
            shutil.rmtree(profile, ignore_errors=True)
            if not profile.exists():
                break
            time.sleep(0.3)
    if not out.is_file() or out.stat().st_size == 0:
        tail = r.stderr.decode("utf-8", errors="replace").strip().splitlines()[-6:]
        print(f"FAIL  Chrome wrote no PDF (exit code {r.returncode}). Its last messages:")
        print("\n".join("      " + t for t in tail))
        return 1

    sizes = pdf_pages(out)
    n = len(sizes)
    print(f"pdf: {show(out)}, {out.stat().st_size:,} bytes, {n} page{'s' if n != 1 else ''}")
    if len({(round(w), round(h)) for w, h in sizes}) == 1:
        w, h = sizes[0]
        print(f"  every page {w:.0f} x {h:.0f} mm")
    else:
        for i, (w, h) in enumerate(sizes, 1):
            print(f"  p{i}: {w:.0f} x {h:.0f} mm")
    code = 0
    off = [i for i, (w, h) in enumerate(sizes, 1) if abs(w - A4_MM[0]) > 2 or abs(h - A4_MM[1]) > 2]
    if off:
        print(f"warn  {len(off)} page{'s' if len(off) != 1 else ''} not A4 (210 x 297 mm), first p{off[0]}. "
              f"Put @page{{size:A4}} in the @media print block of style.css")
    if a.max_pages is not None and n > a.max_pages:
        print(f"FAIL  {n} pages; the target is at most {a.max_pages}. Cut the page, or move a "
              f"block to the full design")
        code = 1
    if a.png:
        files = render_png(out, Path(a.png).resolve())
        if files is None:
            print("png: skipped the render, because PyMuPDF is not installed (pip install pymupdf)")
        else:
            print(f"png: {len(files)} file{'s' if len(files) != 1 else ''} in {show(Path(a.png).resolve())}: "
                  f"{files[0].name}{' ... ' + files[-1].name if len(files) > 1 else ''}")
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
