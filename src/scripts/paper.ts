/**
 * The tear-off ticket's paper sounds (tear.ts), made in code rather than files: a loop of tearing that sound.ts fades
 * in and out with the pull, the rip as it comes away, and the soft slap as it springs back whole. Each is mono samples
 * at a sample rate, peaking near the Sound Lab files (src/assets/sounds/). Seeded, so they sound the same every time.
 */

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a one-pole low-pass: call with each sample, get it back smoothed above `hz` */
function lowpass(hz: number, sr: number) {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let y = 0;
  return (x: number) => (y += a * (x - y));
}

function normalize(d: Float32Array, peak: number) {
  let m = 0;
  for (const v of d) m = Math.max(m, Math.abs(v));
  if (m) for (let i = 0; i < d.length; i++) d[i]! *= peak / m;
  return d;
}

/**
 * fibres snapping: sparse clicks of noise, `rate(t)` a second, each `size(t)` loud, between `lo` and `hi` Hz, over a
 * faint rasp of the same noise
 */
function crackle(
  sr: number,
  secs: number,
  seed: number,
  rate: (t: number) => number,
  size: (t: number) => number,
  lo = 900,
  hi = 6500
) {
  const r = random(seed);
  const d = new Float32Array(Math.round(sr * secs));
  const low = lowpass(lo, sr);
  const high = lowpass(hi, sr);
  const fall = Math.exp(-1 / (0.0009 * sr));
  let env = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    if (r() < rate(t) / sr) env += size(t) * (0.25 + r() ** 2);
    env *= fall;
    const x = high((r() * 2 - 1) * (env + 0.06 * size(t)));
    d[i] = x - low(x);
  }
  return d;
}

/** a second and a half of steady tearing, to loop; the clicks bunch up and thin out like real fibres */
export function tearLoop(sr: number) {
  const r = random(7);
  const knots = Array.from({ length: 13 }, () => 0.35 + r() * 0.9);
  knots[12] = knots[0]!;
  // the density wanders between knots and ends where it began, so the loop has no seam
  const wander = (t: number) => {
    const k = (t / 1.5) * 12;
    const i = Math.floor(k);
    const f = k - i;
    return knots[i]! + (knots[Math.min(i + 1, 12)]! - knots[i]!) * f;
  };
  return normalize(
    crackle(
      sr,
      1.5,
      11,
      (t) => 1100 * wander(t),
      () => 1
    ),
    0.45
  );
}

/** the last fibres going all at once (the loop has been tearing up to here), a crisp snap, then the torn half's flutter */
export function rip(sr: number) {
  const d = crackle(
    sr,
    0.3,
    23,
    (t) => (t < 0.03 ? 3200 : 0),
    (t) => (t < 0.03 ? 0.9 : 0)
  );
  const r = random(5);
  const air = lowpass(2200, sr);
  const thud = lowpass(700, sr);
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const s = t - 0.025;
    if (s >= 0) {
      const n = r() * 2 - 1;
      d[i]! += thud(n) * 3.2 * Math.exp(-s / 0.006);
      d[i]! +=
        air(n) *
        0.35 *
        Math.sin(Math.min(s / 0.25, 1) * Math.PI) *
        Math.exp(-s / 0.09);
    }
  }
  return normalize(d, 0.4);
}

/** a soft slap of card settling back, and a smaller one as it overshoots */
export function snapBack(sr: number) {
  const d = new Float32Array(Math.round(sr * 0.24));
  const tap = (at: number, a: number, seed: number) => {
    const r = random(seed);
    const body = lowpass(1600, sr);
    const edge = lowpass(500, sr);
    for (let i = Math.round(at * sr); i < d.length; i++) {
      const s = i / sr - at;
      const n = r() * 2 - 1;
      // a falling knock, 180 Hz settling to 110
      const knock = Math.sin(
        2 * Math.PI * (110 * s + 1.4 * (1 - Math.exp(-s / 0.02)))
      );
      d[i]! +=
        a *
        ((body(n) - edge(n)) * 2.4 * Math.exp(-s / 0.012) +
          knock * 0.5 * Math.exp(-s / 0.03));
    }
  };
  tap(0, 1, 3);
  tap(0.085, 0.35, 4);
  return normalize(d, 0.32);
}
