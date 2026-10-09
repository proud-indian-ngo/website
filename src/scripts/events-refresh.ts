/**
 * Events refresh: the page ships with the sessions fetched at build time (or, if the build could not load them, a
 * poster that points to the dashboard). On load this re-fetches PUBLIC_EVENTS_URL with a ~4s timeout and, when the
 * data differs, re-renders the poster and tickets with the same renderer the build used. An empty list switches to the empty-state poster; any error (network, timeout,
 * CORS, bad shape) keeps the built list.
 */
import {
  type PublicEvent,
  fingerprint,
  parseEventsResponse,
} from "../lib/events/contract";
import { type EventLabels, poster, tickets } from "../lib/events/render";

const TIMEOUT_MS = 4000;

interface State {
  labels: EventLabels;
  url: string | null;
  events: PublicEvent[];
}

/** The state the page was built with, then whatever the refresh last rendered (see `sessions`). */
let current: State | null = null;
const readState = () => {
  if (current) return current;
  const el = document.getElementById("events-state");
  if (el?.textContent) current = JSON.parse(el.textContent) as State;
  return current;
};

/** The sessions on the page right now, for the WebMCP tools: null on a page without the list, `unavailable` when the
 *  build could not load them and no refresh has since, plus the dashboard links the poster uses. */
export function sessions() {
  const state = readState();
  if (!state) return null;
  const source = document.querySelector<HTMLElement>("[data-events-source]")
    ?.dataset.eventsSource;
  return {
    events: state.events,
    unavailable: source === "unavailable",
    eventsUrl: state.labels.unavailable.href,
    registerUrl: state.labels.empty.href,
  };
}

/** Children of the poster that never change: the cut-out child and the empty-state clock. */
const KEEP = ["kid", "pclock"];

function render(events: PublicEvent[], labels: EventLabels) {
  const el = document.querySelector<HTMLElement>("[data-events-poster]");
  if (el) {
    const p = poster(events, labels);
    // copy first: the loop removes nodes from this live list
    for (const n of Array.from(el.childNodes)) {
      if (n instanceof Element && KEEP.some((c) => n.classList.contains(c)))
        continue;
      n.remove();
    }
    el.insertAdjacentHTML("afterbegin", p.body);
    el.setAttribute("aria-label", p.label);
    el.classList.toggle("is-empty", p.empty);
  }
  const list = document.querySelector<HTMLElement>("[data-events-list]");
  if (list) {
    list.innerHTML = tickets(events, labels);
    const wrap = list.closest<HTMLElement>(".cmore");
    if (wrap) wrap.hidden = list.childElementCount === 0;
  }
}

export async function refreshEvents(onChange: () => void) {
  const state = readState();
  if (!state?.url) return;
  // the production feed only allows the live site and its previews (CORS): from a local server (dev, preview, CI)
  // the request can only fail, with a console error, so it isn't made. A local mock feed (http) still refreshes.
  if (
    /^(localhost|127\.0\.0\.1)$/.test(location.hostname) &&
    state.url.startsWith("https:")
  )
    return;
  let events: PublicEvent[];
  try {
    const res = await fetch(state.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      credentials: "omit",
    });
    if (!res.ok) return;
    const data = parseEventsResponse(await res.json());
    if (!data) return;
    events = data.events;
  } catch {
    return; // keep what was built
  }
  // live data reached the browser: the build's "see the dashboard" poster (no sessions loaded) no longer applies
  const col = document.querySelector<HTMLElement>("[data-events-source]");
  const wasUnavailable = col?.dataset.eventsSource === "unavailable";
  if (col) col.dataset.eventsSource = "live";
  // an empty list is an honest answer (nothing is scheduled): follow it and show the empty state
  if (!wasUnavailable && fingerprint(events) === fingerprint(state.events))
    return;
  render(events, state.labels);
  state.events = events;
  onChange();
}
