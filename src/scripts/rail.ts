/** Header scroll-spy, the programme index rail, and the phone sticky donate bar. */
import { $, $$, PHONE, inView, on, onScrollFrame } from "./dom";

const spyEls = $$("[data-spy]");
const spyLinks = $$("[data-spy-link]");
const pidx = $("[data-pidx]");
const idxLinks = pidx ? $$<HTMLAnchorElement>("a", pidx) : [];
const BANDS = ["b0", "b1", "kalakriti", "b3"]
  .map((id) => document.getElementById(id))
  .filter((x) => x !== null);
const hero = $(".s-hero");
const sbar = $("[data-sbar]");
const noBar = [$("#donate"), $("#closing"), $("footer")].filter(
  (x) => x !== null
);
const menu = $("#menu");
let lastIdx: string | null = null;

/**
 * One pass per frame: every layout read first (rects, the phone query, the menu state, the index link's offset), then
 * every write (classes, attributes, the index scroll), so the pass costs one layout, as in loops.ts.
 */
export function onScroll() {
  // reads
  const line = innerHeight * 0.4;
  const phone = PHONE.matches;
  let cur: string | null = null;
  for (const el of spyEls)
    if (el.getBoundingClientRect().top <= line) cur = el.dataset.spy ?? null;
  const rail = pidx && BANDS.length === 4;
  let showIdx = false;
  let act: string | null = null;
  let idxLeft: number | null = null;
  if (rail) {
    const t = BANDS[0]!.getBoundingClientRect().top;
    const b = BANDS[3]!.getBoundingClientRect().bottom;
    showIdx = t <= line && b >= line;
    for (const s of BANDS)
      if (s.getBoundingClientRect().top <= line) act = s.id;
    if (phone && act && act !== lastIdx) {
      const a = idxLinks.find((x) => x.dataset.k === act);
      // the .on state changes no geometry at the phone size, so the offset read before the writes is the one after
      if (a) idxLeft = a.offsetLeft;
    }
  }
  // phone donate bar: after the hero, never over Donate or the closing/footer
  const bar =
    sbar && hero
      ? phone &&
        hero.getBoundingClientRect().bottom < 0 &&
        !noBar.some(inView) &&
        !!menu?.hidden
      : null;

  // writes
  for (const a of spyLinks) {
    const o = a.dataset.spyLink === cur;
    a.classList.toggle("on", o);
    if (o) a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
  }
  // index: only while the programme bands are in view
  if (rail) {
    pidx.classList.toggle("show", showIdx);
    for (const a of idxLinks) {
      const o = a.dataset.k === act;
      a.classList.toggle("on", o);
      if (o) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    pidx.classList.toggle("on-ink", act === "kalakriti");
    if (idxLeft !== null)
      pidx.scrollTo({
        left: idxLeft - 12,
        behavior: on() ? "smooth" : "auto",
      });
    lastIdx = act;
  }
  if (sbar && bar !== null) {
    sbar.classList.toggle("show", bar);
    sbar.inert = !bar;
  }
}

export const initRail = () => onScrollFrame(onScroll);
