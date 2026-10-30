/**
 * The pages as Markdown, for AI agents. /llms.txt is the whole site in one file; each page with prose also has an
 * index.md beside its index.html (/index.md, /volunteer/index.md, /csr/index.md, and /privacy/index.md and the other
 * Markdown pages), which functions/_middleware.ts serves at the page's own URL to requests that send
 * `Accept: text/markdown`. Built from the same content and events
 * feed as the pages, so none of it needs editing by hand. Links are absolute: the text is read away from the page.
 */
import {
  facts,
  fill,
  getCopy,
  getCsrPage,
  getGuideCards,
  getKalakriti,
  getKalakritiPage,
  getPartners,
  getDocs,
  annualReport,
  getProgrammePage,
  getProgrammes,
  getReports,
  getSafeguarding,
  getSite,
  getVolunteerPage,
  postalAddress,
  type Doc,
} from "./content";
import type { PublicEvent } from "./events/contract";
import { dateLabel, neighbourhood, timeRange } from "./events/format";
import { loadEvents } from "./events/load";
import { guideValues, markdown } from "./inline";

type Site = Awaited<ReturnType<typeof getSite>>;
type Copy = Awaited<ReturnType<typeof getCopy>>;

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

/** a page's FAQ, one ### heading per question; its links resolve against the page */
const faqLines = (
  items: { q: string; a: string }[],
  values: Record<string, string>,
  pageUrl: string
) =>
  items.flatMap((f) => [`### ${f.q}`, "", markdown(f.a, values, pageUrl), ""]);

/** "## With thanks to our partners.", the lede and one link per partner (partners.yaml) */
const partnerLines = (
  copy: Copy,
  partners: Awaited<ReturnType<typeof getPartners>>
) => [
  `## ${copy.partners.heading.before} ${copy.partners.heading.accent}`,
  "",
  copy.partners.lede,
  "",
  ...partners.map((p) => `- [${p.name}](${p.url})`),
  "",
];

/** "## Children first.", the lede and the rules (safeguarding.yaml), on /volunteer/ and /csr/ */
const safeguardingLines = (s: Awaited<ReturnType<typeof getSafeguarding>>) => [
  `## ${s.heading.before} ${s.heading.accent}`,
  "",
  s.lede,
  "",
  ...s.rules.map((x) => `- ${x}`),
  "",
];

/** The whole site in one file: /llms.txt (https://llmstxt.org) and the home page's Markdown. */
export async function siteMarkdown(origin: URL | undefined) {
  const [site, copy, programmes, kalakriti, reports, partners, events, docs] =
    await Promise.all([
      getSite(),
      getCopy(),
      getProgrammes(),
      getKalakriti(),
      getReports(),
      getPartners(),
      loadEvents(),
      getDocs(),
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
    `- [Volunteer guide](${abs("/volunteer/")}): what you'd do, where we meet, the safeguarding rules, internships and the FAQ.`,
    `- Questions about volunteering or internships: ${values.hr}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
    "## Upcoming sessions",
    "",
    ...sessionLines(site, events.data.events),
    "",
    "## Volunteering FAQ",
    "",
    ...faqLines(guide.faq.items, values, abs("/volunteer/")),
    "## Programmes",
    "",
    ...programmes.map((p) =>
      p.kind === "band"
        ? `- **${p.verb} (${p.name})**: ${p.line} (${p.chips.join(", ")}) [${p.page.link}](${abs(`/${p.page.slug}/`)}).`
        : `- **${p.verb} (${p.name})**: ${kalakriti.tickets.note} ${kalakriti.edition.name} ${kalakriti.edition.version} was on ${kalakriti.edition.date}: ${kalakriti.edition.lineup.map((l) => `${l.number} ${l.word}`).join(", ")}. Events: ${kalakriti.edition.events.join(", ")}.`
    ),
    "",
    `- [Kalakriti, the festival](${abs("/kalakriti/")}): the eight events, every edition with its numbers and financial disclosure, Kalakriti Horizon (a year of training for the children who stand out), how to volunteer or sponsor, and an FAQ.`,
    "",
    "## Donate",
    "",
    copy.donate.lede,
    "",
    `- [Donate via Razorpay](${site.links.razorpay.base}): one-time gifts from ₹${site.links.razorpay.min}. Donations are tax-exempt under section ${r.taxExemption}; add your PAN for the receipt.`,
    `- ${site.stats.programmesPercent}% of funds go to programmes.`,
    "",
    `## For companies: CSR and employee volunteering`,
    "",
    `${site.name} is registered with the Ministry of Corporate Affairs to take on CSR projects (CSR-1 ${r.csr1}). Companies can bring a team for a volunteering day, sponsor Kalakriti, fund a programme or run a gift or kit drive, all in Bengaluru.`,
    "",
    `- [CSR and employee volunteering in Bengaluru](${abs("/csr/")}): volunteering-day formats, Kalakriti sponsorships (from ₹1,000 a child), the programmes with their Schedule VII activities, safeguarding, the paperwork and an FAQ.`,
    `- To plan something: ${values.connect}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
    "## About and transparency",
    "",
    `- Founded in ${site.city} on ${site.founded.long}. ${site.stats.optimists} Optimists (volunteers), ${site.stats.hours} volunteer hours, ${site.stats.reached} people reached.`,
    `- Registered ${r.taxExemption} and ${r.registered}. NGO Darpan ${r.darpan}, PAN ${r.pan}, registration no. ${r.registrationNo}. Registered with the Ministry of Corporate Affairs to take on CSR projects (CSR-1 ${r.csr1}).`,
    `- Certificates (PDF): [CSR-1](${abs(site.certificates.csr1)}), [${r.taxExemption}](${abs(site.certificates.taxExemption)}), [${r.registered}](${abs(site.certificates.registered)}), [NGO Darpan](${abs(site.certificates.darpan)}).`,
    ...[...pdfs("annual"), ...pdfs("audited")].map(
      (d) => `- [${d.title}](${abs(d.url)})`
    ),
    `- ${pdfs("disclosure").length} project disclosures, listed on the [website](${abs("/#reports")}).`,
    ...docs.map((d) => `- [${d.title}](${abs(`/${d.id}/`)}): ${d.summary}`),
    "",
    ...partnerLines(copy, partners),
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
  const [site, copy, guide, cards, partners, events, safeguarding] =
    await Promise.all([
      getSite(),
      getCopy(),
      getVolunteerPage(),
      getGuideCards(),
      getPartners(),
      loadEvents(),
      getSafeguarding(),
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
    ...safeguardingLines(safeguarding),
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
    ...faqLines(guide.faq.items, values, url),
    ...partnerLines(copy, partners),
    "## More",
    "",
    `- [Proud Indian](${abs("/")}): the programmes, Kalakriti, donations and reports.`,
    `- [Donate](${abs("/#donate")}): towards class materials, meals and Kalakriti.`,
    `- Questions: ${values.hr}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
  ].join("\n");
}

/** The page for companies (/csr/), section by section in page order. */
export async function csrMarkdown(origin: URL | undefined) {
  const [site, csr, programmes, partners, reports, safeguarding] =
    await Promise.all([
      getSite(),
      getCsrPage(),
      getProgrammes(),
      getPartners(),
      getReports(),
      getSafeguarding(),
    ]);
  const values = { ...facts(site), ...guideValues(site) };
  const abs = (path: string) => new URL(path, origin ?? site.url).href;
  const url = abs("/csr/");
  const heading = (h: { before: string; accent: string }) =>
    `${h.before} ${h.accent}`;
  const { hero, ways, days, kalakriti: k, fund, drives, how } = csr;
  const name = (anchor: string) => {
    const p = programmes.find((x) => x.anchor === anchor);
    return p ? `${p.verb} (${p.name})` : anchor;
  };
  const latest = (kind: string) => reports.find((d) => d.kind === kind);
  const audited = latest("audited");
  const annual = latest("annual");

  return [
    `# ${heading(hero.heading)}`,
    "",
    `> ${csr.meta.description}`,
    "",
    hero.lede,
    "",
    [
      ...hero.stamps.rect.map((r) => `${r.label} ${fill(r.value, values)}`),
      hero.stamps.round.map((r) => fill(r.value, values)).join(" and "),
      hero.stamps.audited,
    ].join(" · "),
    "",
    `To plan something, write to ${values.connect} (subject “${csr.contact.subject}”) with your team size, rough dates and what you have in mind, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
    `## ${heading(ways.heading)}`,
    "",
    ways.lede,
    "",
    ...ways.cards.map((c) => `- **${c.title}**: ${c.line}`),
    "",
    `## ${heading(days.heading)}`,
    "",
    days.lede,
    "",
    ...days.formats.flatMap((f) => [
      `### ${f.name}`,
      "",
      f.what,
      "",
      `- ${days.labels.size}: ${f.size}`,
      `- ${days.labels.length}: ${f.length}`,
      `- ${days.labels.where}: ${f.where}`,
      `- ${days.labels.provide}: ${f.provide}`,
      "",
    ]),
    `**${days.cost.heading}.** ${days.cost.text}`,
    "",
    `${days.done.heading}: ${days.done.items.map((x) => `${x.name} (${x.did})`).join(", ")}.`,
    "",
    `## ${heading(k.heading)}`,
    "",
    k.lede,
    "",
    ...k.tiers.map((t) => `- **${t.name}, ${t.amount}**: ${t.line}`),
    "",
    `${k.cost} [${k.costLink}](${abs(k.disclosure)}).`,
    "",
    `## ${heading(fund.heading)}`,
    "",
    fund.lede,
    "",
    ...fund.rows.map(
      (r) =>
        `- **${name(r.programme)}**: ${fund.scheduleLabel} ${r.schedule}. ${fund.fundsLabel}: ${r.funds} ${fund.costLabel}: ${r.cost}`
    ),
    "",
    markdown(fund.budget, values, url),
    "",
    `### ${drives.heading}`,
    "",
    drives.lede,
    "",
    ...drives.items.map((x) => `- **${x.name}** (${x.when}): ${x.line}`),
    "",
    `## ${heading(how.heading)}`,
    "",
    ...how.steps.map((x, i) => `${i + 1}. **${x.title}.** ${x.line}`),
    "",
    ...safeguardingLines(safeguarding),
    ...partnerLines(await getCopy(), partners),
    `## ${heading(csr.paperwork.heading)}`,
    "",
    ...csr.paperwork.items.map(
      (i) =>
        `- ${i.label}: ${fill(i.value, values)}${i.note ? ` (${i.note})` : ""}${i.cert ? ` · [${csr.paperwork.pdf}](${abs(site.certificates[i.cert])})` : ""}`
    ),
    ...(audited
      ? [
          `- [${csr.paperwork.latestAudited}, ${audited.year}](${abs(audited.url)})`,
        ]
      : []),
    ...(annual
      ? [
          `- [${csr.paperwork.latestAnnual}, ${annual.year}](${abs(annual.url)})`,
        ]
      : []),
    `- [${csr.paperwork.all}](${abs("/#reports")})`,
    "",
    markdown(csr.paperwork.certificates, values, url),
    "",
    `## ${heading(csr.faq.heading)}`,
    "",
    ...faqLines(csr.faq.items, values, url),
    "## More",
    "",
    `- [Proud Indian](${abs("/")}): the programmes, Kalakriti, donations and reports.`,
    `- [Volunteer guide](${abs("/volunteer/")}): weekend volunteering for individuals.`,
    "",
  ].join("\n");
}

/** A Markdown page (/privacy/, /terms/, /assistants/): its own Markdown, without the team's <!-- notes -->. */
export async function docMarkdown(doc: Doc, origin: URL | undefined) {
  const site = await getSite();
  const abs = (path: string) => new URL(path, origin ?? site.url).href;
  const body = doc.body
    .replace(/<!--[\s\S]*?-->\n*/g, "")
    // in-page links ("#cookies-and-local-storage") point at the page, and site links ("/privacy/") at the site, since
    // this file is read away from it
    .replace(/\]\(#/g, `](${abs(`/${doc.id}/`)}#`)
    .replace(/\]\(\//g, `](${abs("/")}`)
    .trim();
  return [
    `# ${doc.title}`,
    "",
    ...(doc.draft ? [`**Draft.** ${doc.draftNote}`, ""] : []),
    doc.lede,
    "",
    `${doc.dateLabel}: ${doc.effectiveDate}`,
    "",
    body,
    "",
  ].join("\n");
}

/** The festival's page (/kalakriti/), section by section in page order. */
export async function kalakritiMarkdown(origin: URL | undefined) {
  const [site, page, kalakriti, csr] = await Promise.all([
    getSite(),
    getKalakritiPage(),
    getKalakriti(),
    getCsrPage(),
  ]);
  const values = guideValues(site);
  const abs = (path: string) => new URL(path, origin ?? site.url).href;
  const url = abs("/kalakriti/");
  const heading = (h: { before: string; accent: string }) =>
    `${h.before} ${h.accent}`;
  const { hero, events, editions: ed, horizon: h, join: j } = page;
  const L = ed.labels;

  return [
    `# Kalakriti: ${heading(hero.heading)}`,
    "",
    `> ${page.meta.description}`,
    "",
    hero.lede,
    "",
    hero.facts.join(" · "),
    "",
    `[${hero.volunteer}](${site.links.register}) · [${hero.sponsor}](${abs("/csr/#sponsor")})`,
    "",
    `## ${heading(events.heading)}`,
    "",
    events.lede,
    "",
    ...kalakriti.line.photos.map((p) => `- ${p.event}`),
    "",
    `## ${heading(ed.heading)}`,
    "",
    ed.lede,
    "",
    ...ed.items.flatMap((x) => [
      `### ${x.name}`,
      "",
      `- ${L.date}: ${x.dateLabel}`,
      `- ${L.venue}: ${x.venue}`,
      ...(x.children ? [`- ${L.children}: ${x.children}`] : []),
      ...(x.volunteers ? [`- ${L.volunteers}: ${x.volunteers}`] : []),
      `- ${L.cost}: ${x.cost}`,
      `- ${L.raised}: ${x.raised}`,
      "",
      `${x.note} [${ed.disclosure}](${abs(x.disclosure)}).`,
      "",
    ]),
    `## ${h.eyebrow}: ${heading(h.heading)}`,
    "",
    h.lede,
    "",
    `${h.yearLabel}:`,
    "",
    ...h.stats.map((x) => `- ${x.number} ${x.label}`),
    "",
    `${h.story} ${h.next}`,
    "",
    `## ${heading(j.heading)}`,
    "",
    j.lede,
    "",
    ...j.cards.map(
      (c) =>
        `- **${c.title}.** ${c.line} [${c.cta}](${abs(fill(c.href, values))})`
    ),
    "",
    "Sponsorships:",
    "",
    ...csr.kalakriti.tiers.map(
      (t) => `- **${t.name}, ${t.amount}**: ${t.line}`
    ),
    "",
    `## ${heading(page.faq.heading)}`,
    "",
    ...faqLines(page.faq.items, values, url),
    "## More",
    "",
    `- [Proud Indian](${abs("/")}): the programmes, donations and reports.`,
    `- [For companies](${abs("/csr/")}): CSR, Kalakriti sponsorship and employee volunteering.`,
    `- Questions: ${values.connect}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
  ].join("\n");
}

/** A programme's page (/education/, /nutrition/, /community/), section by section in page order. */
export async function programmeMarkdown(
  slug: "education" | "nutrition" | "community",
  origin: URL | undefined
) {
  const [site, copy, { page, band }, events] = await Promise.all([
    getSite(),
    getCopy(),
    getProgrammePage(slug),
    loadEvents(),
  ]);
  const values = guideValues(site);
  const abs = (path: string) => new URL(path, origin ?? site.url).href;
  const url = abs(`/${slug}/`);
  const heading = (h: { before: string; accent: string }) =>
    `${h.before} ${h.accent}`;
  const { hero, what, numbers: n } = page;
  const years = await Promise.all(
    n.years.map(async (y) => ({ ...y, report: await annualReport(y.year) }))
  );

  return [
    `# ${band.verb} (${band.name}): ${heading(hero.heading)}`,
    "",
    `> ${page.meta.description}`,
    "",
    hero.lede,
    "",
    hero.facts.join(" · "),
    "",
    `[${hero.join}](${site.links.register}) · [Donate](${abs("/#donate")})`,
    "",
    `## ${heading(what.heading)}`,
    "",
    what.lede,
    "",
    ...what.cards.map((c) => `- **${c.title}.** ${c.line}`),
    "",
    "## Upcoming sessions",
    "",
    ...sessionLines(
      site,
      events.data.events.filter((e) => e.programme === slug)
    ),
    "",
    "How to join:",
    "",
    ...joinSteps(copy),
    "",
    `## ${heading(n.heading)}`,
    "",
    n.lede,
    "",
    ...years.flatMap((y) => [
      `### [${n.source} ${y.report.label}](${abs(y.report.url)})`,
      "",
      ...y.stats.map((x) => `- ${x.number} ${x.label}`),
      ...(y.note ? ["", y.note] : []),
      "",
    ]),
    `## ${heading(page.faq.heading)}`,
    "",
    ...faqLines(page.faq.items, values, url),
    "## More",
    "",
    `- [Volunteer guide](${abs("/volunteer/")}): every programme, where we meet, the safeguarding rules, internships and the FAQ.`,
    `- [Proud Indian](${abs("/")}): the programmes, Kalakriti, donations and reports.`,
    `- Questions: ${values.hr}, or call or WhatsApp ${site.contacts.phone.display}.`,
    "",
  ].join("\n");
}
