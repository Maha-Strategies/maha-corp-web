import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MAHA_SITE_URL } from '@/lib/entity'
import {
  EPISTEMIC_DOMAINS,
  EPISTEMIC_RELEASE_DATE,
  EPISTEMIC_SYSTEM_PATH,
  buildDomainRegistry,
  getDomainRecords,
  getEpistemicDomain,
} from '@/lib/epistemic-pilots'
import { epistemicRecordPath } from '@/lib/epistemic-publication'
import { getPublicEpistemicDomainRecords } from '@/lib/public-epistemic-releases'

type PageProps = { params: Promise<{ kind: string }> }

export const dynamicParams = false
export function generateStaticParams() { return EPISTEMIC_DOMAINS.map((domain) => ({ kind: domain.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const domain = getEpistemicDomain((await params).kind)
  if (!domain) return {}
  const path = `/knowledge/${domain.slug}`
  return {
    metadataBase: new URL(MAHA_SITE_URL),
    title: `${domain.name} | Maha Knowledge`,
    description: domain.description,
    alternates: { canonical: path },
    openGraph: { type: 'website', title: domain.name, description: domain.description, url: `${MAHA_SITE_URL}${path}`, siteName: 'Maha Strategies', images: [] },
    twitter: { card: 'summary', title: domain.name, description: domain.description, images: [] },
  }
}

export default async function EpistemicDomainPage({ params }: PageProps) {
  const domain = getEpistemicDomain((await params).kind)
  if (!domain) notFound()
  const graphRecords = getDomainRecords(domain.slug)
  const publicRecords = await getPublicEpistemicDomainRecords(domain.slug)
  const graphEdges = graphRecords.reduce((count, record) => count + record.bridges.length, 0)
  const registry = buildDomainRegistry(domain.slug, publicRecords)
  const lifecycle = registry?.lifecycle
  const activeStructuredDomain = lifecycle?.status === 'active-structured-domain'
  const path = `/knowledge/${domain.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: domain.name,
    description: domain.description,
    url: `${MAHA_SITE_URL}${path}`,
    dateModified: EPISTEMIC_RELEASE_DATE,
    hasPart: publicRecords.map((record) => ({ '@type': 'TechArticle', name: record.title, url: `${MAHA_SITE_URL}${epistemicRecordPath(record)}` })),
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <nav aria-label="Breadcrumb" className="evidence-kicker"><Link href="/knowledge" className="evidence-link">Knowledge</Link><span className="px-2">/</span><span>{domain.name}</span></nav>
        <header className="mt-10 max-w-5xl">
          <p className={`evidence-kicker ${activeStructuredDomain ? 'text-[var(--status-verified)]' : 'text-[var(--status-sourced)]'}`}>
            {activeStructuredDomain ? 'Active structured domain · foundational corpus' : 'Governed candidate corpus · review pending'}
          </p>
          <h1 className="evidence-title">{domain.name}</h1>
          <p className="evidence-lede mt-7">{domain.description}</p>
          <div className="evidence-status-surface evidence-status-surface--boundary mt-8"><p className="evidence-status-label">Primary stress point</p><p className="evidence-copy mt-2">{domain.stressPoint}</p></div>
          <div className={`mt-4 evidence-status-surface ${activeStructuredDomain ? 'evidence-status-surface--verified' : 'evidence-status-surface--boundary'}`}>
            <p className="evidence-status-label">Canonical factory depth</p>
            <p className="evidence-copy mt-2">{lifecycle?.canonicalFactoryRecords ?? 0} of {lifecycle?.foundationalTarget ?? 0} governed factory records are active canonical releases. {activeStructuredDomain ? 'The foundational graph is fully public; higher-order hypotheses remain separately gated.' : 'The candidate corpus remains below the public line until each record independently passes exact-hash review and release.'}</p>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="records-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="evidence-kicker">Canonical public layer</p><h2 id="records-heading" className="evidence-section-title mt-3">Records that passed the gate</h2></div>
            <a href={`${path}/registry`} className="evidence-action evidence-action--secondary">Open JSON registry</a>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {publicRecords.map((record) => (
              <Link key={record.id} href={epistemicRecordPath(record)} className="evidence-card group">
                <div className="flex flex-wrap justify-between gap-3"><span className="evidence-chip evidence-chip--verified">published canonical</span><span className="evidence-kicker">{record.recordKind}</span></div>
                <h3 className="evidence-card-title mt-5 group-hover:underline">{record.title}</h3>
                <p className="evidence-card-copy mt-3">{record.description}</p>
                <p className="evidence-kicker mt-6">Inspect claims and provenance →</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="withheld-heading">
          <p className="evidence-kicker text-[var(--status-boundary)]">Below the public line</p>
          <h2 id="withheld-heading" className="evidence-section-title mt-3">Draft inventory remains private until canonical release.</h2>
          <p className="evidence-copy mt-5">The public surface exposes aggregate capacity only. Draft identifiers, titles, routes, claims, source packets, and review blockers are excluded from crawlable pages and registries.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="evidence-status-surface evidence-status-surface--boundary"><p className="evidence-kicker">Withheld records</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{registry?.withheldInventory.recordCount}</p></div>
            <div className="evidence-status-surface evidence-status-surface--boundary"><p className="evidence-kicker">Withheld typed edges</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{registry?.withheldInventory.edgeCount}</p></div>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="contract-heading">
          <p className="evidence-kicker">Domain contract</p>
          <h2 id="contract-heading" className="evidence-section-title mt-3">The registry exposes the boundary, not just the content.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="evidence-card"><p className="evidence-kicker">Graph records</p><p className="mt-3 font-mono text-3xl">{registry?.counts.graphRecords}</p></div>
            <div className="evidence-card"><p className="evidence-kicker">Typed edges</p><p className="mt-3 font-mono text-3xl">{graphEdges}</p></div>
            <div className="evidence-card"><p className="evidence-kicker text-[var(--status-verified)]">Public canonical</p><p className="mt-3 font-mono text-3xl text-[var(--status-verified)]">{registry?.counts.publicCanonicalRecords}</p></div>
            <div className="evidence-card"><p className="evidence-kicker text-[var(--status-boundary)]">Withheld</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{registry?.counts.withheldRecords}</p></div>
          </div>
          <p className="evidence-copy mt-7">Read the governing architecture in the <Link href={EPISTEMIC_SYSTEM_PATH} className="evidence-link">Epistemic Publication System</Link>.</p>
        </section>
      </div>
    </main>
  )
}
