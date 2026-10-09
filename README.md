# proudindian.ngo

The Proud Indian website: a fully prerendered [Astro](https://astro.build) site, styled with Tailwind CSS v4 on a token system, deployed to Cloudflare Pages.

One page for the Proud Indian NGO in Bengaluru: the programmes (Teach, Feed, Paint, Gather), the Kalakriti festival, upcoming volunteer sessions, donations, reports and trustees, plus a volunteer guide (`/volunteer/`), a privacy policy and an internal style guide.

- Repo: <https://github.com/proud-indian-ngo/website>. Pushes to `main` deploy to Cloudflare Pages (see [Deploying](#deploying-to-cloudflare-pages)).
- Brand tokens, primitive CSS, fonts and logo artwork come from [proud-indian-ngo/design](https://github.com/proud-indian-ngo/design) (`@proudindian/design`; see [Design package](#design-package-proudindiandesign)).
- Volunteer sign-up and events live in **pi-dash** ([proud-indian-ngo/dash](https://github.com/proud-indian-ngo/dash), `dash.proudindian.ngo`). Donations go to a **Razorpay** payment page.

## Run

Needs [Bun](https://bun.sh) 1.4.2+ (`packageManager` in `package.json`), which runs Astro (`bunx --bun astro`) and every script, and Node 22.12+ for the tools whose launchers ask for Node (Wrangler, the Playwright CLI, commitlint).

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
| `bun run check:fallow` | [fallow](https://fallow.tools): unused files, exports and dependencies, and duplicated code (both must be clean) |
| `bun run report:health` | fallow's complexity and maintainability report, with refactoring targets (advisory, not a gate) |
| `bun run check:updates` | List outdated dependencies interactively ([taze](https://github.com/antfu-collective/taze)); Renovate opens the PRs anyway |
| `bun run check:design` | The installed `@proudindian/design` matches the version the site expects; a `file:` install is not stale; the `public/` brand files are byte-identical to the package's |
| `bun run check:razorpay` | The live Razorpay page still pre-fills the amount from `site.yaml` → `links.razorpay` (item name and minimum; see [Donations](#donations)) |
| `bun run design:sync` | Copy the favicons and `og.png` from the package into `public/` (after a package update) |
| `bun run qa:behaviour` | Motion-on behaviour checks against a running site (reveals, loops, Pause, menu, drawer, donate, scroll lock); see [Quality checks](#quality-checks) |
| `bun run qa:doodles` | The margin doodles touch no content, rail, header pill or viewport edge, at 390 to 2560px, on the home page and the volunteer guide (serves `dist/` itself; run `bun run build` first, or set `SITE`; `PAGES` picks pages). See [Margin doodles](#margin-doodles) |
| `bun run qa:markdown` | Markdown for agents: serves `dist/` with the Pages Function (`wrangler pages dev`) and checks that `Accept: text/markdown` gets each page's Markdown while browsers get the HTML, `_headers` (Link included) and `_redirects` as before, and that `/.well-known/api-catalog` is a linkset (run `bun run build` first, or set `SITE` to a deployment). See [Search and AI agents](#search-and-ai-agents) |
| `bun run qa:events` | The events flow end to end against the mock feed (`bun run qa:events:mock`); see [Events](#events-volunteer-section) |
| `bun run qa:lighthouse` | Lighthouse ×3 on mobile and desktop, for the home page and the volunteer guide (`PAGES` picks pages), against `dist/` served like Cloudflare Pages; fails if accessibility, best practices or SEO drop below 100, or performance below 90, CLS above 0.1 or TBT above 200ms. CI runs it on pull requests and pushes (the `lighthouse` job, not required), mobile and desktop on separate runners; `FORMS=desktop` runs one |
| `bun run qa:perf` | Build, serve like Cloudflare Pages (brotli, `_headers`), Lighthouse ×5 on mobile and desktop, and the frame profiler at 4× and 6× CPU throttling (see [Performance](#performance)) |
| `bun run motion:load` | Regenerate `src/styles/sections/load-motion.css` (the header and hero load sequence) from `scripts/load-motion.ts`; `bun run check` fails if it is out of date |
| `bun run og` | Render the per-page share images (`src/content/og.yaml`) to `public/og/<page>.png`, in the brand card's style; `bun run og volunteer` renders one. Commit the PNGs. The home page keeps the package's `public/og.png` |

Lint and format match proud-indian-ngo/dash: oxlint (correctness rules as errors) and oxfmt (ultracite settings, inlined). oxfmt can sort Tailwind classes, but it does not format `.astro` files, so classes in markup are not auto-sorted.

### Conventions

These follow proud-indian-ngo/dash.
- **Hooks.** Lefthook (`bun install` sets it up) formats and lints staged files, runs the design and style checks and the type check on commit, and checks the commit message.
- **Commits and PR titles** are [Conventional Commits](https://www.conventionalcommits.org) (`feat: …`, `fix(events): …`, `chore(deps): …`; lower-case subject, at most 100 characters), checked by commitlint (`commitlint.config.ts`). Pull requests are squash-merged with the PR title as the commit message, so the title is what lands on `main`.
- **CI.** `.github/workflows/ci.yml` runs the `lighthouse` job beside `checks` on pull requests and pushes, with the scores in the run summary; it isn't required, because performance scores on shared runners vary, so the 100 target stays a manual check (`qa:perf`). It also runs the `checks` job (lint, types, fallow, build, `qa:behaviour`, `qa:doodles`, `qa:markdown`, and the Razorpay check as a warning, then the deploy) on every pull request and push. A change that only touches Markdown outside `src/` skips the browser checks and Lighthouse (`.github/docs-only.sh`), and the `events-changed` and nightly rebuilds skip lint, types and fallow, since the code is `main`'s and already checked. `checks` is required on `main`, which also needs a pull request with one approval (admins can push directly).
- **Dependencies.** [Renovate](https://docs.renovatebot.com) (`renovate.json`) opens update PRs on weekday mornings (IST): patches are grouped and automerged once `checks` passes, minor updates are grouped into one PR, and `@proudindian/design` releases get their own PR. Dependabot security updates and secret scanning (with push protection) are on.

## Environment

Copy `.env.example` to `.env` for local overrides.

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_EVENTS_URL` | unset | The pi-dash public events API. When unset, the poster points to the dashboard and no sessions are shown (see [Events](#events-volunteer-section)). |
| `PUBLIC_SITE_URL` | `https://proudindian.ngo` | Canonical origin for canonical links, Open Graph and the sitemap |

## Editing content

All content is YAML in `src/content/`, validated against typed schemas in `src/content.config.ts`, so a typo fails the build instead of shipping. Images are paths relative to `src/assets/` (e.g. `photos/teach-maths-class.jpg`). Put new images there; they are optimised at build time (AVIF with a JPG/PNG fallback, responsive widths, lazy-loaded).

| To change | Edit |
|---|---|
| Stats (3.6k+, 14k+, 23k+, 95%), registrations (80G, 12A, Darpan, PAN), founding date, emails, phone, addresses (registered office, community centre), social links, the register link, the Razorpay page | `src/content/site.yaml` |
| Any headline, paragraph, button label or section text | `src/content/copy.yaml`, in page order. `{placeholders}` such as `{darpan}` pull facts from `site.yaml`. |
| A programme band (Teach, Feed, Gather): line, chips, the three polaroids, the floor sticker | `src/content/programmes/teach.yaml`, `feed.yaml`, `gather.yaml` (`paint.yaml` only places Kalakriti in the order and the index rail) |
| Kalakriti: edition, date, numbers, the 8 events and their photos, tickets | `src/content/kalakriti.yaml` |
| Annual reports, audited financials, project disclosures | `src/content/reports.yaml` (kind, title, year or date, url), with the PDFs in `public/reports/`. Every count and year range on the page is derived from it. The drawer lists the first `copy.yaml` → `reports.disclosures.preview` disclosures, and its "See all" row reveals the rest in place. |
| Trustees | `src/content/trustees.yaml` (`fit` positions the cut-out in its tile) |
| Donation presets and the default amount | `copy.yaml` → `donate.card.presets` |
| The poster when sessions cannot be loaded | `copy.yaml` → `volunteer.unavailable` |
| The volunteer guide (`/volunteer/`): its hero, "What you'll do" cards, where we meet, internships and the FAQ | `src/content/volunteer.yaml`. The sessions, the how-to-join steps and the closing are shared with the home page (`copy.yaml`). FAQ answers can use `[text](url)` links and `{register}`, `{events}`, `{hr}`, `{connect}`, `{phone}`; emails become links. |
| The privacy policy | `src/content/privacy.md` (Markdown with front matter: `draft`, `draftNote`, `effectiveDate`, `lede`) |
| A page's share image (what WhatsApp, LinkedIn and X show for a link): its line, big word, chips, cut-outs and alt text | `src/content/og.yaml`, then `bun run og`; the page passes `og="<page>"` to `Base`. Pages without one use `public/og.png` |

The copy was finalised on 2026-10-08, with small edits on 2026-10-09 (donate fine print and labels, the volunteer fallback, fewer repeated stats, and the page title, description and volunteer lede for search). Change it deliberately.

The YAML is plain files in git, so a git-backed CMS (Keystatic or Sveltia CMS) can be pointed at `src/content/` later without changing the site.

## Events (Volunteer section)

The "Next up" poster shows the next session and the "More weekends" tickets show the three after it. With only one session the tickets row (heading, link and tickets) is hidden. With none, the poster switches to its empty state: the "Next up" pill, the alarm clock, "Nothing on the calendar yet.", a line and a "Register on the dashboard" button (`site.yaml` → `links.register`), with the same cut-out. Its copy is `copy.yaml` → `volunteer.empty`, and its `aria-label` is "No upcoming sessions". The tickets row is hidden.

The feed is pi-dash's `GET https://dash.proudindian.ngo/api/public/events` (proud-indian-ngo/dash#150): public, upcoming, not cancelled, never Kalakriti, no personal data, sorted by start time then id. With no query it returns Bengaluru (`city=bangalore`), the next 30 days, at most 20 events; `city`, `from`, `days` (≤ 90) and `limit` (≤ 50) narrow it, and a bad parameter gets a 400. Responses are cached for 5 minutes (`stale-while-revalidate` an hour), and it allows 60 requests a minute per IP.

1. **Build time.** `src/lib/events/load.ts` fetches `PUBLIC_EVENTS_URL` (8s timeout) and validates the response against `src/lib/events/contract.ts`: `{ generatedAt, events: [{ id, occurrenceDate, name, summary, startTime, endTime, area, city, team, programme?, signUpUrl }] }`. `endTime` equals `startTime` for an open-ended session, which then shows its start time only; `area` is just the city when no area is set. The poster and tickets are rendered into the HTML.
2. **Fallback.** If the variable is unset, or the request fails, times out or returns the wrong shape, the build has no sessions and marks them unavailable. The poster uses the empty-state layout with the `copy.yaml` → `volunteer.unavailable` copy ("Pick a weekend.", a line and a "See this week's sessions" button to `links.register`; `aria-label` "Upcoming sessions are on the dashboard"), and the tickets row is hidden. It never claims the calendar is empty, and the public never sees sample sessions or sign-up buttons for sessions that don't exist.
3. **Browser refresh.** On load, `src/scripts/events-refresh.ts` re-fetches the same URL with a ~4s timeout. If the data differs from what was built, it re-renders the poster and tickets with the same renderer the build used (`src/lib/events/render.ts`), and replaces the "unavailable" poster once live data arrives (with sessions, or the empty state if the answer is empty). An empty answer is followed: the page switches to the empty state, and if the build was empty and the refresh finds sessions, it switches to the normal poster and tickets. Errors and timeouts keep whatever was built.
4. **Links.** Sign-up links are each event's `signUpUrl`, used exactly as sent: `https://dash.proudindian.ngo/register?interestEventId=<id>[&occDate=YYYY-MM-DD]`. Never build them: `occDate` picks the occurrence of a recurring session, and pi-dash doesn't support other forms. A new volunteer registers, verifies their email and lands on the event with their interest filed; an existing one signs in and taps "Show interest". Only `https://dash.proudindian.ngo/` links are accepted. Times are shown in IST.
5. **CORS.** The feed allows any origin (`Access-Control-Allow-Origin: *`). On `localhost` and `127.0.0.1` the browser still skips the refresh of the production feed, so local runs and the QA don't change with the live sessions: the page keeps what the build fetched, which is enough for local work; a local mock feed over http still refreshes.

Test it locally against a mock endpoint:

```sh
bun scripts/qa/mock-events.ts &                                     # http://127.0.0.1:8788/events
for m in a empty one; do                                            # three builds: many, none, one session
  curl -sX POST 127.0.0.1:8788/mode/$m
  PUBLIC_EVENTS_URL=http://127.0.0.1:8788/events bunx --bun astro build --outDir /tmp/dist-events-$m
done
python3 -m http.server 4330 -d /tmp/dist-events-a &
python3 -m http.server 4331 -d /tmp/dist-events-empty &
python3 -m http.server 4332 -d /tmp/dist-events-one &
bun scripts/qa/events.ts     # switches the mock between a, b, one, empty, slow, error, bad (SITE, SITE_EMPTY, SITE_ONE override the ports)
```

**Rebuilds.** pi-dash checks the feed every 5 minutes and, when it changed, asks for a rebuild by sending the `events-changed` `repository_dispatch` to this repo (see [Deploying](#deploying-to-cloudflare-pages)); a nightly rebuild is the backstop. Visitors' browsers refresh the sessions on load either way.

## Donations

Buttons deep-link to Razorpay: `https://pages.razorpay.com/proud-indian-ngo-donate?your_donation=<rupees>`, with a minimum of ₹100. Below the minimum the total dims, the button reads "Enter ₹100 or more" and is `aria-disabled` (clicks do nothing), and a note appears once an amount is typed. Focusing or typing in the "Or enter another amount" field deselects the presets. The parameter name is the Razorpay item name in snake case. **If the item is renamed in Razorpay, the amount silently stops pre-filling** (it happened once: the item became "Your donation"). It is configured once, in `site.yaml` → `links.razorpay`. `bun run check:razorpay` reads the live page and fails if the parameter or the minimum no longer match; CI runs it on every deploy and flags a mismatch as a warning without blocking the deploy.

**After paying**, Razorpay sends donors to `/thanks/` (`src/pages/thanks.astro`, copy in `copy.yaml` → `thanks`): a thank-you page with the matka, what the gift does, the receipts they will get, the payment ID when Razorpay passes `razorpay_payment_id` back, and links to volunteering and the reports. It is noindex and out of the sitemap. Set it in Razorpay: Payment Pages → the donate page → Settings → "Redirect to a URL after successful payment" → `https://proudindian.ngo/thanks/`.

## Deploying to Cloudflare Pages

GitHub Actions checks, builds and deploys (`.github/workflows/ci.yml`, all in the `checks` job) with `wrangler pages deploy` (Wrangler is a devDependency) to the Cloudflare Pages project `proudindian` (<https://proudindian.pages.dev>) in the **Proud Indian** Cloudflare account. Cloudflare's own Git integration is not used.

| Trigger | Result |
|---|---|
| Push to `main` | Production deployment |
| Pull request | Preview deployment at `https://<branch>.proudindian.pages.dev` as soon as the site builds (the browser checks run after it), posted as a comment on the PR (one comment, updated on every push) and in the run summary. Pull requests from forks build and check but don't deploy. |
| `repository_dispatch` of type `events-changed` | Rebuild with fresh sessions (for pi-dash to call when an event changes) |
| Nightly at 06:00 IST | Rebuild, only once `PUBLIC_EVENTS_URL` is set |
| Run workflow (Actions tab) | Manual rebuild |

Every run installs with the frozen lockfile. Production deploys only once every check in `checks` has passed (see [Conventions](#conventions)), and uploads the exact `dist/` those checks tested; a pull request's preview goes up right after the build. The image cache (`node_modules/.astro`) is kept between runs, so a build takes about 2 seconds instead of 11.

**Secrets and variables** (repository settings → Secrets and variables → Actions):
- Secret `CLOUDFLARE_API_TOKEN`: an account-owned API token in the Proud Indian account ("GitHub Actions: proud-indian-ngo/website (Pages deploy)"), with Pages Write only. Replace it there if it leaks.
- Secret `CLOUDFLARE_ACCOUNT_ID`: the Proud Indian account ID.
- Variable `PUBLIC_EVENTS_URL`: the pi-dash events feed, `https://dash.proudindian.ngo/api/public/events` (see [Events](#events-volunteer-section)). The build in CI reads it; Cloudflare Pages doesn't build, so it isn't set there.

**Going live** is done in the Cloudflare dashboard, after the first deployment: add `proudindian.ngo` (and `www`) as custom domains of the Pages project, and redirect `www` to the bare domain.

The output is fully static, with no adapter. The one Pages Function, `functions/_middleware.ts`, serves the pages' Markdown to AI agents (see [Search and AI agents](#search-and-ai-agents)); `public/_routes.json` keeps the assets (`/_astro/*`, images, PDFs, icons, `llms.txt`, the sitemap, `/.well-known/*`) away from it, so only page requests count towards the Free plan's 100,000 Functions requests a day. Add a new top-level asset there too. `public/_headers` sets the following:
- **Caching:** a year, immutable, for the hashed `/_astro/*` assets; HTML revalidates on every visit; icons and the OG image get a day; the report PDFs in `/reports/*` get a year (served inline as `application/pdf`), so a corrected report needs a new file name.
- **Security headers:** HSTS, nosniff, frame denial, a referrer policy, a permissions policy and a CSP. The CSP `connect-src` allows `https://dash.proudindian.ngo`; if `PUBLIC_EVENTS_URL` points anywhere else, add that origin. Cloudflare Web Analytics is enabled for proudindian.ngo in the Cloudflare dashboard, so the CSP also allows its beacon: `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src`. Remove both if the analytics is turned off, and update the privacy policy (`src/content/privacy.md`) to match. `public/robots.txt` and the generated `sitemap-index.xml` exclude `/styleguide/`.
- **Link headers** ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)) for agent discovery: `/`, `/volunteer/` and `/privacy/` point to their Markdown (`rel="alternate"; type="text/markdown"`) and to `/llms.txt` (`rel="describedby"`); `/` also points to the API catalog (`rel="api-catalog"`). A new page with Markdown gets its own `Link` block.
- **API catalog:** `/.well-known/api-catalog` is served as `application/linkset+json`, cached for an hour.

## Search and AI agents

The site is meant to come up when someone, or an assistant answering for them, looks for weekend volunteering in Bengaluru or Bangalore.

- **Volunteer guide** (`/volunteer/`, `src/pages/volunteer.astro`): the page for "weekend volunteering in Bengaluru/Bangalore". Its title leads with that phrase; the home page's title is about the NGO (`copy.yaml` → `meta`), so the two don't compete for the same search. It has the live sessions, what you'd do, where we meet (with the community centre), internships and a visible FAQ, which also goes out as `FAQPage` structured data. The old site's volunteering, FAQ and internship URLs redirect to it. Keep both city names in titles and descriptions: people search for both.
- **Structured data.** The home page carries schema.org JSON-LD (`src/lib/structured-data.ts`): the `NGO` (registered office, the community centre with its map pin, contacts, registrations, socials, Bengaluru/Bangalore as the area served), the `WebSite`, and one free `Event` per upcoming session from the events feed, linking to its sign-up page. It is built from `site.yaml`, `copy.yaml` and the feed, so there is nothing to edit by hand; the rebuild on every events change keeps the sessions current. Check it with Google's [Rich Results Test](https://search.google.com/test/rich-results) after a deploy.
- **`/llms.txt`** (`src/pages/llms.txt.ts`, [llmstxt.org](https://llmstxt.org)): the site in plain Markdown for AI agents: what Proud Indian is, how to volunteer, the upcoming sessions with their sign-up links, programmes, donations, reports and contacts. Built from the same content and feed.
- **Markdown for agents** (content negotiation, as [Cloudflare's Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/) does, without its Pro plan): a request for `/`, `/volunteer/` or `/privacy/` whose `Accept` header asks for `text/markdown` (and likes it at least as much as `text/html`) gets the page as Markdown, with `Content-Type: text/markdown`, `Vary: Accept` and an `x-markdown-tokens` estimate. Browsers, search crawlers and a bare `*/*` get the HTML as before. The Markdown is built beside each page (`dist/volunteer/index.md`, from the `index.md.ts` endpoints in `src/pages/` and `src/lib/page-markdown.ts`, from the same content and feed; the home page's is the same text as `/llms.txt`), each page links it with `<link rel="alternate" type="text/markdown">` (`Base`'s `markdown` prop), and `functions/_middleware.ts` picks it per request. Fetched directly, the `.md` files are `noindex`. A new page gets Markdown with its own `index.md.ts`, the `markdown` prop, and a `noindex` line and a `Link` block in `_headers`. Try it with `curl -H "Accept: text/markdown" https://proudindian.ngo/volunteer/`; `bun run qa:markdown` checks it.
- **API catalog** (`public/.well-known/api-catalog`, [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727)): lists pi-dash's public events feed (`https://dash.proudindian.ngo/api/public/events`) for agents, with its OpenAPI description (`/api/public/openapi.json`, `service-desc`) and health check (`/api/health`, `status`). The spec lives in pi-dash next to the feed; edit this file only if the feed moves or another public API is added.
- **WebMCP** (`src/scripts/webmcp.ts`, [WebMCP](https://webmachinelearning.github.io/webmcp/)): in a browser with `document.modelContext`, the pages register tools for its AI agent. `list-volunteer-sessions` (read-only) returns the sessions on the page, as last refreshed; `start-volunteer-sign-up` opens a session's sign-up link; `fill-donation-amount` (home only) sets the donate card's amount and scrolls to it. The person still signs up on the dashboard and presses Donate and pays on Razorpay themselves; no tool books or pays. Without the API nothing runs. `qa:behaviour` checks the tools with a stand-in `modelContext`.
- **Redirects from the old site.** `public/_redirects` sends every page and report PDF of the old PHP site to where it lives now (301), so links and search ranking carry over: old pages go to their section of the home page, old PDFs to the identical file in `public/reports/` (matched by SHA-256). Keep them.
- **Crawlers.** `public/robots.txt` allows everyone except `/styleguide/` and declares [content signals](https://contentsignals.org/): `search=yes, ai-input=yes, ai-train=yes`, so search engines and AI assistants may index, quote and learn from the site (`ai-input` is what lets assistants use it in answers; set `ai-train=no` there to opt out of model training only). Cloudflare can still block AI crawlers before robots.txt is read (Security → Bots → "Block AI bots" / AI Crawl Control); since 9 October 2026 every search and AI crawler is allowed. Keep Cloudflare's managed robots.txt off, or it adds its own `Content-Signal` and `Disallow` lines on top of these.

## Styling

**Tailwind CSS v4** (`@tailwindcss/vite`, CSS-first: there is no `tailwind.config.js`) on top of the brand token system from [`@proudindian/design`](#design-package-proudindiandesign).

- **Tokens** come from the package: its `tokens/*.ts` generate `theme.css` and `tokens.css`, and `src/styles/global.css` imports both.
  - `theme.css` is a Tailwind `@theme static` block. It gives you `bg-sky`, `text-ink`, `bg-surface-paper`, `text-text-muted`, `text-accent-ink`, `font-pi-display`, `font-pi-sans`, `text-15`, `text-optimist`, `leading-lede`, `tracking-heading`, `rounded-pill`, `rounded-14`, `shadow-ink-sm`, `shadow-photo`, `max-w-section`, `ease-spring` and the breakpoints.
  - `tokens.css` holds plain custom properties for things Tailwind has no namespace for: z-index layers, durations, loop timings, the spacing steps used by hand-written CSS, the sticker and accent treatments, and the component knobs.
  - The brand fonts are `font-pi-display` (Bricolage Grotesque) and `font-pi-sans` (Geist). `font-display` and `font-sans` are not brand tokens: `font-sans` is Tailwind's default stack. `bun run lint:css` fails on `font-display`/`font-sans` and other retired token names.
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
- **Order.** `src/styles/global.css` imports everything in one order, and later files win on equal specificity, so the order matters. Tailwind's preflight is deliberately left out, because the design is built on its own reset: the package's `base.css`, then the site-only `src/styles/base.css` and `images.css`. `global.css` keeps `README.md` and `scripts/` out of Tailwind's class scan, because they mention utilities the site does not use.
- **Raw colours.** Hex colours are only allowed in the package's token files (`node_modules/@proudindian/design/tokens/`). `bun run lint:css` fails on a hex anywhere in `src/` (stylesheets and `.astro` `<style>` blocks). Inline SVG doodles keep their original fills.
- **Adding a token** happens in the design repo, not here. See its README ("Adding a token"); then bump the package and reinstall.
- **Style guide:** `/styleguide/` (noindex, not in the sitemap). It shows the swatches with contrast ratios, the type scale, space, radii, lines, shadows, breakpoints and motion demos (they respect Pause), and every primitive in every variant.

## Design package (`@proudindian/design`)

The tokens, primitive CSS, fonts, generic reset, custom utilities, favicons and logo artwork come from the shared design system [`@proudindian/design`](https://github.com/proud-indian-ngo/design). pi-dash uses the same package.

**Installing.** The package is not published to npm; it installs from its public GitHub repo, pinned to a tag:

```jsonc
"@proudindian/design": "github:proud-indian-ngo/design#v0.3.0"
```

The package commits its built `dist/`, so the install needs no build step and no token. bun blocks the package's `prepare` script (`lefthook install`), which is expected.

**Updating.**
1. In the design repo, open a PR that bumps `version` in `package.json`, adds the CHANGELOG section and commits the rebuilt `dist/`. Merging it tags `vX.Y.Z` and publishes the release automatically.
2. Point the dependency at the new tag and run `bun install`.
3. Run `bun run design:sync` if the favicons or the share card changed.
4. Run `bun run check`. `check:design` fails on a version outside `^0.3.0` (`COMPATIBLE` in `scripts/check-design.ts`) or a `public/` brand file that differs from the package.

To try unreleased design-package changes, point the dependency at a local checkout of the design repo (`"file:<path>"`) and reinstall with `rm -rf node_modules/@proudindian && bun install --force` after every change there (bun copies the folder at install time). Switch back to the tag before committing: CI can't see the checkout.

**What comes from the package:**

| What | Where it is used |
|---|---|
| `theme.css`, `tokens.css` | `src/styles/global.css` |
| `base.css` (generic reset) | `global.css`, before the site-only `src/styles/base.css` |
| `css/primitives/*.css` | `global.css`, one import per primitive, in cascade order |
| `css/utilities.css` | `global.css` |
| `fonts.css` and `fonts/*.woff2` | `global.css`. `src/layouts/Base.astro` preloads the files the page uses (`bricolage-grotesque-800-latin.woff2`, the static 800 display face, and `geist-latin-wght-normal.woff2`) via `@proudindian/design/fonts/*.woff2?url`, so Vite fingerprints them once and the preload URLs match the `@font-face` URLs. The variable Bricolage file is declared too, but only downloads if a page asks for another weight or width |
| `tokens` (TS) | `src/scripts/` (breakpoints, motion) and the style guide. The package's `dist/tokens` is split per module, so the client bundle gets only what it imports |
| `logo/seals/pi-seal-optimists-ring.svg` | `src/components/brand/Seal.astro` serves it as a lazy `<img>` (the seal only shows above the phone breakpoint, so phones never fetch it) |
| `logo/favicon/*`, `logo/social/og-default.png` | Copied into `public/` (see below) |
| `illustrations/outline-sprite.svg`, `illustrations/outline/manifest.json`, the `--doodle-outline-*` tokens | The margin doodles: `MarginSprite.astro` inlines the sprite once (`?raw`, only the symbols used), `MarginDoodles.astro` reads the aspect ratios, `margins.css` the line opacity and width (see [Margin doodles](#margin-doodles)) |

`global.css` imports these pieces separately rather than the package's `css/index.css`. That entry also carries the optional `.pi-brand` scope and the React-only `defaults.css`, which the site does not use.

**Favicons and the share card stay committed in `public/`.** They are `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `og.png`. Each is a byte-identical copy of a package file, which `check:design` enforces, and `design:sync` re-copies them. Committed copies keep `public/` complete for `astro build` run directly and for Cloudflare Pages, without a prebuild step. `public/site.webmanifest` is the site's own (description, `start_url`, absolute icon paths). The share card is rendered in the design repo (`bun run og`).

**What stays here, and why:**
- **Photos, cut-outs and scenes** (`src/assets/`, `src/components/scenes/`), the section markup and CSS, the progress ring, and the site-only base rules (`src/styles/base.css`, `images.css`). They belong to this site only.
- **The generic doodles** (`src/components/doodles/`) keep their own inline SVG. The package's `illustrations/*.svg` draw the same doodles, and its `manifest.json` maps each one to these components. But the package files were optimised with svgo: relative path data, stroke and fill set on the root `<svg>`, and the styling classes (`pi-ln`, `f2`, `ink`, `glow`, …) removed. The section CSS styles doodle internals through exactly those classes, for example `.pidx a.on .f2`, `.s-tr .gl-bird .pi-ln { stroke-width: 6 }` and `.s-don .matka .ink`. Inlining the package files, as components or at build time, would break those hooks. Edit a doodle's shape in the design repo first, then mirror it here.
- **The logo sprite** (`src/components/brand/LogoSprite.astro`, used by `Lockup.astro`). Its two `<symbol>`s are the package's `pi-lockup-compact-mono` and `pi-lockup-reversed` artwork, but the head dot is themable (`style="fill:var(--pi-accent,…)"`), and no package file has that.

## Structure

```
src/
  content.config.ts        typed content collections
  content/                 site.yaml, copy.yaml, kalakriti.yaml, reports.yaml, trustees.yaml, programmes/*.yaml
  assets/                  photos/, cutouts/, board/ (optimised at build)
  layouts/Base.astro       head (SEO, OG, Twitter, icons), motion decision, font preloads, scripts
  pages/                   index, volunteer (the volunteer guide), privacy (renders src/content/privacy.md), thanks (after
                           a donation), 404, styleguide,
                           llms.txt and index.md.ts endpoints (Markdown for AI agents)
  components/
    sections/              Header, PhoneMenu, ProgrammeIndex, Hero, Marquee, ProgrammesIntro, ProgrammeBand,
                           Kalakriti, Volunteer, Donate, Reports, Trustees, ReportsDrawer, Closing, Footer,
                           StickyDonateBar
    ui/                    primitives (Button, Chip, Sticker, Polaroid, Peg, Ticket, Card, SectionLabel, AccentWord,
                           Doodle, Img)
    doodles/               generic brand doodles (sun, book, bowl, heart, star, sparkle, clock, notepad, bird, ...),
                           inline SVG (see Design package)
    brand/                 logo sprite, lockup, seal (seal artwork from the package)
    scenes/                site-only SVG scenes (street scenes, bunting, clothesline, footer margins, plane path)
    volunteer/             the volunteer guide's own sections (hero, what you'd do, where, internships, FAQ); it reuses
                           Header, PhoneMenu, Volunteer, Closing, Footer and StickyDonateBar, whose "#…" links go to the
                           home page unless the page lists the anchor (`anchors`, src/lib/links.ts)
    margins/               margin doodles: placements.ts (seeded scatter), MarginDoodles (one layer per section),
                           MarginSprite (the package's outline sprite, inlined once)
  lib/                     content helpers, image resolver, events (contract, load, render, format), structured data
  scripts/                 client modules: reveal, loops, wobble, plane, coins, donate, reports drawer, rail, menu,
                           nudge, pause, events refresh (entry: main.ts)
  styles/                  global.css (entry: package CSS + site CSS), sections/, base.css (site-only), images.css
scripts/                   check-css.ts (style lint), check-design.ts (package check, design:sync),
                           qa/ (behaviour, doodles, events, markdown, mock-events, perf)
functions/                 _middleware.ts: the Cloudflare Pages Function that serves the Markdown to agents
public/                    _headers, _redirects (old site URLs), _routes.json (what runs the Pages Function), robots.txt, site.webmanifest, favicons and og.png (copies of package files),
                           reports/ (the report PDFs)
```

## Motion

Motion is small modules in `src/scripts/`:
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

Brand scrollbars are the site's own (`src/styles/scrollbar.css`, imported unlayered in `global.css`), on every desktop platform, macOS included: for mouse and trackpad users the page and any scroller get a thin 8px bar on a transparent track with a solid ink pill, sky on hover and deep sky while dragged (Firefox: the same colours at its thin width). Touch screens keep the native overlay scrollbar. The swipe rows and the footer photo strip show none.

**Swipe rows have arrows, not scrollbars.** The "More weekends" tickets and the Kalakriti line (`data-swipe`, `src/scripts/swipe.ts`, `src/styles/sections/swipe.css`) hide their scrollbar on every device. A round button at each end scrolls by about a card and only shows while there is more that way, so at widths where everything fits there are none. Touch swiping, the trackpad and the keyboard (the rows are focusable) work as before; the button labels are in `copy.yaml` (`volunteer.more.prev`/`next`) and `kalakriti.yaml` (`line.prev`/`next`).

**Scroll lock.** While the reports drawer or the phone menu is open, `lockScroll()` (`src/scripts/modal.ts`) puts `html.scroll-lock` (`overflow: hidden`) on `<html>`. The lock used to be `overflow: hidden` on `body`, which never reached the viewport (`html` has `overflow-x: clip`, so the viewport takes `html`'s overflow), and the page scrolled behind the drawer by hundreds of pixels. Now wheel, trackpad and touch drags over the dialog or its scrim, and Space, PageDown, arrows and End with focus inside it, leave the page where it is. The drawer and the menu scroll themselves with `overscroll-behavior: contain`, and closing restores the exact scroll position. With a classic scrollbar, `.scroll-gutter` (`scrollbar-gutter: stable`) keeps its gutter, so the page doesn't shift sideways. The class change restyles only `<html>` with the brand bar or with overlay bars. With a native classic bar (macOS set to always show scroll bars), Chromium restyles the page once on lock and once on unlock. `qa:behaviour` covers all of this (the `lock:` rows).

## Margin doodles

Light outline doodles in both side gutters of every section, the closing section and the footer, on wide screens only. They are static, `aria-hidden`, and never on tablets or phones.

- **Artwork** comes from the package: `@proudindian/design/illustrations/outline-sprite.svg`, 18 `pi-outline-*` symbols. `src/components/margins/MarginSprite.astro` inlines it once at the top of the page, keeping only the symbols the scatter uses. Each doodle is `<svg class="mg-d"><use href="#pi-outline-NAME"/></svg>`.
- **Placement** is a seeded scatter (`src/components/margins/placements.ts`), with one seed per section, so every build is identical. It is checked at a 2304px reference: a minimum distance between doodles on a side, never two on the same vertical line, no left/right mirroring, and uneven vertical gaps. Each doodle has its own position across the gutter, height, size (0.7 to 1.3×) and tilt (±25°). `MarginDoodles.astro` renders one layer per section (`set`, and `tone` for the background: paper, sky or ink).
- **When they show** (`src/styles/sections/margins.css`): Volunteer, Donate, Reports, Trustees and the footer from 1440px; the programme intro, Teach, Feed, Kalakriti, Gather and the closing section from 1800px; the hero from 1920px. The second half of each side's doodles appears from 1600px. Below 1440px there are none. From 1440px the footer's own scatter replaces its fixed margin set (`FooterMargins.astro`, still used below 1440px).
- **The rail column.** Four ways, Teach, Feed, Gather and Kalakriti keep a 212px no-go column at the right edge (`--mg-rail`: the programme rail and its widest label, 184px, plus air). The right-hand doodles there only appear once the strip beside the rail is wide enough.
- **Contrast** is matched to the footer's margin doodles (paper at 0.3 on ink, 2.56:1) through the package tokens: ink at `--doodle-outline-on-paper` (0.42, 2.61:1), ink at `--doodle-outline-on-sky` (0.47, 2.57:1), paper at `--doodle-outline-on-ink` (0.3). The stroke is `--doodle-outline-stroke`, 1.4px at any size.
- **Checks.** `bun run qa:doodles` loads the page at 390, 768, 1100, 1280, 1440, 1600, 1800, 1920, 2048, 2124, 2304 and 2560px. It fails if a visible doodle's box touches text, an image, a button or link, a sticker, polaroid, poster or card, any other SVG (the volunteer plane's flight included), the rail column, the header pills over the hero, or the viewport edge. Use `SABOTAGE=1` to see it fail.

## Performance

`bun run qa:perf` (about 25 minutes) builds to `/tmp/pi-perf-qa/dist`, serves it with `public/_headers` and brotli on port 4400, and reports:
- **Lighthouse**, median of 5, mobile and desktop: category scores, FCP/LCP/TBT/CLS/SI and every scored audit that isn't a perfect pass;
- **frames**, at 4× and 6× CPU throttling, 390px and 1440px: the hero load, the plane, a slow scroll through the page, idle on every section, wobble, coins, the menu and the drawer. "Bad" frames are the ones Chrome's smoothness metric counts as dropped (over 16.7ms); long tasks are over 50ms, and "anim" counts those during an animation.

It also checks the adaptive draw-ons: drawn at 1×–3×, lite at 4× and 6×, and the lite path plays as a wipe.

It exits non-zero unless Lighthouse is 100 in all four categories on both form factors (mobile Performance 99 is accepted; set `MOBILE_PERF_MIN=100` to tighten) and, at 4×, every scenario stays under 1% bad frames with no long task during an animation. `RUNS`, `RATES`, `WIDTHS`, `SKIP_LH`, `SKIP_FRAMES` and `SITE` narrow it down (see the script header). Images: give `Img`/`Sticker`/`Polaroid` a `phone` width (`"41vw"`, `"216px"`) whenever the phone size differs from the desktop one, so phones fetch the right file.

## Quality checks

`bun run check`, `bun run check:types`, `bun run qa:behaviour` and `bun run qa:doodles` are the bar for a change.

```sh
bun run build && bun run preview                # serves the site at http://localhost:4321 (or set SITE)
bun run qa:behaviour   # motion on: reveals, loops, Pause, reduced motion, wobble, hash links, rail, menu, drawer,
                       # donate deep links, coins, swipe, plane, the drawer and menu scroll lock; exits 1 on a failure
bun run qa:doodles     # margin doodles clear of content at 390-2560px (needs a build, or SITE=...)
bun run qa:markdown    # Accept: text/markdown gets Markdown, browsers get HTML (needs a build, or SITE=...)
```

## TODO

- [ ] **Privacy policy follow-ups.** Published on 2026-10-09 after an internal review (no lawyer). The `<!-- NOTE: ... -->` comments in `src/content/privacy.md` list what is still open: a verifiable parental-consent process for photos and Kalakriti before the DPDP Rules on it apply (13 May 2027), the R2 private-storage cutover, and the dashboard checking the 18+ rule at sign-up (a pi-dash pull request is in progress). A legal review is still worth doing when it becomes possible.
- [ ] **Custom domains.** Add `proudindian.ngo` and `www` to the Pages project once the Razorpay URLs are checked.
- [ ] **Real-device check.** The safe-area insets (notch, home indicator) for the sticky donate bar, the menu and the drawer are only verified in CSS; check them on an iPhone.
- [ ] **Razorpay redirects and webhooks.** Before moving DNS, check the Razorpay dashboard for a redirect URL or webhook pointing at the current PHP site (`payment_success.php`, `verify-razorpay-payment.php`, `webhooks-verify.php`). The new site has no server, so those stop working.
