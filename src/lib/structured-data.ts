/**
 * schema.org JSON-LD. The home page: the NGO, the website, and one Event per upcoming session from the build's
 * events feed. The volunteer guide (/volunteer/): the page, its FAQ and the same sessions. Search engines and AI agents read it to answer "where can I volunteer at weekends in Bangalore?".
 * Facts come from site.yaml and copy.yaml, sessions from the pi-dash feed (src/lib/events/load.ts), so nothing here
 * needs editing by hand. The browser refresh does not touch it; the rebuild on every events change keeps it current.
 */
import type { getCopy, getSite } from "./content";
import type { PublicEvent } from "./events/contract";

type Site = Awaited<ReturnType<typeof getSite>>;
type Copy = Awaited<ReturnType<typeof getCopy>>;
type Address = Site["contacts"]["addresses"][number];

/** The city the way people search for it as well as its official name. */
const CITY = {
  "@type": "City",
  name: "Bengaluru",
  alternateName: "Bangalore",
} as const;

function sessionEvent(e: PublicEvent, origin: string, orgId: string) {
  const [area] = e.area.split(",");
  return {
    "@type": "Event",
    name: e.name,
    description:
      e.summary ||
      `${e.name}, a volunteer session with Proud Indian in ${e.area}.`,
    startDate: e.startTime,
    ...(Date.parse(e.endTime) > Date.parse(e.startTime) && {
      endDate: e.endTime,
    }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    // the feed gives a coarse public area, never the exact address
    location: {
      "@type": "Place",
      name: e.area,
      address: {
        "@type": "PostalAddress",
        ...(area && area !== e.area && { streetAddress: area.trim() }),
        addressLocality: "Bengaluru",
        addressRegion: "Karnataka",
        addressCountry: "IN",
      },
    },
    image: new URL("/og.png", origin).href,
    url: e.signUpUrl,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: e.signUpUrl,
    },
    organizer: { "@id": orgId },
  };
}

export function homeStructuredData(
  site: Site,
  copy: Copy,
  events: PublicEvent[],
  origin: string
) {
  const orgId = new URL("/#organization", origin).href;
  const [office] = site.contacts.addresses;
  const postal = (a: Address) => ({
    "@type": "PostalAddress",
    streetAddress: a.street,
    addressLocality: a.locality,
    addressRegion: a.region,
    ...(a.postalCode && { postalCode: a.postalCode }),
    addressCountry: "IN",
  });
  const ngo = {
    "@type": "NGO",
    "@id": orgId,
    name: site.name,
    alternateName: `${site.name} NGO`,
    url: new URL("/", origin).href,
    logo: new URL("/icon-512.png", origin).href,
    image: new URL("/og.png", origin).href,
    description: copy.footer.mission,
    slogan: `${copy.hero.pre} ${copy.hero.word}`,
    foundingDate: site.founded.date,
    foundingLocation: CITY,
    areaServed: CITY,
    ...(office && { address: postal(office) }),
    // every address (the office, the community centre) as a place, with its map pin
    location: site.contacts.addresses.map((a) => ({
      "@type": "Place",
      name: a.name ?? a.label,
      address: postal(a),
      ...(a.map && { hasMap: a.map }),
      ...(a.geo && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: a.geo.lat,
          longitude: a.geo.lng,
        },
      }),
    })),
    email: site.contacts.emails[0]?.address,
    telephone: site.contacts.phone.tel,
    contactPoint: site.contacts.emails.map((e) => ({
      "@type": "ContactPoint",
      contactType: e.label,
      email: e.address,
      telephone: site.contacts.phone.tel,
      areaServed: "IN",
    })),
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "NGO Darpan",
        value: site.registrations.darpan,
      },
      {
        "@type": "PropertyValue",
        propertyID: "Registration no.",
        value: site.registrations.registrationNo,
      },
    ],
    taxID: site.registrations.pan,
    knowsAbout: [
      "Weekend volunteering in Bengaluru",
      ...copy.marquee.items.map((i) => i.label),
    ],
    sameAs: site.social.map((s) => s.url),
  };
  const website = {
    "@type": "WebSite",
    "@id": new URL("/#website", origin).href,
    url: new URL("/", origin).href,
    name: site.name,
    inLanguage: "en-IN",
    publisher: { "@id": orgId },
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      ngo,
      website,
      ...events.map((e) => sessionEvent(e, origin, orgId)),
    ],
  };
}

/**
 * The volunteer guide: the page (about the NGO, with a breadcrumb home), its FAQ and the upcoming sessions. `faq`
 * answers are the HTML the page shows (Google allows links and basic markup in an Answer).
 */
export function volunteerStructuredData(
  page: { url: string; title: string; description: string },
  faq: { q: string; a: string }[],
  events: PublicEvent[],
  origin: string
) {
  const orgId = new URL("/#organization", origin).href;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": page.url,
        url: page.url,
        name: page.title,
        description: page.description,
        inLanguage: "en-IN",
        isPartOf: { "@id": new URL("/#website", origin).href },
        about: { "@id": orgId },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: new URL("/", origin).href,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Volunteer",
              item: page.url,
            },
          ],
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${page.url}#faq`,
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      ...events.map((e) => sessionEvent(e, origin, orgId)),
    ],
  };
}

/** Serialise for a <script type="application/ld+json">, safe against a "</script>" inside the data. */
export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");
