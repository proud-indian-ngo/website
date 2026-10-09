/**
 * /llms.txt (https://llmstxt.org): the site in plain Markdown for AI agents and assistants, so they can answer
 * "where can I volunteer at weekends in Bangalore?" with Proud Indian, how to join and the next sessions. Built from
 * the same content and events feed as the home page, so it never needs editing by hand.
 */
import type { APIRoute } from "astro";

import {
  getCopy,
  getKalakriti,
  getProgrammes,
  getReports,
  getSite,
  getVolunteerPage,
  postalAddress,
} from "../lib/content";
import { dateLabel, timeRange } from "../lib/events/format";
import { loadEvents } from "../lib/events/load";
import { guideValues, markdown } from "../lib/inline";

export const GET: APIRoute = async ({ site: origin }) => {
  const [site, copy, programmes, kalakriti, reports, events] =
    await Promise.all([
      getSite(),
      getCopy(),
      getProgrammes(),
      getKalakriti(),
      getReports(),
      loadEvents(),
    ]);
  const guide = await getVolunteerPage();
  const values = guideValues(site);
  const abs = (path: string) => new URL(path, origin ?? site.url).href;
  const r = site.registrations;
  const v = copy.volunteer;
  const sessions = events.data.events;
  const pdfs = (kind: string) => reports.filter((d) => d.kind === kind);

  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.name} is a volunteer-run NGO in Bengaluru (Bangalore), India, founded on ${site.founded.long}. Its volunteers, called Optimists, spend weekends with children in Bengaluru's low-income communities: maths and Spoken English classes, art and craft, shared meals, community days and the Kalakriti festival. Anyone aged 18 or over can join, and no experience is needed.`,
    "",
    "## Weekend volunteering in Bengaluru",
    "",
    v.lede,
    "",
    "How to join:",
    "",
    ...v.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `- [Register as a volunteer](${site.links.register}): create an account on the Proud Indian dashboard, then show interest in a session.`,
    `- [Every upcoming session](${site.links.events}): the dashboard's list, after signing in.`,
    `- [Volunteer guide](${abs("/volunteer/")}): what you'd do, where we meet, internships and the FAQ.`,
    `- Questions about volunteering or internships: ${values.hr}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
    "## Upcoming sessions",
    "",
    ...(sessions.length
      ? [
          "Times are India Standard Time. Listed when this file was built; the dashboard has the live list. Each date links to its sign-up page.",
          ...[...Map.groupBy(sessions, (e) => `${e.name} · ${e.area}`)].flatMap(
            ([title, dates]) => [
              "",
              `### ${title}`,
              "",
              ...(dates[0]?.summary ? [dates[0].summary, ""] : []),
              ...dates.map(
                (e) =>
                  `- [${dateLabel(e.startTime)} ${e.occurrenceDate.slice(0, 4)}, ${timeRange(e.startTime, e.endTime)}](${e.signUpUrl})`
              ),
            ]
          ),
        ]
      : [
          `New sessions go up on the [dashboard](${site.links.events}) first, usually for the coming weekends.`,
        ]),
    "",
    "## Volunteering FAQ",
    "",
    ...guide.faq.items.flatMap((f) => [
      `### ${f.q}`,
      "",
      markdown(f.a, values, abs("/volunteer/")),
      "",
    ]),
    "## Programmes",
    "",
    ...programmes.map((p) =>
      p.kind === "band"
        ? `- **${p.verb} (${p.name})**: ${p.line} (${p.chips.join(", ")})`
        : `- **${p.verb} (${p.name})**: ${kalakriti.tickets.note} ${kalakriti.edition.name} ${kalakriti.edition.version} was on ${kalakriti.edition.date}: ${kalakriti.edition.lineup.map((l) => `${l.number} ${l.word}`).join(", ")}. Events: ${kalakriti.edition.events.join(", ")}.`
    ),
    "",
    "## Donate",
    "",
    copy.donate.lede,
    "",
    `- [Donate via Razorpay](${site.links.razorpay.base}): one-time gifts from ₹${site.links.razorpay.min}. Donations are tax-exempt under section ${r.taxExemption}; add your PAN for the receipt.`,
    `- ${site.stats.programmesPercent}% of funds go to programmes.`,
    "",
    "## About and transparency",
    "",
    `- Founded in ${site.city} on ${site.founded.long}. ${site.stats.optimists} Optimists (volunteers), ${site.stats.hours} volunteer hours, ${site.stats.reached} people reached.`,
    `- Registered ${r.taxExemption} and ${r.registered}. NGO Darpan ${r.darpan}, PAN ${r.pan}, registration no. ${r.registrationNo}.`,
    ...[...pdfs("annual"), ...pdfs("audited")].map(
      (d) => `- [${d.title}](${abs(d.url)})`
    ),
    `- ${pdfs("disclosure").length} project disclosures, listed on the [website](${abs("/#reports")}).`,
    "",
    "## Contact",
    "",
    ...site.contacts.emails.map((e) => `- ${e.label}: ${e.address}`),
    `- ${site.contacts.phone.label}: ${site.contacts.phone.display}`,
    ...site.contacts.addresses.map(
      (a) =>
        `- ${a.label}${a.name ? ` (${a.name})` : ""}: ${postalAddress(a)}, ${a.region}, India${a.map ? ` ([map](${a.map}))` : ""}`
    ),
    ...site.social.map((s) => `- [${s.label}](${s.url})`),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
