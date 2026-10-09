/**
 * HTML for the "Next up" poster and the "More weekends" tickets. One implementation, used twice: at build time
 * (set:html in Volunteer.astro) and in the browser when the refresh finds newer data, so both always produce the
 * same markup. Class names match src/styles/sections/volunteer.css.
 *
 * With no sessions the poster switches to its empty state (class "is-empty": a headline, a line and a register
 * button; the alarm clock is a persistent child of the poster that CSS shows only then), and the tickets row hides.
 * When the build could not reach the events API at all, the same layout uses the "unavailable" copy, which points to
 * the dashboard instead of saying nothing is scheduled.
 */
import type { PublicEvent } from "./contract";
import { dateLabel, dateParts, timeRange } from "./format";

/** The empty-state poster: shown when the dashboard has no upcoming sessions. */
export interface EmptyLabels {
  /** aria-label of the poster */
  label: string;
  heading: string;
  line: string;
  register: string;
  /** the dashboard's register page */
  href: string;
}

export interface EventLabels {
  kicker: string;
  open: string;
  register: string;
  ticketRegister: string;
  empty: EmptyLabels;
  /** the build could not load the sessions: same layout as the empty state, pointing to the dashboard */
  unavailable: EmptyLabels;
}

const NAMES: Record<string, string> = {
  education: "Education",
  nutrition: "Nutrition",
  kalakriti: "Kalakriti",
  community: "Community",
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

/** Programme label shown on the poster and ticket chip. */
export const programmeName = (e: PublicEvent) =>
  e.programme ? NAMES[e.programme]! : e.team;

const PIN =
  '<svg viewBox="0 0 16 16" class="ic" aria-hidden="true"><path d="M8 14.5C5.2 11.2 3.5 8.6 3.5 6.3A4.5 4.5 0 0 1 12.5 6.3C12.5 8.6 10.8 11.2 8 14.5Z"></path><circle cx="8" cy="6.3" r="1.6"></circle></svg>';
const CLOCK =
  '<svg viewBox="0 0 16 16" class="ic" aria-hidden="true"><circle cx="8" cy="8" r="6.2"></circle><path d="M8 4.6V8L10.4 9.6"></path></svg>';

const meta = (e: PublicEvent, cls: string) =>
  `<p class="${cls}"><span class="mi">${PIN}${esc(e.area)}</span><span class="mi">${CLOCK}${esc(timeRange(e.startTime, e.endTime))}</span></p>`;

/** aria-label of the poster article */
export const posterLabel = (e: PublicEvent) =>
  `Next session: ${e.name}, ${dateLabel(e.startTime)}`;

/** Everything inside the poster except the cut-out child and the sparkle, which never change. */
export function posterBody(e: PublicEvent, l: EventLabels): string {
  return (
    `<div class="ptop"><span class="nx">${esc(l.kicker)}</span><span class="ga">${esc(l.open)}</span></div>` +
    `<div class="holes" aria-hidden="true"></div>` +
    `<p class="loz"><span>${esc(dateLabel(e.startTime))}</span></p>` +
    `<p class="pprog">${esc(programmeName(e))}</p>` +
    `<h3 class="ptitle">${esc(e.name)}</h3>` +
    meta(e, "meta pmeta") +
    `<a class="pi-btn pi-btn--sky pi-btn--lg preg" href="${esc(e.signUpUrl)}">${esc(l.register)} <span aria-hidden="true">→</span></a>`
  );
}

/** The poster body when there is nothing to show. Keeps the "Next up" pill and the punched holes. */
export function emptyBody(l: EventLabels, e: EmptyLabels = l.empty): string {
  return (
    `<div class="ptop"><span class="nx">${esc(l.kicker)}</span></div>` +
    `<div class="holes" aria-hidden="true"></div>` +
    `<h3 class="pnone">${esc(e.heading)}</h3>` +
    // the button sits above the line so it clears the cut-out's shoulder; the narrow line fits beside its hand
    `<a class="pi-btn pi-btn--sky pi-btn--lg preg" href="${esc(e.href)}">${esc(e.register)} <span aria-hidden="true">→</span></a>` +
    `<p class="pline">${esc(e.line)}</p>`
  );
}

/**
 * Everything the poster needs for a list of sessions: its body, aria-label and whether it is the empty state.
 * `unavailable`: the sessions could not be loaded, so the empty layout points to the dashboard instead.
 */
export function poster(
  events: PublicEvent[],
  l: EventLabels,
  unavailable = false
) {
  const next = events[0];
  if (next)
    return {
      empty: false,
      label: posterLabel(next),
      body: posterBody(next, l),
    };
  const e = unavailable ? l.unavailable : l.empty;
  return { empty: true, label: e.label, body: emptyBody(l, e) };
}

/** One "More weekends" ticket, as an <li>. */
export function ticket(e: PublicEvent, l: EventLabels): string {
  const p = dateParts(e.startTime);
  const cls =
    e.programme && e.programme !== "education" ? ` ${e.programme}` : "";
  return (
    `<li class="stw"><article class="stk">` +
    `<div class="sk-top"><span class="cal" aria-hidden="true"><span class="cm">${p.month}</span><span class="cd">${p.day}</span><span class="cw">${p.weekday}</span></span>` +
    `<div><span class="pg${cls}">${esc(programmeName(e))}</span><h4>${esc(e.name)}</h4></div></div>` +
    meta(e, "meta") +
    `<a class="reg" href="${esc(e.signUpUrl)}" aria-label="${esc(`${l.ticketRegister} ${e.name}, ${dateLabel(e.startTime)}`)}">${esc(l.ticketRegister)} <span aria-hidden="true">→</span></a>` +
    `</article></li>`
  );
}

/** The poster shows the next session; the tickets show the three after it (none: the row hides). */
export const split = (events: PublicEvent[]) => ({
  next: events[0],
  more: events.slice(1, 4),
});

/** The "More weekends" list items for a list of sessions; empty when there is at most one session. */
export const tickets = (events: PublicEvent[], l: EventLabels) =>
  split(events)
    .more.map((e) => ticket(e, l))
    .join("");
