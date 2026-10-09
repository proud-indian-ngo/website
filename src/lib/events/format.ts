/** Date and time labels for sessions, always in India Standard Time (UTC+5:30, no daylight saving).
 *  Formatted by hand rather than with Intl so the build (Node ICU) and every browser print the same characters. */
const IST_MS = 330 * 60 * 1000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ist = (iso: string) => new Date(Date.parse(iso) + IST_MS);

/** { weekday: "Sat", day: "24", month: "Oct" } */
export function dateParts(iso: string) {
  const d = ist(iso);
  return {
    weekday: DAYS[d.getUTCDay()]!,
    day: String(d.getUTCDate()),
    month: MONTHS[d.getUTCMonth()]!,
  };
}

/** "Sat 24 Oct" */
export function dateLabel(iso: string) {
  const p = dateParts(iso);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "9:30 am" */
function timeLabel(iso: string) {
  const d = ist(iso);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
}

/** "10:00 am – 12:30 pm", or just "10:00 am" for an open-ended session (the feed sends endTime = startTime) */
export const timeRange = (start: string, end: string) =>
  Date.parse(end) > Date.parse(start)
    ? `${timeLabel(start)} – ${timeLabel(end)}`
    : timeLabel(start);
