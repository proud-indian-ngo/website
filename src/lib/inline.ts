/**
 * Inline text from the content files as HTML: {placeholders} filled from `values`, the text escaped, then
 * [text](url) links and bare email addresses turned into links. Nothing else is interpreted, so content can't inject
 * markup. Used by the volunteer guide (copy in src/content/volunteer.yaml).
 */
import { fill, type getSite } from "./content";
import { esc } from "./escape";

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const EMAIL_RE = /(^|[\s(])([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/** `href` as written, or resolved against `base` (structured data and plain-text files need absolute links) */
const resolve = (href: string, base?: string) =>
  base ? new URL(href, base).href : href;

export function inline(
  text: string,
  values: Record<string, string>,
  base?: string
): string {
  const links: string[] = [];
  // links first (their text may hold an email), parked as tokens so escaping and the email pass leave them alone
  const html = esc(
    fill(text, values).replace(LINK_RE, (_, label: string, href: string) => {
      links.push(`<a href="${esc(resolve(href, base))}">${esc(label)}</a>`);
      return `\uE000${links.length - 1}\uE001`;
    })
  );
  return html
    .replace(
      EMAIL_RE,
      (_, pre: string, email: string) =>
        `${pre}<a href="mailto:${email}">${email}</a>`
    )
    .replace(/\uE000(\d+)\uE001/g, (_, i: string) => links[Number(i)]!);
}

/** The same text as Markdown for plain-text files (/llms.txt): placeholders filled, links made absolute. */
export const markdown = (
  text: string,
  values: Record<string, string>,
  base: string
) =>
  fill(text, values).replace(
    LINK_RE,
    (_, label: string, href: string) => `[${label}](${resolve(href, base)})`
  );

type Site = Awaited<ReturnType<typeof getSite>>;

/** The {placeholders} the volunteer guide's copy can use. */
export function guideValues(site: Site): Record<string, string> {
  const email = (re: RegExp) =>
    site.contacts.emails.find((e) => re.test(e.label))?.address ??
    site.contacts.emails[0]!.address;
  return {
    register: site.links.register,
    events: site.links.events,
    hr: email(/volunteer/i),
    connect: email(/general/i),
    phone: site.contacts.phone.display,
  };
}
