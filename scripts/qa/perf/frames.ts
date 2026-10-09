/**
 * Frame profiler: Playwright's Chromium (new headless), CPU throttled through CDP (Emulation.setCPUThrottlingRate),
 * one performance trace per scenario: the hero load sequence, the paper plane (approach, then the 2s flight), a slow
 * wheel scroll through the whole page (every reveal), idle on each section with its ambient loop, hover/tap wobble on
 * every sticker, the coin drop, the phone menu and the reports drawer. Layer counts at the top and middle of the page.
 *
 * A frame is "bad" the way Chrome's own smoothness metric counts a dropped frame (cc PipelineReporter: DROPPED, or
 * PARTIAL with affects_smoothness, deduped per BeginFrame); that is the share of frames that took over 16.7ms. A long
 * task is a main-thread task over 50ms; "anim" counts the long tasks that overlap a frame with an animation to produce.
 *
 *   const results = await runFrames(url, { rates: [4, 6], widths: [390, 1440] }); console.log(table(results));
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { chromium } from "playwright";
import type { Browser, CDPSession, Page } from "playwright";

let URL_ = "";
let OUT = "/tmp/pi-perf-qa";
let KEEP = false;
let ONLY: string[] | null = null;

/** cc PipelineReporter's frame args (the fields read here). */
interface FrameReporter {
  state: string;
  frame_source?: number;
  frame_sequence?: number;
  affects_smoothness?: boolean;
  has_main_animation?: boolean;
  has_compositor_animation?: boolean;
}

/** One Chrome trace event (the fields read here). */
interface TraceEvent {
  name: string;
  ph: string;
  pid: number;
  tid: number;
  ts: number;
  dur?: number;
  args?: {
    name?: string;
    frame_reporter?: FrameReporter;
    chrome_frame_reporter?: FrameReporter;
    data?: {
      name?: string;
      displayName?: string;
      compositeFailed?: number;
      unsupportedProperties?: string[];
    };
  };
}

/** A complete ("X") event: it always carries a duration. */
type CompleteEvent = TraceEvent & { dur: number };

export interface FrameStats {
  expected: number;
  bad: number;
  mainAnim: number;
  dropped: number;
  badPct: number;
  states?: Record<string, number>;
}

export interface MainStats {
  busyPct?: number;
  style: number;
  layout: number;
  paint: number;
  commit: number;
  script: number;
  mainFrames: number;
  tasksOver16: number;
  longTasks: number;
  longDuringAnim: number;
  maxTask: number;
}

/** One traced scenario (or several merged). */
export interface TraceStats {
  secs: number;
  frames: FrameStats;
  main: MainStats;
  rasterMs: number;
  nonComposited: Record<string, number>;
}

export type IdleStats = TraceStats & { running: string[] };

/** A LayerTree layer (the fields read here). */
interface LayerLite {
  layerId: string;
  drawsContent: boolean;
  width: number;
  height: number;
}

export interface LayerSnap {
  total: number;
  drawing: number;
  areaMpx: number;
  reasons: Record<string, number>;
}

/** Everything measured at one width and throttling rate. */
export interface ConfigResult {
  load?: TraceStats | null;
  planeIn?: TraceStats | null;
  plane?: TraceStats | null;
  scroll?: TraceStats | null;
  idle?: Record<string, IdleStats>;
  wobble?: (TraceStats & { count?: number }) | null;
  coins?: TraceStats | null;
  menu?: TraceStats | null;
  drawer?: TraceStats | null;
  layersTop?: LayerSnap | null;
  layersMid?: LayerSnap | null;
}

const CATS = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "blink.animations",
  "blink.user_timing",
  "benchmark",
];

// ---------- trace analysis ----------
function analyse(events: TraceEvent[]): TraceStats | null {
  const tn: Record<string, string | undefined> = {};
  for (const e of events)
    if (e.ph === "M" && e.name === "thread_name")
      tn[`${e.pid}:${e.tid}`] = e.args!.name;
  // the page's renderer main thread: the CrRendererMain with the most RunTask time
  const busy: Record<string, number> = {};
  for (const e of events)
    if (
      e.name === "RunTask" &&
      e.ph === "X" &&
      tn[`${e.pid}:${e.tid}`] === "CrRendererMain"
    )
      busy[`${e.pid}:${e.tid}`] =
        (busy[`${e.pid}:${e.tid}`] || 0) + (e.dur || 0);
  const main = Object.entries(busy).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!main) return null;
  const [pid, tid] = main.split(":").map(Number) as [number, number];
  const ts = events.filter((e) => e.ts && e.pid === pid).map((e) => e.ts);
  let t0 = Infinity,
    t1 = -Infinity;
  for (const t of ts) {
    if (t < t0) t0 = t;
    if (t > t1) t1 = t;
  }
  const secs = (t1 - t0) / 1e6;

  // frames (cc PipelineReporter). One BeginFrame can be reported twice (a pipelined main-thread update shows up as
  // ALL + PARTIAL for the same sequence), so dedupe by (source, sequence). A frame is "bad" (dropped / over 16.7ms) the
  // way Chrome's smoothness metric counts it: DROPPED or PARTIAL with affects_smoothness.
  const seqs = new Map<
    string,
    { states: string[]; bad: boolean; main: boolean; anim?: number }
  >();
  for (const e of events)
    if (e.name === "PipelineReporter" && e.ph === "b" && e.pid === pid) {
      const a = (e.args?.frame_reporter ||
        e.args?.chrome_frame_reporter ||
        {}) as FrameReporter;
      const k = `${a.frame_source}:${a.frame_sequence}`;
      const s = seqs.get(k) || { states: [], bad: false, main: false };
      s.states.push(a.state);
      if (
        a.affects_smoothness &&
        (a.state === "STATE_DROPPED" || a.state === "STATE_PRESENTED_PARTIAL")
      )
        s.bad = true;
      if (a.has_main_animation) s.main = true;
      if (a.has_main_animation || a.has_compositor_animation) s.anim = e.ts;
      seqs.set(k, s);
    }
  const st: Record<string, number> = {};
  let expected = 0,
    badN = 0,
    mainAnimFrames = 0,
    rawDropped = 0;
  for (const s of seqs.values()) {
    for (const x of s.states) st[x] = (st[x] || 0) + 1;
    if (s.states.every((x) => x === "STATE_NO_UPDATE_DESIRED")) continue;
    expected++;
    if (s.bad) badN++;
    if (s.main) mainAnimFrames++;
    if (
      s.states.includes("STATE_DROPPED") &&
      !s.states.some((x) => x.startsWith("STATE_PRESENTED"))
    )
      rawDropped++;
  }
  const dropped = rawDropped;
  // main thread work
  const mt = events.filter(
    (e) => e.pid === pid && e.tid === tid && e.ph === "X"
  ) as CompleteEvent[];
  const sum = (names: string[]) =>
    mt
      .filter((e) => names.includes(e.name))
      .reduce((a, e) => a + (e.dur || 0), 0) / 1000;
  const tasks = mt.filter((e) => e.name === "RunTask");
  const long = tasks.filter((e) => e.dur > 50e3);
  const over = tasks.filter((e) => e.dur > 16.7e3);
  // a long task "during animation" starts while an animation is already running (an animated frame in the 50ms before
  // it) and overlaps another animated frame; the task that produces the very first frames doesn't count
  const animTs = [...seqs.values()].filter((s) => s.anim).map((s) => s.anim!);
  const longDuringAnim = long.filter(
    (t) =>
      animTs.some((ts) => ts < t.ts && ts >= t.ts - 50e3) &&
      animTs.some((ts) => ts >= t.ts && ts <= t.ts + t.dur)
  );
  const mainFrames = events.filter(
    (e) =>
      e.pid === pid &&
      e.tid === tid &&
      (e.name === "BeginMainThreadFrame" ||
        (e.name === "BeginFrame" && e.ph !== "X"))
  ).length;
  const raster =
    (
      events.filter(
        (e) => e.pid === pid && e.ph === "X" && e.name === "RasterTask"
      ) as CompleteEvent[]
    ).reduce((a, e) => a + e.dur, 0) / 1000;

  // animations Blink could not composite
  const anims: Record<string, number> = {};
  for (const e of events) {
    if (e.name !== "Animation" || e.pid !== pid) continue;
    const d = e.args?.data || {};
    if (d.compositeFailed || d.unsupportedProperties) {
      const k = `${d.name || d.displayName || "?"} [${(d.unsupportedProperties || []).join(",")}] fail=${d.compositeFailed}`;
      anims[k] = (anims[k] || 0) + 1;
    }
  }
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    secs: r1(secs),
    frames: {
      expected,
      bad: badN,
      mainAnim: mainAnimFrames,
      dropped,
      badPct: expected ? r1((badN / expected) * 100) : 0,
      states: st,
    },
    main: {
      busyPct: r1((sum(["RunTask"]) / 1000 / secs) * 100),
      style: r1(sum(["UpdateLayoutTree", "RecalculateStyles"])),
      layout: r1(sum(["Layout"])),
      paint: r1(sum(["Paint", "PrePaint", "Layerize", "PaintImage"])),
      commit: r1(sum(["Commit", "UpdateLayer", "CompositeLayers"])),
      script: r1(sum(["FunctionCall", "EvaluateScript", "v8.compile"])),
      mainFrames,
      tasksOver16: over.length,
      longTasks: long.length,
      longDuringAnim: longDuringAnim.length,
      maxTask: r1(tasks.reduce((a, e) => Math.max(a, e.dur), 0) / 1000),
    },
    rasterMs: r1(raster),
    nonComposited: anims,
  };
}

// ---------- scenarios ----------
async function trace(
  cdp: CDPSession,
  fn: () => Promise<unknown>,
  name: string,
  label: string
) {
  const events: TraceEvent[] = [];
  // the protocol types trace events as string maps; they are JSON objects
  const onData = (e: { value: object[] }) =>
    events.push(...(e.value as TraceEvent[]));
  cdp.on("Tracing.dataCollected", onData);
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", {
    traceConfig: { includedCategories: CATS },
    transferMode: "ReportEvents",
  });
  await fn();
  await cdp.send("Tracing.end");
  await done;
  cdp.off("Tracing.dataCollected", onData);
  if (KEEP)
    writeFileSync(
      `${OUT}/traces/${label}-${name}.json`,
      JSON.stringify({ traceEvents: events })
    );
  return analyse(events);
}

const sleep = (p: Page, ms: number) => p.waitForTimeout(ms);
const jump = (p: Page, y: number) =>
  p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
const jumpTo = (p: Page, sel: string) =>
  p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    window.scrollTo({
      top:
        scrollY + r.top - innerHeight / 2 + Math.min(r.height, innerHeight) / 2,
      behavior: "instant",
    });
    return true;
  }, sel);

async function runConfig(
  browser: Browser,
  width: number,
  rate: number
): Promise<ConfigResult> {
  const mobile = width < 700;
  const ctx = await browser.newContext({
    viewport: { width, height: mobile ? 844 : 900 },
    deviceScaleFactor: mobile ? 2 : 1,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const label = `w${width}-x${rate}`;
  const res: ConfigResult = {};
  const want = (k: string) => !ONLY || ONLY.includes(k);
  const fresh = async () => {
    await page.goto("about:blank");
    await page.goto(URL_, { waitUntil: "load" });
    await sleep(page, 2500);
  };

  // 1. hero load sequence (navigation inside the trace)
  if (want("load")) {
    await page.goto("about:blank");
    res.load = await trace(
      cdp,
      async () => {
        await page.goto(URL_, { waitUntil: "load" });
        await sleep(page, 2500);
      },
      "load",
      label
    );
  } else await fresh();

  // 2. paper plane (one-shot on first view: same fresh page, jump straight to it)
  if (want("plane")) {
    await jumpTo(page, "[data-plane-stage]");
    // approach: the jump plus the copy column's reveal; the plane waits for it, then flies 2s (traced separately)
    const flying = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-plane-stage] .plane")].some((p) =>
          p
            .getAnimations()
            .some(
              (a) =>
                a.playState === "running" &&
                a.effect!.getTiming().duration === 2000
            )
        )
      );
    res.planeIn = await trace(
      cdp,
      async () => {
        for (let i = 0; i < 60 && !(await flying()); i++) await sleep(page, 80);
      },
      "planeIn",
      label
    );
    res.plane = await trace(cdp, () => sleep(page, 2300), "plane", label);
  }

  // 3. slow scroll through the whole page (fresh, so every reveal fires)
  if (want("scroll")) {
    await fresh();
    await page.mouse.move(width / 2, 400);
    res.scroll = await trace(
      cdp,
      async () => {
        for (;;) {
          const atEnd = await page.evaluate(
            () =>
              scrollY + innerHeight >= document.documentElement.scrollHeight - 2
          );
          if (atEnd) break;
          await page.mouse.wheel(0, 120);
          await sleep(page, 110);
        }
        await sleep(page, 800);
      },
      "scroll",
      label
    );
  }

  // 4. idle with ambient loops, per section (everything already revealed by the scroll)
  if (want("idle")) {
    const secs = await page.evaluate(() =>
      [...document.querySelectorAll("main section, footer")]
        .filter(
          (s) =>
            s.getBoundingClientRect().height > 200 &&
            !s.parentElement!.closest("section")
        )
        .map((s, i) => {
          (s as HTMLElement).dataset.perfIdx = String(i);
          return {
            i,
            id: s.id || s.className.split(" ").slice(0, 2).join("."),
          };
        })
    );
    res.idle = {};
    for (const s of secs) {
      await page.evaluate((i: number) => {
        const el = document.querySelector(`[data-perf-idx="${i}"]`);
        window.scrollTo({
          top: scrollY + el!.getBoundingClientRect().top,
          behavior: "instant",
        });
      }, s.i);
      await sleep(page, 1500);
      // Chrome reports every frame of a compositor animation as dropped while its element straddles the bottom edge
      // of the viewport, though the screen updates at full rate (a screencast shows it). With the section's top at
      // the top of a phone screen, the volunteer clock and the donate pot sit right there: scroll them fully in view.
      // An animated SVG child moves with its whole <svg>, so that is the box to check; one taller than the screen
      // (the plane's overlay) can't fit and is left alone.
      const nudged = await page.evaluate(() => {
        let over = 0;
        for (const a of document.getAnimations()) {
          const t = (a.effect as KeyframeEffect | null)?.target;
          if (a.playState !== "running" || !t) continue;
          const box =
            t instanceof SVGElement && !(t instanceof SVGSVGElement)
              ? (t.ownerSVGElement ?? t)
              : t;
          const q = box.getBoundingClientRect();
          if (
            q.height < innerHeight &&
            q.top < innerHeight &&
            q.bottom > innerHeight
          )
            over = Math.max(over, q.bottom - innerHeight + 8);
        }
        if (over) scrollBy({ top: over, behavior: "instant" });
        return Math.round(over);
      });
      if (nudged) await sleep(page, 300);
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === "running" &&
              !(a.effect as KeyframeEffect | null)?.target?.closest?.(
                ".is-paused"
              )
          )
          .map((a) => {
            const effect = a.effect as KeyframeEffect;
            const t = effect.target!;
            const kf = effect.getKeyframes();
            const props = [
              ...new Set(
                kf.flatMap((k) =>
                  Object.keys(k).filter(
                    (x) =>
                      ![
                        "offset",
                        "easing",
                        "composite",
                        "computedOffset",
                      ].includes(x)
                  )
                )
              ),
            ];
            return `${(a as CSSAnimation).animationName || "WAAPI"}:${t.tagName.toLowerCase()}${t.classList.length ? "." + [...t.classList].slice(0, 2).join(".") : ""}(${props.join(",")})${t instanceof SVGElement && t.tagName !== "svg" ? " [svg-child]" : ""}`;
          })
      );
      const r = await trace(
        cdp,
        () => sleep(page, 3000),
        `idle-${s.id}`,
        label
      );
      // a scenario without a trace keeps only `running`; table() and the gates skip it
      res.idle[s.id || s.i] = { ...r, running } as IdleStats;
    }
  }

  // 5. hover wobble (desktop pointers hover; phones tap)
  if (want("wobble")) {
    const n = await page.evaluate(
      () =>
        [...document.querySelectorAll(".wob")]
          .filter(
            (w) =>
              w.getClientRects().length &&
              getComputedStyle(w).visibility !== "hidden"
          )
          .map((w, i) => ((w as HTMLElement).dataset.perfWob = String(i)))
          .length
    );
    const agg: (TraceStats | null)[] = [];
    for (let i = 0; i < n; i++) {
      await jumpTo(page, `[data-perf-wob="${i}"]`);
      await page.mouse.move(2, 2);
      await sleep(page, 700);
      const box = await page.locator(`[data-perf-wob="${i}"]`).boundingBox();
      if (!box) continue;
      agg.push(
        await trace(
          cdp,
          async () => {
            if (mobile)
              await page.mouse.click(
                box.x + box.width / 2,
                box.y + box.height / 2
              );
            else
              await page.mouse.move(
                box.x + box.width / 2,
                box.y + box.height / 2,
                { steps: 4 }
              );
            await sleep(page, 700);
          },
          `wobble-${i}`,
          label
        )
      );
    }
    res.wobble = merge(agg);
    res.wobble!.count = agg.length;
  }

  // 6. coin drop: pick each preset amount
  if (want("coins")) {
    await jumpTo(page, ".matka");
    await sleep(page, 1200);
    const amts = await page.locator("button[data-amt]").count();
    const agg: (TraceStats | null)[] = [];
    for (let i = 0; i < amts; i++) {
      const b = page.locator("button[data-amt]").nth(i);
      if (!(await b.isVisible())) continue;
      agg.push(
        await trace(
          cdp,
          async () => {
            await b.click();
            await sleep(page, 1500);
          },
          `coins-${i}`,
          label
        )
      );
    }
    res.coins = merge(agg);
  }

  // 7. phone menu
  if (want("menu") && width < 1180) {
    await jump(page, 0);
    await sleep(page, 800);
    res.menu = await trace(
      cdp,
      async () => {
        await page.click("[data-menu-open]");
        await sleep(page, 900);
        await page.keyboard.press("Escape");
        await sleep(page, 600);
      },
      "menu",
      label
    );
  }

  // 8. reports drawer
  if (want("drawer")) {
    await jumpTo(page, '[data-open="ann"]');
    await sleep(page, 1200);
    res.drawer = await trace(
      cdp,
      async () => {
        await page.click('[data-open="ann"]');
        await sleep(page, 900);
        await page.keyboard.press("Escape");
        await sleep(page, 600);
      },
      "drawer",
      label
    );
  }

  // layers at the top of the page and mid-page
  await cdp.send("LayerTree.enable");
  const layerSnap = async () => {
    let layers: LayerLite[] | null = null as LayerLite[] | null;
    const h = (e: { layers?: LayerLite[] }) => {
      if (e.layers) layers = e.layers;
    };
    cdp.on("LayerTree.layerTreeDidChange", h);
    await page.evaluate(() => window.scrollBy(0, 1));
    await sleep(page, 600);
    cdp.off("LayerTree.layerTreeDidChange", h);
    if (!layers) return null;
    const drawn = layers.filter((l) => l.drawsContent);
    const reasons: Record<string, number> = {};
    for (const l of drawn.slice(0, 200)) {
      try {
        const r = await cdp.send("LayerTree.compositingReasons", {
          layerId: l.layerId,
        });
        for (const x of r.compositingReasonIds || r.compositingReasons || [])
          reasons[x] = (reasons[x] || 0) + 1;
      } catch {}
    }
    return {
      total: layers.length,
      drawing: drawn.length,
      areaMpx:
        Math.round(drawn.reduce((a, l) => a + l.width * l.height, 0) / 1e4) /
        100,
      reasons,
    };
  };
  await jump(page, 0);
  res.layersTop = await layerSnap();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight / 2)
  );
  res.layersMid = await layerSnap();
  await ctx.close();
  return res;
}

type FrameCount = "expected" | "bad" | "mainAnim" | "dropped";

function merge(list: (TraceStats | null)[]): TraceStats | null {
  const ok = list.filter(Boolean) as TraceStats[];
  if (!ok.length) return null;
  const f: Pick<FrameStats, FrameCount> & { badPct?: number } = {
    expected: 0,
    bad: 0,
    mainAnim: 0,
    dropped: 0,
  };
  const m: MainStats = {
    style: 0,
    layout: 0,
    paint: 0,
    commit: 0,
    script: 0,
    tasksOver16: 0,
    longTasks: 0,
    longDuringAnim: 0,
    maxTask: 0,
    mainFrames: 0,
  };
  const nc: Record<string, number> = {};
  let secs = 0,
    raster = 0;
  for (const r of ok) {
    secs += r.secs;
    raster += r.rasterMs;
    for (const k in f) {
      const key = k as FrameCount;
      f[key] += r.frames[key];
    }
    for (const k in m) {
      const key = k as Exclude<keyof MainStats, "busyPct">;
      m[key] =
        k === "maxTask" ? Math.max(m[key], r.main[key]) : m[key] + r.main[key];
    }
    for (const [k, v] of Object.entries(r.nonComposited))
      nc[k] = (nc[k] || 0) + v;
  }
  f.badPct = f.expected ? Math.round((f.bad / f.expected) * 1000) / 10 : 0;
  for (const k of ["style", "layout", "paint", "commit", "script"] as const)
    m[k] = Math.round(m[k] * 10) / 10;
  return {
    secs: Math.round(secs * 10) / 10,
    frames: f as FrameStats,
    main: m,
    rasterMs: Math.round(raster),
    nonComposited: nc,
  };
}

// ---------- run ----------
export async function runFrames(
  url: string,
  {
    rates = [4, 6],
    widths = [390, 1440],
    only = null,
    out = OUT,
    keepTraces = false,
  }: {
    rates?: number[];
    widths?: number[];
    only?: string[] | null;
    out?: string;
    keepTraces?: boolean;
  } = {}
): Promise<Record<string, ConfigResult>> {
  URL_ = url;
  OUT = out;
  KEEP = keepTraces;
  ONLY = only;
  mkdirSync(`${OUT}/traces`, { recursive: true });
  const browser = await chromium.launch({ channel: "chromium" });
  const all: Record<string, ConfigResult> = {};
  try {
    for (const w of widths)
      for (const r of rates) {
        const label = `w${w}-x${r}`;
        process.stderr.write(`frames: ${label}\n`);
        all[label] = await runConfig(browser, w, r);
        writeFileSync(`${OUT}/frames.json`, JSON.stringify(all, null, 1));
      }
  } finally {
    await browser.close();
  }
  return all;
}

// ---------- report ----------
export function table(all: Record<string, ConfigResult>) {
  const row = (name: string, r: TraceStats | null | undefined) =>
    r
      ? `${name.padEnd(26)} ${String(r.frames.expected).padStart(5)} ${String(r.frames.bad).padStart(5)} ${String(r.frames.mainAnim).padStart(5)} ${String(r.frames.badPct + "%").padStart(7)} | ${String(r.main.mainFrames).padStart(5)} ${String(r.main.style).padStart(7)} ${String(r.main.layout).padStart(7)} ${String(r.main.paint).padStart(7)} ${String(r.main.script).padStart(7)} ${String(r.rasterMs).padStart(6)} | ${String(r.main.tasksOver16).padStart(4)} ${String(r.main.longTasks).padStart(4)} ${String(r.main.longDuringAnim).padStart(4)} ${String(r.main.maxTask).padStart(6)}`
      : `${name.padEnd(26)} n/a`;
  const lines = [];
  for (const [label, res] of Object.entries(all)) {
    lines.push(`\n== ${label} ==`);
    lines.push(
      `${"scenario".padEnd(26)} ${"exp".padStart(5)} ${"bad".padStart(5)} ${"mAnim".padStart(5)} ${"bad%".padStart(7)} | ${"mFrm".padStart(5)} ${"style".padStart(7)} ${"layout".padStart(7)} ${"paint".padStart(7)} ${"script".padStart(7)} ${"raster".padStart(6)} | ${">16".padStart(4)} ${">50".padStart(4)} ${"anim".padStart(4)} ${"max".padStart(6)}`
    );
    for (const k of [
      "load",
      "planeIn",
      "plane",
      "scroll",
      "wobble",
      "coins",
      "menu",
      "drawer",
    ] as const)
      if (res[k] !== undefined) lines.push(row(k, res[k]));
    for (const [s, r] of Object.entries(res.idle || {}))
      lines.push(row(`idle:${s}`.slice(0, 26), r));
    lines.push(
      `layers top: ${JSON.stringify(res.layersTop && { total: res.layersTop.total, drawing: res.layersTop.drawing, areaMpx: res.layersTop.areaMpx })}  mid: ${JSON.stringify(res.layersMid && { total: res.layersMid.total, drawing: res.layersMid.drawing, areaMpx: res.layersMid.areaMpx })}`
    );
  }
  return lines.join("\n");
}
