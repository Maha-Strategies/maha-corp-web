export const MAHA_SITE_URL = 'https://www.mahastrategies.com'
export const MAHA_ORGANIZATION_ID = `${MAHA_SITE_URL}/#organization`
export const MAYONE_MAHA_RAJAN_ID = `${MAHA_SITE_URL}/about#mayone-maha-rajan`

export const mahaOrganizationJsonLd = {
  '@type': 'Organization',
  '@id': MAHA_ORGANIZATION_ID,
  name: 'Maha Strategies LLC',
  legalName: 'Maha Strategies LLC',
  url: MAHA_SITE_URL,
  logo: `${MAHA_SITE_URL}/icon.png`,
  image: `${MAHA_SITE_URL}/og-master.png`,
  description: 'Independent think tank and advisory firm researching systemic sovereignty across semiconductor supply chains, on-device AI, and human attention.',
  email: 'mayone@mahastrategies.com',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${MAHA_SITE_URL}/contact`,
    email: 'mayone@mahastrategies.com',
    availableLanguage: 'English',
  },
  founder: { '@id': MAYONE_MAHA_RAJAN_ID },
  knowsAbout: [
    'Maha Provenance Standard',
    'Semiconductor supply chains',
    'On-device artificial intelligence',
    'Cognitive liberty',
    'Evidence-led research',
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
