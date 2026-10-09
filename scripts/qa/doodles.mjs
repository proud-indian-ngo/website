/**
 * Margin doodle overlap check (src/components/margins/, src/styles/sections/margins.css). At every width, no visible
 * margin doodle's box may touch:
 *   - text, images, buttons, links, stickers, polaroids, posters, cards or any other SVG in the page (the existing
 *     doodles and the volunteer plane's flight path included), in every section, the closing section and the footer;
 *   - the programme rail's column (the rail forced visible, plus its widest label) in the sections it shows over;
 *   - the fixed header's pills over the hero;
 *   - the viewport edge (8px).
 * It also counts doodles and "aligned" pairs (two on the same side of a section within 30px of the same x).
 *
 *   bun run build && bun run qa:doodles               # serves dist/ itself on a free port
 *   SITE=http://127.0.0.1:4321/ bun run qa:doodles   # or check a running server
 *   WIDTHS=1440,2560 bun run qa:doodles
 *   PAGES=volunteer/ bun run qa:doodles               # pages, relative to SITE (default: the home page and the volunteer guide)
 *
 * Exits non-zero on any overlap.
 */
import { existsSync } from "node:fs";

import { chromium } from "playwright";

import { serve } from "./perf/serve.mjs";

const WIDTHS = (
  process.env.WIDTHS ??
  "390,768,1100,1280,1440,1600,1800,1920,2048,2124,2304,2560"
)
  .split(",")
  .map(Number);
let server = null;
let SITE = process.env.SITE;
if (!SITE) {
  if (!existsSync("dist/index.html")) {
    console.error(
      "qa:doodles: no dist/ (run `bun run build` first) and no SITE"
    );
    process.exit(1);
  }
  server = await serve("dist", 0);
  SITE = `http://127.0.0.1:${server.address().port}/`;
}

const PAGES = (process.env.PAGES ?? ",volunteer/").split(",");

const browser = await chromium.launch();
let total = 0;
for (const path of PAGES) {
  console.log(`/${path}`);
  for (const w of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width: w, height: 1000 },
      reducedMotion: "reduce",
    });
    await page.goto(new URL(path, SITE).href, { waitUntil: "networkidle" });
    // walk the page so every lazy image has its size
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 20));
      }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
    if (process.env.SABOTAGE)
      await page.addStyleTag({
        content: ".mg.vol .mg-d.mg-l{left:calc(50% - 300px)!important}",
      });
    const r = await page.evaluate(() => {
      const sy = scrollY;
      const sx = scrollX;
      const box = (q) => ({
        x: q.left + sx,
        y: q.top + sy,
        w: q.width,
        h: q.height,
      });
      const vis = (el) => {
        const cs = getComputedStyle(el);
        return (
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          +cs.opacity !== 0
        );
      };
      const doodles = [...document.querySelectorAll(".mg-d")]
        .filter(
          (e) =>
            e.getClientRects().length && e.getBoundingClientRect().width > 0
        )
        .map((e) => ({
          id: `${e.closest(".mg").classList[1]}:${e.querySelector("use").getAttribute("href")}`,
          ...box(e.getBoundingClientRect()),
        }));
      const obs = [];
      const skip = (el) =>
        el.closest(
          ".mg, .site-hd, .pidx, script, style, .mg-sprite, [data-sbar], #menu, dialog, .cDrawer, .cScrim, .skip"
        );
      // text, line by line
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (
          !n.textContent.trim() ||
          skip(n.parentElement) ||
          !vis(n.parentElement)
        )
          continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const q of rg.getClientRects())
          if (q.width)
            obs.push({
              k: `text:${n.textContent.trim().slice(0, 20)}`,
              ...box(q),
            });
      }
      const parts = [
        "img",
        "picture",
        "video",
        "button",
        "a",
        "input",
        ".sticker",
        ".pi-sticker",
        ".polaroid",
        ".pi-polaroid",
        ".pi-doodle",
        ".fly path",
        ".fly g",
        ".poster",
        ".bcard",
        ".gl-card",
        "[class*='ph p']",
        "svg:not(.mg-d):not(.fly):not(.mg-sprite)",
        ".ft-margin.dk .ft-dd",
      ];
      const sel = parts
        .flatMap((x) => [`main ${x}`, `footer.ft-foot ${x}`])
        .join(", ");
      for (const el of document.querySelectorAll(sel)) {
        if (skip(el) || !vis(el)) continue;
        const q = el.getBoundingClientRect();
        if (!q.width || !q.height) continue;
        obs.push({
          k: `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`,
          ...box(q),
        });
      }
      // the programme rail column: the rail (forced visible) plus the widest label it can show beside it
      // (pages without the rail, like the volunteer guide, have no such column)
      const rail = document.querySelector(".pidx");
      let railLeft = innerWidth;
      if (rail) {
        const wasShown = rail.classList.contains("show");
        rail.classList.add("show");
        railLeft = rail.getBoundingClientRect().left;
        for (const lb of rail.querySelectorAll(".lb")) {
          const o = lb.style.display;
          lb.style.display = "block";
          railLeft = Math.min(railLeft, lb.getBoundingClientRect().left);
          lb.style.display = o;
        }
        if (!wasShown) rail.classList.remove("show");
      }
      const rq = { left: railLeft - 8, right: innerWidth };
      // the fixed header's pills over the hero (page top)
      const hdr = [
        ...document.querySelectorAll(
          ".site-hd a, .site-hd button, .site-hd nav, .site-hd > *, .site-hd > * > *"
        ),
      ]
        .map((e) => e.getBoundingClientRect())
        .filter((q) => q.width && q.height && q.width < innerWidth * 0.8)
        .map((q) => ({
          k: "header",
          x: q.left,
          y: q.top,
          w: q.width,
          h: q.height,
        }));
      const hit = (a, c) =>
        a.x < c.x + c.w &&
        c.x < a.x + a.w &&
        a.y < c.y + c.h &&
        c.y < a.y + a.h;
      const out = [];
      for (const dd of doodles) {
        for (const o of obs) if (hit(dd, o)) out.push(`${dd.id} x ${o.k}`);
        // the rail is fixed: any vertical position, so test the column against doodles where the rail can show
        if (
          /^(prog|teach|feed|gather|kala):/.test(dd.id) &&
          dd.x < rq.right + sx &&
          rq.left + sx < dd.x + dd.w
        )
          out.push(`${dd.id} x rail(column)`);
        if (dd.id.startsWith("hero:"))
          for (const o of hdr)
            if (hit(dd, o)) out.push(`${dd.id} x header pills`);
        if (dd.x < 8 || dd.x + dd.w > document.documentElement.clientWidth - 8)
          out.push(`${dd.id} x viewport-edge`);
      }
      // straight-line stat: pairs on the same side of a section within 30px of the same x
      let aligned = 0;
      const bySide = {};
      for (const e of document.querySelectorAll(".mg-d")) {
        if (!e.getClientRects().length) continue;
        const q = e.getBoundingClientRect();
        const k =
          e.closest(".mg").classList[1] +
          (e.classList.contains("mg-l") ? "l" : "r");
        (bySide[k] ||= []).push(q.left + q.width / 2);
      }
      for (const xs of Object.values(bySide))
        for (let i = 0; i < xs.length; i++)
          for (let j = i + 1; j < xs.length; j++)
            if (Math.abs(xs[i] - xs[j]) < 30) aligned++;
      return { n: doodles.length, obs: obs.length, out, aligned };
    });
    total += r.out.length;
    console.log(
      `${String(w).padStart(4)}  doodles=${String(r.n).padStart(2)}  obstacles=${r.obs}  aligned<30px=${r.aligned}  overlaps=${r.out.length}${r.out.length ? `  ${[...new Set(r.out)].join("; ")}` : ""}`
    );
    await page.close();
  }
}
await browser.close();
server?.close();
console.log(
  total ? `qa:doodles FAIL: ${total} overlaps` : "qa:doodles PASS: no overlaps"
);
if (total) process.exitCode = 1;
