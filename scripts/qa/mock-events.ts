/**
 * Local stand-in for GET https://dash.proudindian.ngo/api/public/events (with CORS), for testing the events flow.
 *   bun scripts/qa/mock-events.ts            serves http://127.0.0.1:8788/events
 *   curl -X POST 127.0.0.1:8788/mode/b       switch what it returns: a | b | one | empty | error | slow | bad
 */
const ev = (
  id: string,
  date: string,
  startUtc: string,
  endUtc: string,
  name: string,
  area: string,
  programme: string,
  team: string
) => ({
  id,
  occurrenceDate: date,
  name,
  summary: `${name} in ${area}.`,
  startTime: `${date}T${startUtc}:00.000Z`,
  endTime: `${date}T${endUtc}:00.000Z`,
  area,
  city: "bangalore",
  team,
  programme,
  signUpUrl: `https://dash.proudindian.ngo/register?next=/events/${id}`,
});
const A = [
  ev(
    "a1",
    "2026-10-17",
    "04:30",
    "06:30",
    "Story hour",
    "Ejipura, Bengaluru",
    "education",
    "Education"
  ),
  ev(
    "a2",
    "2026-10-25",
    "05:00",
    "08:00",
    "Lunch drive",
    "Bellandur, Bengaluru",
    "nutrition",
    "Nutrition"
  ),
  ev(
    "a3",
    "2026-11-08",
    "09:30",
    "12:00",
    "Park outing",
    "Cubbon Park, Bengaluru",
    "community",
    "Community"
  ),
];
const B = [
  ev(
    "b1",
    "2026-10-18",
    "03:30",
    "06:00",
    "Science fair prep",
    "Iblur, Bengaluru",
    "education",
    "Education"
  ),
  ev(
    "b2",
    "2026-10-26",
    "04:00",
    "07:00",
    "Diwali food drive",
    "HSR Layout, Bengaluru",
    "nutrition",
    "Nutrition"
  ),
  ev(
    "b3",
    "2026-11-02",
    "08:30",
    "11:30",
    "Rangoli workshop",
    "Koramangala, Bengaluru",
    "kalakriti",
    "Kalakriti"
  ),
  ev(
    "b4",
    "2026-11-15",
    "04:30",
    "07:00",
    "Football afternoon",
    "Agara, Bengaluru",
    "community",
    "Community"
  ),
];
let mode = process.env.MODE ?? "a";
const cors = {
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};
Bun.serve({
  port: 8788,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/mode/")) {
      mode = url.pathname.slice(6);
      return new Response(mode);
    }
    if (url.pathname !== "/events")
      return new Response("not found", { status: 404 });
    const body = (events: unknown[]) =>
      JSON.stringify({ events, generatedAt: new Date().toISOString() });
    if (mode === "error")
      return new Response("boom", { status: 500, headers: cors });
    if (mode === "bad")
      return new Response(JSON.stringify({ nope: true }), { headers: cors });
    if (mode === "slow") await Bun.sleep(6000);
    if (mode === "empty") return new Response(body([]), { headers: cors });
    if (mode === "one")
      return new Response(body(A.slice(0, 1)), { headers: cors });
    return new Response(body(mode === "b" ? B : A), { headers: cors });
  },
});
console.log(`mock events on http://127.0.0.1:8788/events (mode ${mode})`);
