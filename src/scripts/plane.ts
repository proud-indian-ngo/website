/** 08 paper plane: flies once to "Become an Optimist" when it enters view. Its path is measured from the live
 *  layout, so it waits (plane and trail held hidden) until any scroll-in reveal that moves its start or end has
 *  settled. */
import { PHONE_MAX } from "@proudindian/design/tokens";

import { $, $$, A, EASE, on } from "./dom";
import { lite } from "./lite";

const st = $("[data-plane-stage]");

/** a cubic Bézier: start, two control points, end (x, y each) */
type Seg = [number, number, number, number, number, number, number, number];
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** a polyline of the curves (48 points each) with its cumulative length, to find the point at a given length */
function arcLength(segs: Seg[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  const len: number[] = [];
  let acc = 0;
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segs)
    for (let i = xs.length ? 1 : 0; i <= 48; i++) {
      const t = i / 48;
      const x = bez(x0, x1, x2, x3, t);
      const y = bez(y0, y1, y2, y3, t);
      if (xs.length) acc += Math.hypot(x - xs.at(-1)!, y - ys.at(-1)!);
      xs.push(x);
      ys.push(y);
      len.push(acc);
    }
  return {
    length: acc,
    point(l: number): [number, number] {
      let lo = 0;
      let hi = len.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (len[m]! < l) lo = m;
        else hi = m;
      }
      const span = len[hi]! - len[lo]! || 1;
      const f = Math.min(1, Math.max(0, (l - len[lo]!) / span));
      return [
        xs[lo]! + (xs[hi]! - xs[lo]!) * f,
        ys[lo]! + (ys[hi]! - ys[lo]!) * f,
      ];
    },
  };
}
let frames: string[] = [];

export function layoutPlane() {
  if (!st) return;
  const svg = $<SVGSVGElement>(".fly", st)!;
  const to = $("[data-plane-target]", st)!;
  const S = st.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const mob = S.width <= PHONE_MAX;
  const mode = mob ? "top" : st.dataset.planeMode;
  const k = mob ? 0.6 : 1;
  const from =
    (mob && $("[data-plane-from-m]", st)) || $("[data-plane-from]", st)!;
  const a = from.getBoundingClientRect();
  const sx = a.left - S.left;
  const sy = a.top - S.top;
  let ex: number;
  let ey: number;
  let last: [number, number];
  if (mode === "left") {
    ex = b.left - S.left - 30;
    ey = b.top - S.top + b.height / 2;
    last = [ex - 110, ey + 4];
  } else if (mode === "right") {
    ex = b.right - S.left + 30;
    ey = b.top - S.top + b.height / 2;
    last = [ex + 110, ey + 30];
  } else {
    ex = b.left - S.left + b.width * 0.62;
    ey = b.top - S.top - 22;
    last = [ex + 40, ey - 80];
  }
  const lx = sx + (ex - sx) * 0.42;
  const ly = sy + (ey - sy) * 0.42;
  const [lax, lay] = last;
  // the flight path: four cubic Béziers (the same curve as the dashed trail drawn below)
  const segs: Seg[] = [
    [
      sx,
      sy,
      sx + (lx - sx) * 0.4,
      sy - 50 * k,
      lx - 90 * k,
      ly + 40 * k,
      lx,
      ly + 6 * k,
    ],
    [
      lx,
      ly + 6 * k,
      lx + 46 * k,
      ly - 8 * k,
      lx + 52 * k,
      ly - 62 * k,
      lx + 14 * k,
      ly - 62 * k,
    ],
    [
      lx + 14 * k,
      ly - 62 * k,
      lx - 22 * k,
      ly - 62 * k,
      lx - 20 * k,
      ly - 14 * k,
      lx + 30 * k,
      ly - 2 * k,
    ],
    [lx + 30 * k, ly - 2 * k, lx + 110 * k, ly + 16 * k, lax, lay, ex, ey],
  ];
  const d =
    `M${sx} ${sy}` +
    segs
      .map((g) => `C${g[2]} ${g[3]} ${g[4]} ${g[5]} ${g[6]} ${g[7]}`)
      .join("");
  $(".trail", svg)!.setAttribute("d", d);
  $(".trail-reveal", svg)!.setAttribute("d", d);
  // 65 frames evenly spaced along the path's length, each turned to the path's direction (measured over ±2px), as
  // getPointAtLength would give, but computed from the curves: well under a millisecond instead of ~80ms on a slow phone
  const at = arcLength(segs);
  const L = at.length;
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const P = at.point((L * i) / 64);
    const q = at.point(Math.min(L, (L * i) / 64 + 2));
    const r = at.point(Math.max(0, (L * i) / 64 - 2));
    pts.push(
      `translate(${P[0].toFixed(1)}px,${P[1].toFixed(1)}px) rotate(${(Math.atan2(q[1] - r[1], q[0] - r[0]) * 57.3).toFixed(1)}deg) scale(1.5)`
    );
  }
  frames = pts;
  $(".plane", svg)!.style.transform = pts[pts.length - 1]!;
}

function fly() {
  if (!st) return;
  layoutPlane();
  const E = EASE.glide;
  A(
    $(".plane", st),
    frames.map((t) => ({ transform: t })),
    { duration: 2000, easing: E }
  );
  // the dashed trail draws in behind the plane; on slow devices (lite.ts) it fades in along the flight instead, on the
  // compositor
  if (lite())
    A($(".trail", st), [{ opacity: 0 }, { opacity: 1 }], {
      duration: 2000,
      easing: E,
    });
  else
    A(
      $(".trail-reveal", st),
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 2000, easing: E }
    );
  A(
    $("[data-plane-target]", st),
    [
      { transform: "none" },
      { transform: "scale(1.08)", offset: 0.5 },
      { transform: "none" },
    ],
    {
      duration: 420,
      delay: 1900,
      easing: EASE.spring,
      fill: "none",
    }
  );
}

export function initPlane() {
  if (!st) return;
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (!on()) return;
        const hold = A($(".fly", st), [{ opacity: 0 }, { opacity: 0 }], {
          duration: 1e5,
          fill: "none",
        });
        // the path is measured from its start points and the button, so wait only for a reveal that moves one of
        // them (none since reveals were cut back to the headline group; this keeps it right if one comes back)
        const settling = $$(
          "[data-plane-from],[data-plane-from-m],[data-plane-target]",
          st
        )
          .map((el) => el.closest("[data-reveal]"))
          .filter((el, i, all) => el && all.indexOf(el) === i)
          .flatMap((el) => el!.getAnimations())
          .map((a) => a.finished.catch(() => {}));
        Promise.all(settling).then(() => {
          hold?.cancel();
          if (on()) fly();
        });
      }),
    { threshold: 0.35 }
  );
  io.observe($("[data-plane-target]", st)!);
}
