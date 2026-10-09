# proudindian.ngo

The Proud Indian website: a fully prerendered [Astro](https://astro.build) site, styled with Tailwind CSS v4 on a token system, deployed to Cloudflare Pages.

- Repo: <https://github.com/proud-indian-ngo/website>. The local folder is `~/Code/pi-website`.
- Approved design: `proud-indian-design/prototypes/final/` (`index.html`, `site.css`, `site.js`). This site started as a pixel-for-pixel port of it (see [Quality checks](#quality-checks)). The 2026-10-09 design audit then changed a few areas on purpose: the tablet layouts (701–1239px), the donate card, the volunteer poster's fallback and the repeated stats. Expect `qa:parity` diffs there. Design decisions are recorded in `proud-indian-design/research/design-decisions.md`.
- Volunteer sign-up and events live in **pi-dash** (`dash.proudindian.ngo`). Donations go to a **Razorpay** payment page.

## Run

Needs [Bun](https://bun.sh) 1.4+ and Node 22.12+.

```sh
bun install
bun run dev        # http://localhost:4321
bun run build      # static site in dist/
bun run preview    # serve dist/ at http://localhost:4321
```

| Command | What it does |
|---|---|
| `bun run check` | Formatting (oxfmt), lint (oxlint), the design package check and the style lint (raw hex, retired token names) |
| `bun run check:types` | `astro check` (TypeScript 6; `astro check` does not support TypeScript 7 yet) |
| `bun run fix` | Format and auto-fix lint |
| `bun run check:design` | The installed `@proudindian/design` matches the version the site expects; a `file:` install is not stale; the `public/` brand files are byte-identical to the package's |
| `bun run design:sync` | Copy the favicons and `og.png` from the package into `public/` (after a package update) |
| `bun run qa:parity` | Screenshot the prototype and the site and diff them per section (see below) |
| `bun run qa:behaviour` | Motion-on behaviour checks against the prototype and the site, plus site-only scroll-lock checks for the reports drawer and the phone menu |
| `bun run qa:doodles` | The margin doodles touch no content, rail, header pill or viewport edge, at 390 to 2560px (serves `dist/` itself; run `bun run build` first, or set `SITE`). See [Margin doodles](#margin-doodles) |
| `bun run qa:perf` | Build, serve like Cloudflare Pages (brotli, `_headers`), Lighthouse ×5 on mobile and desktop, and the frame profiler at 4× and 6× CPU throttling (see [Performance](#performance)) |
| `bun run motion:load` | Regenerate `src/styles/sections/load-motion.css` (the header and hero load sequence) from `scripts/load-motion.ts`; `bun run check` fails if it is out of date |

Lint and format follow pi-dash: oxlint (correctness rules as errors) and oxfmt (pi-dash's ultracite settings, inlined). Lefthook runs them on commit (`bun install` sets up the hooks). oxfmt can sort Tailwind classes, but it does not format `.astro` files, so classes in markup are not auto-sorted.

## Environment

Copy `.env.example` to `.env` for local overrides.

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_EVENTS_URL` | unset | The pi-dash public events API. When unset, the poster points to the dashboard and no sessions are shown (see [Events](#events-volunteer-section)). |
| `PUBLIC_SITE_URL` | `https://proudindian.ngo` | Canonical origin for canonical links, Open Graph and the sitemap |
| `MARGIN_DOODLES` | unset | QA only: `off` builds the page without the margin doodles (no layers, no sprite), for parity diffs against the prototype at 1440px and up. Never set it in Cloudflare Pages. |

## Editing content

All content is YAML in `src/content/`, validated against typed schemas in `src/content.config.ts`, so a typo fails the build instead of shipping. Images are paths relative to `src/assets/` (e.g. `photos/teach-maths-class.jpg`). Put new images there; they are optimised at build time (AVIF with a JPG/PNG fallback, responsive widths, lazy-loaded).

| To change | Edit |
|---|---|
| Stats (3.6k+, 14k+, 23k+, 95%), registrations (80G, 12A, Darpan, PAN), founding date, emails, phone, address, social links, the register link, the Razorpay page | `src/content/site.yaml` |
| Any headline, paragraph, button label or section text | `src/content/copy.yaml`, in page order. `{placeholders}` such as `{darpan}` pull facts from `site.yaml`. |
| A programme band (Teach, Feed, Gather): line, chips, the three polaroids, the floor sticker | `src/content/programmes/teach.yaml`, `feed.yaml`, `gather.yaml` (`paint.yaml` only places Kalakriti in the order and the index rail) |
| Kalakriti: edition, date, numbers, the 8 events and their photos, tickets | `src/content/kalakriti.yaml` |
| Annual reports, audited financials, project disclosures | `src/content/reports.yaml` (kind, title, year or date, url), with the PDFs in `public/reports/`. Every count and year range on the page is derived from it. The drawer lists the first `copy.yaml` → `reports.disclosures.preview` disclosures, and its "See all" row reveals the rest in place. |
| Trustees | `src/content/trustees.yaml` (`fit` positions the cut-out in its tile) |
| Donation presets and the default amount | `copy.yaml` → `donate.card.presets` |
| The poster when sessions cannot be loaded | `copy.yaml` → `volunteer.unavailable` |
| The privacy policy | `src/content/privacy.md` (Markdown with front matter: `draft`, `draftNote`, `effectiveDate`, `lede`) |

The copy was finalised on 2026-10-08 from the prototype, with small edits in the 2026-10-09 audit (donate fine print and labels, the volunteer fallback, fewer repeated stats). Change it deliberately.

The YAML is plain files in git, so a git-backed CMS (Keystatic or Sveltia CMS) can be pointed at `src/content/` later without changing the site.

## Events (Volunteer section)

The "Next up" poster shows the next session and the "More weekends" tickets show the three after it. With only one session the tickets row (heading, link and tickets) is hidden. With none, the poster switches to its empty state: the "Next up" pill, the alarm clock, "Nothing on the calendar yet.", a line and a "Register on the dashboard" button (`site.yaml` → `links.register`), with the same cut-out. Its copy is `copy.yaml` → `volunteer.empty`, and its `aria-label` is "No upcoming sessions". The tickets row is hidden.

1. **Build time.** `src/lib/events/load.ts` fetches `PUBLIC_EVENTS_URL` (8s timeout) and validates the response against the contract in `src/lib/events/contract.ts`. The contract is `proud-indian-design/research/pi-dash-public-events-api.md`: `{ events: [{ id, occurrenceDate, name, summary, startTime, endTime, area, city, team, programme?, signUpUrl }], generatedAt }`. The poster and tickets are rendered into the HTML.
2. **Fallback.** If the variable is unset, or the request fails, times out or returns the wrong shape, the build has no sessions and marks them unavailable. The poster uses the empty-state layout with the `copy.yaml` → `volunteer.unavailable` copy ("Pick a weekend.", a line and a "See this week's sessions" button to `links.register`; `aria-label` "Upcoming sessions are on the dashboard"), and the tickets row is hidden. It never claims the calendar is empty, and the public never sees sample sessions or sign-up buttons for sessions that don't exist.
3. **Browser refresh.** On load, `src/scripts/events-refresh.ts` re-fetches the same URL with a ~4s timeout. If the data differs from what was built, it re-renders the poster and tickets with the same renderer the build used (`src/lib/events/render.ts`), and replaces the "unavailable" poster once live data arrives (with sessions, or the empty state if the answer is empty). An empty answer is followed: the page switches to the empty state, and if the build was empty and the refresh finds sessions, it switches to the normal poster and tickets. Errors and timeouts keep whatever was built.
4. **Links.** Sign-up links use the contract's `signUpUrl` (`https://dash.proudindian.ngo/register?next=/events/<id>`). Only `https://dash.proudindian.ngo/` links are accepted. Times are shown in IST.

Test it locally against a mock endpoint:

```sh
bun scripts/qa/mock-events.ts &                                     # http://127.0.0.1:8788/events
for m in a empty one; do                                            # three builds: many, none, one session
  curl -sX POST 127.0.0.1:8788/mode/$m
  PUBLIC_EVENTS_URL=http://127.0.0.1:8788/events bunx astro build --outDir /tmp/dist-events-$m
done
python3 -m http.server 4330 -d /tmp/dist-events-a &
python3 -m http.server 4331 -d /tmp/dist-events-empty &
python3 -m http.server 4332 -d /tmp/dist-events-one &
node scripts/qa/events.mjs     # switches the mock between a, b, one, empty, slow, error, bad (SITE, SITE_EMPTY, SITE_ONE override the ports)
```

To keep sessions fresh without visitors' browsers doing the work, add a Cloudflare Pages deploy hook and call it on a schedule (or from pi-dash when an event changes).

## Donations

Buttons deep-link to Razorpay: `https://pages.razorpay.com/proud-indian-ngo-donate?donate_an_amount_of_your_choice=<rupees>`, with a minimum of ₹100. Below the minimum the total dims, the button reads "Enter ₹100 or more" and is `aria-disabled` (clicks do nothing), and a note appears once an amount is typed. Focusing or typing in the "Or enter another amount" field deselects the presets. The parameter name is the Razorpay item name in snake case. **If the item is renamed in Razorpay, the amount silently stops pre-filling.** It is configured once, in `site.yaml` → `links.razorpay`.

## Deploying to Cloudflare Pages

GitHub Actions builds and deploys (`.github/workflows/deploy.yml`) with `wrangler pages deploy` to the Cloudflare Pages project `proudindian` (<https://proudindian.pages.dev>) in the **Proud Indian** Cloudflare account. Cloudflare's own Git integration is not used.

| Trigger | Result |
|---|---|
| Push to `main` | Production deployment |
| Pull request | Preview deployment at `https://<branch>.proudindian.pages.dev`, linked in the run summary. Pull requests from forks build and check but don't deploy. |
| `repository_dispatch` of type `events-changed` | Rebuild with fresh sessions (for pi-dash to call when an event changes) |
| Nightly at 06:00 IST | Rebuild, only once `PUBLIC_EVENTS_URL` is set |
| Run workflow (Actions tab) | Manual rebuild |

Every run installs with the frozen lockfile and runs `bun run check`, `bun run check:types` and `bun run build` before deploying. The image cache (`node_modules/.astro`) is kept between runs, so a build takes about 2 seconds instead of 11.

**Secrets and variables** (repository settings → Secrets and variables → Actions):
- Secret `CLOUDFLARE_API_TOKEN`: an account-owned API token in the Proud Indian account ("GitHub Actions: proud-indian-ngo/website (Pages deploy)"), with Pages Write only. Replace it there if it leaks.
- Secret `CLOUDFLARE_ACCOUNT_ID`: the Proud Indian account ID.
- Variable `PUBLIC_EVENTS_URL`: set it once the pi-dash endpoint ships (see [Events](#events-volunteer-section)).

**Going live** is done in the Cloudflare dashboard, after the first deployment: add `proudindian.ngo` (and `www`) as custom domains of the Pages project, and redirect `www` to the bare domain.

The output is fully static, with no adapter and no functions. `public/_headers` sets the following:
- **Caching:** a year, immutable, for the hashed `/_astro/*` assets; HTML revalidates on every visit; icons and the OG image get a day; the report PDFs in `/reports/*` get a year (served inline as `application/pdf`), so a corrected report needs a new file name.
- **Security headers:** HSTS, nosniff, frame denial, a referrer policy, a permissions policy and a CSP. The CSP `connect-src` allows `https://dash.proudindian.ngo`; if `PUBLIC_EVENTS_URL` points anywhere else, add that origin. Cloudflare Web Analytics is enabled for proudindian.ngo in the Cloudflare dashboard, so the CSP also allows its beacon: `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src`. Remove both if the analytics is turned off, and update the privacy policy (`src/content/privacy.md`) to match. `public/robots.txt` and the generated `sitemap-index.xml` exclude `/styleguide/`.

## Styling

**Tailwind CSS v4** (`@tailwindcss/vite`, CSS-first: there is no `tailwind.config.js`) on top of the brand token system from [`@proudindian/design`](#design-package-proudindiandesign).

- **Tokens** come from the package: its `tokens/*.ts` generate `theme.css` and `tokens.css`, and `src/styles/global.css` imports both.
  - `theme.css` is a Tailwind `@theme static` block. It gives you `bg-sky`, `text-ink`, `bg-surface-paper`, `text-text-muted`, `text-accent-ink`, `font-pi-display`, `font-pi-sans`, `text-15`, `text-optimist`, `leading-lede`, `tracking-heading`, `rounded-pill`, `rounded-14`, `shadow-ink-sm`, `shadow-photo`, `max-w-section`, `ease-spring` and the breakpoints.
  - `tokens.css` holds plain custom properties for things Tailwind has no namespace for: z-index layers, durations, loop timings, the spacing steps used by hand-written CSS, the sticker and accent treatments, and the component knobs.
  - The brand fonts are `font-pi-display` (Bricolage Grotesque) and `font-pi-sans` (Geist). `font-display` and `font-sans` are not brand tokens: `font-sans` is Tailwind's default stack. `bun run lint:css` fails on the old names.
- **Breakpoints** are `--breakpoint-*`. The design is desktop-first, so overrides mostly use `max-*`:
  - `max-tab:` is phones (700px and below).
  - `max-nav:` is 1180px and below, `max-lap:` 1100px and below, and `max-pad:` 600px and below.
  - In CSS, write `@media (width < --theme(--breakpoint-tab))`. Scripts import the numbers from `@proudindian/design/tokens`.
- **Primitives** are the package's plain-class CSS (`css/primitives/`: `.pi-btn`, `.pi-chip`, `.pi-sticker`, `.pi-polaroid`, `.pi-peg`, `.pi-tape`, `.pi-ticket`, `.pi-card`, `.pi-label`, `.pi-accent`, `.pi-ln`/`.pi-doodle`), imported in `@layer components`. pi-dash's React components use exactly the same CSS. The Astro wrappers in `src/components/ui/` only apply those classes: `Button`, `Chip`, `Sticker`, `Polaroid` + `Peg`, `Ticket`, `Card`, `SectionLabel`, `AccentWord`, `Doodle` and `Img`. The package's `css/utilities.css` adds a few custom utilities: `border-line`, `border-t-line`, `border-line-dashed`, `border-t-heavy-dashed` and `sticker-outline`.
- **Sections** use utilities in their markup. What utilities express badly stays as small, token-based CSS in `src/styles/sections/`:
  - keyframes and the `html[data-motion]` gating;
  - the reveal hiding;
  - text strokes and accent shadows;
  - the sticker drop-shadow stacks, masks and clip-paths;
  - art-directed positions (the collage, stickers and seal);
  - complex grids (the hero, bands and bento);
  - JS-state styles (`.on`, `.show`, `[aria-pressed]`).
- **Order.** `src/styles/global.css` imports everything in one order, and that order is the prototype's cascade. Tailwind's preflight is deliberately left out, because the design was built on the prototype's own reset: the package's `base.css`, then the site-only `src/styles/base.css` and `images.css`. `global.css` keeps `README.md` and `scripts/` out of Tailwind's class scan, because they mention utilities the site does not use.
- **Raw colours.** Hex colours are only allowed in the package's token files (`node_modules/@proudindian/design/tokens/`). `bun run lint:css` fails on a hex anywhere in `src/` (stylesheets and `.astro` `<style>` blocks). Inline SVG doodles keep their original fills.
- **Adding a token** happens in pi-design, not here. See its README ("Adding a token"); then bump the package and reinstall.
- **Style guide:** `/styleguide/` (noindex, not in the sitemap). It shows the swatches with contrast ratios, the type scale, space, radii, lines, shadows, breakpoints and motion demos (they respect Pause), and every primitive in every variant.

## Design package (`@proudindian/design`)

The tokens, primitive CSS, fonts, generic reset, custom utilities, favicons and logo artwork come from the shared design system [`@proudindian/design`](https://github.com/proud-indian-ngo/design) (local folder `~/Code/pi-design`). pi-dash uses the same package.

**Installing.** The package is not published to npm; it installs from its public GitHub repo, pinned to a tag:

```jsonc
"@proudindian/design": "github:proud-indian-ngo/design#v0.2.3"
```

The package commits its built `dist/`, so the install needs no build step and no token. bun blocks the package's `prepare` script (`lefthook install`), which is expected.

**Updating.**
1. Change pi-design, run `bun run build` there, bump its version, commit, tag and push (`git tag -a v0.2.4 -m v0.2.4 && git push --follow-tags`).
2. Point the dependency at the new tag and run `bun install`.
3. Run `bun run design:sync` if the favicons or the share card changed.
4. Run `bun run check`. `check:design` fails on a version outside `^0.2.3` (`COMPATIBLE` in `scripts/check-design.ts`) or a `public/` brand file that differs from the package.

To try unreleased pi-design changes locally, link the folder (`"file:../pi-design"`) and reinstall with `rm -rf node_modules/@proudindian && bun install --force` after every change there (bun copies the folder at install time). Switch back to the tag before committing: CI can't see `../pi-design`.

**What comes from the package:**

| What | Where it is used |
|---|---|
| `theme.css`, `tokens.css` | `src/styles/global.css` |
| `base.css` (generic reset) | `global.css`, before the site-only `src/styles/base.css` |
| `css/primitives/*.css` | `global.css`, one import per primitive, in the prototype's cascade order |
| `css/utilities.css` | `global.css` |
| `fonts.css` and `fonts/*.woff2` | `global.css`. `src/layouts/Base.astro` preloads the files the page uses (`bricolage-grotesque-800-latin.woff2`, the static 800 display face, and `geist-latin-wght-normal.woff2`) via `@proudindian/design/fonts/*.woff2?url`, so Vite fingerprints them once and the preload URLs match the `@font-face` URLs. The variable Bricolage file is declared too, but only downloads if a page asks for another weight or width |
| `tokens` (TS) | `src/scripts/` (breakpoints, motion) and the style guide. The package's `dist/tokens` is split per module, so the client bundle gets only what it imports |
| `logo/seals/pi-seal-optimists-ring.svg` | `src/components/brand/Seal.astro` serves it as a lazy `<img>` (the seal only shows above the phone breakpoint, so phones never fetch it) |
| `logo/favicon/*`, `logo/social/og-default.png` | Copied into `public/` (see below) |
| `illustrations/outline-sprite.svg`, `illustrations/outline/manifest.json`, the `--doodle-outline-*` tokens | The margin doodles: `MarginSprite.astro` inlines the sprite once (`?raw`, only the symbols used), `MarginDoodles.astro` reads the aspect ratios, `margins.css` the line opacity and width (see [Margin doodles](#margin-doodles)) |

`global.css` imports these pieces separately rather than the package's `css/index.css`. That entry also carries the optional `.pi-brand` scope and the React-only `defaults.css`, which the site does not use.

**Favicons and the share card stay committed in `public/`.** They are `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `og.png`. Each is a byte-identical copy of a package file, which `check:design` enforces, and `design:sync` re-copies them. Committed copies keep `public/` complete for `astro build` run directly and for Cloudflare Pages, without a prebuild step. `public/site.webmanifest` is the site's own (description, `start_url`, absolute icon paths). The share card is rendered in pi-design (`bun run og`).

**What stays here, and why:**
- **Photos, cut-outs and scenes** (`src/assets/`, `src/components/scenes/`), the section markup and CSS, the progress ring, and the site-only base rules (`src/styles/base.css`, `images.css`). They belong to this site only.
- **The generic doodles** (`src/components/doodles/`) keep the prototype's inline SVG. The package's `illustrations/*.svg` draw the same doodles, and its `manifest.json` maps each one to these components. But the package files were optimised with svgo: relative path data, stroke and fill set on the root `<svg>`, and the styling classes (`pi-ln`, `f2`, `ink`, `glow`, …) removed. The section CSS styles doodle internals through exactly those classes, for example `.pidx a.on .f2`, `.s-tr .gl-bird .pi-ln { stroke-width: 6 }` and `.s-don .matka .ink`. Inlining the package files, as components or at build time, would break those hooks and risk pixel drift. Edit a doodle's shape in pi-design first, then mirror it here.
- **The logo sprite** (`src/components/brand/LogoSprite.astro`, used by `Lockup.astro`). Its two `<symbol>`s are the package's `pi-lockup-compact-mono` and `pi-lockup-reversed` artwork, but the head dot is themable (`style="fill:var(--pi-accent,…)"`), and no package file has that.

## Structure

```
src/
  content.config.ts        typed content collections
  content/                 site.yaml, copy.yaml, kalakriti.yaml, reports.yaml, trustees.yaml, programmes/*.yaml
  assets/                  photos/, cutouts/, board/ (optimised at build)
  layouts/Base.astro       head (SEO, OG, Twitter, icons), motion decision, font preloads, scripts
  pages/                   index, privacy (renders src/content/privacy.md), 404, styleguide
  components/
    sections/              Header, PhoneMenu, ProgrammeIndex, Hero, Marquee, ProgrammesIntro, ProgrammeBand,
                           Kalakriti, Volunteer, Donate, Reports, Trustees, ReportsDrawer, Closing, Footer,
                           StickyDonateBar
    ui/                    primitives (Button, Chip, Sticker, Polaroid, Peg, Ticket, Card, SectionLabel, AccentWord,
                           Doodle, Img)
    doodles/               generic brand doodles (sun, book, bowl, heart, star, sparkle, clock, notepad, bird, ...),
                           inline prototype SVG (see Design package)
    brand/                 logo sprite, lockup, seal (seal artwork from the package)
    scenes/                site-only SVG scenes (street scenes, bunting, clothesline, footer margins, plane path)
    margins/               margin doodles: placements.ts (seeded scatter), MarginDoodles (one layer per section),
                           MarginSprite (the package's outline sprite, inlined once)
  lib/                     content helpers, image resolver, events (contract, load, render, format)
  scripts/                 client modules: reveal, loops, wobble, plane, coins, donate, reports drawer, rail, menu,
                           nudge, pause, events refresh (entry: main.ts)
  styles/                  global.css (entry: package CSS + site CSS), sections/, base.css (site-only), images.css
scripts/                   check-css.ts (style lint), check-design.ts (package check, design:sync),
                           qa/ (parity, behaviour, doodles, events, mock-events, perf)
public/                    _headers, robots.txt, site.webmanifest, favicons and og.png (copies of package files),
                           reports/ (the report PDFs)
```

## Motion

Motion is ported from `site.js` (decision 11) as small modules in `src/scripts/`:
- the reveal system (`data-reveal`, `data-stagger`);
- `.loop` elements that pause off-screen;
- the wobble on stickers, the paper plane, the coin drop and the nudge hand;
- the Pause motion toggle (WCAG 2.2.2), which persists in `localStorage`.

Reduced motion turns everything off. Content is visible without JS: only `html.js-reveal[data-motion=on]` hides elements that have not revealed yet.

Motion is built to stay on the compositor (performance pass, 2026-10-08):
- **Header and hero load sequence** is CSS (`src/styles/sections/load-motion.css`, generated by `scripts/load-motion.ts`; run `bun run motion:load` after changing it). It starts with the first paint, gated on `html.js[data-motion=on]` from the inline head script, so the finished hero never paints and then vanishes on a slow phone. The reveal script only marks those elements as played and sets `html.ld-done` when the CSS animations end, so Resume never replays them. The hero lede is readable from the first frame and only rises.
- **Reveals** animate the individual `translate`/`rotate`/`scale` properties (they stack on each element's own `transform` and its sway), never `transform` with `composite: "add"`, which Chrome can't run on the compositor. SVG elements animate `transform` from their resting transform.
- **Loops** are held until the first visibility pass (`html.loops-on`), so off-screen loops don't tick on the main thread during load. The street scene's animated groups give their line width in drawing units (`--scene-k`) instead of `vector-effect: non-scaling-stroke`, which would keep them off the compositor.
- **Adaptive draw-ons** (`src/scripts/lite.ts`). The hand-drawn reveals (`stroke-dashoffset`) are the one kind of motion Chrome can't composite. On a fast device they stay drawn. On a slow one, `html.lite-draw` swaps every draw-on that hasn't played for a compositor-only left-to-right `clip-path` wipe of the drawing. That covers strings, doodles, the street scene, underlines and squiggles, and the step arrows. The checklist ticks grow in with `scaleX`, the plane's trail fades in along the flight, and the 95% ring arc fades in. The decision is made once per page load and kept for the tab in `sessionStorage`; it never switches back mid-page. It works in three steps:
  1. Device hints: cores, memory, Save-Data and connection type. These only lower the bar, never decide alone.
  2. A 300k-step timed loop at boot. Lite at ≥ 5.5ms, or ≥ 4.5ms with two hints.
  3. Otherwise, long animation frames after the first render. Lite at ≥ 120ms in the first 1.2s. Browsers without that API use the share of slow `requestAnimationFrame` intervals instead.

  Calibrated with Chrome's CPU throttling: unthrottled, 2× and 3× stay drawn; 4× and 6× switch at boot. `?draw=lite` or `?draw=full` forces a mode, `window.__piDraw` shows the inputs, and `qa:perf` checks both the decision and the wipe path. With lite on, only the drawn ticks of fast devices (and nothing else) run on the main thread.
- **Reveals are for headlines only** (about 40 elements: section heads and a few headline groups). Body copy, stats, cards, photos, forms and list rows are simply there. A hash link that jumps more than 1.5 viewports reveals the target first and scrolls instantly, so the destination is never blank.
- **Opening a dialog stays responsive.** The phone menu and the reports drawer open on the first frame; `inert` on the page behind is applied in small chunks over the next frames (`src/scripts/modal.ts`), so no single task blocks.
- **Hover effects need a real pointer.** Every `:hover` style is gated on `(hover: hover) and (pointer: fine)`, so taps never leave a stuck hover state; buttons and cards get a short `:active` press instead.
- The paper plane's path is sampled from its Bézier curves (no `getPointAtLength`); the scroll backstop for reveals and loops runs at most every 100ms; the phone menu and the reports drawer are laid out once while the page is idle, so the first tap is cheap.

## Scrollbars

Brand scrollbars come from `@proudindian/design/scrollbar.css` (imported in `global.css`). For mouse and trackpad users the page gets an 8px ink pill on a transparent track, turning sky on hover. The swipe rows (the Kalakriti line and the session tickets, which scroll below 700px; the footer photo strip carries the class too, but it only shows on wider screens, where it doesn't scroll) get a 4px bar (`.pi-scroll-thin`), with a paper thumb on Kalakriti's ink (`.pi-scroll-dark`). On touch screens the rows keep hiding their bars and the page keeps the native overlay scrollbar. Chromium and Safari use `::-webkit-scrollbar`; Firefox uses `scrollbar-width`/`scrollbar-color`. The package file's header explains why.

**macOS keeps its native scrollbars.** The inline head script in `Base.astro` sets `html[data-native-scrollbar]` on a Mac (`navigator.userAgentData.platform === "macOS"`, else `/Mac/` in `navigator.platform` or the user agent), but not on an iPad, which reports "MacIntel" with touch points (`maxTouchPoints > 1`). The attribute switches off every rule in the package's `scrollbar.css`, for the page and the swipe rows alike, so Safari and Chrome on macOS draw the system's default scrollbars. Windows, Linux and ChromeOS keep the brand bar. The script runs before the stylesheet (Astro inlines the CSS after it in `<head>`), so the custom bar never flashes. Verified in Chromium with classic scrollbars (`--disable-features=OverlayScrollbar`, no `--hide-scrollbars`) by emulating the platform with an init script: Linux and Windows get the 8px page bar and 4px row bars; macOS (with or without `userAgentData`) gets the native 15px bars and none of the package's scrollbar rules match; an iPad-like "MacIntel" with touch points keeps the brand styles.

**Scroll lock.** While the reports drawer or the phone menu is open, `lockScroll()` (`src/scripts/modal.ts`) puts `html.scroll-lock` (`overflow: hidden`) on `<html>`. The lock used to be `overflow: hidden` on `body`, which never reached the viewport (`html` has `overflow-x: clip`, so the viewport takes `html`'s overflow), and the page scrolled behind the drawer by hundreds of pixels. Now wheel, trackpad and touch drags over the dialog or its scrim, and Space, PageDown, arrows and End with focus inside it, leave the page where it is. The drawer and the menu scroll themselves with `overscroll-behavior: contain`, and closing restores the exact scroll position. With a classic scrollbar, `.scroll-gutter` (`scrollbar-gutter: stable`) keeps its gutter, so the page doesn't shift sideways. The class change restyles only `<html>` with the brand bar or with overlay bars. With a native classic bar (macOS set to always show scroll bars), Chromium restyles the page once on lock and once on unlock. `qa:behaviour` covers all of this (the `lock:` rows).

## Margin doodles

Light outline doodles in both side gutters of every section, the closing section and the footer, on wide screens only (design-decisions.md, decisions 10 and 11, "Margin doodles"). They are static, `aria-hidden`, and never on tablets or phones.

- **Artwork** comes from the package: `@proudindian/design/illustrations/outline-sprite.svg`, 18 `pi-outline-*` symbols. `src/components/margins/MarginSprite.astro` inlines it once at the top of the page, keeping only the symbols the scatter uses. Each doodle is `<svg class="mg-d"><use href="#pi-outline-NAME"/></svg>`.
- **Placement** is a seeded scatter (`src/components/margins/placements.ts`), with one seed per section, so every build is identical. It is checked at a 2304px reference: a minimum distance between doodles on a side, never two on the same vertical line, no left/right mirroring, and uneven vertical gaps. Each doodle has its own position across the gutter, height, size (0.7 to 1.3×) and tilt (±25°). `MarginDoodles.astro` renders one layer per section (`set`, and `tone` for the background: paper, sky or ink).
- **When they show** (`src/styles/sections/margins.css`): Volunteer, Donate, Reports, Trustees and the footer from 1440px; the programme intro, Teach, Feed, Kalakriti, Gather and the closing section from 1800px; the hero from 1920px. The second half of each side's doodles appears from 1600px. Below 1440px there are none. From 1440px the footer's own scatter replaces its fixed margin set (`FooterMargins.astro`, still used below 1440px).
- **The rail column.** Four ways, Teach, Feed, Gather and Kalakriti keep a 212px no-go column at the right edge (`--mg-rail`: the programme rail and its widest label, 184px, plus air). The right-hand doodles there only appear once the strip beside the rail is wide enough.
- **Contrast** is matched to the footer's margin doodles (paper at 0.3 on ink, 2.56:1) through the package tokens: ink at `--doodle-outline-on-paper` (0.42, 2.61:1), ink at `--doodle-outline-on-sky` (0.47, 2.57:1), paper at `--doodle-outline-on-ink` (0.3). The stroke is `--doodle-outline-stroke`, 1.4px at any size.
- **Checks.** `bun run qa:doodles` loads the page at 390, 768, 1100, 1280, 1440, 1600, 1800, 1920, 2048, 2124, 2304 and 2560px. It fails if a visible doodle's box touches text, an image, a button or link, a sticker, polaroid, poster or card, any other SVG (the volunteer plane's flight included), the rail column, the header pills over the hero, or the viewport edge. Use `SABOTAGE=1` to see it fail. `MARGIN_DOODLES=off bun run build` builds without them, for parity diffs against the prototype at 1440px and up.

## Performance

`bun run qa:perf` (about 25 minutes) builds to `/tmp/pi-perf-qa/dist`, serves it with `public/_headers` and brotli on port 4400, and reports:
- **Lighthouse**, median of 5, mobile and desktop: category scores, FCP/LCP/TBT/CLS/SI and every scored audit that isn't a perfect pass;
- **frames**, at 4× and 6× CPU throttling, 390px and 1440px: the hero load, the plane, a slow scroll through the page, idle on every section, wobble, coins, the menu and the drawer. "Bad" frames are the ones Chrome's smoothness metric counts as dropped (over 16.7ms); long tasks are over 50ms, and "anim" counts those during an animation.

It also checks the adaptive draw-ons: drawn at 1×–3×, lite at 4× and 6×, and the lite path plays as a wipe.

It exits non-zero unless Lighthouse is 100 in all four categories on both form factors (mobile Performance 99 is accepted; set `MOBILE_PERF_MIN=100` to tighten) and, at 4×, every scenario stays under 1% bad frames with no long task during an animation. `RUNS`, `RATES`, `WIDTHS`, `SKIP_LH`, `SKIP_FRAMES` and `SITE` narrow it down (see the script header). Images: give `Img`/`Sticker`/`Polaroid` a `phone` width (`"41vw"`, `"216px"`) whenever the phone size differs from the desktop one, so phones fetch the right file.

## Quality checks

```sh
python3 -m http.server 63782 --bind 127.0.0.1   # from proud-indian-design, serves the prototype
bun run build && bun run preview                # serves the site
bun run qa:parity      # reduced motion, 1440 / 2048 / 390, full page and per section, to /tmp/pi-astro/
bun run qa:behaviour   # motion on: reveals, loops, Pause, reduced motion, wobble, hash links, rail, menu, drawer,
                       # donate deep links, coins, swipe, plane; the drawer and menu scroll lock (site-only)
bun run qa:doodles     # margin doodles clear of content at 390-2560px (needs a build, or SITE=...)
```

## TODO

- [ ] **Privacy policy.** The draft text is in `src/content/privacy.md` (Markdown; `/privacy/` builds its table of contents from the `##` headings). It needs legal review, and every `<!-- CONFIRM: ... -->` note in it answered. Then set `effectiveDate` and `draft: false`, which removes the draft note, the noindex and the sitemap exclusion.
- [ ] **pi-dash events endpoint.** `GET /api/public/events` is not implemented yet. When it ships:
  - set `PUBLIC_EVENTS_URL` in Cloudflare Pages;
  - have pi-dash send CORS headers for `https://proudindian.ngo` (plus preview origins), GET only;
  - keep `connect-src` in `public/_headers` in step.
- [ ] **Custom domains.** Add `proudindian.ngo` and `www` to the Pages project once the Razorpay URLs are checked.
- [ ] **Real-device check.** The safe-area insets (notch, home indicator) for the sticky donate bar, the menu and the drawer are only verified in CSS; check them on an iPhone.
- [ ] **Razorpay redirects and webhooks.** Before moving DNS, check the Razorpay dashboard for a redirect URL or webhook pointing at the old site (`payment_success.php`, `verify-razorpay-payment.php`, `webhooks-verify.php`). The new site has no server, so those stop working.
- [ ] **Razorpay page copy.** The payment page still has the old site's text (design-decisions.md, "Facts update: donations").
