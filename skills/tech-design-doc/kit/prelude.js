/* tech-design-doc · prelude.js · the drawing helpers and the PORCELAIN palette.

   Build time only. build.py loads this file and every figure script into one harness page, draws
   every figure once in headless Chrome, and bakes the drawn <svg> into each page that names it. No
   built page carries this file: a page shows every figure with scripts off, in print and offline.

   The API is exactly these 9 globals. A figure script uses nothing else: no document, no window,
   no Math.random. A figure script is ONE IIFE that calls figure(...) once, and it declares nothing
   at top level.

     P                         palette roles, PORCELAIN (color-presets.js)
     el(parent, tag, attrs)    make an SVG element, set attrs, append it to parent, return it
     txt(parent, attrs, text)  an SVG <text> that holds text; returns it
     tip(node, text)           append a <title> to node: the tooltip, which checkers read; returns node
     rnd(i, k)                 deterministic pseudo-random number in [0, 1); never Math.random
     pol(cx, cy, r, deg)       [x, y] on a circle; 0 deg = 3 o'clock, angles turn clockwise (y down)
     at(seconds)               "animation-delay:<seconds>s", for a style attribute
     measure(name)             width(text, attrs) in the page's fonts, BEFORE figure(); null when the
                               page has no <svg id="fig-<name>">
     figure(name, opts, draw)  fill <svg id="fig-<name>">; does nothing when the page has none

   The usual figure script: measure, wrap and lay out first, because opts.h must be known before
   draw() runs; then draw.
     (() => {
       const DATA = { ... };
       const width = measure('NAME');
       if (!width) return;                     // this page does not name the figure
       ... lay out with width(text, {'font-size': 7, 'font-weight': 700}) ...
       figure('NAME', { h, label: DATA.label }, svg => { ... el / txt / tip ... });
     })();

   Motion: give a mark the class "fade", "draw" (a path or line with pathLength="1") or "pop", and
   stagger it with style: at(seconds). style.css plays the animation only after runtime.js adds .play
   to a figure, never in print and never with reduced motion. The drawn figure is the finished state. */

/* PORCELAIN: lightness is importance. HERO is the one mark the claim is about.
   P is read-only, and an unknown role throws: P.LAB would otherwise paint a mark default black. */
const P = new Proxy(Object.freeze({
  BG: '#F7F2EB',              // the page; also the text halo and the knock-out fill
  TXT: '#081F5C',             // titles and labels
  DATA: '#334EAC',            // the main mark: a call, a step, a filled cell
  DATA2: '#7096D1',           // the second mark: a reply, a masked value, a second series
  HERO: '#081F5C',            // the one mark the claim is about
  FAINTDATA: '#BAD6EB',       // an empty slot, a quiet fill, a withheld value
  MUT: 'rgba(8,31,92,.60)',   // secondary text, notes, zone names
  FAINT: 'rgba(8,31,92,.32)', // a hairline that carries meaning
  GRID: 'rgba(8,31,92,.16)',  // grid lines, dashed zone borders, dividers
}), {
  get(roles, key) {
    if (typeof key === 'string' && /^[A-Z][A-Z0-9_]*$/.test(key) && !(key in roles))
      throw new Error(`P.${key} is not a palette role; use one of ${Object.keys(roles).join(', ')}`);
    return roles[key];
  },
  set(roles, key) { throw new Error(`P is read-only, so P.${String(key)} cannot change`); },
});

/* attrs: a null or undefined value sets no attribute, so { class: o.cls } works when o.cls is
   absent. A number is rounded to 2 decimals, so the baked markup stays short and stable. A NaN
   stays "NaN", and build.py warns about it. */
const el = (parent, tag, attrs) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null) continue;
    n.setAttribute(k, typeof v === 'number' ? String(Math.round(v * 100) / 100) : v);
  }
  parent.appendChild(n);
  return n;
};

const txt = (parent, attrs, text) => {
  const n = el(parent, 'text', attrs);
  n.textContent = text;
  return n;
};

const tip = (node, text) => {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = text;
  node.appendChild(t);
  return node;
};

/* the deterministic hash: the same (i, k) gives the same number on every run and every machine */
const rnd = (i, k = 0) => Math.abs(((i * 73856093) ^ (k * 19349663)) % 1000) / 1000;

const pol = (cx, cy, r, deg) =>
  [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];

const at = seconds => `animation-delay:${Number(seconds).toFixed(2)}s`;

/* measure(name) returns width(text, attrs): the width of one line of text in viewBox units, measured
   in the page's own fonts inside <svg id="fig-<name>">, so a figure can wrap its labels and size its
   height before figure() draws it. attrs are the text attributes the label will carry: font-size,
   font-weight, letter-spacing. The width is exact for the fonts of the build machine; multiply it by
   a small safety factor (1.08 in the kit templates) for a reader whose font runs wider.
   measure() returns null when the page has no such figure, so the script returns and draws nothing.
   Its hidden probe stays in the svg until figure() empties it. */
const measure = name => {
  const svg = document.getElementById(`fig-${name}`);
  if (!svg) return null;
  if (!(svg instanceof SVGSVGElement))
    throw new Error(`measure('${name}'): #fig-${name} is a <${svg.tagName.toLowerCase()}>, not an <svg>`);
  const probe = el(svg, 'g', { visibility: 'hidden', 'aria-hidden': 'true' });
  return (text, attrs = {}) => {
    const n = txt(probe, attrs, String(text)), w = n.getComputedTextLength();
    n.remove();
    return w > 0 ? w : String(text).length * (Number(attrs['font-size']) || 7) * .62;  // no layout: estimate
  };
};

/* opts.h     the viewBox height; the width is always 400
   opts.label the aria-label: one sentence that states the finding, not the chart type */
const figure = (name, opts, draw) => {
  const svg = document.getElementById(`fig-${name}`);
  if (!svg) return;
  if (!(svg instanceof SVGSVGElement))
    throw new Error(`figure('${name}'): #fig-${name} is a <${svg.tagName.toLowerCase()}>, not an <svg>`);
  const { h, label } = opts || {};
  if (!(typeof h === 'number' && h > 0))
    throw new Error(`figure('${name}'): opts.h must be the viewBox height, a number above 0`);
  if (typeof label !== 'string' || !label.trim())
    throw new Error(`figure('${name}'): opts.label must be one sentence that states the finding`);
  svg.setAttribute('viewBox', `0 0 400 ${h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.replaceChildren();
  draw(svg);
};
