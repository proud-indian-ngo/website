/**
 * pi-dash public events API, GET https://dash.proudindian.ngo/api/public/events (proud-indian-ngo/dash#150).
 * Public, upcoming, not cancelled, never Kalakriti, no personal data; sorted by startTime, then id. Defaults: city
 * bangalore, the next 30 days, at most 20 events. CORS allows any origin. OpenAPI description:
 * https://dash.proudindian.ngo/api/public/openapi.json.
 * Shared by the build (src/lib/events/load.ts) and the browser refresh (src/scripts/events-refresh.ts), so it has no
 * dependencies.
 */

/** Optional mapping from team to programme, used to colour-code sessions. Left out (never null) when unknown. */
export type Programme = "education" | "nutrition" | "kalakriti" | "community";

export interface PublicEvent {
  /** event id; for a recurring series, the series id (one entry per occurrence) */
  id: string;
  /** date of this occurrence in India, e.g. "2026-10-18" */
  occurrenceDate: string;
  name: string;
  /** plain text, 200 characters at most */
  summary: string;
  /** ISO 8601 UTC, e.g. "2026-10-18T04:30:00.000Z" */
  startTime: string;
  /** always present; equal to startTime for an open-ended event */
  endTime: string;
  /** coarse public area, never the exact address, e.g. "Koramangala, Bengaluru"; just the city when no area is set */
  area: string;
  /** cityEnum value, e.g. "bangalore" */
  city: string;
  team: string;
  programme?: Programme;
  /** used exactly as sent: "https://dash.proudindian.ngo/register?interestEventId=<id>[&occDate=YYYY-MM-DD]" (occDate
   *  identifies the occurrence of a recurring session; never rebuild this link) */
  signUpUrl: string;
}

export interface PublicEventsResponse {
  events: PublicEvent[];
  generatedAt: string;
}

const PROGRAMMES = new Set<string>([
  "education",
  "nutrition",
  "kalakriti",
  "community",
]);
const str = (v: unknown): v is string => typeof v === "string";

function parseEvent(v: unknown): PublicEvent | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const required = [
    "id",
    "occurrenceDate",
    "name",
    "startTime",
    "endTime",
    "area",
    "city",
    "team",
    "signUpUrl",
  ] as const;
  if (!required.every((k) => str(e[k]))) return null;
  if (
    Number.isNaN(Date.parse(e.startTime as string)) ||
    Number.isNaN(Date.parse(e.endTime as string))
  )
    return null;
  // only ever link to the dashboard
  if (!(e.signUpUrl as string).startsWith("https://dash.proudindian.ngo/"))
    return null;
  return {
    id: e.id as string,
    occurrenceDate: e.occurrenceDate as string,
    name: e.name as string,
    summary: str(e.summary) ? e.summary : "",
    startTime: e.startTime as string,
    endTime: e.endTime as string,
    area: e.area as string,
    city: e.city as string,
    team: e.team as string,
    programme:
      str(e.programme) && PROGRAMMES.has(e.programme)
        ? (e.programme as Programme)
        : undefined,
    signUpUrl: e.signUpUrl as string,
  };
}

/** Validate an untrusted response. Returns null if the shape is wrong; drops individual malformed events. */
export function parseEventsResponse(
  json: unknown
): PublicEventsResponse | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  if (!Array.isArray(r.events)) return null;
  const events = r.events
    .map(parseEvent)
    .filter((e): e is PublicEvent => e !== null);
  // the feed's own order: startTime, then id
  events.sort(
    (a, b) =>
      Date.parse(a.startTime) - Date.parse(b.startTime) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  return { events, generatedAt: str(r.generatedAt) ? r.generatedAt : "" };
}

/** Comparable fingerprint of what the page shows (ignores generatedAt). */
export const fingerprint = (events: PublicEvent[]) => JSON.stringify(events);
