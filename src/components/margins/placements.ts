/** Margin doodles: the package's outline doodles
 *  (@proudindian/design/illustrations/outline/) scattered in both side gutters of every section, the closing section
 *  and the footer, from 1440px up.
 *
 *  Positions come from a seeded scatter (one seed per section, so every build is identical), checked at a reference
 *  width of 2304px against: a minimum distance between doodles on a side, no two within 60px of the same x on a side,
 *  no left/right mirroring, and uneven vertical gaps (no regular rhythm). Each doodle gets its own x across the gutter
 *  (f: 0 = content edge, 1 = outer edge of the free strip), its own y (% of the layer), size (0.7-1.3x) and rotation
 *  (-25 to 25 degrees). The first ~half of each side shows from 1440px; the rest (`wide`) from 1600px, where the
 *  gutters have room for them. `tier` marks right-side doodles beside the programme rail, which need a wider strip
 *  (margins.css). `bun run qa:doodles` checks the result in the browser at every width. */
export type Motif =
  | "pencil"
  | "brush"
  | "book"
  | "kite"
  | "heart"
  | "star"
  | "rupee"
  | "sun"
  | "sparkle"
  | "notepad"
  | "clock"
  | "plane"
  | "matka"
  | "bowl"
  | "hands"
  | "note"
  | "drum"
  | "tick";
export type SetName =
  | "hero"
  | "prog"
  | "teach"
  | "feed"
  | "kala"
  | "gather"
  | "vol"
  | "don"
  | "rp"
  | "tr"
  | "cl"
  | "ft"
  // the volunteer guide (/volunteer/)
  | "vhero"
  | "vdo"
  | "vwhere"
  | "vint"
  | "vfaq";
export interface Spot {
  m: Motif;
  side: "l" | "r";
  f: number;
  y: number;
  s: number;
  r: number;
  wide: boolean;
  tier: 0 | 1 | 2;
}

/** base width in px before the 0.7-1.3 scale */
const base: Record<Motif, number> = {
  pencil: 52,
  brush: 50,
  book: 56,
  kite: 46,
  heart: 44,
  star: 32,
  rupee: 46,
  sun: 60,
  sparkle: 28,
  notepad: 54,
  clock: 48,
  plane: 86,
  matka: 60,
  bowl: 54,
  hands: 54,
  note: 42,
  drum: 62,
  tick: 44,
};

interface Plan {
  l: Motif[];
  r: Motif[];
  /** layer height and usable gutter widths (px) at the 2304px reference */
  h: number;
  gl: number;
  gr: number;
  /** usable y range, % */
  y?: [number, number];
}
const plans: Record<SetName, Plan> = {
  hero: {
    l: ["kite", "star", "sparkle"],
    r: ["heart", "star"],
    h: 930,
    gl: 352,
    gr: 332,
    y: [30, 92],
  },
  prog: { l: ["brush", "kite"], r: ["sparkle"], h: 725, gl: 410, gr: 210 },
  teach: {
    l: ["book", "pencil", "star"],
    r: ["notepad", "star"],
    h: 1100,
    gl: 382,
    gr: 192,
  },
  feed: {
    l: ["bowl", "heart", "sparkle"],
    r: ["matka", "heart"],
    h: 1000,
    gl: 382,
    gr: 192,
  },
  kala: {
    l: ["brush", "drum", "star", "note"],
    r: ["note", "sparkle", "star"],
    h: 2100,
    gl: 440,
    gr: 323,
    y: [4, 96],
  },
  gather: {
    l: ["hands", "kite", "star"],
    r: ["heart", "sparkle"],
    h: 1000,
    gl: 382,
    gr: 192,
  },
  vol: {
    l: ["pencil", "clock", "star"],
    r: ["plane", "notepad", "star"],
    h: 1480,
    gl: 440,
    gr: 440,
  },
  don: {
    l: ["rupee", "matka", "sparkle"],
    r: ["heart", "sparkle"],
    h: 836,
    gl: 440,
    gr: 440,
  },
  rp: {
    l: ["tick", "book"],
    r: ["rupee", "notepad"],
    h: 1300,
    gl: 440,
    gr: 440,
  },
  tr: { l: ["book", "star"], r: ["sun", "sparkle"], h: 750, gl: 440, gr: 440 },
  cl: {
    l: ["heart", "star", "pencil"],
    r: ["sparkle", "book", "kite"],
    h: 1270,
    gl: 372,
    gr: 372,
    y: [6, 70],
  },
  vhero: {
    l: ["kite", "star", "sparkle"],
    r: ["heart", "sun"],
    h: 900,
    gl: 400,
    gr: 400,
    y: [14, 90],
  },
  vdo: {
    l: ["book", "pencil", "star"],
    r: ["bowl", "brush", "sparkle"],
    h: 1500,
    gl: 400,
    gr: 400,
  },
  vwhere: {
    l: ["hands", "heart"],
    r: ["kite", "star"],
    h: 900,
    gl: 400,
    gr: 400,
  },
  vint: {
    l: ["notepad", "pencil"],
    r: ["tick", "star"],
    h: 760,
    gl: 400,
    gr: 400,
  },
  vfaq: {
    l: ["notepad", "sparkle", "star"],
    r: ["clock", "book"],
    h: 1300,
    gl: 400,
    gr: 400,
  },
  ft: {
    l: ["pencil", "book", "rupee", "star"],
    r: ["kite", "heart", "brush"],
    h: 745,
    gl: 440,
    gr: 440,
    y: [8, 94],
  },
};
/** sections whose right strip is squeezed by the programme rail: the first right doodle needs a 90px strip, more need 180px */
const railSets = new Set<SetName>(["prog", "teach", "feed", "kala", "gather"]);

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) =>
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Cand {
  m: Motif;
  side: "l" | "r";
  f: number;
  y: number;
  k: number;
  r: number;
}
/** checks one candidate layout at the reference width */
function ok(c: Cand[], p: Plan, minD: number) {
  const px = (d: Cand) => ({
    x: d.f * Math.min(d.side === "l" ? p.gl : p.gr, 440),
    y: (d.y / 100) * p.h,
  });
  for (const side of ["l", "r"] as const) {
    const s = c.filter((d) => d.side === side);
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) {
        const a = px(s[i]!),
          b = px(s[j]!);
        if (Math.abs(a.x - b.x) < 60) return false; // never two on the same vertical line
        if (Math.abs(a.y - b.y) < 80) return false; // nor side by side on the same horizontal line
        if (Math.hypot(a.x - b.x, a.y - b.y) < minD) return false; // breathing room
      }
    // uneven vertical gaps (including the gaps to the layer's ends)
    if (s.length >= 2) {
      const ys = [0, ...s.map((d) => d.y).sort((a, b) => a - b), 100];
      const gaps = ys.slice(1).map((y, i) => y - ys[i]!);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const cv =
        Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length) /
        mean;
      if (cv < 0.3) return false;
    }
  }
  // no mirroring: a left and a right doodle at a similar height and a similar depth into their gutters
  for (const a of c.filter((d) => d.side === "l"))
    for (const b of c.filter((d) => d.side === "r"))
      if (Math.abs(a.y - b.y) < 9 && Math.abs(a.f - b.f) < 0.18) return false;
  // the two sides should not share a height band at all for the first doodle of each
  return true;
}

function scatter(name: SetName): Spot[] {
  const p = plans[name];
  const rand = rng(hash(name));
  const [y0, y1] = p.y ?? [7, 93];
  // keep each doodle's full (rotated) width inside its strip at the reference width: narrow strips get
  // smaller doodles nearer the middle, wide ones can sit anywhere from the content edge to the outer edge
  const pick = (m: Motif, side: "l" | "r"): Cand => {
    const g = Math.min(side === "l" ? p.gl : p.gr, 440);
    let k = 0.7 + rand() * 0.6;
    let fmin = Math.max(0.12, (0.75 * base[m] * k + 10) / g);
    if (fmin > 0.42) {
      fmin = 0.42;
      k = Math.max(0.45, (0.42 * g - 10) / 0.75 / base[m]);
    }
    return {
      m,
      side,
      f: fmin + rand() * (1 - 2 * fmin),
      y: y0 + rand() * (y1 - y0),
      k,
      r: Math.round(rand() * 50 - 25),
    };
  };
  let best: Cand[] | null = null;
  // ask for 190px between doodles on a side; relax a little only if a tall stack of doodles cannot fit
  for (const minD of [190, 170, 150])
    for (let i = 0; i < 50000 && !best; i++) {
      const c = [
        ...p.l.map((m) => pick(m, "l")),
        ...p.r.map((m) => pick(m, "r")),
      ];
      if (ok(c, p, minD)) best = c;
    }
  if (!best) throw new Error(`margin doodles: no layout found for ${name}`);
  const nl = p.l.length,
    nr = p.r.length;
  return best.map((d, i) => {
    const idx = d.side === "l" ? i : i - nl;
    const n = d.side === "l" ? nl : nr;
    return {
      m: d.m,
      side: d.side,
      f: r2(d.f),
      y: r2(d.y),
      s: Math.round(base[d.m] * d.k),
      r: d.r,
      wide: idx >= Math.ceil(n / 2),
      tier: d.side === "r" && railSets.has(name) ? (idx === 0 ? 1 : 2) : 0,
    };
  });
}

export const spots = Object.fromEntries(
  (Object.keys(plans) as SetName[]).map((k) => [k, scatter(k)])
) as Record<SetName, Spot[]>;

/** the motifs any section uses, so the page inlines only those symbols */
export const usedMotifs = () =>
  new Set(Object.values(spots).flatMap((v) => v.map((d) => d.m)));
