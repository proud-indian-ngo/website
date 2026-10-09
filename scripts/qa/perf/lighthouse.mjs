/**
 * Lighthouse, run `runs` times per form factor in Playwright's Chromium, reduced to medians: category scores, the
 * metrics, and every scored audit that isn't a perfect pass (from the median-performance run).
 */
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { chromium } from "playwright";

const CATS = ["performance", "accessibility", "best-practices", "seo"];
const METRICS = {
  FCP: "first-contentful-paint",
  LCP: "largest-contentful-paint",
  TBT: "total-blocking-time",
  CLS: "cumulative-layout-shift",
  SI: "speed-index",
};
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

export async function runLighthouse(
  url,
  { runs = 5, forms = ["mobile", "desktop"] } = {}
) {
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    // CI runners (Ubuntu 24.04) block Chrome's sandbox for unprivileged users; Playwright adds this flag itself,
    // chrome-launcher does not
    chromeFlags: [
      "--headless=new",
      ...(process.env.CI ? ["--no-sandbox"] : []),
    ],
  });
  const out = {};
  try {
    for (const form of forms) {
      const reports = [];
      for (let i = 0; i < runs; i++) {
        const r = await lighthouse(
          url,
          {
            port: chrome.port,
            output: "json",
            logLevel: "error",
            onlyCategories: CATS,
          },
          form === "desktop" ? desktopConfig : undefined
        );
        reports.push(r.lhr);
      }
      const scores = Object.fromEntries(
        CATS.map((c) => [
          c,
          reports.map((r) => Math.round(r.categories[c].score * 100)),
        ])
      );
      const metrics = Object.fromEntries(
        Object.entries(METRICS).map(([k, id]) => [
          k,
          reports.map((r) => r.audits[id].numericValue),
        ])
      );
      const perf = reports.map((r) => r.categories.performance.score);
      const mid = reports[perf.indexOf(median(perf))];
      const failing = Object.entries(mid.audits)
        .filter(
          ([, a]) =>
            a.score !== null &&
            a.score < 1 &&
            !["notApplicable", "manual", "informative"].includes(
              a.scoreDisplayMode
            ) &&
            !a.id.endsWith("-insight")
        )
        .map(
          ([id, a]) =>
            `${id} (${a.score}${a.displayValue ? `, ${a.displayValue}` : ""})`
        );
      out[form] = {
        median: Object.fromEntries(CATS.map((c) => [c, median(scores[c])])),
        scores,
        metrics: Object.fromEntries(
          Object.entries(metrics).map(([k, v]) => [k, median(v)])
        ),
        runs: metrics,
        failing,
        lcpElement:
          mid.audits["lcp-breakdown-insight"]?.details?.items?.find(
            (x) => x.type === "node"
          )?.selector ?? null,
      };
    }
  } finally {
    chrome.kill();
  }
  return out;
}
