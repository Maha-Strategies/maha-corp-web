import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MAHA_SITE_URL } from '@/lib/entity'
import { PUBLIC_EPISTEMIC_RECORDS, getEpistemicDomain, getPublicEpistemicRecord } from '@/lib/epistemic-pilots'
import { buildProvenanceBundle, epistemicProvenancePath, epistemicRecordPath, recordKindSegment } from '@/lib/epistemic-publication'
import { getActiveEpistemicRecordByPath } from '@/lib/public-epistemic-releases'

type PageProps = { params: Promise<{ kind: string; slug: string; recordSlug: string }> }

export const dynamicParams = true
export function generateStaticParams() {
  return PUBLIC_EPISTEMIC_RECORDS.map((record) => ({ kind: record.domainSlug, slug: recordKindSegment(record), recordSlug: record.slug }))
}

async function resolveRecord(kind: string, slug: string, recordSlug: string) {
  return getPublicEpistemicRecord(kind, slug, recordSlug)
    ?? await getActiveEpistemicRecordByPath(`/knowledge/${kind}/${slug}/${recordSlug}`)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { kind, slug, recordSlug } = await params
  const record = await resolveRecord(kind, slug, recordSlug)
  if (!record) return {}
  const path = epistemicRecordPath(record)
  return {
    metadataBase: new URL(MAHA_SITE_URL),
    title: `${record.title} | Maha Knowledge`,
    description: record.description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: record.title, description: record.description, url: `${MAHA_SITE_URL}${path}`, siteName: 'Maha Strategies', images: [] },
    twitter: { card: 'summary', title: record.title, description: record.description, images: [] },
  }
}

export default async function EpistemicRecordPage({ params }: PageProps) {
  const { kind, slug, recordSlug } = await params
  const record = await resolveRecord(kind, slug, recordSlug)
  if (!record) notFound()
  const domain = getEpistemicDomain(record.domainSlug) ?? {
    slug: record.domainSlug,
    name: record.domainSlug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
  }
  const path = epistemicRecordPath(record)
  const provenance = buildProvenanceBundle(record)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: record.title,
    description: record.description,
    datePublished: record.publication.publishedAt,
    dateModified: record.publication.lastReviewedAt,
    mainEntityOfPage: `${MAHA_SITE_URL}${path}`,
    isPartOf: `${MAHA_SITE_URL}/knowledge/${record.domainSlug}`,
    citation: record.sources.map((source) => source.url),
    about: [domain.name, record.recordKind, ...record.claims.map((claim) => claim.claimKind)],
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <nav aria-label="Breadcrumb" className="evidence-kicker"><Link href="/knowledge" className="evidence-link">Knowledge</Link><span className="px-2">/</span><Link href={`/knowledge/${domain.slug}`} className="evidence-link">{domain.name}</Link><span className="px-2">/</span><span>{record.title}</span></nav>
        <header className="mt-10 max-w-5xl">
          <div className="flex flex-wrap gap-2"><span className="evidence-chip evidence-chip--verified">{record.publication.reviewState}</span><span className="evidence-chip evidence-chip--sourced">{record.recordKind}</span><span className="evidence-chip">{record.schemaVersion}</span></div>
          <h1 className="evidence-title">{record.title}</h1>
          <p className="evidence-lede mt-7">{record.summary}</p>
        </header>

        <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <article>
            <section className="evidence-inset"><p className="evidence-kicker text-[var(--status-sourced)]">Bounded definition</p><p className="evidence-lede mt-3 text-[1.2rem]">{record.description}</p></section>

            {record.sections.map((section) => (
              <section key={section.heading} className="evidence-section">
                <h2 className="evidence-section-title">{section.heading}</h2>
                <div className="evidence-prose mt-6 space-y-5">{section.paragraphs.map((paragraph) => <p key={paragraph} className="evidence-copy">{paragraph}</p>)}</div>
                {section.claimIds.length > 0 && <p className="evidence-kicker mt-5">Claims: {section.claimIds.join(' · ')}</p>}
              </section>
            ))}

            <section className="evidence-section" aria-labelledby="claims-heading">
              <p className="evidence-kicker">Claim ledger</p>
              <h2 id="claims-heading" className="evidence-section-title mt-3">Every proposition keeps its own evidence state.</h2>
              <div className="mt-7 space-y-5">
                {record.claims.map((claim) => (
                  <article key={claim.id} className="evidence-card">
                    <div className="flex flex-wrap gap-2"><span className="evidence-chip evidence-chip--sourced">{claim.claimKind}</span><span className="evidence-chip evidence-chip--boundary">{claim.evidenceMaturity}</span></div>
                    <h3 className="font-editorial mt-5 text-2xl text-[var(--text-primary)]">{claim.statement}</h3>
                    <dl className="mt-6 grid gap-5 text-sm md:grid-cols-2">
                      <div><dt className="evidence-kicker">Scope</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{claim.scope}</dd></div>
                      <div><dt className="evidence-kicker">Boundary</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{claim.boundary}</dd></div>
                      <div><dt className="evidence-kicker">Uncertainty</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{claim.uncertainty.statement}</dd></div>
                      <div><dt className="evidence-kicker">Replication</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{claim.replication.assessment}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            <section className="evidence-section" aria-labelledby="sources-heading">
              <p className="evidence-kicker">Primary sources</p>
              <h2 id="sources-heading" className="evidence-section-title mt-3">Citation, locator, rights, and boundary travel together.</h2>
              <ol className="mt-7 space-y-5">
                {record.sources.map((source, index) => <li key={source.id} className="evidence-card"><p className="evidence-kicker text-[var(--status-sourced)]">Source {index + 1} · {source.publisher}</p><h3 className="evidence-card-title mt-3"><a href={source.url} target="_blank" rel="noopener noreferrer" className="evidence-link">{source.title}</a></h3><p className="evidence-card-copy mt-3">{source.authors.join(', ')}</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="evidence-kicker">Exact locator</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{source.exactLocator}</dd></div><div><dt className="evidence-kicker">Establishes</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{source.establishes}</dd></div><div><dt className="evidence-kicker text-[var(--status-boundary)]">Boundary</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{source.boundary}</dd></div><div><dt className="evidence-kicker">Rights basis</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{source.rights.basis.replaceAll('-', ' ')} · {source.rights.note}</dd></div>{source.conflictsOfInterest && <div><dt className="evidence-kicker text-[var(--status-boundary)]">Declared interests</dt><dd className="mt-2 leading-6 text-[var(--text-secondary)]">{source.conflictsOfInterest}</dd></div>}</dl></li>)}
              </ol>
            </section>
          </article>

          <aside className="space-y-6">
            <div className="evidence-card"><p className="evidence-kicker">Evidence contract</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-[var(--text-muted)]">Claims</dt><dd className="mt-1 font-mono text-[var(--text-primary)]">{record.claims.length}</dd></div><div><dt className="text-[var(--text-muted)]">Sources</dt><dd className="mt-1 font-mono text-[var(--text-primary)]">{record.sources.length}</dd></div><div><dt className="text-[var(--text-muted)]">Canonical version</dt><dd className="mt-1 font-mono text-[var(--text-primary)]">{record.publication.canonicalVersion}</dd></div></dl></div>
            <div className="evidence-status-surface evidence-status-surface--boundary"><p className="evidence-status-label">Prohibited inference</p><ul className="mt-3 space-y-3">{record.prohibitedInferences.map((value) => <li key={value} className="text-sm leading-6 text-[var(--text-secondary)]">{value}</li>)}</ul></div>
            <div className="evidence-code p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-[#a8d5c3]">Canonical content hash</p><p className="mt-3 break-all font-mono text-xs leading-5 text-[#edf8f4]">{provenance.contentHash}</p><a href={epistemicProvenancePath(record)} className="mt-5 inline-block font-mono text-[10px] uppercase tracking-widest text-[#bde8d5] underline">Open provenance.json →</a></div>
          </aside>
        </div>
      </div>
    </main>
  )
}
