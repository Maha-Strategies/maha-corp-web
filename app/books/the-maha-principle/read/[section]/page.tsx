import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { OpenBookSectionReader } from '@/components/OpenBookReader'
import { getOpenBookSection, openBookEditions } from '@/lib/open-book-editions'

const book = openBookEditions['the-maha-principle']
type PageProps = { params: Promise<{ section: string }> }

export function generateStaticParams() {
  return book.sections.map((section) => ({ section: section.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section: slug } = await params
  const found = getOpenBookSection(book, slug)
  if (!found) return {}
  return {
    title: `${found.section.title} | ${book.title}`,
    description: `Read ${found.section.title} from the complete web edition of ${book.title}.`,
    alternates: { canonical: `/books/${book.slug}/read/${found.section.slug}` },
    openGraph: {
      type: 'article',
      url: `https://www.mahastrategies.com/books/${book.slug}/read/${found.section.slug}`,
      title: found.section.title,
      description: `A section of ${book.title}: ${book.subtitle}.`,
      images: [{ url: '/books/the-maha-principle/cover.jpg', width: 1632, height: 2624, alt: found.section.title }],
    },
  }
}

export default async function TheMahaPrincipleSectionPage({ params }: PageProps) {
  const { section: slug } = await params
  const found = getOpenBookSection(book, slug)
  if (!found) notFound()
  return <OpenBookSectionReader book={book} section={found.section} markdown={found.markdown} />
}
