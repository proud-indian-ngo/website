/**
 * Writes src/styles/sections/load-motion.css: the header and hero load sequence (pills drop in, "Be an"
 * rises, "Optimist." wipes, the kids slap on, the seal stamps last, the lede, calls to action and marquee rise, the
 * spark slaps on) as CSS animations.
 *
 * Why CSS: the sequence must start with the first paint. Played from the bundled script, it started only once the
 * page's JS had run, so on slow phones the finished hero painted first, vanished, and then animated in. CSS animations
 * on transform, opacity and clip-path also run on the compositor, so boot work on the main thread can't stall them.
 *
 * The slaps were Web Animations with one easing over several keyframes (an effect-level easing). CSS eases each
 * keyframe segment separately, so those are sampled here into linear keyframes; two-keyframe animations keep their
 * easing as is. Transforms use the individual translate/rotate/scale properties, which stack on each element's own
 * resting `transform`.
 *
 *   bun scripts/load-motion.ts           write the CSS
 *   bun scripts/load-motion.ts --check   fail if the CSS is out of date (part of `bun run check`)
 */
import { readFileSync, writeFileSync } from "node:fs";

import { motion } from "@proudindian/design/tokens";

const OUT = "src/styles/sections/load-motion.css";
const R = motion.reveal;
const E = motion.ease;

/** cubic-bezier(x1,y1,x2,y2) as a function of progress */
function bezier(css: string) {
  const [x1, y1, x2, y2] = css.match(/-?\d*\.?\d+/g)!.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const f = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (f(x1, x2, m) < x) lo = m;
      else hi = m;
    }
    return f(y1, y2, (lo + hi) / 2);
  };
}

interface Frame {
  offset: number;
  tx?: number;
  ty?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
}
type Prop = "tx" | "ty" | "scale" | "rotate" | "opacity";
const REST: Record<Prop, number> = {
  tx: 0,
  ty: 0,
  scale: 1,
  rotate: 0,
  opacity: 1,
};

/** value of one property at eased progress e, interpolating between the keyframes that set it (the end is the rest) */
function at(frames: Frame[], prop: Prop, e: number) {
  const set = frames
    .filter((f) => f[prop] !== undefined)
    .map((f) => [f.offset, f[prop]!] as const);
  if (!set.length || set.at(-1)![0] < 1) set.push([1, REST[prop]]);
  if (set[0]![0] > 0) set.unshift([0, set[0]![1]]);
  for (let i = 1; i < set.length; i++) {
    const [o0, v0] = set[i - 1]!;
    const [o1, v1] = set[i]!;
    if (e <= o1 || i === set.length - 1)
      return v0 + ((v1 - v0) * (e - o0)) / (o1 - o0 || 1);
  }
  return REST[prop];
}

const n = (x: number, d = 2) => String(+x.toFixed(d));

/** a multi-keyframe animation with one effect-level easing, sampled into linear keyframes */
function sampled(
  name: string,
  frames: Frame[],
  easing: string,
  asTransform = false,
  steps = 24
) {
  const ease = bezier(easing);
  const props = (["tx", "ty", "scale", "rotate", "opacity"] as Prop[]).filter(
    (p) => frames.some((f) => f[p] !== undefined)
  );
  const lines: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const e = ease(p);
    const v = (pr: Prop) => at(frames, pr, e);
    const decl: string[] = [];
    if (asTransform)
      decl.push(
        `transform: translate(${n(v("tx"))}px, ${n(v("ty"))}px) scale(${n(v("scale"), 4)}) rotate(${n(v("rotate"))}deg)`
      );
    else {
      if (props.includes("tx") || props.includes("ty"))
        decl.push(`translate: ${n(v("tx"))}px ${n(v("ty"))}px`);
      if (props.includes("scale")) decl.push(`scale: ${n(v("scale"), 4)}`);
      if (props.includes("rotate")) decl.push(`rotate: ${n(v("rotate"))}deg`);
    }
    if (props.includes("opacity"))
      decl.push(`opacity: ${n(Math.min(1, v("opacity")), 3)}`);
    lines.push(`  ${n(p * 100)}% {\n    ${decl.join(";\n    ")};\n  }`);
  }
  return `@keyframes ${name} {\n${lines.join("\n")}\n}`;
}

/** the E2 slap from reveal.ts heroSlap (kids) and the seal stamp */
const kid = sampled(
  "ld-kid",
  [
    { offset: 0, tx: -14, ty: -26, scale: 1.16, rotate: -7, opacity: 0 },
    { offset: 0.3, opacity: 1 },
    { offset: 0.72, tx: 0, ty: 0, scale: 0.965, rotate: 0 },
  ],
  E.overshoot
);
const seal = sampled(
  "ld-seal",
  [
    { offset: 0, tx: 0, ty: -26, scale: 1.7, rotate: 20, opacity: 0 },
    { offset: 0.3, opacity: 1 },
    { offset: 0.72, tx: 0, ty: 0, scale: 0.9, rotate: 0 },
  ],
  E.overshoot
);
/** the reveal "slap" (the spark). The spark is an <svg>, where Chrome only composites `transform` (not the individual
 * properties); it has no resting transform of its own, so this is exactly the reveal's slap. */
const slap = sampled(
  "ld-slap",
  [
    { offset: 0, tx: -6, ty: -16, scale: 1.08, rotate: -5 },
    { offset: 0.68, tx: 0, ty: 0, scale: 0.975, rotate: 0 },
  ],
  E.overshoot,
  true
);

const ON = `html.js[data-motion="on"]:not(.ld-done)`;
const settle = E.settle;
/** one rise keyframes per distance: literal values (a var() in the keyframes would keep it off the compositor) */
const riseName = (y: number) =>
  `ld-rise-${y < 0 ? "up" : "down"}-${Math.abs(y)}`;
const rise = (delay: number, y: number = R.riseDistance, fade = true) =>
  `animation:\n    ${riseName(y)} ${R.rise}ms ${settle} ${delay}ms backwards${fade ? `,\n    ld-fade ${R.riseFade}ms ${settle} ${delay}ms backwards` : ""};`;

const css = `/* GENERATED by scripts/load-motion.ts. Do not edit: change the script and run \`bun scripts/load-motion.ts\`.

   The header and hero load sequence, played by CSS from the first paint (see the script for why). It
   runs only with html.js[data-motion=on], which the inline head script sets before first paint; Pause and reduced
   motion turn it off like every other animation. The site script marks the header and hero reveals as done (.rv-in)
   without replaying them, and adds html.ld-done once these animations have finished, so Resume never replays them.
   Delays and durations are the ones the reveal script used (the hero group starts at 0ms, the header pills 90ms apart),
   except the calls to action and the marquee, which now start at 280ms and 380ms.
   The stickers, seal and spark get will-change while the sequence runs: their slaps start before their images have
   painted, and Chrome would otherwise judge them "no visible change" and run them on the main thread. */
${[R.riseDistance, -16].map((y) => `@keyframes ${riseName(y)} {\n  from {\n    translate: 0 ${y}px;\n  }\n}`).join("\n")}
@keyframes ld-fade {
  from {
    opacity: 0;
  }
}
/* the slanted wipe across "Optimist.": the word's box is its text, so the edges are the box's (12px before, 24px past,
   slanted by 12% of the line box, which is 0.82em tall) */
@keyframes ld-wipe {
  from {
    clip-path: polygon(-12px -40%, -12px -40%, calc(-12px - 0.0984em) 140%, calc(-12px - 0.0984em) 140%);
  }
  to {
    clip-path: polygon(-12px -40%, calc(100% + 24px + 0.0984em) -40%, calc(100% + 24px) 140%, calc(-12px - 0.0984em) 140%);
  }
}
@keyframes ld-shift {
  from {
    translate: -14px 0;
  }
}
@keyframes ld-show {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
${kid}
${seal}
${slap}

/* header: the two pills drop in, 90ms apart */
${ON} .site-hd .pill.l {
  ${rise(0, -16)}
}
${ON} .site-hd .pill.r {
  ${rise(90, -16)}
}
/* hero */
${ON} .s-hero .pre {
  ${rise(0)}
}
${ON} .s-hero .giant {
  animation:
    ld-wipe ${R.wipe}ms ${E.wipe} 70ms backwards,
    ld-shift 620ms ${settle} 70ms backwards;
}
/* the lede is readable from the first frame: it only rises (approved, B1) */
${ON} .s-hero .lede {
  ${rise(380, R.riseDistance, false)}
}
/* the calls to action and the marquee arrive early (280ms, 380ms), so the page is usable before the lede settles */
${ON} .s-hero .ctas {
  ${rise(280)}
}
${ON} .s-hero .marquee {
  ${rise(380)}
}
${ON} .s-hero .spark {
  will-change: transform, opacity;
  animation:
    ld-slap ${R.slap}ms linear 900ms backwards,
    ld-show 160ms linear 900ms backwards;
}
${ON} .s-hero .k1 {
  animation: ld-kid 640ms linear 120ms backwards;
  will-change: translate, scale, rotate, opacity;
}
${ON} .s-hero .k2 {
  animation: ld-kid 640ms linear 320ms backwards;
  will-change: translate, scale, rotate, opacity;
}
${ON} .s-hero .k1m {
  animation: ld-kid 640ms linear 720ms backwards;
  will-change: translate, scale, rotate, opacity;
}
${ON} .s-hero .seal {
  animation: ld-seal 520ms linear 760ms backwards;
  will-change: translate, scale, rotate, opacity;
}
`;

if (process.argv.includes("--check")) {
  let cur = "";
  try {
    cur = readFileSync(OUT, "utf8");
  } catch {
    /* missing */
  }
  if (cur !== css) {
    console.error(`${OUT} is out of date: run bun scripts/load-motion.ts`);
    process.exit(1);
  }
  console.log("load motion: up to date");
} else {
  writeFileSync(OUT, css);
  console.log(`wrote ${OUT}`);
}
