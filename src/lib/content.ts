import type { MarkdownHeading } from "astro";
import { getCollection, getEntry } from "astro:content";

const missing = (name: string) => new Error(`Missing src/content/${name}.yaml`);

export async function getSite() {
  const entry = await getEntry("site", "site");
  if (!entry) throw missing("site");
  return entry.data;
}
export async function getCopy() {
  const entry = await getEntry("copy", "copy");
  if (!entry) throw missing("copy");
  return entry.data;
}
export async function getVolunteerPage() {
  const entry = await getEntry("volunteer", "volunteer");
  if (!entry) throw missing("volunteer");
  return entry.data;
}
/** The share card for a page (src/content/og.yaml), or undefined for the default brand card. */
export async function getShareCard(page: string) {
  const entry = await getEntry("og", "og");
  if (!entry) throw missing("og");
  const card = entry.data[page];
  if (!card) throw new Error(`No share card "${page}" in src/content/og.yaml`);
  return card;
}
export async function getKalakriti() {
  const entry = await getEntry("kalakriti", "kalakriti");
  if (!entry) throw missing("kalakriti");
  return entry.data;
}

export async function getProgrammes() {
  return (await getCollection("programmes"))
    .map((e) => e.data)
    .toSorted((a, b) => a.order - b.order);
}
/** newest first: by financial year (reports) or issue month (disclosures); the collection itself comes back in id order */
export async function getReports() {
  const when = (d: { year?: string; date?: string }) => d.year ?? d.date ?? "";
  return (await getCollection("reports"))
    .map((e) => ({ id: e.id, ...e.data }))
    .toSorted((a, b) => when(b).localeCompare(when(a)));
}
export async function getTrustees() {
  return (await getCollection("trustees")).map((e) => ({
    id: e.id,
    ...e.data,
  }));
}

/** The volunteer guide's "Pick how you help." cards (volunteer.yaml → do.cards), each with its programme's verb,
 *  name, line, chips (Kalakriti: its events) and polaroid. */
export async function getGuideCards() {
  const [{ do: d }, programmes, kala] = await Promise.all([
    getVolunteerPage(),
    getProgrammes(),
    getKalakriti(),
  ]);
  return d.cards.map((c) => {
    const p = programmes.find((x) => x.anchor === c.programme);
    if (!p)
      throw new Error(`volunteer.yaml do.cards: no programme ${c.programme}`);
    const band = p.kind === "band" ? p : null;
    const photo = band ? band.polaroids[c.photo] : kala.line.photos[c.photo];
    if (!photo)
      throw new Error(
        `volunteer.yaml do.cards: ${c.programme} has no photo ${c.photo}`
      );
    return {
      ...c,
      kind: p.kind,
      num: p.num,
      name: p.name,
      verb: p.verb,
      line: band ? band.line : kala.tickets.note,
      chips: band ? band.chips : kala.edition.events,
      photo,
    };
  });
}

type Site = Awaited<ReturnType<typeof getSite>>;

/** "No. 224, …, KR Puram, Bengaluru 560016": one of site.yaml → contacts.addresses on one line */
export const postalAddress = (a: Site["contacts"]["addresses"][number]) =>
  `${a.street}, ${a.locality}${a.postalCode ? ` ${a.postalCode}` : ""}`;

/** Values the copy can reference as {placeholders}, so facts are written once in site.yaml. */
export function facts(site: Site): Record<string, string> {
  return {
    ...site.registrations,
    ...Object.fromEntries(
      Object.entries(site.stats).map(([k, v]) => [k, String(v)])
    ),
    city: site.city,
    foundedLong: site.founded.long,
    foundedShort: site.founded.short,
  };
}

/** Replace {placeholders} with site facts. Unknown names fail the build. */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k];
    if (v === undefined)
      throw new Error(`Unknown placeholder {${k}} in "${text}"`);
    return v;
  });
}

/** "2023-24" -> "23–24" (the document cover label) */
export const shortYear = (year: string) =>
  `${year.slice(2, 4)}–${year.slice(5, 7)}`;

/** The privacy policy (src/content/privacy.md): front matter, its Markdown, rendered HTML and its headings. */
export async function getPrivacy() {
  const entry = await getEntry("privacy", "privacy");
  if (!entry) throw new Error("Missing src/content/privacy.md");
  return {
    ...entry.data,
    body: entry.body ?? "",
    html: entry.rendered?.html ?? "",
    headings: (entry.rendered?.metadata?.headings ?? []) as MarkdownHeading[],
  };
}
