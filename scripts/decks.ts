/**
 * Renders the two pitch decks to PDF for the brand kit on /brand/ (src/lib/brand-kit.ts lists them under Pitch decks):
 *   bun run decks              both
 *   bun run decks kalakriti    one (csr | kalakriti)
 * Each deck is 16:9 slides at 1280 × 720 px (13.33 × 7.5 in), written to be sent ahead and read without a presenter.
 * The CSR deck takes /csr/'s look (paper, sky-ink stamps, a report page); the Kalakriti deck takes /kalakriti/'s (ink,
 * marigold, bunting, cut-outs). The decks' own copy is src/content/decks.yaml; prices, formats, costs, editions,
 * registrations, partners and the safeguarding rules come from the site's content files, so a deck can't disagree
 * with the site. Writes src/assets/decks/<deck>.pdf and a cover preview, <deck>.jpg. Both are committed (rendering
 * needs a browser, so the build doesn't do it): re-run after changing any of those files.
 */
import { mkdirSync, readFileSync } from "node:fs";

import { color } from "@proudindian/design/tokens";
import { chromium } from "playwright";
import sharp from "sharp";

import csr from "../src/content/csr.yaml";
import decks from "../src/content/decks.yaml";
import kalaPage from "../src/content/kalakriti-page.yaml";
import kala from "../src/content/kalakriti.yaml";
import partners from "../src/content/partners.yaml";
import reports from "../src/content/reports.yaml";
import safeguarding from "../src/content/safeguarding.yaml";
import site from "../src/content/site.yaml";
import { esc } from "../src/lib/escape";

const OUT = "src/assets/decks";
const W = 1280;
const H = 720;

// ---- facts and text

const email = (re: RegExp) =>
  site.contacts.emails.find((e: { label: string }) => re.test(e.label))
    ?.address ?? site.contacts.emails[0].address;
/** the {placeholders} the copy can use, as on the pages (src/lib/content.ts facts() and src/lib/inline.ts) */
const values: Record<string, string> = {
  ...site.registrations,
  ...Object.fromEntries(
    Object.entries(site.stats).map(([k, v]) => [k, String(v)])
  ),
  city: site.city,
  foundedLong: site.founded.long,
  foundedShort: site.founded.short,
  register: site.links.register,
  connect: email(/general/i),
  finance: email(/donation/i),
  phone: site.contacts.phone.display,
};
const fill = (text: string) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k];
    if (v === undefined)
      throw new Error(`decks: unknown placeholder {${k}} in "${text}"`);
    return v;
  });
const abs = (href: string) =>
  href.startsWith("/") ? `${site.url}${href}` : href;
/** copy as HTML: placeholders filled, escaped, [text](url) as links, *word* as the accent */
const t = (text: string) =>
  esc(fill(text))
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, label: string, href: string) => `<a href="${abs(href)}">${label}</a>`
    )
    .replace(/\*([^*]+)\*/g, '<span class="acc">$1</span>');
/** the site's two-part headings ({ before, accent }) */
const h = (x: { before: string; accent: string }) =>
  `${t(x.before)} <span class="acc">${t(x.accent)}</span>`;
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const connect = values.connect!;
const whatsapp = `https://wa.me/${site.contacts.phone.tel.replace(/\D/g, "")}`;

// ---- files: fonts, logos, doodles and photos, inlined so the page needs no server

const pkg = (p: string) =>
  Bun.resolveSync(`@proudindian/design/${p}`, import.meta.dir);
const b64 = (path: string) => readFileSync(path).toString("base64");
const brico = b64(pkg("fonts/bricolage-grotesque-latin-wdth-normal.woff2"));
const geist = b64(pkg("fonts/geist-latin-wght-normal.woff2"));
const svg = (path: string, style = "") =>
  readFileSync(pkg(path), "utf8")
    .replace(/<title>.*?<\/title>/s, "")
    .replace(/^<svg /, `<svg style="${style}" `)
    .replace(/\n/g, "");
const logo = (name: string, height: number, style = "") =>
  svg(
    `logo/svg/${name}.svg`,
    `height:${height}px;width:auto;display:block;flex:none;align-self:flex-start;${style}`
  );
const doodle = (name: string, style: string, ink: string) =>
  svg(`illustrations/${name}.svg`, `position:absolute;color:${ink};${style}`);

const images = new Map<string, string>();
/** a photo or cut-out under src/assets/, scaled down for the PDF */
async function img(path: string): Promise<string> {
  const cached = images.get(path);
  if (cached) return cached;
  const png = path.endsWith(".png");
  const pipeline = sharp(`src/assets/${path}`).resize({
    width: png ? 640 : 1400,
    height: png ? 960 : 1050,
    fit: "inside",
    withoutEnlargement: true,
  });
  const out = png
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
    : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  const url = `data:image/${png ? "png" : "jpeg"};base64,${out.toString("base64")}`;
  images.set(path, url);
  return url;
}
/** a cut-out child with its paper outline baked in (a CSS drop-shadow outline makes Chrome rasterise it at 300 ppi) */
async function cutout(path: string): Promise<string> {
  const key = `cut:${path}`;
  const cached = images.get(key);
  if (cached) return cached;
  const pad = 8;
  const kid = await sharp(`src/assets/${path}`)
    .resize({ width: 600, height: 900, fit: "inside" })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: "#0000",
    })
    .png()
    .toBuffer();
  const { width = 0, height = 0 } = await sharp(kid).metadata();
  const mask = await sharp(kid)
    .extractChannel("alpha")
    .blur(3)
    .threshold(8)
    .toBuffer();
  const outline = await sharp({
    create: { width, height, channels: 3, background: color.paper },
  })
    .joinChannel(mask)
    .png()
    .toBuffer();
  const out = await sharp(outline)
    .composite([{ input: kid }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  const url = `data:image/png;base64,${out.toString("base64")}`;
  images.set(key, url);
  return url;
}
const photo = async (path: string, style = "", position = "50% 50%") =>
  `<img class="ph" src="${await img(path)}" alt="" style="object-position:${position};${style}">`;
/** a taped polaroid */
const pol = async (path: string, caption: string, style: string) =>
  `<figure class="pol" style="${style}"><i class="tape"></i>${await photo(path)}<figcaption>${t(caption)}</figcaption></figure>`;

// ---- the slide frame

interface Deck {
  name: "csr" | "kalakriti";
  title: string;
  slides: string[];
}

const eyebrow = (text: string) => `<p class="eb">${t(text)}</p>`;
const footer = (deck: Deck, n: number) =>
  `<footer>${logo(deck.name === "csr" ? "pi-lockup-compact" : "pi-lockup-compact-reversed", 20)}<span>${esc(deck.title.replace(/^Proud Indian · /, ""))}</span><span class="pg">${n} / ${deck.slides.length}</span></footer>`;

const css = `
@font-face{font-family:Brico;font-weight:200 800;font-stretch:75% 100%;src:url(data:font/woff2;base64,${brico}) format("woff2")}
@font-face{font-family:Geist;font-weight:100 900;src:url(data:font/woff2;base64,${geist}) format("woff2")}
@page{size:${W}px ${H}px;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Geist,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}
ul{list-style:none}
.slide{width:${W}px;height:${H}px;position:relative;overflow:hidden;padding:60px 80px 100px;display:flex;flex-direction:column;break-after:page}
.csr .slide{background:${color.paper};color:${color.ink}}
.kala .slide{background:${color.ink};color:${color.paper}}
.slide.sky{background:${color.sky};color:${color.ink}}
footer{position:absolute;left:80px;right:80px;bottom:34px;display:flex;align-items:center;gap:16px;font-size:12.5px;padding-top:14px;border-top:1.5px solid currentColor}
footer span{opacity:.75}
footer .pg{margin-left:auto;font-variant-numeric:tabular-nums}
.eb{align-self:flex-start;display:inline-flex;align-items:center;font:600 14px/1 Geist;padding:8px 14px;border:1.5px solid currentColor;border-radius:99px;margin-bottom:22px}
.kala .eb{color:${color.marigold}}
h1,h2,.d{font-family:Brico;font-weight:800;letter-spacing:-.035em;line-height:.95}
h1{font-size:80px}
h2{font-size:54px;margin-bottom:18px;max-width:19ch}
.csr .acc{color:${color.skyInk}}
.kala .acc{color:${color.marigold}}
.sky .acc{color:${color.white};-webkit-text-stroke:1.5px ${color.ink};paint-order:stroke fill;text-shadow:3px 3px 0 ${color.ink}}
.lede{font-size:19px;line-height:1.45;max-width:62ch}
.small{font-size:13.5px;line-height:1.45}
.mute{opacity:.75}
.row{display:flex;gap:24px}
.grow{flex:1;min-width:0}
.card{border:1.5px solid ${color.ink};border-radius:18px;background:${color.white};color:${color.ink};padding:20px 22px;box-shadow:4px 4px 0 ${color.ink}}
.kala .card{border-color:${color.paper};background:${color.paper};box-shadow:4px 4px 0 ${color.marigold}}
.card h3{font:800 24px/1 Brico;letter-spacing:-.025em;margin-bottom:10px}
.card p{font-size:14.5px;line-height:1.45}
.num{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:${color.ink};color:${color.white};font:800 15px/1 Brico;margin-bottom:14px}
.kala .num{background:${color.marigold};color:${color.ink}}
.ph{display:block;width:100%;height:100%;object-fit:cover}
.pol{position:absolute;background:${color.white};padding:9px 9px 0;border:1.5px solid ${color.ink};box-shadow:5px 6px 0 ${color.ink}}
.kala .pol{box-shadow:5px 6px 0 ${color.marigold}}
.pol .ph{height:auto;aspect-ratio:4/3}
.pol figcaption{font:800 15px/1.1 Brico;letter-spacing:-.02em;color:${color.ink};padding:10px 2px 12px}
.tape{position:absolute;top:-12px;left:50%;width:84px;height:24px;margin-left:-42px;background:rgb(76 192 236 / .6);border:1px solid rgb(15 27 36 / .25);transform:rotate(-4deg);z-index:1}
.dots li{position:relative;padding-left:22px;font-size:16px;line-height:1.45;margin-top:10px}
.dots li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:50%;background:currentColor}
.csr .dots li::before{background:${color.skyInk}}
.kala .dots li::before{background:${color.marigold}}
.stat{border:1.5px solid ${color.ink};border-radius:16px;background:${color.white};color:${color.ink};padding:16px 18px;box-shadow:4px 4px 0 ${color.ink}}
.stat b{display:block;font:800 44px/1 Brico;letter-spacing:-.03em}
.stat span{display:block;font-size:14px;line-height:1.3;margin-top:6px}
.kala .stat{border-color:${color.paper};box-shadow:4px 4px 0 ${color.marigold};background:${color.paper}}
.stamp{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;color:${color.skyInk};border:2.5px solid ${color.skyInk};font:700 12.5px/1 Geist;letter-spacing:.14em;text-transform:uppercase;text-align:center}
.stamp b{font:800 20px/1 Brico;letter-spacing:.02em;text-transform:none;margin-top:5px}
.stamp.rect{padding:9px 16px;border-radius:6px;transform:rotate(-1.5deg)}
.stamp.rect + .stamp.rect{transform:rotate(1.2deg)}
.stamp.round{width:112px;height:112px;border-radius:50%;background:rgb(246 242 234 / .92);transform:rotate(-10deg)}
.stamp.round b{font-size:28px;margin:0 0 3px}
table{border-collapse:collapse;width:100%}
th{font:700 12px/1.2 Geist;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:0 14px 10px 0;opacity:.75}
td{font-size:14px;line-height:1.4;padding:11px 14px 11px 0;border-top:1.5px solid currentColor;vertical-align:top}
td b{font:800 19px/1.1 Brico;letter-spacing:-.02em}
.tight td{font-size:13px;padding:8px 14px 8px 0}
.bunting{position:absolute;left:0;top:0;width:100%;height:84px}
.spot{position:absolute;top:0;width:620px;height:720px;background:linear-gradient(180deg,rgb(246 242 234 / .09),rgb(246 242 234 / 0));clip-path:polygon(42% 0,58% 0,100% 100%,0 100%)}
.cut{position:absolute}
.ticket{position:relative;display:flex;flex-direction:column;border-radius:16px;padding:22px 24px;background:${color.paper};color:${color.ink};border:1.5px solid ${color.paper}}
.ticket.sun{background:${color.marigold};border-color:${color.marigold}}
.ticket .amt{font:800 46px/1 Brico;letter-spacing:-.035em}
.ticket .name{font:700 13px/1 Geist;letter-spacing:.12em;text-transform:uppercase;margin:8px 0 12px}
.ticket::before,.ticket::after{content:"";position:absolute;left:-12px;top:96px;width:24px;height:24px;border-radius:50%;background:${color.ink}}
.ticket::after{left:auto;right:-12px}
.ticket .rule{border-top:2px dashed rgb(15 27 36 / .45);margin:4px -24px 14px}
.ticket li{font-size:13.5px;line-height:1.4;padding-left:18px;position:relative;margin-top:7px}
.ticket li::before{content:"✓";position:absolute;left:0;font-weight:700}
.bar{height:14px;border-radius:99px;background:${color.marigold};margin-top:6px}
.pill{display:inline-flex;align-items:center;gap:8px;font:600 17px/1 Geist;padding:14px 22px;border:1.5px solid ${color.ink};border-radius:99px;box-shadow:3px 3px 0 ${color.ink};text-decoration:none;white-space:nowrap}
.pill.ink{background:${color.ink};color:${color.white}}
.pill.paper{background:${color.paper};color:${color.ink}}
.pill.sun{background:${color.marigold};color:${color.ink};border-color:${color.ink}}
.kala .pill{box-shadow:3px 3px 0 ${color.paper};border-color:${color.paper}}
`;

const page = (deck: Deck) =>
  `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>${esc(deck.title)}</title><style>${css}</style></head><body class="${deck.name === "csr" ? "csr" : "kala"}">${deck.slides
    .map((s, i) => s.replace("</section>", `${footer(deck, i + 1)}</section>`))
    .join("")}</body></html>`;

// ---- shared blocks

const registrationLine = () =>
  `CSR-1 ${values.csr1} · ${values.taxExemption} and ${values.registered} · NGO Darpan ${values.darpan} · PAN ${values.pan}`;

// ---- the CSR deck

async function csrDeck(): Promise<Deck> {
  const d = decks.csr;
  const cover = `
  <section class="slide">
    ${logo("pi-lockup", 40)}
    <div class="row" style="margin-top:22px;align-items:center;gap:56px">
      <div class="grow">
        ${eyebrow(d.cover.eyebrow)}
        <h1 style="font-size:68px;max-width:12ch">${t(d.cover.heading)}</h1>
        <p class="lede" style="margin-top:18px;max-width:46ch">${t(d.cover.lede)}</p>
        <div class="row" style="margin-top:30px;gap:14px;align-items:center">
          ${csr.hero.stamps.rect.map((s: { label: string; value: string }) => `<span class="stamp rect">${t(s.label)}<b>${t(s.value)}</b></span>`).join("")}
          <span class="small" style="max-width:16ch">${t(csr.hero.stamps.audited)}</span>
        </div>
      </div>
      <div style="position:relative;width:470px;flex:none">
        <div class="card" style="padding:16px 16px 14px;transform:rotate(1.2deg);border-radius:4px">
          <p style="font:700 12px/1 Geist;letter-spacing:.14em;text-transform:uppercase;display:flex;justify-content:space-between;margin-bottom:12px"><span>${t(csr.hero.photo.kicker)}</span><span>01</span></p>
          <div style="height:300px">${await photo(csr.hero.photo.image)}</div>
          <p class="small" style="margin-top:10px">${t(csr.hero.photo.caption)}</p>
        </div>
        <div style="position:absolute;right:-30px;top:22px;display:flex;gap:6px">
          ${csr.hero.stamps.round.map((s: { label: string; value: string }, i: number) => `<span class="stamp round" style="${i ? "transform:rotate(7deg) translateY(14px)" : ""}"><b>${t(s.value)}</b>${t(s.label)}</span>`).join("")}
        </div>
      </div>
    </div>
    <p class="small mute" style="position:absolute;right:80px;top:68px">${t(d.cover.date)}</p>
  </section>`;

  const about = `
  <section class="slide">
    ${eyebrow(d.about.eyebrow)}
    <div class="row" style="gap:64px">
      <div class="grow">
        <h2>${t(d.about.heading)}</h2>
        <p class="lede">${t(d.about.lede)}</p>
        <ul class="dots" style="margin-top:14px;max-width:60ch">${d.about.points.map((p: string) => `<li>${t(p)}</li>`).join("")}</ul>
      </div>
      <div style="width:420px;flex:none;display:grid;grid-template-columns:1fr 1fr;gap:16px;align-content:start;margin-top:8px">
        <div class="stat"><b>${esc(site.stats.optimists)}</b><span>Optimists have volunteered with us</span></div>
        <div class="stat"><b>${esc(site.stats.hours)}</b><span>volunteer hours</span></div>
        <div class="stat"><b>${esc(site.stats.reached)}</b><span>people reached</span></div>
        <div class="stat"><b>${site.stats.programmesPercent}%</b><span>of funds go to programmes</span></div>
        <div class="stat" style="grid-column:span 2;background:${color.skyWash}"><b style="font-size:30px">${esc(site.founded.long)}</b><span>Founded in ${esc(site.city)}, on Republic Day</span></div>
      </div>
    </div>
  </section>`;

  const whatPhotos = [
    "photos/teach-maths-class.jpg",
    "photos/feed-lunch-kalakriti2.jpg",
    "photos/kala3-pot.jpg",
    "photos/connect-gift-a-smile.jpg",
  ];
  const what = `
  <section class="slide">
    ${eyebrow(d.what.eyebrow)}
    <h2>${t(d.what.heading)}</h2>
    <div class="row" style="gap:20px;margin-top:6px;flex:1">
      ${(
        await Promise.all(
          d.what.cards.map(
            async (
              c: { verb: string; line: string; fact: string },
              i: number
            ) => `
        <div class="card grow" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
          <div style="height:150px;border-bottom:1.5px solid ${color.ink}">${await photo(whatPhotos[i]!)}</div>
          <div style="padding:16px 18px 18px;display:flex;flex-direction:column;flex:1">
            <h3 style="font-size:34px">${t(c.verb)}</h3>
            <p>${t(c.line)}</p>
            <p style="margin-top:auto;padding-top:12px;font-weight:700;color:${color.skyInk}">${t(c.fact)}</p>
          </div>
        </div>`
          )
        )
      ).join("")}
    </div>
  </section>`;

  const ways = `
  <section class="slide">
    ${eyebrow(d.ways.eyebrow)}
    <h2>${h(csr.ways.heading)}</h2>
    <p class="lede">${t(csr.ways.lede)}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:26px">
      ${csr.ways.cards.map((c: { title: string; line: string }, i: number) => `<div class="card"><span class="num">${i + 1}</span><h3>${t(c.title)}</h3><p>${t(c.line)}</p></div>`).join("")}
    </div>
  </section>`;

  type Format = {
    name: string;
    size: string;
    length: string;
    where: string;
    what: string;
    provide: string;
  };
  const L = csr.days.labels;
  const days = `
  <section class="slide">
    ${eyebrow(d.days.eyebrow)}
    <h2>${h(csr.days.heading)}</h2>
    <p class="lede">${t(csr.days.lede)}</p>
    <div class="row" style="gap:16px;margin-top:16px">
      ${csr.days.formats
        .map(
          (f: Format, i: number) => `
        <div class="card grow" style="padding:16px 16px 14px;display:flex;flex-direction:column;gap:7px">
          <span class="num" style="margin:0;width:26px;height:26px;font-size:13px">${i + 1}</span>
          <h3 style="font-size:20px;margin:0">${t(f.name)}</h3>
          <p style="font-size:13px;line-height:1.4">${t(f.what)}</p>
          <div style="margin-top:auto;font-size:12.5px;line-height:1.3;display:grid;gap:5px">
            <p><b>${t(L.size)}:</b> ${t(f.size)}</p>
            <p><b>${t(L.length)}:</b> ${t(f.length)}</p>
            <p><b>${t(L.where)}:</b> ${t(f.where)}</p>
            <p><b>${t(L.provide)}:</b> ${t(f.provide)}</p>
          </div>
        </div>`
        )
        .join("")}
    </div>
  </section>`;

  const cost = `
  <section class="slide">
    ${eyebrow(d.cost.eyebrow)}
    <div class="row" style="gap:64px">
      <div class="grow">
        <h2>${t(d.cost.heading)}</h2>
        <p class="lede">${t(csr.days.cost.text)}</p>
        <h3 class="d" style="font-size:24px;margin-top:30px">${t(csr.days.done.heading)}</h3>
        <ul class="dots">${csr.days.done.items.map((c: { name: string; did: string }) => `<li><b>${t(c.name)}</b> ${t(c.did)}</li>`).join("")}</ul>
      </div>
      <div style="width:440px;flex:none;position:relative">
        ${await pol(d.cost.photo.image, d.cost.photo.caption, "left:10px;top:10px;width:420px;transform:rotate(2deg)")}
      </div>
    </div>
  </section>`;

  type Tier = { amount: string; name: string; line: string };
  const kalakriti = `
  <section class="slide">
    ${eyebrow(d.kalakriti.eyebrow)}
    <h2>${h(csr.kalakriti.heading)}</h2>
    <p class="lede" style="max-width:80ch">${t(csr.kalakriti.lede)}</p>
    <div class="row" style="gap:20px;margin-top:22px">
      ${csr.kalakriti.tiers.map((x: Tier, i: number) => `<div class="card grow" style="${i === 2 ? `background:${color.marigold}` : ""}"><p class="d" style="font-size:42px">${t(x.amount)}</p><p style="font:700 12.5px/1 Geist;letter-spacing:.12em;text-transform:uppercase;margin:8px 0 10px">${t(x.name)}</p><p>${t(x.line)}</p></div>`).join("")}
    </div>
    <p class="small" style="margin-top:22px;max-width:100ch">${t(csr.kalakriti.cost)} <a href="${abs(csr.kalakriti.disclosure)}">${t(csr.kalakriti.costLink)}</a>. ${t(d.kalakriti.backers)} <b>${t(d.kalakriti.more)}</b></p>
  </section>`;

  const programmeName: Record<string, string> = {
    b0: "Teach",
    b1: "Feed",
    kalakriti: "Kalakriti",
    b3: "Connect",
  };
  type FundRow = {
    programme: string;
    schedule: string;
    funds: string;
    cost: string;
  };
  const fund = `
  <section class="slide">
    ${eyebrow(d.fund.eyebrow)}
    <h2>${h(csr.fund.heading)}</h2>
    <p class="lede">${t(csr.fund.lede)}</p>
    <table class="tight" style="margin-top:12px">
      <thead><tr><th style="width:150px">Programme</th><th style="width:210px">${t(csr.fund.scheduleLabel)}</th><th>${t(csr.fund.fundsLabel)}</th><th style="width:330px">${t(csr.fund.costLabel)}</th></tr></thead>
      <tbody>${csr.fund.rows.map((r: FundRow) => `<tr><td><b>${esc(programmeName[r.programme] ?? r.programme)}</b></td><td>${t(r.schedule)}</td><td>${t(r.funds.replace(/ See the sponsorships above\.$/, ""))}</td><td>${t(r.cost)}</td></tr>`).join("")}</tbody>
    </table>
    <p class="small" style="margin-top:14px;max-width:110ch">${t(csr.fund.budget)}</p>
  </section>`;

  type Drive = { name: string; when: string; line: string };
  const drives = `
  <section class="slide">
    ${eyebrow(d.drives.eyebrow)}
    <div class="row" style="gap:56px">
      <div class="grow">
        <h2>${t(csr.drives.heading)}</h2>
        <p class="lede">${t(csr.drives.lede)}</p>
        <div style="display:grid;gap:16px;margin-top:26px">
          ${csr.drives.items.map((x: Drive) => `<div class="card" style="display:flex;gap:22px;align-items:baseline"><h3 style="width:180px;flex:none;margin:0">${t(x.name)}</h3><p style="width:170px;flex:none;font-weight:700;color:${color.skyInk}">${t(x.when)}</p><p>${t(x.line)}</p></div>`).join("")}
        </div>
      </div>
      <div style="width:330px;flex:none;position:relative">
        ${await pol("photos/strip-gift-a-smile.jpg", "Gift a Smile 2026", "left:6px;top:20px;width:310px;transform:rotate(-2deg)")}
      </div>
    </div>
  </section>`;

  type Step = { title: string; line: string };
  const how = `
  <section class="slide">
    ${eyebrow(d.how.eyebrow)}
    <h2>${h(csr.how.heading)}</h2>
    <div class="row" style="gap:18px;margin-top:10px">
      ${csr.how.steps.map((s: Step, i: number) => `<div class="card grow"><span class="num">${i + 1}</span><h3 style="font-size:22px">${t(s.title)}</h3><p>${t(s.line)}</p></div>`).join("")}
    </div>
    <div class="card" style="margin-top:24px;background:${color.skyWash};display:flex;gap:32px;align-items:flex-start">
      <h3 style="width:200px;flex:none">${t(d.how.report)}</h3>
      <ul class="dots" style="display:grid;grid-template-columns:1fr 1fr;column-gap:28px;margin-top:-10px">${d.how.reportItems.map((x: string) => `<li style="font-size:15px">${t(x)}</li>`).join("")}</ul>
    </div>
  </section>`;

  const logos = await Promise.all(
    partners.items.map(
      async (p: { name: string; logo: string }) =>
        `<div style="display:grid;place-items:center;height:64px;background:${color.white};border:1.5px solid ${color.ink};border-radius:12px;padding:10px 14px"><img src="${await img(p.logo)}" alt="${esc(p.name)}" style="max-width:100%;max-height:40px;object-fit:contain"></div>`
    )
  );
  const trust = `
  <section class="slide">
    ${eyebrow(d.trust.eyebrow)}
    <div class="row" style="gap:56px">
      <div class="grow">
        <h2>${h(safeguarding.heading)}</h2>
        <p class="lede" style="font-size:17px">${t(safeguarding.lede)}</p>
        <ul class="dots" style="margin-top:8px">${safeguarding.rules.map((r: string) => `<li style="font-size:15px">${t(r)}</li>`).join("")}</ul>
      </div>
      <div style="width:470px;flex:none">
        <h3 class="d" style="font-size:22px;margin:10px 0 16px">${t(d.trust.partners)}</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${logos.join("")}</div>
      </div>
    </div>
  </section>`;

  type Reg = { label: string; value: string; note?: string; cert?: string };
  const latest = (kind: string) =>
    reports.find((r: { kind: string }) => r.kind === kind) as {
      title: string;
      url: string;
    };
  const annual = latest("annual");
  const audited = latest("audited");
  const paperwork = `
  <section class="slide">
    ${eyebrow(d.paperwork.eyebrow)}
    <h2 style="max-width:none">${h(csr.paperwork.heading)}</h2>
    <p class="lede">${t(csr.paperwork.lede)}</p>
    <div class="row" style="gap:48px;margin-top:14px">
      <table class="grow tight">
        <tbody>${csr.paperwork.items.map((r: Reg) => `<tr><td style="width:240px">${t(r.label)}</td><td><b style="font-size:17px">${t(r.value)}</b>${r.note ? `<br><span class="small mute">${t(r.note)}</span>` : ""}</td><td style="width:110px;text-align:right">${r.cert ? `<a href="${abs(site.certificates[r.cert])}">Certificate</a>` : ""}</td></tr>`).join("")}</tbody>
      </table>
      <div style="width:330px;flex:none;display:grid;gap:14px;align-content:start">
        <a class="card" href="${abs(audited.url)}" style="text-decoration:none"><p class="small mute">${t(csr.paperwork.latestAudited)}</p><h3 style="margin:6px 0 0;font-size:21px">${t(audited.title)} ↗</h3></a>
        <a class="card" href="${abs(annual.url)}" style="text-decoration:none"><p class="small mute">${t(csr.paperwork.latestAnnual)}</p><h3 style="margin:6px 0 0;font-size:21px">${t(annual.title)} ↗</h3></a>
        <p class="small">${t(csr.paperwork.certificates)} <a href="${site.url}/#reports">${t(csr.paperwork.all)}</a>.</p>
      </div>
    </div>
  </section>`;

  const closing = `
  <section class="slide sky">
    ${doodle("hands-raised", "right:110px;top:90px;width:230px", color.ink)}
    ${doodle("heart", "right:380px;top:120px;width:64px", color.ink)}
    ${logo("pi-lockup-mono", 40)}
    <h2 style="font-size:84px;margin-top:70px;max-width:12ch">${t(d.closing.heading)}</h2>
    <p class="lede" style="max-width:50ch">${t(d.closing.lede)}</p>
    <div class="row" style="margin-top:30px;gap:14px">
      <a class="pill ink" href="mailto:${connect}?subject=${encodeURIComponent(csr.contact.subject)}">Email ${esc(connect)}</a>
      <a class="pill paper" href="${whatsapp}">WhatsApp ${esc(site.contacts.phone.display)}</a>
    </div>
    <p class="small" style="margin-top:26px">${esc(registrationLine())}</p>
  </section>`;

  return {
    name: "csr",
    title: d.title,
    slides: [
      cover,
      about,
      what,
      ways,
      days,
      cost,
      kalakriti,
      fund,
      drives,
      how,
      trust,
      paperwork,
      closing,
    ],
  };
}

// ---- the Kalakriti deck

const bunting = () =>
  `<svg class="bunting" viewBox="0 0 1000 84" preserveAspectRatio="none"><path d="M0 8C250 62 750 62 1000 8" fill="none" stroke="${color.paper}" stroke-opacity=".55" stroke-width="1.5"/>${[
    [60, 20, color.sky],
    [190, 38, color.marigold],
    [330, 48, color.paper],
    [470, 52, color.sky],
    [610, 50, color.marigold],
    [750, 42, color.paper],
    [890, 26, color.sky],
  ]
    .map(
      ([x, y, c]) =>
        `<path d="M${Number(x) - 16} ${Number(y) - 2}L${Number(x) + 16} ${Number(y) + 2}L${Number(x) + 1} ${Number(y) + 30}Z" fill="${c}"/>`
    )
    .join("")}</svg>`;

async function kalakritiDeck(): Promise<Deck> {
  const d = decks.kalakriti;
  const troupe = kala.edition.troupe as { image: string }[];
  const cover = `
  <section class="slide">
    ${bunting()}
    <div class="spot" style="right:-60px"></div>
    ${logo("pi-lockup-reversed", 36, "margin-top:34px")}
    <div style="margin-top:46px;width:640px">
      ${eyebrow(d.cover.eyebrow)}
      <h1 style="font-size:84px">${t(d.cover.heading)}</h1>
      <p class="lede" style="margin-top:22px;max-width:46ch">${t(d.cover.lede)}</p>
      <p class="d" style="margin-top:26px;font-size:28px;color:${color.marigold}">${t(d.cover.date)}</p>
    </div>
    <img class="cut" src="${await cutout(troupe[0]!.image)}" alt="" style="right:330px;bottom:-30px;height:400px;transform:rotate(-4deg)">
    <img class="cut" src="${await cutout(troupe[1]!.image)}" alt="" style="right:120px;bottom:-40px;height:470px;transform:rotate(2deg)">
    <img class="cut" src="${await cutout(troupe[2]!.image)}" alt="" style="right:-10px;bottom:-30px;height:290px;transform:rotate(6deg)">
  </section>`;

  const why = `
  <section class="slide">
    ${eyebrow(d.why.eyebrow)}
    <div class="row" style="gap:60px">
      <div class="grow">
        <h2>${t(d.why.heading)}</h2>
        <p class="lede">${t(d.why.lede)}</p>
        <ul class="dots" style="margin-top:12px;max-width:58ch">${d.why.points.map((p: string) => `<li>${t(p)}</li>`).join("")}</ul>
      </div>
      <div style="width:400px;flex:none;position:relative">
        ${await pol("photos/kalakriti-2-trophy.jpg", "Lifting the trophy, Kalakriti 2.0", "left:10px;top:24px;width:380px;transform:rotate(2.5deg)")}
      </div>
    </div>
  </section>`;

  type Act = { label: string; title: string; line: string; events: string[] };
  type LinePhoto = {
    event: string;
    image: string;
    caption: string;
    position?: string;
  };
  const linePhotos = kala.line.photos as LinePhoto[];
  const day = `
  <section class="slide">
    ${eyebrow(d.day.eyebrow)}
    <h2>${h(kalaPage.events.heading)}</h2>
    <p class="lede">${t(kalaPage.events.lede)}</p>
    <div class="row" style="gap:28px;margin-top:22px;flex:1">
      ${(
        await Promise.all(
          (kalaPage.events.acts as Act[]).map(
            async (a) => `
        <div class="grow">
          <p style="font:700 12.5px/1 Geist;letter-spacing:.12em;text-transform:uppercase;color:${color.marigold}">${t(a.label)}</p>
          <h3 class="d" style="font-size:30px;margin:8px 0 8px">${t(a.title)}</h3>
          <p style="font-size:15px;line-height:1.45;opacity:.85;min-height:44px">${t(a.line)}</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px">
            ${(
              await Promise.all(
                a.events.map(async (e) => {
                  const p = linePhotos.find((x) => x.event === e);
                  return `<figure style="background:${color.white};padding:5px 5px 0;border-radius:3px;transform:rotate(${(e.length % 5) - 2}deg)"><div style="height:120px">${p ? await photo(p.image, "", p.position) : ""}</div><figcaption style="font:800 12.5px/1.1 Brico;color:${color.ink};padding:7px 1px 8px;white-space:nowrap">${t(e)}</figcaption></figure>`;
                })
              )
            ).join("")}
          </div>
        </div>`
          )
        )
      ).join("")}
    </div>
  </section>`;

  type Edition = {
    name: string;
    dateLabel: string;
    venue: string;
    children?: string;
    volunteers?: string;
    cost: string;
    raised: string;
    note: string;
    disclosure: string;
    image: string;
  };
  const eds = [...(kalaPage.editions.items as Edition[])].reverse();
  const EL = kalaPage.editions.labels;
  const editions = `
  <section class="slide">
    ${eyebrow(d.editions.eyebrow)}
    <h2>${t(d.editions.heading)}</h2>
    <div class="row" style="gap:20px;flex:1">
      ${(
        await Promise.all(
          eds.map(
            async (e) => `
        <div class="card grow" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
          <div style="height:150px">${await photo(e.image)}</div>
          <div style="padding:14px 18px 16px;display:flex;flex-direction:column;flex:1">
            <h3 style="margin-bottom:4px">${t(e.name)}</h3>
            <p class="small">${t(e.dateLabel)} · ${t(e.venue)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin:12px 0">
              <p class="small"><span class="mute">${t(EL.children)}</span><br><b class="d" style="font-size:22px">${t(e.children ?? "–")}</b></p>
              <p class="small"><span class="mute">${t(EL.volunteers)}</span><br><b class="d" style="font-size:22px">${t(e.volunteers ?? "–")}</b></p>
              <p class="small"><span class="mute">${t(EL.cost)}</span><br><b class="d" style="font-size:22px">${t(e.cost)}</b></p>
              <p class="small"><span class="mute">${t(EL.raised)}</span><br><b class="d" style="font-size:22px">${t(e.raised)}</b></p>
            </div>
            <p style="font-size:12.5px;line-height:1.4">${t(e.note)}</p>
            <p class="small" style="margin-top:auto;padding-top:8px"><a href="${abs(e.disclosure)}">${t(kalaPage.editions.disclosure)}</a></p>
          </div>
        </div>`
          )
        )
      ).join("")}
    </div>
  </section>`;

  const shots = d.gallery.photos as { image: string; caption: string }[];
  const tilt = [-2, 1.5, -1, 2, -1.5, 1];
  const gallery = `
  <section class="slide">
    ${eyebrow(d.gallery.eyebrow)}
    <h2>${t(d.gallery.heading)}</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px 34px;margin-top:4px">
      ${(
        await Promise.all(
          shots.map(
            async (s, i) =>
              `<figure style="background:${color.white};padding:7px 7px 0;transform:rotate(${tilt[i]}deg);box-shadow:4px 5px 0 ${color.marigold}"><div style="height:158px">${await photo(s.image)}</div><figcaption style="font:800 14px/1 Brico;color:${color.ink};padding:8px 2px 9px">${t(s.caption)}</figcaption></figure>`
          )
        )
      ).join("")}
    </div>
  </section>`;

  const rows = d.money.rows as { label: string; amount: number }[];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const max = Math.max(...rows.map((r) => r.amount));
  const money = `
  <section class="slide">
    ${eyebrow(d.money.eyebrow)}
    <div class="row" style="gap:56px">
      <div class="grow">
        <h2>${t(d.money.heading)}</h2>
        <p class="lede" style="font-size:17px">${t(d.money.lede)}</p>
        <div style="margin-top:16px;display:grid;gap:11px">
          ${rows.map((r) => `<div><p style="display:flex;justify-content:space-between;font-size:14.5px"><span>${t(r.label)}</span><b style="font-variant-numeric:tabular-nums">${rupees(r.amount)}</b></p><div class="bar" style="width:${((r.amount / max) * 100).toFixed(1)}%"></div></div>`).join("")}
          <p style="display:flex;justify-content:space-between;border-top:1.5px solid ${color.paper};padding-top:10px;font-weight:700"><span>Kalakriti 3.0, the festival day</span><span>${rupees(total)}</span></p>
        </div>
        <p class="small mute" style="margin-top:10px">From the <a href="${abs(csr.kalakriti.disclosure)}">Kalakriti 3.0 financial disclosure</a>, rounded to the rupee. Horizon’s year of training, another ₹2,03,373, is in the same disclosure.</p>
      </div>
      <div style="width:410px;flex:none;position:relative">
        ${await pol(d.money.photo.image, d.money.photo.caption, "left:6px;top:26px;width:400px;transform:rotate(-2deg)")}
      </div>
    </div>
  </section>`;

  const hz = kalaPage.horizon;
  const horizon = `
  <section class="slide">
    ${eyebrow(d.horizon.eyebrow)}
    <div class="row" style="gap:56px">
      <div class="grow">
        <h2>${h(hz.heading)}</h2>
        <p class="lede" style="font-size:17.5px">${t(hz.lede)}</p>
        <p style="font:700 12.5px/1 Geist;letter-spacing:.12em;text-transform:uppercase;color:${color.marigold};margin:22px 0 12px">${t(hz.yearLabel)}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:14px">
          ${hz.stats.map((s: { number: string; label: string }) => `<div class="stat"><b style="font-size:34px">${t(s.number)}</b><span style="font-size:12.5px">${t(s.label)}</span></div>`).join("")}
        </div>
        <p style="margin-top:20px;font-size:16px;line-height:1.45">${t(hz.story)} ${t(hz.next)}</p>
      </div>
      <div style="width:380px;flex:none;position:relative">
        ${await pol(hz.photo.image, hz.photo.caption, "left:6px;top:26px;width:360px;transform:rotate(2deg)")}
      </div>
    </div>
  </section>`;

  type Target = { number: string; label: string; note: string };
  type Budget = {
    label: string;
    amount: string;
    note?: string;
    total?: boolean;
  };
  const plan = `
  <section class="slide">
    ${eyebrow(d.plan.eyebrow)}
    <h2>${t(d.plan.heading)}</h2>
    <p class="lede">${t(d.plan.lede)}</p>
    <div class="row" style="gap:16px;margin-top:22px">
      ${(d.plan.targets as Target[]).map((x) => `<div class="stat grow"><b>${t(x.number)}</b><span><b style="display:inline;font:700 15px Geist">${t(x.label)}</b> · ${t(x.note)}</span></div>`).join("")}
    </div>
    <table style="margin-top:28px">
      <tbody>${(d.plan.budget as Budget[]).map((b) => `<tr><td style="width:340px;${b.total ? "font-weight:700" : ""}">${t(b.label)}</td><td class="mute">${b.note ? t(b.note) : ""}</td><td style="text-align:right;width:200px"><b style="font-size:${b.total ? 30 : 22}px;${b.total ? `color:${color.marigold}` : ""}">${t(b.amount)}</b></td></tr>`).join("")}</tbody>
    </table>
  </section>`;

  type Tier = { amount: string; name: string; line: string };
  const gets = d.tiers.gets as string[][];
  const tiers = `
  <section class="slide">
    ${eyebrow(d.tiers.eyebrow)}
    ${await pol(d.tiers.photo.image, d.tiers.photo.caption, "right:120px;top:22px;width:220px;transform:rotate(3deg);z-index:2")}
    <h2 style="margin-bottom:22px">${t(d.tiers.heading)}</h2>
    <div class="row" style="gap:22px;align-items:flex-start;margin-top:60px">
      ${(csr.kalakriti.tiers as Tier[])
        .map(
          (x, i) => `
        <div class="ticket ${i === 2 ? "sun" : ""}" style="flex:${i === 2 ? 1.5 : 1}">
          <p class="amt">${t(x.amount)}</p>
          <p class="name">${t(x.name)}</p>
          <div class="rule"></div>
          <ul>${gets[i]!.map((g) => `<li>${t(g)}</li>`).join("")}</ul>
        </div>`
        )
        .join("")}
    </div>
    <p class="small" style="margin-top:20px;max-width:110ch">${t(d.tiers.note)}</p>
  </section>`;

  type Backer = { name: string; amount: string; line: string };
  const logoOf = (name: string) =>
    (partners.items as { name: string; logo: string }[]).find(
      (p) => p.name === name
    )?.logo;
  const backers = `
  <section class="slide">
    ${eyebrow(d.backers.eyebrow)}
    <div class="row" style="gap:56px">
      <div class="grow">
        <h2>${t(d.backers.heading)}</h2>
        <p class="lede" style="font-size:17.5px">${t(d.backers.lede)}</p>
        <div style="display:grid;gap:16px;margin-top:22px">
          ${(
            await Promise.all(
              (d.backers.items as Backer[]).map(async (b) => {
                const l = logoOf(b.name);
                return `<div class="card" style="display:flex;gap:20px;align-items:center"><div style="width:150px;height:56px;flex:none;display:grid;place-items:center">${l ? `<img src="${await img(l)}" alt="${esc(b.name)}" style="max-width:100%;max-height:52px;object-fit:contain">` : `<b>${esc(b.name)}</b>`}</div><div><p class="d" style="font-size:30px">${t(b.amount)}</p><p style="margin-top:4px">${t(b.line)}</p></div></div>`;
              })
            )
          ).join("")}
        </div>
      </div>
      <div style="width:420px;flex:none;position:relative">
        ${await pol(d.backers.photo.image, d.backers.photo.caption, "left:6px;top:20px;width:400px;transform:rotate(2deg)")}
      </div>
    </div>
  </section>`;

  type When = { when: string; what: string };
  const timeline = `
  <section class="slide">
    ${eyebrow(d.timeline.eyebrow)}
    <h2>${t(d.timeline.heading)}</h2>
    <div style="position:relative;margin-top:40px">
      <div style="position:absolute;left:15px;right:15px;top:15px;border-top:2px dashed ${color.marigold}"></div>
      <div class="row" style="gap:26px;position:relative">
        ${(d.timeline.steps as When[]).map((s, i) => `<div class="grow"><span class="num">${i + 1}</span><p class="d" style="font-size:24px;color:${color.marigold};margin-bottom:10px">${t(s.when)}</p><p style="font-size:16px;line-height:1.45">${t(s.what)}</p></div>`).join("")}
      </div>
    </div>
  </section>`;

  const closing = `
  <section class="slide">
    ${bunting()}
    <div class="spot" style="left:-80px"></div>
    ${logo("pi-lockup-reversed", 36, "margin-top:34px")}
    <h2 style="font-size:84px;margin-top:56px;max-width:11ch">${t(d.closing.heading)}</h2>
    <p class="lede" style="max-width:46ch">${t(d.closing.lede)}</p>
    <div class="row" style="margin-top:28px;gap:14px">
      <a class="pill sun" href="mailto:${connect}?subject=${encodeURIComponent(csr.kalakriti.subject)}">Email ${esc(connect)}</a>
      <a class="pill paper" href="${whatsapp}">WhatsApp ${esc(site.contacts.phone.display)}</a>
    </div>
    <p class="small" style="margin-top:24px;max-width:62ch">${esc(registrationLine())}. Every edition’s financial disclosure is at <a href="${site.url}/kalakriti/">${site.url.replace("https://", "")}/kalakriti</a>.</p>
    <img class="cut" src="${await cutout("cutouts/Kalakriti3_DSC01748.png")}" alt="" style="right:190px;bottom:-30px;height:460px;transform:rotate(3deg)">
  </section>`;

  return {
    name: "kalakriti",
    title: d.title,
    slides: [
      cover,
      why,
      day,
      editions,
      gallery,
      money,
      horizon,
      plan,
      tiers,
      backers,
      timeline,
      closing,
    ],
  };
}

// ---- render

const builders = { csr: csrDeck, kalakriti: kalakritiDeck } as const;
const only = process.argv[2];
if (only && !(only in builders))
  throw new Error(`decks: no deck "${only}" (csr | kalakriti)`);
const names = (
  only ? [only] : Object.keys(builders)
) as (keyof typeof builders)[];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
});
for (const name of names) {
  const deck = await builders[name]();
  await tab.setContent(page(deck), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  // a slide whose content runs into the footer fails the run, so an overlong line in the YAML can't slip through
  const over = await tab.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".slide")]
      .map((s, i) => {
        const limit = s.getBoundingClientRect().bottom - 64;
        const tall = [...s.querySelectorAll<HTMLElement>("*")].some(
          (el) =>
            !el.closest("footer") &&
            !el.classList.contains("cut") &&
            !el.closest(".spot") &&
            getComputedStyle(el).position !== "absolute" &&
            el.getBoundingClientRect().bottom > limit + 1
        );
        return tall ? i + 1 : 0;
      })
      .filter(Boolean)
  );
  if (over.length)
    console.warn(
      `decks: ${name} slide(s) ${over.join(", ")} run into the footer`
    );
  const pdf = `${OUT}/${name}.pdf`;
  await tab.pdf({
    path: pdf,
    width: `${W}px`,
    height: `${H}px`,
    printBackground: true,
    tagged: true,
  });
  // the brand kit's preview tile: the cover
  const cover = await tab.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: W, height: H },
  });
  await sharp(cover)
    .resize({ width: 1200 })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${OUT}/${name}.jpg`);
  console.log(`decks: wrote ${pdf} (${deck.slides.length} slides)`);
}
await browser.close();
