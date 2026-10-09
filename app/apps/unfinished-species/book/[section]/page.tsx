import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BookManuscript from '@/components/BookManuscript'
import { getUnfinishedSpeciesSection, unfinishedSpeciesSections } from '@/lib/unfinished-species'
import { ATLAS_PATH } from '@/lib/unfinished-atlas'
import s from '../../atlas.module.css'
type Props = { params: Promise<{ section: string }> }
export function generateStaticParams() { return unfinishedSpeciesSections.map(section => ({ section:section.slug })) }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = getUnfinishedSpeciesSection((await params).section)
  if (!found) notFound()
  return { title:found.section.title, description:found.section.description, alternates:{canonical:'/books/the-unfinished-species/read/' + found.section.slug} }
}
export default async function ReaderPage({ params }: Props) {
  const found = getUnfinishedSpeciesSection((await params).section)
  if (!found) notFound()
  const index = unfinishedSpeciesSections.findIndex(section => section.slug === found.section.slug)
  const previous = unfinishedSpeciesSections[index - 1], next = unfinishedSpeciesSections[index + 1]
  return <article className={s.reader}><Link className={s.back} href={ATLAS_PATH + '/book'}>← All chapters</Link><header className={s.detailHeader}><p className={s.eyebrow}>THE UNFINISHED SPECIES / {found.section.articleSection}</p><h1 className={s.pageTitle}>{found.section.title}</h1><p className={s.lede}>{found.section.description}</p></header><BookManuscript markdown={found.markdown.replace(/^#{1,2}[^\n]*\n/, '')} demoteH1 /><nav className={s.readerNav} aria-label="Chapter navigation">{previous && <Link href={ATLAS_PATH + '/book/' + previous.slug}>← {previous.title}</Link>}{next && <Link href={ATLAS_PATH + '/book/' + next.slug}>{next.title} →</Link>}</nav><div className={s.actions}><Link href={ATLAS_PATH + '/companion'} className={s.secondary}>Discuss the book with the companion</Link></div></article>
}
