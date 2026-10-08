/* tech-design-doc · figures/matrix.js · where each field shows, and what one withheld column leaves

   QUESTION   On which screens (or tabs, files, endpoints) does each data field appear, and how many
              copies of a field stay when the design withholds one whole column?
   USE WHEN   A rule hides or masks a field, and the reader must see every place it leaks: rows =
              fields, columns = places, cell = a count. 3 to 12 rows, 3 to 8 columns.
   NOT WHEN   A cell is yes/no, not a count (use stack or a table). Counts above about 9 per cell
              (the bubbles shrink, and the matrix stops reading at a glance: use a table). The
              columns have an order of their own, such as time (use a line chart).

   ENCODING
     row           one field. Its line bows like a horizon through the columns, so the eye can
                   follow one row across. Name on the left, in capitals; its total on the right.
     column        one place. Its head is rotated -55 degrees above the bow.
     bubble        the count of places of that field in that column: AREA = count (radius =
                   k x sqrt(count)), the count written inside. A pale dot = none.
     dark row      HERO: the row the claim is about (keep it to one, two at most). Others DATA.
     band          one column inside a dashed capsule: the column the design would withhold. A
                   note under it states what stays, counted from the data.
     totals        every row's total, right of a divider; larger and HERO for a dark row.
     tooltips      every cell opens with one parsable line, "<row> · <column> · <n> place(s) —
                   <the places>", so a checker can compare the counts with the Markdown table.

   DATA (below)
     label     the aria-label. Tokens: {column}, {row}, {kept}, {all} from the band, {rows},
               {columns}, and {<row name>} = that row's total.
     columns   the column names, left to right.
     rows      [{name, field, hero, places: {column: ['place', ...]}}]. The count of a cell is
               the length of its list, so the tooltip names every place: one model, no drift.
     band      {column, row, head, line} or null. head and line take the tokens {column}, {row},
               {kept} (the places of that row outside the band column) and {all} (its total).

   LAYOUT LIMITS
     - 3 to 8 columns, 1 to 14 rows; rows sit 30 units apart, so 12 rows is about 450 units tall.
     - The row labels set the gutter, up to 150 units; a longer name stops the build.
     - The bubble scale k is 4.9 (a count of 7 has a radius of 13) and shrinks so the biggest
       bubble fits its column and row. Once a 1 is too small to hold its digit (a cell of 12 or
       more), each count too small for its digit is written above its bubble instead.
     - Column heads go up and right at -55 degrees: the top margin grows with the longest head.
       A long head over the LAST column can run past the right edge; the build then stops.
     - The band column may be any column; next to an edge its note shifts inward.

   PITFALLS SEEN IN PRACTICE
     - A radius proportional to the count. Area is the count: radius = k x sqrt(count).
     - The band note centred on a column near the edge runs off the figure. The note centres on
       its column, but it shifts inward and an elbow line keeps it pointing at the band.
     - Counts typed twice (a number in the cell, another in the text). Write the places; the
       counts, the totals and the band note all derive from them.
     - tools/shots.mjs may report two rotated heads as overlapping text boxes: the boxes of
       rotated text overlap while the parallel letters do not. Read the PNG to judge.

   Origin: the "where the report shows each value" figure of a design document (L4 Arc
   Matrix, PORCELAIN roles only). */
(() => {
/* ════ DATA · every word the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'Six data fields against five console screens: a recipient address shows in ' +
    '{Recipient address} places, and {kept} of those {all} copies stay when the design withholds the {column} screen.',
  columns: ['Inbox', 'Analytics', 'Logs', 'Billing', 'API'],
  rows: [
    { name: 'Recipient address', field: 'contacts.address', hero: true, places: {
      Inbox: ['message list', 'message detail'], Logs: ['log row', 'request payload'], API: ['request example'] } },
    { name: 'Message body', field: 'messages.body', places: {
      Inbox: ['preview line', 'message detail'], Logs: ['request payload'] } },
    { name: 'Delivery status', field: 'receipts.status', places: {
      Inbox: ['status chip'], Analytics: ['delivery-rate tile', 'funnel chart', 'failures table'],
      Logs: ['provider reply'], Billing: ['billed count'], API: ['status endpoint example'] } },
    { name: 'Click events', field: 'clicks', places: {
      Analytics: ['click-rate tile', 'link table'], Logs: ['tracking request'] } },
    { name: 'Opt-out flag', field: 'suppressions', places: {
      Inbox: ['suppressed badge'], Analytics: ['opt-out rate'], Logs: ['suppression reason'] } },
    { name: 'API key', field: 'keys.secret', places: {
      Logs: ['key prefix on each request'], API: ['key list', 'key detail'] } },
  ],
  band: { column: 'Logs', row: 'Recipient address', head: 'Withhold {column}',
    line: '{row} still shows in {kept} of {all} places' },
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'matrix';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure

const L = 4, R = 396;           // the drawing margins of the 400-wide viewBox
const SAFE = 1.08;              // measured width x SAFE: room for a reader font wider than the build font
const GUTTER_MAX = 150;         // the widest row label
const RS = 30;                  // row pitch
const BOW = 13;                 // how far the middle of each row rises: the horizon
const K = 4.9;                  // bubble radius per sqrt(count), before it shrinks to fit
const TX = R - 20, DX = TX - 18;// the totals column and its divider
const ANG = 55, SIN = Math.sin(ANG * Math.PI / 180), COS = Math.cos(ANG * Math.PI / 180);
const F = {
  row: { 'font-size': 7, 'font-weight': 700, 'letter-spacing': '.08em' },
  col: { 'font-size': 7, 'font-weight': 700, 'letter-spacing': '.08em' },
  num: { 'font-size': 7, 'font-weight': 800 },
  head: { 'font-size': 7, 'font-weight': 800, 'letter-spacing': '.1em' },
  line: { 'font-size': 6.8, 'font-weight': 700, 'letter-spacing': '.08em' },
};

const fail = msg => { throw new Error(`figures/${NAME}.js DATA: ${msg}`); };
const up = s => String(s).toUpperCase();
const r2 = v => Math.round(v * 100) / 100;
const fill = (s, v) => String(s).replace(/\{([^{}]+)\}/g, (m, k) => (Object.hasOwn(v, k) ? v[k] : m));
// measured in the page's own fonts (prelude measure), with room for a wider reader font
const width = (text, f) => textWidth(text, f) * SAFE;

/* ── the model: counts, totals and the band note, all from the places ── */
const C = DATA.columns, ROWS = DATA.rows;
if (C.length < 3 || C.length > 8) fail(`columns holds ${C.length}; draw 3 to 8`);
if (!ROWS.length || ROWS.length > 14) fail(`rows holds ${ROWS.length}; draw 1 to 14`);
ROWS.forEach(r => Object.keys(r.places || {}).forEach(c => { if (!C.includes(c)) fail(`${r.name}: "${c}" is no column`); }));
const cell = ROWS.map(r => C.map(c => (r.places || {})[c] || []));
const total = cell.map(cs => cs.reduce((t, p) => t + p.length, 0));
const vmax = Math.max(1, ...cell.flat().map(p => p.length));
const BAND = DATA.band || null, HJ = BAND ? C.indexOf(BAND.column) : -1;
if (BAND && HJ < 0) fail(`band.column "${BAND.column}" is no column`);
const BR = BAND ? ROWS.findIndex(r => r.name === BAND.row) : -1;
if (BAND && BR < 0) fail(`band.row "${BAND.row}" is no row name`);
const vars = { rows: ROWS.length, columns: C.length, ...Object.fromEntries(ROWS.map((r, i) => [r.name, total[i]])) };
if (BAND) Object.assign(vars, { column: BAND.column, row: BAND.row, all: total[BR], kept: total[BR] - cell[BR][HJ].length });

/* ── horizontal layout: gutter, columns, bubble scale ── */
const gut = Math.max(...ROWS.map(r => width(up(r.name), { ...F.row, 'font-weight': r.hero ? 800 : 700 })));
if (gut > GUTTER_MAX) fail(`a row name is ${Math.round(gut)} units wide; the gutter holds ${GUTTER_MAX}. Shorten it`);
const LX = L + gut;
const colMax = j => Math.max(0, ...cell.map(cs => cs[j].length));
const span = (DX - 18) - (LX + 18);                 // first and last column, before the bubble room
const cs0 = span / (C.length - 1);
const k = Math.min(K, (Math.min(cs0, RS) - 4) / (2 * Math.sqrt(vmax)));
const rad = v => Math.sqrt(v) * k;
const c0 = LX + Math.max(14, rad(colMax(0)) + 5), cN = DX - Math.max(16, rad(colMax(C.length - 1)) + 6);
const cs = (cN - c0) / (C.length - 1);
const colX = j => r2(c0 + j * cs), dy = j => r2(-BOW * Math.sin(Math.PI * j / (C.length - 1)));
const inside = v => rad(v) >= 4.8;                  // can the bubble hold its own digit?

/* ── vertical layout: the top margin holds the rotated heads ── */
const BW = BAND ? Math.max(14, rad(colMax(HJ)) + 3) : 0;   // the half-width of the band capsule
const HOFF = Math.max(16, rad(Math.max(0, ...cell[0].map(p => p.length))) + 9, BW + 8);
const headW = C.map(c => width(up(c), F.col)), totW = width('TOTAL', F.col);
const Y0 = r2(Math.max(...C.map((_, j) => HOFF - dy(j) + headW[j] * SIN + 7), HOFF + totW * SIN + 7, 40));
C.forEach((c, j) => {
  if (colX(j) - 2 + headW[j] * COS + 4 > R + 2) fail(`the head "${c}" runs past the right edge; shorten it`);
});
const rowY = i => r2(Y0 + i * RS), last = ROWS.length - 1;
const bt = BAND ? r2(rowY(0) + dy(HJ) - BW) : 0, bb = BAND ? r2(rowY(last) + dy(HJ) + BW) : 0;
const noteHead = BAND ? up(fill(BAND.head, vars)) : '', noteLine = BAND ? up(fill(BAND.line, vars)) : '';
const noteW = BAND ? Math.max(width(noteHead, F.head), width(noteLine, F.line)) : 0;
const bx = BAND ? colX(HJ) : 0;
const nx = BAND ? r2(Math.min(Math.max(bx, L + noteW / 2), R - noteW / 2)) : 0;
const H = r2(BAND ? bb + 38 : rowY(last) + Math.max(14, rad(vmax) + 6));

figure(NAME, { h: H, label: fill(DATA.label, vars) }, s => {
  /* the band: the column the design would withhold */
  const bandTip = BAND ? `${fill(BAND.head, vars)}: ${BAND.row} keeps ${vars.kept} of its ${vars.all} places — ` +
    C.map((c, j) => [c, cell[BR][j]]).filter(([c, p]) => c !== BAND.column && p.length).map(([c, p]) => `${c}: ${p.join(', ')}`).join('; ') : '';
  if (BAND) tip(el(s, 'rect', { x: r2(bx - BW), y: bt, width: r2(2 * BW), height: r2(bb - bt), rx: r2(BW), fill: P.FAINTDATA,
    'fill-opacity': .22, stroke: P.FAINT, 'stroke-width': .9, 'stroke-dasharray': '2 3', class: 'fade', style: at(1.1) }), bandTip);
  /* the divider before the totals */
  el(s, 'line', { x1: DX, y1: r2(Y0 - 16), x2: DX, y2: r2(rowY(last) + 12), stroke: P.GRID, 'stroke-width': .9,
    class: 'fade', style: at(.2) });

  ROWS.forEach((r, i) => {
    const hero = !!r.hero, col = hero ? P.HERO : P.DATA, d0 = i * .06;
    el(s, 'path', { d: 'M' + C.map((_, j) => `${colX(j)} ${r2(rowY(i) + dy(j))}`).join(' L '), fill: 'none',
      stroke: hero ? P.FAINTDATA : P.GRID, 'stroke-width': hero ? 1.4 : 1, pathLength: 1, class: 'draw', style: at(d0) });
    tip(txt(s, { ...F.row, x: r2(LX), y: r2(rowY(i) + 2.6), 'font-weight': hero ? 800 : 700, fill: hero ? P.HERO : P.MUT,
      'text-anchor': 'end', class: 'fade', style: at(d0) }, up(r.name)), `${r.name} — field ${r.field}`);
    let screens = 0;
    C.forEach((c, j) => {
      const x = colX(j), y = r2(rowY(i) + dy(j)), places = cell[i][j], v = places.length, d = .25 + i * .06 + j * .03;
      if (!v) { tip(el(s, 'circle', { cx: x, cy: y, r: 1.1, fill: P.FAINTDATA, class: 'pop', style: at(d) }), `${r.name} · ${c} · 0 places`); return; }
      screens++;
      const g = el(s, 'g', {});
      el(g, 'circle', { cx: x, cy: y, r: r2(rad(v)), fill: col, class: 'pop', style: at(d) });
      if (inside(v)) txt(g, { ...F.num, x, y: r2(y + 2.5), fill: P.BG, 'text-anchor': 'middle', 'pointer-events': 'none',
        class: 'fade', style: at(d + .3) }, v);
      else txt(g, { ...F.num, 'font-size': 6.5, x, y: r2(y - rad(v) - 2), fill: col, 'text-anchor': 'middle', class: 'fade', style: at(d + .3) }, v);
      tip(g, `${r.name} · ${c} · ${v} place${v === 1 ? '' : 's'} — ${places.join(' · ')}`);
    });
    tip(txt(s, { x: TX, y: r2(rowY(i) + (hero ? 4 : 3.2)), 'font-size': hero ? 11 : 8.5, 'font-weight': 800, fill: col,
      'text-anchor': 'middle', class: 'fade', style: at(.7 + i * .06) }, total[i]),
      `${r.name} — ${total[i]} place${total[i] === 1 ? '' : 's'} on ${screens} of ${C.length} ${C.length === 1 ? 'column' : 'columns'}`);
  });

  /* column heads, rotated up and right above the bow; the band column is darker */
  C.concat('Total').forEach((c, j) => {
    const tot = j === C.length, x = r2(tot ? TX - 4 : colX(j) - 2), y = r2(tot ? Y0 - HOFF : rowY(0) + dy(j) - HOFF);
    const n = txt(s, { ...F.col, x, y, fill: j === HJ ? P.TXT : P.MUT, transform: `rotate(-${ANG} ${x} ${y})`,
      class: 'fade', style: at(j * .04) }, up(c));
    tip(n, tot ? 'Total: every place of the field, in every column' :
      `${c}: ${cell.reduce((t, cs) => t + cs[j].length, 0)} places of ${ROWS.filter((_, i) => cell[i][j].length).length} fields`);
  });

  /* the band note: what stays when the design withholds that column */
  if (BAND) {
    el(s, 'path', { d: nx === bx ? `M${bx} ${bb}V${r2(bb + 12)}` : `M${bx} ${bb}V${r2(bb + 6)}H${nx}V${r2(bb + 12)}`,
      fill: 'none', stroke: P.FAINT, 'stroke-width': .9, class: 'fade', style: at(1.2) });
    const g = el(s, 'g', { class: 'fade', style: at(1.25) });
    txt(g, { ...F.head, x: nx, y: r2(bb + 22), fill: P.HERO, 'text-anchor': 'middle' }, noteHead);
    txt(g, { ...F.line, x: nx, y: r2(bb + 32), fill: P.MUT, 'text-anchor': 'middle' }, noteLine);
    tip(g, bandTip);
  }
});
})();
