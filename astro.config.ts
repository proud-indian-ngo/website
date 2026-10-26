import { readdirSync, readFileSync } from "node:fs";

import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

const env = loadEnv(
  process.env.NODE_ENV ?? "production",
  process.cwd(),
  "PUBLIC_"
);
const site = env.PUBLIC_SITE_URL || "https://proudindian.ngo";
// A Markdown page (src/content/<page>.md, rendered at /<page>/) stays out of the sitemap while its front matter says
// `draft: true` (the page is also noindex).
const content = new URL("./src/content/", import.meta.url);
const drafts = readdirSync(content)
  .filter(
    (f) =>
      f.endsWith(".md") &&
      /^draft:\s*true\s*$/m.test(readFileSync(new URL(f, content), "utf8"))
  )
  .map((f) => f.slice(0, -3));
const hidden = new RegExp(
  `/(${["styleguide", "brand", "404", "thanks", ...drafts].join("|")})/?$`
);

// Fully prerendered static site (no adapter). Output: dist/, deployed to Cloudflare Pages.
export default defineConfig({
  site,
  trailingSlash: "ignore",
  build: { format: "directory", inlineStylesheets: "always" },
  integrations: [
    sitemap({
      // the style guide, the brand kit, the 404 page and draft Markdown pages stay out of search
      filter: (page) => !hidden.test(page),
    }),
  ],
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // keep min-/max-width media queries (range syntax needs Safari 16.4); the design already needs Safari 16 for
    // container query units and overflow:clip
    build: {
      cssTarget: ["chrome105", "edge105", "firefox110", "safari16"],
      // the interface sounds are fetched, and the CSP's connect-src has no data:, so even the small ones stay files
      assetsInlineLimit: (file) => (file.endsWith(".mp3") ? false : undefined),
    },
  },
});
