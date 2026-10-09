/**
 * Build-time events. Fetches PUBLIC_EVENTS_URL (the pi-dash public events API) once per build. When the variable is
 * unset, the request fails or times out, or the response has the wrong shape, the result has no sessions and is marked
 * "unavailable": the poster then points to the dashboard instead of claiming the calendar is empty, and no sessions are
 * shown. The browser refresh (src/scripts/events-refresh.ts) replaces it once live data arrives.
 */
import { type PublicEventsResponse, parseEventsResponse } from "./contract";

export interface LoadedEvents {
  data: PublicEventsResponse;
  source: "live" | "unavailable";
  url: string | null;
}

const BUILD_TIMEOUT_MS = 8000;

let loaded: Promise<LoadedEvents> | undefined;
/** Fetched once per build: the home page and /llms.txt show the same sessions. */
export const loadEvents = () => (loaded ??= fetchEvents());

async function fetchEvents(): Promise<LoadedEvents> {
  const url = import.meta.env.PUBLIC_EVENTS_URL?.trim() || null;
  const unavailable = (why: string): LoadedEvents => {
    if (url) console.warn(`[events] ${why}; the poster links to the dashboard`);
    return {
      data: { events: [], generatedAt: "" },
      source: "unavailable",
      url,
    };
  };
  if (!url) return unavailable("PUBLIC_EVENTS_URL is not set");
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(BUILD_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return unavailable(`${url} answered ${res.status}`);
    const data = parseEventsResponse(await res.json());
    if (!data) return unavailable(`${url} returned an unexpected shape`);
    console.info(`[events] ${data.events.length} sessions from ${url}`);
    return { data, source: "live", url };
  } catch (err) {
    return unavailable(`${url} failed (${(err as Error).message})`);
  }
}
