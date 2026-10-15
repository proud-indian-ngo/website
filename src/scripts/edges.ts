/**
 * Safari's chrome takes the page's colours. iOS Safari ignores theme-color in a tab, but it carries a fixed element at
 * the top or bottom edge behind its status bar and toolbar (WebKit bug 301756). Base.astro puts one thin strip at each
 * edge; this keeps their colours on whatever band is under that edge, and theme-color on the top one.
 *
 * The colour is the first opaque, full-width background up from the element at the edge (images, cards and
 * translucent layers are looked through). The strips and the header are pointer-events: none, so elementFromPoint sees past them.
 */
import { $, D, onScrollFrame } from "./dom";

/** the bands' full width: the body's content box (base.css pads it clear of a landscape notch) */
function bandWidth() {
  const s = getComputedStyle(document.body);
  return (
    document.body.clientWidth -
    parseFloat(s.paddingLeft) -
    parseFloat(s.paddingRight)
  );
}

function bgAt(y: number, w: number): string | null {
  let el = document.elementFromPoint(innerWidth / 2, y);
  for (; el; el = el.parentElement) {
    // the brand colours are hex or rgba, so an opaque one computes to rgb() and anything with alpha to rgba()
    const c = getComputedStyle(el).backgroundColor;
    // only a full-width background counts: a card or ticket at the edge is not what the chrome should match
    if (c.startsWith("rgb(") && el.getBoundingClientRect().width >= w - 1)
      return c;
  }
  return null;
}

export function initEdges() {
  const meta = $<HTMLMetaElement>('meta[name="theme-color"]');
  const last = { top: "", bottom: "" };
  const paint = () => {
    // reads
    const w = bandWidth();
    const top = bgAt(0, w);
    const bottom = bgAt(innerHeight - 1, w);
    // writes
    if (top && top !== last.top) {
      last.top = top;
      D.style.setProperty("--edge-top", top);
      meta?.setAttribute("content", top);
    }
    if (bottom && bottom !== last.bottom) {
      last.bottom = bottom;
      D.style.setProperty("--edge-bottom", bottom);
    }
  };
  let raf = 0;
  const soon = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        paint();
      });
  };
  onScrollFrame(paint);
  addEventListener("resize", soon);
  // the phone menu and the reports drawer open over the page without a scroll
  new MutationObserver(soon).observe(document.body, {
    subtree: true,
    attributeFilter: ["hidden"],
  });
  soon();
}
