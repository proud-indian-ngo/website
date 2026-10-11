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

/**
 * Which links open in a new tab: PDFs (closing the viewer would close the site, and the reports drawer's place) and
 * other sites (partners, maps, social, WhatsApp, Razorpay). Our own pages and the volunteer dashboard stay in this tab;
 * signing up there is a handoff, like going to a checkout.
 */
const OWN_SITE = /^https?:\/\/(?:[\w-]+\.)*proudindian\.ngo(?:[/?#]|$)/i;
export const opensNewTab = (href: string) =>
  /\.pdf(?:[?#]|$)/i.test(href) ||
  (/^https?:\/\//i.test(href) && !OWN_SITE.test(href));

/** What screen readers hear after a link that opens a new tab (WCAG G201); everyone else sees "↗". */
const NEW_TAB_NOTE = "opens in a new tab";

/** target and rel for a new-tab link. `sponsored` marks a link given in return for support (Google's link spam
 *  policy asks for it on paid placements, and Kalakriti's sponsors get their name on the festival). */
export const newTab = (sponsored = false) => ({
  target: "_blank",
  rel: sponsored ? "sponsored noopener" : "noopener",
});

/** NewTab.astro's marker as HTML, for links built as strings */
export const NEW_TAB_MARK = ` <span aria-hidden="true">↗</span><span class="sr-only"> (${NEW_TAB_NOTE})</span>`;

/** Rendered Markdown (the privacy policy): the links that open in a new tab get target, rel and the marker. */
export const markNewTabLinks = (html: string) =>
  html.replace(
    /<a href="([^"]+)">([\s\S]*?)<\/a>/g,
    (link, href: string, text: string) =>
      opensNewTab(href)
        ? `<a href="${href}" target="_blank" rel="noopener">${text}${NEW_TAB_MARK}</a>`
        : link
  );

/** an aria-label for a new-tab link (an aria-label replaces the link's text, so the hidden note has to be in it) */
export const newTabLabel = (label: string) => `${label} (${NEW_TAB_NOTE})`;
