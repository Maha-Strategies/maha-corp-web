import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OpenBookSectionReader } from '@/components/OpenBookReader'
import { getOpenBookSection, openBookEditions } from '@/lib/open-book-editions'

const book = openBookEditions['the-synthetic-self']; type Props = { params: Promise<{ section: string }> }
export function generateStaticParams() { return book.sections.map((section) => ({ section: section.slug })) }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { section: slug } = await params; const found = getOpenBookSection(book, slug); return found ? { title: `${found.section.title} | ${book.title}`, description: `Read ${found.section.title} from ${book.title}.`, alternates: { canonical: `/books/${book.slug}/read/${found.section.slug}` } } : {} }
export default async function Page({ params }: Props) { const { section: slug } = await params; const found = getOpenBookSection(book, slug); if (!found) notFound(); return <OpenBookSectionReader book={book} section={found.section} markdown={found.markdown} /> }
