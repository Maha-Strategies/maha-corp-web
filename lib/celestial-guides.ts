export const CELESTIAL_GUIDE_RELEASE_DATE = '2026-08-18'

export interface CelestialGuideSection {
  heading: string
  paragraphs: readonly string[]
  points?: readonly string[]
}

export interface CelestialGuide {
  path: string
  eyebrow: string
  title: string
  description: string
  summary: string
  calculation: string
  interpretationBoundary: string
  sections: readonly CelestialGuideSection[]
  relatedReports: readonly { href: string; label: string }[]
}

export const CELESTIAL_GUIDES = {
  vimshottari: {
    path: '/knowledge/astrology/vimshottari-dasha',
    eyebrow: 'Jyotiṣa timing method · deterministic chronology',
    title: 'Vimśottarī daśā: calculation, conventions, and limits',
    description: 'How Maha Celestial calculates Vimśottarī daśā periods from the Moon’s Lahiri sidereal nakṣatra, with declared year length and interpretive limits.',
    summary: 'Vimśottarī daśā is a 120-year sequence used in Jyotiṣa. Maha Celestial calculates the chronology reproducibly; source-bound interpretation remains a separate layer.',
    calculation: 'Moon longitude → Lahiri sidereal longitude → janma nakṣatra and elapsed fraction → remaining mahādaśā balance → nested subperiods.',
    interpretationBoundary: 'A daśā date is a calculated result under declared conventions. It does not establish that the period causes or predicts an event.',
    sections: [
      {
        heading: 'The fixed 120-year order',
        paragraphs: ['The implemented sequence is Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, and Mercury. Their conventional durations total 120 years. The sequence repeats; the natal Moon determines where the first reported period begins.'],
        points: ['Ketu 7 years', 'Venus 20 years', 'Sun 6 years', 'Moon 10 years', 'Mars 7 years', 'Rahu 18 years', 'Jupiter 16 years', 'Saturn 19 years', 'Mercury 17 years'],
      },
      {
        heading: 'How the opening balance is computed',
        paragraphs: ['The Moon’s Lahiri sidereal longitude identifies one of 27 equal nakṣatras. The untraversed fraction of that nakṣatra becomes the unexpired fraction of its ruler’s mahādaśā. Maha Celestial records the longitude, ayanāṁśa, boundary distance, year-length convention, and resulting timestamps so the timeline can be reproduced.'],
      },
      {
        heading: 'What can vary between implementations',
        paragraphs: ['Software can disagree because it uses a different ayanāṁśa, ephemeris, node convention, civil-time resolution, year length, or subperiod rounding policy. Those are calculation disagreements, not evidence that one interpretation predicts better. Maha exposes these choices instead of presenting a date without its method.'],
      },
    ],
    relatedReports: [{ href: '/knowledge/birth', label: 'Calculate a birth report and daśā timeline' }],
  },
  lahiri: {
    path: '/knowledge/astrology/lahiri-ayanamsa',
    eyebrow: 'Reference-frame convention · sidereal longitude',
    title: 'Lahiri ayanāṁśa calculations',
    description: 'A reproducible explanation of Lahiri ayanāṁśa, how tropical positions become sidereal longitudes, and which conventions Maha Celestial records.',
    summary: 'Lahiri ayanāṁśa is a coordinate conversion convention. Maha Celestial keeps the original tropical longitude and the applied offset so the sidereal result can be audited.',
    calculation: 'Normalize(tropical ecliptic longitude − Lahiri ayanāṁśa) = Lahiri sidereal longitude.',
    interpretationBoundary: 'Selecting Lahiri defines a coordinate frame. It does not prove that sidereal astrology is empirically valid or superior to another zodiac.',
    sections: [
      {
        heading: 'What the ayanāṁśa does',
        paragraphs: ['The tropical zodiac is anchored to the moving equinox; a sidereal zodiac is anchored through a chosen stellar reference convention. Precession creates an angular separation between them. An ayanāṁśa supplies the offset used to transform a tropical ecliptic longitude into a sidereal longitude.'],
      },
      {
        heading: 'What a reproducible record retains',
        paragraphs: ['A result is incomplete if it says only “sidereal.” Maha retains the UTC instant, observer location where relevant, tropical longitude, named Lahiri method, numerical offset, normalized sidereal longitude, ephemeris and software version, and precision. Near a sign, nakṣatra, or tithi boundary, the report also marks sensitivity to uncertainty.'],
        points: ['The input instant and historical time-zone resolution', 'The tropical longitude before conversion', 'The named ayanāṁśa and its value', 'The resulting sidereal longitude and boundary distance', 'The calculation-library version and precision'],
      },
      {
        heading: 'Why two sidereal charts may disagree',
        paragraphs: ['“Sidereal” is not one universal setting. Different ayanāṁśas place the zero point differently, and small differences can change a placement near a boundary. Node choice, house system, topocentric versus geocentric position, and rounding can introduce further disagreements. A valid comparison must isolate each convention.'],
      },
    ],
    relatedReports: [{ href: '/knowledge/birth', label: 'Inspect a Lahiri birth calculation' }, { href: '/knowledge/celestial', label: 'Read the celestial fact-layer specification' }],
  },
  jupiter: {
    path: '/knowledge/astrology/jupiter-transits',
    eyebrow: 'Transit calculation · tropical and Lahiri sidereal',
    title: 'Jupiter transits without mixed coordinate systems',
    description: 'How Maha Celestial calculates Jupiter ingresses and transits independently in tropical and Lahiri sidereal frames, including retrograde re-entry.',
    summary: 'A Jupiter transit is first a time-indexed longitude. Sign ingress dates depend on the zodiac frame, and retrograde motion can produce several crossings of the same boundary.',
    calculation: 'Ephemeris longitude at UTC instant → selected coordinate frame → sign and house geometry → separately identified tradition rules.',
    interpretationBoundary: 'An ingress timestamp is astronomical geometry under a convention. Describing it as fortunate, expansive, or predictive is an astrological interpretation requiring a named rule and separate empirical testing.',
    sections: [
      {
        heading: 'Why an ingress can have two dates',
        paragraphs: ['Tropical and Lahiri sidereal signs use different zero points. Jupiter therefore crosses the tropical and sidereal versions of a sign boundary on different dates. Maha never averages those dates or silently assigns one system’s sign to the other system’s longitude.'],
      },
      {
        heading: 'Retrograde motion matters',
        paragraphs: ['A planet can cross a sign boundary, reverse across it, and cross it again after stationing direct. A transit engine must search for every crossing in the requested interval and preserve direction. Treating only the first ingress as the entire transit loses material chronology.'],
      },
      {
        heading: 'From transit to a testable forecast',
        paragraphs: ['A testable use of Jupiter requires more than naming a sign. Before outcomes are known, the system must declare the target, horizon, feature definition, expected direction, scoring rule, and ordinary baseline. Forecasts are then persisted and scored prospectively. Until that evidence exists, the report can describe timing symbolism but cannot claim reliable prediction.'],
        points: ['Declare tropical and sidereal features independently', 'Record the natal or event-chart geometry used', 'Pre-register the outcome and evaluation window', 'Compare against a non-astrological baseline', 'Retain misses and non-event periods as well as hits'],
      },
    ],
    relatedReports: [{ href: '/knowledge/birth', label: 'Calculate a chart and timing timeline' }, { href: '/knowledge/corporate', label: 'Build a corporate formation-event report' }],
  },
  comparison: {
    path: '/knowledge/astrology/tropical-vs-sidereal',
    eyebrow: 'Method comparison · independent chart frames',
    title: 'Tropical versus sidereal astrology',
    description: 'A method-first comparison of tropical and sidereal zodiac frames, what changes, what stays fixed, and how Maha Celestial prevents accidental blending.',
    summary: 'Tropical and sidereal charts can consume the same celestial facts while producing different zodiac labels. Maha treats them as parallel declared models, not ingredients in an unlabeled synthesis.',
    calculation: 'One UTC instant and ephemeris → tropical longitude retained → named ayanāṁśa applied for a separate sidereal longitude.',
    interpretationBoundary: 'Agreement or disagreement between traditions is not a scientific validation result. Predictive performance must be measured prospectively for each declared model.',
    sections: [
      {
        heading: 'What remains the same',
        paragraphs: ['The underlying instant, geographic input, planetary state, and ephemeris calculation are shared celestial facts. The Sun–Moon angle and physical planetary configuration do not change merely because a different zodiac label is applied.'],
      },
      {
        heading: 'What changes',
        paragraphs: ['Zodiac sign, degree within sign, sign-based houses, nakṣatra placement, and rules conditioned on those labels can change. House cusps can differ for additional reasons when traditions use different house systems. Each derived result therefore records its coordinate frame and method.'],
        points: ['Tropical: zero point follows the equinox', 'Sidereal: zero point follows a named stellar-reference convention', 'Lahiri: one specific sidereal ayanāṁśa, not a synonym for every sidereal chart', 'Whole-sign and quadrant houses: separate choices from zodiac frame'],
      },
      {
        heading: 'How Maha compares the systems',
        paragraphs: ['The compiler preserves separate feature namespaces, rule packs, predictions, and scores. A tropical rule cannot consume a sidereal placement unless the rule explicitly declares that cross-system dependency. Historical calibration can compare both systems against the same outcome, but it must report model selection and multiple-testing controls.'],
      },
    ],
    relatedReports: [{ href: '/knowledge/birth', label: 'View both coordinate frames in a birth report' }, { href: '/knowledge/astrology', label: 'Browse named traditions and source-bound rules' }],
  },
  corporate: {
    path: '/knowledge/astrology/corporate-charts',
    eyebrow: 'Mundane astrology · organization event records',
    title: 'Corporate charts: events, evidence, and uncertainty',
    description: 'A defensible method for corporate and mundane charts built from evidenced organization events, declared locations, time confidence, and explicit non-claims.',
    summary: 'A company has no biological birth. Maha Celestial therefore charts a named organization event—such as filing acceptance or first commercial transaction—and preserves evidence for that event.',
    calculation: 'Event type + evidence + jurisdiction + location policy + time-confidence interval → celestial facts and stability audit → eligible corporate rules.',
    interpretationBoundary: 'A corporate chart cannot establish legal status, valuation, revenue, investment return, survival, or a guaranteed business outcome.',
    sections: [
      {
        heading: 'Choose the event before calculating',
        paragraphs: ['Formation can refer to filing submission, filing acceptance, first commercial transaction, first deployment, public launch, merger, or another material milestone. These are not interchangeable. The record names the event type and does not retroactively replace it because a later chart appears more favorable.'],
        points: ['Filing submitted or accepted', 'First commercial transaction', 'First production deployment', 'Public launch', 'Merger or reorganization'],
      },
      {
        heading: 'Evidence and event-time confidence',
        paragraphs: ['The report accepts a source reference and attachment fingerprint, then classifies the time as a recorded instant, minute, hour, official date only, or estimate. It computes a possible time window and withholds time-sensitive house interpretation if the geometry is not stable across that window.'],
      },
      {
        heading: 'Jurisdiction and location are separate facts',
        paragraphs: ['The legal jurisdiction may differ from the place where an operational event occurred. The report records the registration authority, event location, and the policy used to choose that location. This prevents a headquarters, registered office, founder location, or payment location from being substituted without disclosure.'],
      },
      {
        heading: 'Organization language, not natal language',
        paragraphs: ['Corporate output uses organization-specific houses and significators under a named Jyotiṣa framework. It avoids claims about a company’s personality, fate, health, or lifespan. Rule provenance and practitioner review remain visible, and empirical support remains a separate field.'],
      },
    ],
    relatedReports: [{ href: '/knowledge/corporate', label: 'Create an evidence-bound corporate report' }],
  },
} as const satisfies Record<string, CelestialGuide>

export const CELESTIAL_GUIDE_LIST = Object.values(CELESTIAL_GUIDES)
