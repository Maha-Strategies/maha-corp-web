import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import { getPublicX402TrustReplays, type PublicX402TrustReplay } from '@/lib/x402/trust-replay'
import { X402TrustDemoStart, X402TrustEvidenceLink, X402TrustIntegrationLink, X402TrustScenarioDetails } from './X402TrustTelemetry'

const title = 'x402 Trust Policy Replay | Maha Strategies'
const description = 'A read-only replay of three frozen, synthetic x402 Trust policy inputs through Maha’s schema-first advisory adapter.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/x402-trust/replay' },
  openGraph: { type: 'website', url: `${MAHA_SITE_URL}/x402-trust/replay`, title, description },
}

function outcomeStyle(outcome: PublicX402TrustReplay['result']['outcome']): string {
  if (outcome === 'proceed') return 'border-emerald-800 bg-emerald-950/20 text-emerald-200'
  if (outcome === 'require_review') return 'border-amber-800 bg-amber-950/20 text-amber-200'
  return 'border-rose-800 bg-rose-950/20 text-rose-200'
}

function actionLabel(action: PublicX402TrustReplay['result']['nextAction']): string {
  if (action === 'continue_to_buyer_policy') return 'Continue to independent buyer policy'
  if (action === 'request_human_review') return 'Request human review'
  return 'Stop workflow'
}

function ReplayCard({ replay }: { replay: PublicX402TrustReplay }) {
  return (
    <article className="border border-zinc-800 bg-zinc-950/50 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{replay.fixtureLabel} · {replay.sampleRole}</p>
          <h2 className="mt-3 break-all text-lg font-light text-white">{replay.signal.resource}</h2>
        </div>
        <span className={`w-fit border px-3 py-2 font-mono text-[10px] uppercase tracking-widest ${outcomeStyle(replay.result.outcome)}`}>{replay.result.outcome.replace('_', ' ')}</span>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Provider signal</p><p className="mt-2 text-sm text-white">{replay.signal.recommendation}</p></div>
        <div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Score range floor</p><p className="mt-2 text-sm text-white">{replay.signal.scoreRangeLow} / required {replay.policy.minScoreRangeLow}</p></div>
        <div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Confidence</p><p className="mt-2 text-sm text-white">{replay.signal.confidence.toFixed(2)} / required {replay.policy.minConfidence.toFixed(2)}</p></div>
        <div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Evidence age</p><p className="mt-2 text-sm text-white">{replay.signal.observedAgeSeconds}s / maximum {replay.policy.maxAgeSeconds}s</p></div>
      </div>

      <div className={`mt-5 border p-5 ${outcomeStyle(replay.result.outcome)}`}>
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-70">Deterministic next action</p>
        <p className="mt-2 text-base">{actionLabel(replay.result.nextAction)}</p>
        <p className="mt-2 font-mono text-[10px] opacity-75">{replay.result.reasonCodes.join(' · ')}</p>
        <X402TrustEvidenceLink scenarioId={replay.downloadId} href={`/api/x402-trust/replay/${replay.downloadId}`} download className="mt-4 inline-block border border-current px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-white/5">Download metadata-only evidence ↓</X402TrustEvidenceLink>
      </div>

      <X402TrustScenarioDetails scenarioId={replay.downloadId} className="mt-5 border-t border-zinc-800 pt-5 text-xs text-zinc-500">
        <summary className="cursor-pointer font-mono uppercase tracking-widest text-zinc-300">Integrity evidence</summary>
        <dl className="mt-4 space-y-3 break-all font-mono">
          <div><dt className="text-zinc-600">Frozen fixture</dt><dd className="mt-1">{replay.fixtureSha256}</dd></div>
          <div><dt className="text-zinc-600">Replayed input</dt><dd className="mt-1">{replay.result.replayedInputSha256}</dd></div>
          <div><dt className="text-zinc-600">Frozen at</dt><dd className="mt-1">{replay.frozenAt}</dd></div>
          <div><dt className="text-zinc-600">Validation</dt><dd className="mt-1">JSON Schema: pass · semantic invariants: pass</dd></div>
          <div><dt className="text-zinc-600">Payment authorization</dt><dd className="mt-1">{String(replay.result.paymentAuthorized)} — evaluated by a separate buyer policy</dd></div>
        </dl>
      </X402TrustScenarioDetails>
    </article>
  )
}

export default function X402TrustReplayPage() {
  const replays = getPublicX402TrustReplays()
  return (
    <main className="min-h-screen bg-[#080a0d] px-6 py-20 text-zinc-300 sm:py-28">
      <X402TrustDemoStart />
      <div className="mx-auto max-w-6xl">
        <header className="max-w-4xl border-l border-cyan-600 pl-6 sm:pl-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ x402 Trust policy replay ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">See the policy boundary without trusting a live score.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-400">Three frozen synthetic reports are validated against the pinned provider schema, checked against Maha’s semantic invariants, and mapped into deterministic advisory actions.</p>
          <div className="mt-8 flex flex-wrap gap-5 font-mono text-xs uppercase tracking-widest">
            <Link href="/x402-buyer-policy" className="text-cyan-100 underline underline-offset-4 hover:text-white">Inspect the independent buyer policy ↗</Link>
            <Link href="/x402-observatory" className="text-zinc-300 underline underline-offset-4 hover:text-white">Inspect seller conformance ↗</Link>
          </div>
        </header>

        <section className="mt-14 grid gap-4 border-y border-zinc-800 py-8 sm:grid-cols-3" aria-label="Replay safety boundary">
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Read only</p><p className="mt-3 text-sm leading-6 text-zinc-400">No live fetch, arbitrary URL, form submission, task creation, signature, or settlement occurs.</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Advisory only</p><p className="mt-3 text-sm leading-6 text-zinc-400">Proceed means continue to Maha’s separate buyer policy. It never means pay.</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-300">Synthetic fixtures</p><p className="mt-3 text-sm leading-6 text-zinc-400">These examples are protocol tests, not current observations, ratings, or endorsements of merchants.</p></div>
        </section>
        <p className="mt-4 text-xs leading-5 text-zinc-600">Cookie-free aggregate telemetry records only demo started, integrity evidence opened, evidence downloaded, and integration requested. It stores no visitor identifier, report content, evidence body, credential, wallet, or payment material.</p>

        <section className="mt-12 space-y-5" aria-label="Frozen x402 Trust action replays">
          {replays.map((replay) => <ReplayCard key={replay.fixtureId} replay={replay} />)}
        </section>

        <section className="mt-16 border-t border-zinc-800 pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ What this establishes ]</p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">The replay establishes that reviewed inputs produce stable actions under one pinned adapter and policy version. It does not establish that x402 Trust is correct, that a live endpoint is safe, or that any payment should be signed.</p>
          <X402TrustIntegrationLink href="/contact?service=x402-trust-integration" className="mt-6 inline-block border border-cyan-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-cyan-100 hover:border-cyan-400 hover:text-white">Request a bounded integration ↗</X402TrustIntegrationLink>
        </section>
      </div>
    </main>
  )
}
