/**
 * Visual parity: screenshots the approved prototype and the built site with reduced motion at 1440, 2048 and 390,
 * full page and per section, then diffs each pair in a browser canvas.
 *
 *   PROTO=http://127.0.0.1:63782/prototypes/final/index.html SITE=http://127.0.0.1:4321/ node scripts/qa/parity.mjs
 *
 * Output: /tmp/pi-astro/{proto,site,diff}-<section>-<width>.png and report.json; a table is printed.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { chromium } from "playwright";

const PROTO =
  process.env.PROTO ?? "http://127.0.0.1:63782/prototypes/final/index.html";
const SITE = process.env.SITE ?? "http://127.0.0.1:4321/";
const OUT = process.env.OUT ?? "/tmp/pi-astro";
const WIDTHS = (process.env.WIDTHS ?? "1440,2048,390").split(",").map(Number);
const SECTIONS = [
  ["header", ".site-hd"],
  ["hero", ".s-hero"],
  ["programmes", "#programmes"],
  ["teach", "#b0"],
  ["feed", "#b1"],
  ["kalakriti", "#kalakriti"],
  ["gather", "#b3"],
  ["volunteer", "#volunteer"],
  ["donate", "#donate"],
  ["reports", "#reports"],
  ["closing", "#closing"],
  ["footer", "footer"],
];
mkdirSync(OUT, { recursive: true });

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  // walk the page so every lazy image loads, then wait for them
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (let y = 0; y < h; y += vh * 0.8) {
    await page.evaluate((yy) => scrollTo(0, yy), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        [...document.images]
          .filter((i) => i.getClientRects().length)
          .map((i) =>
            i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))
          )
      ),
      new Promise((r) => setTimeout(r, 10000)),
    ])
  );
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
}

async function shoot(browser, url, tag, w) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w <= 700 ? 844 : 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await settle(page);
  await page.screenshot({
    path: `${OUT}/${tag}-full-${w}.png`,
    fullPage: true,
  });
  const fullHeight = await page.evaluate(
    () => document.documentElement.scrollHeight
  );
  // fixed chrome off for the section shots (it overlays whatever is scrolled under it)
  await page.addStyleTag({
    content: ".site-hd,.pidx,.sbar,.skip{visibility:hidden!important}",
  });
  const sections = {};
  for (const [name, sel] of SECTIONS) {
    const el = page.locator(sel).first();
    if (name === "header") {
      await page.addStyleTag({
        content: ".site-hd{visibility:visible!important}",
      });
      await page.evaluate(() => scrollTo(0, 0));
    }
    const box = await el.boundingBox();
    const text = await el.evaluate((n) =>
      n.innerText.replace(/\s+/g, " ").trim()
    );
    await el.screenshot({ path: `${OUT}/${tag}-${name}-${w}.png` });
    if (name === "header")
      await page.addStyleTag({
        content: ".site-hd{visibility:hidden!important}",
      });
    sections[name] = { height: Math.round(box.height), text };
  }
  await ctx.close();
  return { fullHeight, sections, errors };
}

async function diff(browser, a, b, out) {
  const page = await browser.newPage();
  const res = await page.evaluate(
    async ([da, db]) => {
      const load = (src) =>
        new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = src;
        });
      const [A, B] = await Promise.all([load(da), load(db)]);
      const w = Math.max(A.width, B.width);
      const h = Math.max(A.height, B.height);
      const c = (img) => {
        const cv = new OffscreenCanvas(w, h);
        const x = cv.getContext("2d");
        x.fillStyle = "#ff00ff";
        x.fillRect(0, 0, w, h);
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, w, h).data;
      };
      const pa = c(A);
      const pb = c(B);
      const out = new OffscreenCanvas(w, h);
      const ox = out.getContext("2d");
      const od = ox.createImageData(w, h);
      let bad = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d =
          Math.abs(pa[i] - pb[i]) +
          Math.abs(pa[i + 1] - pb[i + 1]) +
          Math.abs(pa[i + 2] - pb[i + 2]);
        const g = (pa[i] + pa[i + 1] + pa[i + 2]) / 3;
        if (d > 48) {
          bad++;
          od.data.set([255, 0, 80, 255], i);
        } else od.data.set([g, g, g, 70], i);
      }
      ox.putImageData(od, 0, 0);
      const blob = await out.convertToBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192)
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      return {
        pct: (100 * bad) / (w * h),
        sizeA: [A.width, A.height],
        sizeB: [B.width, B.height],
        png: btoa(bin),
      };
    },
    [a, b].map(
      (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`
    )
  );
  writeFileSync(out, Buffer.from(res.png, "base64"));
  await page.close();
  return { pct: +res.pct.toFixed(3), sizeA: res.sizeA, sizeB: res.sizeB };
}

const browser = await chromium.launch();
const report = {};
for (const w of WIDTHS) {
  const p = await shoot(browser, PROTO, "proto", w);
  const s = await shoot(browser, SITE, "site", w);
  const rows = [];
  for (const [name] of [["full"], ...SECTIONS]) {
    const d = await diff(
      browser,
      `${OUT}/proto-${name}-${w}.png`,
      `${OUT}/site-${name}-${w}.png`,
      `${OUT}/diff-${name}-${w}.png`
    );
    const ps = p.sections[name];
    const ss = s.sections[name];
    rows.push({
      section: name,
      diffPct: d.pct,
      proto: d.sizeA.join("x"),
      site: d.sizeB.join("x"),
      textSame: ps ? ps.text === ss.text : undefined,
    });
  }
  report[w] = {
    rows,
    protoErrors: p.errors,
    siteErrors: s.errors,
    proto: p.sections,
    site: s.sections,
  };
  console.log(
    `\n== ${w}px  (console errors: proto ${p.errors.length}, site ${s.errors.length})`
  );
  console.table(rows);
  for (const [name] of SECTIONS)
    if (p.sections[name].text !== s.sections[name].text)
      console.log(
        `text differs in ${name}:\n  proto: ${p.sections[name].text.slice(0, 600)}\n  site:  ${s.sections[name].text.slice(0, 600)}`
      );
  if (s.errors.length) console.log("site errors:", s.errors);
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
