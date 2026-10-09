/**
 * WebMCP (https://webmachinelearning.github.io/webmcp/): tools a browser's AI agent can call on this page, registered
 * with document.modelContext.registerTool() (navigator.modelContext in older Chrome builds). Nothing happens in a
 * browser without the API.
 *   list-volunteer-sessions   the upcoming sessions shown on the page (home, /volunteer/), read-only
 *   start-volunteer-sign-up   opens the dashboard's sign-up page for one session; the person signs up there
 *   fill-donation-amount      sets the amount in the donate card (home) and brings it into view; the person presses
 *                             Donate and pays on Razorpay themselves
 * The tools work through the same code as the page, so what the agent does shows on screen.
 */
import type { PublicEvent } from "../lib/events/contract";
import { dateLabel, timeRange } from "../lib/events/format";
import type { initDonate } from "./donate";
import { sessions } from "./events-refresh";

type Donate = ReturnType<typeof initDonate>;

interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

interface ModelContext {
  registerTool: (tool: Tool) => Promise<unknown> | unknown;
}

const text = (t: string, isError = false): ToolResult => ({
  content: [{ type: "text", text: t }],
  ...(isError ? { isError } : {}),
});

const describe = (e: PublicEvent) => ({
  sessionId: e.id,
  occurrenceDate: e.occurrenceDate,
  name: e.name,
  when: `${dateLabel(e.startTime)}, ${timeRange(e.startTime, e.endTime)} IST`,
  startTime: e.startTime,
  endTime: e.endTime,
  area: e.area,
  team: e.team,
  ...(e.programme ? { programme: e.programme } : {}),
  summary: e.summary,
  signUpUrl: e.signUpUrl,
});

function sessionTools(): Tool[] {
  if (!sessions()) return [];
  return [
    {
      name: "list-volunteer-sessions",
      title: "List volunteer sessions",
      description:
        "Lists the upcoming volunteering sessions with Proud Indian in Bengaluru shown on this page: what each is, when (India time), the area, the team running it and its sign-up link. Sessions are free and open to anyone 18 or older.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        const s = sessions()!;
        if (s.unavailable)
          return text(
            `The sessions could not be loaded on this page. See them on the volunteer dashboard: ${s.eventsUrl}`,
            true
          );
        if (!s.events.length)
          return text(
            `No sessions are scheduled right now. Volunteers can register at ${s.registerUrl} to hear about new ones.`
          );
        return text(JSON.stringify({ sessions: s.events.map(describe) }));
      },
    },
    {
      name: "start-volunteer-sign-up",
      title: "Start volunteer sign-up",
      description:
        "Opens the sign-up page for one volunteering session from list-volunteer-sessions. The person then creates an account (or signs in) on the volunteer dashboard and the session's team confirms their place; nothing is booked by this tool.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description:
              "The session's sessionId from list-volunteer-sessions.",
          },
          occurrenceDate: {
            type: "string",
            description:
              "The session's occurrenceDate (YYYY-MM-DD) from list-volunteer-sessions; recurring sessions share a sessionId.",
          },
        },
        required: ["sessionId"],
      },
      async execute({ sessionId, occurrenceDate }) {
        const matches = sessions()!.events.filter(
          (e) =>
            e.id === sessionId &&
            (!occurrenceDate || e.occurrenceDate === occurrenceDate)
        );
        if (matches.length !== 1)
          return text(
            matches.length
              ? `Session ${sessionId} runs on several dates; pass its occurrenceDate as well.`
              : `No upcoming session matches. Call list-volunteer-sessions for the current sessionId and occurrenceDate values.`,
            true
          );
        const event = matches[0]!;
        location.assign(event.signUpUrl);
        return text(
          `Opening the sign-up page for "${event.name}" on ${dateLabel(event.startTime)}: ${event.signUpUrl}`
        );
      },
    },
  ];
}

function donateTools(donate: Donate): Tool[] {
  if (!donate) return [];
  return [
    {
      name: "fill-donation-amount",
      title: "Fill in a donation amount",
      description: `Fills in a one-time donation to Proud Indian, in Indian rupees, on this page's donate card and scrolls it into view. The person reviews it and presses Donate to pay on Razorpay; no payment is made by this tool. The minimum is ₹${donate.min}.`,
      inputSchema: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: `Amount in rupees (INR), ₹${donate.min} or more.`,
          },
        },
        required: ["amount"],
      },
      async execute({ amount }) {
        const n = Math.round(Number(String(amount).replace(/[^\d.]/g, "")));
        if (!Number.isFinite(n) || n < donate.min || n > 9_999_999)
          return text(
            `The amount must be a number of rupees from ${donate.min} to 9999999.`,
            true
          );
        const url = donate.setAmount(n);
        donate.form.scrollIntoView({ block: "center" });
        return text(
          `The donate card now shows ₹${n.toLocaleString("en-IN")}. Ask the person to press its Donate button to pay on Razorpay (${url}).`
        );
      },
    },
  ];
}

export function initWebMcp(donate: Donate) {
  const mc = ((document as { modelContext?: ModelContext }).modelContext ??
    (navigator as { modelContext?: ModelContext }).modelContext) as
    | ModelContext
    | undefined;
  if (typeof mc?.registerTool !== "function") return;
  for (const tool of [...sessionTools(), ...donateTools(donate)])
    // a page that forbids the tools (Permissions-Policy) or a browser that rejects one: the page carries on
    Promise.resolve()
      .then(() => mc.registerTool(tool))
      .catch(() => {});
}
