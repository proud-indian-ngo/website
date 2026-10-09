/**
 * Background inert while a dialog is open. Only the page's top-level landmarks get `inert` (the skip link, header,
 * phone menu, index rail, main, footer, sticky bar: the body's children, minus scripts and the hidden sprite <svg>s),
 * never every element. Even so, `inert` restyles a landmark's whole subtree, and <main> is most of the page: on a
 * 4x-throttled phone that was 45-115ms inside the tap that opened the menu or the drawer.
 *
 * So the dialog shows, takes focus and starts its slide in the tap's own task, and the inert step runs after its first
 * frame, in small tasks: each of main's sections first, then main itself (by then its subtree is already inert, so
 * that restyle stops at the sections), then the other landmarks; closing goes in the reverse order. Each task forces
 * its own restyle, so the work can't pile up into one frame. Closing calls `done` at the end (focus goes back to the
 * opener only once nothing around it is inert any more). During those few frames focus is already inside the dialog
 * (and the drawer traps Tab). A newer open or close cancels whatever an earlier one still had queued.
 */
const was = new WeakMap<Element, boolean>();
const applied = new WeakSet<Element>();
let gen = 0;

function units(el: Element) {
  const out: HTMLElement[] = [];
  for (const k of [...document.body.children] as HTMLElement[]) {
    if (k === el || k.contains(el) || k.tagName === "SCRIPT") continue;
    if (k.tagName.toLowerCase() === "svg") continue; // the hidden sprites: nothing to reach in there
    if (k.tagName === "MAIN")
      out.push(...(k.children as HTMLCollectionOf<HTMLElement>));
    out.push(k);
  }
  return out;
}

export function modal(el: Element, open: boolean, done?: () => void) {
  const g = ++gen;
  const ks = units(el);
  if (!open) ks.reverse();
  const step = (i: number) => {
    if (g !== gen) return;
    const k = ks[i];
    if (!k) return done?.();
    if (open) {
      if (!applied.has(k)) {
        was.set(k, k.inert);
        applied.add(k);
      }
      k.inert = true;
    } else if (applied.has(k)) {
      k.inert = !!was.get(k);
      applied.delete(k);
    }
    void getComputedStyle(k).visibility; // this unit's restyle, in this task
    setTimeout(() => step(i + 1), 0);
  };
  // after the dialog's first frame: rAF runs before that paint, the timeout after it
  requestAnimationFrame(() => setTimeout(() => step(0), 0));
}

/**
 * Page scroll lock while the reports drawer or the phone menu is open: html.scroll-lock sets overflow: hidden on
 * <html>, the element whose overflow the viewport takes (base.css gives html overflow-x: clip, so overflow on body
 * never reached the viewport, and the page kept scrolling under a dialog). Wheel, trackpad, touch, keyboard and
 * scrollbar scrolling all stop; the dialog's own scroller still scrolls, with overscroll-behavior: contain. The page
 * stays where it was (overflow: hidden keeps the scroll offset); close puts it back exactly, in case anything moved
 * it.
 *
 * Cost: classes on <html> that no other selector mentions, so with overlay scrollbars (phones, macOS by default) the
 * lock restyles a handful of elements and lays out almost nothing. Only a classic scrollbar, one that takes width,
 * also gets .scroll-gutter (scrollbar-gutter: stable): it keeps the bar's gutter, so the page neither reflows nor
 * shifts sideways when the bar goes. That is cheap with the brand scrollbar (a few elements); with a native classic
 * bar (macOS set to always show scroll bars) Chromium restyles the whole page once on lock and once on unlock.
 */
let lockY = 0;
export function lockScroll(on: boolean) {
  const d = document.documentElement;
  if (on === d.classList.contains("scroll-lock")) return;
  if (on) {
    lockY = scrollY;
    if (innerWidth > d.clientWidth) d.classList.add("scroll-gutter");
    d.classList.add("scroll-lock");
  } else {
    d.classList.remove("scroll-lock", "scroll-gutter");
    if (scrollY !== lockY) scrollTo({ top: lockY, behavior: "instant" });
  }
}

/**
 * The first time a hidden dialog is shown, the browser lays it out from scratch (fonts at new sizes, first styles),
 * which made the first tap on the menu or a report card a ~80ms task on a slow phone; every later open takes ~2ms.
 * Do that first layout once while the page is idle: show it invisibly, measure, hide it again, all in one task, so
 * nothing paints in between and nothing is ever focusable or announced.
 */
export function prewarm(el: HTMLElement | null) {
  if (!el?.hidden) return;
  const run = () => {
    if (!el.hidden) return;
    // no transitions while it flips: the reports drawer slides on show/hide, and this must not start a slide-out
    el.style.transition = "none";
    el.style.visibility = "hidden";
    el.hidden = false;
    void el.offsetHeight;
    el.hidden = true;
    void el.offsetHeight;
    el.style.visibility = "";
    el.style.transition = "";
  };
  // 2.5s after load, then the next idle moment: the hero load sequence is over by then, so this never competes with it
  const idle = () =>
    "requestIdleCallback" in window
      ? requestIdleCallback(run, { timeout: 5000 })
      : setTimeout(run, 0);
  const later = () => setTimeout(idle, 2500);
  if (document.readyState === "complete") later();
  else addEventListener("load", later, { once: true });
}
