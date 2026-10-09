/**
 * The pages as Markdown, for AI agents. /llms.txt is the whole site in one file; each page with prose also has an
 * index.md beside its index.html (/index.md, /volunteer/index.md, /privacy/index.md), which functions/_middleware.ts
 * serves at the page's own URL to requests that send `Accept: text/markdown`. Built from the same content and events
 * feed as the pages, so none of it needs editing by hand. Links are absolute: the text is read away from the page.
 */
import {
  getCopy,
  getGuideCards,
  getKalakriti,
  getPrivacy,
  getProgrammes,
  getReports,
  getSite,
  getVolunteerPage,
  postalAddress,
} from "./content";
import type { PublicEvent } from "./events/contract";
import { dateLabel, neighbourhood, timeRange } from "./events/format";
import { loadEvents } from "./events/load";
import { guideValues, markdown } from "./inline";

type Site = Awaited<ReturnType<typeof getSite>>;
type Copy = Awaited<ReturnType<typeof getCopy>>;
type Guide = Awaited<ReturnType<typeof getVolunteerPage>>;

/** a built index.md (the Pages Function adds the negotiation headers when it serves one) */
export const markdownResponse = (text: string) =>
  new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });

/** "How to join", the steps shared with the home page's volunteer section */
const joinSteps = (copy: Copy) =>
  copy.volunteer.steps.map((s, i) => `${i + 1}. ${s}`);

/** the sessions from the events feed, grouped by name and area, each date linking to its sign-up page */
const sessionLines = (site: Site, sessions: PublicEvent[]) =>
  sessions.length
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
      ];

/** the volunteer guide's FAQ, one ### heading per question; its links resolve against the guide */
const faqLines = (
  guide: Guide,
  values: Record<string, string>,
  guideUrl: string
) =>
  guide.faq.items.flatMap((f) => [
    `### ${f.q}`,
    "",
    markdown(f.a, values, guideUrl),
    "",
  ]);

/** The whole site in one file: /llms.txt (https://llmstxt.org) and the home page's Markdown. */
export async function siteMarkdown(origin: URL | undefined) {
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
  const pdfs = (kind: string) => reports.filter((d) => d.kind === kind);

  return [
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
    ...joinSteps(copy),
    "",
    `- [Register as a volunteer](${site.links.register}): create an account on the Proud Indian dashboard, then show interest in a session.`,
    `- [Every upcoming session](${site.links.events}): the dashboard's list, after signing in.`,
    `- [Volunteer guide](${abs("/volunteer/")}): what you'd do, where we meet, internships and the FAQ.`,
    `- Questions about volunteering or internships: ${values.hr}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
    "## Upcoming sessions",
    "",
    ...sessionLines(site, events.data.events),
    "",
    "## Volunteering FAQ",
    "",
    ...faqLines(guide, values, abs("/volunteer/")),
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
  ].join("\n");
}

/** The volunteer guide (/volunteer/), section by section in page order. */
export async function volunteerMarkdown(origin: URL | undefined) {
  const [site, copy, guide, cards, events] = await Promise.all([
    getSite(),
    getCopy(),
    getVolunteerPage(),
    getGuideCards(),
    loadEvents(),
  ]);
  const values = guideValues(site);
  const abs = (path: string) => new URL(path, origin ?? site.url).href;
  const url = abs("/volunteer/");
  const sessions = events.data.events;
  const { hero, do: d, where: w, internships: i } = guide;
  const centre = site.contacts.addresses.find((a) => a.name);
  const areas = [
    ...new Set(sessions.map((e) => neighbourhood(e.area) ?? e.area)),
  ];
  const heading = (h: { before: string; accent: string }) =>
    `${h.before} ${h.accent}`;

  return [
    `# ${heading(hero.heading)}`,
    "",
    `> ${guide.meta.description}`,
    "",
    hero.lede,
    "",
    hero.facts.join(" · "),
    "",
    "## How to join",
    "",
    copy.volunteer.lede,
    "",
    ...joinSteps(copy),
    "",
    `[Register on the dashboard](${site.links.register}), or see [every upcoming session](${site.links.events}).`,
    "",
    "## Upcoming sessions",
    "",
    ...sessionLines(site, sessions),
    "",
    `## ${heading(d.heading)}`,
    "",
    d.lede,
    "",
    ...cards.flatMap((c) => [
      `### ${c.verb} (${c.name}): ${c.when}`,
      "",
      c.line,
      "",
      c.chips.join(", "),
      "",
    ]),
    `## ${heading(w.heading)}`,
    "",
    w.lede,
    "",
    ...(areas.length ? [`${w.areas}: ${areas.join(", ")}.`, ""] : []),
    ...(centre
      ? [
          `### ${w.centre.kicker}: ${centre.name}`,
          "",
          `${postalAddress(centre)}, ${centre.region}, India${centre.map ? ` ([map](${centre.map}))` : ""}`,
          "",
          `${w.centre.does}: ${w.centre.items.join(", ")}.`,
          "",
        ]
      : []),
    `## ${heading(i.heading)}`,
    "",
    i.lede,
    "",
    ...i.steps.map((s, n) => `${n + 1}. ${s}`),
    "",
    markdown(i.apply, values, url),
    "",
    `## ${heading(guide.faq.heading)}`,
    "",
    ...faqLines(guide, values, url),
    "## More",
    "",
    `- [Proud Indian](${abs("/")}): the programmes, Kalakriti, donations and reports.`,
    `- [Donate](${abs("/#donate")}): towards class materials, meals and Kalakriti.`,
    `- Questions: ${values.hr}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
  ].join("\n");
}

/** The privacy policy (/privacy/): its own Markdown, without the team's <!-- notes -->. */
export async function privacyMarkdown(origin: URL | undefined) {
  const [site, policy] = await Promise.all([getSite(), getPrivacy()]);
  const abs = (path: string) => new URL(path, origin ?? site.url).href;
  const body = policy.body
    .replace(/<!--[\s\S]*?-->\n*/g, "")
    // in-page links ("#cookies-and-local-storage") point at the page, since this file is read away from it
    .replace(/\]\(#/g, `](${abs("/privacy/")}#`)
    .trim();
  return [
    `# ${policy.title}`,
    "",
    ...(policy.draft ? [`**Draft.** ${policy.draftNote}`, ""] : []),
    policy.lede,
    "",
    `Effective date: ${policy.effectiveDate}`,
    "",
    body,
    "",
  ].join("\n");
}
