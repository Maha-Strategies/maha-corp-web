export const MAHA_SITE_URL = 'https://www.mahastrategies.com'
export const MAHA_ORGANIZATION_ID = `${MAHA_SITE_URL}/#organization`
export const MAYONE_MAHA_RAJAN_ID = `${MAHA_SITE_URL}/about#mayone-maha-rajan`

/**
 * The canonical descriptive sentence for the organization. Reused verbatim in
 * visible copy and in structured data so that the two never diverge.
 */
export const MAHA_DESCRIPTOR =
  'Maha Strategies LLC is an independent research, publishing, and technology-architecture organization.'

export const MAHA_DESCRIPTION =
  'Independent research, publishing, and technology-architecture organization.'

/**
 * The single Organization node for Maha Strategies LLC.
 *
 * Every page that needs to name a publisher must reference this by
 * `{ '@id': MAHA_ORGANIZATION_ID }` rather than inlining another Organization
 * object. An inline `{ '@type': 'Organization', name: 'Maha Strategies' }` with
 * no @id is an anonymous second entity to a parser, and competes with this one
 * instead of reinforcing it.
 *
 * `sameAs` is reserved for external profiles of THIS organization. Owned
 * projects on other domains (research., publish., mayonrajan.com,
 * themahaprinciple.com) are distinct works with different purposes; they are
 * related through publisher/isPartOf/about, never through sameAs.
 */
export const mahaOrganizationJsonLd = {
  '@type': 'Organization',
  '@id': MAHA_ORGANIZATION_ID,
  name: 'Maha Strategies LLC',
  alternateName: 'Maha Strategies',
  legalName: 'Maha Strategies LLC',
  url: MAHA_SITE_URL,
  logo: `${MAHA_SITE_URL}/icon.png`,
  image: `${MAHA_SITE_URL}/og-master.png`,
  description: MAHA_DESCRIPTION,
  email: 'mayone@mahastrategies.com',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${MAHA_SITE_URL}/contact`,
    email: 'mayone@mahastrategies.com',
    availableLanguage: 'English',
  },
  founder: { '@id': MAYONE_MAHA_RAJAN_ID },
  // Verified organization-level profile. Personal profiles belong on the
  // Person node below, not here.
  sameAs: ['https://github.com/Maha-Strategies'],
  // Only subjects with visible supporting content on this site.
  knowsAbout: [
    'Evidence and provenance systems',
    'AI-assisted publishing infrastructure',
    'Semiconductor and supply-chain decision research',
    'On-device artificial intelligence',
    'Educational technology',
  ],
}

export const mayoneMahaRajanJsonLd = {
  '@type': 'Person',
  '@id': MAYONE_MAHA_RAJAN_ID,
  name: 'Mayone Maha Rajan',
  url: 'https://www.mayonemaharajan.com',
  jobTitle: 'Founder and Managing Director',
  worksFor: { '@id': MAHA_ORGANIZATION_ID },
  sameAs: [
    'https://www.mayonemaharajan.com',
    'https://github.com/mayonerajan',
    'https://www.linkedin.com/in/mayonrajan/',
  ],
  knowsAbout: [
    'Systemic sovereignty',
    'Maha Provenance Standard',
    'Semiconductor supply chains',
    'On-device artificial intelligence',
    'Cognitive liberty',
  ],
}

export const mahaEntityGraphJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [mahaOrganizationJsonLd, mayoneMahaRajanJsonLd],
}

/**
 * Related public projects operated or published by Maha Strategies LLC.
 *
 * These are DISTINCT works on their own domains, each with its own purpose and
 * editorial boundary. The relationship is expressed with publisher/author and
 * an explicit description of scope — never with sameAs, which would assert that
 * they are alternate identities of the organization itself.
 *
 * Used on pages that visibly present the network, so the markup describes what
 * the reader can actually see on the page.
 */
export const mahaRelatedProjectsJsonLd = [
  {
    '@type': 'WebSite',
    '@id': 'https://research.mahastrategies.com/#website',
    name: 'Maha Strategies Research',
    url: 'https://research.mahastrategies.com',
    description:
      'Open research syntheses, working papers, and preprints with stated verification status. Not peer reviewed unless individually stated.',
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    inLanguage: 'en',
  },
  {
    '@type': 'SoftwareApplication',
    '@id': 'https://publish.mahastrategies.com/#application',
    name: 'Agentic Book Publishing',
    url: 'https://publish.mahastrategies.com',
    applicationCategory: 'BusinessApplication',
    description: 'Source-aware publishing workflow tools and author query preparation.',
    publisher: { '@id': MAHA_ORGANIZATION_ID },
  },
  {
    '@type': 'WebApplication',
    '@id': 'https://mayonrajan.com/#application',
    name: 'Mayon Rajan',
    url: 'https://mayonrajan.com',
    applicationCategory: 'EducationalApplication',
    description:
      'A free, true-scale educational visualization of Mayon Volcano with a public methods record and claim-level source registry.',
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    isAccessibleForFree: true,
  },
  {
    '@type': 'Book',
    '@id': 'https://themahaprinciple.com/#book',
    name: 'The Maha Principle: The Architecture of Human Flourishing',
    url: 'https://themahaprinciple.com',
    description: 'A book-led research program with public framework and application references.',
    author: { '@id': MAYONE_MAHA_RAJAN_ID },
  },
]
