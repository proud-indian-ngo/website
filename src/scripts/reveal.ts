/**
 * Scroll-in reveal: one system for every section (decision 11, "Scroll-in reveal on every section").
 *
 * Markup. data-reveal="rise|slap|hang|draw|wipe" on an element. data-stagger="<step ms>" (default 75) on a parent
 * makes it one group: the [data-reveal] elements inside it play in DOM order, step ms apart, after data-base ms;
 * data-at="<ms>" pins one member to an exact delay. A group, or a lone [data-reveal] outside any group, is a trigger.
 *   rise  fade + 24px rise (data-y overrides the distance, data-tilt adds a rotation that settles)
 *   slap  the E2 sticker slap: lands from scale 1.08 tilted, presses flat with a small squish
 *   hang  a polaroid drops onto its line from -30px and settles into the sway (composited on top of the CSS sway)
 *   draw  stroke-dashoffset draw-on for every stroked <path>; data-lr staggers top-level groups left to right. On slow
 *         devices (html.lite-draw, lite.ts) a compositor-only left-to-right clip-path wipe instead
 *   wipe  a slanted clip-path wipe, left to right, for big headline words (one block, never per letter)
 * Transforms move the individual translate/rotate/scale properties, which stack on each element's own `transform`
 * (its rotation, its CSS sway, a hover transition), so the motion is the same as adding to the transform but Chrome can
 * run it on the compositor. (A `transform` animation with composite:"add" always runs on the main thread, and it also
 * pinned the sway it was added to onto the main thread for good.) SVG elements, which can't composite those
 * properties, animate `transform` from their own resting transform instead.
 *
 * What. Only each section's headline group (eyebrow, headline, lede, an accent doodle: at most about 4 items, 60-80ms
 * apart) reveals. Body copy, stats, cards, photos, forms and list rows are simply there.
 *
 * When. A trigger plays once, when its top passes 90% of the viewport (IntersectionObserver rootMargin -10%, plus a
 * scroll/resize sweep). Triggers already scrolled past (fast scroll) are shown at rest without animating; at the very
 * bottom of the page whatever is left in view plays. An in-page link that jumps more than 1.5 viewports (menu, header,
 * sticky bar, footer) scrolls instantly instead of smoothly, and every trigger it passes or lands on is shown at rest
 * first, so the target never arrives blank (initJumps). Shorter hops stay smooth and reveal as usual. The data-load triggers (header and hero)
 * are played by CSS from the first paint (styles/sections/load-motion.css); here they are only marked as played.
 *
 * Hiding. Only html.js-reveal[data-motion=on] [data-reveal]:not(.rv-in) is hidden, and js-reveal is set here once
 * everything is wired. No JS, Pause or reduced motion: everything is simply there; Pause flushes anything pending.
 */
import { motion } from "@proudindian/design/tokens";

import { $$, A, D, EASE, isCss, on, rest } from "./dom";
import { lite } from "./lite";

const R = motion.reveal;

const fade = (el: Element, o: KeyframeAnimationOptions) =>
  A(el, [{ opacity: 0, offset: 0 }], o); // implicit end: resting opacity

/**
 * Lite draw-on (html.lite-draw, slow devices; see lite.ts): the same reveal as a left-to-right clip-path wipe of the
 * whole drawing, which Chrome runs on the compositor. The insets reach 50% past the box so strokes that overflow it
 * are never cut; once it ends, nothing is clipped. Street scenes (data-lr) wipe across in the time their groups took
 * to draw left to right.
 */
function wipeDraw(svg: SVGSVGElement, delay: number) {
  const lr = svg.hasAttribute("data-lr");
  fade(svg, { duration: lr ? 320 : 260, delay });
  A(
    svg,
    [
      { clipPath: "inset(-50% 150% -50% -50%)" },
      { clipPath: "inset(-50% -50% -50% -50%)" },
    ],
    { duration: lr ? 1160 : R.draw, delay, easing: lr ? EASE.glide : EASE.draw }
  );
}

function draw(svg: SVGSVGElement, delay: number) {
  if (lite()) return wipeDraw(svg, delay);
  const lr = svg.hasAttribute("data-lr");
  const vb = svg.viewBox?.baseVal;
  const W = vb?.width || 1;
  if (!lr) fade(svg, { duration: 260, delay });
  const groups: Element[] = lr
    ? [...svg.children].filter((g) => g.tagName === "g")
    : [svg];
  for (const g of groups) {
    let dl = delay;
    if (lr && vb) {
      dl +=
        Math.min(
          1,
          Math.max(0, ((g as SVGGraphicsElement).getBBox().x - vb.x) / W)
        ) * 600;
      fade(g, { duration: 320, delay: dl });
    }
    $$<SVGPathElement>("path", g)
      .filter((p) => {
        const cs = getComputedStyle(p);
        return cs.stroke !== "none" && cs.strokeDasharray === "none";
      })
      .forEach((p, i) => {
        const had = p.hasAttribute("pathLength");
        if (!had) p.setAttribute("pathLength", "1");
        const a = A(
          p,
          [
            { strokeDasharray: "1 1", strokeDashoffset: 1 },
            { strokeDasharray: "1 1", strokeDashoffset: 0 },
          ],
          {
            duration: lr ? 560 : R.draw,
            delay: dl + Math.min(i, 5) * (lr ? 40 : 80),
            easing: EASE.draw,
          }
        );
        const done = () => {
          if (!had) p.removeAttribute("pathLength");
        };
        if (a) a.onfinish = a.oncancel = done;
        else done();
      });
  }
}

/** One transform step of a reveal: a translation (px), a uniform scale and a rotation (deg), at a keyframe offset. */
interface Move {
  offset?: number;
  x?: number;
  y?: number;
  s?: number;
  r?: number;
}

/**
 * Animate the element's transform through `moves` and back to rest (the implicit last keyframe). HTML elements use
 * the individual transform properties (compositor, stacked on the element's own transform); SVG elements use
 * `transform` starting from their resting transform, or composite:"add" if a CSS animation already drives it.
 */
function move(el: Element, moves: Move[], o: KeyframeAnimationOptions) {
  if (!(el instanceof SVGElement))
    return A(
      el,
      moves.map((m) => ({
        offset: m.offset ?? 0,
        translate: `${m.x ?? 0}px ${m.y ?? 0}px`,
        scale: `${m.s ?? 1}`,
        rotate: `${m.r ?? 0}deg`,
      })),
      o
    );
  const fn = (m: Move) =>
    `translate(${m.x ?? 0}px,${m.y ?? 0}px) scale(${m.s ?? 1}) rotate(${m.r ?? 0}deg)`;
  if (el.getAnimations().some(isCss))
    return A(
      el,
      [
        ...moves.map((m) => ({ offset: m.offset ?? 0, transform: fn(m) })),
        { transform: "none" },
      ],
      { composite: "add", ...o }
    );
  const r = rest(el);
  const t = r === "none" ? "" : `${r} `;
  return A(
    el,
    [
      ...moves.map((m) => ({ offset: m.offset ?? 0, transform: t + fn(m) })),
      { transform: t + fn({}) },
    ],
    o
  );
}

function play(el: HTMLElement, kind: string, delay: number) {
  const d = el.dataset;
  if (kind === "rise") {
    const y = +(d.y || R.riseDistance);
    const r = +(d.tilt || 0);
    move(
      el,
      r
        ? [
            { y, r },
            { offset: 0.7, r: -r / 4 },
          ]
        : [{ y }],
      {
        delay,
        duration: r ? R.riseTilt : R.rise,
      }
    );
    fade(el, { duration: R.riseFade, delay });
  } else if (kind === "slap") {
    move(
      el,
      [
        { x: -6, y: -16, s: 1.08, r: -5 },
        { offset: 0.68, s: 0.975 },
      ],
      {
        delay,
        duration: R.slap,
        easing: EASE.overshoot,
      }
    );
    fade(el, { duration: 160, delay, easing: "linear" });
  } else if (kind === "hang") {
    move(
      el,
      [
        { y: -30, r: -5 },
        { offset: 0.62, y: 3, r: 1.5 },
      ],
      {
        delay,
        duration: R.hang,
        easing: EASE.overshoot,
      }
    );
    fade(el, { duration: 220, delay });
  } else if (kind === "wipe") {
    // the wipe runs across the words themselves, not the (often much wider, centred) block box
    const box = el.getBoundingClientRect();
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const txt = rg.getBoundingClientRect();
    const l = txt.left - box.left - 12;
    const rt = txt.right - box.left + 24;
    const k = box.height * 0.12;
    const poly = (x: number) =>
      `polygon(${l}px -40%,${x}px -40%,${x - k}px 140%,${l - k}px 140%)`;
    A(el, [{ clipPath: poly(l) }, { clipPath: poly(rt + k) }], {
      duration: R.wipe,
      delay,
      easing: EASE.wipe,
    });
    move(el, [{ x: -14 }], { delay, duration: 620 });
  } else if (kind === "draw") draw(el as unknown as SVGSVGElement, delay);
}

/** after-effects a group can ask for with data-then */
const THEN: Record<string, (g: Element) => void> = {};
export const onGroupThen = (name: string, fn: (g: Element) => void) => {
  THEN[name] = fn;
};

const group = (el: Element) =>
  el.parentElement?.closest("[data-stagger]") ?? null;
let triggers: HTMLElement[] = [];
const pending = new Set<HTMLElement>();
let io: IntersectionObserver;

const members = (t: HTMLElement) =>
  t.hasAttribute("data-stagger")
    ? $$("[data-reveal]", t).filter(
        (el) => !el.hasAttribute("data-stagger") && group(el) === t
      )
    : [t];

function fire(t: HTMLElement, still = false) {
  if (!pending.delete(t)) return;
  io.unobserve(t);
  t.classList.add("rv-in"); // a group trigger too, for CSS that waits on the whole group (the bento ring)
  const step = +(t.dataset.stagger || R.stagger);
  const base = +(t.dataset.base || 0);
  const go = !still && on();
  let i = 0;
  for (const el of members(t)) {
    el.classList.add("rv-in");
    if (go && el.getClientRects().length)
      play(
        el,
        el.dataset.reveal!,
        el.dataset.at != null ? +el.dataset.at : base + step * i++
      );
  }
  if (go && t.dataset.then && THEN[t.dataset.then]) THEN[t.dataset.then]!(t);
}

/** show everything still pending, at rest (Pause, reduced motion) */
export const flushReveals = () => [...pending].forEach((t) => fire(t, true));

export function sweep() {
  if (!pending.size) return;
  const H = innerHeight;
  const end = scrollY + H >= D.scrollHeight - 4;
  const rs = [...pending].map((t) => [t, t.getBoundingClientRect()] as const);
  for (const [t, r] of rs) {
    if (!r.width && !r.height) continue; // not rendered at this breakpoint; it waits
    if (r.bottom <= 0) fire(t, true); // already scrolled past: show it at rest
    else if (r.top < H * 0.9 || (end && r.top < H)) fire(t);
  }
}

export function initReveal() {
  triggers = $$("[data-stagger],[data-reveal]").filter(
    (el) => el.hasAttribute("data-stagger") || !group(el)
  );
  for (const t of triggers) pending.add(t);
  io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => e.isIntersecting && fire(e.target as HTMLElement)),
    {
      rootMargin: "0px 0px -10% 0px",
    }
  );
  pending.forEach((t) => io.observe(t));
  D.classList.add("js-reveal");
  initJumps();
}

/** a jump longer than this many viewports scrolls instantly, with everything on the way shown at rest */
const JUMP = 1.5;
let restoreT = 0;

/**
 * Long in-page jumps. html has scroll-behavior: smooth (base.css), so a tap on "Donate" at the top of a phone spent
 * ~2s gliding past every section, and the target's headline was still waiting to reveal when it arrived. For a jump
 * of more than JUMP viewports: every pending trigger between here and the target's viewport is shown at rest, then
 * the browser's own fragment navigation runs with scroll-behavior switched to auto for that one scroll. Letting the
 * native navigation do the scroll keeps everything else native: the hash and history entry, :target, hashchange, the
 * focus navigation starting point, scroll-padding-top and scroll-margin. Runs after the link's own handlers (the phone
 * menu closes and unlocks the page first) and leaves anything they cancelled alone.
 */
function initJumps() {
  document.addEventListener("click", (e) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      !on()
    )
      return;
    const a =
      e.target instanceof Element
        ? e.target.closest<HTMLAnchorElement>("a[href]")
        : null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download"))
      return;
    const u = new URL(a.href, location.href);
    if (
      !u.hash ||
      u.origin !== location.origin ||
      u.pathname !== location.pathname ||
      u.search !== location.search
    )
      return;
    const el = document.getElementById(decodeURIComponent(u.hash.slice(1)));
    if (!el) return;
    const H = innerHeight;
    const y = scrollY;
    const pad = parseFloat(getComputedStyle(D).scrollPaddingTop) || 0;
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const to = Math.min(
      D.scrollHeight - H,
      Math.max(0, y + el.getBoundingClientRect().top - pad - margin)
    );
    if (Math.abs(to - y) <= H * JUMP) return;
    const lo = Math.min(y, to);
    const hi = Math.max(y, to) + H;
    const rs = [...pending].map((t) => [t, t.getBoundingClientRect()] as const);
    for (const [t, r] of rs) {
      if (!r.width && !r.height) continue; // not rendered at this breakpoint
      if (r.top + y < hi && r.bottom + y > lo) fire(t, true);
    }
    // the fragment navigation is the click's default action, right after this; put smooth back once it has scrolled
    D.style.scrollBehavior = "auto";
    clearTimeout(restoreT);
    restoreT = window.setTimeout(
      () => requestAnimationFrame(() => (D.style.scrollBehavior = "")),
      60
    );
  });
}

/**
 * Header and hero: their load sequence is CSS, from the first paint (styles/sections/load-motion.css). Mark them as
 * played, and once those CSS animations are over set html.ld-done, which retires them so Resume can't replay them.
 */
export function fireLoadTriggers() {
  triggers
    .filter((t) => t.hasAttribute("data-load"))
    .forEach((t) => fire(t, true));
  const load = document
    .getAnimations()
    .filter(
      (a) => a instanceof CSSAnimation && a.animationName.startsWith("ld-")
    );
  Promise.all(load.map((a) => a.finished.catch(() => {}))).then(() =>
    D.classList.add("ld-done")
  );
}
