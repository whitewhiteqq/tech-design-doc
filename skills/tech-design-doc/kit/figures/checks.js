/* tech-design-doc · figures/checks.js · the checks a request passes, in order, and what each failure returns

   QUESTION   Which checks does a request pass, in what order, and what does each failed check
              return? Where do two entries join, and which exits write an audit line?
   USE WHEN   The design is a gate: authentication, authorization, validation, limits. 1 to 3
              entries, up to about 12 checks and steps, each check with its own status code.
   NOT WHEN   The point is which component calls which (use system), or the order of messages in
              time (use sequence). A check that branches into two long paths: draw two figures.

   ENCODING
     dashed box     a zone: where the checks run (a gateway, a service). The name sits on the top
                    border, over the text column.
     column         an entry and the checks that only it passes. 1 to 3 columns sit side by side,
                    then they join, and the shared checks run down the full width.
     ring           an entry: where a request comes in.
     dot            a step that always runs. HERO dot = a step the claim is about.
     diamond        a check. Down = the request passes. Right = the request stops here; the small
                    word over the arrow (NO, YES) says which answer stops it. The arrow is DATA2 to
                    a stop, DATA to an early success. HERO diamond = the check the claim is about.
     outlined chip  deny: an error status code.
     pale chip      stop: the request ends without an error (204, 304).
     filled chip    ok: a success code; the filled chip on the spine is the end of the flow.
     dotted line    the audit line: every exit that writes one connects to it.
     bracket        an optional note over a run of steps.
     tooltips       every zone, row, exit (arrow, word, cap and chip), join and audit mark. A row opens
                    with one parsable line: "<text> · <exit word> → <code> — <tip>"; an exit opens
                    with "<code> · <text> — <tip>".

   DATA (below)
     label     the aria-label: one sentence that states the finding.
     lanes     [{zone, tip, join, rows}]   the entries, left to right. zone: the name of the dashed
               box around the column (leave it out for no box). join: the words over the line where
               the column joins the first column.
     tail      {zone, tip, rows}           the checks every entry passes, down the full width.
     rows      [{kind, text, sub, code, chip, exit, cap, audit, hero, tip, codeTip}]
               kind     'entry' | 'step' | 'check' | 'end'. A row with a code and no kind is a check.
               text     the step, or the check as a question. sub: plain lines under it.
               code     the status code on the chip of a check, or of the end.
               chip     'deny' (the default for a check) | 'stop' | 'ok'.
               exit     the answer that stops the request: 'no' or 'yes'.
               cap      a few words under the arrow, before the chip.
               audit    true: this exit writes an audit line.
     emphasis  optional {from, to, title, lines, tip}: a bracket over tail rows from..to (steps).
     audit     optional {name, text, text2, tip}: the note under the audit line.

   LAYOUT LIMITS
     - Two columns read best. A column is 194 units wide at 2 columns, 128 at 3. A question wraps
       before the exit word and the chip. When it needs more than two lines there, it rises over the
       chip and wraps at the full column width; its row grows.
     - The full-width checks put their chips at x ~ 326. A question there holds about 55 characters
       on one line; a longer one wraps.
     - A chip code holds a short code (401, 429, 204). A longer code widens every chip of its column.
     - The height follows the data: about 25 to 35 units per row.
     - The emphasis bracket sits right of the text of its rows: give it rows with no chip (steps).

   PITFALLS SEEN IN PRACTICE
     - A deny that reads as a success. Exit words and chip fills carry it: write exit 'yes' when
       the yes answer stops the request.
     - The cap and the first sub line meet under the arrow. The figure narrows the sub lines of a
       row that has a cap; read the PNG anyway.
     - A status code that the text does not use. Keep one source: write the codes here, and let a
       checker compare the chip tooltips with the table in the Markdown.
     - A join label that crosses the first column. Keep it short, or it wraps.

   Origin: the flowchart of a design document (hairline spines, diamonds,
   capsule chips, capitals with letter spacing, PORCELAIN roles only). */
(() => {
/* ════ DATA · every word the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'Every send, from the API or from the scheduler, passes the same checks in order: a failed ' +
    'check stops it with its own status code, an opted-out recipient gets 204, and only a send that ' +
    'passes every check gets 202 Accepted.',
  lanes: [
    { zone: 'API gateway',
      tip: 'The public entry point. It checks the token of every request and decides nothing else.',
      rows: [
        { kind: 'entry', text: 'API send', sub: ['POST /v1/messages', 'Bearer token of the tenant'],
          tip: 'A client app sends POST /v1/messages, with the API token of the tenant in the ' +
            'Authorization header.' },
        { text: 'Token valid?', exit: 'no', code: '401', sub: ['before the Relay API runs'],
          tip: 'The gateway checks the signature and the expiry of the token.',
          codeTip: '401 comes from the gateway, before the Relay API runs. The gateway writes no audit line.' },
      ] },
    { zone: 'Scheduler', join: 'The scheduled send joins here',
      tip: 'The scheduler of Relay. It starts each stored schedule at its send_at time.',
      rows: [
        { kind: 'entry', text: 'Scheduled send', sub: ['the scheduler fires at send_at',
          'no token: the API checked it when the schedule was made'],
          tip: 'A schedule that is due. The Relay API checked its token when the client created it, ' +
            'so this entry carries no token.' },
      ] },
  ],
  tail: { zone: 'Relay API',
    tip: 'The Relay API runs every check below, for both entries, in this order.',
    rows: [
      { text: 'Tenant active?', exit: 'no', code: '403', audit: true, sub: ['a suspended tenant sends nothing'],
        tip: 'The Relay API reads the state of the tenant from the config store.',
        codeTip: '403: the tenant is suspended or closed.' },
      { text: 'Template exists?', exit: 'no', code: '404', audit: true, sub: ['the template id in the request'],
        tip: 'The Relay API looks up the template id of the request, for this tenant only.',
        codeTip: '404: no template has this id for this tenant. The reply never tells which ids exist.' },
      { text: 'Within the rate limit?', exit: 'no', code: '429', audit: true, sub: ['per tenant, per minute'],
        tip: 'The Relay API counts the sends of the tenant in the current minute.',
        codeTip: '429 with a Retry-After header: the tenant sent more messages this minute than its plan allows.' },
      { text: 'Recipient opted out?', exit: 'yes', code: '204', chip: 'stop', cap: 'suppressed · logged',
        audit: true, hero: true,
        tip: 'The Relay API checks the opt-out list before it queues anything, for both entries.',
        codeTip: '204: Relay suppresses the message and logs it. A recipient who opted out never gets a message.' },
      { text: 'Provider reachable?', exit: 'no', code: '503', cap: 'retried later', audit: true,
        tip: 'The Relay API checks the health of the provider for the channel of the message.',
        codeTip: '503 with a Retry-After header: the provider is down. The client, or the scheduler, retries later.' },
      { kind: 'end', code: '202', text: 'Accepted · one job on the queue', audit: true,
        tip: 'The Relay API puts one job on the queue and answers 202 Accepted with the job id.' },
    ] },
  audit: { name: 'Audit line', text: 'every exit after the gateway · tenant · template · outcome · latency',
    text2: 'never a message body or a recipient address',
    tip: 'One metadata line per request: request id, tenant, template id, outcome, latency. ' +
      'Never a token, a message body or a recipient address.' },
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'checks';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure

const W = 400, M = 4;           // the zone boxes span x 4 to 396
const ZTOP = 8;                 // the top border of the entry zones
const SX = 20, TX = 32;         // the spine and the text column, from the left side of a column
const CHIP_H = 13;              // the height of a status chip
const RX = 384;                 // the x of the audit collector, right of the full-width chips
const GAP = 5, SPINE = 11;      // the least gap between the text of two rows; the least spine between two marks
const LINE = 9.5;               // the pitch of the sub lines
const SAFE = 1.08;              // measured width x SAFE: room for a reader font wider than the build font
const RAD = { entry: 3.5, step: 5, check: 6.5, end: CHIP_H / 2 };
const F = {
  zone: { 'font-size': 6.8, 'font-weight': 700, 'letter-spacing': '.12em' },
  text: { 'font-size': 7.6, 'font-weight': 700 },
  sub: { 'font-size': 6.8, 'font-weight': 500 },
  end: { 'font-size': 7, 'font-weight': 600 },
  code: { 'font-size': 8.5, 'font-weight': 800, 'letter-spacing': '.04em' },
  word: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.1em' },
  cap: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.08em' },
  join: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.1em' },
  note: { 'font-size': 7, 'font-weight': 800, 'letter-spacing': '.08em' },
  aname: { 'font-size': 7, 'font-weight': 800, 'letter-spacing': '.1em' },
};
const HALO = `paint-order:stroke;stroke:${P.BG};stroke-width:4px;stroke-linejoin:round;`;

const fail = msg => { throw new Error(`figures/${NAME}.js DATA: ${msg}`); };
const up = s => String(s).toUpperCase();
const r2 = v => Math.round(v * 100) / 100;

// measured in the page's own fonts (prelude measure), with room for a wider reader font
const width = (text, f) => textWidth(text, f) * SAFE;
const greedy = (text, f, max) => {
  const lines = [];
  let cur = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && width(next, f) > max) { lines.push(cur); cur = word; } else cur = next;
  }
  return cur ? lines.concat(cur) : lines;
};
// balanced: the narrowest measure that keeps the same number of lines, so no line ends in one lone word
const wrap = (text, f, max) => {
  const lines = greedy(text, f, max);
  if (lines.length < 2) return lines;
  let lo = max / lines.length, hi = max;
  for (let i = 0; i < 12; i++) {
    const m = (lo + hi) / 2;
    if (greedy(text, f, m).length > lines.length) lo = m; else hi = m;
  }
  return greedy(text, f, hi);
};

/* ── the columns: one per entry, side by side; the full-width tail uses the spine of the first ── */
const NL = DATA.lanes.length;
if (NL < 1 || NL > 3) fail(`lanes holds ${NL} entries; the figure draws 1 to 3`);
const LW = (W - 2 * M - (NL - 1) * 4) / NL;
const chipW = rows => Math.max(30, ...rows.filter(r => r.code).map(r => width(r.code, F.code) + 14));
const lanes = DATA.lanes.map((ln, i) => {
  const x = M + i * (LW + 4), cw = chipW(ln.rows);
  return { ...ln, i, x, w: LW, sx: x + SX, tx: x + TX, cw, cx: x + LW - 10 - cw, right: x + LW - 8 };
});
const tcw = chipW(DATA.tail.rows);
const tail = { ...DATA.tail, x: M, w: W - 2 * M, sx: lanes[0].sx, tx: lanes[0].tx, cw: tcw, cx: RX - 26 - tcw, right: RX - 8 };
if (NL === 1) Object.assign(lanes[0], { cw: Math.max(lanes[0].cw, tcw), cx: tail.cx, right: tail.right });  // one chip column

/* ── rows: wrap the text to the column, and measure how far each row reaches above and below its centre ── */
const KINDS = ['entry', 'step', 'check', 'end'];
const rowsOf = (col, where) => col.rows.map((r, k) => {
  const kind = r.kind || (r.code ? 'check' : 'step');
  if (!KINDS.includes(kind)) fail(`${where} row ${k}: kind "${r.kind}" is not entry, step, check or end`);
  if ((kind === 'check' || kind === 'end') && !r.code) fail(`${where} row ${k} ("${r.text}"): a ${kind} needs a code`);
  const chip = kind === 'end' ? 'ok' : r.chip || 'deny';
  if (!['deny', 'stop', 'ok'].includes(chip)) fail(`${where} row ${k}: chip "${r.chip}" is not deny, stop or ok`);
  const o = { ...r, kind, chip, col, where: `${where} row ${k}` };
  const wide = col.right - col.tx;
  if (kind === 'check') {
    o.word = r.exit ? up(r.exit) : '';
    const ww = o.word ? width(o.word, F.word) + 6 : 0, beside = col.cx - 8 - ww - col.tx;
    o.q = beside >= 40 ? wrap(r.text, F.text, beside) : [];
    o.lift = 0;                                     // too narrow beside the chip: the question rises over it
    if (!o.q.length || o.q.length > 2) { o.q = wrap(r.text, F.text, wide); o.lift = 7.4; }
    o.capW = r.cap ? width(up(r.cap), F.cap) : 0;
    o.sub = (r.sub || []).flatMap(t => wrap(t, F.sub, r.cap ? col.cx - 16 - o.capW - col.tx : wide));
    o.above = Math.max(RAD.check, 3.8 + o.lift + 5.6 + (o.q.length - 1) * 9.5);
    o.below = Math.max(RAD.check + 1, o.sub.length ? 12 + (o.sub.length - 1) * LINE + 2.5 : 0, r.cap ? 12 : 0);
  } else if (kind === 'end') {
    o.ex = col.sx + Math.max(15, col.cw / 2) + 6;  // the text right of the chip on the spine
    o.q = wrap(r.text, F.end, col.right - o.ex);
    o.sub = (r.sub || []).flatMap(t => wrap(t, F.sub, col.right - o.ex));
    o.above = Math.max(RAD.end, (o.q.length - 1) * 9.5 / 2 + 5);
    o.below = Math.max(RAD.end + 1, o.sub.length ? 13 + (o.sub.length - 1) * LINE + 2.5 : 0);
  } else {
    o.q = wrap(r.text, F.text, wide);
    o.sub = (r.sub || []).flatMap(t => wrap(t, F.sub, wide));
    o.above = 6;
    o.below = Math.max(RAD[kind] + 1, (o.q.length - 1) * 9.5 + (o.sub.length ? 13 + (o.sub.length - 1) * LINE + 2.5 : 5));
  }
  return o;
});
const stack = (rows, top) => {                       // y = the centre of each mark, top to bottom
  rows.forEach((r, k) => {
    const p = rows[k - 1];
    r.y = !p ? top + r.above
      : Math.max(p.y + p.below + GAP + r.above, p.y + RAD[p.kind] + 3 + SPINE + RAD[r.kind]);
  });
  const last = rows[rows.length - 1];
  return last.y + last.below;
};
lanes.forEach(ln => { if (!ln.rows.length) fail(`lanes[${ln.i}] holds no row`); ln.R = rowsOf(ln, `lanes[${ln.i}]`); });
if (!tail.rows.length) fail('tail holds no row');
tail.R = rowsOf(tail, 'tail');
if (tail.R.slice(0, -1).some(r => r.kind === 'end')) fail('tail: only the last row may be the end');
lanes.forEach(ln => { if (ln.R.some(r => r.kind === 'end')) fail(`lanes[${ln.i}]: an end belongs in the tail`); });

/* ── the layout in y: columns, then the joins, then the tail, then the audit line ── */
const laneBottom = Math.max(...lanes.map(ln => stack(ln.R, ZTOP + 13)));
const zoneBottom = laneBottom + 8;
const tailTop = zoneBottom + 6;
let joinY = tailTop + 7.5;
const joins = lanes.slice(1).map(ln => {
  const room = ln.sx - 8 - (lanes[0].sx + 8);
  const lines = ln.join ? wrap(up(ln.join), F.join, room) : [];
  joinY += 8.5 + Math.max(1, lines.length) * 8.5;   // the label lines, then the line itself
  return { ln, y: joinY, lines };
});
const joinBottom = joins.length ? joins[joins.length - 1].y : tailTop + 4;
const tailRowsBottom = stack(tail.R, joinBottom + 9);
const endRow = tail.R[tail.R.length - 1];
const audited = tail.R.filter(r => r.audit && r.kind !== 'end');
const A = DATA.audit;
const YA = A ? tailRowsBottom + 12 : tailRowsBottom;
const aText = A ? [A.text, A.text2].filter(Boolean).map((t, k) => wrap(t, F.sub,
  RX - tail.tx - (k ? 0 : width(up(A.name), F.aname) + 6))) : [];
const auditLines = A ? [...aText[0].map((t, j) => ({ t, first: j === 0 })), ...(aText[1] || []).map(t => ({ t }))] : [];
const tailBottom = (A ? YA + 12 + (auditLines.length - 1) * 10 + 3 : tailRowsBottom) + 8;
const H = r2(tailBottom + 4);

/* ── emphasis: a bracket right of the text of a run of tail steps ── */
let EM = null;
if (DATA.emphasis) {
  const E = DATA.emphasis, run = tail.R.slice(E.from, E.to + 1);
  if (!run.length || E.from > E.to) fail(`emphasis: from ${E.from} to ${E.to} names no tail rows`);
  if (run.some(r => r.kind === 'check')) fail('emphasis: a bracket over a check would cross its arrow; bracket steps only');
  const textR = Math.max(...run.map(r => r.col.tx + Math.max(...r.q.map(t => width(t, F.text)), ...r.sub.map(t => width(t, F.sub)))));
  const bx = textR + 14, noteW = RX - 4 - (bx + 8);
  if (noteW < 70) fail(`emphasis: the rows reach x ${r2(textR)}, so the note keeps ${r2(noteW)} units; shorten the rows`);
  const y0 = run[0].y - run[0].above + 2, y1 = run[run.length - 1].y + run[run.length - 1].below - 2;
  const head = wrap(up(E.title), F.note, noteW), lines = (E.lines || []).flatMap(t => wrap(t, F.sub, noteW));
  EM = { ...E, bx, y0, y1, head, lines };
}

figure(NAME, { h: H, label: DATA.label }, s => {
  const arrow = (x, y, dir, fill, d, parent = s) => {
    const p = dir === 'down' ? `M${r2(x - 2.3)} ${r2(y - 4)}L${r2(x + 2.3)} ${r2(y - 4)}L${r2(x)} ${r2(y)}Z`
      : dir === 'left' ? `M${r2(x + 4)} ${r2(y - 2.3)}L${r2(x + 4)} ${r2(y + 2.3)}L${r2(x)} ${r2(y)}Z`
      : `M${r2(x - 4)} ${r2(y - 2.3)}L${r2(x - 4)} ${r2(y + 2.3)}L${r2(x)} ${r2(y)}Z`;
    el(parent, 'path', { d: p, fill, class: 'fade', style: at(d) });
  };
  const spine = (x, y1, y2, hero, d) => {
    el(s, 'line', { x1: r2(x), y1: r2(y1), x2: r2(x), y2: r2(y2 - 3), stroke: hero ? P.HERO : P.DATA,
      'stroke-width': hero ? 1.6 : 1.2, pathLength: 1, class: 'draw', style: `${at(d)};animation-duration:.45s` });
    arrow(x, y2, 'down', hero ? P.HERO : P.DATA, d + .3);
  };
  const dots = { stroke: P.MUT, 'stroke-width': .9, 'stroke-dasharray': '1.2 2' };
  const say = r => `${r.text}${r.code ? ` · ${r.word ? `${r.word.toLowerCase()} ` : ''}→ ${r.code}` : ''} — ${r.tip}`;

  /* zones: one box per column, one for the tail */
  const boxes = lanes.filter(ln => ln.zone).map(ln => ({ x: ln.x, y: ZTOP, w: ln.w, h: zoneBottom - ZTOP, tx: ln.tx, name: ln.zone, tip: ln.tip }));
  if (tail.zone) boxes.push({ x: tail.x, y: tailTop, w: tail.w, h: tailBottom - tailTop, tx: tail.tx, name: tail.zone, tip: tail.tip });
  boxes.forEach((b, i) => {
    tip(el(s, 'rect', { x: r2(b.x), y: r2(b.y), width: r2(b.w), height: r2(b.h), rx: 10, fill: 'none', stroke: P.GRID,
      'stroke-width': .9, 'stroke-dasharray': '3 3', class: 'fade', style: at(i * .08) }), `${b.name} — ${b.tip}`);
    tip(txt(s, { ...F.zone, x: r2(b.tx), y: r2(b.y + 2.4), fill: P.MUT, class: 'fade', style: HALO + at(.05 + i * .08) },
      up(b.name)), `${b.name} — ${b.tip}`);
  });

  /* rows: spine, mark, text, exit */
  const rows = (col, list, t0) => list.forEach((r, k) => {
    const d = t0 + k * .11, y = r.y, rad = RAD[r.kind], p = list[k - 1];
    if (p) spine(col.sx, p.y + RAD[p.kind] + 1.5, y - rad - 1.5, r.hero && p.hero, d - .1);
    const g = el(s, 'g', {});
    const subs = (y0, x = col.tx) => r.sub.forEach((t, j) => txt(g, { ...F.sub, x: r2(x), y: r2(y0 + j * LINE), fill: P.MUT,
      class: 'fade', style: at(d + .08 + j * .04) }, t));
    if (r.kind === 'entry' || r.kind === 'step') {
      el(g, 'circle', r.kind === 'entry'
        ? { cx: col.sx, cy: r2(y), r: rad, fill: P.BG, stroke: P.DATA, 'stroke-width': 1.2, class: 'pop', style: at(d) }
        : { cx: col.sx, cy: r2(y), r: rad, fill: r.hero ? P.HERO : P.DATA, class: 'pop', style: at(d) });
      r.q.forEach((t, j) => txt(g, { ...F.text, x: r2(col.tx), y: r2(y + 2.8 + j * 9.5), fill: r.hero ? P.HERO : P.TXT,
        class: 'fade', style: at(d + .05) }, t));
      subs(y + 13 + (r.q.length - 1) * 9.5);
    } else if (r.kind === 'check') {
      el(g, 'path', { d: `M${col.sx} ${r2(y - rad)}L${r2(col.sx + rad)} ${r2(y)}L${col.sx} ${r2(y + rad)}L${r2(col.sx - rad)} ${r2(y)}Z`,
        fill: r.hero ? P.HERO : P.BG, stroke: r.hero ? P.HERO : P.DATA, 'stroke-width': 1.3, 'stroke-linejoin': 'round',
        class: 'pop', style: at(d) });
      r.q.forEach((t, j) => txt(g, { ...F.text, x: r2(col.tx), y: r2(y - 3.8 - r.lift - (r.q.length - 1 - j) * 9.5),
        fill: r.hero ? P.HERO : P.TXT, 'font-weight': r.hero ? 800 : 700, class: 'fade', style: at(d + .05) }, t));
      subs(y + 12);
      const ok = r.chip === 'ok', col2 = ok ? P.DATA : P.DATA2, xg = el(s, 'g', {});   // the exit: arrow, word, cap, chip
      el(xg, 'line', { x1: r2(col.sx + rad + 1.5), y1: r2(y), x2: r2(col.cx - 4.5), y2: r2(y), stroke: col2,
        'stroke-width': 1.1, pathLength: 1, class: 'draw', style: `${at(d + .1)};animation-duration:.5s` });
      arrow(col.cx - .8, y, 'right', col2, d + .45, xg);
      if (r.word) txt(xg, { ...F.word, x: r2(col.cx - 7.5), y: r2(y - 3.8), fill: P.MUT, 'text-anchor': 'end',
        class: 'fade', style: at(d + .4) }, r.word);
      if (r.cap) txt(xg, { ...F.cap, x: r2(col.cx - 8), y: r2(y + 10), fill: P.MUT, 'text-anchor': 'end',
        class: 'fade', style: at(d + .4) }, up(r.cap));
      const cg = el(xg, 'g', { class: 'fade', style: at(d + .45) });
      el(cg, 'rect', { x: r2(col.cx), y: r2(y - CHIP_H / 2), width: r2(col.cw), height: CHIP_H, rx: CHIP_H / 2,
        fill: ok ? P.DATA : r.chip === 'stop' ? P.FAINTDATA : P.BG, stroke: ok ? P.DATA : r.chip === 'stop' ? 'none' : P.DATA,
        'stroke-width': 1.2 });
      txt(cg, { ...F.code, x: r2(col.cx + col.cw / 2), y: r2(y + 3.2), fill: ok ? P.BG : r.chip === 'stop' ? P.TXT : P.DATA,
        'text-anchor': 'middle' }, r.code);
      tip(xg, `${r.code} · ${r.text} — ${r.codeTip || r.tip}`);
      if (r.audit) {
        const ax = col.cx + col.cw + 1.5;
        if (col === tail) tip(el(s, 'line', { x1: r2(ax), y1: r2(y), x2: RX, y2: r2(y), ...dots, class: 'fade', style: at(d + .55) }),
          `audit · ${r.code} — this exit writes an audit line`);
        else {
          tip(el(s, 'line', { x1: r2(ax), y1: r2(y), x2: r2(ax + 4), y2: r2(y), ...dots, class: 'fade', style: at(d + .55) }),
            `audit · ${r.code} — this exit writes an audit line`);
          el(s, 'circle', { cx: r2(ax + 5.4), cy: r2(y), r: 1.4, fill: P.MUT, class: 'fade', style: at(d + .55) });
        }
      }
    } else {                                          // the end: a filled chip on the spine
      const cw = Math.max(30, col.cw);
      el(g, 'rect', { x: r2(col.sx - cw / 2), y: r2(y - CHIP_H / 2), width: r2(cw), height: CHIP_H, rx: CHIP_H / 2,
        fill: P.DATA, class: 'pop', style: at(d) });
      txt(g, { ...F.code, x: r2(col.sx), y: r2(y + 3.2), fill: P.BG, 'text-anchor': 'middle', class: 'fade', style: at(d + .05) }, r.code);
      const top = y + 2.6 - (r.q.length - 1) * 9.5 / 2;
      r.q.forEach((t, j) => txt(g, { ...F.end, x: r2(r.ex), y: r2(top + j * 9.5), fill: P.TXT, class: 'fade',
        style: at(d + .08) }, t));
      subs(y + 13 + (r.q.length - 1) * 9.5 / 2, r.ex);
    }
    tip(g, say(r));
  });
  lanes.forEach((ln, i) => rows(ln, ln.R, .15 + i * .2));

  /* the joins: the first column runs straight down; every other column turns left into it */
  const first = tail.R[0], l0 = lanes[0], last0 = l0.R[l0.R.length - 1];
  const tJoin = .25 + Math.max(...lanes.map(ln => ln.R.length)) * .11;
  spine(l0.sx, last0.y + RAD[last0.kind] + 1.5, first.y - RAD[first.kind] - 1.5, false, tJoin);
  joins.forEach(({ ln, y, lines }, k) => {
    const lastR = ln.R[ln.R.length - 1];
    tip(el(s, 'path', { d: `M${r2(ln.sx)} ${r2(lastR.y + RAD[lastR.kind] + 1.5)}V${r2(y - 4)}Q${r2(ln.sx)} ${r2(y)} ${r2(ln.sx - 4)} ${r2(y)}H${r2(l0.sx + 5)}`,
      fill: 'none', stroke: P.DATA, 'stroke-width': 1.2, pathLength: 1, class: 'draw',
      style: `${at(tJoin + k * .1)};animation-duration:.6s` }), `${ln.join || 'join'} — the ${ln.R[0].text} entry continues with the checks below`);
    arrow(l0.sx + 1.5, y, 'left', P.DATA, tJoin + .4 + k * .1);
    lines.forEach((t, j) => tip(txt(s, { ...F.join, x: r2(ln.sx - 8), y: r2(y - 4 - (lines.length - 1 - j) * 8.5),
      fill: P.MUT, 'text-anchor': 'end', class: 'fade', style: at(tJoin + .3 + k * .1) }, t),
      `${ln.join} — the ${ln.R[0].text} entry continues with the checks below`));
  });
  rows(tail, tail.R, tJoin + .3);

  /* emphasis */
  if (EM) {
    const d = tJoin + .3 + tail.R.length * .11;
    el(s, 'path', { d: `M${r2(EM.bx - 4)} ${r2(EM.y0)}H${r2(EM.bx)}V${r2(EM.y1)}H${r2(EM.bx - 4)}`, fill: 'none',
      stroke: P.HERO, 'stroke-width': 1.2, pathLength: 1, class: 'draw', style: `${at(d)};animation-duration:.6s` });
    const block = EM.head.length * 9 + EM.lines.length * LINE;
    let y = (EM.y0 + EM.y1) / 2 - block / 2 + 6;
    const g = el(s, 'g', { class: 'fade', style: at(d + .2) });
    EM.head.forEach(t => { txt(g, { ...F.note, x: r2(EM.bx + 8), y: r2(y), fill: P.HERO }, t); y += 9; });
    y += 2;
    EM.lines.forEach(t => { txt(g, { ...F.sub, x: r2(EM.bx + 8), y: r2(y), fill: P.MUT }, t); y += LINE; });
    tip(g, `${EM.title} — ${EM.tip || EM.lines.join(' ')}`);
  }

  /* the audit line: every audited exit of the tail joins one dotted loop under the flow */
  if (A) {
    const d = tJoin + .4 + tail.R.length * .11, ends = [];
    if (audited.length) ends.push(el(s, 'line', { x1: RX, y1: r2(audited[0].y), x2: RX, y2: r2(YA), ...dots, class: 'fade', style: at(d) }));
    if (endRow.kind === 'end' && endRow.audit)
      ends.push(el(s, 'line', { x1: r2(tail.sx), y1: r2(endRow.y + CHIP_H / 2 + 1.5), x2: r2(tail.sx), y2: r2(YA), ...dots,
        class: 'fade', style: at(d) }));
    ends.push(el(s, 'line', { x1: r2(tail.sx), y1: r2(YA), x2: RX, y2: r2(YA), ...dots, class: 'fade', style: at(d + .05) }));
    ends.forEach(n => tip(n, `${A.name} — ${A.tip}`));
    const g = el(s, 'g', { class: 'fade', style: at(d + .15) });
    auditLines.forEach(({ t, first: f }, j) => {
      const n = txt(g, { ...F.sub, x: r2(tail.tx), y: r2(YA + 12 + j * 10), fill: P.MUT }, '');
      if (f) { const k = el(n, 'tspan', { ...F.aname, fill: P.TXT }); k.textContent = up(A.name); el(n, 'tspan', {}).textContent = `  ${t}`; }
      else n.textContent = t;
    });
    tip(g, `${A.name} — ${A.tip}`);
  }
});
})();
