/**
 * The brand kit on /brand/ (internal, unlisted): every downloadable file, in groups, all from @proudindian/design.
 * src/pages/brand/files/[...file].ts builds them at /brand/files/…:
 * - the package's SVGs as they are, except the doodles, which get ink baked in (as an <img> or in Canva their
 *   currentColor would turn black);
 * - PNGs rendered from those SVGs at PNG_SIZES (long edge, transparent), cached in node_modules/.astro/brand-kit/,
 *   which CI keeps between runs with Astro's image cache, so only a package update re-renders them;
 * - the package's own PNGs (favicons, avatars, share card), fonts and licences;
 * - from the design release's proud-indian-brand-assets.zip (which git installs leave out): the guidelines PDF, the
 *   Anek fonts and the marketing kit (social, print, office, cards and merchandise, listed by its manifest.json),
 *   downloaded once per design version into the same cache. BRAND_ASSETS_ZIP points the build at a local copy;
 * - a zip per group, one of the brand kit and one of the marketing kit (one of everything would pass Cloudflare
 *   Pages' 25 MiB file limit), each with a README.txt listing what each file is for.
 * - the pitch decks, PDFs that scripts/decks.ts renders into src/assets/decks/ (committed, with a cover preview each).
 * Stamp-production seals ship as SVG only: a stamp maker needs the vector.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { color } from "@proudindian/design/tokens";
import { type Zippable, unzipSync, zipSync } from "fflate";
import sharp from "sharp";

const PKG = join(process.cwd(), "node_modules/@proudindian/design");
const CACHE = join(process.cwd(), "node_modules/.astro/brand-kit");
const PNG_SIZES = [512, 1024, 2048] as const;
/** Cloudflare Pages refuses a file over 25 MiB */
const MAX_BYTES = 25 * 1024 * 1024;
/** fixed, so a zip is byte-identical between builds and Pages doesn't re-upload it */
const ZIP_DATE = new Date("2026-10-08T00:00:00Z");

const DESIGN_VERSION = (
  JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
    version: string;
  }
).version;
const ASSETS_URL = `https://github.com/proud-indian-ngo/design/releases/download/v${DESIGN_VERSION}/proud-indian-brand-assets.zip`;

/** the design release's assets zip, unpacked: BRAND_ASSETS_ZIP, else the cached download, else GitHub */
async function loadAssets(): Promise<Record<string, Uint8Array>> {
  const cached = join(CACHE, `assets-v${DESIGN_VERSION}.zip`);
  const local =
    process.env.BRAND_ASSETS_ZIP ?? (existsSync(cached) ? cached : undefined);
  if (local) return unzipSync(new Uint8Array(readFileSync(local)));
  const res = await fetch(ASSETS_URL);
  if (!res.ok)
    throw new Error(
      `brand kit: ${ASSETS_URL} answered ${res.status}. Is v${DESIGN_VERSION} released with its assets? ` +
        "To build from a local zip, set BRAND_ASSETS_ZIP."
    );
  const zip = new Uint8Array(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, zip);
  return unzipSync(zip);
}
const assets = await loadAssets();
const fromAssets = (path: string) => {
  const bytes = assets[path];
  if (!bytes)
    throw new Error(
      `brand kit: ${path} is missing from the design release's assets zip`
    );
  return bytes;
};

export type Ground = "paper" | "ink" | "sky";

export interface KitFile {
  /** under /brand/files/ */
  path: string;
  /** "SVG", "PNG 1024", "WOFF2" */
  label: string;
}

export interface KitItem {
  title: string;
  use: string;
  ground: Ground;
  /** shown in the tile; null for files with nothing to preview (fonts, the PDF) */
  preview: { src: string; width: number; height: number } | null;
  files: KitFile[];
}

export interface KitGroup {
  id: string;
  title: string;
  items: KitItem[];
  zip: KitFile;
}

/** every built file: its path under /brand/files/ → how to make it */
const sources = new Map<string, () => Promise<Uint8Array>>();
const memo = new Map<string, Promise<Uint8Array>>();

const read = (path: string) => new Uint8Array(readFileSync(join(PKG, path)));
const url = (path: string) => `/brand/files/${path}`;
const ext = (path: string) =>
  path.slice(path.lastIndexOf(".") + 1).toUpperCase();

function add(
  path: string,
  make: () => Promise<Uint8Array> | Uint8Array
): KitFile {
  sources.set(path, async () => make());
  return { path, label: ext(path) };
}

function viewBox(svg: string): { width: number; height: number } {
  const box = /viewBox="([\d.\s-]+)"/
    .exec(svg)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);
  if (!box || box.length !== 4)
    throw new Error("brand kit: an SVG without a viewBox");
  return { width: box[2]!, height: box[3]! };
}

/** a transparent PNG of `svg` with a long edge of `size` px, rendered at that density (not scaled up from a bitmap) */
async function png(svg: string, size: number): Promise<Uint8Array> {
  const key = createHash("sha256")
    .update(`${size}\n${svg}`)
    .digest("hex")
    .slice(0, 24);
  const cached = join(CACHE, `${key}.png`);
  if (existsSync(cached)) return new Uint8Array(readFileSync(cached));
  const { width, height } = viewBox(svg);
  const density = (72 * size) / Math.max(width, height);
  const out = await sharp(Buffer.from(svg), { density })
    .resize({ width: size, height: size, fit: "inside" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, out);
  return new Uint8Array(out);
}

/** one artwork: its SVG, plus PNGs at every size unless `pngs` is false */
function artwork(
  group: string,
  name: string,
  svg: string,
  item: Pick<KitItem, "title" | "use" | "ground">,
  pngs = true
): KitItem {
  const bytes = new TextEncoder().encode(svg);
  const files = [add(`${group}/${name}.svg`, () => bytes)];
  if (pngs) {
    for (const size of PNG_SIZES) {
      files.push({
        ...add(`${group}/${name}-${size}.png`, () => png(svg, size)),
        label: `PNG ${size}`,
      });
    }
  }
  return {
    ...item,
    preview: { src: url(files[0]!.path), ...viewBox(svg) },
    files,
  };
}

const packageSvg = (path: string) => readFileSync(join(PKG, path), "utf8");

// ---- Logo

const LOCKUPS = [
  [
    "pi-lockup",
    "Horizontal lockup",
    "Letterhead, reports, receipts, certificates, signage. The default when there's room.",
  ],
  [
    "pi-lockup-compact",
    "Compact lockup",
    "Small sizes: under 32 px tall, like the website header.",
  ],
  ["pi-stacked", "Stacked lockup", "Tees, square and portrait spaces."],
  [
    "pi-symbol",
    "Symbol",
    "The symbol on its own. At 16 px use the favicon instead.",
  ],
] as const;
const COLOURWAYS = [
  ["", "full colour", "paper", "On paper or white."],
  [
    "-reversed",
    "reversed",
    "ink",
    "On ink or dark photos, on screen. In print, use the one-colour file in paper.",
  ],
  [
    "-mono",
    "one colour",
    "sky",
    "On sky, and for one-colour printing: stamps, embroidery, newspaper, laser receipts.",
  ],
] as const;

const logo = [
  ...LOCKUPS.flatMap(([file, title, use]) =>
    COLOURWAYS.map(([suffix, way, ground, on]) =>
      artwork(
        "logo",
        `${file}${suffix}`,
        packageSvg(`logo/svg/${file}${suffix}.svg`),
        {
          title: `${title}, ${way}`,
          use: suffix ? on : `${use} ${on}`,
          ground,
        }
      )
    )
  ),
  ...(
    [
      [
        "pi-wordmark",
        "Wordmark",
        "Only where the symbol is already on the same surface, like the back of a tee.",
        "paper",
      ],
      [
        "pi-disc",
        "Ink disc",
        "The default avatar, and the logo on photos.",
        "paper",
      ],
      ["pi-disc-cyan", "Sky disc", "The one-colour figure on sky.", "paper"],
      [
        "pi-disc-mono",
        "One-colour disc",
        "The figure knocked out of the disc, for one-colour printing.",
        "paper",
      ],
      [
        "pi-app-tile",
        "App tile, rounded",
        "App icons in slides and previews.",
        "paper",
      ],
      [
        "pi-app-tile-square",
        "App tile, square",
        "Full bleed: the platform rounds it.",
        "paper",
      ],
    ] as const
  ).map(([file, title, use, ground]) =>
    artwork("logo", file, packageSvg(`logo/svg/${file}.svg`), {
      title,
      use,
      ground,
    })
  ),
];

// ---- Seals

const SEALS = [
  ["pi-seal", "Main seal", "Proud Indian · Bengaluru · since 2019."],
  ["pi-seal-80g", "80G seal", "80G and 12A receipts, certificates."],
  ["pi-seal-volunteer", "Volunteer seal", "Optimist badges."],
  ["pi-seal-kalakriti", "Kalakriti seal", "Kalakriti 3.0 · 20 Sep 2026."],
] as const;

const seals = [
  ...SEALS.flatMap(([file, title, use]) => [
    artwork("seals", file, packageSvg(`logo/seals/${file}.svg`), {
      title,
      use,
      ground: "paper",
    }),
    artwork(
      "seals",
      `${file}-mono`,
      packageSvg(`logo/seals/${file}-mono.svg`),
      {
        title: `${title}, one colour`,
        use: `${use} One-colour printing.`,
        ground: "paper",
      }
    ),
    artwork(
      "seals",
      `${file}-stamp-production`,
      packageSvg(`logo/seals/${file}-stamp-production.svg`),
      {
        title: `${title}, rubber stamp`,
        use: "Send only this file to a stamp maker. Heavier inner ring, no texture, 18 mm or larger.",
        ground: "paper",
      },
      false
    ),
  ]),
  artwork(
    "seals",
    "pi-seal-80g-SCREEN-ONLY-texture",
    packageSvg("logo/seals/pi-seal-80g-SCREEN-ONLY-texture.svg"),
    {
      title: "80G seal, inked texture",
      use: "Screen mockups only. Never print it: a real stamp makes its own texture.",
      ground: "paper",
    }
  ),
  artwork(
    "seals",
    "pi-seal-optimists-ring",
    packageSvg("logo/seals/pi-seal-optimists-ring.svg"),
    {
      title: "Optimists ring",
      use: "“Optimists · since 2019 · Bengaluru” around an empty centre, for a stat like the website hero's 3.6k+.",
      ground: "paper",
    }
  ),
];

// ---- Icons and avatars: the package's own PNGs (the 16 px favicons are hand-built pixel art: never rescale them)

const icon = (
  file: string,
  from: string,
  title: string,
  use: string,
  size: [number, number],
  ground: Ground = "paper"
): KitItem => {
  const f = add(`icons/${file}`, () => read(from));
  return {
    title,
    use,
    ground,
    preview: { src: url(f.path), width: size[0], height: size[1] },
    files: [f],
  };
};

const icons = [
  icon(
    "avatar-1080.png",
    "logo/social/avatar-1080.png",
    "Avatar, 1080 px",
    "Profile picture on Instagram, WhatsApp, LinkedIn and the rest.",
    [1080, 1080]
  ),
  icon(
    "avatar-400.png",
    "logo/social/avatar-400.png",
    "Avatar, 400 px",
    "Where an upload has to be small.",
    [400, 400]
  ),
  icon(
    "og-default.png",
    "logo/social/og-default.png",
    "Share card",
    "The default link preview: 1200 × 630.",
    [1200, 630]
  ),
  icon(
    "icon-512.png",
    "logo/favicon/icon-512.png",
    "App icon, 512 px",
    "Home-screen and app icons. Full-bleed square: the platform rounds it.",
    [512, 512]
  ),
  icon(
    "icon-192.png",
    "logo/favicon/icon-192.png",
    "App icon, 192 px",
    "Android home screen.",
    [192, 192]
  ),
  icon(
    "apple-touch-icon-180.png",
    "logo/favicon/apple-touch-icon-180.png",
    "Apple touch icon",
    "iPhone and iPad home screen, 180 px.",
    [180, 180]
  ),
  icon(
    "favicon.svg",
    "logo/favicon/favicon.svg",
    "Favicon, SVG",
    "Browser tab. Switches to paper and bright cyan in dark mode.",
    [16, 16]
  ),
  icon(
    "favicon-48.png",
    "logo/favicon/favicon-48.png",
    "Favicon, 48 px",
    "Browser tab.",
    [48, 48]
  ),
  icon(
    "favicon-32.png",
    "logo/favicon/favicon-32.png",
    "Favicon, 32 px",
    "Browser tab.",
    [32, 32]
  ),
  icon(
    "favicon-16.png",
    "logo/favicon/favicon-16.png",
    "Favicon, 16 px",
    "Hand-built pixel art. Never replace it with a scaled-down logo.",
    [16, 16]
  ),
  icon(
    "favicon-16-on-dark.png",
    "logo/favicon/favicon-16-on-dark.png",
    "Favicon, 16 px on dark",
    "For dark tab strips.",
    [16, 16],
    "ink"
  ),
  icon(
    "favicon-16-mono.png",
    "logo/favicon/favicon-16-mono.png",
    "Favicon, 16 px one colour",
    "One-colour contexts.",
    [16, 16]
  ),
];

// ---- Doodles: the package's illustrations (manifest order), with ink baked in for use outside the site

const manifest = JSON.parse(packageSvg("illustrations/manifest.json")) as {
  name: string;
  file: string;
  title: string;
}[];
const doodles = manifest.map(({ name, file, title }) =>
  artwork(
    "doodles",
    `pi-doodle-${name}`,
    packageSvg(`illustrations/${file}`).replace(
      /^<svg /,
      `<svg color="${color.ink}" `
    ),
    {
      title: title.replace(/ \(.*\)$/, ""),
      use: "Around content, never on the logo.",
      ground: "paper",
    }
  )
);

// ---- Fonts and the guidelines

/** a file with nothing to preview; `from` is a package path, or `assets:` and a path in the release's assets zip */
const file = (
  group: string,
  name: string,
  from: string,
  title: string,
  use: string
): KitItem => ({
  title,
  use,
  ground: "paper",
  preview: null,
  files: [
    add(`${group}/${name}`, () =>
      from.startsWith("assets:") ? fromAssets(from.slice(7)) : read(from)
    ),
  ],
});

const fonts = [
  file(
    "fonts",
    "bricolage-grotesque-variable.woff2",
    "fonts/bricolage-grotesque-latin-wdth-normal.woff2",
    "Bricolage Grotesque, variable",
    "Display and headings, for websites. Weight 200–800, width 75–100."
  ),
  file(
    "fonts",
    "bricolage-grotesque-800.woff2",
    "fonts/bricolage-grotesque-800-latin.woff2",
    "Bricolage Grotesque 800",
    "The one weight the brand uses, Latin only, for websites."
  ),
  file(
    "fonts",
    "geist-variable.woff2",
    "fonts/geist-latin-wght-normal.woff2",
    "Geist, variable",
    "Body and interface, for websites. Weight 100–900."
  ),
  file(
    "fonts",
    "AnekLatin.ttf",
    "assets:brand/guidelines/assets/fonts/AnekLatin.ttf",
    "Anek Latin",
    "The wordmark's typeface, for reference. Never retype the wordmark."
  ),
  file(
    "fonts",
    "AnekKannada.ttf",
    "assets:brand/guidelines/assets/fonts/AnekKannada.ttf",
    "Anek Kannada",
    "Kannada text."
  ),
  file(
    "fonts",
    "AnekDevanagari.ttf",
    "assets:brand/guidelines/assets/fonts/AnekDevanagari.ttf",
    "Anek Devanagari",
    "Hindi and other Devanagari text."
  ),
  file(
    "fonts",
    "OFL-bricolage-grotesque.txt",
    "fonts/OFL-bricolage-grotesque.txt",
    "Bricolage Grotesque licence",
    "SIL Open Font License 1.1."
  ),
  file(
    "fonts",
    "OFL-geist.txt",
    "fonts/OFL-geist.txt",
    "Geist licence",
    "SIL Open Font License 1.1."
  ),
  file(
    "fonts",
    "OFL-anek.txt",
    "assets:brand/guidelines/assets/fonts/OFL-Anek.txt",
    "Anek licence",
    "SIL Open Font License 1.1."
  ),
];

const guidelines = [
  file(
    "guidelines",
    "Proud-Indian-Brand-Guidelines.pdf",
    "assets:brand/Proud-Indian-Brand-Guidelines.pdf",
    "Brand guidelines, v1.0",
    "The full guide: the logo, colour, type, photography, motion, voice and applications, with appendices on product interfaces."
  ),
];

// ---- The marketing kit, from the release's assets (the design repo's marketing/out/ and its manifest.json)

interface Manifest {
  groups: {
    id: string;
    title: string;
    items: {
      id: string;
      title: string;
      use: string;
      preview: string;
      files: KitFile[];
    }[];
  }[];
}
const marketing = JSON.parse(
  new TextDecoder().decode(fromAssets("marketing/out/manifest.json"))
) as Manifest;
const marketingItems = (items: Manifest["groups"][number]["items"]) =>
  Promise.all(
    items.map(async (i): Promise<KitItem> => {
      const preview = fromAssets(`marketing/out/${i.preview}`);
      const { width = 900, height = 900 } = await sharp(preview).metadata();
      add(i.preview, () => preview);
      return {
        title: i.title,
        use: i.use,
        ground: "paper",
        preview: { src: url(i.preview), width, height },
        files: i.files.map((f) => ({
          ...add(f.path, () => fromAssets(`marketing/out/${f.path}`)),
          label: f.label,
        })),
      };
    })
  );

// ---- Pitch decks: rendered by `bun run decks` (scripts/decks.ts) into src/assets/decks/

const DECKS = join(process.cwd(), "src/assets/decks");
/** `ground` is the tile's, in contrast to the cover (the CSR deck is paper, the Kalakriti deck ink) */
const deck = async (
  name: string,
  title: string,
  use: string,
  ground: Ground
): Promise<KitItem> => {
  const preview = new Uint8Array(readFileSync(join(DECKS, `${name}.jpg`)));
  const { width = 1200, height = 675 } = await sharp(preview).metadata();
  add(`decks/${name}-cover.jpg`, () => preview);
  return {
    title,
    use,
    ground,
    preview: { src: url(`decks/${name}-cover.jpg`), width, height },
    files: [
      add(`decks/proud-indian-${name}-deck.pdf`, () =>
        readFileSync(join(DECKS, `${name}.pdf`))
      ),
    ],
  };
};
const decks = await Promise.all([
  deck(
    "csr",
    "CSR and employee volunteering",
    "For companies: volunteering days, Kalakriti sponsorship, programme funding, drives and the paperwork. 13 slides.",
    "ink"
  ),
  deck(
    "kalakriti",
    "Kalakriti 4.0 sponsorship",
    "For sponsors of Kalakriti 4.0 (September 2027): the day, three editions, where the money goes, Horizon, the plan and the sponsorships. 12 slides.",
    "paper"
  ),
]);

// ---- Zips

const README_HEAD =
  "Proud Indian brand kit, from https://proudindian.ngo/brand/ (internal; please don't share the link publicly).\n" +
  "Full rules: Proud-Indian-Brand-Guidelines.pdf. Questions: connect@proudindian.ngo.\n" +
  "PNGs are transparent; the number is the long edge in pixels. Use the SVG wherever the app accepts it.\n";

const readme = (groups: KitGroup[]) =>
  README_HEAD +
  groups
    .map(
      (g) =>
        `\n${g.title.toUpperCase()}\n` +
        g.items
          .map(
            (i) =>
              `- ${i.files[0]!.path.split("/")[1]!.replace(/\.\w+$/, "")}: ${i.title}. ${i.use}`
          )
          .join("\n")
    )
    .join("\n") +
  "\n";

/** where a file goes inside a zip: SVGs and PNGs of the rendered groups in svg/ and png/, everything else flat */
const zipName = (path: string) => {
  const [group, name] = path.split("/") as [string, string];
  const sub = ["logo", "seals", "doodles"].includes(group)
    ? `${name.endsWith(".png") ? "png" : "svg"}/`
    : "";
  return `${group}/${sub}${name}`;
};

/** already-compressed files are stored, the rest deflated */
const stored = /\.(png|jpg|pdf|woff2|pptx|docx)$/;

async function zip(root: string, groups: KitGroup[]): Promise<Uint8Array> {
  const entries: Zippable = {
    [`${root}/README.txt`]: new TextEncoder().encode(readme(groups)),
  };
  for (const g of groups) {
    for (const item of g.items) {
      for (const f of item.files) {
        const name =
          groups.length === 1
            ? zipName(f.path).slice(g.id.length + 1)
            : zipName(f.path);
        entries[`${root}/${name}`] = [
          await kitFile(f.path),
          { level: stored.test(f.path) ? 0 : 9 },
        ];
      }
    }
  }
  const out = zipSync(entries, { mtime: ZIP_DATE });
  if (out.byteLength > MAX_BYTES)
    throw new Error(
      `brand kit: ${root}.zip is over Cloudflare Pages' 25 MiB file limit`
    );
  return out;
}

const group = (id: string, title: string, items: KitItem[]): KitGroup => {
  const g: KitGroup = {
    id,
    title,
    items,
    zip: { path: `proud-indian-${id}.zip`, label: "ZIP" },
  };
  sources.set(g.zip.path, () => zip(`proud-indian-${id}`, [g]));
  return g;
};

export const kitGroups: KitGroup[] = [
  group("logo", "Logo", logo),
  group("seals", "Seals", seals),
  group("icons", "Icons and avatars", icons),
  group("doodles", "Doodles", doodles),
  group("fonts", "Fonts", fonts),
  group("guidelines", "Guidelines", guidelines),
];

export const deckGroup: KitGroup = group("decks", "Pitch decks", decks);

export const kitAll: KitFile = {
  path: "proud-indian-brand-kit.zip",
  label: "ZIP",
};
sources.set(kitAll.path, () => zip("proud-indian-brand-kit", kitGroups));

export const marketingGroups: KitGroup[] = await Promise.all(
  marketing.groups.map(async (g) =>
    group(g.id, g.title, await marketingItems(g.items))
  )
);

export const marketingAll: KitFile = {
  path: "proud-indian-marketing-kit.zip",
  label: "ZIP",
};
sources.set(marketingAll.path, () =>
  zip("proud-indian-marketing-kit", marketingGroups)
);

/** every path under /brand/files/ */
export const kitPaths = () => [...sources.keys()];

/** the bytes of a file under /brand/files/, built once per build */
export function kitFile(path: string): Promise<Uint8Array> {
  const make = sources.get(path);
  if (!make) throw new Error(`brand kit: no file ${path}`);
  let out = memo.get(path);
  if (!out) memo.set(path, (out = make()));
  return out;
}

export const kitUrl = url;

/** "11.4 MB", "64 KB" */
export async function kitSize(path: string): Promise<string> {
  const bytes = (await kitFile(path)).byteLength;
  return bytes >= 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}
