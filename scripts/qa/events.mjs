/**
 * Events flow, end to end, against scripts/qa/mock-events.ts. Three builds of the site, each served on its own port:
 *   SITE        built while the mock returned "a" (three sessions)
 *   SITE_EMPTY  built while the mock returned "empty"
 *   SITE_ONE    built while the mock returned "one" (a single session)
 * Checks the build-time HTML of each, then the browser refresh: newer data re-renders, an empty answer switches to
 * the empty-state poster, sessions after an empty build switch back to the normal poster, and the failure cases
 * (slow, 500, bad shape) keep whatever was built.
 */
import { chromium } from "playwright";

const SITE = process.env.SITE ?? "http://127.0.0.1:4330/";
const SITE_EMPTY = process.env.SITE_EMPTY ?? "http://127.0.0.1:4331/";
const SITE_ONE = process.env.SITE_ONE ?? "http://127.0.0.1:4332/";
const MOCK = "http://127.0.0.1:8788";
const mode = (m) => fetch(`${MOCK}/mode/${m}`, { method: "POST" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};
const EMPTY_LABEL = "No upcoming sessions";
const A_LABEL = "Next session: Story hour, Sat 17 Oct";
const B_LABEL = "Next session: Science fair prep, Sun 18 Oct";
const B_TICKETS = [
  "Diwali food drive",
  "Rangoli workshop",
  "Football afternoon",
];
const emptyPoster = /<article[^>]*class="poster is-empty"/;
const rowHidden = /class="cmore[^"]*"[^>]*\shidden/;

// ---- build-time HTML ----
const html = await (await fetch(SITE)).text();
results["build a: live poster in HTML"] =
  html.includes("Story hour") && html.includes(A_LABEL);
results["build a: tickets in HTML"] =
  html.includes("Lunch drive") && html.includes("Park outing");
results["build a: no sample note"] = !html.includes("Sample sessions.");
results["build a: sign-up link"] = html.includes(
  "https://dash.proudindian.ngo/register?next=/events/a1"
);
results["build a: not the empty state"] =
  !emptyPoster.test(html) && !rowHidden.test(html);

const htmlE = await (await fetch(SITE_EMPTY)).text();
results["build empty: empty-state poster in HTML"] =
  htmlE.includes(`aria-label="${EMPTY_LABEL}"`) &&
  emptyPoster.test(htmlE) &&
  htmlE.includes("Nothing on the calendar yet.") &&
  htmlE.includes(
    "New sessions go up on the dashboard first. Register now and you can sign up the moment one is posted."
  ) &&
  htmlE.includes(
    'href="https://dash.proudindian.ngo/register">Register on the dashboard <span aria-hidden="true">→</span>'
  );
results["build empty: ticket row hidden"] = rowHidden.test(htmlE);
results["build empty: no sample note"] = !htmlE.includes("Sample sessions.");

const htmlO = await (await fetch(SITE_ONE)).text();
results["build one: poster shows the session"] =
  htmlO.includes(A_LABEL) && !emptyPoster.test(htmlO);
results["build one: ticket row hidden"] = rowHidden.test(htmlO);

// ---- browser refresh ----
const browser = await chromium.launch();
const look = async (site, m, wait, opts = {}) => {
  await mode(m);
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: opts.reduced ? "reduce" : "no-preference",
  });
  if (opts.paused)
    await ctx.addInitScript(() =>
      localStorage.setItem("pi-motion-paused", "1")
    );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // the 500 itself is logged by the browser as a failed resource; that one is expected
  page.on(
    "console",
    (x) =>
      x.type() === "error" &&
      !(m === "error" && x.text().includes("status of 500")) &&
      errors.push(x.text())
  );
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await sleep(wait);
  await page.evaluate(() =>
    document
      .querySelector("[data-events-poster]")
      ?.scrollIntoView({ block: "center", behavior: "instant" })
  );
  await sleep(400);
  const state = await page.evaluate(() => {
    const poster = document.querySelector("[data-events-poster]");
    const clock = poster?.querySelector(".pclock");
    const hand = clock?.querySelector(".hand");
    const cmore = document.querySelector(".cmore");
    return {
      poster: poster?.getAttribute("aria-label"),
      empty: poster?.classList.contains("is-empty"),
      prog: document.querySelector(".pprog")?.textContent ?? null,
      heading: poster?.querySelector(".pnone")?.textContent ?? null,
      tickets: [...document.querySelectorAll("[data-events-list] h4")].map(
        (h) => h.textContent
      ),
      cmoreShown: !!cmore && cmore.getBoundingClientRect().height > 0,
      note: !!document.querySelector("[data-events-sample]"),
      kid: !!poster?.querySelector(".kid"),
      clockShown: !!clock && clock.getBoundingClientRect().width > 0,
      clockAria: clock?.getAttribute("aria-hidden"),
      clockLoop: !!clock?.classList.contains("loop"),
      clockPaused: !!clock?.classList.contains("is-paused"),
      clockAnim: hand ? getComputedStyle(hand).animationName : null,
      motion: document.documentElement.dataset.motion,
    };
  });
  await ctx.close();
  return { state, errors };
};
const isA = (s) =>
  s.poster === A_LABEL && !s.empty && s.tickets.length === 2 && s.cmoreShown;
const isEmpty = (s) =>
  s.poster === EMPTY_LABEL &&
  s.empty &&
  s.heading === "Nothing on the calendar yet." &&
  s.prog === null &&
  s.tickets.length === 0 &&
  !s.cmoreShown &&
  !s.note &&
  s.kid &&
  s.clockShown;
const isB = (s) =>
  s.poster === B_LABEL &&
  !s.empty &&
  s.prog === "Education" &&
  JSON.stringify(s.tickets) === JSON.stringify(B_TICKETS) &&
  s.cmoreShown &&
  s.kid &&
  !s.clockShown;
const noErrors = (name, r) => {
  if (r.errors.length) results[`${name}: console`] = r.errors.join(" | ");
};

// build a (many sessions)
const b = await look(SITE, "b", 2500);
results["a → b: poster and tickets re-rendered"] = isB(b.state);
noErrors("a → b", b);
const ae = await look(SITE, "empty", 2000);
results["a → empty: switches to the empty state"] = isEmpty(ae.state);
results["a → empty: clock is aria-hidden"] = ae.state.clockAria === "true";
results["a → empty: clock is a running .loop"] =
  ae.state.clockLoop && !ae.state.clockPaused && ae.state.clockAnim === "tick";
noErrors("a → empty", ae);
const a1 = await look(SITE, "one", 2000);
results["a → one: poster kept, ticket row hidden"] =
  a1.state.poster === A_LABEL &&
  !a1.state.empty &&
  a1.state.tickets.length === 0 &&
  !a1.state.cmoreShown;
noErrors("a → one", a1);
for (const m of ["slow", "error", "bad"]) {
  const r = await look(SITE, m, m === "slow" ? 5500 : 2000);
  results[`a, ${m}: keeps built list`] = isA(r.state);
  noErrors(`a, ${m}`, r);
}

// build empty
const ee = await look(SITE_EMPTY, "empty", 2000);
results["empty → empty: stays empty"] = isEmpty(ee.state);
results["empty: clock is a running .loop"] =
  ee.state.clockLoop && !ee.state.clockPaused && ee.state.clockAnim === "tick";
noErrors("empty → empty", ee);
const eb = await look(SITE_EMPTY, "b", 2500);
results["empty → b: switches to poster and tickets"] = isB(eb.state);
noErrors("empty → b", eb);
for (const m of ["slow", "error", "bad"]) {
  const r = await look(SITE_EMPTY, m, m === "slow" ? 5500 : 2000);
  results[`empty, ${m}: keeps the empty state`] = isEmpty(r.state);
  noErrors(`empty, ${m}`, r);
}
const er = await look(SITE_EMPTY, "error", 1500, { reduced: true });
results["empty, reduced motion: clock still"] =
  er.state.motion === "off" && er.state.clockAnim === "none";
const ep = await look(SITE_EMPTY, "error", 1500, { paused: true });
results["empty, Pause: clock still"] =
  ep.state.motion === "off" && ep.state.clockAnim === "none";

// build one
const oo = await look(SITE_ONE, "one", 2000);
results["one → one: poster, no ticket row"] =
  oo.state.poster === A_LABEL && !oo.state.empty && !oo.state.cmoreShown;
noErrors("one → one", oo);
const ob = await look(SITE_ONE, "b", 2500);
results["one → b: ticket row appears"] = isB(ob.state);
noErrors("one → b", ob);

await browser.close();
console.table(Object.entries(results).map(([check, ok]) => ({ check, ok })));
if (Object.values(results).some((v) => v !== true)) process.exitCode = 1;
