import type { Metadata } from 'next'
import Link from 'next/link'
import { unfinishedSpeciesSections } from '@/lib/unfinished-species'
import { ATLAS_PATH } from '@/lib/unfinished-atlas'
import { Icon } from '../Visuals'
import s from '../atlas.module.css'
export const metadata: Metadata = { title: 'The book', alternates:{canonical:ATLAS_PATH + '/book'} }
export default function BookPage() {
  return <><p className={s.eyebrow}>THE BOOK THAT STARTED THE QUESTION</p><h1 className={s.pageTitle}>The Unfinished Species</h1><p className={s.lede}>How Intelligence Learned to Redesign Its Own Substrate<br />By Mayone Maha Rajan</p><div className={s.actions}><Link className={s.primary} href={ATLAS_PATH + '/book/introduction'}>Begin reading <Icon name="arrow" size={16} /></Link><Link className={s.secondary} href={ATLAS_PATH + '/companion'}>Explore with the companion</Link></div><div className={s.sectionHeader}><h2>From selection to self-design</h2><p>Introduction · 11 chapters · Method &amp; sources</p></div>{unfinishedSpeciesSections.map((section, index) => <Link className={s.chapter} key={section.slug} href={ATLAS_PATH + '/book/' + section.slug}><span><span className={s.eyebrow}>{index === 0 ? 'BEGIN HERE' : index === 12 ? 'BACK MATTER' : 'CHAPTER ' + String(index).padStart(2, '0')}</span><br />{section.title}<small>{section.description}</small></span><Icon name="arrow" /></Link>)}<p className={s.bottomNote}>The reader and companion use the same canonical manuscript as the existing open edition. The author’s interpretation is distinguished from independently supported scientific findings in the Atlas.</p></>
}
