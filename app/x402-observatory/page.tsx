import Link from 'next/link'
import type { Metadata } from 'next'

import { MAHA_SITE_URL } from '@/lib/entity'
import type { BazaarState, CheckState, PublicObservatoryEntry, SettlementState } from '@/lib/x402/observatory'
import { PUBLIC_X402_OBSERVATORY_RESOURCES } from '@/lib/x402/observatory-registry'
import { getPublicObservatoryEntries } from '@/lib/x402/observatory-store'

export const dynamic = 'force-dynamic'

const title = 'Open x402 Conformance Observatory | Maha Strategies'
const description = 'Factual, vendor-neutral monitoring of x402 v2 protocol and Bazaar discovery correctness. No subjective trust score.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/x402-observatory' },
  openGraph: { type: 'website', url: `${MAHA_SITE_URL}/x402-observatory`, title, description },
}

const checkLabels: Record<CheckState, string> = {
  pass: 'Pass',
  fail: 'Fail',
  unknown: 'Unknown',
  not_applicable: 'Not declared',
}

const bazaarLabels: Record<BazaarState, string> = {
  current: 'Current',
  stale: 'Stale',
  missing: 'Missing',
  unknown: 'Unknown',
  not_declared: 'Not declared',
}

const settlementLabels: Record<SettlementState, string> = {
  disabled: 'Disabled',
  not_run: 'Not run',
  success: 'Success',
  failed: 'Failed',
  indeterminate: 'Indeterminate',
}

function stateTone(state: CheckState | BazaarState | SettlementState): string {
  if (state === 'pass' || state === 'success' || state === 'current') return 'var(--status-verified)'
  if (state === 'fail' || state === 'failed' || state === 'missing') return 'var(--status-unverified)'
  if (
    state === 'stale' ||
    state === 'not_declared' ||
    state === 'indeterminate' ||
    state === 'disabled' ||
    state === 'not_run' ||
    state === 'unknown' ||
    state === 'not_applicable'
  ) {
    return 'var(--status-boundary)'
  }
  return 'var(--status-sourced)'
}

type ObservatoryState = CheckState | BazaarState | SettlementState

function CheckBadge({
  label,
  value,
  state,
}: {
  label: string
  value: string
  state: ObservatoryState
}) {
  return (
    <article className="evidence-card">
      <p className="evidence-kicker">{label}</p>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.22em]" style={{ color: stateTone(state) }}>{value}</p>
    </article>
  )
}

function formatTime(value: string | null): string {
  if (!value) return 'Not observed'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Invalid timestamp'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC'
}

function ResourceCard({ resource }: { resource: PublicObservatoryEntry }) {
  const latest = resource.latest

  return (
    <article className="evidence-card mt-8">
      <header className="border-b border-[var(--border-default)] pb-6">
        <p className="evidence-kicker text-[var(--status-sourced)]">{resource.operator}</p>
        <h2 className="evidence-section-title mt-3 text-3xl">{resource.name}</h2>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block max-w-4xl break-all font-mono text-xs text-[var(--text-secondary)] underline underline-offset-4"
        >
          {resource.url} ↗
        </a>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CheckBadge label="Observed" value={formatTime(latest?.observedAt ?? null)} state={latest ? latest.challengeReachable : 'unknown'} />
        <CheckBadge
          label="Challenge reachable"
          value={latest ? checkLabels[latest.challengeReachable] : 'Not observed'}
          state={latest ? latest.challengeReachable : 'unknown'}
        />
        <CheckBadge
          label="x402 v2 contract"
          value={latest ? checkLabels[latest.v2Compliant] : 'Not observed'}
          state={latest ? latest.v2Compliant : 'unknown'}
        />
        <CheckBadge
          label="Schema valid"
          value={latest ? checkLabels[latest.schemaValid] : 'Not observed'}
          state={latest ? latest.schemaValid : 'not_applicable'}
        />
        <CheckBadge
          label="Crawler 402"
          value={latest ? checkLabels[latest.crawlerReceives402] : 'Not observed'}
          state={latest ? latest.crawlerReceives402 : 'unknown'}
        />
        <CheckBadge
          label="Bazaar record"
          value={latest ? bazaarLabels[latest.bazaarState] : 'No observation'}
          state={latest ? latest.bazaarState : 'unknown'}
        />
        <CheckBadge
          label="Bounded settlement"
          value={latest ? settlementLabels[latest.settlementState] : settlementLabels.disabled}
          state={latest ? latest.settlementState : 'disabled'}
        />
      </div>

      <div className="evidence-inset mt-6 space-y-3">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="evidence-kicker">Diagnostic duration</p>
            <p className="mt-3 font-mono text-xs text-[var(--text-secondary)]">{latest ? `${latest.durationMs} ms` : 'No run yet'}</p>
          </div>
          <div>
            <p className="evidence-kicker">Digest source</p>
            <p className="mt-3 font-mono text-xs text-[var(--text-secondary)]">
              {latest
                ? latest.digestSource === 'catalog'
                  ? 'Catalog digest'
                  : latest.digestSource === 'reconstructed'
                    ? 'Reconstructed digest'
                    : 'None'
                : 'None'}
            </p>
          </div>
          <div>
            <p className="evidence-kicker">Settlement txn</p>
            <p className="mt-3 font-mono text-xs text-[var(--text-secondary)]">
              {latest?.settlementTransaction ? latest.settlementTransaction : 'Not available'}
            </p>
          </div>
        </div>

        <p className="evidence-kicker">Bounded settlement history</p>
        <p className="font-mono text-xs text-[var(--text-secondary)]">
          {resource.lastSuccessfulBoundedSettlementAt
            ? `${formatTime(resource.lastSuccessfulBoundedSettlementAt)} ${resource.lastSuccessfulBoundedSettlementTransaction ? `• ${resource.lastSuccessfulBoundedSettlementTransaction}` : ''}`
            : 'No successful bounded settlement yet.'}
        </p>

        <p className="evidence-kicker">Findings</p>
        {latest && latest.findingCodes.length > 0 ? (
          <ul className="grid gap-2">
            {latest.findingCodes.map((finding) => (
              <li key={finding} className="font-mono text-xs text-[var(--text-secondary)]">• {finding}</li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-xs text-[var(--text-secondary)]">No findings reported.</p>
        )}
      </div>
    </article>
  )
}

export default async function X402ObservatoryPage() {
  const resources = await getPublicObservatoryEntries(PUBLIC_X402_OBSERVATORY_RESOURCES)

  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Open x402 Conformance Observatory',
    description,
    url: `${MAHA_SITE_URL}/x402-observatory`,
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: `${MAHA_SITE_URL}/api/x402-observatory`,
    },
    creator: { '@id': `${MAHA_SITE_URL}/#organization` },
  }

  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd).replace(/</g, '\u003c') }}
      />
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">[ Open x402 conformance observatory ]</p>
          <h1 className="evidence-title evidence-title--product mt-5">Protocol facts, without a trust score.</h1>
          <p className="evidence-lede mt-7">
            Scheduled, read-only checks over public x402 resources using the same open conformance logic as x402-doctor.
            Results describe what is observed in the live contract, not inferred trust.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <a href="/api/x402-observatory" className="evidence-action evidence-action--primary">Machine-readable status ↗</a>
            <Link href="/developers" className="evidence-action evidence-action--secondary">Developer infrastructure ↗</Link>
          </div>
        </header>

        <section className="evidence-section">
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="evidence-card">
              <p className="evidence-kicker">Included checks</p>
              <p className="evidence-card-copy mt-4">
                Challenge reachability, protocol version, schema readability, crawler behavior, Bazaar freshness, and optional bounded settlement evidence.
              </p>
            </article>
            <article className="evidence-card">
              <p className="evidence-kicker">What this does not claim</p>
              <p className="evidence-card-copy mt-4">
                Security guarantees, SLA commitments, price quality claims, global trust scoring, and operator reputation.
                This is observational telemetry, not a scoring oracle.
              </p>
            </article>
            <article className="evidence-card">
              <p className="evidence-card-copy mt-2">No private credentials are retained in observations. Registry entries are allowlisted and deterministic.</p>
            </article>
          </div>
        </section>

        <section className="evidence-section" aria-label="Observed x402 resources">
          {resources.length > 0 ? (
            resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)
          ) : (
            <div className="evidence-inset">
              <p className="evidence-copy">
                No public x402 resources are currently registered. Add an entry via the method document before observations can be produced.
              </p>
            </div>
          )}
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ method and participation ]</p>
          <h2 className="evidence-section-title mt-4">Allowlisted, reproducible, and correction-friendly.</h2>
          <p className="evidence-copy mt-5">Resources are added through review, not an unauthenticated scan. Observations are append-only.
            A later run can show recovery without overwriting earlier outcomes.</p>
          <div className="mt-7 flex flex-wrap gap-4">
            <a href="https://github.com/Maha-Strategies/maha-corp-web/blob/main/docs/x402-observatory.md" target="_blank" rel="noopener noreferrer" className="evidence-link">Method and inclusion policy ↗</a>
            <a href="https://github.com/Maha-Strategies/maha-corp-web/issues" target="_blank" rel="noopener noreferrer" className="evidence-link">Request inclusion or correction ↗</a>
          </div>
        </section>
      </div>
    </main>
  )
}
