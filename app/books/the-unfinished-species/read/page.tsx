import type { Metadata } from 'next'
import { OpenBookReadingIndex } from '@/components/OpenBookReader'
import { unfinishedSpeciesSections } from '@/lib/unfinished-species'

const SITE_URL = 'https://www.mahastrategies.com'
const URL = `${SITE_URL}/books/the-unfinished-species/read`

export const metadata: Metadata = {
  title: 'Read The Unfinished Species | Maha Strategies',
  description: 'Read The Unfinished Species by Mayone Maha Rajan, one chapter at a time.',
  alternates: { canonical: '/books/the-unfinished-species/read' },
  openGraph: { type: 'book', url: URL, title: 'Read The Unfinished Species', description: 'A chapter-by-chapter open web edition of The Unfinished Species.', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Unfinished Species' }] },
}

export default function UnfinishedSpeciesReadingIndex() {
  return <OpenBookReadingIndex book={{
    slug: 'the-unfinished-species',
    title: 'The Unfinished Species',
    subtitle: 'How Intelligence Learned to Redesign Its Own Substrate',
    sections: unfinishedSpeciesSections,
  }} />
}
