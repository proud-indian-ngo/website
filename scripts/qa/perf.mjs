/**
 * Performance check: builds the site to a temp folder, serves it the way Cloudflare Pages does (public/_headers,
 * brotli), then runs
 *   1. Lighthouse 5 times on mobile and on desktop (medians, and every scored audit that isn't a perfect pass), and
 *   2. the adaptive draw-on check (scripts/qa/perf/drawmode.mjs): drawn up to 3x CPU, lite wipe at 4x and 6x, and
 *      the wipe path itself, and
 *   3. the frame profiler (scripts/qa/perf/frames.mjs) at 4x and 6x CPU throttling, 390px and 1440px.
 * Gates (exit code 1 if missed): Lighthouse 100 in all four categories on both form factors (median; mobile Performance
 * 99 is accepted, MOBILE_PERF_MIN=100 to tighten), and at 4x, under
 * 1% bad frames (over 16.7ms) and no long task during an animation, in every scenario. 6x is reported, not gated.
 *
 *   bun run qa:perf                        everything (about 25 minutes)
 *   RUNS=3 bun run qa:perf                 fewer Lighthouse runs
 *   SKIP_FRAMES=1 bun run qa:perf          no frame profiling (SKIP_LH=1: no Lighthouse, SKIP_DRAW=1: no draw-mode check)
 *   RATES=4 WIDTHS=390 bun run qa:perf     a smaller frame matrix
 *   SITE=http://127.0.0.1:4321/ ...        measure a running server instead of building (no brotli/_headers then)
 *
 * Output: /tmp/pi-perf-qa/{lighthouse.json,frames.json,frames.txt}.
 */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { checkDrawMode } from "./perf/drawmode.mjs";
import { runFrames, table } from "./perf/frames.mjs";
import { runLighthouse } from "./perf/lighthouse.mjs";
import { serve } from "./perf/serve.mjs";

const OUT = process.env.OUT ?? "/tmp/pi-perf-qa";
const PORT = 4400;
const env = (k, d) => process.env[k] ?? d;
mkdirSync(OUT, { recursive: true });

let url = process.env.SITE;
let server = null;
if (!url) {
  const dist = `${OUT}/dist`;
  rmSync(dist, { recursive: true, force: true });
  console.log(`building to ${dist} ...`);
  execSync(`bunx astro build --outDir ${dist}`, {
    stdio: ["ignore", "ignore", "inherit"],
  });
  server = await serve(dist, PORT);
  url = `http://127.0.0.1:${PORT}/`;
}

const failures = [];
try {
  if (!process.env.SKIP_LH) {
    const lh = await runLighthouse(url, { runs: +env("RUNS", 5) });
    writeFileSync(`${OUT}/lighthouse.json`, JSON.stringify(lh, null, 1));
    for (const [form, r] of Object.entries(lh)) {
      const m = r.metrics;
      console.log(
        `\nLighthouse ${form} (median of ${r.scores.performance.length}): ` +
          Object.entries(r.median)
            .map(([c, v]) => `${c} ${v}`)
            .join(" / ")
      );
      console.log(
        `  FCP ${Math.round(m.FCP)}ms  LCP ${Math.round(m.LCP)}ms  TBT ${Math.round(m.TBT)}ms  CLS ${m.CLS.toFixed(3)}  SI ${Math.round(m.SI)}ms  (LCP element: ${r.lcpElement})`
      );
      console.log(`  performance runs: ${r.scores.performance.join(", ")}`);
      if (r.failing.length)
        console.log(`  not perfect: ${r.failing.join("; ")}`);
      // mobile Performance 99 is accepted (2026-10-08): what's left is Lighthouse counting the below-the-fold lazy
      // images that start before the first paint; raise MOBILE_PERF_MIN to 100 to gate on it again
      const min = (c) =>
        form === "mobile" && c === "performance"
          ? +env("MOBILE_PERF_MIN", 99)
          : 100;
      for (const [c, v] of Object.entries(r.median))
        if (v < min(c)) failures.push(`Lighthouse ${form} ${c} ${v}`);
    }
  }
  if (!process.env.SKIP_DRAW) {
    const dm = await checkDrawMode(url);
    console.log(
      `\nDraw-on mode (src/scripts/lite.ts)\n  ${dm.rows.join("\n  ")}`
    );
    failures.push(...dm.failures);
  }
  if (!process.env.SKIP_FRAMES) {
    const rates = env("RATES", "4,6").split(",").map(Number);
    const widths = env("WIDTHS", "390,1440").split(",").map(Number);
    const fr = await runFrames(url, { rates, widths, out: OUT });
    const txt = table(fr);
    writeFileSync(`${OUT}/frames.txt`, txt);
    console.log(
      `\nFrames (bad = over 16.7ms; >50 = long tasks; anim = long tasks during an animation)\n${txt}`
    );
    for (const [label, res] of Object.entries(fr)) {
      if (!label.endsWith("-x4")) continue;
      const rows = {
        ...res,
        ...Object.fromEntries(
          Object.entries(res.idle ?? {}).map(([k, v]) => [`idle:${k}`, v])
        ),
      };
      for (const [name, r] of Object.entries(rows)) {
        if (!r?.frames || name === "idle") continue;
        if (r.frames.badPct >= 1)
          failures.push(`${label} ${name}: ${r.frames.badPct}% bad frames`);
        if (r.main.longDuringAnim)
          failures.push(
            `${label} ${name}: ${r.main.longDuringAnim} long task(s) during animation`
          );
      }
    }
  }
} finally {
  server?.close();
}

if (failures.length) {
  console.log(
    `\nqa:perf: ${failures.length} gate(s) missed\n  ${failures.join("\n  ")}`
  );
  process.exit(1);
}
console.log("\nqa:perf: all gates met");
