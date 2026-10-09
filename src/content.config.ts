import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
/**
 * Content collections. Everything editable lives in src/content/ as YAML (the privacy policy is Markdown),
 * validated here at build time.
 * Images are paths relative to src/assets/ (e.g. "photos/teach-postmaster.jpg"); src/lib/images.ts resolves them and
 * fails the build if one is missing. The shapes are plain YAML so a git-based CMS (Keystatic, Sveltia) can be pointed
 * at the same files later.
 */
import { defineCollection } from "astro:content";

const asset = z
  .string()
  .regex(
    /^(photos|cutouts|board)\/[\w.-]+\.(jpg|png)$/,
    "a path under src/assets/"
  );
const position = z.string().regex(/^\d+% \d+%$/);
const pic = z.object({ image: asset, alt: z.string() });
const kid = z.object({
  image: asset,
  label: z.string(),
  crop: z.string().regex(/^\d+\/\d+$/),
});
const heading = z.object({ before: z.string(), accent: z.string() });
const link = z.object({ label: z.string(), href: z.string() });

const single = (name: string) =>
  glob({ pattern: `${name}.yaml`, base: "./src/content" });

const site = defineCollection({
  loader: single("site"),
  schema: z.object({
    name: z.string(),
    url: z.url(),
    city: z.string(),
    founded: z.object({
      long: z.string(),
      short: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    stats: z.object({
      optimists: z.string(),
      hours: z.string(),
      reached: z.string(),
      programmesPercent: z.number().min(0).max(100),
    }),
    registrations: z.object({
      taxExemption: z.string(),
      registered: z.string(),
      darpan: z.string(),
      pan: z.string(),
      registrationNo: z.string(),
    }),
    contacts: z.object({
      emails: z.array(z.object({ label: z.string(), address: z.email() })),
      phone: z.object({
        label: z.string(),
        display: z.string(),
        tel: z.string(),
      }),
      addresses: z
        .array(
          z.object({
            label: z.string(),
            name: z.string().optional(),
            street: z.string(),
            locality: z.string(),
            region: z.string(),
            postalCode: z.string().optional(),
            map: z.url().optional(),
            geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
          })
        )
        .min(1),
    }),
    social: z.array(
      z.object({
        network: z.enum(["instagram", "linkedin", "youtube", "facebook", "x"]),
        label: z.string(),
        url: z.url(),
      })
    ),
    links: z.object({
      register: z.url(),
      events: z.url(),
      dashboardHost: z.string(),
      razorpay: z.object({
        base: z.url(),
        param: z.string(),
        min: z.number().int().positive(),
      }),
    }),
  }),
});

const programmes = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/programmes" }),
  schema: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("band"),
      order: z.number(),
      anchor: z.string(),
      num: z.string(),
      name: z.string(),
      verb: z.string(),
      verbReveal: z.enum(["wipe", "rise"]),
      surface: z.enum(["sky", "paper"]),
      doodle: z.enum(["book", "bowl", "heart"]),
      line: z.string(),
      chips: z.array(z.string()),
      cta: z.string(),
      polaroids: z
        .array(pic.extend({ caption: z.string(), position }))
        .length(3),
      sticker: pic,
    }),
    z.object({
      kind: z.literal("festival"),
      order: z.number(),
      anchor: z.string(),
      num: z.string(),
      name: z.string(),
      verb: z.string(),
    }),
  ]),
});

const kalakriti = defineCollection({
  loader: single("kalakriti"),
  schema: z.object({
    label: z.string(),
    heading: z.object({
      word: z.string(),
      walk: z.string(),
      accent: z.string(),
    }),
    edition: z.object({
      name: z.string(),
      version: z.string(),
      presents: z.string(),
      ordinal: z.string(),
      date: z.string(),
      dateNote: z.string(),
      lineup: z.array(
        z.object({
          number: z.string(),
          word: z.string(),
          highlight: z.boolean().optional(),
        })
      ),
      billing: z.string(),
      events: z.array(z.string()),
      troupe: z.array(pic).length(3),
    }),
    tickets: z.object({
      band: z.string(),
      pick: z.string(),
      volunteer: z.object({
        kicker: z.string(),
        title: z.string(),
        rail: z.array(z.string()),
        stub: z.string(),
      }),
      sponsor: z.object({
        kicker: z.string(),
        title: z.string(),
        rail: z.array(z.string()),
        stub: z.string(),
      }),
      note: z.string(),
    }),
    line: z.object({
      heading: z.string(),
      stamp: z.string(),
      regionLabel: z.string(),
      prev: z.string(),
      next: z.string(),
      swipe: z.string(),
      photos: z
        .array(pic.extend({ event: z.string(), caption: z.string(), position }))
        .length(8),
    }),
  }),
});

const reports = defineCollection({
  loader: file("src/content/reports.yaml"),
  schema: z.object({
    kind: z.enum(["annual", "audited", "disclosure"]),
    title: z.string(),
    year: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    /** month a project disclosure was issued, 2025-09 */
    date: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    url: z.string(),
    featured: z.boolean().optional(),
  }),
});

const trustees = defineCollection({
  loader: file("src/content/trustees.yaml"),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    image: asset,
    tile: z.enum(["sky", "wash"]),
    tilt: z.number(),
    fit: z.object({
      width: z.number(),
      bottom: z.number(),
      marginLeft: z.number(),
    }),
  }),
});

const copy = defineCollection({
  loader: single("copy"),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    nav: z.object({
      skip: z.string(),
      logoLabel: z.string(),
      links: z.array(link.extend({ spy: z.string() })),
      join: z.string(),
      donate: z.string(),
      openMenu: z.string(),
    }),
    menu: z.object({
      label: z.string(),
      close: z.string(),
      links: z.array(link),
      social: z.array(
        z.object({
          network: z.enum([
            "instagram",
            "linkedin",
            "youtube",
            "facebook",
            "x",
          ]),
          label: z.string(),
        })
      ),
      kid: asset,
    }),
    programmeIndexLabel: z.string(),
    hero: z.object({
      pre: z.string(),
      word: z.string(),
      lede: z.string(),
      join: z.string(),
      donate: z.string(),
      kids: z.object({ girl: kid, boy: kid }),
    }),
    marquee: z.object({ label: z.string(), items: z.array(link) }),
    programmesIntro: z.object({
      eyebrow: z.string(),
      heading: z.object({
        line1: z.string(),
        line2: z.string(),
        accent: z.string(),
      }),
      sub: z.string(),
      collage: z.array(asset).length(8),
    }),
    volunteer: z.object({
      eyebrow: z.string(),
      heading,
      lede: z.string(),
      stepsLabel: z.string(),
      steps: z.array(z.string()).length(3),
      join: z.string(),
      joinNote: z.string(),
      guide: z.string(),
      poster: z.object({
        kicker: z.string(),
        open: z.string(),
        register: z.string(),
      }),
      posterKid: kid,
      more: z.object({
        heading: z.string(),
        link: z.string(),
        prev: z.string(),
        next: z.string(),
      }),
      ticketRegister: z.string(),
      empty: z.object({
        label: z.string(),
        heading: z.string(),
        line: z.string(),
        register: z.string(),
      }),
      unavailable: z.object({
        label: z.string(),
        heading: z.string(),
        line: z.string(),
        register: z.string(),
      }),
    }),
    donate: z.object({
      eyebrow: z.string(),
      heading,
      lede: z.string(),
      kid,
      facts: z.array(z.object({ value: z.string(), label: z.string() })),
      card: z.object({
        label: z.string(),
        choose: z.string(),
        once: z.string(),
        presetsLabel: z.string(),
        presets: z.array(
          z.object({
            amount: z.number().int().positive(),
            coins: z.number().int(),
            selected: z.boolean().optional(),
          })
        ),
        otherField: z.string(),
        otherPlaceholder: z.string(),
        otherLabel: z.string(),
        total: z.string(),
        minimum: z.string(),
        button: z.string(),
        buttonLow: z.string(),
        fine: z.string(),
      }),
    }),
    reports: z.object({
      eyebrow: z.string(),
      heading: z.object({
        line1: z.string(),
        line2: z.string(),
        accent: z.string(),
      }),
      lede: z.string(),
      ring: z.string(),
      tiles: z.object({
        reached: z.string(),
        optimists: z.string(),
        hours: z.string(),
      }),
      kalakriti: z.object({
        chip: z.string(),
        value: z.string(),
        note: z.string(),
      }),
      disclosures: z.object({
        readAll: z.string(),
        label: z.string(),
        /** how many disclosures the drawer lists before "See all" */
        preview: z.number().int().positive(),
        more: z.string(),
        inAll: z.string(),
      }),
      annualLabel: z.string(),
      auditedLabel: z.string(),
      registered: z.object({
        heading: z.string(),
        items: z.array(z.object({ label: z.string(), value: z.string() })),
      }),
      drawer: z.object({
        eyebrow: z.string(),
        heading: z.string(),
        close: z.string(),
        tabsLabel: z.string(),
        tabs: z.record(
          z.enum(["annual", "audited", "disclosure"]),
          z.object({ long: z.string(), short: z.string() })
        ),
        meta: z.record(z.enum(["annual", "audited", "disclosure"]), z.string()),
        pdf: z.string(),
        seeAll: z.string(),
        foot: z.string(),
      }),
    }),
    trustees: z.object({
      heading,
      lede: z.string(),
      glance: z.object({
        stamp: z.string(),
        facts: z.array(z.object({ label: z.string(), value: z.string() })),
        photo: pic.extend({ caption: z.string() }),
      }),
    }),
    closing: z.object({
      chip: z.string(),
      heading,
      lede: z.string(),
      join: z.string(),
      donate: z.string(),
      stripLabel: z.string(),
      strip: z.array(pic.extend({ caption: z.string() })),
    }),
    footer: z.object({
      logoLabel: z.string(),
      mission: z.string(),
      explore: z.string(),
      navLabel: z.string(),
      links: z.array(link),
      write: z.string(),
      call: z.string(),
      visit: z.string(),
      directions: z.string(),
      follow: z.string(),
      stampsLabel: z.string(),
      stampsHeading: z.string(),
      copyright: z.string(),
      privacy: z.string(),
      pause: z.object({
        label: z.string(),
        /** the button label while motion is paused or reduced */
        on: z.string(),
        idle: z.string(),
        paused: z.string(),
        reduced: z.string(),
      }),
    }),
    stickyBar: z.object({
      lead: z.string(),
      rest: z.string(),
      donate: z.string(),
    }),
    thanks: z.object({
      title: z.string(),
      description: z.string(),
      kicker: z.string(),
      heading: z.string(),
      line: z.string(),
      receipt: z.string(),
      payment: z.string(),
      questions: z.string(),
      home: z.string(),
      volunteer: z.string(),
      reports: z.string(),
    }),
  }),
});

// The privacy policy is Markdown (src/content/privacy.md) so the text is easy to edit; /privacy/ renders it.
const privacy = defineCollection({
  loader: glob({ pattern: "privacy.md", base: "./src/content" }),
  schema: z.object({
    title: z.string(),
    /** shows the draft note and keeps the page out of search and the sitemap */
    draft: z.boolean(),
    draftNote: z.string(),
    effectiveDate: z.string(),
    lede: z.string(),
  }),
});

/** /volunteer/: the volunteer guide (src/content/volunteer.yaml) */
const volunteer = defineCollection({
  loader: single("volunteer"),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    nav: z.object({
      links: z
        .array(
          z.object({ label: z.string(), href: z.string(), spy: z.string() })
        )
        .min(1),
      home: z.string(),
    }),
    hero: z.object({
      eyebrow: z.string(),
      heading,
      lede: z.string(),
      join: z.string(),
      sessions: z.string(),
      facts: z.array(z.string()).min(1),
      kids: z.array(z.object({ image: asset, label: z.string() })).length(2),
    }),
    do: z.object({
      eyebrow: z.string(),
      heading,
      lede: z.string(),
      cards: z
        .array(
          z.object({
            programme: z.string(),
            when: z.string(),
            photo: z.number().int().min(0),
          })
        )
        .min(1),
      cta: z.string(),
    }),
    where: z.object({
      eyebrow: z.string(),
      heading,
      lede: z.string(),
      areas: z.string(),
      centre: z.object({
        kicker: z.string(),
        does: z.string(),
        items: z.array(z.string()),
        directions: z.string(),
      }),
      photo: pic.extend({ caption: z.string() }),
    }),
    internships: z.object({
      eyebrow: z.string(),
      heading,
      lede: z.string(),
      steps: z.array(z.string()).min(1),
      apply: z.string(),
      button: z.string(),
      subject: z.string(),
      ticket: z.object({
        kicker: z.string(),
        title: z.string(),
        rail: z.array(z.string()).length(3),
        stub: z.string(),
      }),
    }),
    faq: z.object({
      eyebrow: z.string(),
      heading,
      items: z.array(z.object({ q: z.string(), a: z.string() })).min(1),
    }),
  }),
});

export const collections = {
  site,
  programmes,
  kalakriti,
  reports,
  trustees,
  copy,
  privacy,
  volunteer,
};
