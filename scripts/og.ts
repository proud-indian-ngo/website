/**
 * Renders the per-page share images (Open Graph cards) in src/content/og.yaml to public/og/<page>.png, in the style
 * of the brand's default card (@proudindian/design logo-tools/og/render-og.mjs, which made public/og.png): the mono
 * ink lockup, a small line, a big white outlined word, chips and cut-out stickers on cyan. Colours and fonts come
 * from the design package.
 *   bun run og                 every page
 *   bun run og volunteer       one page
 * The PNGs are committed (rendering needs a browser, so the build doesn't do it). Re-run after changing og.yaml.
 */
import { mkdirSync, readFileSync } from "node:fs";

import { color } from "@proudindian/design/tokens";
import { chromium } from "playwright";

import cards from "../src/content/og.yaml";

interface Card {
  pre: string;
  word: string;
  pills: string[];
  kids: string[];
  alt: string;
}

const pkg = (p: string) =>
  Bun.resolveSync(`@proudindian/design/${p}`, import.meta.dir);
const b64 = (path: string) => readFileSync(path).toString("base64");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const lockup = readFileSync(pkg("logo/svg/pi-lockup-mono.svg"), "utf8");
const brico = b64(pkg("fonts/bricolage-grotesque-latin-wdth-normal.woff2"));
const geist = b64(pkg("fonts/geist-latin-wght-normal.woff2"));

function html(c: Card) {
  const kids = c.kids.map(
    (k, i) =>
      `<img class="kid k${i + 1} n${c.kids.length}" src="data:image/png;base64,${b64(`src/assets/${k}`)}">`
  );
  return `<!doctype html><html><head><style>
@font-face{font-family:Brico;font-weight:200 800;font-stretch:75% 100%;src:url(data:font/woff2;base64,${brico}) format("woff2")}
@font-face{font-family:Geist;font-weight:100 900;src:url(data:font/woff2;base64,${geist}) format("woff2")}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:${color.sky};color:${color.ink};font-family:Geist;position:relative;overflow:hidden}
.logo{position:absolute;left:72px;top:64px;width:330px}
.logo svg{display:block;width:100%;height:auto}
.pre{position:absolute;left:78px;top:196px;font:800 64px/1 Brico;letter-spacing:-.03em;white-space:nowrap}
.giant{position:absolute;left:66px;top:262px;font:800 196px/.82 Brico;letter-spacing:-.05em;color:${color.white};-webkit-text-stroke:3px ${color.ink};text-shadow:8px 8px 0 ${color.ink};paint-order:stroke fill;white-space:nowrap}
.line{position:absolute;left:78px;bottom:58px;font:600 26px Geist;display:flex;gap:14px;align-items:center}
.line span{background:${color.paper};border:1.5px solid ${color.ink};border-radius:99px;padding:8px 18px;box-shadow:3px 3px 0 ${color.ink}}
.kid{position:absolute;bottom:-40px;filter:drop-shadow(5px 0 0 ${color.paper}) drop-shadow(-5px 0 0 ${color.paper}) drop-shadow(0 -5px 0 ${color.paper}) drop-shadow(0 5px 0 ${color.paper}) drop-shadow(0 16px 22px rgb(15 27 36 / .28))}
.kid.n1{right:28px;height:440px;transform:rotate(5deg)}
.kid.n2.k1{right:200px;height:420px;transform:rotate(-4deg)}
.kid.n2.k2{right:16px;height:360px;bottom:-30px;transform:rotate(6deg)}
</style></head><body>
<div class="logo">${lockup}</div>
<p class="pre">${esc(c.pre)}</p><p class="giant">${esc(c.word)}</p>
<p class="line">${c.pills.map((p) => `<span>${esc(p)}</span>`).join("")}</p>
${kids.join("\n")}
</body></html>`;
}

const only = process.argv[2];
const entries = Object.entries(cards as Record<string, Card>).filter(
  ([k]) => !only || k === only
);
if (!entries.length)
  throw new Error(`og: no page "${only}" in src/content/og.yaml`);
mkdirSync("public/og", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
for (const [name, card] of entries) {
  await page.setContent(html(card), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // the big word shrinks until it clears the cut-outs (or the right edge when there are none)
  await page.evaluate(() => {
    const giant = document.querySelector<HTMLElement>(".giant")!;
    const kids = [...document.querySelectorAll<HTMLElement>(".kid")];
    const limit = kids.length
      ? Math.min(...kids.map((k) => k.getBoundingClientRect().left)) - 24
      : 1200 - 72;
    let size = 196;
    while (giant.getBoundingClientRect().right + 8 > limit && size > 60) {
      size -= 2;
      giant.style.fontSize = `${size}px`;
    }
    // keep the word sitting on the same baseline area as the default card
    giant.style.top = `${262 + (196 - size) * 0.5}px`;
  });
  const out = `public/og/${name}.png`;
  await page.screenshot({ path: out, type: "png" });
  console.log(`og: wrote ${out}`);
}
await browser.close();
