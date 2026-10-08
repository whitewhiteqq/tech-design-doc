/* tech-design-doc · figures/silhouettes.js · one screen, drawn once per reader

   QUESTION   What does each plan (or role) actually see of the same screen? The grant table says
              which parts a reader holds; this figure shows what the screen then looks like.
   USE WHEN   One screen or report changes per reader, and the change is "a block is there, cut
              down, or gone". 2 to 6 readers, 4 to 14 blocks. Put it next to the grant table, and
              make that table its table twin.
   NOT WHEN   The readers differ in which RECORDS they see, not which blocks (use mapping). The
              blocks are not in a fixed screen order (use stack or a table).

   ENCODING
     column        one reader: a framed miniature of the screen. The head names the reader over a
                   tally ("5 OF 8 SHOWN").
     block row     one block of the screen, in screen order, top to bottom, drawn as a simple shape
                   (a header bar, KPI capsules, rings and bars for charts, rows for a table).
                   Its name sits once, in the gutter on the left.
     solid         the reader sees the block. DATA, or HERO in the hero column.
     half          the reader sees it limited (outline + half fill, DATA2). The tooltip says how.
     dotted line   the block is withheld: a hairline FAINTDATA gap, never a grey copy of the shape.
     hero column   the column the claim is about: a darker frame and HERO marks. An elbow line
                   joins it to the conclusion lines, which sit centred on the FIGURE.
     tooltips      every cell opens with one parsable line, "<column> · <block> · full|limited|
                   withheld — <tip>", so a checker can compare the cells with the Markdown table.

   DATA (below)
     label     the aria-label. Tokens: {total} blocks, {hero} the hero column, and {<column name>}
               = the blocks that column shows in full.
     columns   the reader names, left to right.
     hero      the column the claim is about; '' or null = the column with the most full blocks.
     tally     the line under each head. Tokens: {full}, {limited}, {total}.
     blocks    [{name, shape, tip, full, limited}] in screen order.
               full = the columns that see it ('*' = every column);
               limited = {column: 'how it is cut down'}; every other column = withheld.
               shape = bar | chips | lines2 | para | track | kpis | gauge | thick2 | charts |
                       rows3 | rows5 | card | toggles (height 8 to 21 units each).
     notes     [{text, tone: 'hero' | 'mut' | 'faint', tip}]  centred under the figure, in
               capitals, wrapped. Tokens as in label.

   LAYOUT LIMITS
     - 2 to 6 columns. A column must be wider than the widest word of its head. At 6 columns and
       a 60-unit gutter a column is about 50 units wide, so a 10-letter word like ENTERPRISE
       (about 48) is the longest that fits. The build stops with a message when a word does not.
     - The gutter grows with the longest block name, up to 120 units, and takes width from the
       columns: 5 columns with 20-letter block names still fit 16-letter heads on two lines.
     - The height follows the blocks: 13 to 26 units per block. 13 blocks, the heads and one note
       line draw about 290 units tall.
     - Heads wrap onto up to 3 lines; the tally wraps too. Under 46 units of inner width the
       charts shape keeps one ring, so its bars keep their room.

   PITFALLS SEEN IN PRACTICE
     - Too many columns: the head words stop fitting (six readers did not fit at 40 units each).
       Drop the reader who sees nothing, and say so in a note.
     - A withheld block drawn in grey still shows its shape. Draw the gap only.
     - The conclusion centred on the hero column, not on the figure. Keep it on the figure, and
       let the elbow line point at the column.
     - Cells drift from the grant table. Keep one model, and check the <title> lines.

   Origin: the "one report, five readers" figure of a design document (R-series
   silhouette small multiples, PORCELAIN roles only). */
(() => {
/* ════ DATA · every word the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'The same dashboard, once per plan: {hero} sees all {total} blocks, Business sees ' +
    '{Business} in full plus the audit export for the last 30 days, Team sees {Team}, and Free sees {Free}.',
  columns: ['Free', 'Team', 'Business', 'Enterprise'],
  hero: 'Enterprise',
  tally: '{full} of {total} shown',
  blocks: [
    { name: 'Header', shape: 'bar', full: '*', tip: 'the tenant name, the plan badge and the sender domain' },
    { name: 'Send stats', shape: 'kpis', full: '*', tip: 'six counters: sent, delivered, bounced, opened, clicked, opted out' },
    { name: 'Charts', shape: 'charts', full: ['Team', 'Business', 'Enterprise'],
      tip: 'the delivery and click charts of the Analytics tier' },
    { name: 'Template list', shape: 'rows3', full: '*', tip: 'the templates of the tenant, with their last edit' },
    { name: 'Raw logs', shape: 'rows5', full: ['Enterprise'], tip: 'every API request and provider reply of the last 30 days' },
    { name: 'SSO settings', shape: 'toggles', full: ['Business', 'Enterprise'], tip: 'the SAML connection of the tenant' },
    { name: 'Audit export', shape: 'card', full: ['Enterprise'], limited: { Business: 'the last 30 days only' },
      tip: 'every admin action, as a CSV export' },
    { name: 'Billing', shape: 'para', full: ['Team', 'Business', 'Enterprise'], tip: 'the plan, the usage and the last invoice' },
  ],
  notes: [
    { text: '{hero} sees all {total} blocks', tone: 'hero', tip: 'Enterprise holds every tier and every add-on that this screen shows.' },
    { text: 'Business sees the audit export for the last 30 days only', tone: 'mut' },
    { text: 'Partner is not drawn: it sees Enterprise without the audit export', tone: 'faint',
      tip: 'Partner holds the same tiers as Enterprise, and SSO and Dedicated IP, but not Audit export.' },
  ],
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'silhouettes';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure

const L = 4, R = 396, MID = 200;  // the drawing margins; conclusions centre on the figure, not a column
const SAFE = 1.08;                // measured width x SAFE: room for a reader font wider than the build font
const GUTTER_MAX = 120;           // the widest block name
const GAP = 5, PAD = 5;           // between two columns; inside a column frame
const F = {
  col: { 'font-size': 6.8, 'font-weight': 800, 'letter-spacing': '.04em' },
  tally: { 'font-size': 6.6, 'font-weight': 700, 'letter-spacing': '.07em' },
  block: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.05em' },
  hero: { 'font-size': 7.2, 'font-weight': 800, 'letter-spacing': '.07em' },
  mut: { 'font-size': 6.8, 'font-weight': 700, 'letter-spacing': '.07em' },
};
F.faint = F.mut;

const fail = msg => { throw new Error(`figures/${NAME}.js DATA: ${msg}`); };
const up = s => String(s).toUpperCase();
const r2 = v => Math.round(v * 100) / 100;
const fill = (s, v) => String(s).replace(/\{([^{}]+)\}/g, (m, k) => (Object.hasOwn(v, k) ? v[k] : m));
// measured in the page's own fonts (prelude measure), with room for a wider reader font
const width = (text, f) => textWidth(text, f) * SAFE;
const wrap = (text, f, max) => {
  const lines = [];
  let cur = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && width(next, f) > max) { lines.push(cur); cur = word; } else cur = next;
  }
  return cur ? lines.concat(cur) : lines;
};

/* ── the model: one mode per column per block ── */
const C = DATA.columns, B = DATA.blocks;
if (C.length < 2 || C.length > 6) fail(`columns holds ${C.length}; draw 2 to 6`);
const mode = B.map(b => {
  const full = b.full === '*' ? C : (b.full || []), lim = b.limited || {};
  [...full, ...Object.keys(lim)].forEach(c => { if (!C.includes(c)) fail(`${b.name}: "${c}" is no column`); });
  Object.keys(lim).forEach(c => { if (full.includes(c)) fail(`${b.name}: "${c}" is both full and limited`); });
  return C.map(c => (full.includes(c) ? 'full' : c in lim ? 'limited' : 'withheld'));
});
const tally = C.map((_, k) => ({ full: mode.filter(m => m[k] === 'full').length,
  limited: mode.filter(m => m[k] === 'limited').length, total: B.length }));
let HC = DATA.hero ? C.indexOf(DATA.hero) : -1;
if (DATA.hero && HC < 0) fail(`hero "${DATA.hero}" is no column`);
if (HC < 0) HC = tally.reduce((best, t, k) => (t.full > tally[best].full ? k : best), 0);
const vars = { total: B.length, hero: C[HC], ...Object.fromEntries(C.map((c, k) => [c, tally[k].full])) };

/* ── the shapes: [height, draw(g, x, y, w, colour, mode, delay)]; w = the inner width of a column ── */
const box = (g, x, y, w, h, col, m, d) => {           // one capsule; limited = outline + left half
  const r = Math.min(w, h) / 2;
  if (m !== 'limited') return el(g, 'rect', { x: r2(x), y: r2(y), width: r2(w), height: r2(h), rx: r2(r), fill: col, class: 'pop', style: at(d) });
  el(g, 'rect', { x: r2(x), y: r2(y), width: r2(w), height: r2(h), rx: r2(r), fill: 'none', stroke: P.DATA2, 'stroke-width': 1, class: 'pop', style: at(d) });
  return el(g, 'path', { d: `M${r2(x + r)} ${r2(y)}H${r2(x + w / 2)}V${r2(y + h)}H${r2(x + r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(x)} ${r2(y + h - r)}` +
    `V${r2(y + r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + r)} ${r2(y)}Z`, fill: P.DATA2, class: 'pop', style: at(d) });
};
const lines = (fr, gap, h, top) => (g, x, y, w, col, m, d) => fr.forEach((f, i) => box(g, x, y + top + i * gap, w * f, h, col, m, d + i * .03));
const SHAPE = {
  bar: [9, (g, x, y, w, col, m, d) => box(g, x, y + 1, w * .62, 7, col, m, d)],
  chips: [8, (g, x, y, w, col, m, d) => { for (let i = 0; i < 3; i++) box(g, x + i * w * .365, y + 1, w * .27, 6, col, m, d + i * .03); }],
  lines2: [10, lines([.92, .64], 5, 2.6, 1.5)],
  para: [14, lines([.96, .88, .58], 5, 2.6, 1.5)],
  thick2: [14, lines([.84, .66], 7.5, 5.5, 1.5)],
  rows3: [14, lines([1, 1, 1], 4.6, 2.4, 2.5)],
  rows5: [21, lines([1, 1, 1, 1, 1], 3.9, 2, 2.5)],
  card: [12, (g, x, y, w, col, m, d) => box(g, x, y + 1, w * .69, 10, col, m, d)],
  kpis: [18, (g, x, y, w, col, m, d) => {
    const bw = (w - 8) / 3;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) box(g, x + c * (bw + 4), y + 1.5 + r * 9.5, bw, 6.5, col, m, d + (r * 3 + c) * .02);
  }],
  track: [11, (g, x, y, w, col, m, d) => {
    const c2 = m === 'limited' ? P.DATA2 : col;
    el(g, 'line', { x1: r2(x), y1: y + 6, x2: r2(x + w), y2: y + 6, stroke: c2, 'stroke-width': .9, pathLength: 1, class: 'draw', style: at(d) });
    [.04, .33, .63, .95].forEach((f, i) => {
      const cx = r2(x + 2.2 + f * (w - 4.4));
      el(g, 'circle', { cx, cy: y + 6, r: 2.1, fill: c2, class: 'pop', style: at(d + .05 + i * .03) });
      el(g, 'line', { x1: cx, y1: y + 9.4, x2: cx, y2: y + 11, stroke: P.GRID, 'stroke-width': .7, class: 'fade', style: at(d + .1 + i * .03) });
    });
  }],
  gauge: [14, (g, x, y, w, col, m, d) => {
    el(g, 'path', { d: `M${r2(x)} ${y + 12}A7 7 0 0 1 ${r2(x + 14)} ${y + 12}`, fill: 'none', stroke: m === 'limited' ? P.DATA2 : col,
      'stroke-width': 3, 'stroke-linecap': 'round', pathLength: 1, class: 'draw', style: at(d) });
    const bw = (w - 22) / 3 - 2;
    for (let i = 0; i < 3; i++) box(g, x + 20 + i * (bw + 2), y + 4.5, bw, 5, col, m, d + .06 + i * .03);
  }],
  charts: [18, (g, x, y, w, col, m, d) => {
    // two rings, then three bars; a column under 46 units keeps one ring, so the bars keep their room
    const c1 = Math.max(6.5, w * .125), rings = w < 46 ? [c1] : [c1, c1 + Math.max(14.5, w * .275)];
    rings.forEach((cx, i) => el(g, 'circle', { cx: r2(x + cx), cy: y + 9, r: 5.5, fill: 'none', stroke: m === 'limited' ? P.DATA2 : col,
      'stroke-width': 2.4, class: 'pop', style: at(d + i * .04) }));
    const b0 = Math.max(w * (rings.length > 1 ? .63 : .45), rings[rings.length - 1] + 9), step = (w - b0) / 3;
    [7, 13, 9].forEach((ht, i) => box(g, x + b0 + i * step, y + 16 - ht, Math.min(step * .65, 5.6), ht, col, m, d + .08 + i * .03));
  }],
  toggles: [14, (g, x, y, w, col, m, d) => {
    for (let i = 0; i < 2; i++) {
      box(g, x, y + 1.5 + i * 6.5, 9, 4.5, col, m, d + i * .04);
      box(g, x + 12, y + 2.5 + i * 6.5, w * (i ? .4 : .55), 2.4, col, m, d + .02 + i * .04);
    }
  }],
};
B.forEach(b => { if (!SHAPE[b.shape]) fail(`${b.name}: shape "${b.shape}" is none of ${Object.keys(SHAPE).join(', ')}`); });

/* ── horizontal layout ── */
const gut = Math.max(...B.map(b => width(up(b.name), F.block)));
if (gut > GUTTER_MAX) fail(`a block name is ${Math.round(gut)} units wide; the gutter holds ${GUTTER_MAX}. Shorten it`);
const X0 = L + gut + 6, CW = (R - X0 - (C.length - 1) * GAP) / C.length, IW = CW - 2 * PAD;
const CX = k => X0 + k * (CW + GAP);
const heads = C.map(c => wrap(up(c), F.col, CW - 2));
C.forEach(c => up(c).split(/\s+/).forEach(word => {
  const need = width(word, F.col);
  if (need > CW) fail(`${C.length} columns leave ${r2(CW)} units each, and the head word "${word}" needs ` +
    `${r2(need)}. The block names take ${r2(gut)} units: shorten them, use fewer columns, or shorten the word`);
}));
if (heads.some(h => h.length > 3)) fail('a column head needs more than 3 lines; shorten the reader name');
const tallies = tally.map(t => wrap(up(fill(DATA.tally, t)), F.tally, CW - 2));

/* ── vertical layout ── */
const HL = Math.max(...heads.map(h => h.length)), TL = Math.max(...tallies.map(t => t.length));
const headTop = 12, tallyTop = headTop + (HL - 1) * 8 + 10;
const FT = tallyTop + (TL - 1) * 8 + 6, tops = [];
let cur = FT + 6;
B.forEach(b => { tops.push(cur); cur += SHAPE[b.shape][0] + GAP; });
const FB = cur - GAP + 6;
const noteLines = DATA.notes.map(n => ({ n, lines: wrap(up(fill(n.text, vars)), F[n.tone] || F.mut, R - L - 4) }));
let ny = FB + 22;
const NY = noteLines.map((nl, k) => { const y = ny; ny += nl.lines.length * 10 + (k === 0 ? 1 : 2); return y; });
const H = r2(ny - 2);

figure(NAME, { h: H, label: fill(DATA.label, vars) }, s => {
  const say = (k, b, m, why) => `${C[k]} · ${b.name} · ${m} — ${b.tip}` + (why ? `: ${why}` : '');

  /* one framed column per reader, with its head and tally */
  C.forEach((c, k) => {
    const hero = k === HC, col = hero ? P.HERO : P.DATA, x = r2(CX(k)), t = tally[k];
    el(s, 'rect', { x, y: r2(FT), width: r2(CW), height: r2(FB - FT), rx: 4, fill: 'none', stroke: hero ? P.FAINT : P.GRID,
      'stroke-width': hero ? 1 : .8, class: 'fade', style: at(k * .05) });
    const g = el(s, 'g', { class: 'fade', style: at(.05 + k * .05) }), cx = r2(CX(k) + CW / 2);
    const y0 = headTop + (HL - heads[k].length) * 4;
    heads[k].forEach((line, m) => txt(g, { ...F.col, x: cx, y: r2(y0 + m * 8), fill: col, 'text-anchor': 'middle' }, line));
    tallies[k].forEach((line, m) => txt(g, { ...F.tally, x: cx, y: r2(tallyTop + m * 8), fill: P.MUT, 'text-anchor': 'middle' }, line));
    const out = B.filter((_, i) => mode[i][k] === 'withheld').map(b => b.name);
    const lim = B.filter((_, i) => mode[i][k] === 'limited').map(b => `${b.name} (${b.limited[c]})`);
    tip(g, `${c} sees ${t.full} of ${t.total} blocks in full` + (lim.length ? `; limited: ${lim.join(', ')}` : '') +
      (out.length ? `; withheld: ${out.join(', ')}` : '') + '.');
  });

  /* one row per block, in screen order */
  B.forEach((b, i) => {
    const top = tops[i], h = SHAPE[b.shape][0], d0 = .25 + i * .045;
    tip(txt(s, { ...F.block, x: r2(X0 - 6), y: r2(top + h / 2 + 2.4), fill: P.MUT, 'text-anchor': 'end', class: 'fade', style: at(d0) },
      up(b.name)), `${b.name} — ${b.tip}`);
    if (i) C.forEach((_, k) => el(s, 'line', { x1: r2(CX(k)), y1: r2(top - GAP / 2), x2: r2(CX(k) + CW), y2: r2(top - GAP / 2),
      stroke: P.GRID, 'stroke-width': .5, class: 'fade', style: at(d0) }));
    C.forEach((c, k) => {
      const m = mode[i][k], x = CX(k) + PAD, d = d0 + .12 + k * .03, g = el(s, 'g', {});
      if (m === 'withheld') el(g, 'line', { x1: r2(x), y1: r2(top + h / 2), x2: r2(x + IW), y2: r2(top + h / 2), stroke: P.FAINTDATA,
        'stroke-width': 1, 'stroke-dasharray': '1.6 2.4', class: 'fade', style: at(d) });
      else SHAPE[b.shape][1](g, x, top, IW, k === HC ? P.HERO : P.DATA, m, d);
      tip(g, say(k, b, m, m === 'limited' ? b.limited[c] : ''));
    });
  });

  /* the conclusion: an elbow from the hero column to lines centred on the figure */
  const px = r2(CX(HC) + CW / 2);
  el(s, 'path', { d: `M${px} ${r2(FB)}V${r2(FB + 7)}H${MID}V${r2(FB + 12)}`, fill: 'none', stroke: P.HERO, 'stroke-width': .9,
    class: 'fade', style: at(1.5) });
  noteLines.forEach(({ n, lines: ls }, k) => {
    const tone = n.tone === 'hero' ? P.HERO : n.tone === 'faint' ? P.FAINT : P.MUT;
    const g = el(s, 'g', { class: 'fade', style: at(1.55 + k * .05) });
    ls.forEach((line, m) => txt(g, { ...(F[n.tone] || F.mut), x: MID, y: r2(NY[k] + m * 10), fill: tone, 'text-anchor': 'middle' }, line));
    if (n.tip) tip(g, n.tip);
  });
});
})();
