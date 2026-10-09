/**
 * The design package check, run by `bun run check`. The brand tokens live in @proudindian/design.
 *
 * 1. The installed @proudindian/design is the version the site is written for (`COMPATIBLE`, a caret range), and the
 *    version the dependency pins: `github:proud-indian-ngo/design#vX.Y.Z` must install X.Y.Z.
 * 2. With a `file:` dependency on a local checkout of the design repo, the copy in node_modules must not be stale: bun
 *    copies the folder at install time, so after changing the checkout run `rm -rf node_modules/@proudindian && bun install --force`. Skipped when the folder
 *    is absent (CI).
 * 3. The brand files served from public/ are byte-identical to the package's. They are committed (so `astro build`
 *    alone, and Cloudflare Pages, need no copy step); `bun run design:sync` re-copies them after a package update.
 *    public/site.webmanifest is the site's own (description, start_url, absolute icon paths) and is not compared.
 *
 *   bun scripts/check-design.ts          check
 *   bun scripts/check-design.ts --sync   copy the brand files from the package into public/, then check
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const COMPATIBLE = "^0.2.3";
const PKG = "node_modules/@proudindian/design";

/** public/ file <- package file */
const PUBLIC_FROM_PACKAGE: [string, string][] = [
  ["public/favicon.svg", "logo/favicon/favicon.svg"],
  ["public/favicon-16.png", "logo/favicon/favicon-16.png"],
  ["public/favicon-32.png", "logo/favicon/favicon-32.png"],
  ["public/apple-touch-icon.png", "logo/favicon/apple-touch-icon-180.png"],
  ["public/icon-192.png", "logo/favicon/icon-192.png"],
  ["public/icon-512.png", "logo/favicon/icon-512.png"],
  ["public/og.png", "logo/social/og-default.png"],
];
/** package files the site build reads; a file: install must match the source folder */
const USED = [
  "package.json",
  "tokens/theme.css",
  "tokens/tokens.css",
  "dist/tokens/index.js",
  "css/fonts.css",
  "css/base.css",
  "css/scrollbar.css",
  "css/utilities.css",
  ...[
    "doodle",
    "sticker",
    "button",
    "chip",
    "section-label",
    "accent-word",
    "polaroid",
    "ticket",
    "card",
  ].map((p) => `css/primitives/${p}.css`),
  "fonts/bricolage-grotesque-latin-wdth-normal.woff2",
  "fonts/bricolage-grotesque-800-latin.woff2",
  "fonts/geist-latin-wght-normal.woff2",
  "logo/seals/pi-seal-optimists-ring.svg",
  ...PUBLIC_FROM_PACKAGE.map(([, from]) => from),
];

const errors: string[] = [];
const read = (p: string) => readFileSync(p);
const same = (a: string, b: string) => read(a).equals(read(b));

if (!existsSync(join(PKG, "package.json"))) {
  console.error(`design: ${PKG} is not installed; run bun install`);
  process.exit(1);
}
const installed: string = JSON.parse(
  readFileSync(join(PKG, "package.json"), "utf8")
).version;
const spec: string = JSON.parse(readFileSync("package.json", "utf8"))
  .dependencies["@proudindian/design"];

// 1. version
const [maj, min, pat] = installed.split(".").map(Number);
const [cMaj, cMin, cPat] = COMPATIBLE.slice(1).split(".").map(Number);
const compatible =
  maj === cMaj &&
  (cMaj === 0
    ? min === cMin && pat! >= cPat!
    : min! > cMin! || (min === cMin && pat! >= cPat!));
if (!compatible)
  errors.push(
    `installed @proudindian/design ${installed} is outside ${COMPATIBLE}`
  );
const tag = spec.match(/#v(\d+\.\d+\.\d+)$/)?.[1];
if (tag && tag !== installed)
  errors.push(
    `package.json pins v${tag} but ${installed} is installed; run bun install`
  );

// 2. stale file: copy
const local = spec.startsWith("file:") ? resolve(spec.slice(5)) : null;
if (local && existsSync(join(local, "package.json"))) {
  for (const f of USED) {
    if (!existsSync(join(local, f)) || !same(join(PKG, f), join(local, f)))
      errors.push(
        `${PKG}/${f} differs from ${join(local, f)}: reinstall (rm -rf node_modules/@proudindian && bun install --force)`
      );
  }
}

// 3. public/ brand files
const sync = process.argv.includes("--sync");
for (const [to, from] of PUBLIC_FROM_PACKAGE) {
  const src = join(PKG, from);
  if (sync) copyFileSync(src, to);
  if (!existsSync(to) || !same(to, src))
    errors.push(
      `${to} differs from @proudindian/design/${from} (run bun run design:sync)`
    );
}

if (errors.length) {
  for (const e of errors) console.error(`design: ${e}`);
  process.exit(1);
}
console.log(
  `design: @proudindian/design ${installed} (${spec}) matches ${COMPATIBLE}; ${PUBLIC_FROM_PACKAGE.length} public/ brand files identical${local && existsSync(local) ? "; node_modules copy matches the source folder" : ""}`
);
