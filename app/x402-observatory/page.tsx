import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import type { BazaarState, CheckState, PublicObservatoryEntry, SettlementState } from '@/lib/x402/observatory'
import { PUBLIC_X402_OBSERVATORY_RESOURCES } from '@/lib/x402/observatory-registry'
import { getPublicObservatoryEntries } from '@/lib/x402/observatory-store'

export const dynamic = 'force-dynamic'

const title = 'Open x402 Conformance Observatory | Maha Strategies'
const description = 'Factual, vendor-neutral monitoring of x402 v2 protocol and Bazaar discovery correctness. No subjective trust or quality scores.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/x402-observatory' },
  openGraph: { type: 'website', url: `${MAHA_SITE_URL}/x402-observatory`, title, description },
}

const checkLabels: Record<CheckState, string> = {
  pass: 'Pass', fail: 'Fail', unknown: 'Unknown', not_applicable: 'Not declared',
}
const bazaarLabels: Record<BazaarState, string> = {
  current: 'Current', stale: 'Stale', missing: 'Missing', unknown: 'Unknown', not_declared: 'Not declared',
}
const settlementLabels: Record<SettlementState, string> = {
  disabled: 'Disabled', not_run: 'Not run', success: 'Success', failed: 'Failed', indeterminate: 'Indeterminate',
}

function stateClass(state: CheckState | BazaarState | SettlementState): string {
  if (state === 'pass' || state === 'current' || state === 'success') return 'border-emerald-800 bg-emerald-950/30 text-emerald-200'
  if (state === 'fail' || state === 'stale' || state === 'missing' || state === 'failed') return 'border-rose-800 bg-rose-950/30 text-rose-200'
  return 'border-zinc-700 bg-zinc-900/50 text-zinc-300'
}

function Check({ label, state }: { label: string; state: CheckState }) {
  return <div className={`border p-4 ${stateClass(state)}`}><p className="font-mono text-[9px] uppercase tracking-widest opacity-70">{label}</p><p className="mt-2 text-sm">{checkLabels[state]}</p></div>
}

function formatTime(value: string | null): string {
  if (!value) return 'Not observed'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Invalid timestamp' : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC'
}

function ResourceCard({ resource }: { resource: PublicObservatoryEntry }) {
  const latest = resource.latest
  return (
    <article className="border border-zinc-800 bg-zinc-950/50 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{resource.operator}</p>
          <h2 className="mt-3 text-2xl font-light text-white">{resource.name}</h2>
          <a href={resource.url} className="mt-3 block break-all font-mono text-xs text-zinc-400 underline underline-offset-4 hover:text-white">{resource.url} ↗</a>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Observed: {formatTime(latest?.observedAt ?? null)}</div>
      </div>

      {latest ? (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Check label="Challenge reachable" state={latest.challengeReachable} />
            <Check label="x402 v2" state={latest.v2Compliant} />
            <Check label="Schema valid" state={latest.schemaValid} />
            <Check label="Crawler receives 402" state={latest.crawlerReceives402} />
            <div className={`border p-4 ${stateClass(latest.bazaarState)}`}><p className="font-mono text-[9px] uppercase tracking-widest opacity-70">Bazaar record</p><p className="mt-2 text-sm">{bazaarLabels[latest.bazaarState]}</p></div>
          </div>
          <div className="mt-5 grid gap-4 border-t border-zinc-800 pt-5 text-sm text-zinc-400 sm:grid-cols-3">
            <div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Diagnostic duration</p><p className="mt-2">{latest.durationMs} ms</p></div>
            <div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Digest evidence</p><p className="mt-2">{latest.digestSource === 'catalog' ? 'Catalog-computed digest' : latest.digestSource === 'reconstructed' ? 'Reconstructed comparison' : 'None'}</p></div>
            <div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Bounded settlement</p><p className={`mt-2 inline-block border px-2 py-1 ${stateClass(latest.settlementState)}`}>{settlementLabels[latest.settlementState]}</p></div>
          </div>
        </>
      ) : (
        <div className="mt-7 border border-zinc-800 bg-zinc-900/30 p-5 text-sm text-zinc-400">Awaiting the first scheduled observation. No status is inferred from missing data.</div>
      )}

      <div className="mt-5 border-t border-zinc-800 pt-5 text-xs leading-6 text-zinc-500">
        Last successful voluntarily enabled bounded settlement: {formatTime(resource.lastSuccessfulBoundedSettlementAt)}
        {resource.lastSuccessfulBoundedSettlementTransaction ? <span className="ml-2 font-mono">({resource.lastSuccessfulBoundedSettlementTransaction})</span> : null}
      </div>
    </article>
  )
}

export default async function X402ObservatoryPage() {
  const resources = await getPublicObservatoryEntries(PUBLIC_X402_OBSERVATORY_RESOURCES)
  const datasetJsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Open x402 Conformance Observatory', description,
    url: `${MAHA_SITE_URL}/x402-observatory`,
    distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${MAHA_SITE_URL}/api/x402-observatory` },
    creator: { '@id': `${MAHA_SITE_URL}/#organization` },
  }
  return (
    <main className="min-h-screen bg-[#080a0d] px-6 py-20 text-zinc-300 sm:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd).replace(/</g, '\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <header className="max-w-4xl border-l border-cyan-600 pl-6 sm:pl-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ Open x402 conformance observatory ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">Protocol facts, without a trust score.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-400">Scheduled, read-only checks of public x402 resources using the same open conformance logic as x402-doctor. Results describe the observed protocol and discovery contract at one point in time.</p>
          <div className="mt-8 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
            <a href="/api/x402-observatory" className="border border-cyan-800 px-4 py-3 text-cyan-100 hover:bg-cyan-950/40">Machine-readable status ↗</a>
            <Link href="/developers" className="px-4 py-3 text-zinc-300 underline underline-offset-4 hover:text-white">Developer infrastructure ↗</Link>
          </div>
        </header>

        <section className="mt-14 grid gap-4 border-y border-zinc-800 py-8 sm:grid-cols-3" aria-label="Observatory scope">
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Included</p><p className="mt-3 text-sm leading-6 text-zinc-400">Challenge, v2 contract, schema, crawler replay, Bazaar freshness, and opt-in bounded settlement evidence.</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Not claimed</p><p className="mt-3 text-sm leading-6 text-zinc-400">Security, operator identity, service quality, uptime SLA, economic value, reputation, or general trustworthiness.</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-300">Monitoring boundary</p><p className="mt-3 text-sm leading-6 text-zinc-400">This is not a liveness product. Checks run on a bounded schedule and missing observations remain unknown.</p></div>
        </section>

        <section className="mt-12 space-y-5" aria-label="Observed x402 resources">
          {resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}
        </section>

        <section className="mt-16 border-t border-zinc-800 pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Method and participation ]</p>
          <h2 className="mt-4 text-2xl font-light text-white">Allowlisted, reproducible, and correction-friendly.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">Resources are added through review rather than an anonymous scan form, preventing SSRF and keeping operator intent explicit. The observation ledger is append-only. A later run can show recovery without rewriting the earlier failure.</p>
          <div className="mt-6 flex flex-wrap gap-5 font-mono text-xs uppercase tracking-widest">
            <a href="https://github.com/Maha-Strategies/maha-corp-web/blob/main/docs/x402-observatory.md" target="_blank" rel="noopener noreferrer" className="text-cyan-100 underline underline-offset-4 hover:text-white">Read the method and inclusion policy ↗</a>
            <a href="https://github.com/Maha-Strategies/maha-corp-web/issues" target="_blank" rel="noopener noreferrer" className="text-cyan-100 underline underline-offset-4 hover:text-white">Request inclusion or correction ↗</a>
          </div>
        </section>
      </div>
    </main>
  )
}
