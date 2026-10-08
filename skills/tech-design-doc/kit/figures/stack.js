/* tech-design-doc · figures/stack.js · what each plan or role includes: ordered tiers plus detached add-ons

   QUESTION   What does each plan (or role, or licence) give its holder: which tiers, stacked one on
              the other, and which add-ons beside them?
   USE WHEN   Access comes in ORDERED tiers where each tier includes the one below (Basic <
              Analytics < Raw logs), plus independent add-ons that no tier carries. 2 to 6 columns.
   NOT WHEN   The grants have no order (use matrix, or a plain table). The question is what the
              holder SEES on a screen (use silhouettes). More than 6 columns: split by audience.

   ENCODING
     column        one plan. Its head names it; the head tooltip lists everything it holds.
     scope row     optional, on top: a filled pill names the scope of the plan (OWN / ALL);
                   hairline dots = no scope.
     tier rows     the deepest tier at the top. A plan's tiers are ONE contiguous stack that always
                   starts at the lowest tier, so "each tier includes the one below" is the shape of
                   the mark itself. Low to high: DATA2, DATA, HERO (darker = deeper).
     dashed rule   splits the tiers from the add-ons.
     add-on rows   a detached circle, so it can never read as part of the stack. Filled HERO =
                   full; half ring DATA2 = limited; hairline dots = withheld.
     notes         one or two conclusion lines under the figure: HERO for the claim, MUT for the
                   second rule.
     tooltips      every cell opens with one parsable line, "<column> · <row> · full|limited|
                   withheld — <why>", so a checker can compare the drawn grants with the Markdown.
                   A scope cell puts its value there instead: "<column> · <scope name> · OWN — <tip>".

   DATA (below)
     label     the aria-label: one sentence that states the finding.
     head      the label over the columns ("The five plans").
     scope     {name, sub, values: {key: {text, tip}}} or null for no scope row. text: 3 to 6 letters.
     tiers     [{id, name, sub, tip}]  LOW TO HIGH, at most 3.
     addons    [{id, name, sub, tip}]
     columns   [{name, scope, tier, addons: {id: 'full' | {mode: 'limited', why}}}]
               scope = a key of scope.values or null; tier = the highest tier id it reaches, or
               null; an add-on missing from `addons` is withheld.
     notes     [{text, tone: 'hero' | 'mut', tip}]   sentence case; drawn in capitals, wrapped.

   LAYOUT LIMITS
     - 1 to 3 tiers (the palette has three data steps); any number of add-on rows, 24 units each.
     - 2 to 6 columns. The columns share what the gutter leaves; each column must be wider than
       the widest single word of its head. A plan name wraps onto up to 3 lines.
     - The gutter grows with the longest row label, up to 150 units; a longer label stops the build.
     - Gutter and columns trade width. Six columns with a word like ENTERPRISE (about 46 units)
       fit only while the longest row label stays under about 99 units (about 18 capitals). The
       stress test with six columns and long labels stopped the build with that message.
     - A rotated group label (TIERS, ADD-ONS) is drawn only when its row group is tall enough.

   PITFALLS SEEN IN PRACTICE
     - A stack with a hole (Basic and Raw logs, no Analytics) cannot happen here: `tier` names
       the top of the stack. If a real plan has a hole, the tiers are not ordered: use matrix.
     - An add-on drawn as a fourth tier reads as "deeper", which it is not. Keep it a circle.
     - Grants drift from the Markdown table. Keep one model, and check the <title> lines.

   Origin: the band-model figure of a design document (F-series stacked-column family,
   PORCELAIN roles only). */
(() => {
/* ════ DATA · every word the figure draws. Edit this block, and nothing below it. ════ */
const DATA = {
  label: 'Five plans over three tiers and three add-ons: each tier includes the one below, so every ' +
    'plan fills one stack from Basic up, and Business holds Audit export for the last 30 days only.',
  head: 'The five plans',
  scope: { name: 'Region access', sub: 'own region / all regions', values: {
    own: { text: 'Own', tip: 'sends from the home region of the tenant only' },
    all: { text: 'All', tip: 'sends from every region' },
  } },
  tiers: [
    { id: 'basic', name: 'Basic', sub: 'send, templates',
      tip: 'the send API, the template editor and the status of each message' },
    { id: 'analytics', name: 'Analytics', sub: 'charts, exports',
      tip: 'delivery, bounce and click rates, with CSV export' },
    { id: 'logs', name: 'Raw logs', sub: 'every request, 30 days',
      tip: 'every API request and provider reply, kept 30 days' },
  ],
  addons: [
    { id: 'sso', name: 'SSO', sub: 'SAML sign-in', tip: 'sign-in through the identity provider of the tenant' },
    { id: 'audit', name: 'Audit export', sub: 'admin actions as CSV', tip: 'every admin action, as a CSV export' },
    { id: 'ip', name: 'Dedicated IP', sub: 'its own sending IP', tip: 'a sending IP that no other tenant shares' },
  ],
  columns: [
    { name: 'Free', scope: 'own', tier: 'basic', addons: {} },
    { name: 'Team', scope: 'own', tier: 'analytics', addons: {} },
    { name: 'Business', scope: 'own', tier: 'analytics',
      addons: { sso: 'full', audit: { mode: 'limited', why: 'the last 30 days only' } } },
    { name: 'Enterprise', scope: 'all', tier: 'logs', addons: { sso: 'full', audit: 'full', ip: 'full' } },
    { name: 'Partner', scope: 'all', tier: 'logs', addons: { sso: 'full', ip: 'full' } },
  ],
  notes: [
    { text: 'One tier fills the whole stack: Raw logs gives Analytics and Basic too', tone: 'hero',
      tip: 'A plan names its top tier only. Every tier under it comes with it.' },
    { text: 'An add-on is a detached mark: it never rides along with a tier', tone: 'mut',
      tip: 'SSO, Audit export and Dedicated IP are sold one by one. No tier carries one.' },
  ],
};

/* ════ drawing: reads DATA and the constants below ════ */
const NAME = 'stack';
const textWidth = measure(NAME);
if (!textWidth) return;                             // this page does not name the figure

const L = 4, R = 396;           // the drawing margins of the 400-wide viewBox
const SAFE = 1.08;              // measured width x SAFE: room for a reader font wider than the build font
const GUTTER_MAX = 150;         // the widest row label
const ROW = 24;                 // the pitch of a tier row and of an add-on row
const F = {
  over: { 'font-size': 6.6, 'font-weight': 700, 'letter-spacing': '.12em' },
  col: { 'font-size': 6.5, 'font-weight': 800, 'letter-spacing': '.02em' },
  name: { 'font-size': 7, 'font-weight': 700, 'letter-spacing': '.07em' },
  sub: { 'font-size': 6.5, 'font-weight': 500 },
  pill: { 'font-size': 6.8, 'font-weight': 800, 'letter-spacing': '.06em' },
  group: { 'font-size': 6.6, 'font-weight': 700, 'letter-spacing': '.12em' },
  hero: { 'font-size': 7.2, 'font-weight': 800, 'letter-spacing': '.07em' },
  mut: { 'font-size': 6.8, 'font-weight': 700, 'letter-spacing': '.07em' },
};

const fail = msg => { throw new Error(`figures/${NAME}.js DATA: ${msg}`); };
const up = s => String(s).toUpperCase();
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

/* ── the model: every grant, derived from the columns ── */
const T = DATA.tiers, A = DATA.addons, C = DATA.columns, SC = DATA.scope;
if (!T.length || T.length > 3) fail(`tiers holds ${T.length}; draw 1 to 3 (the palette has three data steps)`);
if (C.length < 2 || C.length > 6) fail(`columns holds ${C.length}; draw 2 to 6`);
const TONE = [[P.DATA2], [P.DATA2, P.DATA], [P.DATA2, P.DATA, P.HERO]][T.length - 1];
const reach = C.map(c => {
  if (c.tier == null) return -1;
  const k = T.findIndex(t => t.id === c.tier);
  if (k < 0) fail(`${c.name}: tier "${c.tier}" is no tier id`);
  return k;
});
const addonMode = (c, a) => {
  const v = (c.addons || {})[a.id];
  if (v == null) return { mode: 'withheld', why: '' };
  if (v === 'full') return { mode: 'full', why: '' };
  if (v.mode === 'limited') return { mode: 'limited', why: v.why || '' };
  return fail(`${c.name}: add-on "${a.id}" must be 'full' or {mode: 'limited', why}`);
};
C.forEach(c => Object.keys(c.addons || {}).forEach(id => {
  if (!A.some(a => a.id === id)) fail(`${c.name}: add-on "${id}" is no add-on id`);
}));
if (SC) C.forEach(c => { if (c.scope != null && !SC.values[c.scope]) fail(`${c.name}: scope "${c.scope}" is no key of scope.values`); });
const holds = (c, k) => {
  const tiers = reach[k] < 0 ? 'no tier' : T.slice(0, reach[k] + 1).map(t => t.name).join(' + ');
  const adds = A.map(a => [a, addonMode(c, a)]).filter(([, m]) => m.mode !== 'withheld')
    .map(([a, m]) => a.name + (m.mode === 'limited' ? ` (limited: ${m.why})` : ''));
  const sc = SC ? `${SC.name}: ${c.scope == null ? 'none' : SC.values[c.scope].text}. ` : '';
  return `${c.name} — ${sc}Tiers: ${tiers}. Add-ons: ${adds.join(', ') || 'none'}.`;
};

/* ── horizontal layout: gutter, group label, columns ── */
const rowsAll = [...(SC ? [SC] : []), ...T.map((t, i) => ({ ...t, name: `${i + 1} · ${t.name}` })), ...A];
const gut = Math.max(...rowsAll.map(r => Math.max(width(up(r.name), F.name), r.sub ? width(r.sub, F.sub) : 0)));
if (gut > GUTTER_MAX) fail(`a row label is ${Math.round(gut)} units wide; the gutter holds ${GUTTER_MAX}. Shorten it`);
const GX = L + gut, BX = GX + 8, X0 = BX + 10, CW = (R - X0) / C.length;
const CX = k => r2(X0 + (k + .5) * CW), HW = r2(Math.min(11, CW * .22));
const heads = C.map(c => wrap(up(c.name), F.col, CW - 4));
C.forEach(c => up(c.name).split(/\s+/).forEach(word => {
  const need = width(word, F.col) + 2;
  if (need > CW) fail(`${C.length} columns leave ${r2(CW)} units each, and the head word "${word}" needs ` +
    `${r2(need)}. The row labels take ${r2(gut)} units: shorten them, use fewer columns, or shorten the word`);
}));
if (heads.some(h => h.length > 3)) fail('a column head needs more than 3 lines; shorten the plan name');
const pillW = SC ? Object.fromEntries(Object.entries(SC.values).map(([k, v]) => [k, Math.max(26, width(up(v.text), F.pill) + 9)])) : {};
if (Object.values(pillW).some(w => w > CW - 3)) fail(`a scope pill is wider than its column (${r2(CW)} units); shorten scope.values[].text`);

/* ── vertical layout ── */
const HL = Math.max(...heads.map(h => h.length));
const headTop = 26, headBottom = headTop + (HL - 1) * 8.5;
const SY = r2(headBottom + 16);                       // the scope pill centre
const ruleA = SC ? SY + 12 : headBottom + 6;
const TY = T.map((_, i) => r2(ruleA + 18 + (T.length - 1 - i) * ROW));   // tier i centre: low tier at the bottom
const dash = r2(TY[0] + 22);
const AY = A.map((_, i) => r2(dash + 16 + i * ROW));
const ruleB = r2((A.length ? AY[A.length - 1] : dash) + 14);
const noteLines = DATA.notes.map(n => ({ n, lines: wrap(up(n.text), F[n.tone === 'hero' ? 'hero' : 'mut'], R - L - 4) }));
let ny = ruleB + 13;
const NY = noteLines.map(nl => { const y = ny; ny += nl.lines.length * 10.5; return y; });
const H = r2(ny + 2);

figure(NAME, { h: H, label: DATA.label }, s => {
  const lab = (y, name, sub, t, d) => {               // one gutter label: the name over the sub-label
    const g = el(s, 'g', { class: 'fade', style: at(d) });
    txt(g, { ...F.name, x: r2(GX), y: y - 1, fill: P.TXT, 'text-anchor': 'end' }, up(name));
    if (sub) txt(g, { ...F.sub, x: r2(GX), y: y + 8, fill: P.MUT, 'text-anchor': 'end' }, sub);
    tip(g, t);
  };
  const gone = (x, y, d, parent = s) => el(parent, 'line', { x1: r2(x - HW), y1: y, x2: r2(x + HW), y2: y,
    stroke: P.FAINTDATA, 'stroke-width': 1, 'stroke-dasharray': '1.6 2.4', class: 'fade', style: at(d) });
  const say = (c, row, mode, why) => `${c.name} · ${row} · ${mode} — ${why}`;

  /* heads: the label over the columns, then one head per column */
  txt(s, { ...F.over, x: r2((CX(0) + CX(C.length - 1)) / 2), y: 10, fill: P.MUT, 'text-anchor': 'middle',
    class: 'fade', style: at(0) }, up(DATA.head));
  el(s, 'line', { x1: BX + 4, y1: 14, x2: R, y2: 14, stroke: P.GRID, 'stroke-width': .8, class: 'fade', style: at(0) });
  C.forEach((c, k) => {
    const g = el(s, 'g', { class: 'fade', style: at(.05 + k * .04) }), h = heads[k];
    const y0 = headTop + (HL - h.length) * 4.25;      // shorter heads sit in the middle of the head band
    h.forEach((line, m) => txt(g, { ...F.col, x: CX(k), y: r2(y0 + m * 8.5), fill: P.TXT, 'text-anchor': 'middle' }, line));
    tip(g, holds(c, k));
  });

  /* the scope row */
  if (SC) {
    lab(SY, SC.name, SC.sub, `${SC.name}: ${Object.values(SC.values).map(v => `${up(v.text)} = ${v.tip}`).join('; ')}.`, .1);
    C.forEach((c, k) => {
      const g = el(s, 'g', {}), d = .2 + k * .04, v = c.scope == null ? null : SC.values[c.scope];
      if (!v) gone(CX(k), SY, d, g);
      else {
        const w = pillW[c.scope];
        el(g, 'rect', { x: r2(CX(k) - w / 2), y: SY - 5.5, width: r2(w), height: 11, rx: 5.5, fill: P.DATA, class: 'pop', style: at(d) });
        txt(g, { ...F.pill, x: CX(k), y: r2(SY + 2.5), fill: P.BG, 'text-anchor': 'middle', 'pointer-events': 'none' }, up(v.text));
      }
      tip(g, say(c, SC.name, v ? up(v.text) : 'none', v ? v.tip : 'no scope'));
    });
    el(s, 'line', { x1: BX, y1: ruleA, x2: R, y2: ruleA, stroke: P.GRID, 'stroke-width': .8, class: 'fade', style: at(.2) });
  }

  /* the tiers: one contiguous stack from the lowest tier up */
  T.forEach((t, i) => {
    lab(TY[i], `${i + 1} · ${t.name}`, t.sub, `${t.name} — ${t.tip}. A plan that reaches it holds every tier under it.`, .1);
    el(s, 'line', { x1: BX + 4, y1: TY[i] + 12, x2: R, y2: TY[i] + 12, stroke: P.GRID, 'stroke-width': .5,
      class: 'fade', style: at(.25 + i * .04) });
    C.forEach((c, k) => {
      const d = .3 + i * .06 + k * .04;
      if (reach[k] < i) {
        tip(gone(CX(k), TY[i], d), say(c, t.name, 'withheld', reach[k] < 0 ? 'the plan holds no tier'
          : `the ${T[reach[k]].name} tier does not reach it`));
        return;
      }
      const n = el(s, 'rect', { x: r2(CX(k) - HW), y: TY[i] - 10, width: r2(2 * HW), height: 20, fill: TONE[i], class: 'pop', style: at(d) });
      tip(n, say(c, t.name, 'full', i === reach[k] ? 'the top tier of the plan' : `included: the ${T[reach[k]].name} tier holds every tier under it`));
    });
  });

  /* the add-ons, cut off from the stack by a dashed rule */
  if (A.length) el(s, 'line', { x1: BX, y1: dash, x2: R, y2: dash, stroke: P.FAINT, 'stroke-width': .9,
    'stroke-dasharray': '2.6 2.4', class: 'fade', style: at(.7) });
  A.forEach((a, i) => {
    const y = AY[i];
    lab(y, a.name, a.sub, `${a.name} — ${a.tip}. An add-on: no tier carries it.`, .75);
    el(s, 'line', { x1: BX + 4, y1: y + 11, x2: R, y2: y + 11, stroke: P.GRID, 'stroke-width': .5, class: 'fade', style: at(.75 + i * .04) });
    C.forEach((c, k) => {
      const { mode, why } = addonMode(c, a), x = CX(k), d = .8 + i * .06 + k * .04;
      if (mode === 'withheld') { tip(gone(x, y, d), say(c, a.name, 'withheld', 'the plan does not hold it')); return; }
      const g = el(s, 'g', {});
      if (mode === 'limited') {
        el(g, 'circle', { cx: x, cy: y, r: 6, fill: P.BG, stroke: P.DATA2, 'stroke-width': 1.4, class: 'pop', style: at(d) });
        el(g, 'path', { d: `M${x} ${y - 6}A6 6 0 0 1 ${x} ${y + 6}Z`, fill: P.DATA2, class: 'pop', style: at(d) });
      } else el(g, 'circle', { cx: x, cy: y, r: 6.5, fill: P.HERO, class: 'pop', style: at(d) });
      tip(g, say(c, a.name, mode, mode === 'limited' ? why : 'the plan holds it'));
    });
  });

  /* the two group labels, rotated in the gutter, when the group is tall enough to hold one */
  [['Tiers', TY[T.length - 1], TY[0]], ['Add-ons', AY[0], AY[A.length - 1]]].forEach(([t, y1, y2], i) => {
    if (y1 == null || width(up(t), F.group) > y2 - y1 + 22) return;
    const y = r2((y1 + y2) / 2);
    tip(txt(s, { ...F.group, x: BX, y, fill: P.MUT, 'text-anchor': 'middle', transform: `rotate(-90 ${BX} ${y})`,
      class: 'fade', style: at(1.2 + i * .05) }, up(t)),
      i ? 'An add-on is a second subject, not a deeper tier.' : 'Ordered tiers. Each tier includes the one below.');
  });

  /* the conclusion lines */
  el(s, 'line', { x1: L, y1: ruleB, x2: R, y2: ruleB, stroke: P.GRID, 'stroke-width': .8, class: 'fade', style: at(1.3) });
  noteLines.forEach(({ n, lines }, k) => {
    const hero = n.tone === 'hero', g = el(s, 'g', { class: 'fade', style: at(1.35 + k * .05) });
    lines.forEach((line, m) => txt(g, { ...F[hero ? 'hero' : 'mut'], x: L + 2, y: r2(NY[k] + m * 10.5), fill: hero ? P.HERO : P.MUT }, line));
    if (n.tip) tip(g, n.tip);
  });
});
})();
