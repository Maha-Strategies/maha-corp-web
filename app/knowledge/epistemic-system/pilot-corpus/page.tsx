import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import {
  EPISTEMIC_PHASE4_PILOT_BOUNDARY,
  EPISTEMIC_PHASE4_PILOT_ENTRIES,
  EPISTEMIC_PHASE4_PILOT_MANIFEST,
} from '@/lib/epistemic-pilot-corpus'

const PATH = '/knowledge/epistemic-system/pilot-corpus'

export const metadata: Metadata = {
  metadataBase: new URL(MAHA_SITE_URL),
  title: 'Phase 4 Canonical Pilot Corpus | Maha Strategies',
  description: 'The frozen, cross-domain 20-record operating corpus selected for source completion, exact-hash expert review, and separately authorized canonical release.',
  alternates: { canonical: PATH },
  openGraph: { type: 'website', title: 'Maha Phase 4 Canonical Pilot Corpus', description: 'A bounded public backlog manifest: four records across each of five domains, with selection rationale and explicit non-endorsement boundaries.', url: `${MAHA_SITE_URL}${PATH}`, siteName: 'Maha Strategies', images: [] },
  twitter: { card: 'summary', title: 'Maha Phase 4 Canonical Pilot Corpus', description: 'Twenty records selected to operate the complete epistemic lifecycle.', images: [] },
}

export default function Phase4PilotCorpusPage() {
  const groups = Map.groupBy(EPISTEMIC_PHASE4_PILOT_ENTRIES, (entry) => entry.domainSlug)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Maha Phase 4 Canonical Pilot Corpus',
    description: metadata.description,
    version: EPISTEMIC_PHASE4_PILOT_MANIFEST.schemaVersion,
    dateModified: EPISTEMIC_PHASE4_PILOT_MANIFEST.generatedAt,
    url: `${MAHA_SITE_URL}${PATH}`,
    distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${MAHA_SITE_URL}${PATH}/registry.json` },
    hasPart: EPISTEMIC_PHASE4_PILOT_ENTRIES.map((entry) => ({ '@type': 'CreativeWork', name: entry.title, identifier: entry.recordId, url: `${MAHA_SITE_URL}${entry.sourcePublicPath}` })),
  }
  return <main className="evidence-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><div className="evidence-container">
    <nav aria-label="Breadcrumb" className="evidence-kicker"><Link href="/knowledge" className="evidence-link">Knowledge</Link><span className="px-2">/</span><Link href="/knowledge/epistemic-system" className="evidence-link">Epistemic system</Link><span className="px-2">/</span><span>Pilot corpus</span></nav>
    <header className="mt-10 max-w-5xl"><p className="evidence-kicker text-[var(--status-sourced)]">Phase 4 · bounded operating corpus · {EPISTEMIC_PHASE4_PILOT_MANIFEST.schemaVersion}</p><h1 className="evidence-title">A backlog is now a frozen research object.</h1><p className="evidence-lede mt-7">Twenty migrated records—four in each of five domains—form the first corpus on which Maha will operate source completion, controlled re-ingestion, independent scoped review, and separate release authorization end to end. Selection is visible so successful cases cannot quietly replace failed ones.</p><div className="mt-8 flex flex-wrap gap-3"><a href={`${PATH}/registry.json`} className="evidence-action evidence-action--primary">Open pilot registry JSON</a><Link href="/knowledge/epistemic-system" className="evidence-action evidence-action--secondary">Read the publication protocol</Link></div></header>

    <section className="evidence-section"><p className="evidence-kicker">Frozen manifest</p><h2 className="evidence-section-title mt-3">Five domains, equal representation.</h2><div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-3"><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Records</p><p className="mt-3 font-mono text-3xl">{EPISTEMIC_PHASE4_PILOT_MANIFEST.counts.records}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Domains</p><p className="mt-3 font-mono text-3xl">{EPISTEMIC_PHASE4_PILOT_MANIFEST.counts.domains}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-boundary)]">Initial source blockers</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{EPISTEMIC_PHASE4_PILOT_MANIFEST.counts.sourceBlockers}</p></div></div><div className="evidence-status-surface evidence-status-surface--boundary mt-6"><p className="evidence-status-label">Selection boundary</p><p className="evidence-copy mt-2">{EPISTEMIC_PHASE4_PILOT_BOUNDARY}</p></div><p className="mt-5 break-all font-mono text-xs text-[var(--text-secondary)]">Manifest digest: {EPISTEMIC_PHASE4_PILOT_MANIFEST.manifestSha256}</p></section>

    {[...groups.entries()].map(([domain, entries]) => <section className="evidence-section" key={domain}><p className="evidence-kicker text-[var(--status-sourced)]">{domain.replaceAll('-', ' ')}</p><h2 className="evidence-section-title mt-3">Four deliberately different review surfaces.</h2><div className="mt-7 grid gap-4 lg:grid-cols-2">{entries.map((entry) => <article className="evidence-card" key={entry.recordId}><p className="evidence-kicker">Pilot record {String(entry.sequence).padStart(2, '0')}</p><h3 className="evidence-card-title mt-3">{entry.title}</h3><p className="evidence-card-copy mt-3">{entry.selectionRationale}</p><dl className="mt-5 grid gap-4 text-sm"><div><dt className="evidence-kicker">Frozen initial target</dt><dd className="mt-2 break-all font-mono text-xs text-[var(--text-secondary)]">{entry.initialReviewTargetSha256}</dd></div><div><dt className="evidence-kicker">Initial source blockers</dt><dd className="mt-2 text-[var(--text-secondary)]">{entry.initialSourceBlockers.length ? entry.initialSourceBlockers.join(' · ') : 'None at adapter migration'}</dd></div></dl><Link href={entry.sourcePublicPath} className="evidence-action evidence-action--secondary mt-6">Inspect legacy source record</Link></article>)}</div></section>)}

    <section className="evidence-section"><p className="evidence-kicker">What this public manifest omits</p><h2 className="evidence-section-title mt-3">Reviewer access remains private and scope-limited.</h2><p className="evidence-copy mt-5 max-w-4xl">This page publishes corpus selection, initial hashes, source blockers, and rationale. It does not publish invitation credentials, operational fingerprints, private reviewer identity snapshots, unfinished decisions, or internal release rationale. Canonical publication remains a later and separately authorized event.</p></section>
  </div></main>
}
