import type { Metadata } from 'next'
import Link from 'next/link'
import { directoryLabel, SITE_DIRECTORY_PATH, siteDirectoryNavigationRoutes, siteDirectoryProperties } from '@/lib/site-directory'
import { currentHostSitemap } from '@/app/sitemap'
import { COLLECTION_HUB_PATHS } from '@/lib/collection-hub-paths'
import { collectionLabel } from '@/lib/collection-hubs'

export const metadata: Metadata = {
  title: 'Site Directory | Maha Strategies',
  description: 'Browse published pages and topic collections across the Maha federation.',
  alternates: { canonical: SITE_DIRECTORY_PATH },
}

export default async function SiteDirectoryPage() {
  const currentRows = await currentHostSitemap()
  const properties = siteDirectoryProperties().map(property => property.canonicalHost === 'www.mahastrategies.com'
    ? { ...property, urls: currentRows.map(row => row.url).sort() } : property)
  const navigationRoutes = siteDirectoryNavigationRoutes()
  return <main className="evidence-page"><div className="evidence-container">
    <header className="max-w-4xl border-t border-[var(--border-default)] pt-5">
      <p className="evidence-kicker">Federation directory · 7 properties</p>
      <h1 className="evidence-title">Explore Maha’s topics, articles, and tools.</h1>
      <p className="evidence-lede mt-6">Browse by collection or property. Maha Strategies listings follow the current publication sitemap; partner properties use their federation inventories.</p>
    </header>
    <nav className="evidence-section" aria-label="Property directory">
      <h2 className="evidence-section-title">Properties</h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{properties.map((property) => <li key={property.canonicalHost}><a href={`#${property.siteId}`} className="evidence-card block"><strong>{property.canonicalHost}</strong><span className="mt-2 block text-sm text-[var(--text-secondary)]">{property.urls.length} routes</span></a></li>)}</ul>
    </nav>
    <section className="evidence-section"><p className="evidence-kicker">Navigation layer</p><h2 className="evidence-section-title mt-3">Hubs connecting the corpus</h2><ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{navigationRoutes.map((path) => <li key={path}><Link href={path} prefetch={false} className="evidence-card block">{directoryLabel(`https://www.mahastrategies.com${path}`)}</Link></li>)}</ul></section>
    <section className="evidence-section"><h2 className="evidence-section-title">Topic collections</h2><ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{COLLECTION_HUB_PATHS.map(path => <li key={path}><Link href={path} prefetch={false} className="evidence-link">{collectionLabel(path)}</Link></li>)}</ul></section>
    {properties.map((property) => <section id={property.siteId} key={property.canonicalHost} className="evidence-section scroll-mt-24">
      <p className="evidence-kicker">{property.siteId.replaceAll('-', ' ')}</p>
      <h2 className="evidence-section-title mt-3">{property.canonicalHost}</h2>
      <p className="evidence-copy mt-3">{property.urls.length} canonical routes</p>
      <ul className="mt-7 columns-1 gap-x-8 text-sm sm:columns-2 lg:columns-3">{property.urls.map((url) => <li key={url} className="mb-3 break-inside-avoid"><Link href={url} prefetch={false} className="evidence-link">{directoryLabel(url)}</Link></li>)}</ul>
    </section>)}
  </div></main>
}
