/**
 * Lighthouse gate for CI (and locally): serves dist/ the way Cloudflare Pages does (public/_headers, brotli), runs
 * Lighthouse RUNS times (default 3) on mobile and desktop, and fails on a regression. GitHub's shared runners vary a
 * lot run to run, so Performance is gated on clear regressions only; the 100 target stays a manual pre-launch check
 * (`bun run qa:perf`).
 *   accessibility, best-practices, seo   median must be 100
 *   performance                          median at least PERF_MIN (90), CLS at most 0.1, TBT at most 200ms
 * Writes a Markdown table to $GITHUB_STEP_SUMMARY when it is set. Run `bun run build` first. FORMS picks the form
 * factors (CI runs each on its own runner, so one doesn't slow the other's measurements).
 *
 *   bun run qa:lighthouse              RUNS=1 bun run qa:lighthouse              FORMS=desktop bun run qa:lighthouse
 *   PAGES=volunteer/ bun run qa:lighthouse   (default: the home page and the volunteer guide)
 */
import { appendFileSync, existsSync } from "node:fs";

import { runLighthouse } from "./perf/lighthouse.ts";
import { serve } from "./perf/serve.ts";

const DIST = new URL("../../dist/", import.meta.url).pathname;
if (!existsSync(`${DIST}index.html`)) {
  console.error("lighthouse: no dist/ (run `bun run build` first)");
  process.exit(2);
}
const PERF_MIN = Number(process.env.PERF_MIN ?? 90);
const CLS_MAX = 0.1;
const TBT_MAX = 200;
const PORT = 4401;
const FORMS = (process.env.FORMS ?? "mobile,desktop").split(",");
/** pages, relative to the site root: the home page and the volunteer guide */
const PAGES = (process.env.PAGES ?? ",volunteer/").split(",");

const server = await serve(DIST, PORT);
const failures = [];
const rows = [];
try {
  for (const path of PAGES) {
    const lh = await runLighthouse(`http://127.0.0.1:${PORT}/${path}`, {
      runs: Number(process.env.RUNS ?? 3),
      forms: FORMS,
    });
    for (const [device, r] of Object.entries(lh)) {
      const form = `/${path} ${device}`;
      const m = r.median;
      const { LCP, TBT, CLS, FCP } = r.metrics;
      for (const c of ["accessibility", "best-practices", "seo"])
        if (m[c] < 100) failures.push(`${form} ${c} ${m[c]} (needs 100)`);
      if (m.performance < PERF_MIN)
        failures.push(
          `${form} performance ${m.performance} (needs ${PERF_MIN})`
        );
      if (CLS > CLS_MAX)
        failures.push(`${form} CLS ${CLS.toFixed(3)} (max ${CLS_MAX})`);
      if (TBT > TBT_MAX)
        failures.push(`${form} TBT ${Math.round(TBT)}ms (max ${TBT_MAX}ms)`);
      rows.push(
        `| ${form} | ${m.performance} (${r.scores.performance.join(", ")}) | ${m.accessibility} | ${m["best-practices"]} | ${m.seo} | ${Math.round(FCP)}ms | ${Math.round(LCP)}ms | ${Math.round(TBT)}ms | ${CLS.toFixed(3)} |`
      );
      console.log(
        `${form}: performance ${m.performance} (runs ${r.scores.performance.join(", ")}) / accessibility ${m.accessibility} / best-practices ${m["best-practices"]} / seo ${m.seo}; FCP ${Math.round(FCP)}ms LCP ${Math.round(LCP)}ms TBT ${Math.round(TBT)}ms CLS ${CLS.toFixed(3)}`
      );
      if (r.failing.length)
        console.log(`  not perfect: ${r.failing.join("; ")}`);
    }
  }
} finally {
  server.close();
}

const summary = [
  `### Lighthouse, ${FORMS.join(" and ")} (median of ${process.env.RUNS ?? 3} runs)`,
  "",
  "| | Performance (runs) | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |",
  "|---|---|---|---|---|---|---|---|---|",
  ...rows,
  "",
  failures.length
    ? `**Failed:** ${failures.join("; ")}`
    : `Passed: accessibility, best practices and SEO 100; performance ≥ ${PERF_MIN}, CLS ≤ ${CLS_MAX}, TBT ≤ ${TBT_MAX}ms.`,
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (failures.length) {
  console.error(`lighthouse: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("lighthouse: all gates met");
