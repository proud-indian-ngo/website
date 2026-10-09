/**
 * Behaviour checks with motion on, against a built and served site: prints one pass/fail row per check and exits 1 if
 * any fails. A row that reports "skipped: ..." (the session tickets swipe, when the build shows no sessions) is not a
 * failure.
 *   SITE=http://127.0.0.1:4321/ node scripts/qa/behaviour.mjs
 * Also saves open-menu and open-drawer screenshots to /tmp/pi-astro/ (OUT overrides the folder).
 *
 * The "lock:" checks: with the reports drawer or the phone menu open, the page behind must not move under wheel, trackpad or touch drags over the dialog or its
 * scrim, nor under Space, PageDown, arrows or End with focus inside the dialog; the drawer's own list scrolls without
 * chaining to the page; and closing restores the exact scroll position.
 */
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const SITE = process.env.SITE ?? "http://127.0.0.1:4321/";
const OUT = process.env.OUT ?? "/tmp/pi-astro";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, url, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...opts,
  });
  const page = await ctx.newPage();
  const errors = [];
  // only the site's own errors: a third-party request the page can't control (the events feed refusing CORS from
  // 127.0.0.1, an analytics beacon) is not a site bug
  const origin = new URL(url).origin;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const src = m.location().url;
    if (src && !src.startsWith(origin)) return;
    // CORS and network errors are reported against the page, but name the request's URL
    const target = /https?:\/\/[^\s'"]+/.exec(m.text())?.[0];
    if (target && !target.startsWith(origin)) return;
    errors.push(m.text());
  });
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(origin))
      errors.push(`request failed: ${req.url()}`);
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}

async function run(browser, url, tag) {
  const r = {};
  // ---------- desktop, motion on
  {
    const { ctx, page, errors } = await open(browser, url);
    r["motion on at load"] = await page.evaluate(
      () => document.documentElement.dataset.motion === "on"
    );
    r["js-reveal wired"] = await page.evaluate(() =>
      document.documentElement.classList.contains("js-reveal")
    );
    r["hero revealed + animating"] = await page.evaluate(
      () =>
        document.querySelectorAll(".s-hero [data-reveal].rv-in").length > 0 &&
        document.getAnimations().length > 0
    );
    r["below-fold hidden until scrolled"] = await page.evaluate(() => {
      const el = document.querySelector("#donate [data-reveal]");
      return (
        !el.classList.contains("rv-in") && getComputedStyle(el).opacity === "0"
      );
    });
    r["marquee loop running at top"] = await page.evaluate(
      () => !document.querySelector(".marquee").classList.contains("is-paused")
    );
    r["street scene paused off-screen"] = await page.evaluate(() =>
      document.querySelector(".fC-scene.dk").classList.contains("is-paused")
    );
    // wobble
    const wob = page.locator(".s-prog .bB .wob").first();
    await wob.scrollIntoViewIfNeeded();
    await sleep(1600);
    await wob.hover({ force: true });
    r["wobble on hover"] = await wob.evaluate((el) =>
      el.getAnimations().some((a) => !(a instanceof CSSAnimation))
    );
    // reveal on scroll
    await page.locator("#donate").scrollIntoViewIfNeeded();
    await sleep(900);
    r["reveal plays on scroll"] = await page.evaluate(() =>
      document
        .querySelector("#donate [data-reveal]")
        .classList.contains("rv-in")
    );
    // hash link + scroll spy + rail
    await page.evaluate(() => scrollTo(0, 0));
    await sleep(300);
    await page.click('.site-hd a[href="#kalakriti"]');
    await sleep(1500);
    r["hash link lands on section"] = await page.evaluate(() => {
      const t = document
        .getElementById("kalakriti")
        .getBoundingClientRect().top;
      return (
        Math.abs(
          t -
            parseFloat(
              getComputedStyle(document.documentElement).scrollPaddingTop
            )
        ) < 4
      );
    });
    r["header spy marks Kalakriti"] = await page.evaluate(() =>
      document
        .querySelector('[data-spy-link="kalakriti"]')
        .classList.contains("on")
    );
    r["rail shown, ink mode"] = await page.evaluate(() => {
      const p = document.querySelector("[data-pidx]");
      return p.classList.contains("show") && p.classList.contains("on-ink");
    });
    await page.click('[data-pidx] a[data-k="b3"]');
    await sleep(1500);
    r["rail link to Gather"] = await page.evaluate(() =>
      document
        .querySelector('[data-pidx] a[data-k="b3"]')
        .classList.contains("on")
    );
    // plane
    await page.evaluate(() => scrollTo(0, 0));
    await page
      .locator("#volunteer [data-plane-target]")
      .scrollIntoViewIfNeeded();
    await sleep(3200);
    r["paper plane flew"] = await page.evaluate(() => {
      const d = document.querySelector(".fly .trail").getAttribute("d");
      return (
        !!d &&
        d.startsWith("M") &&
        getComputedStyle(document.querySelector(".fly")).opacity === "1"
      );
    });
    // donate
    await page.locator("#donate").scrollIntoViewIfNeeded();
    await page.click('#donate .amt[data-amt="2500"]');
    await sleep(150);
    r["donate pick: deep link"] = await page.evaluate(() => {
      const a = document.querySelector("#donate [data-donate]");
      // the parameter name is the Razorpay item name, configured in site.yaml (links.razorpay), so only its value is checked
      const u = new URL(a.href);
      return (
        u.origin + u.pathname ===
          "https://pages.razorpay.com/proud-indian-ngo-donate" &&
        [...u.searchParams.values()].join() === "2500" &&
        a.textContent.includes("Donate ₹2,500")
      );
    });
    r["coins drop"] = await page.evaluate(
      () => document.querySelectorAll("#donate .coins .coin").length > 0
    );
    await page.click("#donate .amt-in");
    await page.keyboard.type("50");
    r["below minimum: note + base link"] = await page.evaluate(() => {
      const a = document.querySelector("#donate [data-donate]");
      return (
        !document.querySelector("#donate [data-low]").hidden &&
        a.href === "https://pages.razorpay.com/proud-indian-ngo-donate"
      );
    });
    await page.keyboard.type("00");
    r["typed ₹5,000: deep link"] = await page.evaluate(() =>
      document.querySelector("#donate [data-donate]").href.endsWith("=5000")
    );
    await page.keyboard.press("Enter");
    await sleep(300);
    r["Enter does not reload"] = await page.evaluate(
      () => document.querySelector("#donate .amt-in").value === "5,000"
    );
    // reports drawer
    await page.locator(".cDis").scrollIntoViewIfNeeded();
    await page.click(".cDis");
    await sleep(200);
    r["drawer opens on disclosures"] = await page.evaluate(
      () =>
        !document.querySelector(".cDrawer").hidden &&
        document
          .querySelector('[data-tab="dis"]')
          .getAttribute("aria-selected") === "true" &&
        document.activeElement.classList.contains("cClose")
    );
    await page.screenshot({ path: `${OUT}/behaviour-drawer-${tag}.png` });
    await page.focus('[data-tab="dis"]');
    await page.keyboard.press("ArrowRight");
    r["tab arrow keys"] = await page.evaluate(
      () =>
        document
          .querySelector('[data-tab="ann"]')
          .getAttribute("aria-selected") === "true" &&
        !document.getElementById("c-p-ann").hidden
    );
    await page.keyboard.press("Escape");
    await sleep(100);
    r["Escape closes, focus returns"] = await page.evaluate(
      () =>
        document.querySelector(".cDrawer").hidden &&
        document.activeElement.classList.contains("cDis")
    );
    // street scene loop when in view, pause toggle (scroll to the scene itself: at the bottom of the page a tall
    // footer can push it off screen)
    await page.evaluate(() =>
      document
        .querySelector(".fC-scene.dk")
        .scrollIntoView({ block: "center", behavior: "instant" })
    );
    await sleep(700);
    r["scene loop runs in view"] = await page.evaluate(
      () =>
        !document.querySelector(".fC-scene.dk").classList.contains("is-paused")
    );
    r["marquee paused off-screen"] = await page.evaluate(() =>
      document.querySelector(".marquee").classList.contains("is-paused")
    );
    await page.click(".ft-pmb");
    r["Pause: motion off + pressed + saved"] = await page.evaluate(
      () =>
        document.documentElement.dataset.motion === "off" &&
        document.querySelector(".ft-pmb").getAttribute("aria-pressed") ===
          "true" &&
        localStorage.getItem("pi-motion-paused") === "1" &&
        getComputedStyle(document.querySelector(".fC-scene .kite"))
          .animationName === "none"
    );
    await page.reload({ waitUntil: "networkidle" });
    r["Pause persists across reload"] = await page.evaluate(
      () =>
        document.documentElement.dataset.motion === "off" &&
        document.querySelectorAll("[data-reveal]:not(.rv-in)").length === 0
    );
    await page.evaluate(() =>
      scrollTo(0, document.documentElement.scrollHeight)
    );
    await sleep(300);
    await page.click(".ft-pmb");
    r["Resume: motion back on"] = await page.evaluate(
      () =>
        document.documentElement.dataset.motion === "on" &&
        localStorage.getItem("pi-motion-paused") === "0"
    );
    r["no console errors (desktop)"] = errors.length === 0;
    if (errors.length) console.log(tag, errors);
    await ctx.close();
  }
  // ---------- reduced motion
  {
    const { ctx, page, errors } = await open(browser, url, {
      reducedMotion: "reduce",
    });
    r["reduced motion: off, all shown"] = await page.evaluate(
      () =>
        document.documentElement.dataset.motion === "off" &&
        document.querySelectorAll("[data-reveal]:not(.rv-in)").length === 0 &&
        getComputedStyle(document.querySelector(".marquee__track"))
          .animationName === "none"
    );
    r["reduced motion: status text"] = await page.evaluate(() =>
      /reduced motion/.test(document.getElementById("pm-s").textContent)
    );
    r["no console errors (reduced)"] = errors.length === 0;
    await ctx.close();
  }
  // ---------- phone
  {
    const { ctx, page, errors } = await open(browser, url, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    await page.click("[data-menu-open]");
    await sleep(200);
    r["phone menu opens, focus on Close"] = await page.evaluate(
      () =>
        !document.getElementById("menu").hidden &&
        document
          .querySelector("[data-menu-open]")
          .getAttribute("aria-expanded") === "true" &&
        document.activeElement.matches("[data-menu-close]") &&
        document.querySelector("main").inert
    );
    await page.screenshot({ path: `${OUT}/behaviour-menu-${tag}.png` });
    await page.click('#menu a[href="#volunteer"]');
    await sleep(1500);
    r["menu link closes + scrolls"] = await page.evaluate(
      () =>
        document.getElementById("menu").hidden &&
        Math.abs(
          document.getElementById("volunteer").getBoundingClientRect().top - 66
        ) < 4
    );
    r["sticky donate bar shows"] = await page.evaluate(() =>
      document.querySelector("[data-sbar]").classList.contains("show")
    );
    // swipe the Kalakriti line and the session tickets with a real touch gesture
    const swipe = async (sel) => {
      const el = page.locator(sel);
      // the session tickets only exist with sessions (a build without the events API shows the empty poster)
      if (!(await el.isVisible())) return "skipped: not shown";
      await el.scrollIntoViewIfNeeded();
      await sleep(400);
      const box = await el.boundingBox();
      const before = await el.evaluate((n) => n.scrollLeft);
      const cdp = await ctx.newCDPSession(page);
      const moved = () =>
        el.evaluate((n, b) => n.scrollLeft > b + 50, before).catch(() => false);
      // a real touch drag (finger down, moves, up): the same on every platform, unlike a synthesized scroll gesture.
      // a slow runner can need a second drag and some time for the scroll to settle
      const y = box.y + Math.min(box.height / 2, 150);
      const x0 = box.x + box.width * 0.8;
      const touch = (type, x) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        });
      for (let attempt = 0; attempt < 2; attempt++) {
        await touch("touchStart", x0);
        for (let i = 1; i <= 12; i++) {
          await touch("touchMove", x0 - (260 * i) / 12);
          await sleep(16);
        }
        await touch("touchEnd", x0 - 260);
        for (let t = 0; t < 25; t++) {
          if (await moved()) return true;
          await sleep(100);
        }
      }
      return false;
    };
    r["swipe Kalakriti line"] = await swipe(".kl-scroll");
    r["swipe session tickets"] = await swipe(".s-vol .stks");
    r["no console errors (phone)"] = errors.length === 0;
    await ctx.close();
  }
  return r;
}

/** the page's scroll lock while a dialog is open (see the header) */
async function lockChecks(browser, url) {
  const r = {};
  const y = (page) => page.evaluate(() => scrollY);
  const tapOrClick = async (page, sel, touch) => {
    // a raw click at the element: page.click() scrolls the target into view itself, which would move the page
    const b = await page.locator(sel).boundingBox();
    if (touch) await page.touchscreen.tap(b.x + 20, b.y + 20);
    else await page.mouse.click(b.x + 20, b.y + 20);
    await sleep(300);
  };
  const openDrawer = async (page, touch = false) => {
    await page.locator(".cDis").scrollIntoViewIfNeeded();
    await sleep(800);
    const y0 = await y(page);
    await tapOrClick(page, ".cDis", touch);
    return y0;
  };
  const drag = (ctx, page, x, yy, dy) =>
    ctx.newCDPSession(page).then((cdp) =>
      cdp.send("Input.synthesizeScrollGesture", {
        x,
        y: yy,
        xDistance: 0,
        yDistance: dy,
        gestureSourceType: "touch",
        speed: 1500,
      })
    );
  // desktop, 1440 x 900: wheel over the drawer and the scrim, then the scrolling keys with focus in the drawer
  {
    const { ctx, page } = await open(browser, url);
    const y0 = await openDrawer(page);
    const dr = await page.locator(".cDrawer").boundingBox();
    let moved = 0;
    for (const x of [dr.x + dr.width / 2, dr.x / 2]) {
      await page.mouse.move(x, 450);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 300);
        await sleep(50);
      }
      await sleep(300);
      moved = Math.max(moved, Math.abs((await y(page)) - y0));
    }
    r["lock: wheel over drawer + scrim"] = moved === 0;
    const hb = await page.locator(".cDrawer .tr-h3").boundingBox();
    await page.mouse.click(hb.x + 10, hb.y + 10);
    moved = 0;
    for (const key of ["Space", "PageDown", "ArrowDown", "End"]) {
      await page.keyboard.press(key);
      await sleep(250);
      moved = Math.max(moved, Math.abs((await y(page)) - y0));
    }
    r["lock: keys in drawer"] =
      moved === 0 &&
      (await page.evaluate(() => !document.querySelector(".cDrawer").hidden));
    await page.keyboard.press("Escape");
    await sleep(300);
    r["lock: drawer close restores scroll"] =
      (await y(page)) === y0 &&
      (await page.evaluate(
        () => !document.documentElement.classList.contains("scroll-lock")
      ));
    await ctx.close();
  }
  // a short window, where the drawer's list overflows: the drawer scrolls, the page does not, even past its end
  {
    const { ctx, page } = await open(browser, url, {
      viewport: { width: 1280, height: 560 },
    });
    const y0 = await openDrawer(page);
    // "See all" lists every disclosure, so the list is long enough to scroll
    if (await page.locator("[data-see-all]").count())
      await page.locator("[data-see-all]").click();
    const dr = await page.locator(".cDrawer").boundingBox();
    await page.mouse.move(dr.x + dr.width / 2, 300);
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 400);
      await sleep(50);
    }
    await sleep(400);
    r["lock: drawer scrolls itself, no chaining"] =
      (await page.evaluate(() => {
        const d = document.querySelector(".cDrawer");
        return (
          d.scrollTop > 0 &&
          d.scrollTop + d.clientHeight >= d.scrollHeight - 1 &&
          getComputedStyle(d).overscrollBehaviorY === "contain"
        );
      })) && (await y(page)) === y0;
    await ctx.close();
  }
  // touch tablet: drags over the drawer and the scrim
  {
    const { ctx, page } = await open(browser, url, {
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
      isMobile: true,
    });
    const y0 = await openDrawer(page, true);
    const dr = await page.locator(".cDrawer").boundingBox();
    for (const x of [dr.x + dr.width / 2, dr.x / 2])
      for (let i = 0; i < 2; i++) await drag(ctx, page, x, 400, -500);
    await sleep(400);
    r["lock: touch drag over drawer + scrim"] = (await y(page)) === y0;
    await ctx.close();
  }
  // phone menu: touch drags and the wheel, then close
  {
    const { ctx, page } = await open(browser, url, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    await page.evaluate(() => scrollTo({ top: 1500, behavior: "instant" }));
    await sleep(400);
    const y0 = await y(page);
    await tapOrClick(page, "[data-menu-open]", true);
    for (let i = 0; i < 2; i++) await drag(ctx, page, 195, 600, -500);
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 900);
    await sleep(400);
    r["lock: phone menu drag + wheel"] =
      (await y(page)) === y0 &&
      (await page.evaluate(
        () =>
          getComputedStyle(document.getElementById("menu"))
            .overscrollBehaviorY === "contain"
      ));
    await tapOrClick(page, "[data-menu-close]", true);
    r["lock: menu close restores scroll"] = (await y(page)) === y0;
    await ctx.close();
  }
  return r;
}

/** The volunteer guide (/volunteer/): it loads clean, reveals and loops run, the FAQ opens and closes, its own
 *  sections stay in-page and the rest of the header goes to the home page, and the home page links to it. */
async function guideChecks(browser, site) {
  const r = {};
  const url = new URL("volunteer/", site).href;
  {
    const { ctx, page, errors } = await open(browser, url);
    r["guide: js-reveal wired"] = await page.evaluate(() =>
      document.documentElement.classList.contains("js-reveal")
    );
    r["guide: one h1, FAQPage data"] = await page.evaluate(
      () =>
        document.querySelectorAll("h1").length === 1 &&
        [
          ...document.querySelectorAll('script[type="application/ld+json"]'),
        ].some((s) => s.textContent.includes('"FAQPage"'))
    );
    const q = page.locator(".vg-q").nth(1);
    await q.locator("summary").click();
    const opened = await q.evaluate((d) => d.open);
    await q.locator("summary").click();
    r["guide: FAQ opens and closes"] =
      opened && !(await q.evaluate((d) => d.open));
    r["guide: header links"] = await page.evaluate(
      () =>
        document.querySelector('.site-hd a[href="#volunteer"]') !== null &&
        document.querySelector('.site-hd a[href="/#donate"]') !== null &&
        document.querySelector('.site-hd a[href="/#reports"]') !== null
    );
    await page.evaluate(() =>
      document
        .querySelector("#internships")
        .scrollIntoView({ block: "center", behavior: "instant" })
    );
    await sleep(700);
    r["guide: sparkle loop runs in view"] = await page.evaluate(
      () =>
        !document.querySelector(".vg-kspark").classList.contains("is-paused")
    );
    r["guide: no console errors"] = errors.length === 0 || errors.join(" | ");
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, site);
    r["home links to the guide"] = await page.evaluate(
      () => document.querySelectorAll('a[href="/volunteer/"]').length >= 2
    );
    await ctx.close();
  }
  return r;
}

const browser = await chromium.launch();
const s = {
  ...(await run(browser, SITE, "site")),
  ...(await lockChecks(browser, SITE)),
  ...(await guideChecks(browser, SITE)),
};
await browser.close();
const skipped = (v) => String(v).startsWith("skipped");
const rows = Object.entries(s).map(([check, v]) => ({
  check,
  result: skipped(v) ? v : v === true ? "pass" : "FAIL",
}));
console.table(rows);
const bad = rows.filter((x) => x.result === "FAIL");
if (bad.length) {
  console.log(
    "failed:",
    bad.map((b) => b.check)
  );
  process.exitCode = 1;
}
