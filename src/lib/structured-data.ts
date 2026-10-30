/**
 * schema.org JSON-LD. The home page: the NGO, the website, and one Event per upcoming session from the build's
 * events feed. The volunteer guide (/volunteer/) and the programme pages: the page, its FAQ and the sessions. The page for companies
 * (/csr/): the page, its FAQ, the volunteering days and the Kalakriti sponsorships as offers. Search engines and AI agents read it to answer "where can I volunteer at weekends in Bangalore?".
 * Facts come from site.yaml and copy.yaml, sessions from the pi-dash feed (src/lib/events/load.ts), so nothing here
 * needs editing by hand. The browser refresh does not touch it; the rebuild on every events change keeps it current.
 */
import type { getCopy, getCsrPage, getKalakritiPage, getSite } from "./content";
import type { PublicEvent } from "./events/contract";
import { neighbourhood } from "./events/format";

type Site = Awaited<ReturnType<typeof getSite>>;
type Copy = Awaited<ReturnType<typeof getCopy>>;
type Address = Site["contacts"]["addresses"][number];
type CsrPage = Awaited<ReturnType<typeof getCsrPage>>;
type KalakritiPage = Awaited<ReturnType<typeof getKalakritiPage>>;

/** The city the way people search for it as well as its official name. */
const CITY = {
  "@type": "City",
  name: "Bengaluru",
  alternateName: "Bangalore",
} as const;

/** A page's FAQ, with the answers as plain HTML (links absolute) */
const faqPage = (url: string, faq: { q: string; a: string }[]) => ({
  "@type": "FAQPage",
  "@id": `${url}#faq`,
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

/**
 * The NGO as an Event's organizer or performer. Google's Event checks don't follow an "@id" to the home page's node,
 * so the name and URL go inline as well.
 */
const eventOrg = (origin: string) => ({
  "@type": "NGO",
  "@id": new URL("/#organization", origin).href,
  name: "Proud Indian",
  url: new URL("/", origin).href,
});

function sessionEvent(e: PublicEvent, origin: string) {
  const area = neighbourhood(e.area);
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
        ...(area && { streetAddress: area }),
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
    organizer: eventOrg(origin),
    // our volunteers lead every session
    performer: eventOrg(origin),
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
      {
        "@type": "PropertyValue",
        propertyID: "CSR-1 (Ministry of Corporate Affairs)",
        value: site.registrations.csr1,
      },
    ],
    taxID: site.registrations.pan,
    knowsAbout: [
      "Weekend volunteering in Bengaluru",
      ...copy.marquee.items.map((i) => i.label),
    ],
    sameAs: site.social.map((s) => s.url),
    potentialAction: {
      "@type": "DonateAction",
      target: site.links.razorpay.base,
      recipient: { "@id": orgId },
      priceCurrency: "INR",
    },
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
    "@graph": [ngo, website, ...events.map((e) => sessionEvent(e, origin))],
  };
}

/**
 * The volunteer guide and the programme pages (/education/, /nutrition/, /community/): the page (about the NGO, with a
 * breadcrumb home named `crumb`), its FAQ and its upcoming sessions (a programme page's own only). `faq` answers are the
 * HTML the page shows (Google allows links and basic markup in an Answer).
 */
export function guideStructuredData(
  page: { url: string; title: string; description: string },
  crumb: string,
  faq: { q: string; a: string }[],
  events: PublicEvent[],
  origin: string
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      subPage(page, crumb, origin),
      faqPage(page.url, faq),
      ...events.map((e) => sessionEvent(e, origin)),
    ],
  };
}

/** A page under the home page: the WebPage about the NGO, with a breadcrumb home. */
function subPage(
  page: { url: string; title: string; description: string },
  crumb: string,
  origin: string
) {
  return {
    "@type": "WebPage",
    "@id": page.url,
    url: page.url,
    name: page.title,
    description: page.description,
    inLanguage: "en-IN",
    isPartOf: { "@id": new URL("/#website", origin).href },
    about: { "@id": new URL("/#organization", origin).href },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: new URL("/", origin).href,
        },
        { "@type": "ListItem", position: 2, name: crumb, item: page.url },
      ],
    },
  };
}

/** "₹4,50,000" -> 450000 */
const rupees = (amount: string) => Number(amount.replace(/[^\d]/g, ""));

/**
 * The page for companies: the page, its FAQ (answers as the page's HTML), the volunteering days as a Service with
 * one Offer per format (each day is quoted, so no price), and the Kalakriti sponsorships as a Service with priced
 * Offers. Search engines and agents read it to answer "CSR NGO in Bangalore" or "corporate volunteering in Bengaluru".
 */
export function csrStructuredData(
  page: { url: string; title: string; description: string },
  faq: { q: string; a: string }[],
  csr: CsrPage,
  origin: string
) {
  const orgId = new URL("/#organization", origin).href;
  return {
    "@context": "https://schema.org",
    "@graph": [
      subPage(page, "CSR and employee volunteering", origin),
      {
        "@type": "Service",
        "@id": `${page.url}#days`,
        name: "Employee volunteering days in Bengaluru",
        serviceType: "Corporate volunteering",
        description: csr.days.lede,
        provider: { "@id": orgId },
        areaServed: CITY,
        url: `${page.url}#days`,
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: csr.days.heading.before + " " + csr.days.heading.accent,
          itemListElement: csr.days.formats.map((f) => ({
            "@type": "Offer",
            name: f.name,
            description: `${f.what} Team size: ${f.size}. ${f.length}. Where: ${f.where}.`,
            areaServed: CITY,
          })),
        },
      },
      {
        "@type": "Service",
        "@id": `${page.url}#sponsor`,
        name: "Kalakriti sponsorship",
        serviceType: "Event sponsorship",
        description: csr.kalakriti.lede,
        provider: { "@id": orgId },
        areaServed: CITY,
        url: `${page.url}#sponsor`,
        offers: csr.kalakriti.tiers.map((t) => ({
          "@type": "Offer",
          name: `${t.name}: ${t.amount}`,
          description: t.line,
          price: rupees(t.amount),
          priceCurrency: "INR",
        })),
      },
      faqPage(page.url, faq),
    ],
  };
}

/** Serialise for a <script type="application/ld+json">, safe against a "</script>" inside the data. */
export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");

/**
 * /kalakriti/: the page, each edition as a Festival (free, in person, in Bengaluru, organised by us) and the FAQ. The
 * next edition has no date yet, so it isn't an Event until it does.
 */
export function kalakritiStructuredData(
  page: { url: string; title: string; description: string },
  faq: { q: string; a: string }[],
  kala: KalakritiPage,
  origin: string
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      subPage(page, "Kalakriti", origin),
      ...kala.editions.items.map((x) => ({
        "@type": "Festival",
        "@id": `${page.url}#${x.date}`,
        name: x.name,
        description: `${kala.hero.lede} ${x.note}`,
        startDate: x.date,
        endDate: x.date,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        isAccessibleForFree: true,
        location: {
          "@type": "Place",
          name: x.venue,
          address: {
            "@type": "PostalAddress",
            addressLocality: CITY.name,
            addressRegion: "Karnataka",
            addressCountry: "IN",
          },
        },
        image: new URL("/og/kalakriti.png", origin).href,
        organizer: eventOrg(origin),
        // the children perform; our volunteers run the day
        performer: {
          "@type": "PerformingGroup",
          name: `Children from ${CITY.name}'s low-income communities`,
        },
        url: `${page.url}#editions`,
        subjectOf: {
          "@type": "DigitalDocument",
          name: `${x.name} financial disclosure`,
          url: new URL(x.disclosure, origin).href,
          encodingFormat: "application/pdf",
        },
      })),
      faqPage(page.url, faq),
    ],
  };
}
