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
