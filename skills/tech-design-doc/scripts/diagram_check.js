/* tech-design-doc · diagram_check.js · find spacing and overlap defects in a RENDERED diagram.
   Runs in the browser after layout, so it measures what a reader sees, whatever tool drew the SVG:
   a kit figure, a Mermaid diagram, or a cloud_diagram.py SVG.

   checkSvg(svg) returns {fails: [...], warns: [...]}, each item one line a person can act on.

   FAIL  text over text · a line through unprotected text · text across the edge of a card, an icon or
         a disc · a card that hides text · a line through a card it does not start or end at ·
         a step disc over text or over another disc · anything cut off at the edge of the figure
   WARN  text closer than 2 px to other text or to the edge of its own card · text under 9 px on the
         screen · two lines on top of each other · a disc on a group border · line crossings
   "Protected" text has a halo (paint-order: stroke) or an opaque backing painted over the line,
   which is how a label is meant to sit ON its own line. */
(() => {
  const SKIP = new Set(['defs', 'marker', 'clipPath', 'mask', 'symbol', 'pattern', 'title', 'desc',
    'style', 'script', 'metadata', 'linearGradient', 'radialGradient', 'filter']);
  const say = s => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > 34 ? s.slice(0, 32) + '…' : s; };
  const R = r => ({ x: r.left, y: r.top, w: r.width, h: r.height });
  const inter = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? { w, h } : null;
  };
  const inside = (a, b, m = 0) => a.x >= b.x - m && a.y >= b.y - m && a.x + a.w <= b.x + b.w + m && a.y + a.h <= b.y + b.h + m;
  const shrink = (r, d) => ({ x: r.x + d, y: r.y + d, w: Math.max(0, r.w - 2 * d), h: Math.max(0, r.h - 2 * d) });
  const ptIn = (p, r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
  const pos = r => `at ${Math.round(r.x)},${Math.round(r.y)}`;
  // the visible text of a <text>: its text nodes and tspans, never a <title> tooltip inside it
  const shown = n => [...n.childNodes].map(c => c.nodeType === 3 ? c.data :
    (c.localName === 'tspan' || c.localName === 'textPath') ? shown(c) : '').join('');

  function visible(n, root) {
    for (let e = n; e && e !== root.parentNode; e = e.parentNode) {
      if (!(e instanceof Element)) break;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return true;
  }
  const paints = (cs, k) => cs[k] && cs[k] !== 'none' && !/rgba\(.*,\s*0\)$/.test(cs[k]) &&
    Number(cs[k + 'Opacity'] ?? 1) > 0;

  function collect(svg) {
    const out = { text: [], box: [], disc: [], line: [] };
    let order = 0;
    const walk = n => {
      for (const c of n.children) {
        const tag = c.localName;
        if (SKIP.has(tag)) continue;
        if (!visible(c, svg)) continue;
        const o = order++;
        if (tag === 'text') {
          const r = R(c.getBoundingClientRect()), cs = getComputedStyle(c);
          if (!shown(c).trim() || r.w < 1) continue;
          // a halo hides a line only when it is wide enough to close the gaps between letters
          const halo = /^stroke/.test(cs.paintOrder || '') && paints(cs, 'stroke') &&
            parseFloat(cs.strokeWidth) >= Math.max(1.5, 0.4 * parseFloat(cs.fontSize));
          const ctm = c.getScreenCTM();
          const px = parseFloat(cs.fontSize) * (ctm ? Math.hypot(ctm.a, ctm.b) : 1);
          out.text.push({ n: c, o, r, halo, backed: false, s: shown(c), px });
          continue;
        }
        if (tag === 'foreignObject') {
          const t = c.textContent.trim();
          if (!t) continue;
          const rg = document.createRange(); rg.selectNodeContents(c);
          const r = R(rg.getBoundingClientRect());
          if (r.w < 1) continue;
          let backed = false;
          c.querySelectorAll('*').forEach(e => {
            const bg = getComputedStyle(e).backgroundColor;
            if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) backed = true;
          });
          const px = parseFloat(getComputedStyle(c.querySelector('*') || c).fontSize) || 12;
          out.text.push({ n: c, o, r, halo: false, backed, s: t, px });
          continue;
        }
        if (tag === 'svg' || tag === 'image' || tag === 'use') {          // an icon: one solid box
          const r = R(c.getBoundingClientRect());
          if (r.w > 2 && r.h > 2) out.box.push({ n: c, o, r, filled: true, dashed: false, icon: true, s: tag });
          continue;
        }
        if (tag === 'g' || tag === 'a' || tag === 'switch') { walk(c); continue; }
        if (!(c instanceof SVGGeometryElement)) continue;
        const cs = getComputedStyle(c), r = R(c.getBoundingClientRect());
        const filled = paints(cs, 'fill'), stroked = paints(cs, 'stroke');
        if (!filled && !stroked) continue;
        const dashed = cs.strokeDasharray && cs.strokeDasharray !== 'none';
        const label = (c.querySelector('title') || {}).textContent || c.getAttribute('aria-label') || '';
        if (tag === 'circle' && filled && r.w < 30) { out.disc.push({ n: c, o, r, s: label }); continue; }
        const open = tag === 'line' || tag === 'polyline' || (tag === 'path' && !filled);
        if (open && stroked) {
          const ctm = c.getScreenCTM(), L = c.getTotalLength(), pts = [];
          const step = Math.max(1, L / Math.max(2, Math.ceil(L * (ctm ? Math.hypot(ctm.a, ctm.b) : 1) / 3)));
          for (let l = 0; l <= L + 0.01; l += step) {
            const p = c.getPointAtLength(Math.min(l, L));
            const q = new DOMPoint(p.x, p.y).matrixTransform(ctm);
            pts.push({ x: q.x, y: q.y });
          }
          if (pts.length > 1) out.line.push({ n: c, o, r, pts, dashed, s: label });
          continue;
        }
        if (r.w > 3 && r.h > 3) out.box.push({ n: c, o, r, filled, dashed, icon: false, s: label,
          bar: Math.min(r.w, r.h) < 14 });     // a lifeline capsule or a rule, not a card
      }
    };
    walk(svg);
    // a box is a container (a zone, a group, a cluster) when it holds another box; containers do not
    // block lines, and text may sit on their border only when protected
    for (const b of out.box) {
      b.container = b.dashed || out.box.some(o => o !== b && inside(o.r, b.r, 1) &&
        o.r.w * o.r.h < 0.6 * b.r.w * b.r.h);
      // a label backing: a small filled box that holds one label and nothing else
      b.backing = !b.container && !b.icon && out.text.some(t => inside(shrink(t.r, 1), b.r, 1) &&
        b.r.w * b.r.h < 6 * t.r.w * t.r.h + 400);
    }
    return out;
  }

  window.checkSvg = svg => {
    const fails = [], warns = [];
    const F = m => fails.includes(m) || fails.push(m), W = m => warns.includes(m) || warns.push(m);
    const E = collect(svg), frame = R(svg.getBoundingClientRect());
    const { text: T, box: B, disc: D, line: Ls } = E;

    // what protects a text from a line or a box painted before it
    const protectedFrom = (t, under) => t.o > under.o && (t.halo || t.backed ||
      [...B, ...D].some(b => (b.filled ?? true) && !b.icon && b.o > under.o && b.o < t.o &&
        inside(shrink(t.r, 1), b.r, 1) && b.r.w * b.r.h < 6 * t.r.w * t.r.h + 400));

    // 1 · text over text
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      const a = T[i], b = T[j];
      if (a.n.contains(b.n) || b.n.contains(a.n)) continue;
      const x = inter(a.r, b.r);
      if (x && x.w > 1 && x.h > 0.3 * Math.min(a.r.h, b.r.h)) F(`text "${say(a.s)}" overlaps text "${say(b.s)}" ${pos(b.r)}`);
      else if (!x) {
        const gx = Math.max(a.r.x, b.r.x) - Math.min(a.r.x + a.r.w, b.r.x + b.r.w);
        const gy = Math.max(a.r.y, b.r.y) - Math.min(a.r.y + a.r.h, b.r.y + b.r.h);
        if (gx < 2 && gy < -0.3 * Math.min(a.r.h, b.r.h) && gx > -1) W(`text "${say(a.s)}" touches text "${say(b.s)}" (gap under 2 px) ${pos(b.r)}`);
      }
    }
    // 2 · a line through text
    for (const l of Ls) for (const t of T) {
      const core = { x: t.r.x + 1, y: t.r.y + t.r.h * 0.2, w: t.r.w - 2, h: t.r.h * 0.6 };
      if (!inter(l.r, t.r) && l.r.w > 0 && l.r.h > 0) continue;
      const hits = l.pts.filter(p => ptIn(p, core)).length;
      if (hits >= 2 && !protectedFrom(t, l)) F(`a line runs through text "${say(t.s)}" ${pos(t.r)}`);
    }
    // 3 · text and boxes
    for (const t of T) for (const b of B) {
      if (b.bar || b.backing) continue;
      const x = inter(t.r, b.r);
      if (!x || x.w < 1.5 || x.h < 1.5) continue;
      if (inside(t.r, b.r, 0.5)) {
        if (b.icon) F(`text "${say(t.s)}" sits on an icon ${pos(t.r)}`);
        else if (b.filled && b.o > t.o && !b.container) F(`a card painted later hides text "${say(t.s)}" ${pos(t.r)}`);
        else {
          const gap = Math.min(t.r.x - b.r.x, b.r.x + b.r.w - t.r.x - t.r.w);
          if (!b.container && gap < 2 && b.r.w > t.r.w + 4) W(`text "${say(t.s)}" is under 2 px from the edge of its card ${pos(t.r)}`);
        }
        continue;
      }
      if (inside(b.r, t.r, 0.5)) continue;                   // a small mark inside a long label
      if (b.container) {
        if (!protectedFrom(t, b) && !(t.o > b.o && !b.filled)) F(`text "${say(t.s)}" crosses the border of a group ${pos(t.r)}`);
        continue;
      }
      F(`text "${say(t.s)}" crosses the edge of ${b.icon ? 'an icon' : 'a card'} ${pos(t.r)}`);
    }
    // 4 · a line through a card it does not start or end at
    for (const l of Ls) {
      const a = l.pts[0], z = l.pts[l.pts.length - 1];
      for (const b of B) {
        if (b.container || b.bar || b.backing) continue;
        const g = shrink(b.r, -9);
        if (ptIn(a, g) || ptIn(z, g)) continue;               // an end of this line
        const core = shrink(b.r, 3);
        let run = 0, worst = 0;
        for (const p of l.pts) { run = ptIn(p, core) ? run + 1 : 0; worst = Math.max(worst, run); }
        if (worst >= 3 && !inside(l.r, b.r, 1)) F(`a line crosses ${b.icon ? 'an icon' : 'a card'}${b.s ? ` "${say(b.s)}"` : ''} ${pos(b.r)}`);
      }
    }
    // 5 · step discs
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      for (let j = i + 1; j < D.length; j++) if (inter(shrink(d.r, 1), shrink(D[j].r, 1))) F(`two step discs overlap ${pos(d.r)}`);
      for (const t of T) {
        const c = { x: t.r.x + t.r.w / 2, y: t.r.y + t.r.h / 2 };
        if (ptIn(c, d.r)) continue;                           // the disc's own number
        const x = inter(shrink(d.r, 1), t.r);
        if (x && x.w > 1 && x.h > 1) F(`a step disc covers text "${say(t.s)}" ${pos(d.r)}`);
      }
      for (const b of B) {
        if (b.bar || inside(d.r, b.r) || !inter(d.r, b.r) || inside(b.r, d.r)) continue;
        if (b.container) W(`a step disc sits on a group border ${pos(d.r)}`);
        else F(`a step disc sits on the edge of ${b.icon ? 'an icon' : 'a card'} ${pos(d.r)}`);
      }
    }
    // 6 · cut off
    for (const e of [...T, ...B, ...D]) {
      if (e.r.x < frame.x - 1 || e.r.y < frame.y - 1 || e.r.x + e.r.w > frame.x + frame.w + 1 || e.r.y + e.r.h > frame.y + frame.h + 1)
        F(`${e.s ? `"${say(e.s)}"` : 'a mark'} is cut off at the edge of the figure ${pos(e.r)}`);
    }
    // 7a · a label that prints its own quote marks (a quoted Mermaid sequence message, an escaping slip)
    for (const t of T) if (/^\s*["“].*["”]\s*$/.test(t.s) && t.s.trim().length > 2)
      F(`label ${say(t.s)} shows literal quote marks; remove the quotes from the source`);
    // 7 · readability
    for (const t of T) if (t.px && t.px < 9) W(`text "${say(t.s)}" draws at ${t.px.toFixed(1)} px on the screen; under 9 px is hard to read`);
    // 8 · lines on top of each other, and crossings
    let crossings = 0;
    for (let i = 0; i < Ls.length; i++) for (let j = i + 1; j < Ls.length; j++) {
      const a = Ls[i], b = Ls[j];
      if (!inter(shrink(a.r, -3), shrink(b.r, -3))) continue;
      let close = 0;
      for (const p of a.pts) if (b.pts.some(q => Math.abs(p.x - q.x) < 2.5 && Math.abs(p.y - q.y) < 2.5)) close++;
      if (close * 3 > 24 && close > 0.25 * Math.min(a.pts.length, b.pts.length))
        W(`two lines run on top of each other for about ${close * 3} px ${pos(a.r)}`);
      else if (close > 0 && close <= 3) crossings++;
    }
    if (crossings > 2) W(`${crossings} line crossings; move a node or reroute to cut them`);
    return { fails, warns, counts: { text: T.length, box: B.length, disc: D.length, line: Ls.length } };
  };
})();
