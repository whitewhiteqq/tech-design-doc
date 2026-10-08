// tech-design-doc · shots.mjs · screenshot a built page, so a person can READ every figure and every
// screen after every change.
//
// Usage:  node tools/shots.mjs <page.html> <outdir> [width=1280] [height=900]
//
// It writes into <outdir>:
//   <figure-name>.png   one per figure: its whole slot (kick, claim, figure, legend), at 2x
//   static-<id>.png     one per static figure: an inline <svg role="img"> that is not a fig-* figure,
//                       such as the small figure of an explainer card. The PNG holds the nearest
//                       element around it that has an id (the card), at 2x
//   screen-01.png ...   one per viewport-height screen, top to bottom, as the reader scrolls
// It prints a lint of every figure: text under 6.5 units (in a static figure: text under 10 px on
// the screen, the size of 6.5 units in a 640 px column), text or a drawn mark past the viewBox edge
// (cut off), and text boxes that overlap. The lint lists candidates. It never replaces reading the PNGs.
// It also prints where the summary band (.onepage) ends, and warns when it runs past the first screen.
//
// Motion is off (prefers-reduced-motion: reduce), so every shot shows the finished figure.
// Needs Node 22 or later (the global WebSocket), and Chrome or Edge: env CHROME, else the usual
// install paths, else PATH.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fail = msg => { console.error(`FAIL  ${msg}`); process.exit(1); };
const show = p => {                    // relative when close by, else absolute; always forward slashes
  const r = relative(process.cwd(), p).replaceAll('\\', '/');
  return !r ? '.' : r.startsWith('../../') || /^[A-Za-z]:/.test(r) ? p.replaceAll('\\', '/') : r;
};

const [pageArg, outArg, wArg, hArg] = process.argv.slice(2);
if (!pageArg || !outArg) {
  console.error('usage: node tools/shots.mjs <page.html> <outdir> [width=1280] [height=900]');
  process.exit(2);
}
if (typeof WebSocket === 'undefined')
  fail(`shots.mjs needs Node 22 or later for the global WebSocket. This is Node ${process.version}.`);
const W = Number(wArg || 1280), H = Number(hArg || 900);
if (!(W >= 200 && H >= 200)) fail(`width and height must be numbers of 200 or more, not "${wArg}" "${hArg}"`);
const page = resolve(pageArg), out = resolve(outArg);
if (!existsSync(page)) fail(`no file at ${show(page)}`);
mkdirSync(out, { recursive: true });

function findChrome() {
  const env = process.env.CHROME;
  if (env) {
    if (existsSync(env)) return env;
    fail(`CHROME is set to "${env}", but no file is there. Fix the path, or unset CHROME.`);
  }
  const local = process.env.LOCALAPPDATA && process.env.LOCALAPPDATA.replaceAll('\\', '/');
  const fixed = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    local && `${local}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  for (const p of fixed) if (existsSync(p)) return p;
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const name of ['google-chrome', 'chromium', 'chrome', 'msedge', 'google-chrome-stable', 'chromium-browser'])
    for (const dir of (process.env.PATH || '').split(delimiter))
      for (const ext of exts) if (dir && existsSync(join(dir, name + ext))) return join(dir, name + ext);
  fail('no Chrome or Edge found. Install Google Chrome, or set CHROME to the browser program.');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'tdd-shots-'));
const chrome = spawn(findChrome(), [
  '--headless=new', '--disable-gpu', '--run-all-compositor-stages-before-draw', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
  '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let ws, chromeLog = '';
const exited = new Promise(r => chrome.on('exit', r));

async function cleanup() {
  try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ id: 999999, method: 'Browser.close' })); } catch {}
  await Promise.race([exited, sleep(4000)]);
  if (chrome.exitCode === null) chrome.kill();
  for (let i = 0; i < 10; i++) {
    try { rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); }
  }
}

try {
  // ── connect: Chrome prints its DevTools address on stderr ──
  const wsUrl = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Chrome did not open DevTools within 30 s.\n' + chromeLog.slice(-600))), 30000);
    chrome.stderr.on('data', d => {
      chromeLog = (chromeLog + d).slice(-20000);         // keep reading, or Chrome blocks on a full pipe
      const m = chromeLog.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); res(m[1]); }
    });
    chrome.on('exit', c => { clearTimeout(t); rej(new Error(`Chrome stopped (code ${c}) before DevTools opened.\n` + chromeLog.slice(-600))); });
  });
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('cannot connect to Chrome DevTools')); });
  let seq = 0;
  const pending = new Map(), waiting = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id !== undefined) {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.rej(new Error(`${p.method}: ${m.error.message}`)); else p.res(m.result);
    } else {
      const w = waiting.find(x => x.method === m.method && x.session === m.sessionId);
      if (w) { waiting.splice(waiting.indexOf(w), 1); clearTimeout(w.t); w.res(m.params); }
    }
  };
  const cdp = (method, params = {}, session) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej, method });
    ws.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
  });
  const event = (method, session, ms = 30000) => new Promise((res, rej) => {
    const w = { method, session, res };
    w.t = setTimeout(() => { waiting.splice(waiting.indexOf(w), 1); rej(new Error(`no ${method} within ${ms / 1000} s`)); }, ms);
    waiting.push(w);
  });

  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, S);
    if (r.exceptionDetails) throw new Error('page script: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const shoot = async (file, params) => {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png', ...params }, S);
    writeFileSync(join(out, file), Buffer.from(data, 'base64'));
  };

  // ── load: screen media, motion off, so a figure never shows half-way through its entrance ──
  await cdp('Page.enable', {}, S);
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, S);
  await cdp('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, S);
  const loaded = event('Page.loadEventFired', S);
  await cdp('Page.navigate', { url: pathToFileURL(page).href }, S);
  await loaded;
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(300);

  const info = await evaluate(`(() => {
    const d = document.documentElement;
    const over = [...document.querySelectorAll('pre, table')].filter(e => e.scrollWidth > e.clientWidth + 1)
      .map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + e.scrollWidth + '/' + e.clientWidth + ' px');
    const band = document.querySelector('.onepage');      // the summary band: it must fit the first screen
    const r = band && band.getBoundingClientRect();
    return { docH: d.scrollHeight, docW: d.scrollWidth, over,
      band: r ? { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) } : null };
  })()`);
  console.log(`shots: ${show(page)} at ${W} x ${H}`);
  console.log(`  document ${info.docW} x ${info.docH} px: ${Math.ceil(info.docH / H)} screens`);
  if (info.band) console.log(info.band.bottom <= H
    ? `  summary band (.onepage) runs from y ${info.band.top} to ${info.band.bottom} px: it fits the first ${W} x ${H} screen, ${H - info.band.bottom} px to spare`
    : `warn  the summary band (.onepage) ends at y ${info.band.bottom} px, past the first ${H} px screen: cut it to fit`);

  // ── screens: scroll for real, so a sticky element shows where the reader sees it ──
  const n = Math.max(1, Math.ceil(info.docH / H)), screens = [];
  for (let i = 0; i < n; i++) {
    const y = Math.min(i * H, Math.max(0, info.docH - H));
    await evaluate(`scrollTo(0, ${y}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
    const file = `screen-${String(i + 1).padStart(2, '0')}.png`;
    await shoot(file, {});
    screens.push(file);
  }
  console.log(`  wrote ${screens.length} screens: ${screens[0]}${screens.length > 1 ? ' ... ' + screens.at(-1) : ''}`);

  // ── figures: the whole slot of each, at 2x, so 6.5-unit text is readable ──
  const figs = await evaluate(`(() => {
    scrollTo(0, 0);
    const seen = new Set(), out = [];
    for (const svg of document.querySelectorAll('svg[id^="fig-"]')) {
      const name = svg.id.slice(4);
      if (seen.has(name)) continue;
      seen.add(name);
      const box = svg.closest('figure.slot') || svg.closest('figure') || svg;
      const r = box.getBoundingClientRect(), s = svg.getBoundingClientRect();
      const vb = svg.viewBox && svg.viewBox.baseVal;
      out.push({ name, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
        unit: vb && vb.width ? s.width / vb.width : 0 });
    }
    return out;
  })()`);
  for (const f of figs) {
    if (!(f.w > 0 && f.h > 0)) { console.log(`  warn  fig-${f.name} has no size on screen: it is hidden, so no PNG`); continue; }
    await shoot(`${f.name}.png`, { captureBeyondViewport: true,
      clip: { x: Math.max(0, f.x - 8), y: Math.max(0, f.y - 8), width: f.w + 16, height: f.h + 16, scale: 2 } });
    console.log(`  wrote ${f.name}.png (slot ${Math.round(f.w)} x ${Math.round(f.h)} px, 1 viewBox unit = ${f.unit.toFixed(2)} px, 6.5 units = ${(6.5 * f.unit).toFixed(1)} px)`);
  }

  // ── static figures: an inline <svg role="img"> that is not a fig-* figure (the small figure of an
  //    explainer card). The PNG holds the nearest element around it with an id, at 2x. Each one gets
  //    data-shot="<name>" in this browser tab only, so the lint below finds it again ──
  const statics = await evaluate(`(() => {
    scrollTo(0, 0);
    const used = new Map(), out = [];
    [...document.querySelectorAll('svg[role="img"]:not([id^="fig-"])')].forEach((svg, i) => {
      if (svg.parentElement && svg.parentElement.closest('svg')) return;    // a mark inside a figure
      const holder = svg.parentElement && svg.parentElement.closest('[id]');
      let name = (svg.id || (holder && holder.id) || 'svg-' + (i + 1)).replace(/[^A-Za-z0-9_-]+/g, '-');
      const n = (used.get(name) || 0) + 1;
      used.set(name, n);
      if (n > 1) name += '-' + n;
      svg.setAttribute('data-shot', name);
      // the card around the figure; the figure alone when that element is a whole section
      const big = !holder || holder.getBoundingClientRect().height > 1.5 * innerHeight;
      const box = svg.id || big ? svg : holder;
      const r = box.getBoundingClientRect(), s = svg.getBoundingClientRect();
      const vb = svg.viewBox && svg.viewBox.baseVal;
      out.push({ name, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
        unit: vb && vb.width ? s.width / vb.width : 0 });
    });
    return out;
  })()`);
  for (const f of statics) {
    if (!(f.w > 0 && f.h > 0)) { console.log(`  warn  the static figure ${f.name} has no size on screen: it is hidden, so no PNG`); continue; }
    await shoot(`static-${f.name}.png`, { captureBeyondViewport: true,
      clip: { x: Math.max(0, f.x - 8), y: Math.max(0, f.y - 8), width: f.w + 16, height: f.h + 16, scale: 2 } });
  }
  if (statics.length) console.log(`  wrote ${statics.length} static figure${statics.length > 1 ? 's' : ''}: ` +
    `static-${statics[0].name}.png${statics.length > 1 ? ' ... static-' + statics.at(-1).name + '.png' : ''}` +
    (statics[0].unit ? ` (1 viewBox unit = ${statics[0].unit.toFixed(2)} px in the first)` : ''));

  // ── lint: the faults that came back again and again; read the PNGs to judge each one. A fig-*
  //    figure: text under 6.5 viewBox units. A static figure: text under 10 px on the screen, which
  //    is 6.5 units in a 400-unit figure 640 px wide ──
  const lint = await evaluate(`(() => {
    const out = [], E = 0.5;
    const all = [...[...document.querySelectorAll('svg[id^="fig-"]')].map(svg => ({ svg, name: svg.id, unitMin: 6.5 })),
                 ...[...document.querySelectorAll('svg[data-shot]')].map(svg => ({ svg, name: 'static-' + svg.dataset.shot, pxMin: 10 }))];
    for (const { svg, name, unitMin, pxMin } of all) {
      const vb = svg.viewBox && svg.viewBox.baseVal, sr = svg.getBoundingClientRect();
      const res = { name, small: [], smallWhat: unitMin ? 'text under 6.5 units' : 'text under 10 px on the screen',
        edge: [], marks: [], overlap: [], hidden: false };
      out.push(res);
      if (!vb || !vb.width || !sr.width) { res.hidden = true; continue; }
      const k = sr.width / vb.width;
      const say = n => '"' + n.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40) + '"';
      const box = n => { const r = n.getBoundingClientRect();
        return { x: (r.left - sr.left) / k + vb.x, y: (r.top - sr.top) / k + vb.y, w: r.width / k, h: r.height / k }; };
      const pastEdge = b => {
        const past = [];
        if (b.x < vb.x - E) past.push('left ' + (vb.x - b.x).toFixed(1));
        if (b.x + b.w > vb.x + vb.width + E) past.push('right ' + (b.x + b.w - vb.x - vb.width).toFixed(1));
        if (b.y < vb.y - E) past.push('top ' + (vb.y - b.y).toFixed(1));
        if (b.y + b.h > vb.y + vb.height + E) past.push('bottom ' + (b.y + b.h - vb.y - vb.height).toFixed(1));
        return past;
      };
      // a drawn mark past the edge is cut off; an invisible hit area and a <defs> template are not drawn
      const NOT_DRAWN = new Set(['defs', 'clippath', 'mask', 'marker', 'pattern', 'symbol']);
      for (const m of svg.querySelectorAll('circle, ellipse, rect, line, polyline, polygon, path, image, use')) {
        let p = m.parentNode, hidden = false;
        for (; p && p !== svg; p = p.parentNode) if (NOT_DRAWN.has(p.tagName.toLowerCase())) hidden = true;
        const cs = getComputedStyle(m);
        if (hidden || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        const noFill = cs.fill === 'none' || +cs.fillOpacity === 0 || /,\\s*0\\)$/.test(cs.fill);
        const noStroke = cs.stroke === 'none' || +cs.strokeOpacity === 0 || /,\\s*0\\)$/.test(cs.stroke);
        if (noFill && noStroke) continue;
        const past = pastEdge(box(m));
        if (past.length) res.marks.push('<' + m.tagName.toLowerCase() + '> past the ' + past.join(', '));
      }
      for (const n of svg.querySelectorAll('text, tspan')) {
        if (!n.textContent.trim()) continue;
        const fs = parseFloat(getComputedStyle(n).fontSize);
        if (unitMin && fs < unitMin - 1e-6) res.small.push(say(n) + ' ' + (+fs.toFixed(2)));
        if (pxMin && fs * k < pxMin - 1e-6) res.small.push(say(n) + ' ' + (fs * k).toFixed(1) + ' px');
      }
      const T = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim() && t.getBoundingClientRect().width > 0)
        .map(t => ({ t, b: box(t) }));
      for (const { t, b } of T) {
        const past = pastEdge(b);
        if (past.length) res.edge.push(say(t) + ' past the ' + past.join(', '));
      }
      for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
        const a = T[i].b, c = T[j].b;
        const ix = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
        const iy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (ix > 1 && iy > 0.3 * Math.min(a.h, c.h)) res.overlap.push(say(T[i].t) + ' x ' + say(T[j].t));
      }
    }
    return out;
  })()`);
  console.log('lint (candidates only: open the PNG and read the figure)');
  const list = (xs, what) => `${xs.length} ${what}: ${xs.slice(0, 6).join(' | ')}${xs.length > 6 ? ` | and ${xs.length - 6} more` : ''}`;
  for (const r of lint) {
    const found = [];
    if (r.hidden) found.push('not measured: the figure has no size on screen');
    if (r.small.length) found.push(list(r.small, r.smallWhat));
    if (r.edge.length) found.push(list(r.edge, 'text past the viewBox edge'));
    if (r.marks.length) found.push(list(r.marks, r.marks.length > 1 ? 'marks past the viewBox edge' : 'mark past the viewBox edge'));
    if (r.overlap.length) found.push(list(r.overlap, r.overlap.length > 1 ? 'pairs of text boxes overlap' : 'pair of text boxes overlaps'));
    console.log(`  ${r.name}  ${found.length ? found.join('\n' + ' '.repeat(r.name.length + 4)) : 'ok'}`);
  }
  if (info.docW > W) console.log(`warn  the page scrolls sideways at ${W} px: it is ${info.docW} px wide`);
  for (const o of info.over) console.log(`warn  a box is wider than its column, so it scrolls: ${o}`);
  console.log(`output: ${show(out)}`);
  await cleanup();
  process.exit(0);
} catch (e) {
  console.error(`FAIL  ${e.message}`);
  await cleanup();
  process.exit(1);
}
