import { MAHA_SITE_URL, MAYONE_MAHA_RAJAN_ID } from './entity.ts'

export const BOOK_PUBLICATIONS_DATE = '2026-10-11'
export const BOOK_PUBLICATIONS_PATH = '/books/publications'
export const BOOK_PUBLICATIONS_JSON_PATH = '/books/publications.json'
export const BOOK_PUBLICATIONS_SCHEMA_PATH = '/schemas/book-publications-1.0.json'

export interface RetailEdition {
  id: string
  platform: 'Amazon' | 'Draft2Digital'
  format: 'ebook' | 'paperback'
  status: 'live' | 'published' | 'publishing' | 'in_review' | 'preparing_manuscript'
  statusLabel: string
  statusBasis: 'publisher_dashboard'
  statusAsOf: string
  isbn?: string
  asin?: string
  url?: string
  imprint?: string
}

export interface BookPublication {
  slug: string
  workId: string
  title: string
  subtitle: string
  author: string
  language: string
  description: string
  subjects: string[]
  evidenceBoundary: string
  informationUrl: string
  editions: RetailEdition[]
  relatedResources: { title: string; url: string; relationship: string }[]
  openWebEdition?: { url: string; firstPublished: string }
}

const edition = (data: Omit<RetailEdition, 'statusAsOf' | 'statusBasis'>): RetailEdition => ({
  ...data, statusAsOf: BOOK_PUBLICATIONS_DATE, statusBasis: 'publisher_dashboard',
})

/** Public facts only. Dashboard status is distinct from verified retail stock.
 * Update the dated records when publishers confirm a change; never infer live
 * availability from an accepted submission or an ISBN assignment.
 */
export const BOOK_PUBLICATIONS: BookPublication[] = [
  {
    slug: 'the-maha-principle', workId: 'https://themahaprinciple.com/#book',
    title: 'The Maha Principle', subtitle: 'The Architecture of Human Flourishing',
    author: 'Mayone Maha Rajan', language: 'en',
    description: 'A framework for human flourishing built around Mindfulness, Authenticity, Health, and Action. The book moves from diagnosis through doctrine to application, connecting individual practice with family, community, and institutional life. It includes practical exercises and a seven-day challenge.',
    subjects: ['Human flourishing', 'Mindfulness', 'Authenticity', 'Health', 'Action', 'Public policy'],
    evidenceBoundary: 'A philosophical and practical framework. Cross-scale analogies are conceptual, not a scientifically established causal chain. Health discussions are educational and do not replace medical care.',
    informationUrl: `${MAHA_SITE_URL}${BOOK_PUBLICATIONS_PATH}#the-maha-principle`,
    editions: [
      edition({ id: 'amazon-kindle', platform: 'Amazon', format: 'ebook', status: 'live', statusLabel: 'Live on KDP', asin: 'B0H62WLMT5', url: 'https://www.amazon.com/dp/B0H62WLMT5' }),
      edition({ id: 'amazon-paperback', platform: 'Amazon', format: 'paperback', status: 'live', statusLabel: 'Live on KDP; latest file update submitted for review', isbn: '9798160702506', asin: 'B0HM7BN2MN', url: 'https://www.amazon.com/dp/B0HM7BN2MN', imprint: 'Independently published' }),
      edition({ id: 'd2d-ebook', platform: 'Draft2Digital', format: 'ebook', status: 'publishing', statusLabel: 'Publishing to selected retailers' }),
      edition({ id: 'd2d-paperback', platform: 'Draft2Digital', format: 'paperback', status: 'published', statusLabel: 'Published on Draft2Digital; individual retailer availability varies' }),
    ],
    relatedResources: [
      { title: 'The Maha Principle framework', url: 'https://themahaprinciple.com', relationship: 'Public companion framework' },
      { title: 'Reader FAQ', url: `${MAHA_SITE_URL}/books/the-maha-principle/reader-faq`, relationship: 'Introduction to the book' },
      { title: 'Paying for Nutrition', url: 'https://doi.org/10.5281/zenodo.23212453', relationship: 'Related policy working paper; not peer reviewed and not empirical validation of the book' },
    ],
  },
  {
    slug: 'the-orbital-mind', workId: `${MAHA_SITE_URL}/books/the-orbital-mind#book`,
    title: 'The Orbital Mind', subtitle: 'The Astrophysics of the Self',
    author: 'Mayone Maha Rajan', language: 'en',
    description: 'A systems psychology of attention, desire, agency, structure, imagination, grief, and purpose. Five parts explore the conditions of coherence, the functions of a living self, openness and transformation, and the collisions of ordinary life. The final part develops a formal model, a cross-scale conjecture, and testable predictions.',
    subjects: ['Systems psychology', 'Attention', 'Agency', 'Self-regulation', 'Imagination', 'Integration'],
    evidenceBoundary: 'Planetary imagery is a symbolic language for reflection, not evidence of planetary influence or destiny. Empirical support, philosophical interpretation, analogy, and formal conjecture are distinguished.',
    informationUrl: `${MAHA_SITE_URL}/books/the-orbital-mind`,
    openWebEdition: { url: `${MAHA_SITE_URL}/books/the-orbital-mind`, firstPublished: '2026-07-16' },
    editions: [
      edition({ id: 'amazon-kindle', platform: 'Amazon', format: 'ebook', status: 'live', statusLabel: 'Live on KDP', asin: 'B0HMKDMCM9', url: 'https://www.amazon.com/dp/B0HMKDMCM9' }),
      edition({ id: 'amazon-paperback', platform: 'Amazon', format: 'paperback', status: 'live', statusLabel: 'Live on KDP', isbn: '9798161302286', asin: 'B0HMKHJNYK', url: 'https://www.amazon.com/dp/B0HMKHJNYK' }),
      edition({ id: 'd2d-ebook', platform: 'Draft2Digital', format: 'ebook', status: 'publishing', statusLabel: 'Publishing to selected retailers' }),
      edition({ id: 'd2d-paperback', platform: 'Draft2Digital', format: 'paperback', status: 'preparing_manuscript', statusLabel: 'Submitted; manuscript processing underway' }),
    ],
    relatedResources: [{ title: 'What Is Executive Function?', url: `${MAHA_SITE_URL}/books/the-orbital-mind/what-is-executive-function`, relationship: 'Companion reader guide' }],
  },
  {
    slug: 'the-imagined-life', workId: `${MAHA_SITE_URL}/books/the-imagined-life#book`,
    title: 'The Imagined Life', subtitle: 'Living Inside a Dreaming Brain',
    author: 'Mayone Maha Rajan', language: 'en',
    description: 'An exploration of sleep, dreaming, and imagination as the faculty of the possible. The book begins with the architecture of sleep and dreaming, examines the uncertain relationship between brains and generative machines, and considers how deliberate imaginative practice can inform everyday choices.',
    subjects: ['Dreaming', 'Sleep', 'Imagination', 'Cognitive science', 'Generative artificial intelligence'],
    evidenceBoundary: 'Research findings are separated from interpretation and exploratory comparisons. The companion narrative study is a working paper, not peer-reviewed evidence that machines dream or that narrative similarity establishes shared mechanisms.',
    informationUrl: `${MAHA_SITE_URL}/books/the-imagined-life`,
    openWebEdition: { url: `${MAHA_SITE_URL}/books/the-imagined-life`, firstPublished: '2026-07-16' },
    editions: [
      edition({ id: 'amazon-kindle', platform: 'Amazon', format: 'ebook', status: 'live', statusLabel: 'Live on KDP', asin: 'B0HM86JBG7', url: 'https://www.amazon.com/dp/B0HM86JBG7' }),
      edition({ id: 'amazon-paperback', platform: 'Amazon', format: 'paperback', status: 'in_review', statusLabel: 'Submitted on 11 October 2026; awaiting KDP review', isbn: '9798161585818', imprint: 'Independently published' }),
      edition({ id: 'd2d-ebook', platform: 'Draft2Digital', format: 'ebook', status: 'published', statusLabel: 'Published on Draft2Digital; individual retailer availability varies', isbn: '9798235084476', url: 'https://books2read.com/u/bpBlzE' }),
      edition({ id: 'd2d-paperback', platform: 'Draft2Digital', format: 'paperback', status: 'preparing_manuscript', statusLabel: 'Submitted on 11 October 2026; manuscript processing and ISBN assignment pending' }),
    ],
    relatedResources: [
      { title: 'The Geometry of Narrative Reports', url: 'https://doi.org/10.5281/zenodo.23209938', relationship: 'Companion exploratory working paper; not peer reviewed' },
      { title: 'The Dream Engine on Android', url: 'https://play.google.com/store/apps/details?id=com.theimaginedlife.engine', relationship: 'Companion app' },
      { title: 'The Dream Engine on iOS', url: 'https://apps.apple.com/app/the-dream-engine/id6793837872', relationship: 'Companion app' },
    ],
  },
]

export function buildBookPublications() {
  return {
    $schema: `${MAHA_SITE_URL}${BOOK_PUBLICATIONS_SCHEMA_PATH}`,
    catalogVersion: '1.0.0', asOf: BOOK_PUBLICATIONS_DATE,
    url: `${MAHA_SITE_URL}${BOOK_PUBLICATIONS_JSON_PATH}`,
    humanReadableUrl: `${MAHA_SITE_URL}${BOOK_PUBLICATIONS_PATH}`,
    publicationBoundary: 'Author-maintained publication metadata based on publisher-dashboard observations as of the stated date. Published or live dashboard status does not guarantee stock, delivery, or availability in every country. Submitted editions are not described as live.',
    rightsBoundary: 'Retail editions are all rights reserved. Public web editions and separately licensed working papers are distinct resources; this catalog grants no license to reproduce a retail manuscript.',
    books: BOOK_PUBLICATIONS,
  }
}

export function bookPublicationJsonLd(book: BookPublication) {
  const editions = book.editions.map((entry) => ({
    '@type': 'Book', '@id': `${book.workId}-${entry.id}`,
    name: `${book.title}: ${book.subtitle}`, author: { '@id': MAYONE_MAHA_RAJAN_ID },
    inLanguage: book.language, bookFormat: `https://schema.org/${entry.format === 'ebook' ? 'EBook' : 'Paperback'}`,
    exampleOfWork: { '@id': book.workId }, isAccessibleForFree: false,
    creativeWorkStatus: entry.statusLabel,
    ...(entry.isbn ? { isbn: entry.isbn } : {}),
    ...(entry.asin ? { identifier: { '@type': 'PropertyValue', propertyID: 'ASIN', value: entry.asin } } : {}),
    ...(entry.url ? { url: entry.url } : {}),
  }))
  const openEdition = book.openWebEdition ? [{
    '@type': 'Book', '@id': `${book.workId}-open-web`,
    name: `${book.title}: ${book.subtitle} (open web edition)`,
    author: { '@id': MAYONE_MAHA_RAJAN_ID }, inLanguage: book.language,
    exampleOfWork: { '@id': book.workId }, url: book.openWebEdition.url,
    isAccessibleForFree: true, bookFormat: 'https://schema.org/EBook',
    datePublished: book.openWebEdition.firstPublished,
    potentialAction: { '@type': 'ReadAction', target: book.openWebEdition.url },
  }] : []
  return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'Book', '@id': book.workId, name: book.title,
      alternativeHeadline: book.subtitle, description: book.description,
      url: book.informationUrl, author: { '@id': MAYONE_MAHA_RAJAN_ID },
      inLanguage: book.language, about: book.subjects,
      workExample: [...editions, ...openEdition].map((entry) => ({ '@id': entry['@id'] })),
      subjectOf: book.relatedResources.map((resource) => ({ '@type': 'CreativeWork', name: resource.title, url: resource.url, description: resource.relationship })),
    }, ...editions, ...openEdition],
  }
}

export function bookPublicationLlmsLines() {
  return [
    '## Published books and retailer editions',
    `- Publication catalog: ${MAHA_SITE_URL}${BOOK_PUBLICATIONS_JSON_PATH}`,
    `- Reader-facing publication details: ${MAHA_SITE_URL}${BOOK_PUBLICATIONS_PATH}`,
    `- Catalog schema: ${MAHA_SITE_URL}${BOOK_PUBLICATIONS_SCHEMA_PATH}`,
    `- Status observations as of ${BOOK_PUBLICATIONS_DATE}; submissions and processing are not live retail availability. Retail manuscripts remain all rights reserved; open web editions are separate.`,
    ...BOOK_PUBLICATIONS.flatMap((book) => [
      `- ${book.title}: ${book.subtitle}, by ${book.author}. ${book.description} Information: ${book.informationUrl}`,
      ...book.editions.map((entry) => `  - ${entry.platform} ${entry.format}: ${entry.statusLabel}${entry.isbn ? `; ISBN ${entry.isbn}` : ''}${entry.asin ? `; ASIN ${entry.asin}` : ''}${entry.url ? `; ${entry.url}` : ''}.`),
      `  - Scope: ${book.evidenceBoundary}`,
      ...book.relatedResources.map((resource) => `  - ${resource.title}: ${resource.url} (${resource.relationship}).`),
    ]), '',
  ]
}
