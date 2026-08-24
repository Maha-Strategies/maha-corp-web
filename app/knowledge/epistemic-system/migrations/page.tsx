import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import { EPISTEMIC_MIGRATION_INVENTORY } from '@/lib/epistemic-adapters'
import { EPISTEMIC_OPERATIONAL_EVIDENCE } from '@/lib/epistemic-operational-evidence'

const PATH = '/knowledge/epistemic-system/migrations'

export const metadata: Metadata = {
  metadataBase: new URL(MAHA_SITE_URL),
  title: 'Knowledge Migration Ledger | Maha Strategies',
  description: 'The fail-closed migration status for semiconductor, mathematics, astronomy, religion, and neuromorphic knowledge under the Maha epistemic publication gate.',
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website', title: 'Maha Knowledge Migration Ledger', description: 'Legacy records are hashed, adapted, evaluated, and withheld until scoped expert review is complete.',
    url: `${MAHA_SITE_URL}${PATH}`, siteName: 'Maha Strategies', images: [],
  },
  twitter: {
    card: 'summary', title: 'Maha Knowledge Migration Ledger', description: 'Five existing knowledge domains evaluated through one fail-closed publication contract.', images: [],
  },
}

export default function EpistemicMigrationsPage() {
  const inventory = EPISTEMIC_MIGRATION_INVENTORY
  const evidence = EPISTEMIC_OPERATIONAL_EVIDENCE
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <nav aria-label="Breadcrumb" className="evidence-kicker">
          <Link href="/knowledge" className="evidence-link">Knowledge</Link><span className="px-2">/</span>
          <Link href="/knowledge/epistemic-system" className="evidence-link">Epistemic system</Link><span className="px-2">/</span>
          <span>Migration ledger</span>
        </nav>

        <header className="mt-10 max-w-5xl">
          <p className="evidence-kicker text-[var(--status-sourced)]">Phase 1 · durable ingestion · {inventory.schemaVersion}</p>
          <h1 className="evidence-title">Existing knowledge enters as evidence to review—not authority to inherit.</h1>
          <p className="evidence-lede mt-7">Five adapters preserve every legacy record’s original path and hash, translate it into the shared epistemic contract, and run the same publication gate. No adapter can carry an old public status across the boundary.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/knowledge/epistemic-system/migration-registry" className="evidence-action evidence-action--primary">Open migration registry</Link>
            <Link href="/knowledge/epistemic-system" className="evidence-action evidence-action--secondary">Read the gate</Link>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="migration-counts">
          <p className="evidence-kicker">Current migration state</p>
          <h2 id="migration-counts" className="evidence-section-title mt-3">The whole legacy corpus is visible to the gate.</h2>
          <div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-4">
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Adapters</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{inventory.counts.adapters}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Source records</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{inventory.counts.sourceRecords}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-verified)]">Promoted</p><p className="mt-3 font-mono text-3xl text-[var(--status-verified)]">{inventory.counts.publicEligible}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-boundary)]">Withheld</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{inventory.counts.withheld}</p></div>
          </div>
          <div className="evidence-status-surface evidence-status-surface--boundary mt-6">
            <p className="evidence-status-label">Deliberate zero</p>
            <p className="evidence-copy mt-2">The adapters do not manufacture passage locators, publication dates, replication assessments, or approvals that the source corpus never recorded. Every imported candidate therefore remains below the new publication line until those gaps are reviewed.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="production-execution-heading">
          <p className="evidence-kicker text-[var(--status-verified)]">Production execution · verified</p>
          <h2 id="production-execution-heading" className="evidence-section-title mt-3">The five adapters crossed the live gate—and none crossed the publication line.</h2>
          <p className="evidence-copy mt-5">Executed on <time dateTime={evidence.executedOn}>{evidence.executedOn}</time>. The production schema converged, application health passed, and every imported target remained withheld.</p>
          <div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-4">
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Immutable batches</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{evidence.totals.persistedBatches}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Review targets</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{evidence.totals.persistedReviewTargets}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-verified)]">Public eligible</p><p className="mt-3 font-mono text-3xl text-[var(--status-verified)]">{evidence.totals.publicEligibleTargets}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Invented reviews</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{evidence.totals.reviewDecisions}</p></div>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {evidence.adapterResults.map((adapter) => (
              <article key={adapter.adapterId} className="evidence-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <h3 className="evidence-card-title">{adapter.adapterId.replaceAll('-', ' ')}</h3>
                  <span className="evidence-chip">{adapter.recordCount} persisted targets</span>
                </div>
              </article>
            ))}
          </div>
          <div className="evidence-status-surface evidence-status-surface--verified mt-6">
            <p className="evidence-status-label">Aggregate evidence digest</p>
            <p className="evidence-copy mt-2 break-all font-mono text-xs">{evidence.evidenceSha256}</p>
            <p className="evidence-copy mt-3">No participant data, natal data, source text, credential, or internal identifier is included. This proves workflow execution, not claim validity.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="adapter-heading">
          <p className="evidence-kicker">Domain adapters</p>
          <h2 id="adapter-heading" className="evidence-section-title mt-3">One contract, domain-specific translation.</h2>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {inventory.adapters.map((adapter) => (
              <article key={adapter.id} className="evidence-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="evidence-kicker text-[var(--status-sourced)]">{adapter.sourceDatasetVersion}</p><h3 className="evidence-card-title mt-3">{adapter.name}</h3></div>
                  <span className="evidence-chip">{adapter.counts.sourceRecords} records</span>
                </div>
                <p className="evidence-card-copy mt-4">{adapter.description}</p>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="evidence-kicker">Eligible</dt><dd className="mt-2 font-mono text-[var(--status-verified)]">{adapter.counts.publicEligible}</dd></div>
                  <div><dt className="evidence-kicker">Withheld</dt><dd className="mt-2 font-mono text-[var(--status-boundary)]">{adapter.counts.withheld}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="review-heading">
          <p className="evidence-kicker">Expert identity and decision</p>
          <h2 id="review-heading" className="evidence-section-title mt-3">Approval is scoped four times, against one frozen hash.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {inventory.adapters[0].requiredReviewScopes.map((scope, index) => (
              <article key={scope} className="evidence-card"><p className="evidence-kicker">0{index + 1}</p><h3 className="evidence-card-title mt-3">{scope.replaceAll('-', ' ')}</h3><p className="evidence-card-copy mt-3">The latest decision must approve the exact review-target digest. A content change makes the decision stale automatically.</p></article>
            ))}
          </div>
          <p className="evidence-copy mt-6">Reviewer profiles are immutable by identity and version. Qualifications, affiliation, identity URL, domains, and conflicts are retained with the decision; a changed profile requires a new version.</p>
        </section>

        <section className="evidence-section" aria-labelledby="ledger-heading">
          <p className="evidence-kicker">Append-only persistence</p>
          <h2 id="ledger-heading" className="evidence-section-title mt-3">The operational chain survives deployments.</h2>
          <pre className="knowledge-machine-panel mt-7 overflow-x-auto p-6 text-xs leading-6"><code>{`legacy record + source registry
  → deterministic source-dataset hash
  → immutable adapter candidate + original path
  → publication-gate decision
  → append-only ingestion batch
  → versioned expert identity
  → scope-specific decision on frozen target hash
  → reviewed source change and a new canonical version
  → publication gate evaluated again`}</code></pre>
          <p className="evidence-copy mt-5">Database ingestion never edits a public page directly. Promotion remains a separate reviewed release, so compromised credentials cannot turn an imported draft into crawlable authority.</p>
        </section>
      </div>
    </main>
  )
}
