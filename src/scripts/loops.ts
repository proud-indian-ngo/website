/**
 * 02 + 10 + ambient doodles: every .loop element runs only while it is on screen. Visibility is measured from the
 * live layout every time (scroll, resize, observer callbacks), never cached from IntersectionObserver entries. All
 * rects are read first, then classes written, so there is one layout per pass. Loops hidden at a breakpoint
 * (display:none) measure 0 wide and stay paused.
 */
import { $$ } from "./dom";

const loops = $$(".loop");
const shown = (el: Element) => {
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 &&
    r.bottom > 0 &&
    r.top < innerHeight &&
    r.right > 0 &&
    r.left < innerWidth
  );
};

export function syncLoops() {
  const vis = loops.map(shown);
  loops.forEach((el, i) => el.classList.toggle("is-paused", !vis[i]));
  // the first pass releases the hold motion.css puts on every loop until visibility is known
  document.documentElement.classList.add("loops-on");
}

export function initLoops() {
  const io = new IntersectionObserver(syncLoops);
  for (const el of loops) io.observe(el);
  // street scenes: viewBox units per screen pixel, for the line widths of their animated groups (closing-footer.css)
  const ro = new ResizeObserver((es) => {
    for (const e of es) {
      const svg = e.target as SVGSVGElement;
      const vb = svg.viewBox.baseVal;
      const { width: w, height: h } = e.contentRect;
      if (vb && w && h)
        svg.style.setProperty(
          "--scene-k",
          (1 / Math.min(w / vb.width, h / vb.height)).toFixed(4)
        );
    }
  });
  for (const el of $$(".fC-scene")) ro.observe(el);
}
