/* tech-design-doc · figures/lineage.js · what feeds each generated output, and which feeds are cut

   QUESTION   Which sources feed each generated output (a dashboard, a model prompt, an export), and
              which of those feeds must be cut, because the readers of the output may not see the
              source?
   USE WHEN   The design changes what data may flow into a derived output: a data class, a consent
              rule, a tenant boundary. 3 to 10 sources, 2 to 5 outputs, up to about 25 feeds.
   NOT WHEN   The flow has stages that matter (use system). The question is who reads a screen (use
              stack or silhouettes). More than about 25 feeds: split the figure by output.

   ENCODING
     left column   one row per source: the class chip, over the NAME, over the sub-label (the name
                   in code, as code spells it). The node bar grows with the feeds that leave it.
     right column  one row per generated output, placed near the sources that feed it. An optional
                   group head with a rule sits over an output.
     line          one feed. Solid DATA2 = the feed stays. Dashed HERO = the feed is cut.
     chip          the data class of a source, or the highest class an output may hold. The order of
                   DATA.classes is the rank, low to high: DATA2, DATA, HERO, so darker = more
                   sensitive. A class outside the list is MUT.
     disc + number HERO disc = a cut that a note explains. Ring = a feed that was checked and kept.
                   The number points at the notes under the figure.
     arrow         an output that feeds the next output (a feed whose `from` is an output id), drawn
                   down or up the output column, with an optional two-part label.
     tooltips      every row, chip, feed, mark and note. A feed opens with one parsable line:
                   "<from name> → <to name> · cut|stays — <tip>", so a checker can compare the drawn
                   feeds with the table in the Markdown.

   DATA (below)
     label     the aria-label. {feeds}, {cut} and {stay} are counted from DATA.feeds.
     heads     the two column heads.
     classes   the data classes, low to high, at most 3.
     rankRule  true: a feed is cut when its source class ranks above the class of its output. The
               figure fills in every missing `cut`, and it throws when a written `cut` disagrees.
               false: every `cut` is what you write, and a missing one is false.
     sources   [{id, name, sub, cls, tip}]   name in sentence case; the figure draws it in capitals.
     outputs   [{id, name, sub, cls, group, tip}]   group: optional head over the output.
     feeds     [{from, to, cut, note, tip}]  from = a source id, or an output id for an arrow
               between two NEIGHBOUR outputs; head + sub label an arrow. note = a note number.
     notes     [{n, head, body}]   one per number; CUT or KEPT comes from the feeds that carry it.

   LAYOUT LIMITS
     - Label columns size themselves to the longest name: up to 124 units on the left and 112 on
       the right. A longer name wraps onto more lines, and its row grows. A sub-label or a chip
       never wraps, so keep each under about 26 characters.
     - At least 96 units stay between the two node bars. Names that would squeeze them stop the
       build with a message: shorten them.
     - Up to 6 feeds per node read well; more stretch the row so the feed ends stay 3.6 apart.
     - An arrow joins two neighbour outputs only. Order DATA.outputs so that the pair is adjacent.
     - Notes wrap. The note head column grows with the longest head ("CUT · " included) up to 150
       units, about 30 capitals; a longer head wraps too.
     - The height follows the data: about 27 units per source row, plus the notes.

   PITFALLS SEEN IN PRACTICE
     - Lines drift from the text. Keep one model: write the feeds here, and let a checker compare
       the drawn <title> lines with the Markdown table.
     - Two numbered marks on one spot. The figure moves each mark along its line until it stands
       clear of the others; read the PNG anyway.
     - A cut that the chips contradict (a dark source into a light output that "stays"). Use
       rankRule, so the figure refuses that data.
     - A name that grew after a rename. The columns grow and the names wrap, but read the PNG.

   Origin: the lineage flow diagram of a design document (Lupi grammar: hairline feeds,
   capsule node bars, capitals with letter spacing, PORCELAIN roles only). */
(() => {
/* ════ DATA · every word the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'Six sources feed three generated outputs through {feeds} feeds, and {cut} of them are ' +
    'cut: the opt-out list never reaches the AI subject-line suggestions, and message bodies never ' +
    'reach delivery analytics.',
  heads: { sources: 'Sources', outputs: 'Generated outputs' },
  classes: ['Internal', 'Confidential', 'Personal'],
  rankRule: true,
  sources: [                    // order: feeds into the same output sit together, so fewer lines cross
    { id: 'bodies', name: 'Message bodies', sub: 'messages.body', cls: 'Confidential',
      tip: 'the subject line and the text of every message' },
    { id: 'clicks', name: 'Click events', sub: 'clicks', cls: 'Internal',
      tip: 'one row per click on a tracked link, keyed by message id, with no address' },
    { id: 'receipts', name: 'Delivery receipts', sub: 'receipts', cls: 'Internal',
      tip: 'one status per message from the provider webhook: delivered, bounced or failed' },
    { id: 'optout', name: 'Opt-out list', sub: 'suppressions', cls: 'Personal',
      tip: 'the addresses that asked for no more messages' },
    { id: 'contacts', name: 'Contact list', sub: 'contacts', cls: 'Personal',
      tip: 'the recipients of every tenant: address, name and locale' },
    { id: 'billing', name: 'Billing records', sub: 'billing.ledger', cls: 'Confidential',
      tip: 'the plan, the price and the usage of every tenant' },
  ],
  outputs: [
    { id: 'analytics', name: 'Delivery analytics', sub: 'tenant dashboard', cls: 'Internal',
      tip: 'delivery, bounce and click rates per tenant and per template' },
    { id: 'ai', name: 'AI subject-line suggestions', sub: 'model prompt', cls: 'Confidential',
      tip: 'three subject lines that the model suggests while a tenant writes a template' },
    { id: 'invoices', name: 'Invoices', sub: 'monthly PDF', cls: 'Personal',
      tip: 'one invoice per tenant per month, sent to its billing contact' },
  ],
  feeds: [
    { from: 'receipts', to: 'analytics', tip: 'delivery rate and bounce rate per template' },
    { from: 'clicks', to: 'analytics', tip: 'click rate per link and per template' },
    { from: 'bodies', to: 'analytics', cut: true, note: 2,
      tip: 'today the dashboard quotes the first line of each message. Analytics needs counts, not bodies' },
    { from: 'bodies', to: 'ai', tip: 'the past subject lines of the same tenant' },
    { from: 'clicks', to: 'ai', tip: 'which past subject lines drew clicks' },
    { from: 'optout', to: 'ai', cut: true, note: 1,
      tip: 'the model must not learn from people who opted out' },
    { from: 'contacts', to: 'invoices', tip: 'the count of stored contacts sets the price tier' },
    { from: 'receipts', to: 'invoices', tip: 'the delivered count is the billed count' },
    { from: 'billing', to: 'invoices', tip: 'the plan, the price and the usage' },
    { from: 'analytics', to: 'ai', note: 3, head: 'The analytics', sub: 'feed the model',
      tip: 'the open rate of each past subject line: counts only, never an address' },
  ],
  notes: [
    { n: 1, head: 'Opt-out list', body: 'The model must not learn from people who opted out.' },
    { n: 2, head: 'Message bodies', body: 'Analytics needs counts, not bodies.' },
    { n: 3, head: 'Analytics to model', body: 'The analytics hold counts only, so the model may read them.' },
  ],
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'lineage';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure

const L = 4, R = 396;           // the drawing margins of the 400-wide viewBox
const SAFE = 1.08;              // measured width x SAFE: room for a reader font wider than the build font
const CAP_L = 124, CAP_R = 112; // the widest label column; a longer name wraps
const GAP_L = 30, GAP_R = 32;   // label column to node bar
const MID_MIN = 96;             // the narrowest room for the feed lines
const LINE = 9;                 // the pitch of the text lines inside one row
const SP = 3.6;                 // the spacing of the feed ends along one node bar
const TOP = 30;                 // the first row starts under the column heads
const F = {
  head: { 'font-size': 7.5, 'font-weight': 700, 'letter-spacing': '.1em' },
  chip: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.1em' },
  name: { 'font-size': 7, 'font-weight': 700, 'letter-spacing': '.06em' },
  sub: { 'font-size': 6.5, 'font-weight': 500 },
  group: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.12em' },
  arrow: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.06em' },
  mark: { 'font-size': 6.5, 'font-weight': 800 },
  nhead: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.06em' },
  nbody: { 'font-size': 7, 'font-weight': 500 },
};

const fail = msg => { throw new Error(`figures/${NAME}.js DATA: ${msg}`); };
const up = s => String(s).toUpperCase();
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(v, k) ? v[k] : m));
const r2 = v => Math.round(v * 100) / 100;

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

/* ── the model: check the data, resolve ids, apply the rank rule ── */
if (DATA.classes.length > 3) fail(`classes holds ${DATA.classes.length} names; the palette has 3 ranks`);
const S = DATA.sources, O = DATA.outputs;
const ids = [...S, ...O].map(x => x.id);
ids.forEach((id, k) => { if (ids.indexOf(id) !== k) fail(`the id "${id}" appears twice`); });
const sIx = new Map(S.map((s, i) => [s.id, i])), oIx = new Map(O.map((o, j) => [o.id, j]));
const rank = c => DATA.classes.indexOf(c);
const tone = c => [P.DATA2, P.DATA, P.HERO][rank(c)] || P.MUT;
const pairs = new Set();
const feeds = DATA.feeds.map((f, k) => {
  const arrow = oIx.has(f.from);
  if (!arrow && !sIx.has(f.from)) fail(`feeds[${k}].from "${f.from}" is no source id or output id`);
  if (!oIx.has(f.to)) fail(`feeds[${k}].to "${f.to}" is no output id`);
  const a = arrow ? O[oIx.get(f.from)] : S[sIx.get(f.from)], b = O[oIx.get(f.to)];
  if (pairs.has(`${f.from}>${f.to}`)) fail(`the feed ${a.name} → ${b.name} appears twice`);
  pairs.add(`${f.from}>${f.to}`);
  if (arrow && Math.abs(oIx.get(f.from) - oIx.get(f.to)) !== 1)
    fail(`the arrow ${a.name} → ${b.name} joins two outputs that are not neighbours; reorder DATA.outputs`);
  let cut = f.cut;
  if (DATA.rankRule) {
    if (rank(a.cls) < 0 || rank(b.cls) < 0) fail(`rankRule needs a class from DATA.classes on ${a.name} and ${b.name}`);
    const rule = rank(a.cls) > rank(b.cls);
    if (cut !== undefined && !!cut !== rule)
      fail(`the feed ${a.name} → ${b.name} says cut: ${cut}, but its classes say ${rule ? 'cut' : 'stays'}`);
    cut = rule;
  }
  return { ...f, arrow, a, b, i: arrow ? oIx.get(f.from) : sIx.get(f.from), j: oIx.get(f.to),
    cut: !!cut, note: f.note || 0 };
});
const notes = DATA.notes.map(n => {
  const on = feeds.filter(f => f.note === n.n);
  if (!on.length) fail(`note ${n.n} sits on no feed`);
  if (on.some(f => f.cut) && on.some(f => !f.cut)) fail(`note ${n.n} sits on a cut feed and on a kept feed`);
  return { ...n, cut: on[0].cut, on };
});
feeds.forEach(f => {
  if (f.note && !notes.some(n => n.n === f.note)) fail(`the feed ${f.a.name} → ${f.b.name} names note ${f.note}, which DATA.notes lacks`);
});
const counts = { feeds: feeds.length, cut: feeds.filter(f => f.cut).length, stay: feeds.filter(f => !f.cut).length };

/* ── the two label columns: as wide as the longest label, up to the cap; a longer name wraps ── */
const fixedW = rows => Math.max(0, ...rows.map(r => Math.max(r.sub ? width(r.sub, F.sub) : 0,
  r.cls ? width(up(r.cls), F.chip) : 0, r.group ? width(up(r.group), F.group) : 0)));
const wordW = rows => Math.max(0, ...rows.flatMap(r => up(r.name).split(/\s+/).map(w => width(w, F.name))));
const colW = (rows, cap, head) => Math.max(fixedW(rows), wordW(rows), width(up(head), F.head),
  Math.min(cap, Math.max(...rows.map(r => width(up(r.name), F.name)))));
const LW = colW(S, CAP_L, DATA.heads.sources), RW = colW(O, CAP_R, DATA.heads.outputs);
const LX = L + LW, NXL = LX + GAP_L, RX = R - RW, NXR = RX - GAP_R;
if (NXR - NXL < MID_MIN)
  fail(`the labels leave ${r2(NXR - NXL)} units for the feed lines; ${MID_MIN} is the least. Shorten the longest name, sub-label or chip`);

/* ── rows: metrics, then positions. y = the baseline of the first name line; c = the bar centre ── */
const sRow = S.map(s => {
  const lines = wrap(up(s.name), F.name, LW);
  return { lines, above: 5.5 + (s.cls ? 8 : 0), below: (lines.length - 1) * LINE + (s.sub ? LINE : 0) + 2.5 };
});
const oRow = O.map(o => {
  const lines = wrap(up(o.name), F.name, RW);
  return { lines, above: 5.5 + (o.cls ? 8 : 0) + (o.group ? 14 : 0),
    below: (lines.length - 1) * LINE + (o.sub ? LINE : 0) + 2.5 };
});
const lr = feeds.filter(f => !f.arrow);
const nOut = S.map((_, i) => lr.filter(f => f.i === i).length);
const nIn = O.map((_, j) => lr.filter(f => f.j === j).length);
const barH = n => Math.max(6, (n - 1) * SP + 6);
const sy = [];
S.forEach((_, i) => {
  if (!i) { sy.push(TOP + sRow[0].above); return; }
  const p = sRow[i - 1], q = sRow[i];
  const text = p.below + 3 + q.above, bars = (barH(nOut[i - 1]) + barH(nOut[i])) / 2 + 4;
  sy.push(sy[i - 1] + Math.max(text, bars));
});
const sc = sy.map(y => y - 2.5);

// outputs: each wants the mean height of its sources; the order of DATA.outputs is kept
const arrowAt = j => feeds.find(f => f.arrow && Math.min(f.i, f.j) === j);   // an arrow between j and j+1
const arrowLines = f => (f && (f.head || f.sub))
  ? [...(f.head ? wrap(up(f.head), F.arrow, R - NXR - 20) : []), ...(f.sub ? wrap(up(f.sub), F.arrow, R - NXR - 20) : [])]
  : [];
const sep = O.map((_, j) => {
  if (j === O.length - 1) return 0;
  const p = oRow[j], q = oRow[j + 1], f = arrowAt(j);
  const text = p.below + 3 + q.above + (f ? Math.max(14, arrowLines(f).length * 8.5 + 12) : 0);
  const bars = (barH(nIn[j]) + barH(nIn[j + 1])) / 2 + (f ? 22 : 4);
  return Math.max(text, bars);
});
const want = O.map((_, j) => {
  const src = lr.filter(f => f.j === j);
  return src.length ? src.reduce((t, f) => t + sy[f.i], 0) / src.length : -Infinity;
});
const oy = [];
O.forEach((_, j) => oy.push(Math.max(want[j], j ? oy[j - 1] + sep[j - 1] : TOP + oRow[0].above)));
const lastS = sy[S.length - 1], last = O.length - 1;
if (oy[last] > lastS) {                             // pull the column back up into the span of the sources
  oy[last] = Math.max(lastS, TOP + oRow[0].above + sep.slice(0, last).reduce((t, v) => t + v, 0));
  for (let j = last - 1; j >= 0; j--) oy[j] = Math.min(oy[j], oy[j + 1] - sep[j]);
  for (let j = 0; j <= last; j++) oy[j] = Math.max(oy[j], j ? oy[j - 1] + sep[j - 1] : TOP + oRow[0].above);
}
const oc = oy.map(y => y - 2.5);

/* ── feed ends: each node spreads its feeds, ordered by the far end, so no two cross at the node ── */
const outOf = S.map((_, i) => lr.filter(f => f.i === i).sort((p, q) => oc[p.j] - oc[q.j]));
const inTo = O.map((_, j) => lr.filter(f => f.j === j).sort((p, q) => sc[p.i] - sc[q.i]));
const end = (list, f, c) => r2(c + (list.indexOf(f) - (list.length - 1) / 2) * SP);
const geo = new Map(lr.map(f => {
  const x1 = NXL + 3, y1 = end(outOf[f.i], f, sc[f.i]), x2 = NXR - 1, y2 = end(inTo[f.j], f, oc[f.j]);
  return [f, { x1, y1, x2, y2, m: r2((x1 + x2) / 2) }];
}));
const at3 = (g, t) => {                             // a point on the cubic feed line
  const u = 1 - t;
  return [g.x1 * u * u * u + 3 * g.m * u * t + g.x2 * t * t * t, g.y1 * (u * u * u + 3 * u * u * t) + g.y2 * (3 * u * t * t + t * t * t)];
};

/* ── numbered marks: try points along the feed until one stands clear of the marks placed so far ── */
const marks = [];
const arrows = feeds.filter(f => f.arrow).map(f => {
  const top = Math.min(f.i, f.j), x = NXR + 2;
  const y1 = r2(oc[top] + barH(nIn[top]) / 2 + 2), y2 = r2(oc[top + 1] - barH(nIn[top + 1]) / 2 - 2);
  // the label and its mark sit in the middle of the free gap between the two TEXT blocks, which
  // reach further than the bars: the name lines and the sub-label hang below the upper bar
  const gapA = oy[top] + oRow[top].below, gapB = oy[top + 1] - oRow[top + 1].above;
  const my = r2(Math.min(Math.max((gapA + gapB) / 2, y1 + 6), y2 - 6));
  if (f.note) marks.push({ x, y: my, f });
  return { f, x, y1, y2, down: f.i < f.j, my, lines: arrowLines(f) };
});
const samples = new Map(lr.map(f => [f, Array.from({ length: 41 }, (_, k) => at3(geo.get(f), k / 40))]));
const toSeg = ([x, y], [ax, ay], [bx, by]) => {     // the distance from a point to a segment
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
const clearance = (f, p) => Math.min(16, ...lr.filter(o => o !== f)
  .map(o => Math.min(...samples.get(o).slice(1).map((q, k) => toSeg(p, samples.get(o)[k], q)))));
// each mark takes the point of its line with the most air around it (other lines, up to 16 units),
// pulled toward the middle of the line; it never sits within 10.5 of another mark or near a bar
lr.filter(f => f.note).sort((p, q) => q.cut - p.cut).forEach(f => {
  const g = geo.get(f);
  const free = ([x, y]) => x > NXL + 10 && x < NXR - 10 && marks.every(m => Math.hypot(m.x - x, m.y - y) >= 10.5);
  let best = null;
  for (let t = .14; t <= .861; t += .02) {
    const p = at3(g, t);
    if (!free(p)) continue;
    const score = clearance(f, p) - 12 * Math.abs(t - .5);
    if (!best || score > best.score) best = { p, score };
  }
  const [x, y] = best ? best.p : at3(g, .5);
  marks.push({ x: r2(x), y: r2(y), f });
});

/* ── the notes under the figure ── */
const rowsBottom = Math.max(sy[S.length - 1] + sRow[S.length - 1].below, ...oy.map((y, j) => y + oRow[j].below),
  ...arrows.map(a => a.y2));
const NY = rowsBottom + 26;
const noteHead = n => `${n.cut ? 'CUT' : 'KEPT'} · ${up(n.head)}`;
const headW = Math.min(150, Math.max(0, ...notes.map(n => width(noteHead(n), F.nhead))));
const BX = 18 + headW + 10;
const noteRows = notes.map(n => {
  const hl = wrap(noteHead(n), F.nhead, headW), bl = wrap(n.body, F.nbody, R - BX);
  return { n, hl, bl, h: Math.max(hl.length, bl.length) * 9.5 + 3.5 };
});
const noteY = [];
noteRows.forEach((r, k) => noteY.push(k ? noteY[k - 1] + noteRows[k - 1].h : NY));
const H = r2(notes.length ? noteY[notes.length - 1] + noteRows[notes.length - 1].h : rowsBottom + 8);

figure(NAME, { h: H, label: fill(DATA.label, counts) }, s => {
  /* column heads */
  txt(s, { ...F.head, x: LX, y: 14, fill: P.TXT, 'text-anchor': 'end', class: 'fade', style: at(0) }, up(DATA.heads.sources));
  txt(s, { ...F.head, x: RX, y: 14, fill: P.TXT, class: 'fade', style: at(0) }, up(DATA.heads.outputs));
  const chip = (g, x, y, cls, anchor, d) => {
    const n = txt(g, { ...F.chip, x, y, fill: tone(cls), 'text-anchor': anchor, class: 'fade', style: at(d) }, up(cls));
    const k = rank(cls);
    tip(n, k < 0 ? `${cls}: a class outside the ranked list` : `${cls}: class ${k + 1} of ${DATA.classes.length}, ` +
      `low to high (${DATA.classes.join(' < ')})` + (DATA.rankRule ? '. A feed is cut when its source class ranks ' +
      'above the class of its output.' : ''));
  };

  /* feeds: kept lines first, cut lines on top; an invisible wide twin carries the tooltip */
  const say = f => `${f.a.name} → ${f.b.name} · ${f.cut ? 'cut' : 'stays'} — ${f.tip}` + (f.note ? ` (note ${f.note})` : '');
  const kept = lr.filter(f => !f.cut), cut = lr.filter(f => f.cut);
  kept.concat(cut).forEach((f, n) => {
    const g = geo.get(f), d = `M${g.x1} ${g.y1} C${g.m} ${g.y1} ${g.m} ${g.y2} ${g.x2} ${g.y2}`;
    if (f.cut) el(s, 'path', { d, fill: 'none', stroke: P.HERO, 'stroke-width': 1.2, 'stroke-dasharray': '2.6 1.9',
      class: 'fade', style: at(1.05 + (n - kept.length) * .08) });
    else el(s, 'path', { d, fill: 'none', stroke: P.DATA2, 'stroke-width': 1, opacity: .9, pathLength: 1,
      class: 'draw', style: at(.35 + n * .035) });
    tip(el(s, 'path', { d, fill: 'none', stroke: P.BG, 'stroke-opacity': 0, 'stroke-width': 5 }), say(f));
  });

  /* arrows between two neighbour outputs, with their label in the gap between the two rows */
  arrows.forEach(({ f, x, y1, y2, down, my, lines }) => {
    const g = el(s, 'g', {}), tipY = down ? y2 : y1, back = down ? -3.6 : 3.6;
    el(g, 'line', { x1: x, y1, x2: x, y2: r2(tipY + back * .3), stroke: f.cut ? P.HERO : P.DATA2, 'stroke-width': 1,
      'stroke-dasharray': f.cut ? '2.6 1.9' : null, class: 'fade', style: at(1) });
    el(g, 'path', { d: `M${r2(x - 2.6)} ${r2(tipY + back)} L${x} ${tipY} L${r2(x + 2.6)} ${r2(tipY + back)} Z`,
      fill: f.cut ? P.HERO : P.DATA2, class: 'fade', style: at(1.3) });
    el(g, 'line', { x1: x, y1, x2: x, y2, stroke: P.BG, 'stroke-opacity': 0, 'stroke-width': 6 });
    const top = my - (lines.length - 1) * 8.5 / 2 + 2.3;   // the label shares the tooltip of its arrow
    lines.forEach((t, k) => txt(g, { ...F.arrow, x: NXR + 20, y: r2(top + k * 8.5), fill: k ? P.MUT : P.TXT,
      'font-weight': k ? 600 : 700, class: 'fade', style: at(1.3 + k * .05) }, t));
    tip(g, say(f));
  });

  /* source rows: chip, name lines, sub-label, node bar */
  S.forEach((src, i) => {
    const y = sy[i], g = el(s, 'g', {}), d = i * .05, h = barH(nOut[i]), rw = sRow[i];
    if (src.cls) chip(g, LX, y - 8, src.cls, 'end', d + .1);
    rw.lines.forEach((t, k) => txt(g, { ...F.name, x: LX, y: r2(y + .5 + k * LINE), fill: P.TXT, 'text-anchor': 'end',
      class: 'fade', style: at(d) }, t));
    if (src.sub) txt(g, { ...F.sub, x: LX, y: r2(y + rw.lines.length * LINE), fill: P.MUT, 'text-anchor': 'end',
      class: 'fade', style: at(d + .03) }, src.sub);
    // FAINT marks a source with no class, but only when the other rows carry one
    el(g, 'rect', { x: NXL - 2, y: r2(sc[i] - h / 2), width: 4, height: r2(h), rx: 2,
      fill: src.cls || !DATA.classes.length ? P.DATA : P.FAINT, class: 'fade', style: at(d + .15) });
    tip(g, `${src.name} — ${src.tip}` + (src.cls ? ` · class ${src.cls}` : '') +
      ` · feeds ${nOut[i]} output${nOut[i] === 1 ? '' : 's'}`);
  });

  /* output rows: optional group head and rule, chip, name lines, sub-label, node bar */
  O.forEach((out, j) => {
    const y = oy[j], g = el(s, 'g', {}), d = .5 + j * .06, h = barH(nIn[j]), rw = oRow[j];
    const chipY = y - 8, groupY = y - (out.cls ? 8 : 0) - 14;
    if (out.group) {
      txt(s, { ...F.group, x: RX, y: groupY, fill: P.MUT, class: 'fade', style: at(d) }, up(out.group));
      el(s, 'line', { x1: RX, y1: groupY + 3.5, x2: R, y2: groupY + 3.5, stroke: P.GRID, 'stroke-width': .8,
        class: 'fade', style: at(d) });
    }
    el(g, 'rect', { x: NXR, y: r2(oc[j] - h / 2), width: 4, height: r2(h), rx: 2, fill: P.DATA, class: 'fade', style: at(d) });
    if (out.cls) chip(g, RX, chipY, out.cls, 'start', d + .05);
    rw.lines.forEach((t, k) => txt(g, { ...F.name, x: RX, y: r2(y + .5 + k * LINE), fill: P.TXT,
      class: 'fade', style: at(d + .05) }, t));
    if (out.sub) txt(g, { ...F.sub, x: RX, y: r2(y + rw.lines.length * LINE), fill: P.MUT,
      class: 'fade', style: at(d + .1) }, out.sub);
    tip(g, `${out.name} — ${out.tip}` + (out.cls ? ` · may hold ${out.cls}` : '') +
      ` · ${nIn[j]} source feed${nIn[j] === 1 ? '' : 's'}`);
  });

  /* marks: HERO disc = cut, ring = checked and kept; the number points at a note */
  marks.forEach(({ x, y, f }, k) => {
    const g = el(s, 'g', { class: 'pop', style: at(1.3 + k * .07) });
    el(g, 'circle', { cx: x, cy: y, r: 4.4, fill: f.cut ? P.HERO : P.BG, stroke: f.cut ? P.HERO : P.DATA, 'stroke-width': 1 });
    txt(g, { ...F.mark, x, y: r2(y + 2.3), fill: f.cut ? P.BG : P.DATA, 'text-anchor': 'middle' }, f.note);
    tip(g, say(f));
  });

  /* notes */
  if (notes.length) el(s, 'line', { x1: L, y1: NY - 13, x2: R, y2: NY - 13, stroke: P.GRID, 'stroke-width': .8,
    class: 'fade', style: at(1.4) });
  noteRows.forEach(({ n, hl, bl }, k) => {
    const y = noteY[k], g = el(s, 'g', { class: 'fade', style: at(1.45 + k * .07) });
    el(g, 'circle', { cx: 8.5, cy: y - 2.3, r: 4.4, fill: n.cut ? P.HERO : P.BG, stroke: n.cut ? P.HERO : P.DATA, 'stroke-width': 1 });
    txt(g, { ...F.mark, x: 8.5, y, fill: n.cut ? P.BG : P.DATA, 'text-anchor': 'middle' }, n.n);
    hl.forEach((t, m) => txt(g, { ...F.nhead, x: 18, y: r2(y + m * 9.5), fill: n.cut ? P.HERO : P.DATA }, t));
    bl.forEach((t, m) => txt(g, { ...F.nbody, x: r2(BX), y: r2(y + m * 9.5), fill: P.MUT }, t));
    tip(g, `Note ${n.n} · ${n.cut ? 'cut' : 'kept'} — ${n.head}: ${n.body} On ` +
      n.on.map(f => `${f.a.name} → ${f.b.name}`).join('; ') + '.');
  });
});
})();
