/**
 * Behaviour checks with motion on, against a built and served site: prints one pass/fail row per check and exits 1 if
 * any fails. A row that reports "skipped: ..." (the session tickets swipe, when the build shows no sessions) is not a
 * failure.
 *   SITE=http://127.0.0.1:4321/ bun scripts/qa/behaviour.ts
 * Also saves open-menu and open-drawer screenshots to /tmp/pi-astro/ (OUT overrides the folder). JOBS (default 4) sets
 * how many of the independent browser sessions run at once; JOBS=1 runs them one after another.
 *
 * The "lock:" checks: with the reports drawer or the phone menu open, the page behind must not move under wheel, trackpad or touch drags over the dialog or its
 * scrim, nor under Space, PageDown, arrows or End with focus inside the dialog; the drawer's own list scrolls without
 * chaining to the page; and closing restores the exact scroll position.
 */
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  ElementHandle,
  Page,
} from "playwright";

const SITE = process.env.SITE ?? "http://127.0.0.1:4321/";
const OUT = process.env.OUT ?? "/tmp/pi-astro";
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function open(
  browser: Browser,
  url: string,
  opts: BrowserContextOptions = {},
  init?: () => void
) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...opts,
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors: string[] = [];
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

/** polls `fn` in the page until it returns true, for at most `ms`: true once it holds, false if it never does */
const until = <A>(
  page: Page,
  fn: (arg: A) => unknown,
  arg?: A | ElementHandle<A>,
  ms = 4000
) =>
  page
    .waitForFunction(fn as (arg: unknown) => unknown, arg, {
      timeout: ms,
      polling: 50,
    })
    .then(() => true)
    .catch(() => false);

// ---------- desktop, motion on: the page at load, the wobble, reveals, the hash link, the scroll spy and the rail
async function desktop(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
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
    const el = document.querySelector("#donate [data-reveal]")!;
    return (
      !el.classList.contains("rv-in") && getComputedStyle(el).opacity === "0"
    );
  });
  r["marquee loop running at top"] = await page.evaluate(
    () => !document.querySelector(".marquee")!.classList.contains("is-paused")
  );
  r["street scene paused off-screen"] = await page.evaluate(() =>
    document.querySelector(".fC-scene.dk")!.classList.contains("is-paused")
  );
  // wobble: the sticker ignores the hover while it is still arriving (wobble.ts), so wait for its reveal to end
  const wob = page.locator(".s-prog .bB .wob").first();
  await wob.scrollIntoViewIfNeeded();
  const arrived = await wob.elementHandle();
  await until(
    page,
    (el: Element) =>
      el.closest("[data-reveal]")?.classList.contains("rv-in") !== false &&
      !el
        .getAnimations()
        .some(
          (a) =>
            a.playState === "running" &&
            (!(a instanceof CSSAnimation) || a.animationName.startsWith("ld-"))
        ),
    arrived!
  );
  await wob.hover({ force: true });
  r["wobble on hover"] = await until(
    page,
    (el: Element) =>
      el.getAnimations().some((a) => !(a instanceof CSSAnimation)),
    arrived!,
    1000
  );
  // reveal on scroll
  await page.locator("#donate").scrollIntoViewIfNeeded();
  r["reveal plays on scroll"] = await until(page, () =>
    document.querySelector("#donate [data-reveal]")!.classList.contains("rv-in")
  );
  // hash link + scroll spy + rail
  await page.evaluate(() => scrollTo(0, 0));
  await until(page, () => scrollY === 0);
  await page.click('.site-hd a[href="#kalakriti"]');
  r["hash link lands on section"] = await until(page, () => {
    const t = document.getElementById("kalakriti")!.getBoundingClientRect().top;
    return (
      Math.abs(
        t -
          parseFloat(
            getComputedStyle(document.documentElement).scrollPaddingTop
          )
      ) < 4
    );
  });
  r["header spy marks Kalakriti"] = await until(page, () =>
    document
      .querySelector('[data-spy-link="kalakriti"]')!
      .classList.contains("on")
  );
  r["rail shown, ink mode"] = await until(page, () => {
    const p = document.querySelector("[data-pidx]")!;
    return p.classList.contains("show") && p.classList.contains("on-ink");
  });
  await page.click('[data-pidx] a[data-k="b3"]');
  r["rail link to Gather"] = await until(page, () =>
    document
      .querySelector('[data-pidx] a[data-k="b3"]')!
      .classList.contains("on")
  );
  r["no console errors (desktop)"] = errors.length === 0;
  if (errors.length) console.log(errors);
  await ctx.close();
  return r;
}

// ---------- desktop, motion on: the plane, the donate picker and the reports drawer
async function desktopActions(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page, errors } = await open(browser, url);
  // plane: wait for the flight to start, then to end (2s), and check what it leaves behind
  await page.locator("#volunteer [data-plane-target]").scrollIntoViewIfNeeded();
  const flying = (on: boolean) =>
    document.querySelector(".fly .plane")!.getAnimations().length > 0 === on;
  const flew =
    (await until(page, flying, true)) &&
    (await until(page, flying, false, 5000));
  r["paper plane flew"] =
    flew &&
    (await page.evaluate(() => {
      const d = document.querySelector(".fly .trail")!.getAttribute("d");
      return (
        !!d &&
        d.startsWith("M") &&
        getComputedStyle(document.querySelector(".fly")!).opacity === "1"
      );
    }));
  // donate
  await page.locator("#donate").scrollIntoViewIfNeeded();
  await page.click('#donate .amt[data-amt="2500"]');
  r["donate pick: deep link"] = await until(page, () => {
    const a = document.querySelector<HTMLAnchorElement>(
      "#donate [data-donate]"
    )!;
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
    const a = document.querySelector<HTMLAnchorElement>(
      "#donate [data-donate]"
    )!;
    return (
      !document.querySelector<HTMLElement>("#donate [data-low]")!.hidden &&
      a.href === "https://pages.razorpay.com/proud-indian-ngo-donate"
    );
  });
  await page.keyboard.type("00");
  r["typed ₹5,000: deep link"] = await page.evaluate(() =>
    document
      .querySelector<HTMLAnchorElement>("#donate [data-donate]")!
      .href.endsWith("=5000")
  );
  await page.keyboard.press("Enter");
  // a reload would take a moment to start, so this one waits a fixed time
  await sleep(300);
  r["Enter does not reload"] = await page.evaluate(
    () =>
      document.querySelector<HTMLInputElement>("#donate .amt-in")!.value ===
      "5,000"
  );
  // reports drawer
  await page.locator(".cDis").scrollIntoViewIfNeeded();
  await page.click(".cDis");
  r["drawer opens on disclosures"] = await until(
    page,
    () =>
      !document.querySelector<HTMLElement>(".cDrawer")!.hidden &&
      document
        .querySelector('[data-tab="dis"]')!
        .getAttribute("aria-selected") === "true" &&
      document.activeElement!.classList.contains("cClose")
  );
  await page.screenshot({ path: `${OUT}/behaviour-drawer-site.png` });
  await page.focus('[data-tab="dis"]');
  await page.keyboard.press("ArrowRight");
  r["tab arrow keys"] = await page.evaluate(
    () =>
      document
        .querySelector('[data-tab="ann"]')!
        .getAttribute("aria-selected") === "true" &&
      !document.getElementById("c-p-ann")!.hidden
  );
  await page.keyboard.press("Escape");
  r["Escape closes, focus returns"] = await until(
    page,
    () =>
      document.querySelector<HTMLElement>(".cDrawer")!.hidden &&
      document.activeElement!.classList.contains("cDis")
  );
  r["no console errors (desktop actions)"] = errors.length === 0;
  if (errors.length) console.log(errors);
  await ctx.close();
  return r;
}

// ---------- desktop, motion on: the street scene loop in view, and the Pause toggle
async function desktopPause(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page, errors } = await open(browser, url);
  // scroll to the scene itself: at the bottom of the page a tall footer can push it off screen
  await page.evaluate(() =>
    document
      .querySelector(".fC-scene.dk")!
      .scrollIntoView({ block: "center", behavior: "instant" })
  );
  r["scene loop runs in view"] = await until(
    page,
    () =>
      !document.querySelector(".fC-scene.dk")!.classList.contains("is-paused")
  );
  r["marquee paused off-screen"] = await until(page, () =>
    document.querySelector(".marquee")!.classList.contains("is-paused")
  );
  await page.click(".ft-pmb");
  r["Pause: motion off + pressed + saved"] = await page.evaluate(
    () =>
      document.documentElement.dataset.motion === "off" &&
      document.querySelector(".ft-pmb")!.getAttribute("aria-pressed") ===
        "true" &&
      localStorage.getItem("pi-motion-paused") === "1" &&
      getComputedStyle(document.querySelector(".fC-scene .kite")!)
        .animationName === "none"
  );
  await page.reload({ waitUntil: "networkidle" });
  r["Pause persists across reload"] = await page.evaluate(
    () =>
      document.documentElement.dataset.motion === "off" &&
      document.querySelectorAll("[data-reveal]:not(.rv-in)").length === 0
  );
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await sleep(300);
  await page.click(".ft-pmb");
  r["Resume: motion back on"] = await page.evaluate(
    () =>
      document.documentElement.dataset.motion === "on" &&
      localStorage.getItem("pi-motion-paused") === "0"
  );
  r["no console errors (desktop pause)"] = errors.length === 0;
  if (errors.length) console.log(errors);
  await ctx.close();
  return r;
}

// ---------- reduced motion
async function reducedMotion(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page, errors } = await open(browser, url, {
    reducedMotion: "reduce",
  });
  r["reduced motion: off, all shown"] = await page.evaluate(
    () =>
      document.documentElement.dataset.motion === "off" &&
      document.querySelectorAll("[data-reveal]:not(.rv-in)").length === 0 &&
      getComputedStyle(document.querySelector(".marquee__track")!)
        .animationName === "none"
  );
  r["reduced motion: status text"] = await page.evaluate(() =>
    /reduced motion/.test(document.getElementById("pm-s")!.textContent!)
  );
  r["no console errors (reduced)"] = errors.length === 0;
  await ctx.close();
  return r;
}

// ---------- phone
async function phone(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page, errors } = await open(browser, url, {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await page.click("[data-menu-open]");
  r["phone menu opens, focus on Close"] = await until(
    page,
    () =>
      !document.getElementById("menu")!.hidden &&
      document
        .querySelector("[data-menu-open]")!
        .getAttribute("aria-expanded") === "true" &&
      document.activeElement!.matches("[data-menu-close]") &&
      document.querySelector("main")!.inert
  );
  await page.screenshot({ path: `${OUT}/behaviour-menu-site.png` });
  await page.click('#menu a[href="#volunteer"]');
  r["menu link closes + scrolls"] = await until(
    page,
    () =>
      document.getElementById("menu")!.hidden &&
      Math.abs(
        document.getElementById("volunteer")!.getBoundingClientRect().top - 66
      ) < 4
  );
  r["sticky donate bar shows"] = await until(page, () =>
    document.querySelector("[data-sbar]")!.classList.contains("show")
  );
  // swipe the Kalakriti line and the session tickets with a real touch gesture
  const swipe = async (sel: string) => {
    const el = page.locator(sel);
    // the session tickets only exist with sessions (a build without the events API shows the empty poster)
    if (!(await el.isVisible())) return "skipped: not shown";
    await el.scrollIntoViewIfNeeded();
    await sleep(400);
    const box = (await el.boundingBox())!;
    const before = await el.evaluate((n) => n.scrollLeft);
    const cdp = await ctx.newCDPSession(page);
    const moved = () =>
      el.evaluate((n, b) => n.scrollLeft > b + 50, before).catch(() => false);
    // a real touch drag (finger down, moves, up): the same on every platform, unlike a synthesized scroll gesture.
    // a slow runner can need a second drag and some time for the scroll to settle
    const y = box.y + Math.min(box.height / 2, 150);
    const x0 = box.x + box.width * 0.8;
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
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
  return r;
}

/** the page's scroll lock while a dialog is open (see the header) */
const y = (page: Page) => page.evaluate(() => scrollY);
const tapOrClick = async (page: Page, sel: string, touch: boolean) => {
  // a raw click at the element: page.click() scrolls the target into view itself, which would move the page
  const b = (await page.locator(sel).boundingBox())!;
  if (touch) await page.touchscreen.tap(b.x + 20, b.y + 20);
  else await page.mouse.click(b.x + 20, b.y + 20);
  await sleep(300);
};
const openDrawer = async (page: Page, touch = false) => {
  await page.locator(".cDis").scrollIntoViewIfNeeded();
  await sleep(800);
  const y0 = await y(page);
  await tapOrClick(page, ".cDis", touch);
  return y0;
};
const drag = (
  ctx: BrowserContext,
  page: Page,
  x: number,
  yy: number,
  dy: number
) =>
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

// ---------- lock, desktop 1440 x 900: wheel over the drawer and the scrim, then the scrolling keys with focus in it
async function lockDesktop(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page } = await open(browser, url);
  const y0 = await openDrawer(page);
  const dr = (await page.locator(".cDrawer").boundingBox())!;
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
  const hb = (await page.locator(".cDrawer .tr-h3").boundingBox())!;
  await page.mouse.click(hb.x + 10, hb.y + 10);
  moved = 0;
  for (const key of ["Space", "PageDown", "ArrowDown", "End"]) {
    await page.keyboard.press(key);
    await sleep(250);
    moved = Math.max(moved, Math.abs((await y(page)) - y0));
  }
  r["lock: keys in drawer"] =
    moved === 0 &&
    (await page.evaluate(
      () => !document.querySelector<HTMLElement>(".cDrawer")!.hidden
    ));
  await page.keyboard.press("Escape");
  await sleep(300);
  r["lock: drawer close restores scroll"] =
    (await y(page)) === y0 &&
    (await page.evaluate(
      () => !document.documentElement.classList.contains("scroll-lock")
    ));
  await ctx.close();
  return r;
}

// ---------- lock, a short window where the drawer's list overflows: the drawer scrolls, the page does not, even past
// its end
async function lockShortWindow(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page } = await open(browser, url, {
    viewport: { width: 1280, height: 560 },
  });
  const y0 = await openDrawer(page);
  // "See all" lists every disclosure, so the list is long enough to scroll
  if (await page.locator("[data-see-all]").count())
    await page.locator("[data-see-all]").click();
  const dr = (await page.locator(".cDrawer").boundingBox())!;
  await page.mouse.move(dr.x + dr.width / 2, 300);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 400);
    await sleep(50);
  }
  await sleep(400);
  r["lock: drawer scrolls itself, no chaining"] =
    (await page.evaluate(() => {
      const d = document.querySelector(".cDrawer")!;
      return (
        d.scrollTop > 0 &&
        d.scrollTop + d.clientHeight >= d.scrollHeight - 1 &&
        getComputedStyle(d).overscrollBehaviorY === "contain"
      );
    })) && (await y(page)) === y0;
  await ctx.close();
  return r;
}

// ---------- lock, touch tablet: drags over the drawer and the scrim
async function lockTablet(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page } = await open(browser, url, {
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });
  const y0 = await openDrawer(page, true);
  const dr = (await page.locator(".cDrawer").boundingBox())!;
  for (const x of [dr.x + dr.width / 2, dr.x / 2])
    for (let i = 0; i < 2; i++) await drag(ctx, page, x, 400, -500);
  await sleep(400);
  r["lock: touch drag over drawer + scrim"] = (await y(page)) === y0;
  await ctx.close();
  return r;
}

// ---------- lock, phone menu: touch drags and the wheel, then close
async function lockPhoneMenu(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
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
        getComputedStyle(document.getElementById("menu")!)
          .overscrollBehaviorY === "contain"
    ));
  await tapOrClick(page, "[data-menu-close]", true);
  r["lock: menu close restores scroll"] = (await y(page)) === y0;
  await ctx.close();
  return r;
}

// ---------- the volunteer guide (/volunteer/): it loads clean, reveals and loops run, the FAQ opens and closes, its own
// own nav and its scroll-spy work; and the home page links to it
async function guide(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page, errors } = await open(
    browser,
    new URL("volunteer/", url).href
  );
  r["guide: js-reveal wired"] = await until(page, () =>
    document.documentElement.classList.contains("js-reveal")
  );
  r["guide: one h1, FAQPage data"] = await page.evaluate(
    () =>
      document.querySelectorAll("h1").length === 1 &&
      [...document.querySelectorAll('script[type="application/ld+json"]')].some(
        (s) => s.textContent.includes('"FAQPage"')
      )
  );
  const q = page.locator(".vg-q").nth(1);
  await q.locator("summary").click();
  const opened = await q.evaluate((d) => (d as HTMLDetailsElement).open);
  await q.locator("summary").click();
  r["guide: FAQ opens and closes"] =
    opened && !(await q.evaluate((d) => (d as HTMLDetailsElement).open));
  r["guide: own nav links"] = await page.evaluate(
    () =>
      [...document.querySelectorAll(".site-hd [data-spy-link]")]
        .map((a) => a.getAttribute("href"))
        .join() === "#volunteer,#do,#where,#internships,#faq" &&
      document.querySelector('.site-hd a[href="/#donate"]') !== null &&
      document.querySelector(
        '.site-hd a[href^="https://dash.proudindian.ngo/register"]'
      ) !== null &&
      document.querySelector('#menu a[href="/"]') !== null
  );
  await page.evaluate(() =>
    document.querySelector("#faq")!.scrollIntoView({ behavior: "instant" })
  );
  r["guide: nav lights the section in view"] = await until(page, () =>
    document
      .querySelector('.site-hd [data-spy-link="faq"]')!
      .matches(".on, [aria-current]")
  );
  await page.evaluate(() =>
    document
      .querySelector("#internships")!
      .scrollIntoView({ block: "center", behavior: "instant" })
  );
  r["guide: sparkle loop runs in view"] = await until(
    page,
    () => !document.querySelector(".vg-kspark")!.classList.contains("is-paused")
  );
  r["guide: no console errors"] = errors.length === 0;
  if (errors.length) console.log(errors);
  await ctx.close();
  const home = await open(browser, url);
  r["home links to the guide"] = await home.page.evaluate(
    () => document.querySelectorAll('a[href="/volunteer/"]').length >= 2
  );
  await home.ctx.close();
  return r;
}

// ---------- WebMCP: with a stand-in document.modelContext, the pages register their tools and the tools work
interface FakeTool {
  name: string;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<{
    content: { text: string }[];
    isError?: boolean;
  }>;
}
declare global {
  interface Window {
    __tools: Record<string, FakeTool>;
  }
}
function fakeModelContext() {
  window.__tools = {};
  Object.defineProperty(document, "modelContext", {
    value: {
      registerTool: async (tool: FakeTool) => {
        window.__tools[tool.name] = tool;
      },
    },
  });
}
const call = (page: Page, name: string, input: Record<string, unknown> = {}) =>
  page.evaluate(
    async ([n, i]) => {
      const res = await window.__tools[n as string]!.execute(
        i as Record<string, unknown>
      );
      return { text: res.content[0]!.text, isError: !!res.isError };
    },
    [name, input] as const
  );

async function webmcp(browser: Browser, url: string) {
  const r: Record<string, boolean | string> = {};
  const { ctx, page, errors } = await open(browser, url, {}, fakeModelContext);
  const names = () => page.evaluate(() => Object.keys(window.__tools).sort());
  r["webmcp: home registers its tools"] =
    (await names()).join() ===
    "fill-donation-amount,list-volunteer-sessions,start-volunteer-sign-up";
  r["webmcp: list is read-only"] = await page.evaluate(
    () =>
      window.__tools["list-volunteer-sessions"]!.annotations?.readOnlyHint ===
      true
  );
  const list = await call(page, "list-volunteer-sessions");
  r["webmcp: list-volunteer-sessions"] = list.text.startsWith("{")
    ? (
        JSON.parse(list.text) as { sessions: { signUpUrl: string }[] }
      ).sessions.every((x) => x.signUpUrl.startsWith("https://"))
    : list.text.includes("No sessions") || list.text.includes("could not");
  r["webmcp: sign-up refuses an unknown session"] = (
    await call(page, "start-volunteer-sign-up", { sessionId: "nope" })
  ).isError;
  const low = await call(page, "fill-donation-amount", { amount: 50 });
  const ok = await call(page, "fill-donation-amount", { amount: "₹2,500" });
  r["webmcp: fill-donation-amount"] =
    low.isError &&
    !ok.isError &&
    (await until(page, () =>
      document
        .querySelector("#donate [data-donate]")!
        .textContent.includes("Donate ₹2,500")
    ));
  r["webmcp: no console errors"] = errors.length === 0;
  if (errors.length) console.log(errors);
  await ctx.close();
  const guidePage = await open(
    browser,
    new URL("volunteer/", url).href,
    {},
    fakeModelContext
  );
  r["webmcp: guide registers the session tools only"] =
    (
      await guidePage.page.evaluate(() => Object.keys(window.__tools).sort())
    ).join() === "list-volunteer-sessions,start-volunteer-sign-up";
  await guidePage.ctx.close();
  return r;
}

// the sessions share nothing (each has its own browser context), so JOBS of them run at once; the table keeps
// this order
const SESSIONS = [
  desktop,
  desktopActions,
  desktopPause,
  reducedMotion,
  phone,
  lockDesktop,
  lockShortWindow,
  lockTablet,
  lockPhoneMenu,
  guide,
  webmcp,
];
const JOBS = Number(process.env.JOBS ?? 4);
const browser = await chromium.launch();
const results: Record<string, boolean | string>[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(JOBS, SESSIONS.length) }, async () => {
    while (next < SESSIONS.length) {
      const i = next++;
      results[i] = await SESSIONS[i](browser, SITE);
    }
  })
);
await browser.close();
const s: Record<string, boolean | string> = Object.assign({}, ...results);
const skipped = (v: boolean | string) => String(v).startsWith("skipped");
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
