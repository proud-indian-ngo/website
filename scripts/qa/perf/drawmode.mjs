/**
 * Adaptive draw-ons (src/scripts/lite.ts): the detection and the lite path.
 *   - At 1x, 2x and 3x CPU the page keeps the hand-drawn stroke-dashoffset reveals; at 4x and 6x it switches to the
 *     compositor wipe (html.lite-draw), and reports how soon after navigation it decided.
 *   - Forced lite (?draw=lite): a draw-on plays as a clip-path wipe and no stroke-dashoffset animation runs.
 * Returns { rows, failures }.
 */
import { chromium } from "playwright";

export async function checkDrawMode(
  url,
  { rates = [1, 2, 3, 4, 6], widths = [390, 1440] } = {}
) {
  const browser = await chromium.launch({ channel: "chromium" });
  const rows = [];
  const failures = [];
  try {
    for (const w of widths)
      for (const rate of rates) {
        const ctx = await browser.newContext({
          viewport: { width: w, height: w < 700 ? 844 : 900 },
          deviceScaleFactor: w < 700 ? 3 : 1,
          isMobile: w < 700,
          hasTouch: w < 700,
        });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        if (rate > 1)
          await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        await page.goto(url);
        await page.waitForTimeout(3000);
        const d = await page.evaluate(() => window.__piDraw);
        const want = rate >= 4;
        rows.push(
          `w${w} x${rate}: ${d.lite ? "lite" : "drawn"} (${d.source}, at ${d.at}ms, loop ${d.bench}ms, long frames ${d.loaf ?? "-"}ms)`
        );
        if (d.lite !== want)
          failures.push(
            `draw mode w${w} x${rate}: expected ${want ? "lite" : "drawn"}`
          );
        await ctx.close();
      }
    // the lite path: a draw-on in view plays as a wipe
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(`${url}${url.includes("?") ? "&" : "?"}draw=lite`);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const el = document.querySelector("#closing");
      scrollTo({
        top: scrollY + el.getBoundingClientRect().top - 100,
        behavior: "instant",
      });
    });
    await page.waitForTimeout(400);
    const props = await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (a) => a.playState === "running" && !(a instanceof CSSAnimation)
        )
        .flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k)))
    );
    const wipe = props.includes("clipPath");
    const stroke = props.includes("strokeDashoffset");
    rows.push(
      `forced lite at the closing section: clip-path wipe ${wipe ? "yes" : "NO"}, stroke draw ${stroke ? "YES" : "no"}`
    );
    if (!wipe || stroke)
      failures.push("lite path: draw-ons did not play as a wipe");
    await page.close();
  } finally {
    await browser.close();
  }
  return { rows, failures };
}
