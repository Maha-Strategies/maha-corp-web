import type { Metadata } from 'next'
import MarkdownChapter from '@/components/MarkdownChapter'

const URL = 'https://www.mahastrategies.com/books/the-imagined-life/what-happens-when-you-sleep'

export const metadata: Metadata = {
  title: 'What Happens When You Sleep | The Imagined Life',
  description: 'Chapter 1 of The Imagined Life: the measurable architecture of sleep and the dreaming brain.',
  alternates: { canonical: '/books/the-imagined-life/what-happens-when-you-sleep' },
  openGraph: { type: 'article', url: URL, title: 'What Happens When You Sleep', description: 'Chapter 1 of The Imagined Life: the measurable architecture of sleep and the dreaming brain.', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'What Happens When You Sleep' }] },
}

export default function WhatHappensWhenYouSleepPage() {
  return <MarkdownChapter bookId="https://www.mahastrategies.com/books/the-imagined-life#book" bookTitle="The Imagined Life" bookHref="/books/the-imagined-life" chapterTitle="What Happens When You Sleep" chapterDescription="The measurable architecture of sleep and the dreaming brain." chapterUrl={URL} sourcePath="books/the-imagined-life/chapter-1.md" />
}
