/* tech-design-doc · figures/mapping.js · which items a group opens, and the one attribute that decides it

   QUESTION   Which group (a team, a role, a region) opens which item (a tenant, a company, a
              project), through which attribute of the item? What does a request outside every
              group get back?
   USE WHEN   Access, routing or ownership follows one attribute of an item, and a group holds a
              set of attribute values: 2 to 5 example items, 1 to 3 groups, a few deny cases.
   NOT WHEN   Access depends on the fields of each record (use matrix), or on the role alone (use
              stack). More than 3 groups: the palette holds 3 tones, so split the figure.

   ENCODING
     left column  one example item per row: its NAME, and how many records it holds.
     tick strip   the records of the item, one hairline each, all one pale colour and never linked:
                  the rule never reads them. Leave counts out, and the strip column goes away.
     capsule      the attribute value the item carries, in the tone of the group that holds it.
     box          one group: its NAME in that tone, the role that grants it, the values it holds.
                  Tones run HERO, DATA, DATA2 in the order of DATA.groups.
     curve        the item opens to that group.
     under rule   deny rows: an outlined capsule (a value the asker's groups do not hold) or a
                  dotted line (no value at all), then the status chip and why.
     thin line    an optional role that opens every group and every deny row.
     rule lines   the rule in one or two lines: HERO, then MUT.
     tooltips     every head, item, strip, capsule, curve, box, deny row, role line and rule line. A
                  curve opens with one parsable line, "<item> · <value> → <group> (<role>)", so a
                  checker can compare the drawn links with the table in the Markdown.

   DATA (below)
     label    the aria-label: one sentence that states the finding.
     heads    {items, strip, keys, groups}: the four column heads.
     tips     the same four keys: the tooltip of each head.
     groups   [{id, name, role, keys, tip}]   1 to 3, top to bottom. keys: the values it holds.
     items    [{name, count, keys, tip}]      count: the records of the item (the ticks).
              keys: the values it carries; every value must sit in a group.
     strip    {what, tip}: what one tick is, in the plural ('messages').
     deny     [{name, sub, key, keyNote, code, note, tip}]   key: a value no group of the asker
              holds; leave it out for an item with no value, and keyNote names the gap. sub keeps
              its case, so a role name stays exact; name, keyNote and note are drawn in capitals,
              so keep code names out of them.
     all      optional {role, text, tip}: a role that opens every group.
     rule     one or two lines: the rule (HERO), then what follows from it (MUT).

   LAYOUT LIMITS
     - Each column is as wide as its head or its widest entry. The name column stops at 100 units,
       and a longer name wraps. A deny row has no strip, so its name runs on to the capsules.
     - A box is 160 units wide, or narrower when the left columns need the room. Under 120 units,
       the figure tries, in order: column heads on two lines, the values of an item stacked, a name
       column of 76 units, less room for the curves. If the boxes still get under 120 units, the
       build stops with a message. A long value list wraps inside its box.
     - The strip is 30 units wide, or as wide as its head: up to about 40 ticks read as single
       records. Show a small example count, not a real total.
     - Items and boxes share one band: each item row gets at least 34 units, each box 44 or more.
     - An item may carry 1 to 3 values; each value is one capsule and one curve.

   PITFALLS SEEN IN PRACTICE
     - The figure shows rows that look like real data. Name the items as examples in the srcline.
     - A record strip in colour reads as "the records decide". Keep it pale, unlinked and flat.
     - A deny that names which items exist. Draw the absent item and the out-of-scope item with
       the same chip, so the reader sees the same reply.
     - Curves that cross many others. Order DATA.items so that each item sits near its group.

   Origin: the link diagram of a design document (F-series link family: capsules, hairline
   ticks, curves, capitals with letter spacing, PORCELAIN roles only). */
(() => {
/* ════ DATA · every word the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'The region of a tenant decides which support cluster opens it, so an engineer opens only the ' +
    'tenants of their own clusters and gets 404 for any other, the same reply as for an absent tenant.',
  heads: { items: 'Tenant', strip: 'Messages', keys: 'Region', groups: 'Cluster · role' },
  tips: {
    items: 'Three example tenants, not real data. Each tenant is one record.',
    strip: 'The messages of the tenant. Scope never reads them, and no message carries a region.',
    keys: 'The region of the tenant, from a fixed list: eu, us, apac. It sits on the tenant record.',
    groups: 'A support cluster is the set of regions that one support team covers. The role of an ' +
      'engineer names one cluster.',
  },
  groups: [                     // top to bottom; the tones run HERO, DATA, DATA2
    { id: 'atlantic', name: 'Atlantic', role: 'support.atlantic', keys: ['eu', 'us'],
      tip: 'The Atlantic support team covers the regions eu and us.' },
    { id: 'pacific', name: 'Pacific', role: 'support.pacific', keys: ['apac'],
      tip: 'The Pacific support team covers the region apac.' },
  ],
  items: [                      // order: each tenant near the cluster that holds its region
    { name: 'Northwind', count: 14, keys: ['eu'], tip: 'An example tenant in the region eu.' },
    { name: 'Kestrel', count: 9, keys: ['us'], tip: 'An example tenant in the region us.' },
    { name: 'Bluefin', count: 31, keys: ['apac'], tip: 'An example tenant in the region apac.' },
  ],
  strip: { what: 'messages', tip: 'Scope never reads a message.' },
  deny: [
    { name: 'Bluefin', sub: 'asked by support.atlantic', key: 'apac', code: '404',
      note: 'not in a cluster of the engineer',
      tip: 'An engineer with support.atlantic asks for Bluefin. Its region apac sits in the Pacific ' +
        'cluster, and the engineer holds no Pacific role.' },
    { name: 'Absent tenant', sub: 'asked by any engineer', keyNote: 'no tenant', code: '404',
      note: 'the same reply and the same body',
      tip: 'A tenant id that does not exist answers the same 404, so the reply never tells an ' +
        'engineer which tenants exist.' },
  ],
  rule: ['The region is a property of the tenant, not of its messages',
    'A 404 never tells an engineer which tenants exist'],
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'mapping';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure

const L = 6, R = 396;           // the drawing margins of the 400-wide viewBox
const NAME_MAX = 100;           // the widest name column; a longer name wraps
const STRIP = 30;               // the width of a tick strip
const CURVE = 44;               // the least room for the curves between the capsules and the boxes
const BOX_MAX = 160, BOX_MIN = 120;
const ROW_MIN = 34, BOX_GAP = 12;
const CAP_H = 12;               // the height of a capsule
const SAFE = 1.08;              // measured width x SAFE: room for a reader font wider than the build font
const F = {
  head: { 'font-size': 6.6, 'font-weight': 700, 'letter-spacing': '.12em' },
  item: { 'font-size': 7.6, 'font-weight': 800, 'letter-spacing': '.07em' },
  count: { 'font-size': 6.5, 'font-weight': 700, 'letter-spacing': '.07em' },
  key: { 'font-size': 6.8, 'font-weight': 800, 'letter-spacing': '.04em' },
  gname: { 'font-size': 7.4, 'font-weight': 800, 'letter-spacing': '.08em' },
  role: { 'font-size': 6.5, 'font-weight': 600 },
  gkeys: { 'font-size': 6.8, 'font-weight': 700 },
  code: { 'font-size': 8.5, 'font-weight': 800, 'letter-spacing': '.04em' },
  note: { 'font-size': 6.8, 'font-weight': 700, 'letter-spacing': '.08em' },
  rule1: { 'font-size': 7.2, 'font-weight': 800, 'letter-spacing': '.07em' },
  rule2: { 'font-size': 6.8, 'font-weight': 700, 'letter-spacing': '.07em' },
  all: { 'font-size': 7, 'font-weight': 700, 'letter-spacing': '.04em' },
};

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

/* ── the model: every value of an item sits in a group ── */
const G = DATA.groups, I = DATA.items, D = DATA.deny || [];
if (G.length < 1 || G.length > 3) fail(`groups holds ${G.length}; the palette has 3 tones, so draw 1 to 3`);
if (!I.length) fail('items holds no item');
const TONE = [P.HERO, P.DATA, P.DATA2];
const holders = key => G.map((g, j) => (g.keys.includes(key) ? j : -1)).filter(j => j >= 0);
I.forEach(it => {
  if (!it.keys || !it.keys.length || it.keys.length > 3) fail(`item "${it.name}" carries ${it.keys ? it.keys.length : 0} values; give it 1 to 3`);
  it.keys.forEach(k => { if (!holders(k).length) fail(`item "${it.name}": no group holds "${k}"; move it to deny`); });
});
const counted = I.some(it => it.count != null);
const countLine = it => (it.count != null ? `${it.count} ${up(DATA.strip ? DATA.strip.what : 'records')}` : '');

/* ── x: the name column, the strip, the capsules, then the boxes. A deny row has no strip, so its name
      may run on to the capsule column. When the boxes get less than BOX_MIN, the figure tries, in
      order: heads on two lines, the values of an item stacked, a narrower name column, less room
      for the curves ── */
const capW = k => Math.max(24, width(k, F.key) + 12);
const keysW = keys => keys.reduce((t, k) => t + capW(k), 0) + (keys.length - 1) * 4;
const longestWord = t => Math.max(0, ...String(t).split(/\s+/).map(w => width(w, F.head)));
const fit = ({ nameCap, stack, curve, twoLineHeads }) => {
  const head = k => {                              // the head of column k, drawn at column width w
    const t = DATA.heads && DATA.heads[k] ? up(DATA.heads[k]) : '';
    return w => (!t ? [] : !twoLineHeads || width(t, F.head) <= w ? [t] : wrap(t, F.head, Math.max(w, longestWord(t))));
  };
  const hw = (k, w) => Math.max(0, ...head(k)(w).map(t => width(t, F.head)));
  const nmC = Math.min(nameCap, Math.max(40, ...I.map(it => Math.max(width(up(it.name), F.item), width(countLine(it), F.count)))));
  const nmW = Math.max(nmC, hw('items', nmC));
  const SW = counted ? Math.max(STRIP, hw('strip', STRIP)) : 0;
  const X_TK0 = L + nmW + 10, X_TK1 = counted ? X_TK0 + SW : X_TK0 - 10, X_KEY = X_TK1 + 10;
  const kc = Math.max(56, ...I.map(it => (stack ? Math.max(...it.keys.map(capW)) : keysW(it.keys))),
    ...D.map(d => (d.key ? capW(d.key) : 0)), ...D.map(d => (d.keyNote ? width(up(d.keyNote), F.note) : 0)));
  const KW = Math.max(kc, hw('keys', kc));
  const X_BOX = Math.max(X_KEY + KW + curve, R - BOX_MAX);
  const cols = [['items', L, nmW], ['strip', X_TK0, SW], ['keys', X_KEY, KW], ['groups', X_BOX, R - X_BOX]]
    .filter(([k]) => (k !== 'strip' || counted) && DATA.heads && DATA.heads[k]).map(([k, x, w]) => [k, x, head(k)(w)]);
  return { nmW, SW, X_TK0, X_KEY, KW, X_BOX, BOX_W: R - X_BOX, stack, cols };
};
const tries = [
  { nameCap: NAME_MAX, stack: false, curve: CURVE, twoLineHeads: false },
  { nameCap: NAME_MAX, stack: false, curve: CURVE, twoLineHeads: true },
  { nameCap: NAME_MAX, stack: true, curve: CURVE, twoLineHeads: true },
  { nameCap: 76, stack: true, curve: CURVE, twoLineHeads: true },
  { nameCap: 76, stack: true, curve: 32, twoLineHeads: true },
];
const X = tries.map(fit).find(f => f.BOX_W >= BOX_MIN);
if (!X) fail(`the left columns leave ${r2(fit(tries[tries.length - 1]).BOX_W)} units for the boxes, after heads on ` +
  `two lines, stacked values and a narrower name column; ${BOX_MIN} is the least. Shorten the names, the values or the heads`);
const { nmW, SW, X_TK0, X_KEY, KW, X_BOX, BOX_W } = X;
const headLines = Math.max(1, ...X.cols.map(c => c[2].length));

/* ── y: one band for items and boxes, then the deny rows, the "all" role and the rule ── */
const HEAD_RULE = 16 + (headLines - 1) * 8;
const Y0 = HEAD_RULE + 14;
const STACK = CAP_H + 3;                            // the pitch of stacked capsules
const boxes = G.map((g, j) => {
  const keys = wrap(g.keys.join(' · '), F.gkeys, BOX_W - 16), role = wrap(g.role, F.role, BOX_W - 16);
  return { ...g, j, keys, roleLines: role, h: 36 + (role.length - 1) * 8.5 + (keys.length - 1) * 9 + 8 };
});
// name = the drawn lines, in capitals; title = the name as written, for the tooltips
const rows = I.map(it => {
  const name = wrap(up(it.name), F.item, nmW);
  return { ...it, title: it.name, name, h: Math.max(ROW_MIN, name.length * 9 + 18, X.stack ? it.keys.length * STACK + 10 : 0) };
});
// the words of the tooltips come from the column heads, so a hover reads "every tenant whose region
// is eu or us", not the words of the template
const noun = k => String((DATA.heads && DATA.heads[k]) || k).split('·')[0].trim().toLowerCase();
const either = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`);
const boxSum = boxes.reduce((t, b) => t + b.h, 0) + (boxes.length - 1) * BOX_GAP;
const rowSum = rows.reduce((t, r) => t + r.h, 0);
const BAND = Math.max(boxSum, rowSum);
let yb = Y0 + (boxes.length === 1 ? (BAND - boxSum) / 2 : 0);
const bgap = boxes.length > 1 ? (BAND - boxSum) / (boxes.length - 1) + BOX_GAP : 0;
boxes.forEach(b => { b.y = yb; b.cy = yb + b.h / 2; yb += b.h + bgap; });
let yr = Y0 + (BAND - rowSum) / 2;
rows.forEach(r => { r.y = yr + r.h / 2 + (r.count != null ? (r.name.length - 1) * 4.5 : 0); yr += r.h; });
const RULE1 = Y0 + BAND + 12;
const denyRows = D.map(d => {
  const dw = (d.key ? X_KEY + (KW - capW(d.key)) / 2 : X_KEY) - 8 - L;   // up to its capsule, or to the column
  const name = wrap(up(d.name), F.item, dw), sub = d.sub ? wrap(d.sub, F.role, dw) : [];   // a sub keeps its case
  const cw = Math.max(28, width(d.code, F.code) + 12);
  const note = d.note ? wrap(up(d.note), F.note, R - (X_BOX + cw + 6)) : [];
  return { ...d, title: d.name, noteText: d.note || '', name, sub, cw, note,
    h: Math.max(30, (name.length + sub.length) * 9 + 14, note.length * 9 + 14) };
});
let yd = RULE1 + 8;
denyRows.forEach(d => { d.y = yd + d.h / 2 - 2; yd += d.h; });
const ALL = DATA.all ? { ...DATA.all, y: yd + 8, lines: wrap(`${DATA.all.role} · ${DATA.all.text}`, F.all, R - X_BOX - 8) } : null;
const RULE2 = (ALL ? ALL.y + 14 + (ALL.lines.length - 1) * 9 : yd + 2);
const rule = (DATA.rule || []).map((t, k) => wrap(up(t), k ? F.rule2 : F.rule1, R - L));
const ruleLines = rule.flatMap((ls, k) => ls.map(t => ({ t, k })));
const H = r2(RULE2 + (ruleLines.length ? 14 + ruleLines.length * 10.5 : 0) + 4);

figure(NAME, { h: H, label: DATA.label }, s => {
  /* column heads */
  X.cols.forEach(([k, x, lines], i) => {
    const g = el(s, 'g', { class: 'fade', style: at(.05 + i * .05) }), top = HEAD_RULE - 4 - (lines.length - 1) * 8;
    lines.forEach((t, j) => txt(g, { ...F.head, x: r2(x), y: r2(top + j * 8), fill: P.MUT }, t));
    tip(g, `${DATA.heads[k]} — ${(DATA.tips || {})[k] || ''}`);
  });
  el(s, 'line', { x1: L, y1: r2(HEAD_RULE), x2: R, y2: r2(HEAD_RULE), stroke: P.GRID, 'stroke-width': .8, class: 'fade', style: at(.05) });

  /* boxes: one group each, with its role and the values it holds */
  boxes.forEach(b => {
    const g = el(s, 'g', { class: 'fade', style: at(.2 + b.j * .07) }), col = TONE[b.j];
    el(g, 'rect', { x: r2(X_BOX), y: r2(b.y), width: r2(BOX_W), height: r2(b.h), rx: 4, fill: 'none', stroke: col, 'stroke-width': .9 });
    txt(g, { ...F.gname, x: r2(X_BOX + 8), y: r2(b.y + 14), fill: col }, up(b.name));
    b.roleLines.forEach((t, k) => txt(g, { ...F.role, x: r2(X_BOX + 8), y: r2(b.y + 24 + k * 8.5), fill: P.MUT }, t));
    const ky = b.y + 36 + (b.roleLines.length - 1) * 8.5;
    b.keys.forEach((t, k) => txt(g, { ...F.gkeys, x: r2(X_BOX + 8), y: r2(ky + k * 9), fill: P.TXT }, t));
    tip(g, `${b.name} · ${b.role} · ${G[b.j].keys.join(', ')} — ${b.tip} ${b.role} opens every ${noun('items')} ` +
      `whose ${noun('keys')} is ${either(G[b.j].keys)}.`);
  });

  /* item rows: name, record strip, capsules, curves */
  rows.forEach((it, i) => {
    // with a count line: the name sits over it; without: the name is centred on the row
    const y = it.y, d = .4 + i * .1;
    const top = it.count != null ? y - 4 - (it.name.length - 1) * 9 : y + 2.6 - (it.name.length - 1) * 4.5;
    const hg = el(s, 'g', { class: 'fade', style: at(d) });
    it.name.forEach((t, k) => txt(hg, { ...F.item, x: L, y: r2(top + k * 9), fill: P.HERO }, t));
    if (it.count != null) txt(hg, { ...F.count, x: L, y: r2(y + 7), fill: P.MUT }, countLine(it));
    tip(hg, `${it.title} · ${it.keys.join(', ')} — ${it.tip}`);
    if (it.count != null) {                          // the records: one flat strip, one tone, no link
      const tg = el(s, 'g', {}), n = Math.max(1, it.count);
      for (let k = 0; k < n; k++) {
        const x = n > 1 ? X_TK0 + k * (SW / (n - 1)) : X_TK0 + SW / 2;
        el(tg, 'line', { x1: r2(x), y1: r2(y - 5), x2: r2(x), y2: r2(y + 5), stroke: P.FAINTDATA, 'stroke-width': .8,
          pathLength: 1, class: 'draw', style: at(d + .05 + k * .004) });
      }
      tip(tg, `${it.count} ${DATA.strip ? DATA.strip.what : 'records'} of ${it.title} — ${DATA.strip ? DATA.strip.tip : ''}`);
    }
    // side by side: every curve leaves from the right end of the capsule row; stacked: from its own capsule
    let x = X_KEY + (KW - keysW(it.keys)) / 2;
    const rowEnd = X_KEY + (KW + keysW(it.keys)) / 2;
    it.keys.forEach((key, k) => {
      const w = capW(key), hs = holders(key), col = TONE[hs[0]], g = el(s, 'g', {});
      const cx = X.stack ? X_KEY + (KW - w) / 2 : x, cy = X.stack ? y + (k - (it.keys.length - 1) / 2) * STACK : y;
      el(g, 'rect', { x: r2(cx), y: r2(cy - CAP_H / 2), width: r2(w), height: CAP_H, rx: CAP_H / 2, fill: col,
        class: 'pop', style: at(d + .15 + k * .05) });
      txt(g, { ...F.key, x: r2(cx + w / 2), y: r2(cy + 2.6), fill: P.BG, 'text-anchor': 'middle', 'pointer-events': 'none',
        class: 'fade', style: at(d + .2 + k * .05) }, key);
      const say = hs.map(j => `${it.title} · ${key} → ${G[j].name} (${G[j].role})`).join('; ');
      tip(g, `${say} — ${G[hs[0]].role} opens ${it.title}`);
      hs.forEach(j => {                              // the curve: the value, to the group that holds it
        const x1 = X_KEY + KW, y1 = X.stack ? cy : y + (k - (it.keys.length - 1) / 2) * 4, x2 = X_BOX, y2 = boxes[j].cy;
        const from = X.stack ? cx + w : rowEnd;
        tip(el(s, 'path', { d: `M${r2(x1)} ${r2(y1)}C${r2(x1 + 28)} ${r2(y1)} ${r2(x2 - 28)} ${r2(y2)} ${r2(x2)} ${r2(y2)}`,
          fill: 'none', stroke: TONE[j], 'stroke-width': 1.1, pathLength: 1, class: 'draw', style: at(d + .25 + k * .05) }),
          `${it.title} · ${key} → ${G[j].name} (${G[j].role}) — ${G[j].role} opens ${it.title}`);
        if (from < x1 - .5) tip(el(s, 'line', { x1: r2(from), y1: r2(y1), x2: r2(x1), y2: r2(y1), stroke: TONE[j],
          'stroke-width': 1.1, class: 'fade', style: at(d + .25) }),
          `${it.title} · ${key} → ${G[j].name} (${G[j].role}) — ${G[j].role} opens ${it.title}`);
      });
      x += w + 4;
    });
    if (it.keys.length > 1 && !X.stack) tip(el(s, 'line', { x1: r2(X_KEY), y1: r2(y + 9), x2: r2(X_KEY + KW), y2: r2(y + 9),
      stroke: P.FAINT, 'stroke-width': .6, class: 'fade', style: at(d + .3) }),
      `${it.title} carries ${it.keys.length} values, so every ${noun('groups')} that holds any one of them opens it`);
  });

  /* deny rows, under a rule */
  if (denyRows.length) el(s, 'line', { x1: L, y1: r2(RULE1), x2: R, y2: r2(RULE1), stroke: P.GRID, 'stroke-width': .8,
    class: 'fade', style: at(.95) });
  denyRows.forEach((dr, i) => {
    const y = dr.y, d = 1 + i * .1, g = el(s, 'g', { class: 'fade', style: at(d) });
    const top = y - 4 - (dr.name.length - 1) * 9;
    dr.name.forEach((t, k) => txt(g, { ...F.item, x: L, y: r2(top + k * 9), fill: P.HERO }, t));
    dr.sub.forEach((t, k) => txt(g, { ...F.role, x: L, y: r2(y + 7 + k * 8.5), fill: P.MUT }, t));
    if (dr.key) {                                    // a value the asker holds no group for: outlined, unlinked
      const w = capW(dr.key), x = X_KEY + (KW - w) / 2;
      el(g, 'rect', { x: r2(x), y: r2(y - CAP_H / 2), width: r2(w), height: CAP_H, rx: CAP_H / 2, fill: P.BG,
        stroke: P.FAINT, 'stroke-width': 1 });
      txt(g, { ...F.key, x: r2(x + w / 2), y: r2(y + 2.6), fill: P.MUT, 'text-anchor': 'middle' }, dr.key);
    } else {                                         // no value at all: a dotted gap
      el(g, 'line', { x1: r2(X_KEY), y1: r2(y - 4), x2: r2(X_KEY + KW), y2: r2(y - 4), stroke: P.FAINTDATA,
        'stroke-width': 1, 'stroke-dasharray': '1.6 2.4' });
      if (dr.keyNote) txt(g, { ...F.note, x: r2(X_KEY + KW / 2), y: r2(y + 8), fill: P.FAINT, 'text-anchor': 'middle' },
        up(dr.keyNote));
    }
    el(g, 'rect', { x: r2(X_BOX), y: r2(y - 5.5), width: r2(dr.cw), height: 11, rx: 5.5, fill: P.BG, stroke: P.DATA,
      'stroke-width': 1.2 });
    txt(g, { ...F.code, x: r2(X_BOX + dr.cw / 2), y: r2(y + 3.1), fill: P.DATA, 'text-anchor': 'middle' }, dr.code);
    const ny = y + 2.6 - (dr.note.length - 1) * 4.5;
    dr.note.forEach((t, k) => txt(g, { ...F.note, x: r2(X_BOX + dr.cw + 6), y: r2(ny + k * 9), fill: P.MUT }, t));
    tip(g, `${dr.title}${dr.sub.length ? ` (${dr.sub.join(' ')})` : ''} → ${dr.code} — ` +
      `${dr.noteText ? `${dr.noteText}. ` : ''}${dr.tip}`);
  });

  /* a role that opens every group and every deny row */
  if (ALL) {
    const g = el(s, 'g', {}), lx = X_BOX - 18;
    el(g, 'line', { x1: r2(lx), y1: r2(boxes[0].y + boxes[0].h - 9), x2: r2(lx), y2: r2(ALL.y), stroke: P.FAINT, 'stroke-width': .7,
      class: 'fade', style: at(1.1) });
    boxes.forEach(b => el(g, 'line', { x1: r2(lx), y1: r2(b.y + b.h - 9), x2: r2(X_BOX), y2: r2(b.y + b.h - 9),
      stroke: P.FAINT, 'stroke-width': .7, class: 'fade', style: at(1.1) }));   // below the curve ends
    el(g, 'path', { d: `M${r2(lx)} ${r2(ALL.y)}H${r2(X_BOX)}`, fill: 'none', stroke: P.FAINT, 'stroke-width': .7,
      pathLength: 1, class: 'draw', style: at(1.15) });
    ALL.lines.forEach((t, k) => txt(g, { ...F.all, x: r2(X_BOX + 6), y: r2(ALL.y + 2.5 + k * 9), fill: P.MUT }, t));
    tip(g, `${ALL.role} · every ${noun('groups')} — ${ALL.tip}`);
  }

  /* the rule, in one or two lines */
  if (ruleLines.length) {
    el(s, 'line', { x1: L, y1: r2(RULE2), x2: R, y2: r2(RULE2), stroke: P.GRID, 'stroke-width': .8, class: 'fade', style: at(1.2) });
    ruleLines.forEach(({ t, k }, j) => tip(txt(s, { ...(k ? F.rule2 : F.rule1), x: L, y: r2(RULE2 + 14 + j * 10.5),
      fill: k ? P.MUT : P.HERO, class: 'fade', style: at(1.25 + j * .05) }, t), DATA.rule[k]));
  }
});
})();
