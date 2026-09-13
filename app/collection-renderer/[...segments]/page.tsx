import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentHostSitemap } from '@/app/sitemap'
import { COLLECTION_ORIGIN, collectionLabel, collectionModel } from '@/lib/collection-hubs'
import { isCollectionHub } from '@/lib/collection-hub-paths'

type Props = { params: Promise<{ segments: string[] }> }
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = '/' + (await params).segments.join('/')
  if (!isCollectionHub(path)) return {}
  return { title: `${collectionLabel(path)} | Maha Strategies`, description: `Explore ${collectionLabel(path).toLowerCase()}, related topics, and published guides.`, alternates: { canonical: COLLECTION_ORIGIN + path } }
}
export default async function CollectionPage({ params }: Props) {
  const path = '/' + (await params).segments.join('/')
  if (!isCollectionHub(path)) notFound()
  const model = collectionModel(path, await currentHostSitemap())!
  const links = [...model.subcollections, ...model.articles]
  const structuredData = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: model.title, url: COLLECTION_ORIGIN + path, mainEntity: { '@type': 'ItemList', itemListElement: links.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: collectionLabel(p), url: COLLECTION_ORIGIN + p })) } }
  return <main className="evidence-page"><div className="evidence-container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll('<', '\\u003c') }} />
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-3 text-sm">{model.ancestors.map(p => <Link key={p} href={p} prefetch={false} className="evidence-link">{collectionLabel(p)}</Link>)}<span aria-current="page">{model.title}</span></nav>
    <header><p className="evidence-kicker">Browse the collection</p><h1 className="evidence-title">{model.title}</h1>
      <p className="evidence-lede mt-5">Explore {model.articleCount} published pages about {model.title.toLowerCase()}. Choose a topic below, then follow its sources, explanations, and applications.</p>
      <p className="evidence-copy mt-4">Each article describes its own sources and limits. This page organizes the collection for reading.</p>
    </header>
    {model.subcollections.length > 0 && <section className="evidence-section"><h2 className="evidence-section-title">Topics in this collection</h2><ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{model.subcollections.map(p => <li key={p}><Link href={p} prefetch={false} className="evidence-card block break-words">{collectionLabel(p)}</Link></li>)}</ul></section>}
    {model.articles.length > 0 && <section className="evidence-section"><h2 className="evidence-section-title">Articles and guides</h2><ul className="mt-6 grid gap-4 sm:grid-cols-2">{model.articles.map(p => <li key={p}><Link href={p} prefetch={false} className="evidence-card block break-words">{collectionLabel(p)}<span className="mt-2 block text-sm text-[var(--text-secondary)]">{p.slice(path.length + 1).split('/').slice(0, -1).map(s => collectionLabel('/' + s)).join(' · ')}</span></Link></li>)}</ul></section>}
    {!model.articleCount && <p className="evidence-copy my-8">There are currently no published articles in this collection.</p>}
    <nav aria-label="More collections" className="evidence-section"><Link href="/directory" prefetch={false} className="evidence-link">Browse all collections and properties →</Link></nav>
  </div></main>
}
