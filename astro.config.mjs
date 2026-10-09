// @ts-check
import { readFileSync } from "node:fs";

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
// The privacy policy stays out of the sitemap while its front matter says `draft: true` (the page is also noindex).
const privacyDraft = /^draft:\s*true\s*$/m.test(
  readFileSync(new URL("./src/content/privacy.md", import.meta.url), "utf8")
);
const hidden = privacyDraft
  ? /\/(styleguide|404|privacy|thanks)\/?$/
  : /\/(styleguide|404|thanks)\/?$/;

// Fully prerendered static site (no adapter). Output: dist/, deployed to Cloudflare Pages.
export default defineConfig({
  site,
  trailingSlash: "ignore",
  build: { format: "directory", inlineStylesheets: "always" },
  integrations: [
    sitemap({
      // the style guide, the 404 page and a draft privacy policy stay out of search
      filter: (page) => !hidden.test(page),
    }),
  ],
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // keep min-/max-width media queries (range syntax needs Safari 16.4); the design already needs Safari 16 for
    // container query units and overflow:clip
    build: { cssTarget: ["chrome105", "edge105", "firefox110", "safari16"] },
  },
});
