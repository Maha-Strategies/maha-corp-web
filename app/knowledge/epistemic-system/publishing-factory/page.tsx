import type { Metadata } from 'next'
import Link from 'next/link'

import {
  evaluatePublicAuthorityConformance,
  loadPublicAuthorityConformanceCorpus,
  PUBLIC_AUTHORITY_CONFORMANCE_DATE,
} from '@/lib/celestial-public-authority-conformance'
import { MAHA_SITE_URL } from '@/lib/entity'
import { EPISTEMIC_MIGRATION_INVENTORY } from '@/lib/epistemic-adapters'
import { EPISTEMIC_FACTORY_BOUNDARY } from '@/lib/epistemic-factory'
import { EPISTEMIC_FACTORY_MCP_TOOLS } from '@/lib/epistemic-factory-tools'

const PATH = '/knowledge/epistemic-system/publishing-factory'

export const metadata: Metadata = {
  metadataBase: new URL(MAHA_SITE_URL),
  title: 'Noncanonical Knowledge Publishing Factory | Maha Strategies',
  description: 'The Phase 5–8 compiler for immutable draft candidates, automated source-to-claim audits, reviewer packets, public-authority conformance, and provenance ledgers.',
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    title: 'Maha Noncanonical Knowledge Publishing Factory',
    description: 'Scalable draft compilation with a hard boundary between automated checks and canonical human-reviewed publication.',
    url: `${MAHA_SITE_URL}${PATH}`,
    siteName: 'Maha Strategies',
    images: [],
  },
  twitter: { card: 'summary', title: 'Maha Noncanonical Knowledge Publishing Factory', description: 'Immutable drafts, source-to-claim audits, conformance tests, and provenance without automatic publication.', images: [] },
}

const phases = [
  { phase: 'Phase 5', title: 'Audit and packet compilation', body: 'Every current candidate is checked for structural source resolution, declared source mismatch, and bounded unsupported-inference patterns. The exact candidate hash, source/claim matrix, review criteria, and findings become one immutable reviewer packet.' },
  { phase: 'Phase 6', title: 'Bounded batch operation', body: 'One run can compile up to 500 latest immutable targets. Duplicate records, hash drift, promoted records, and stale revisions fail closed before persistence.' },
  { phase: 'Phase 7', title: 'Independent calculation conformance', body: 'Neutral calculation fixtures compare Maha against NASA/JPL Horizons DE441 and US Naval Observatory lunar-phase data. Numerical drift outside declared tolerances fails CI.' },
  { phase: 'Phase 8', title: 'One-command provenance ledger', body: 'The operator command previews by default and persists only with an explicit apply flag. Each run, audit, and packet is append-only; the factory has no release-authority path.' },
] as const

export default async function PublishingFactoryPage() {
  const corpus = await loadPublicAuthorityConformanceCorpus()
  const conformance = evaluatePublicAuthorityConformance(corpus)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Maha Noncanonical Knowledge Publishing Factory',
    description: metadata.description,
    datePublished: PUBLIC_AUTHORITY_CONFORMANCE_DATE,
    dateModified: PUBLIC_AUTHORITY_CONFORMANCE_DATE,
    mainEntityOfPage: `${MAHA_SITE_URL}${PATH}`,
    isBasedOn: [corpus.jplHorizons.sourceUrl, corpus.usnoMoonPhases.documentationUrl],
  }
  return <main className="evidence-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><div className="evidence-container">
    <nav aria-label="Breadcrumb" className="evidence-kicker"><Link href="/knowledge" className="evidence-link">Knowledge</Link><span className="px-2">/</span><Link href="/knowledge/epistemic-system" className="evidence-link">Epistemic system</Link><span className="px-2">/</span><span>Publishing factory</span></nav>
    <header className="mt-10 max-w-5xl"><p className="evidence-kicker text-[var(--status-sourced)]">Phases 5–8 · noncanonical factory · 1.0</p><h1 className="evidence-title">Scale the draft graph without scaling false authority.</h1><p className="evidence-lede mt-7">The factory turns frozen candidates into auditable review work at batch scale. It can organize evidence and detect bounded defects; it cannot impersonate a reviewer or turn an unreviewed draft into a public knowledge page.</p><div className="mt-8 flex flex-wrap gap-3"><a className="evidence-action evidence-action--primary" href="/conformance/celestial-public-authority-v1.json">Open public conformance fixture</a><a className="evidence-action evidence-action--secondary" href={`${PATH}/registry.json`}>Open factory registry JSON</a></div></header>

    <section className="evidence-section"><p className="evidence-kicker">Execution architecture</p><h2 className="evidence-section-title mt-3">Four phases, one non-transfer boundary.</h2><div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-3"><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Current adapter candidates</p><p className="mt-3 font-mono text-3xl">{EPISTEMIC_MIGRATION_INVENTORY.counts.sourceRecords}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Maximum targets / run</p><p className="mt-3 font-mono text-3xl">500</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-boundary)]">Automatic public pages</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">0</p></div></div><div className="mt-7 grid gap-4 lg:grid-cols-2">{phases.map((entry) => <article className="evidence-card" key={entry.phase}><p className="evidence-kicker text-[var(--status-sourced)]">{entry.phase}</p><h3 className="evidence-card-title mt-3">{entry.title}</h3><p className="evidence-card-copy mt-3">{entry.body}</p></article>)}</div><div className="evidence-status-surface evidence-status-surface--boundary mt-6"><p className="evidence-status-label">Factory boundary</p><p className="evidence-copy mt-2">{EPISTEMIC_FACTORY_BOUNDARY}</p></div></section>

    <section className="evidence-section"><p className="evidence-kicker">Authenticated orchestration</p><h2 className="evidence-section-title mt-3">Preview, queue, work, review, release.</h2><p className="evidence-copy mt-5 max-w-4xl">The private MCP harness exposes {EPISTEMIC_FACTORY_MCP_TOOLS.length} read-only compiler and verification tools. Durable submission enters a separate authenticated queue; its worker can persist only immutable, noncanonical review targets. Canonical release still requires the distinct release-authority credential and exact-hash review decisions.</p><pre className="knowledge-machine-panel mt-7 overflow-x-auto p-6 text-xs leading-6"><code>{`authenticated MCP preview     no durable write
  ├─ factory_draft_node       audited draft compilation
  ├─ factory_detect_conflict  review leads, not adjudication
  └─ factory_verify_bridge    structural contract, not proof

admin queue submission        mutable execution state
  └─ bounded worker           immutable noncanonical target

expert review + release       separate authority and exact hash
  └─ canonical route          on-demand route + sitemap revalidation`}</code></pre></section>

    <section className="evidence-section"><p className="evidence-kicker">Independent public-authority comparison</p><h2 className="evidence-section-title mt-3">Thirty checks, zero private milestones.</h2><p className="evidence-copy mt-5 max-w-4xl">The frozen fixture uses four neutral instants and seven classical bodies from JPL Horizons, plus two 2026 lunar-phase events from the US Naval Observatory. It contains no natal, participant, founder, customer, or business-event timestamps.</p><div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-3"><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Longitude comparisons</p><p className="mt-3 font-mono text-3xl">{conformance.counts.longitudeComparisons}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Phase events</p><p className="mt-3 font-mono text-3xl">{conformance.counts.moonPhaseEvents}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-verified)]">Out-of-envelope</p><p className="mt-3 font-mono text-3xl text-[var(--status-verified)]">{conformance.disagreements.length}</p></div></div><dl className="mt-7 grid gap-4 text-sm md:grid-cols-2"><div className="evidence-card"><dt className="evidence-kicker">Maximum longitude difference</dt><dd className="mt-3 font-mono text-xl">{conformance.maxima.maximumLongitudeErrorDegrees.toFixed(6)}°</dd><p className="evidence-card-copy mt-2">Release envelope: {conformance.tolerances.longitudeDegrees.toFixed(3)}°</p></div><div className="evidence-card"><dt className="evidence-kicker">Maximum phase-time difference</dt><dd className="mt-3 font-mono text-xl">{conformance.maxima.maximumPhaseTimeErrorMinutes.toFixed(3)} min</dd><p className="evidence-card-copy mt-2">Release envelope: {conformance.tolerances.phaseTimeMinutes.toFixed(0)} minute</p></div></dl><p className="evidence-card-copy mt-6">{conformance.interpretationBoundary}</p></section>

    <section className="evidence-section"><p className="evidence-kicker">Index control</p><h2 className="evidence-section-title mt-3">A packet is not a page.</h2><pre className="knowledge-machine-panel mt-7 overflow-x-auto p-6 text-xs leading-6"><code>{`immutable candidate
  ├─ automated audit          private · non-approving
  ├─ source/claim matrix      private · exact hash
  ├─ reviewer packet          private · noindex
  ├─ factory run provenance   append-only
  └─ canonical public route   impossible without separate review + release`}</code></pre></section>
  </div></main>
}
