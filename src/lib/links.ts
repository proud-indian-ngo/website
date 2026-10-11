/**
 * In-page links in the shared sections (header, menu, sticky bar, closing, footer) are written for the home page
 * ("#donate"). On another page, pass the anchors that page has: those stay in-page, every other "#…" goes to the home
 * page ("/#donate"). Without a list (the home page) links are left as they are.
 */
export type Anchors = readonly string[] | undefined;

export const linkTo = (href: string, anchors: Anchors) =>
  anchors && href.startsWith("#") && !anchors.includes(href)
    ? `/${href}`
    : href;

/** A mailto link with a pre-filled subject (and body), for the buttons that start an email. */
export const mailto = (to: string, subject: string, body?: string) =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;

/** A WhatsApp chat link from a "+91…" phone number. */
export const whatsapp = (tel: string) =>
  `https://wa.me/${tel.replace(/\D/g, "")}`;
