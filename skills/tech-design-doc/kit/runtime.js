/* tech-design-doc · runtime.js · the only script a built page carries.
   Every figure is already drawn in the markup, so the page is complete without this script.
   It does two optional things. */

/* 1 · Motion. Replay the entrance animation of a figure when the reader scrolls to it. A figure that
   is visible at load stays still, so a screenshot, a preview pane or a script-blocked viewer always
   shows the finished figure. Reduced motion turns this off, and style.css never animates in print. */
(() => {
  if (!('IntersectionObserver' in window) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const seen = new WeakSet();
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    const svg = e.target;
    if (!seen.has(svg)) {                 // the first report tells where the figure is at load
      seen.add(svg);
      if (e.isIntersecting) { io.unobserve(svg); return; }
    }
    if (e.isIntersecting) { svg.classList.add('play'); io.unobserve(svg); }
  }));
  document.querySelectorAll('svg[id^="fig-"]').forEach(svg => io.observe(svg));
})();

/* 2 · Print. Open every closed <details> before print, so the PDF carries the table twins, and close
   them again after. Headless Chrome fires beforeprint too, so tools/pdf.py prints them open. */
(() => {
  let opened = [];
  addEventListener('beforeprint', () => {
    opened = [...document.querySelectorAll('details:not([open])')];
    opened.forEach(d => { d.open = true; });
  });
  addEventListener('afterprint', () => {
    opened.forEach(d => { d.open = false; });
    opened = [];
  });
})();
