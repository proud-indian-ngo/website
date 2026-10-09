/**
 * Site scripts entry (bundled by Astro). Ported from prototypes/final/site.js and split by concern; the boot order
 * below is the prototype's. Every module tolerates missing markup, so the same bundle runs on every page.
 */
import { initBento } from "./bento";
import { PHONE } from "./dom";
import { initDonate } from "./donate";
import { refreshEvents } from "./events-refresh";
import { fitProg, fitVerbs } from "./layout";
import { initLite } from "./lite";
import { initLoops, syncLoops } from "./loops";
import { initMenu } from "./menu";
import { initNudge } from "./nudge";
import { initPause } from "./pause";
import { initPlane, layoutPlane } from "./plane";
import { initRail, onScroll } from "./rail";
import { initReportsDrawer } from "./reports-drawer";
import { fireLoadTriggers, initReveal, sweep } from "./reveal";
import { initWobble } from "./wobble";

const relayout = () => {
  fitVerbs();
  fitProg();
  layoutPlane();
  onScroll();
  syncLoops();
  sweep();
};

// first: the draw-on mode (drawn or lite wipe) is measured from the very first frames
initLite();
initRail();
initMenu();
initDonate();
initReportsDrawer();
initLoops();
initWobble();
initBento();
initReveal();
initPlane();
initNudge();
initPause();

// boot: the header and hero load sequence is CSS and is already playing from the first paint; mark it as played. The
// below-the-fold measuring (verb fitting, the plane path, scroll-spy) waits one frame so it does not hold up the
// hero's first paint.
fireLoadTriggers();
requestAnimationFrame(() => setTimeout(relayout, 0));
// relayout once the fonts are in (text widths change). Image loads don't need the whole pass (every <img> carries
// its width and height); only the plane path is re-measured, coalesced to one frame, as it is now cheap.
document.fonts.ready.then(relayout);
let iraf = 0;
const planeSoon = () => {
  if (!iraf)
    iraf = requestAnimationFrame(() => {
      iraf = 0;
      layoutPlane();
    });
};
for (const i of document.images)
  if (!i.complete) i.addEventListener("load", planeSoon, { once: true });
let rt = 0;
addEventListener("resize", () => {
  clearTimeout(rt);
  rt = window.setTimeout(relayout, 120);
});
PHONE.addEventListener("change", relayout);
// While scrolling, re-check loop visibility and the reveal sweep at most every 100ms. IntersectionObservers already
// start reveals and loops the moment they enter view; this pass is the backstop for fast scrolls and jumps (triggers
// scrolled past are shown at rest), so it doesn't need to run, and read layout, on every frame.
let lt = 0;
let last = 0;
const scrollPass = () => {
  lt = 0;
  last = performance.now();
  syncLoops();
  sweep();
};
addEventListener(
  "scroll",
  () => {
    if (!lt)
      lt = window.setTimeout(
        scrollPass,
        Math.max(0, 100 - (performance.now() - last))
      );
  },
  { passive: true }
);

refreshEvents(() => {
  fitProg();
  syncLoops();
  sweep();
});
