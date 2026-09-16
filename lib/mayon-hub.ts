import { APP_STORE_LINKS } from './app-store-links.ts'

/**
 * Content for the Mayon Volcano hub at /mayon.
 *
 * It lives here rather than inside the page so that availability wording,
 * destinations, screenshot captions and the source list are checkable by tests
 * and editable without touching layout. Every claim that names a number or a
 * finding carries the source it came from; anything the app draws rather than
 * observes says so in the same sentence.
 *
 * This is the volcano in Bicol and the app about it. The early Tamil Māyōṉ
 * material at /knowledge/religion/mayon is a different referent that shares a
 * spelling; the two are linked for disambiguation only, never merged.
 */

export const MAYON_HUB_PATH = '/mayon'
export const MAYON_HUB_URL = 'https://www.mahastrategies.com/mayon'

/** The date the facts, statuses and destinations below were last checked. */
export const MAYON_HUB_REVIEWED = '2026-09-16'

export const MAYON_LINKS = {
  browser: APP_STORE_LINKS.mayon.web,
  android: APP_STORE_LINKS.mayon.android,
  ios: APP_STORE_LINKS.mayon.ios,
  teachers: 'https://mayonrajan.com/teachers/',
  methods: 'https://mayonrajan.com/methods/',
  sources: 'https://mayonrajan.com/learn/sources/',
  updates: 'https://mayonrajan.com/updates/',
  companion: 'https://mayonrajan.com/learn/beneath-the-cone/',
  journeyStorage: 'https://mayonrajan.com/?journey=storage',
  journeyDeep: 'https://mayonrajan.com/?journey=deep',
  crystal: 'https://mayonrajan.com/?crystal=1',
  trailer: 'https://www.youtube.com/watch?v=HXg0IOtWO_E',
  phivolcs: 'https://volcano.phivolcs.dost.gov.ph/',
  smithsonian: 'https://volcano.si.edu/volcano.cfm?vn=273030',
  petrology: 'https://doi.org/10.1007/s00445-021-01486-9',
  unescoTentative: 'https://whc.unesco.org/en/tentativelists/6790',
  thesis: 'https://research.mahastrategies.com/papers/the-volcanic-engine-thesis',
  contact: 'mailto:mayone@mahastrategies.com?subject=Mayon%20Volcano%20%E2%80%94%20contribution%20or%20correction',
} as const

/**
 * Availability, stated per platform because the platforms differ.
 *
 * Version 1.5 is live in the browser. On 16 September 2026 the Google Play
 * listing reported 1.4, and the App Store listing does not publish its version
 * in a form this repository can read, so neither mobile store is described as
 * carrying 1.5. A local version number is not evidence of store approval.
 */
export const MAYON_AVAILABILITY = {
  web: {
    platform: 'Browser',
    status: 'Version 1.5 — available now',
    detail: 'The full experience runs in a browser on a phone, tablet or computer. No install and no account.',
    href: MAYON_LINKS.browser,
    event: 'cta_mayon_browser',
  },
  android: {
    platform: 'Android',
    status: 'On Google Play',
    detail: 'The Play listing reported version 1.4 when this page was last checked, so the 1.5 additions below may not have reached it yet.',
    href: MAYON_LINKS.android,
    event: 'cta_mayon_android',
  },
  ios: {
    platform: 'iPhone and iPad',
    status: 'On the App Store',
    detail: 'The App Store listing does not publish a version we can read automatically. Check the listing for what it currently offers.',
    href: MAYON_LINKS.ios,
    event: 'cta_mayon_ios',
  },
} as const

export type MayonScreenshot = {
  src: string
  width: number
  height: number
  alt: string
  caption: string
  action: string
  href?: string
}

/**
 * Real frames from the 1.5 build, captured on 2026-09-16 in an Android 16
 * emulator for the Play listing and reused here. Not mockups, not renders.
 */
export const MAYON_SCREENSHOTS: readonly MayonScreenshot[] = [
  {
    src: '/mayon/screenshot-explore-true-scale.webp',
    width: 810,
    height: 1440,
    alt: 'The Mayon cone seen from the plain, with a steam plume at the summit and the Explore, Journey Inside, Through Time and Discover controls below.',
    caption: 'Explore: the cone at true scale',
    action: 'Turn the mountain, move the sun through the day, and switch on places, scale comparisons or hazard scenarios. Terrain is NASA SRTM elevation under an Esri imagery drape.',
    href: MAYON_LINKS.browser,
  },
  {
    src: '/mayon/screenshot-journey-inside.webp',
    width: 810,
    height: 1440,
    alt: 'A cutaway of the volcano with a labelled magma-storage band, two depth estimates listed, and a shareable link reading mayonrajan.com/?journey=storage.',
    caption: 'Journey Inside: the storage station',
    action: 'Descend through four stations beneath the summit. Each one draws what is proposed, not photographed, and the panel keeps competing depth estimates side by side instead of choosing one.',
    href: MAYON_LINKS.journeyStorage,
  },
  {
    src: '/mayon/screenshot-how-do-we-know.webp',
    width: 810,
    height: 1440,
    alt: 'The How do we know? panel, separating what was observed, what researchers infer, what the scene illustrates and what remains uncertain.',
    caption: 'How do we know?',
    action: 'Every station opens an evidence panel split four ways: observed, inferred, illustrated, uncertain. Here it shows two published depth estimates that do not agree, and says so.',
    href: MAYON_LINKS.journeyStorage,
  },
  {
    src: '/mayon/screenshot-follow-a-crystal.webp',
    width: 810,
    height: 1440,
    alt: 'The Follow a Crystal investigation, showing core, middle zone and rim, and a magnesium profile falling from rim to core.',
    caption: 'Follow a Crystal',
    action: 'Reveal a crystal zone at a time and read the magnesium profile across it. The drawing is labelled as the kind of crystal studied, not a particular specimen.',
    href: MAYON_LINKS.crystal,
  },
]

export type MayonFact = {
  label: string
  value: string
  note: string
  sourceLabel: string
  href: string
}

export const MAYON_FACTS: readonly MayonFact[] = [
  {
    label: 'Where',
    value: 'Albay, Bicol Region',
    note: 'On Luzon in the Philippines, rising directly behind Legazpi and the towns around its base.',
    sourceLabel: 'Smithsonian Global Volcanism Program',
    href: MAYON_LINKS.smithsonian,
  },
  {
    label: 'Type',
    value: 'Stratovolcano',
    note: 'Built from repeated eruptions of similar lava and fragmental material, which is what produces the steep, near-symmetrical cone.',
    sourceLabel: 'Smithsonian Global Volcanism Program',
    href: MAYON_LINKS.smithsonian,
  },
  {
    label: 'Height',
    value: 'About 2,462–2,463 m',
    note: 'Published figures differ slightly and change with eruptions and re-surveys; the app renders its terrain against 2,463 m. Treat either number as a reference, not a measurement made here.',
    sourceLabel: 'Smithsonian Global Volcanism Program',
    href: MAYON_LINKS.smithsonian,
  },
  {
    label: 'Current activity',
    value: 'PHIVOLCS publishes it',
    note: 'This page and the app never show an alert level. PHIVOLCS is the authority for current status, warnings and instructions.',
    sourceLabel: 'PHIVOLCS volcano portal',
    href: MAYON_LINKS.phivolcs,
  },
]

export type MayonQuestion = { question: string; answer: string; id: string }

/**
 * Six questions answered in full on this page. They are also useful as FAQ
 * structured data, but the answers are written to stand on their own whether
 * or not any search engine renders them.
 */
export const MAYON_QUESTIONS: readonly MayonQuestion[] = [
  {
    id: 'where-is-mayon',
    question: 'Where is Mayon Volcano?',
    answer:
      'Mayon stands in Albay province, in the Bicol Region of south-eastern Luzon, Philippines. Legazpi City sits at its southern foot, and farmland, barangays and the ruins at Cagsawa ring its base. It is the most active volcano in the country, and the communities around it live with that continuously rather than occasionally.',
  },
  {
    id: 'why-the-cone',
    question: 'Why is its cone so recognisable?',
    answer:
      'Mayon is a stratovolcano: it has been built up by many eruptions of broadly similar material from a central vent. Lava, ash and fragmental debris settle at similar angles on every side, so the profile stays steep and close to symmetrical instead of spreading into a broad dome or collapsing into a caldera. Erosion between eruptions has not had long enough to break that shape up.',
  },
  {
    id: 'beneath-the-surface',
    question: 'What might be beneath the surface?',
    answer:
      'Nobody has seen it. Researchers infer the plumbing from what erupted material records and from how the ground responds at the surface. A 2021 study in the Bulletin of Volcanology set two approaches beside each other at Mayon: pressures recorded by minerals and dissolved gas suggest storage from near the surface to roughly 4–8 km below the summit, while gravity and ground-tilt measurements point to about 6–8 km below the summit, which is 4–5 km below sea level. The two do not line up, and the authors treat the uncertainties in each method as the likely explanation. The app draws both bands rather than picking one.',
  },
  {
    id: 'crystals',
    question: 'How do crystals help scientists study magma?',
    answer:
      'Crystals grow in layers, and each layer forms under the conditions around it at the time. When an eruption carries them to the surface, those layers survive as a record: a change in composition from core to rim marks a change in the magma. In the app you reveal the zones one at a time and read the magnesium profile across a crystal, which is the same reasoning volcanologists use to argue that fresh magma arrived before an eruption. The crystal drawn on screen represents the kind of crystal studied, not one specific specimen.',
  },
  {
    id: 'what-is-illustrative',
    question: 'What does the app show, and what is illustrative?',
    answer:
      'The terrain is real elevation data with a satellite imagery drape. The eruption history follows the documented record. The interior is not observed: chambers, conduits and depth bands are a conceptual model informed by published research, and the app labels them that way at each station through its How do we know? panels, which separate what was observed, what researchers infer, what the scene illustrates and what remains uncertain. Hazard scenes are teaching overlays, never forecasts.',
  },
  {
    id: 'without-installing',
    question: 'Can I explore it without installing an app?',
    answer:
      'Yes. The complete experience, including the 1.5 additions, runs in a browser at mayonrajan.com with no install and no account. The Android and iOS listings exist for people who prefer an app on their device, and their store pages state what version each currently offers.',
  },
]

export type MayonRoadmapItem = {
  title: string
  status: 'Available' | 'In development' | 'Exploring'
  detail: string
}

/**
 * Status vocabulary is fixed: Available means a visitor can use it today,
 * In development means work exists in the project now, Exploring means it is
 * a proposal in the 2.0 concept film and nothing more. No dates are promised.
 */
export const MAYON_ROADMAP: readonly MayonRoadmapItem[] = [
  {
    title: 'Journey Inside, Follow a Crystal, evidence panels',
    status: 'Available',
    detail: 'Shipped in 1.5 and live in the browser now.',
  },
  {
    title: 'Deeper interior investigations',
    status: 'Exploring',
    detail: 'More stations, more of the reasoning behind each depth estimate, and investigations that let a visitor test an interpretation rather than read it.',
  },
  {
    title: 'Volcanoes as planetary systems',
    status: 'Exploring',
    detail: 'Connecting one mountain to volcanism elsewhere: what a cone, a crystal and a gas measurement say about a planet that is still cooling.',
  },
  {
    title: 'Community perspectives on Mayon as home',
    status: 'Exploring',
    detail: 'Memory, language and daily life around the mountain, contributed and credited by the people they belong to. Nothing is collected yet.',
  },
]

export type MayonSource = { title: string; href: string; use: string }

export const MAYON_SOURCES: readonly MayonSource[] = [
  {
    title: 'PHIVOLCS — Philippine Institute of Volcanology and Seismology',
    href: MAYON_LINKS.phivolcs,
    use: 'The authority for current activity, alert levels and public instructions. Nothing on this page is a substitute for it.',
  },
  {
    title: 'Smithsonian Global Volcanism Program — Mayon',
    href: MAYON_LINKS.smithsonian,
    use: 'Reference record for Mayon’s location, volcano type, summit elevation and eruption history.',
  },
  {
    title: 'Bulletin of Volcanology (2021) — petrological constraints at Mayon',
    href: MAYON_LINKS.petrology,
    use: 'The published work behind the two depth estimates described above. It constrains the plumbing; it does not image the shapes the app draws.',
  },
  {
    title: 'Mayon Volcano Natural Park — UNESCO tentative list',
    href: MAYON_LINKS.unescoTentative,
    use: 'The park is on the Philippines’ tentative list. A tentative listing is a proposal for future consideration, not World Heritage inscription.',
  },
  {
    title: 'Mayon app source and evidence register',
    href: MAYON_LINKS.sources,
    use: 'Claim-level record of what each source in the app is used for, including terrain and imagery providers, with the date each was last checked.',
  },
]

/** Analytics event names. Lower-case with underscores, `cta_` prefixed so the
 *  existing conversion endpoint classifies them as CTA clicks. */
export const MAYON_EVENTS = {
  browser: 'cta_mayon_browser',
  android: 'cta_mayon_android',
  ios: 'cta_mayon_ios',
  trailer: 'cta_mayon_trailer',
  teachers: 'cta_mayon_teachers',
  contribute: 'cta_mayon_contribute',
} as const

/** Facts for the trailer, read from the published video on 2026-09-16. */
export const MAYON_TRAILER = {
  videoId: 'HXg0IOtWO_E',
  title: 'Mayon Volcano 2.0 The Living Mountain 1080p',
  watchUrl: MAYON_LINKS.trailer,
  embedUrl: 'https://www.youtube-nocookie.com/embed/HXg0IOtWO_E',
  poster: '/mayon/living-mountain-poster.webp',
  durationSeconds: 60,
  durationLabel: '1:00',
  uploadDate: '2026-09-15',
} as const
