import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ATLAS_PATH, ATLAS_DATE, atlasTopics, atlasSources, findTopic } from '@/lib/unfinished-atlas'
import { Badge } from '../../AtlasExplorer'
import { SaveButton } from '../../Collection'
import { Icon } from '../../Visuals'
import s from '../../atlas.module.css'
type Props = { params: Promise<{ slug: string }> }
export function generateStaticParams() { return atlasTopics.map(topic => ({ slug: topic.slug })) }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = findTopic((await params).slug)
  if (!topic) notFound()
  return { title: topic.subtitle, description: topic.summary, alternates: { canonical: ATLAS_PATH + '/topics/' + topic.slug } }
}
export default async function TopicPage({ params }: Props) {
  const topic = findTopic((await params).slug)
  if (!topic) notFound()
  return <>
    <Link href={ATLAS_PATH} className={s.back}><Icon name="back" size={15} />Back to the Atlas</Link>
    <header className={s.detailHeader}><p className={s.eyebrow}>{topic.category} / {topic.subtitle}</p><h1 className={s.pageTitle}>{topic.title}</h1><p className={s.lede}>{topic.summary}</p><div className={s.actions}><Badge register={topic.register} /><span className={s.eyebrow}>{topic.horizon}</span><SaveButton slug={topic.slug} expanded /></div></header>
    <div className={s.detailGrid}><div>
      {(['Established', 'Inferred', 'Speculative'] as const).map(register => <section className={s.panel} key={register}><Badge register={register} /><h2>{register === 'Established' ? 'What the evidence shows' : register === 'Inferred' ? 'What we can reasonably infer' : 'What remains a possibility'}</h2><p>{topic[register.toLowerCase() as 'established' | 'inferred' | 'speculative']}</p></section>)}
      <section className={`${s.panel} ${s.boundary}`}><p className={s.eyebrow}>THE BOUNDARY</p><h2>Where the claim stops</h2><p>{topic.boundary}</p></section>
      <section className={s.panel}><p className={s.eyebrow}>THE NEXT USEFUL SIGNAL</p><h2>What to watch for</h2><p>{topic.next}</p><p className={s.bottomNote}>The horizon is an editorial scenario for this brief’s central possibility. It does not predict a treatment date or an investment return.</p></section>
    </div><aside>
      <section className={s.panel}><p className={s.eyebrow}>GO DEEPER</p><h3>Inside the book</h3><Link className={s.asideLink} href={ATLAS_PATH + '/book/' + topic.chapter}>{topic.chapterTitle} ↗</Link><Link className={s.asideLink} href={ATLAS_PATH + '/companion?topic=' + topic.slug}>Explore this with the companion ↗</Link></section>
      <section className={s.panel}><p className={s.eyebrow}>SOURCES &amp; PROVENANCE</p>{topic.sources.map(id => { const source = atlasSources[id]; return <a key={id} href={source.url} target="_blank" rel="noreferrer" className={s.source}>{source.title} ↗<small>{source.publisher}<br />{source.kind}</small></a> })}<p className={s.bottomNote}>Editorial source check: {ATLAS_DATE}. The book provides the framing; original sources support the scientific claims. No independent expert review is claimed.</p></section>
    </aside></div>
  </>
}
