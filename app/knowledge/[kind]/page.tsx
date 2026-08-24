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
  getPublicDomainRecords,
} from '@/lib/epistemic-pilots'
import { epistemicRecordPath, evaluatePublicationGate } from '@/lib/epistemic-publication'

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
  const publicRecords = getPublicDomainRecords(domain.slug)
  const withheld = graphRecords.filter((record) => !evaluatePublicationGate(record).publicEligible)
  const registry = buildDomainRegistry(domain.slug)
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
          <p className="evidence-kicker text-[var(--status-sourced)]">Adversarial pilot · governed domain</p>
          <h1 className="evidence-title">{domain.name}</h1>
          <p className="evidence-lede mt-7">{domain.description}</p>
          <div className="evidence-status-surface evidence-status-surface--boundary mt-8"><p className="evidence-status-label">Primary stress point</p><p className="evidence-copy mt-2">{domain.stressPoint}</p></div>
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
          <h2 id="withheld-heading" className="evidence-section-title mt-3">Withheld records remain non-pages.</h2>
          <p className="evidence-copy mt-5">The registry records that these candidates exist and why they failed. It does not expose an unsupported claim body or generate a crawlable URL.</p>
          <div className="mt-7 space-y-4">
            {withheld.map((record) => {
              const decision = evaluatePublicationGate(record)
              return <article key={record.id} className="evidence-status-surface evidence-status-surface--boundary"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-editorial text-xl text-[var(--text-primary)]">{record.title}</h3><span className="evidence-chip evidence-chip--boundary">{record.publication.reviewState}</span></div><p className="evidence-card-copy mt-3">{record.summary}</p><p className="evidence-kicker mt-4">Gate: {decision.reasons.join(' · ')}</p></article>
            })}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="contract-heading">
          <p className="evidence-kicker">Domain contract</p>
          <h2 id="contract-heading" className="evidence-section-title mt-3">The registry exposes the boundary, not just the content.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="evidence-card"><p className="evidence-kicker">Graph records</p><p className="mt-3 font-mono text-3xl">{registry?.counts.graphRecords}</p></div>
            <div className="evidence-card"><p className="evidence-kicker text-[var(--status-verified)]">Public canonical</p><p className="mt-3 font-mono text-3xl text-[var(--status-verified)]">{registry?.counts.publicCanonicalRecords}</p></div>
            <div className="evidence-card"><p className="evidence-kicker text-[var(--status-boundary)]">Withheld</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{registry?.counts.withheldRecords}</p></div>
          </div>
          <p className="evidence-copy mt-7">Read the governing architecture in the <Link href={EPISTEMIC_SYSTEM_PATH} className="evidence-link">Epistemic Publication System</Link>.</p>
        </section>
      </div>
    </main>
  )
}
