/* tech-design-doc · figures/sequence.js · who calls whom, in what order, over the life of one request

   QUESTION   In what order do the parties exchange messages for one request, which call waits for
              a reply, and which one step makes the design work?
   USE WHEN   Time order matters: a handshake, a callback, a retry, a one-time token, an
              idempotency key. 3 to 6 parties and up to about 14 messages.
   NOT WHEN   The point is where each component runs and which one decides (use system). The point
              is the checks inside one service (use checks). More than about 14 messages: split
              the story into two figures.

   ENCODING
     head       a party: its NAME in capitals, and a short sub-label under it.
     lifeline   a hairline down from each head. Time runs down; one row per message.
     solid      a call, DATA. dashed: a reply, DATA2. thick HERO: the one message the claim is about.
     loop       a self-call: the party does work and calls nothing else.
     disc       the step number, on the lifeline where the message starts.
     capsule    FAINTDATA on a lifeline: the party is busy from one message to another.
     bracket    a span of messages with a big mark and a small label (60 s, 1×, ONE USE).
     notes      one or two lines in capitals under the figure.
     tooltips   every head and lifeline, capsule, message, bracket and note. A message opens with one
                parsable line, "<n> · <from> → <to> — <tip>", so a checker can compare the drawn
                steps with the step table in the Markdown.

   DATA (below)
     label      the aria-label: one sentence that states the finding.
     parties    [{id, name, sub, tip}]   left to right. Order them so most messages join neighbours.
     active     [{on, from, to, tip}]     a capsule on party `on`, from message `from` to message `to`.
     messages   [{n, from, to, self, reply, hero, text, under, side, tip}]   in time order.
                text: the lines over the arrow; under: smaller lines under it. self: a party id for a
                self-call, drawn as a loop; side: 'left' | 'right' sends the loop to that side.
     brackets   [{from, to, big, small, tip}]   big: a short mark; small: one or more lines in capitals.
     notes      the lines under the figure.
     Two brackets must not overlap in time: they share one place, right of the last lifeline.

   LAYOUT LIMITS
     - A bracket takes its width from the right first. Then each gap between two parties fits the
       two names beside it, and the rest of the width is shared evenly. At 5 parties the parties sit
       about 70 to 95 units apart. Keep bracket labels to a word or two per line: a wide one
       squeezes every party.
     - When the names do not fit on one line, the gaps are equal and a long name wraps; every head
       grows to match the tallest.
     - A label stays inside the gap next to its start disc when it fits there on two lines (or on
       as many lines as you give it), so it crosses no lifeline. Else it wraps at its span when the
       span is 70 units or more (50 for the lines under the arrow), else at 110 units, and never
       past the edge; then it may cross a lifeline, and its halo cuts the line. Read the PNG.
     - A self-call loops right, except on the last party or when the label fits only on the left.
       Its label wraps the same way, inside the gap before the next lifeline.
     - The height follows the data: about 22 units per message, more for labels of two lines.

   PITFALLS SEEN IN PRACTICE
     - An arrow that crosses a lifeline it does not call reads as a call. Order the parties so
       most messages join neighbours.
     - Two labels on one row. Every message gets its own row; never give two messages one number.
     - The bracket covers the wrong steps after a renumbering. It names messages by n: check it
       after every change, and read the PNG.
     - A reply drawn solid. Write reply: true, so it is dashed DATA2.

   Origin: the sequence diagram of a design document (hairline lifelines,
   numbered discs, capsules, capitals with letter spacing, PORCELAIN roles only). */
(() => {
/* ════ DATA · every word the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'In a scheduled send, the job id travels from the scheduler to the provider as the idempotency ' +
    'key, so the provider sends the message exactly once, even when a job runs twice.',
  parties: [
    { id: 'client', name: 'Client app', sub: 'tenant',
      tip: 'The app of a tenant. It schedules a message and gets the schedule id back.' },
    { id: 'api', name: 'Relay API', sub: 'schedules',
      tip: 'The Relay API checks and stores the schedule. Later, it receives the delivery webhook.' },
    { id: 'scheduler', name: 'Scheduler', sub: 'clock',
      tip: 'The scheduler starts each stored schedule at its send_at time.' },
    { id: 'worker', name: 'Worker', sub: 'delivery',
      tip: 'A delivery worker takes one job from the queue and hands the message to the provider.' },
    { id: 'provider', name: 'Provider', sub: 'SES · SMS · FCM',
      tip: 'The outside service that delivers the message: e-mail, SMS or push.' },
  ],
  active: [
    { on: 'api', from: 1, to: 3, tip: 'The Relay API handles the schedule request.' },
    { on: 'worker', from: 5, to: 7, tip: 'The worker holds the job until the provider accepts the message.' },
  ],
  messages: [
    { n: 1, from: 'client', to: 'api', text: ['POST /v1/schedules', '{send_at}'],
      tip: 'The client app asks Relay to send a message at send_at.' },
    { n: 2, self: 'api', text: ['validate and store'],
      tip: 'The Relay API runs every check of a send, then stores the schedule.' },
    { n: 3, from: 'api', to: 'client', reply: true, text: ['201 {schedule_id}'],
      tip: 'The Relay API answers 201 Created with the schedule id.' },
    { n: 4, self: 'scheduler', text: ['due at send_at'],
      tip: 'At send_at, the scheduler finds the schedule due.' },
    { n: 5, from: 'scheduler', to: 'worker', hero: true, text: ['enqueue job'], under: ['idempotency key', '= job id'],
      tip: 'The scheduler enqueues one job. The job id is the idempotency key: a second enqueue of the same ' +
        'job id adds nothing.' },
    { n: 6, from: 'worker', to: 'provider', text: ['send'],
      tip: 'The worker hands the rendered message to the provider, with the job id as its idempotency key.' },
    { n: 7, from: 'provider', to: 'worker', reply: true, text: ['200 accepted'],
      tip: 'The provider accepts the message. A retry with the same key gets the same answer, and no second send.' },
    { n: 8, from: 'provider', to: 'api', text: ['delivery webhook'],
      tip: 'Later, the provider calls the delivery webhook of the Relay API: delivered, bounced or failed.' },
  ],
  brackets: [
    { from: 5, to: 7, big: '1×', small: ['exactly', 'once'],
      tip: 'From the enqueue (5) to the reply of the provider (7): one job id, one send.' },
  ],
  notes: ['The job id is the idempotency key · a retried job never sends twice'],
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'sequence';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure

const W = 400, L = 4, R = 396;  // the viewBox width and the drawing margins
const HEAD_Y = 12;              // the baseline of the first head line
const ROW_MIN = 18;             // the least pitch between two messages
const LOOP_W = 18, LOOP_H = 11; // a self-call loop
const DISC = 4.6;               // the radius of a step disc
const SAFE = 1.08;              // measured width x SAFE: room for a reader font wider than the build font
const F = {
  head: { 'font-size': 7.5, 'font-weight': 700, 'letter-spacing': '.08em' },
  hsub: { 'font-size': 6.5, 'font-weight': 600, 'letter-spacing': '.08em' },
  msg: { 'font-size': 7, 'font-weight': 600 },
  under: { 'font-size': 6.5, 'font-weight': 500 },
  num: { 'font-size': 6.5, 'font-weight': 800 },
  big: { 'font-size': 11, 'font-weight': 800 },
  small: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.1em' },
  note: { 'font-size': 6.5, 'font-weight': 600, 'letter-spacing': '.1em' },
};
const KO = `paint-order:stroke;stroke:${P.BG};stroke-width:3px;stroke-linejoin:round;`;

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

/* ── the model: check the ids and the numbers ── */
const N = DATA.parties.length;
if (N < 2 || N > 7) fail(`parties holds ${N}; the figure draws 2 to 7`);
const ix = new Map(DATA.parties.map((p, i) => [p.id, i]));
if (ix.size !== N) fail('two parties share an id');
const party = (id, what) => (ix.has(id) ? ix.get(id) : fail(`${what}: no party has the id "${id}"`));
const msgs = DATA.messages.map((m, k) => {
  const what = `messages[${k}] (n ${m.n})`;
  if (m.self == null && (m.from == null || m.to == null)) fail(`${what}: give from and to, or self`);
  const a = party(m.self ?? m.from, what), b = m.self != null ? a : party(m.to, what);
  if (a === b && m.self == null) fail(`${what}: from and to name one party; write self: '${m.from}'`);
  return { ...m, k, a, b, self: m.self != null };
});
const byN = new Map(msgs.map(m => [m.n, m]));
if (byN.size !== msgs.length) fail('two messages share one n; every message gets its own number');
const row = (n, what) => (byN.has(n) ? byN.get(n) : fail(`${what}: no message has n ${n}`));

/* ── x: the bracket takes its room from the right; then each gap fits the two heads beside it ── */
const brackets = (DATA.brackets || []).map((b, k) => {
  const small = [].concat(b.small || []).map(up);
  const bw = 16 + Math.max(b.big ? width(b.big, F.big) : 0, ...small.map(t => width(t, F.small)));
  return { ...b, k, small, bw, a: row(b.from, `brackets[${k}]`), z: row(b.to, `brackets[${k}]`) };
});
const reserve = Math.max(0, ...brackets.map(b => b.bw)) + (brackets.length ? 6 : 0);
const headW = p => Math.max(width(up(p.name), F.head), p.sub ? width(up(p.sub), F.hsub) : 0);
const x0 = L + headW(DATA.parties[0]) / 2 + 2;
const xn = Math.min(R - reserve - 4, R - headW(DATA.parties[N - 1]) / 2 - 2);
// each gap fits the two heads beside it, and the slack is shared evenly; when the heads do not fit on
// one line, the gaps are equal and the names wrap
const need = DATA.parties.slice(1).map((p, i) => (headW(DATA.parties[i]) + headW(p)) / 2 + 10);
const slack = xn - x0 - need.reduce((t, v) => t + v, 0);
const gaps = need.map(v => (slack >= 0 ? v + slack / (N - 1) : (xn - x0) / (N - 1)));
const X = DATA.parties.map((_, i) => x0 + gaps.slice(0, i).reduce((t, v) => t + v, 0));
const gap = Math.min(...gaps, N > 1 ? Infinity : W);
if (gap < 52) fail(`the parties sit ${r2(gap)} units apart; 52 is the least. Use fewer parties, or a shorter bracket label`);
const room = i => Math.min(i > 0 ? gaps[i - 1] : Infinity, i < N - 1 ? gaps[i] : Infinity, N > 1 ? Infinity : W) - 6;
const heads = DATA.parties.map((p, i) => {
  const name = width(up(p.name), F.head) <= room(i) ? [up(p.name)] : wrap(up(p.name), F.head, room(i));
  const sub = p.sub ? (width(up(p.sub), F.hsub) <= room(i) ? [up(p.sub)] : wrap(up(p.sub), F.hsub, room(i))) : [];
  return { ...p, i, title: p.name, name, sub };          // title: the name as written, for tooltips
});
const nameLines = Math.max(...heads.map(h => h.name.length)), subLines = Math.max(...heads.map(h => h.sub.length));
const headBottom = HEAD_Y + (nameLines - 1) * 9 + (subLines ? 10 + (subLines - 1) * 8.5 : 0);
const LIFE_TOP = headBottom + 8;

/* ── the label of each message: wrapped, and placed beside the arrow or the loop. A label never runs
      into the bracket column, right of the last lifeline ── */
const RIGHT = brackets.length ? X[N - 1] + 2 : R;
// the lines wrapped at `room`; null when a word is wider than the room, or when the wrap takes more
// lines than the label holds (two, or as many as the data gives). [] for no lines
const inGap = (list, f, room) => {
  if (!list.length) return [];
  const words = list.flatMap(t => String(t).split(/\s+/).filter(Boolean));
  if (room <= 0 || words.some(w => width(w, f) > room)) return null;
  const out = list.flatMap(t => wrap(t, f, room));
  return out.length <= Math.max(2, list.length) ? out : null;
};
msgs.forEach(m => {
  const lines = [].concat(m.text || []), under = [].concat(m.under || []);
  if (m.self) {
    const xa = X[m.a], room = { right: RIGHT - (xa + LOOP_W + 6) - 2, left: xa - LOOP_W - 6 - L - 2 };
    // the room before the next lifeline on side d: a label that fits there crosses no lifeline
    const gap = d => (m.a + d >= 0 && m.a + d < N ? Math.abs(X[m.a + d] - xa) - LOOP_W - 6 - 3
      : room[d > 0 ? 'right' : 'left']);
    const fits = d => inGap(lines, F.msg, gap(d)) && inGap(under, F.under, gap(d));
    const want = Math.max(0, ...lines.map(t => width(t, F.msg)));
    m.dir = m.side === 'left' ? -1 : m.side === 'right' ? 1
      : m.a === N - 1 ? -1
      : !fits(1) && m.a > 0 && fits(-1) ? -1
      : (!fits(1) && want > room.right && room.left > room.right) ? -1 : 1;
    const side = m.dir > 0 ? 'right' : 'left';
    const max = fits(m.dir) ? Math.min(room[side], gap(m.dir)) : room[side];
    m.lines = lines.flatMap(t => wrap(t, F.msg, max));
    m.under = under.flatMap(t => wrap(t, F.under, max));
    m.above = DISC + 1;
    m.below = Math.max(LOOP_H + 4, 8 + (m.lines.length - 1) * 8.5 + 2 + (m.under.length ? 8 * m.under.length : 0));
  } else {
    m.dir = Math.sign(X[m.b] - X[m.a]);
    // a label sits beside its start disc. It stays inside the first gap when it fits there, so it
    // crosses no lifeline; else it wraps at its span when the span is wide enough (70 units for the
    // main lines, 50 for the smaller lines under the arrow), else at 110, and may cross a lifeline
    const first = Math.abs(X[m.a + m.dir] - X[m.a]) - 12;
    const span = Math.abs(X[m.b] - X[m.a]) - 12, edge = m.dir > 0 ? RIGHT - X[m.a] - 8 : X[m.a] - L - 10;
    m.lines = inGap(lines, F.msg, Math.min(edge, first))
      || lines.flatMap(t => wrap(t, F.msg, Math.min(edge, span >= 70 ? span : 110)));
    m.under = inGap(under, F.under, Math.min(edge, first))
      || under.flatMap(t => wrap(t, F.under, Math.min(edge, span >= 50 ? span : 110)));
    m.above = 4.5 + (m.lines.length - 1) * 8.5 + 5.5;
    m.below = Math.max(DISC + 1, m.under.length ? 9.5 + (m.under.length - 1) * 8 + 2 : 0);
  }
});

/* ── y: one row per message, as far apart as their labels need ── */
msgs.forEach((m, k) => {
  const p = msgs[k - 1];
  m.y = !p ? LIFE_TOP + 6 + m.above : p.y + Math.max(ROW_MIN, p.below + 5 + m.above);
});
const lastMsg = msgs[msgs.length - 1];
const LIFE_END = lastMsg.y + lastMsg.below + 8;
const notes = (DATA.notes || []).flatMap(t => wrap(up(t), F.note, R - L - 8));
const H = r2(LIFE_END + (notes.length ? 14 + (notes.length - 1) * 11 + 6 : 4));
const actives = (DATA.active || []).map((c, k) => {
  const a = row(c.from, `active[${k}]`), z = row(c.to, `active[${k}]`);
  return { ...c, x: X[party(c.on, `active[${k}]`)], y0: a.y - 2, y1: (z.self ? z.y + LOOP_H : z.y) + 2 };
});
const busy = (i, y) => actives.some(c => c.x === X[i] && y >= c.y0 && y <= c.y1);

figure(NAME, { h: H, label: DATA.label }, s => {
  const T = n => .45 + (n - 1) * .13;
  const names = m => `${DATA.parties[m.a].name} → ${DATA.parties[m.b].name}`;

  /* heads and lifelines */
  heads.forEach(h => {
    const g = el(s, 'g', { class: 'fade', style: at(h.i * .05) }), x = r2(X[h.i]);
    h.name.forEach((t, j) => txt(g, { ...F.head, x, y: r2(HEAD_Y + j * 9), fill: P.TXT, 'text-anchor': 'middle' }, t));
    const ys = HEAD_Y + (nameLines - 1) * 9 + 10;
    h.sub.forEach((t, j) => txt(g, { ...F.hsub, x, y: r2(ys + j * 8.5), fill: P.MUT, 'text-anchor': 'middle' }, t));
    tip(g, `${h.title} — ${h.tip}`);
    tip(el(s, 'path', { d: `M${x} ${r2(LIFE_TOP)}V${r2(LIFE_END)}`, stroke: P.FAINT, 'stroke-width': .9, fill: 'none',
      pathLength: 1, class: 'draw', style: at(.1 + h.i * .05) }), `${h.title} — ${h.tip}`);
  });

  /* capsules: a party is busy */
  actives.forEach(c => tip(el(s, 'rect', { x: r2(c.x - 2.5), y: r2(c.y0), width: 5, height: r2(c.y1 - c.y0), rx: 2.5,
    fill: P.FAINTDATA, class: 'fade', style: at(T(c.from)) }), `${DATA.parties[party(c.on)].name} is busy from step ${c.from} ` +
    `to step ${c.to} — ${c.tip}`));

  /* messages */
  msgs.forEach(m => {
    const t = T(m.n), y = m.y, xa = X[m.a];
    const col = m.hero ? P.HERO : m.reply ? P.DATA2 : P.DATA;
    const sw = m.hero ? 1.6 : 1.1, hl = m.hero ? 5.6 : 4.6, hw = m.hero ? 2.7 : 2.2;
    const g = el(s, 'g', {});
    tip(g, `${m.n} · ${names(m)} — ${m.tip}`);
    const anchor = m.dir > 0 ? 'start' : 'end';
    if (m.self) {
      const d = m.dir, e = xa + d * LOOP_W, back = xa + d * 2.5;
      el(g, 'path', { d: `M${r2(xa + d * DISC)} ${r2(y)}H${r2(e - d * 3)}Q${r2(e)} ${r2(y)} ${r2(e)} ${r2(y + 3)}V${r2(y + LOOP_H - 3)}` +
        `Q${r2(e)} ${r2(y + LOOP_H)} ${r2(e - d * 3)} ${r2(y + LOOP_H)}H${r2(back + d * hl)}`,
        stroke: col, 'stroke-width': sw, fill: 'none', pathLength: 1, class: 'draw', style: at(t + .03) });
      el(g, 'polygon', { points: `${r2(back)},${r2(y + LOOP_H)} ${r2(back + d * hl)},${r2(y + LOOP_H - hw)} ${r2(back + d * hl)},${r2(y + LOOP_H + hw)}`,
        fill: col, class: 'fade', style: at(t + .3) });
      const lx = xa + d * (LOOP_W + 6);
      m.lines.forEach((str, j) => txt(g, { ...F.msg, x: r2(lx), y: r2(y + 8 + j * 8.5), 'text-anchor': anchor,
        'font-weight': m.hero ? 800 : 600, fill: m.hero ? P.HERO : P.TXT, class: 'fade', style: KO + at(t + .1) }, str));
      m.under.forEach((str, j) => txt(g, { ...F.under, x: r2(lx), y: r2(y + 8 + m.lines.length * 8.5 + j * 8), 'text-anchor': anchor,
        fill: m.hero ? P.HERO : P.MUT, class: 'fade', style: KO + at(t + .14) }, str));
      el(g, 'rect', { x: r2(Math.min(xa, lx)), y: r2(y - 7), width: r2(Math.abs(lx - xa) + 4), height: r2(m.below + 7),
        fill: P.BG, opacity: 0 });
    } else {
      const xb = X[m.b], d = m.dir;
      const sx = xa + d * DISC, ex = xb - d * (busy(m.b, y) ? 2.5 : .4);
      const line = { d: `M${r2(sx)} ${r2(y)}H${r2(ex - d * hl)}`, stroke: col, 'stroke-width': sw, fill: 'none' };
      if (m.reply) el(g, 'path', { ...line, 'stroke-dasharray': '2.6 1.9', class: 'fade', style: at(t + .03) });
      else el(g, 'path', { ...line, pathLength: 1, class: 'draw', style: at(t + .03) });
      el(g, 'polygon', { points: `${r2(ex)},${r2(y)} ${r2(ex - d * hl)},${r2(y - hw)} ${r2(ex - d * hl)},${r2(y + hw)}`,
        fill: col, class: 'fade', style: at(t + .3) });
      const lx = xa + d * 8;
      m.lines.forEach((str, j) => txt(g, { ...F.msg, x: r2(lx), y: r2(y - 4.5 - (m.lines.length - 1 - j) * 8.5),
        'text-anchor': anchor, 'font-weight': m.hero ? 800 : 600, fill: m.hero ? P.HERO : P.TXT,
        class: 'fade', style: KO + at(t + .1) }, str));
      m.under.forEach((str, j) => txt(g, { ...F.under, x: r2(lx), y: r2(y + 9.5 + j * 8), 'text-anchor': anchor,
        'font-weight': m.hero ? 600 : 500, fill: m.hero ? P.HERO : P.MUT, class: 'fade', style: KO + at(t + .14) }, str));
      el(g, 'rect', { x: r2(Math.min(xa, xb)), y: r2(y - m.above - 1), width: r2(Math.abs(xb - xa)),
        height: r2(m.above + m.below + 2), fill: P.BG, opacity: 0 });
    }
    /* the step number sits on the lifeline where the message starts */
    const c = el(g, 'g', { class: 'fade', style: at(t) });
    el(c, 'circle', { cx: r2(xa), cy: r2(y), r: DISC, fill: m.hero ? P.HERO : P.DATA });
    txt(c, { ...F.num, x: r2(xa), y: r2(y + 2.35), 'text-anchor': 'middle', fill: P.BG }, m.n);
  });

  /* brackets, right of the last lifeline */
  brackets.forEach(b => {
    const bx = X[N - 1] + 12, y0 = b.a.y, y1 = b.z.self ? b.z.y + LOOP_H : b.z.y;
    const g = el(s, 'g', { class: 'fade', style: at(T(b.z.n) + .3) });
    el(g, 'path', { d: `M${r2(bx - 3.5)} ${r2(y0)}H${r2(bx)}V${r2(y1)}H${r2(bx - 3.5)}`, stroke: P.MUT, 'stroke-width': 1, fill: 'none' });
    const block = (b.big ? 11 : 0) + b.small.length * 8.5;
    let y = (y0 + y1) / 2 - block / 2 + (b.big ? 8 : 5.5);
    if (b.big) { txt(g, { ...F.big, x: r2(bx + 4), y: r2(y), fill: P.DATA }, b.big); y += 10; }
    b.small.forEach(t => { txt(g, { ...F.small, x: r2(bx + 4), y: r2(y), fill: P.MUT }, t); y += 8.5; });
    tip(g, `${b.big ? `${b.big} ` : ''}${b.small.join(' ').toLowerCase()} · steps ${b.from} to ${b.to} — ${b.tip}`);
  });

  /* notes */
  if (notes.length) {
    const g = el(s, 'g', { class: 'fade', style: at(T(msgs.length) + .5) });
    notes.forEach((t, j) => txt(g, { ...F.note, x: W / 2, y: r2(LIFE_END + 14 + j * 11), 'text-anchor': 'middle', fill: P.MUT }, t));
    tip(g, (DATA.notes || []).join(' · '));
  }
});
})();
