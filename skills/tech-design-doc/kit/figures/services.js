/* tech-design-doc · figures/services.js · what we run, where it runs, and who bills it, in the vendors' own marks

   QUESTION   What do we run, and who bills us? Which managed services make up the system, inside
              which account or network, and which side of each boundary is ours?
   USE WHEN   The reader plans a deployment, a cost estimate, an ops hand-over or a blast radius:
              4 to 12 boxes in 1 to 4 boundaries (a cloud account, a region, a tenant, the client
              side). Number the calls only where order matters.
   NOT WHEN   The point is a flow, a rule or a decision. One service is one mark, so a mark cannot
              split one service into the routes a design depends on: draw that with system (which
              component decides) or checks (what each route checks). Keep the flow figure for the
              story, and draw this one for a different reader. More than about 12 boxes: a reader
              stops tracing arrows and starts skimming, so split by boundary or by altitude.

   ENCODING
     dashed box    a boundary: where billing or trust changes (an account, a region, a VPC, the
                   client side). The name sits on the top border.
     mark          a service we run: the vendor's own icon, unmodified, from icons.js. Under it, the
                   product name as the vendor writes it (ICONS[key].label) in capitals, then the part
                   it plays (name), then what it does (lines).
     plain card    a thing we do not run and do not pay for, such as the client apps: no mark.
     dark card     HERO: the one service the claim is about. Its text block sits on a dark card; the
                   mark above it never changes.
     solid arrow   a call, DATA, in the direction the call travels. The disc on it is the step number.
     dashed arrow  a reply or a callback, DATA2.
     thin arrow    a call with no step, such as a read from a store or a log write.
     credit line   the vendor credit, inside the SVG at the foot, so the credit travels with the marks.
     tooltips      every boundary, service, wire, disc and label. A wire opens with one parsable line:
                   "<n> · <from> → <to> · <label> — <tip>", the grammar of system, so a checker can
                   compare the drawn calls with a table.

   NEEDS      doc.json "icons": "icons.js", which tools/make_icons.py writes from a map of exactly
              the marks this figure draws (icons.relay.json for the Relay example). The build stops
              with a message when a node names a mark that icons.js lacks.

   LICENCE RULES (vendor-icons/README.md holds the terms of each pack)
     - Inline a mark unmodified: never recolour, crop, rotate, distort or redraw it. The marks are
       the only colours outside the palette.
     - Print the product name near its mark; ICONS[key].label is that name.
     - Keep the credit line inside the figure. Use a mark only for the product it names.

   DATA (below)
     label   the aria-label: one sentence that states the finding.
     cols    the grid columns: a number (equal widths) or a list of relative widths. The grid spans
             x 8 to 392, with a 20-unit gutter between two columns.
     mark    the side of a mark, in user units (default 26).
     zones   [{id, name, col, row, tip}]   col and row: one cell number, or [first, last].
     nodes   [{id, icon, name, col, row, lines, hero, tip}]
             icon   a key of ICONS: the vendor mark. Leave it out for a plain card.
             name   the part it plays ("Relay API"), in sentence case. A mark draws it under the
                    product name; a plain card draws it in capitals as its title.
             lines  plain words: what it does. Each line wraps to the cell.
     wires   [{n, from, to, label, reply, minor, hero, exit, enter, via, tip}]
             from, to    a node id or a zone id; a list of ids for a fan (on one side only).
             n           the step number. A wire without n gets no disc.
             exit, enter 'top' | 'bottom' | 'left' | 'right', with an optional '@0.2' along that side.
             via         the channel for the horizontal run: channel k lies above row k.
     credit  optional: the credit line. By default, the credit of each pack drawn, joined by " · ".

   LAYOUT LIMITS
     - A mark tile is its cell: the mark centred at the top, the text block under it. At 4 columns
       a cell is 81 units wide, about 13 capitals of title or 20 characters of plain text per line.
       Longer text wraps and the row grows. A product name with one word wider than its cell
       drops its letter spacing (CLOUDWATCH fits 5 columns that way). Any other word wider than
       its cell stops the build, with the fixes in the message: two columns for the node, fewer
       columns, or wider weights in cols.
     - A wire joins a mark at the middle of its left or right side, or at its top, and leaves a
       tile from the bottom of its text block. So the marks of one row line up, and a wire never
       runs through the text under a mark.
     - The viewBox is 400 wide, like every kit figure, so the type sizes are the house sizes. A
       figure drawn wider than 400 must scale every type size by width / 400, or its labels print
       smaller than those of the other figures.

   PITFALLS SEEN IN PRACTICE
     - Two altitudes: a service mark beside a function or a module. A box here is a service.
     - A mark recoloured to match the palette, cropped to a circle or redrawn: the licence forbids
       it. svcIcon() draws the vendor file as it is; never style its children.
     - A wire crosses a text block, or a label collides after a rename. Route the wire with exit,
       enter or via, and read the PNG of the figure after every change.
     - Every box numbered. A deployment view numbers only the path where order matters.

   Origin: the services view of a design document (dashed boundaries, hairline
   wires, numbered discs, capitals with letter spacing, PORCELAIN roles; the vendor marks the only
   exception). The wire router and the label placement are the ones of system.js. */
(() => {
/* ════ DATA · every word and every grid cell the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'Relay runs on seven managed services in one AWS account, and one Lambda function, the ' +
    'Relay API, decides every message; the client apps of each tenant stay outside that account.',
  /* the grid, 4 columns x 3 rows:   row 0  client side (cols 0-1)
                                     row 1  the send path: gateway, Relay API, queue, workers
                                     row 2  the stores and the two senders                      */
  cols: 4,
  mark: 26,
  zones: [
    { id: 'client', name: 'Client side', col: [0, 1], row: 0,
      tip: 'The apps of each tenant. Relay does not run them, and they are not on the Relay bill.' },
    { id: 'aws', name: 'AWS · one account', col: [0, 3], row: [1, 2],
      tip: 'One AWS account holds every service that Relay runs, so one AWS bill covers all of Relay. ' +
        'No server and no VPC: each service is managed.' },
  ],
  nodes: [
    { id: 'apps', name: 'Client apps', col: [0, 1], row: 0, lines: ['the web and mobile apps of each tenant'],
      tip: 'The apps of a tenant call Relay over HTTPS with the API token of that tenant.' },
    { id: 'gateway', icon: 'apigw', name: 'Entry point', col: 0, row: 1, lines: ['checks the token'],
      tip: 'Amazon API Gateway checks the token of every request. A bad token gets 401 here, before ' +
        'the Relay API runs. It bills per request.' },
    { id: 'api', icon: 'lambda', name: 'Relay API', col: 1, row: 1, hero: true, lines: ['decides every message'],
      tip: 'One AWS Lambda function holds the Relay API: the one place that decides. It bills per ' +
        'request and per unit of compute time.' },
    { id: 'queue', icon: 'sqs', name: 'Send queue', col: 2, row: 1, lines: ['one job per message'],
      tip: 'Amazon SQS holds one job per message. The job id is the idempotency key. It bills per request.' },
    { id: 'workers', icon: 'lambda', name: 'Delivery workers', col: 3, row: 1, lines: ['render and hand off'],
      tip: 'A second AWS Lambda function takes each job, renders the message and hands it to its ' +
        'sender. It bills like the Relay API.' },
    { id: 'templates', icon: 's3', name: 'Template store', col: 0, row: 2, lines: ['templates per tenant'],
      tip: 'Amazon S3 holds the templates of every tenant and the preferences of every recipient. ' +
        'It bills for storage and per request.' },
    { id: 'audit', icon: 'cloudwatch', name: 'Audit log', col: 1, row: 2, lines: ['one line per request'],
      tip: 'Amazon CloudWatch keeps one audit line per request, never a message body. It bills for ' +
        'the log data it takes in and keeps.' },
    { id: 'email', icon: 'ses', name: 'E-mail sender', col: 2, row: 2, lines: ['sends the e-mail'],
      tip: 'Amazon SES sends the e-mail. It bills per message sent.' },
    { id: 'sms', icon: 'sns', name: 'SMS sender', col: 3, row: 2, lines: ['sends the SMS'],
      tip: 'Amazon SNS sends the text messages. It bills per message, at a price for each country.' },
  ],
  wires: [                      // n = the step number, in time order; minor wires carry no number
    { n: 1, from: 'apps', to: 'gateway', label: 'HTTPS + token',
      tip: 'A client app calls POST /v1/messages with the API token of its tenant.' },
    { n: 2, from: 'gateway', to: 'api', label: 'invoke',
      tip: 'API Gateway invokes the Relay API function for a request whose token is valid.' },
    { n: 3, from: 'api', to: 'queue', label: 'enqueue',
      tip: 'The Relay API puts one job per message on the queue, and answers 202 Accepted.' },
    { n: 4, from: 'workers', to: 'queue', label: 'poll',
      tip: 'The workers call the queue: Lambda polls it and hands the next jobs to the workers ' +
        'function. The arrow follows the call, not the data.' },
    { n: 5, from: 'workers', to: ['email', 'sms'], label: 'send',
      tip: 'A worker hands the message to the sender of its channel: SES for e-mail, SNS for SMS.' },
    { from: 'api', to: 'templates', minor: true, label: 'read', exit: 'bottom@.2',
      tip: 'The Relay API reads the template and the preferences of the recipient.' },
    { from: 'api', to: 'audit', minor: true, label: 'write',
      tip: 'The Relay API writes one audit line per request.' },
  ],
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'services';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure
if (typeof svcIcon !== 'function' || typeof ICONS !== 'object')
  throw new Error(`figures/${NAME}.js draws vendor marks: add "icons": "icons.js" to doc.json, and make ` +
    'icons.js with python tools/make_icons.py --packs <dir> --map <icons.json> --out icons.js');

const W = 400;
const GX0 = 8, GX1 = 392;       // the grid spans these x; a zone box reaches ZP beyond its cells
const GUT = 20;                 // the gutter between two grid columns
const ZP = 6, ZT = 7, ZB = 5;   // a zone box sits ZP left and right of its cells, ZT above, ZB below
const CH = 20, TOP = 14, FOOT = 8;   // the least channel between two rows; the room above and below
const TRACK = 8;                // the pitch of two runs that share one channel
const ROOM = 10;                // the extra room for a label above a run
const PAD = 5;                  // the text inset of a plain card
const MIN_H = 24;               // the least row height
const DISC = 4.6;               // the radius of a step disc
const MARK = DATA.mark || 26;   // the side of a vendor mark
const GAP = 4;                  // between a mark and its text block
const HP = 5, HV = 3;           // the inset of the dark card around the text of the HERO tile
const SAFE = 1.08;              // measured width x SAFE: room for a reader font wider than the build font
const F = {
  zone: { 'font-size': 6.8, 'font-weight': 700, 'letter-spacing': '.12em' },
  title: { 'font-size': 7.4, 'font-weight': 800, 'letter-spacing': '.08em' },
  tight: { 'font-size': 7.4, 'font-weight': 800 },   // a product name with one word too wide for its cell
  role: { 'font-size': 6.8, 'font-weight': 700 },
  line: { 'font-size': 6.6, 'font-weight': 500 },
  label: { 'font-size': 6.6, 'font-weight': 600 },
  num: { 'font-size': 6.5, 'font-weight': 800 },
  credit: { 'font-size': 6.5, 'font-weight': 500 },
};
const HALO = `paint-order:stroke;stroke:${P.BG};stroke-width:4px;stroke-linejoin:round;`;

const fail = msg => { throw new Error(`figures/${NAME}.js DATA: ${msg}`); };
const up = s => String(s).toUpperCase();
const r2 = v => Math.round(v * 100) / 100;
const cells = v => (Array.isArray(v) ? v : [v, v]);
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

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

/* ── the grid: column x from the weights; rows come later, from the tallest box in each ── */
const weights = typeof DATA.cols === 'number' ? Array(DATA.cols).fill(1) : DATA.cols;
const NC = weights.length;
const unit = (GX1 - GX0 - (NC - 1) * GUT) / weights.reduce((t, v) => t + v, 0);
const CW = weights.map(v => v * unit);
const CX = CW.map((_, c) => GX0 + CW.slice(0, c).reduce((t, v) => t + v + GUT, 0));
if (Math.min(...CW) < MARK + 10) fail(`${NC} columns leave ${r2(Math.min(...CW))} units for a cell; a mark of ${MARK} needs ${MARK + 10}. Use fewer columns`);

const byId = new Map();
const add = o => { if (byId.has(o.id)) fail(`the id "${o.id}" appears twice`); byId.set(o.id, o); return o; };
const inGrid = (c0, c1) => Number.isInteger(c0) && Number.isInteger(c1) && c0 >= 0 && c1 < NC && c0 <= c1;

/* ── boxes: a tile (a vendor mark and the text under it) or a plain card. A tile's box is its mark,
      and its text block hangs under it; a plain card fills its cells and its row, as in system ── */
const taken = new Map();
const used = new Set();
const nodes = DATA.nodes.map((n, k) => {
  const [c0, c1] = cells(n.col);
  if (!inGrid(c0, c1)) fail(`node "${n.id}": col ${JSON.stringify(n.col)} is outside columns 0 to ${NC - 1}`);
  if (!(Number.isInteger(n.row) && n.row >= 0)) fail(`node "${n.id}": row must be one whole number, 0 or more`);
  for (let c = c0; c <= c1; c++) {
    const key = `${n.row}/${c}`;
    if (taken.has(key)) fail(`nodes "${taken.get(key)}" and "${n.id}" both take row ${n.row}, column ${c}`);
    taken.set(key, n.id);
  }
  const cx = CX[c0], cw = CX[c1] + CW[c1] - CX[c0];
  const check = (list, f, room) => list.forEach(t => {
    const tw = width(t, f);
    if (tw > room) fail(`node "${n.id}": "${t}" needs ${r2(tw)} units, and its cell is ${r2(cw)} wide at ${NC} ` +
      `columns. Give the node two columns (col: [${c0}, ${c0 + 1}]), use fewer columns, set wider weights in ` +
      'cols, or use shorter words');
  });
  if (n.icon != null) {
    const mark = ICONS[n.icon];
    if (!mark) fail(`node "${n.id}": icons.js has no mark "${n.icon}". It has ${Object.keys(ICONS).join(', ')}. Add the mark to the map, and run tools/make_icons.py`);
    used.add(n.icon);
    const room = cw - 2 * HP;
    // the product name stays whole: a word of it wider than the cell drops the letter spacing first
    const tf = up(mark.label).split(/\s+/).some(w => width(w, F.title) > cw - 2) ? F.tight : F.title;
    const title = wrap(up(mark.label), tf, room);
    const role = n.name && !same(n.name, mark.label) ? wrap(n.name, F.role, room) : [];
    const lines = (n.lines || []).flatMap(l => wrap(l, F.line, room));
    check(title, tf, cw - 2); check(role, F.role, cw - 2); check(lines, F.line, cw - 2);
    const textW = Math.max(...title.map(t => width(t, tf)), ...role.map(t => width(t, F.role)),
      ...lines.map(t => width(t, F.line)));
    const textH = 5.3 + (title.length - 1) * 9 + (role.length ? 9 + (role.length - 1) * 8.4 : 0) +
      (lines.length ? (role.length ? 8.6 : 9.5) + (lines.length - 1) * 8.6 : 0) + 1.8;
    const need = MARK + GAP + (n.hero ? HV : 0) + textH + (n.hero ? HV : 0);
    return add({ ...n, kind: 'tile', name: n.name || mark.label, box: 'node', r0: n.row, r1: n.row, c0, c1,
      x: cx + cw / 2 - MARK / 2, w: MARK, cx, cw, title, tf, role, lines, textW, textH, need, k });
  }
  const title = wrap(up(n.name), F.title, cw - 2 * PAD);
  const lines = (n.lines || []).flatMap(l => wrap(l, F.line, cw - 2 * PAD));
  check(title, F.title, cw - 2); check(lines, F.line, cw - 2);
  const need = PAD + 5.3 + (title.length - 1) * 9 + (lines.length ? 9.5 + (lines.length - 1) * 8.6 : 0) + 1.8 + 5;
  return add({ ...n, kind: 'card', box: 'node', r0: n.row, r1: n.row, c0, c1, x: cx, w: cw, cx, cw, title, lines, need, k });
});
if (nodes.filter(n => n.hero).length > 1) fail('more than one node is hero; HERO marks the one service the claim is about');

const zones = DATA.zones.map((z, k) => {
  const [c0, c1] = cells(z.col), [r0, r1] = cells(z.row);
  if (!inGrid(c0, c1) || !(Number.isInteger(r0) && Number.isInteger(r1) && r0 >= 0 && r1 >= r0))
    fail(`zone "${z.id}": col ${JSON.stringify(z.col)} or row ${JSON.stringify(z.row)} is outside the grid`);
  return add({ ...z, box: 'zone', c0, c1, r0, r1, x: CX[c0] - ZP, w: CX[c1] + CW[c1] - CX[c0] + 2 * ZP, k });
});
zones.forEach((a, i) => zones.slice(i + 1).forEach(b => {
  if (a.c0 <= b.c1 && b.c0 <= a.c1 && a.r0 <= b.r1 && b.r0 <= a.r1) fail(`zones "${a.id}" and "${b.id}" share a cell`);
}));
const ROWS = 1 + Math.max(...nodes.map(n => n.r1), ...zones.map(z => z.r1));
const rowH = Array.from({ length: ROWS }, (_, r) => Math.max(MIN_H, ...nodes.filter(n => n.r0 === r).map(n => n.need)));

/* ── wires: the plan of each route, in x; y follows from the rows ── */
const sideOf = (spec, what) => {
  if (spec == null) return null;
  const m = /^(top|bottom|left|right)(?:@(-?[\d.]+))?$/.exec(String(spec));
  if (!m) fail(`${what}: "${spec}" is not top, bottom, left or right, with an optional @0.5`);
  const f = m[2] == null ? .5 : +m[2];
  if (!(f >= 0 && f <= 1)) fail(`${what}: the fraction in "${spec}" lies outside 0 to 1`);
  return { s: m[1], f };
};
const vert = s => s === 'top' || s === 'bottom';
const mid = b => b.x + b.w / 2;
const names = list => list.map(b => b.name).join(', ');
const wires = DATA.wires.map((w, k) => {
  const what = `wires[${k}] (${[].concat(w.from).join(', ')} → ${[].concat(w.to).join(', ')})`;
  const get = id => byId.get(id) || fail(`${what}: no node or zone has the id "${id}"`);
  const A = [].concat(w.from).map(get), B = [].concat(w.to).map(get);
  if (A.length > 1 && B.length > 1) fail(`${what}: a wire fans in or fans out, not both`);
  const o = { ...w, k, what, A, B, minor: !!w.minor };
  o.say = `${w.n != null ? `${w.n} · ` : ''}${names(A)} → ${names(B)}${w.label ? ` · ${w.label}` : ''} — ${w.tip}`;
  if (A.length > 1 || B.length > 1) {                  // a fan: many boxes in one row, one box elsewhere
    const many = A.length > 1 ? A : B, one = A.length > 1 ? B[0] : A[0];
    if (many.some(b => b.r0 !== many[0].r0 || b.r1 !== many[0].r1)) fail(`${what}: the boxes of a fan sit in one row`);
    const below = one.r0 > many[0].r1;
    if (!below && !(one.r1 < many[0].r0)) fail(`${what}: a fan joins boxes in one row to a box in another row`);
    const xs = many.map(mid), xt = mid(one);
    o.plan = { kind: 'fan', fanIn: A.length > 1, many, one, below, xs, xt,
      ch: w.via ?? (below ? many[0].r1 + 1 : many[0].r0), lo: Math.min(...xs, xt), hi: Math.max(...xs, xt) };
    return o;
  }
  const a = A[0], b = B[0];
  if (a === b) fail(`${what}: a wire joins two different boxes`);
  let s1 = sideOf(w.exit, `${what} exit`), s2 = sideOf(w.enter, `${what} enter`);
  const rowsMeet = a.r0 <= b.r1 && b.r0 <= a.r1;
  const ox0 = Math.max(a.x, b.x), ox1 = Math.min(a.x + a.w, b.x + b.w);
  let straight = null;                                // 'v' or 'h' when the figure picks a straight wire
  if (!s1 && !s2) {
    if (rowsMeet) {
      if (ox1 > ox0) fail(`${what}: the two boxes overlap`);
      const right = b.x >= a.x + a.w;
      s1 = { s: right ? 'right' : 'left' }; s2 = { s: right ? 'left' : 'right' }; straight = 'h';
    } else {
      const down = b.r0 > a.r1;
      s1 = { s: down ? 'bottom' : 'top', f: .5 }; s2 = { s: down ? 'top' : 'bottom', f: .5 };
      if (ox1 - ox0 >= 12) straight = 'v';
    }
  }
  if (!s1 || !s2) {                                   // one side given: the other one faces it
    const give = s1 || s2;
    const other = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[give.s];
    if (s1) s2 = { s: other, f: .5 }; else s1 = { s: other, f: .5 };
  }
  const x1 = vert(s1.s) ? (straight === 'v' ? (ox0 + ox1) / 2 : a.x + s1.f * a.w) : (s1.s === 'right' ? a.x + a.w : a.x);
  const x2 = vert(s2.s) ? (straight === 'v' ? (ox0 + ox1) / 2 : b.x + s2.f * b.w) : (s2.s === 'right' ? b.x + b.w : b.x);
  const kind = vert(s1.s) ? (vert(s2.s) ? 'vv' : 'vh') : (vert(s2.s) ? 'hv' : 'hh');
  const below = b.r0 > a.r1;
  const ch = kind === 'vv' && Math.abs(x1 - x2) > .5 ? (w.via ?? (below ? b.r0 : b.r1 + 1)) : null;
  o.plan = { kind, a, b, s1, s2, x1, x2, straight, ch, lo: Math.min(x1, x2), hi: Math.max(x1, x2) };
  return o;
});

// two straight wires between the same two boxes sit side by side
const pairs = new Map();
wires.filter(o => o.plan.straight).forEach(o => {
  const key = [o.A[0].id, o.B[0].id].sort().join('|');
  pairs.set(key, (pairs.get(key) || []).concat(o));
});
pairs.forEach(list => list.forEach((o, i) => {
  const d = (i - (list.length - 1) / 2) * 12;
  if (o.plan.straight === 'v') { o.plan.x1 += d; o.plan.x2 += d; } else o.plan.dy = d;
}));

// runs that share a channel get their own track: first come, first served, unless a wire names one
const runs = wires.filter(o => o.plan.ch != null);
runs.forEach(o => {
  if (o.plan.ch < 0 || o.plan.ch > ROWS) fail(`${o.what}: via ${o.plan.ch} names no channel; channels run 0 to ${ROWS}`);
});
const trackOf = new Map(), tracks = Array.from({ length: ROWS + 1 }, () => []);
runs.forEach(o => {
  const list = tracks[o.plan.ch];
  let t = o.track ?? 0;
  while (o.track == null && (list[t] || []).some(p => p.plan.lo < o.plan.hi + 8 && o.plan.lo < p.plan.hi + 8)) t++;
  (list[t] = list[t] || []).push(o);
  trackOf.set(o, t);
});
for (const list of tracks) for (let t = 0; t < list.length; t++) list[t] = list[t] || [];

// a straight vertical wire with a disc or a label between two neighbour rows: its channel must hold the
// disc between the borders of the two zones, so that channel gets at least VCH units
const VCH = ZB + ZT + 2 * DISC + 9;
const vmin = [];
wires.forEach(o => {
  const p = o.plan;
  if (p.kind !== 'vv' || p.ch != null || (o.n == null && !o.label)) return;
  if (p.b.r0 === p.a.r1 + 1) vmin[p.b.r0] = VCH;
  else if (p.a.r0 === p.b.r1 + 1) vmin[p.a.r0] = VCH;
});

/* ── the layout in y, and every route as polylines. rooms[k][t] = {up, down}: the room a label needs
      above or below track t of channel k. The first pass has none; a second pass adds what the labels
      of the first pass asked for ── */
const build = rooms => {
  const chH = [], chTop = [], rowTop = [];
  const roomOf = (k, t) => (rooms[k] && rooms[k][t]) || {};
  const block = k => tracks[k].reduce((s, _, t) => s + (t ? TRACK : 0) + (roomOf(k, t).up || 0) + (roomOf(k, t).down || 0), 0);
  let y = 0;
  for (let k = 0; k <= ROWS; k++) {
    const base = Math.max(k === 0 ? TOP : k === ROWS ? FOOT : CH, vmin[k] || 0);
    chTop[k] = y;
    chH[k] = Math.max(base, tracks[k].length ? ZB + 6 + block(k) + 7 + ZT : 0);
    y += chH[k];
    if (k < ROWS) { rowTop[k] = y; y += rowH[k]; }
  }
  const trackY = (k, t) => {
    let ty = chTop[k] + (chH[k] - block(k)) / 2 + (roomOf(k, 0).up || 0);
    for (let i = 1; i <= t; i++) ty += (roomOf(k, i - 1).down || 0) + TRACK + (roomOf(k, i).up || 0);
    return ty;
  };
  // a tile ends under its own text block; a plain card and a zone fill their rows
  const top = b => rowTop[b.r0] - (b.box === 'zone' ? ZT : 0);
  const bot = b => (b.kind === 'tile' ? rowTop[b.r0] + b.need : rowTop[b.r1] + rowH[b.r1] + (b.box === 'zone' ? ZB : 0));
  const rect = b => ({ x0: b.x, y0: top(b), x1: b.x + b.w, y1: bot(b) });
  // where a wire meets a left or right side: the mark of a tile, the whole height of a card
  const band = b => (b.kind === 'tile' ? { y0: top(b), y1: top(b) + MARK } : { y0: top(b), y1: bot(b) });
  // what a disc or a label must not cover: the mark and the text block of a tile, or a card
  const textBox = b => {
    const y0 = top(b) + MARK + GAP - 1, half = b.textW / 2 + (b.hero ? HP : 1.5);
    return { x0: mid(b) - half, y0, x1: mid(b) + half, y1: bot(b) };
  };
  const solids = () => nodes.flatMap(b => (b.kind === 'tile'
    ? [{ x0: b.x, y0: top(b), x1: b.x + b.w, y1: top(b) + MARK }, textBox(b)]
    : [rect(b)]));
  const geo = new Map(wires.map(o => {
    const p = o.plan;
    if (p.kind === 'fan') {
      const ty = trackY(p.ch, trackOf.get(o));
      const yMany = b => (p.below ? bot(b) : top(b)), yOne = p.below ? top(p.one) : bot(p.one);
      const legs = p.many.map((b, i) => [[p.xs[i], yMany(b)], [p.xs[i], ty]]);
      const bus = [[p.lo, ty], [p.hi, ty]], trunk = [[p.xt, ty], [p.xt, yOne]];
      const lines = p.fanIn ? [...legs, bus, trunk] : [trunk.slice().reverse(), bus, ...legs.map(l => l.slice().reverse())];
      const heads = p.fanIn ? [trunk] : legs.map(l => l.slice().reverse());
      return [o, { lines, heads, disc: [p.xt, ty], run: { ch: p.ch, t: trackOf.get(o) } }];
    }
    const ra = rect(p.a), rb = rect(p.b), ba = band(p.a), bb = band(p.b);
    const ymid = (bd, s) => (s.f == null ? null : bd.y0 + s.f * (bd.y1 - bd.y0));
    let y1, y2;
    if (p.straight === 'h') {
      const oy0 = Math.max(ba.y0, bb.y0), oy1 = Math.min(ba.y1, bb.y1);
      y1 = y2 = (oy0 + oy1) / 2 + (p.dy || 0);
    } else {
      y1 = vert(p.s1.s) ? (p.s1.s === 'top' ? ra.y0 : ra.y1) : ymid(ba, p.s1);
      y2 = vert(p.s2.s) ? (p.s2.s === 'top' ? rb.y0 : rb.y1) : ymid(bb, p.s2);
    }
    const P1 = [p.x1, y1], P2 = [p.x2, y2];
    let pts;
    if (p.kind === 'vv') {
      if (p.ch == null) pts = [P1, P2];
      else { const ty = trackY(p.ch, trackOf.get(o)); pts = [P1, [p.x1, ty], [p.x2, ty], P2]; }
    } else if (p.kind === 'hh') {
      if (Math.abs(y1 - y2) < .5) pts = [P1, P2];
      else { const gx = (p.x1 + p.x2) / 2; pts = [P1, [gx, y1], [gx, y2], P2]; }
    } else if (p.kind === 'hv') pts = [P1, [p.x2, y1], P2];
    else pts = [P1, [p.x1, y2], P2];
    return [o, { lines: [pts], heads: [pts], run: p.ch != null ? { ch: p.ch, t: trackOf.get(o) } : null }];
  }));
  return { chH, chTop, rowTop, H: y, rect, top, bot, textBox, solids, geo };
};

/* ── discs and labels: the disc and its label are placed together. The first pair that clears the
      boxes, the wires and the marks placed so far wins; when no pair is clear, the pair that overlaps
      least wins ── */
const segBox = ([[xa, ya], [xb, yb]]) => ({ x0: Math.min(xa, xb), y0: Math.min(ya, yb), x1: Math.max(xa, xb), y1: Math.max(ya, yb) });
const hit = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
const area = (a, b, m) => Math.max(0, Math.min(a.x1, b.x1 + m) - Math.max(a.x0, b.x0 - m)) *
  Math.max(0, Math.min(a.y1, b.y1 + m) - Math.max(a.y0, b.y0 - m));
const segsOf = (L, o) => L.geo.get(o).lines.flatMap(pts => pts.slice(1).map((q, i) => [pts[i], q]));
const len = s => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
const onSeg = ([x, y], [[xa, ya], [xb, yb]]) =>
  x >= Math.min(xa, xb) - .01 && x <= Math.max(xa, xb) + .01 && y >= Math.min(ya, yb) - .01 && y <= Math.max(ya, yb) + .01;
const discBox = ([x, y]) => ({ x0: x - DISC, y0: y - DISC, x1: x + DISC, y1: y + DISC });
const place = (L, roomy) => {
  const boxes = L.solids(), discs = [], labels = [], rooms = [];
  const all = wires.map(o => ({ o, segs: segsOf(L, o) }));
  // cost: how much a box overlaps the boxes, the discs and labels placed so far, and every wire segment
  // except `skip` (the segments a mark sits on). noBoxes: a label beside a run, before its channel grew
  const cost = (box, m, skip, noBoxes) =>
    (box.x0 < 2 || box.x1 > W - 2 || box.y0 < 1 || box.y1 > L.H - 1 ? 1e4 : 0) +
    (noBoxes ? 0 : boxes.reduce((t, c) => t + area(box, c, m), 0)) +
    discs.reduce((t, d) => t + area(box, d.box, m), 0) + labels.reduce((t, l) => t + area(box, l.box, m), 0) +
    all.reduce((t, { segs }) => t + segs.reduce((u, sg) => u + (skip.includes(sg) ? 0 : area(box, segBox(sg), .8)), 0), 0);
  wires.forEach(o => {
    const g = L.geo.get(o), mine = all.find(a => a.o === o).segs;
    // where the disc may sit: the junction of a fan; else along the segments, the longest first
    const spots = [];
    if (g.disc) spots.push({ p: g.disc, dir: 'h' });
    else mine.map((sg, i) => ({ sg, last: i === mine.length - 1 })).sort((p, q) => len(q.sg) - len(p.sg))
      .forEach(({ sg, last }) => [.5, .4, .6, .3, .7, .2, .8, .12, .88].forEach(t => {
        if (t * len(sg) >= DISC + 2.5 && (1 - t) * len(sg) >= DISC + (last ? 5 : 2.5))
          spots.push({ p: [sg[0][0] + t * (sg[1][0] - sg[0][0]), sg[0][1] + t * (sg[1][1] - sg[0][1])],
            dir: sg[0][1] === sg[1][1] ? 'h' : 'v' });
      }));
    if (!spots.length) {
      const sg = mine.slice().sort((p, q) => len(q) - len(p))[0];
      spots.push({ p: [(sg[0][0] + sg[1][0]) / 2, (sg[0][1] + sg[1][1]) / 2], dir: sg[0][1] === sg[1][1] ? 'h' : 'v' });
    }
    const hasDisc = o.n != null, lw = o.label ? width(o.label, F.label) : 0;
    const boxOf = c => ({ x0: c.a === 'start' ? c.x : c.x - lw, x1: c.a === 'start' ? c.x + lw : c.x, y0: c.y - 5.2, y1: c.y + 1.8 });
    let best = null;
    for (const sp of spots) {
      const [ax, ay] = sp.p, skip = mine.filter(sg => onSeg(sp.p, sg));
      const dc = hasDisc ? cost(discBox(sp.p), 1.2, mine, false) : 0;
      if (!o.label) {
        if (!best || dc < best.c) best = { sp, c: dc };
        if (dc === 0) break;
        continue;
      }
      const gap = hasDisc ? 7.5 : 4, run = !!g.run && sp.dir === 'h';
      const cand = sp.dir === 'v'
        ? [{ x: ax + gap, y: ay + 2.3, a: 'start' }, { x: ax - gap, y: ay + 2.3, a: 'end' }]
        : [{ x: ax + gap, y: ay - 4.8, a: 'start', room: 'up' }, { x: ax - gap, y: ay - 4.8, a: 'end', room: 'up' },
           { x: ax + gap, y: ay + 9.5, a: 'start', room: 'down' }, { x: ax - gap, y: ay + 9.5, a: 'end', room: 'down' }];
      for (const lc of cand) {
        const c = dc + cost(boxOf(lc), 1.5, skip, run && !roomy);
        if (!best || c < best.c) best = { sp, lc, run, c };
        if (c === 0) break;
      }
      if (best.c === 0) break;
    }
    if (hasDisc) discs.push({ o, p: best.sp.p, box: discBox(best.sp.p) });
    if (!o.label) return;
    labels.push({ o, ...best.lc, box: boxOf(best.lc) });
    // a label beside a run: its channel grows by ROOM on that side, on the next pass
    if (best.run && best.lc.room) ((rooms[g.run.ch] = rooms[g.run.ch] || [])[g.run.t] = {})[best.lc.room] = ROOM;
  });
  return { discs, labels, rooms };
};

let L = build([]);
let M = place(L, false);
if (M.rooms.length) { const rooms = M.rooms; L = build(rooms); M = place(L, true); }

/* ── zone names: at the left end of the top border; when a wire, a disc or a label is there, at the
      right end, then sliding left until the name clears them all ── */
const zoneLabels = zones.map(z => {
  const t = up(z.name), lw = width(t, F.zone), yb = L.top(z) + 2.4;
  const segs = wires.flatMap(o => segsOf(L, o).map(segBox));
  const busy = x => {
    const b = { x0: x, x1: x + lw, y0: yb - 5.4, y1: yb + 1.8 };
    return segs.some(s => hit(b, s, 2.5)) || M.discs.some(d => hit(b, d.box, 1.5)) || M.labels.some(l => hit(b, l.box, 1.5));
  };
  const first = z.x + 10, last = z.x + z.w - 10 - lw;
  let x = first;
  if (busy(first)) {
    x = last;
    while (x > first && busy(x)) x -= 2;
    if (x <= first) x = first;
  }
  return { z, t, x, y: yb };
});

/* ── the credit line: the credit of every pack drawn, at the foot, right-aligned; wraps when long ── */
const credit = DATA.credit || [...new Set([...used].map(key => ICONS[key].credit))].join(' · ');
const creditLines = used.size || DATA.credit ? wrap(`Icons: ${credit}`, F.credit, GX1 - GX0) : [];
const CREDIT_Y = L.H + 3;
const H = r2(L.H + (creditLines.length ? 6 + creditLines.length * 8.4 : 0));

figure(NAME, { h: H, label: DATA.label }, s => {
  const nmax = Math.max(0, ...wires.map(o => o.n ?? 0));
  const delay = o => (o.n != null ? .6 + (o.n - 1) * .22 : .6 + nmax * .22 + wires.filter(x => x.n == null).indexOf(o) * .1);

  /* zones */
  zones.forEach((z, i) => {
    const r = L.rect(z);
    tip(el(s, 'rect', { x: r2(r.x0), y: r2(r.y0), width: r2(z.w), height: r2(r.y1 - r.y0), rx: 10, fill: 'none',
      stroke: P.GRID, 'stroke-width': .9, 'stroke-dasharray': '3 3', class: 'fade', style: at(i * .06) }), `${z.name} — ${z.tip}`);
  });

  /* wires: the drawn path, the arrowheads, an invisible wide twin that carries the tooltip */
  wires.forEach(o => {
    const g = L.geo.get(o), d0 = delay(o);
    const col = o.hero ? P.HERO : o.reply ? P.DATA2 : P.DATA;
    const sw = o.hero ? 1.6 : o.minor ? .9 : 1.1, hl = o.hero ? 5.4 : o.minor ? 3.8 : 4.2, hw = o.hero ? 2.7 : o.minor ? 2 : 2.2;
    const grp = el(s, 'g', {});
    const cut = new Set(g.heads);
    const d = g.lines.map(pts => {
      const q = pts.map(p => p.slice());
      if (cut.has(pts)) {                             // stop the line at the base of its arrowhead
        const [xa, ya] = q[q.length - 2], [xb, yb] = q[q.length - 1];
        q[q.length - 1] = [xb - Math.sign(xb - xa) * hl * .9, yb - Math.sign(yb - ya) * hl * .9];
      }
      return 'M' + q.map(p => `${r2(p[0])} ${r2(p[1])}`).join(' L ');
    }).join(' ');
    el(grp, 'path', { d, fill: 'none', stroke: col, 'stroke-width': sw, 'stroke-linejoin': 'round',
      ...(o.reply ? { 'stroke-dasharray': '2.6 1.9', class: 'fade', style: at(d0) }
        : { pathLength: 1, class: 'draw', style: `${at(d0)};animation-duration:.6s` }) });
    g.heads.forEach(pts => {
      const [xa, ya] = pts[pts.length - 2], [xb, yb] = pts[pts.length - 1];
      const dx = Math.sign(xb - xa), dy = Math.sign(yb - ya);
      const hp = dx ? [[xb, yb], [xb - dx * hl, yb - hw], [xb - dx * hl, yb + hw]]
        : [[xb, yb], [xb - hw, yb - dy * hl], [xb + hw, yb - dy * hl]];
      el(grp, 'polygon', { points: hp.map(p => `${r2(p[0])},${r2(p[1])}`).join(' '), fill: col,
        class: 'fade', style: at(d0 + .35) });
    });
    el(grp, 'path', { d: g.lines.map(pts => 'M' + pts.map(p => `${r2(p[0])} ${r2(p[1])}`).join(' L ')).join(' '),
      fill: 'none', stroke: P.BG, 'stroke-opacity': 0, 'stroke-width': 6 });
    tip(grp, o.say);
  });

  /* boxes: a tile is the vendor mark, as drawn, and its text block; a plain card is an outlined card */
  nodes.forEach(n => {
    const r = L.rect(n), g = el(s, 'g', { class: 'fade', style: at(.12 + n.r0 * .12 + n.c0 * .03) });
    if (n.kind === 'tile') {
      const cx = r2(mid(n)), tb = L.textBox(n);
      svcIcon(g, n.icon, r2(n.x), r2(r.y0), MARK);
      if (n.hero) el(g, 'rect', { x: r2(tb.x0), y: r2(tb.y0), width: r2(tb.x1 - tb.x0), height: r2(tb.y1 - tb.y0),
        rx: 4, fill: P.HERO });
      let y = r.y0 + MARK + GAP + (n.hero ? HV : 0) + 5.3;
      n.title.forEach((t, j) => txt(g, { ...n.tf, x: cx, y: r2(y + j * 9), fill: n.hero ? P.BG : P.TXT,
        'text-anchor': 'middle' }, t));
      y += (n.title.length - 1) * 9;
      if (n.role.length) {
        y += 9;
        n.role.forEach((t, j) => txt(g, { ...F.role, x: cx, y: r2(y + j * 8.4), fill: n.hero ? P.BG : P.TXT,
          'text-anchor': 'middle' }, t));
        y += (n.role.length - 1) * 8.4;
      }
      if (n.lines.length) {
        y += n.role.length ? 8.6 : 9.5;
        n.lines.forEach((t, j) => txt(g, { ...F.line, x: cx, y: r2(y + j * 8.6), fill: n.hero ? P.BG : P.MUT,
          'fill-opacity': n.hero ? .9 : null, 'text-anchor': 'middle' }, t));
      }
      tip(g, `${n.name} — ${ICONS[n.icon].label}. ${n.tip}`);
      return;
    }
    const h = r.y1 - r.y0;
    el(g, 'rect', { x: r2(n.x), y: r2(r.y0), width: r2(n.w), height: r2(h), rx: 6,
      fill: n.hero ? P.HERO : P.BG, stroke: n.hero ? P.HERO : P.DATA, 'stroke-width': n.hero ? 0 : 1 });
    const block = 5.3 + (n.title.length - 1) * 9 + (n.lines.length ? 9.5 + (n.lines.length - 1) * 8.6 : 0) + 1.8;
    const y0 = r.y0 + (h - block) / 2 + 5.3, cx = r2(n.x + n.w / 2);
    n.title.forEach((t, j) => txt(g, { ...F.title, x: cx, y: r2(y0 + j * 9), fill: n.hero ? P.BG : P.TXT,
      'text-anchor': 'middle' }, t));
    const yl = y0 + (n.title.length - 1) * 9 + 9.5;
    n.lines.forEach((t, j) => txt(g, { ...F.line, x: cx, y: r2(yl + j * 8.6), fill: n.hero ? P.BG : P.MUT,
      'fill-opacity': n.hero ? .9 : null, 'font-weight': n.hero ? 600 : 500, 'text-anchor': 'middle' }, t));
    tip(g, `${n.name} — ${n.tip}`);
  });

  /* step discs and wire labels, on top of the wires */
  M.discs.forEach(({ o, p: [x, y] }) => {
    const g = el(s, 'g', { class: 'pop', style: at(delay(o) + .1) });
    el(g, 'circle', { cx: r2(x), cy: r2(y), r: DISC, fill: o.hero ? P.HERO : P.DATA });
    txt(g, { ...F.num, x: r2(x), y: r2(y + 2.35), 'text-anchor': 'middle', fill: P.BG }, o.n);
    tip(g, o.say);
  });
  M.labels.forEach(({ o, x, y, a }) => tip(txt(s, { ...F.label, x: r2(x), y: r2(y), fill: P.MUT, 'text-anchor': a,
    class: 'fade', style: HALO + at(delay(o) + .15) }, o.label), o.say));

  /* zone names last, so their halo sits over everything they cross */
  zoneLabels.forEach(({ z, t, x, y }, i) => tip(txt(s, { ...F.zone, x: r2(x), y: r2(y), fill: P.MUT,
    class: 'fade', style: HALO + at(.04 + i * .06) }, t), `${z.name} — ${z.tip}`));

  /* the credit line: part of the vendor terms, so it lives inside the figure */
  creditLines.forEach((t, j) => tip(txt(s, { ...F.credit, x: GX1, y: r2(CREDIT_Y + 6 + j * 8.4), fill: P.MUT,
    'text-anchor': 'end', class: 'fade', style: at(1.2) }, t),
    'The marks are the vendors’ own icons, inlined unmodified by tools/make_icons.py. ' + credit));
});
})();
