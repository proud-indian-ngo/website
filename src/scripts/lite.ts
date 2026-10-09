/**
 * Adaptive draw-ons. The hand-drawn reveals (stroke-dashoffset) are the one kind of motion Chrome can't run on the
 * compositor, so on a slow device they drop frames while the page scrolls. There, the site swaps them for a
 * compositor-only left-to-right wipe: html.lite-draw.
 *
 * How it decides, once per page load (then remembered for the tab in sessionStorage, so later pages agree):
 *   1. Hints: few cores (hardwareConcurrency <= 4), little memory (deviceMemory <= 4), Save-Data, a slow effectiveType.
 *      Never decisive on their own; two or more lower the bar in step 2.
 *   2. At boot, a fixed 300k-step integer loop is timed (~1.5-2ms on a current laptop or phone). Lite at once if it
 *      takes BENCH_MS or more (BENCH_HINTED_MS with two hints).
 *   3. Otherwise the page's own main-thread cost while the hero plays decides: the long animation frames (over 50ms)
 *      after the first one (the first render), summed over the first WINDOW ms after boot. Lite at LOAF_MS or more.
 *      As a backstop (browsers without that API), requestAnimationFrame intervals in the same window: lite if more
 *      than a quarter are over 20ms.
 *   Calibration (Playwright Chromium, CDP CPU throttling, 390px and 1440px, 3 runs each; scripts/qa/perf.mjs re-checks
 *   it): the loop took 1.5-2.2ms unthrottled, 3-3.5ms at 2x, 4.4-5.3ms at 3x, 5.9-8.2ms at 4x, 8.5-10.9ms at 6x; the
 *   long frames after the first summed to 0 unthrottled, ~60ms at 3x, 75-290ms at 4x and 300ms+ at 6x. So unthrottled,
 *   2x and 3x stay drawn; 4x and 6x switch at boot, well before the first below-the-fold draw-on.
 * Lite never switches back mid-page, and draw-ons already played keep their look. Pause and reduced motion are
 * unaffected (no draw-on plays at all).
 *
 * QA: `?draw=lite` or `?draw=full` forces a mode (and stores it); window.__piDraw holds the decision and its inputs.
 */
import { D } from "./dom";

const KEY = "pi-draw";
const BENCH_MS = 5.5;
const BENCH_HINTED_MS = 4.5;
const LOAF_MS = 120;
const WINDOW = 1200;
const SLOW_FRAME = 20;
const SLOW_SHARE = 0.25;

export const lite = () => D.classList.contains("lite-draw");

interface Probe {
  lite: boolean;
  decided: boolean;
  source: "forced" | "stored" | "bench" | "frames" | "measured" | "pending";
  at?: number;
  hints?: number;
  bench?: number;
  loaf?: number;
  slowShare?: number;
}

function hints() {
  const n = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  let h = 0;
  if ((n.hardwareConcurrency || 8) <= 4) h++;
  if (n.deviceMemory !== undefined && n.deviceMemory <= 4) h++;
  if (n.connection?.saveData) h++;
  if (/^(slow-2g|2g|3g)$/.test(n.connection?.effectiveType ?? "")) h++;
  return h;
}

function bench() {
  const t = performance.now();
  let x = 0;
  for (let i = 0; i < 300000; i++) x = (x + i * 7) % 1000003;
  const ms = performance.now() - t;
  return x < 0 ? -1 : Math.round(ms * 100) / 100; // x is read so the loop can't be optimised away
}

function decide(isLite: boolean, probe: Probe, source: Probe["source"]) {
  if (probe.decided) return;
  probe.decided = true;
  probe.lite = isLite;
  probe.source = source;
  probe.at = Math.round(performance.now());
  D.classList.toggle("lite-draw", isLite);
  try {
    sessionStorage.setItem(KEY, isLite ? "lite" : "full");
  } catch {
    /* private mode: decide again on the next page */
  }
}

export function initLite() {
  const probe: Probe = { lite: false, decided: false, source: "pending" };
  (window as unknown as { __piDraw: Probe }).__piDraw = probe;
  const forced = new URLSearchParams(location.search).get("draw");
  if (forced === "lite" || forced === "full")
    return decide(forced === "lite", probe, "forced");
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(KEY);
  } catch {
    stored = null;
  }
  if (stored === "lite" || stored === "full")
    return decide(stored === "lite", probe, "stored");

  const h = (probe.hints = hints());
  const b = (probe.bench = bench());
  if (b >= (h >= 2 ? BENCH_HINTED_MS : BENCH_MS))
    return decide(true, probe, "bench");

  // the page's own cost: long animation frames after the first render, and rAF intervals, over WINDOW ms
  const t0 = performance.now();
  let loaf = 0;
  let first = true;
  let obs: PerformanceObserver | null = null;
  try {
    obs = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (first) first = false;
        else loaf += e.duration;
      }
      probe.loaf = Math.round(loaf);
      if (loaf >= LOAF_MS) {
        obs?.disconnect();
        decide(true, probe, "frames");
      }
    });
    obs.observe({ type: "long-animation-frame", buffered: true });
  } catch {
    obs = null; // no Long Animation Frames API (Safari, Firefox): the rAF backstop decides
  }
  const gaps: number[] = [];
  let last = 0;
  const tick = (t: number) => {
    if (probe.decided) return;
    if (last) gaps.push(t - last);
    last = t;
    if (t - t0 < WINDOW) return void requestAnimationFrame(tick);
    obs?.disconnect();
    const g = gaps.slice(2);
    const slow = g.length
      ? g.filter((x) => x > SLOW_FRAME).length / g.length
      : 0;
    probe.slowShare = Math.round(slow * 100) / 100;
    decide(slow > SLOW_SHARE, probe, "measured");
  };
  requestAnimationFrame(tick);
}
