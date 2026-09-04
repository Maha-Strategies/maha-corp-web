import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import { epistemicReleaseStatus } from '@/lib/epistemic-release'
import { getPublicEpistemicReleaseHistory } from '@/lib/public-epistemic-releases'
import { EVIDENCE_WORKFLOW_PATH } from '@/lib/evidence-workflow-examples'

const PATH = '/knowledge/epistemic-system/releases'

export const metadata: Metadata = {
  metadataBase: new URL(MAHA_SITE_URL),
  title: 'Canonical Knowledge Release Ledger | Maha Strategies',
  description: 'The public, immutable release, supersession, withdrawal, exact-review, and provenance history for database-backed Maha Knowledge records.',
  alternates: { canonical: PATH },
  openGraph: { type: 'website', title: 'Maha Canonical Knowledge Release Ledger', description: 'Every database-backed public record retains its exact target hash, scoped approvals, release authority, supersession, and withdrawal history.', url: `${MAHA_SITE_URL}${PATH}`, siteName: 'Maha Strategies', images: [] },
  twitter: { card: 'summary', title: 'Maha Canonical Knowledge Release Ledger', description: 'A public release history that does not erase superseded or withdrawn knowledge.', images: [] },
}

export const dynamic = 'force-dynamic'

export default async function EpistemicReleaseLedgerPage() {
  const { releases, withdrawals } = await getPublicEpistemicReleaseHistory()
  const active = releases.filter((release) => epistemicReleaseStatus(release, releases, withdrawals) === 'active')
  const superseded = releases.filter((release) => epistemicReleaseStatus(release, releases, withdrawals) === 'superseded')
  const withdrawn = releases.filter((release) => epistemicReleaseStatus(release, releases, withdrawals) === 'withdrawn')
  return (
    <main className="evidence-page"><div className="evidence-container">
      <nav aria-label="Breadcrumb" className="evidence-kicker"><Link href="/knowledge" className="evidence-link">Knowledge</Link><span className="px-2">/</span><Link href="/knowledge/epistemic-system" className="evidence-link">Epistemic system</Link><span className="px-2">/</span><span>Canonical releases</span></nav>
      <header className="mt-10 max-w-5xl"><p className="evidence-kicker text-[var(--status-sourced)]">Phase 3 · public release ledger</p><h1 className="evidence-title">Publication creates history; it does not overwrite it.</h1><p className="evidence-lede mt-7">Every database-backed canonical record binds one frozen content hash, the latest unqualified decision for every required scope, and a separately authenticated human release decision. Each approval declares whether its method was external expert, internal editorial, or automated verification; these categories are never interchangeable.</p><div className="mt-8 flex flex-wrap gap-3"><a href={`${PATH}/registry.json`} className="evidence-action evidence-action--primary">Open release registry JSON</a><Link href="/knowledge/epistemic-system" className="evidence-action evidence-action--secondary">Read the publication gate</Link><Link href={EVIDENCE_WORKFLOW_PATH} className="evidence-action evidence-action--secondary">See the release-flow examples</Link></div></header>

      <section className="evidence-section"><p className="evidence-kicker">Current projection</p><h2 className="evidence-section-title mt-3">Only active releases generate canonical records.</h2><div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-4"><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">All releases</p><p className="mt-3 font-mono text-3xl">{releases.length}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-verified)]">Active</p><p className="mt-3 font-mono text-3xl text-[var(--status-verified)]">{active.length}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Superseded</p><p className="mt-3 font-mono text-3xl">{superseded.length}</p></div><div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-boundary)]">Withdrawn</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{withdrawn.length}</p></div></div><div className="evidence-status-surface evidence-status-surface--boundary mt-6"><p className="evidence-status-label">Epistemic boundary</p><p className="evidence-copy mt-2">A release proves that Maha’s declared publication protocol passed. It does not certify scientific truth, predictive validity, safety, or fitness for a particular decision.</p></div></section>

      <section className="evidence-section"><p className="evidence-kicker">Immutable revision history</p><h2 className="evidence-section-title mt-3">Every status remains explicit.</h2><div className="mt-7 grid gap-4">{releases.map((release) => {
        const status = epistemicReleaseStatus(release, releases, withdrawals)
        return <article key={release.releaseId} className="evidence-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="evidence-kicker text-[var(--status-sourced)]">{release.domainSlug} · version {release.canonicalVersion}</p><h3 className="evidence-card-title mt-3">{release.recordSnapshot.title}</h3></div><span className={`evidence-chip ${status === 'active' ? 'evidence-chip--verified' : 'evidence-chip--boundary'}`}>{status}</span></div><p className="evidence-card-copy mt-4">{release.publicChangeSummary}</p><dl className="mt-5 grid gap-4 text-sm md:grid-cols-2"><div><dt className="evidence-kicker">Review assurance</dt><dd className="mt-2 text-[var(--text-secondary)]">{release.assuranceTier ?? 'legacy-review-unclassified'} — this labels the review method, not scientific validation.</dd></div><div><dt className="evidence-kicker">Target digest</dt><dd className="mt-2 break-all font-mono text-xs text-[var(--text-secondary)]">{release.targetSha256}</dd></div><div><dt className="evidence-kicker">Released</dt><dd className="mt-2 text-[var(--text-secondary)]">{new Date(release.releasedAt).toISOString()}</dd></div><div><dt className="evidence-kicker">Scoped approvals</dt><dd className="mt-2 text-[var(--text-secondary)]">{release.approvals.map((approval) => `${approval.scope} (${approval.reviewerKind ?? 'legacy kind unrecorded'})`).join(' · ')}</dd></div><div><dt className="evidence-kicker">Canonical path</dt><dd className="mt-2"><Link href={release.canonicalPath} className="evidence-link">{release.canonicalPath}</Link></dd></div></dl><a href={`${PATH}/${release.releaseId}/provenance.json`} className="evidence-action evidence-action--secondary mt-6">Inspect sanitized provenance</a></article>
      })}{!releases.length && <article className="evidence-card"><p className="evidence-card-copy">No Phase 3 canonical releases have been authorized yet. An empty ledger is evidence of no release, not a system error.</p></article>}</div></section>
    </div></main>
  )
}
