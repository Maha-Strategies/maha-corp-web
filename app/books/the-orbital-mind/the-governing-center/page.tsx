import type { Metadata } from 'next'
import MarkdownChapter from '@/components/MarkdownChapter'

const URL = 'https://www.mahastrategies.com/books/the-orbital-mind/the-governing-center'

export const metadata: Metadata = {
  title: 'The Governing Center | The Orbital Mind',
  description: 'Chapter 1 of The Orbital Mind: the function of self-regulation and the holding of a center.',
  alternates: { canonical: '/books/the-orbital-mind/the-governing-center' },
  openGraph: { type: 'article', url: URL, title: 'The Governing Center', description: 'Chapter 1 of The Orbital Mind: the function of self-regulation and the holding of a center.', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Governing Center' }] },
}

export default function GoverningCenterPage() {
  return <MarkdownChapter bookId="https://www.mahastrategies.com/books/the-orbital-mind#book" bookTitle="The Orbital Mind" bookHref="/books/the-orbital-mind" chapterTitle="The Governing Center" chapterDescription="The function of self-regulation and the holding of a center." chapterUrl={URL} sourcePath="books/the-orbital-mind/chapter-1.md" />
}
