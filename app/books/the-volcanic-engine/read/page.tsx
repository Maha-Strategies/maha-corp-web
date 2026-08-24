import type { Metadata } from 'next'

import { OpenBookReadingIndex } from '@/components/OpenBookReader'
import { openBookEditions } from '@/lib/open-book-editions'

const book = openBookEditions['the-volcanic-engine']

export const metadata: Metadata = {
  title: `Read ${book.title} | Maha Strategies`,
  description: `Read ${book.title} by Mayone Maha Rajan, one section at a time.`,
  alternates: { canonical: `/books/${book.slug}/read` },
  openGraph: {
    type: 'book',
    url: `https://www.mahastrategies.com/books/${book.slug}/read`,
    title: `Read ${book.title}`,
    description: `A chapter-by-chapter open research edition of ${book.title}.`,
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: book.title }],
  },
}

export default function VolcanicEngineReadingIndex() {
  return <OpenBookReadingIndex book={book} />
}
