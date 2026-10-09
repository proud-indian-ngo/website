/** Line icons for the social networks in site.yaml → social (24×24, drawn with the site's 1.8px round stroke).
 *  Used by the footer and the phone menu; render inside <svg viewBox="0 0 24 24"> with set:html. */
import type { getSite } from "./content";

export type Network = Awaited<
  ReturnType<typeof getSite>
>["social"][number]["network"];

export const socialIcons: Record<Network, string> = {
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"></circle>',
  linkedin:
    '<rect x="3" y="3" width="18" height="18" rx="3.5"></rect><path d="M8 10.5V17M8 7.2V7.3M11.5 17V10.5M11.5 13.5C11.5 11.5 12.8 10.4 14.3 10.4S16.5 11.4 16.5 13.3V17"></path>',
  youtube:
    '<rect x="2.5" y="5.5" width="19" height="13" rx="4"></rect><path d="M10.2 9.2L15 12L10.2 14.8Z" fill="currentColor"></path>',
  facebook:
    '<circle cx="12" cy="12" r="9.2"></circle><path d="M13.2 21V12.2C13.2 10 13.9 8.6 16.2 8.6M10 13H15.6"></path>',
  x: '<path d="M4.5 4.5L19.5 19.5M19.5 4.5L4.5 19.5" style="stroke-width:1.6"></path><path d="M4 4H8.5L20 20H15.5Z" style="stroke-width:1.4"></path>',
};
