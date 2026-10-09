/**
 * Style lint, run by `bun run check`:
 * 1. Raw hex colours. The only allowed source is the design package's token files
 *    (node_modules/@proudindian/design/tokens/: theme.css and tokens.css, generated from its tokens/*.ts). The site
 *    has no token files of its own, so any hex in a stylesheet, or in an .astro <style> block, fails.
 * 2. Token names retired in @proudindian/design 0.2.0. `font-sans` and `font-display` still compile (to Tailwind's
 *    defaults), so a leftover would silently drop the brand fonts.
 */
import { Glob } from "bun";

const TOKENS = "node_modules/@proudindian/design/tokens/";
for (const f of ["theme.css", "tokens.css"]) {
  if (!(await Bun.file(TOKENS + f).exists())) {
    console.error(`css: ${TOKENS}${f} is missing; run bun install`);
    process.exit(1);
  }
}

const hex = /:[^;{}]*?(#[0-9a-fA-F]{3,8})\b/g;
const retired = [
  [/var\(--font-sans\)/g, "var(--font-pi-sans)"],
  [/var\(--font-display\)/g, "var(--font-pi-display)"],
  [/var\(--color-accent\)/g, "var(--color-accent-ink)"],
  [/var\(--color-muted\)/g, "var(--color-text-muted)"],
  [/(?<![\w-])(?:[\w-]+:)*!?font-sans(?![\w-])/g, "font-pi-sans"],
  // not the @font-face descriptor `font-display: swap`
  [/(?<![\w-])(?:[\w-]+:)*!?font-display(?![\w-]|\s*:)/g, "font-pi-display"],
  [
    /(?<![\w-])(?:[\w-]+:)*!?(?:text|bg|border|fill|stroke|decoration|outline|ring)-(?:muted|accent)(?![\w-])/g,
    "text-text-muted or text-accent-ink",
  ],
] as const;

let bad = 0;
for await (const file of new Glob("src/**/*.{css,astro,ts}").scan(".")) {
  const source = await Bun.file(file).text();
  for (const [re, use] of retired) {
    for (const m of source.matchAll(re)) {
      console.error(
        `${file}: ${m[0]} was renamed in @proudindian/design 0.2.0 (use ${use})`
      );
      bad++;
    }
  }
  if (file.endsWith(".ts")) continue;
  // in .astro files only <style> blocks count (inline SVG attributes keep their hex fills)
  const text = file.endsWith(".astro")
    ? [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
        .map((m) => m[1])
        .join("\n")
    : source;
  for (const m of text.matchAll(hex)) {
    console.error(
      `${file}: raw colour ${m[1]} (use a token from @proudindian/design)`
    );
    bad++;
  }
}
if (bad) process.exit(1);
console.log(
  `css: no raw hex colours outside ${TOKENS}, and no retired token names`
);
