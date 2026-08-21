import type { Metadata } from 'next'
import Link from 'next/link'

import {
  WSO2_LIVE_EVIDENCE_PATH,
  loadWso2LiveEvidence,
  sha256File,
} from '@/lib/integrations/wso2-live-evidence'

export const metadata: Metadata = {
  title: 'Maha Context Compiler for WSO2 AI Gateway',
  description: 'A bounded, reproducible evaluation of source-linked context reduction inside an existing WSO2 AI Gateway deployment.',
  alternates: { canonical: '/integrations/wso2' },
}

const evidenceLinks = [
  {
    href: 'https://github.com/Maha-Strategies/maha-corp-web/tree/main/content/integrations/wso2-policy-bundle',
    label: 'Evaluation policy bundle',
  },
  {
    href: 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/content/integrations/wso2-reproduction.json',
    label: 'Frozen reproduction manifest',
  },
  {
    href: 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/content/integrations/wso2-live-evaluation-evidence.json',
    label: 'Per-workload evidence artifact (all 20 workloads)',
  },
  {
    href: 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/content/integrations/wso2-sanitized-three-path-trace.json',
    label: 'Sanitized trace, one representative workload',
  },
  {
    href: 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/docs/integrations/wso2-context-interceptor.md',
    label: 'Technical integration notes',
  },
] as const

// Every number in the results table is read from the committed evidence
// artifact and re-derived from its per-workload rows at load time. Editing a
// headline figure here is not possible: there is no figure here to edit, and
// the artifact's own parser rejects a total that disagrees with its rows.
const evidence = loadWso2LiveEvidence()
const evidenceSha256 = sha256File(WSO2_LIVE_EVIDENCE_PATH)

const pathLabels = {
  'wso2-baseline': 'WSO2 baseline',
  'wso2-native-prompt-compressor': 'WSO2 Prompt Compressor',
  'wso2-maha-context-compiler': 'WSO2 + Maha',
} as const

const resultRows = (Object.keys(pathLabels) as (keyof typeof pathLabels)[]).map((path) => {
  const aggregate = evidence.aggregates[path]
  return {
    path: pathLabels[path],
    tokens: aggregate.providerInputTokens.toLocaleString('en-US'),
    cost: `$${aggregate.costUsd}`,
    factResult: `${aggregate.adjudicatedFacts.answered} / ${aggregate.adjudicatedFacts.total}${path === 'wso2-native-prompt-compressor' ? '*' : ''}`,
    latency: `${aggregate.latencyMs.p50.toLocaleString('en-US')} ms`,
  }
})

const callCount = evidence.workloads.length * Object.keys(pathLabels).length

export default function Wso2IntegrationPage() {
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Maha Context Compiler for WSO2 AI Gateway — bounded evaluation',
    provider: {
      '@type': 'Organization',
      name: 'Maha Strategies LLC',
      url: 'https://www.mahastrategies.com',
    },
    description: 'A fixed-scope compatibility evaluation of Maha Context Compiler as a WSO2 AI Gateway request interceptor.',
    offers: {
      '@type': 'Offer',
      price: '5000',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://www.mahastrategies.com/integrations/wso2',
    },
  }

  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Independent WSO2 compatibility</span>
            <span>Fixed-scope evaluation · $5,000</span>
          </p>
          <h1 className="evidence-title evidence-title--product">Reduce AI context inside WSO2. Keep the evidence path.</h1>
          <p className="evidence-lede mt-7">
            Evaluate Maha Context Compiler as a fail-closed request interceptor in an existing WSO2 AI Gateway deployment—without replacing WSO2 as the enterprise gateway and control plane.
          </p>
          <p className="evidence-copy mt-5">
            The pilot measures provider input tokens, required-fact retention, citation traceability, latency, failure behavior, and model cost against a customer-shaped workload. It returns a private evidence package and a recommendation to proceed, revise, or stop.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              className="evidence-action evidence-action--primary"
              href="mailto:mayone@mahastrategies.com?subject=WSO2%20Context%20Compiler%20evaluation"
            >
              Request a bounded evaluation ↗
            </a>
            <a
              className="evidence-action evidence-action--secondary"
              href="https://github.com/Maha-Strategies/maha-corp-web/tree/main/content/integrations/wso2-policy-bundle"
              target="_blank"
              rel="noreferrer"
            >
              Inspect the bundle ↗
            </a>
          </div>
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="Pilot scope">
          <Card label="01 · Install" body="Configure an evaluation-only, fail-closed interceptor path alongside the existing WSO2 baseline and Prompt Compressor path." />
          <Card label="02 · Compare" body="Run one agreed workload through all three paths with a frozen configuration, explicit cost ceiling, and no automatic retries." />
          <Card label="03 · Decide" body="Deliver aggregate results, sanitized traces, failure-path evidence, limitations, and a production-readiness recommendation." />
        </section>

        <section className="evidence-section" aria-labelledby="observed-results-heading">
          <p className="evidence-kicker">Preliminary observed result</p>
          <h2 id="observed-results-heading" className="evidence-section-title mt-4">A reason to evaluate—not a universal performance claim.</h2>
          <p className="evidence-copy mt-5">
            In a {callCount}-call comparison over {evidence.workloads.length} frozen, synthetic 20K–100K-token workloads, run once on {evidence.observedAt.slice(0, 10)}, the Maha path reduced provider input tokens by {evidence.comparison.inputTokenReductionPercent}% and observed model cost by {evidence.comparison.costReductionPercent}% relative to baseline. All {callCount} calls completed without retries or failures.
          </p>
          <div className="mt-7 overflow-x-auto border border-[var(--border-default)] bg-[var(--surface-raised)]">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                <tr>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Path</th>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Provider input tokens</th>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Observed model cost</th>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Median latency</th>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Required facts retained</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                {resultRows.map((row) => (
                  <tr key={row.path}>
                    <th className="border-b border-[var(--border-subtle)] p-4 font-medium text-[var(--text-primary)]">{row.path}</th>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-mono text-xs">{row.tokens}</td>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-mono text-xs">{row.cost}</td>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-mono text-xs">{row.latency}</td>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-mono text-xs">{row.factResult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">
            *The Prompt Compressor result is specific to WSO2 AI Gateway 1.1.0, Prompt Compressor 0.9.0, and a 0.55 retained ratio. It should not be generalized before WSO2 or a customer confirms that configuration reflects the intended production setup. Provider pricing assumptions and the full frozen configuration are recorded in the reproduction manifest.
          </p>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">
            <strong className="text-[var(--text-secondary)]">Which retention score this is.</strong>{' '}
            &ldquo;Required facts retained&rdquo; above is the path-blinded semantic rubric applied to the returned answers. A second, stricter scorer measures exact evidence-span containment on the same answers and reports{' '}
            {evidence.aggregates['wso2-baseline'].deterministicFacts.answered} / {evidence.aggregates['wso2-baseline'].deterministicFacts.total} for the baseline,{' '}
            {evidence.aggregates['wso2-native-prompt-compressor'].deterministicFacts.answered} / {evidence.aggregates['wso2-native-prompt-compressor'].deterministicFacts.total} for the Prompt Compressor, and{' '}
            {evidence.aggregates['wso2-maha-context-compiler'].deterministicFacts.answered} / {evidence.aggregates['wso2-maha-context-compiler'].deterministicFacts.total} for Maha, because it scores a correct paraphrase as a miss. Both scores are published per workload in the evidence artifact. Latency is one observation per call on a single run, not a percentile over repeated runs.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="pilot-heading">
          <p className="evidence-kicker">Commercial pilot</p>
          <h2 id="pilot-heading" className="evidence-section-title mt-4">One workload. One fixed fee. A decision at the end.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <article className="evidence-card">
              <p className="evidence-card-title">Standard bounded evaluation</p>
              <p className="mt-3 font-mono text-2xl font-semibold text-[var(--text-primary)]">$5,000</p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                <li>• One sanitized, customer-shaped document or RAG workflow</li>
                <li>• Up to 1,000 test requests within an agreed provider-spend ceiling</li>
                <li>• Baseline, WSO2 Prompt Compressor, and Maha comparison</li>
                <li>• Retention, citations, latency, cost, and fail-closed analysis</li>
                <li>• Private findings review and production recommendation</li>
              </ul>
            </article>
            <article className="evidence-card">
              <p className="evidence-card-title">If the result is useful</p>
              <p className="evidence-card-copy mt-4">
                Continue with a hosted request-based plan or an annual private-deployment license. Commercial terms are proposed only after the pilot establishes an actual workload advantage.
              </p>
              <p className="evidence-card-copy mt-5">
                Founding design-partner evaluations may be scoped at $2,500 when the customer can provide structured technical feedback and permits an anonymized integration note.
              </p>
            </article>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="evidence-heading">
          <p className="evidence-kicker">Reproduce before trusting</p>
          <h2 id="evidence-heading" className="evidence-section-title mt-4">The evaluation method is inspectable.</h2>
          <p className="evidence-copy mt-5">
            The public package pins the gateway and policy versions, retained ratio, model, corpus digest, failure behavior, and zero-retry rule. Its default one-command run is a dry run and makes no provider calls.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {evidenceLinks.map((item) => (
              <a key={item.href} className="evidence-card evidence-kicker text-[var(--text-primary)]" href={item.href} target="_blank" rel="noreferrer">
                {item.label} ↗
              </a>
            ))}
          </div>
          <div className="evidence-code mt-6 overflow-x-auto p-5">
            <code className="font-mono text-xs">npm run reproduce:wso2-evaluation</code>
          </div>

          <h3 className="evidence-card-title mt-10">Check the observed result yourself</h3>
          <p className="evidence-copy mt-4">
            The table above is not typed into this page. It is read from a committed artifact that carries every one of the {callCount} calls as its own row, and whose totals are re-derived from those rows each time it is loaded — a hand-edited total fails validation instead of rendering. Verify the artifact you are reading is the one described here:
          </p>
          <div className="evidence-code mt-5 overflow-x-auto p-5">
            <code className="block whitespace-pre font-mono text-xs">{`shasum -a 256 ${WSO2_LIVE_EVIDENCE_PATH}
npm run validate:wso2-live-evidence`}</code>
          </div>
          <dl className="mt-6 space-y-3 text-xs leading-6 text-[var(--text-muted)]">
            <div>
              <dt className="font-mono uppercase tracking-widest text-[10px]">Evidence artifact SHA-256</dt>
              <dd className="mt-1 break-all font-mono text-[var(--text-secondary)]">{evidenceSha256}</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-widest text-[10px]">Frozen corpus label digest</dt>
              <dd className="mt-1 break-all font-mono text-[var(--text-secondary)]">{evidence.corpus.labelFreezeDigest}</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-widest text-[10px]">Source checkpoint SHA-256 (not published)</dt>
              <dd className="mt-1 break-all font-mono text-[var(--text-secondary)]">{evidence.generation.sourceCheckpointSha256}</dd>
            </div>
          </dl>
          <p className="mt-5 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">
            The run&rsquo;s primary evidence — the durable checkpoint and the path-blinded adjudication — is retained outside this repository because both carry the model&rsquo;s answer text for every call. They are identified above by digest so a reviewer under NDA can be handed the exact bytes this artifact was derived from and re-derive it with{' '}
            <span className="font-mono">npm run generate:wso2-live-evidence</span>. The sanitized single-workload trace remains published separately: it is one representative call, not evidence for the aggregate.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="boundaries-heading">
          <div className="border-l-[3px] border-[var(--status-boundary)] bg-[rgba(160,111,20,0.08)] p-6 sm:p-8">
            <p className="evidence-kicker text-[var(--status-boundary)]">Declared boundaries</p>
            <h2 id="boundaries-heading" className="evidence-section-title mt-4 text-2xl">Independent compatibility work, not a WSO2 endorsement.</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
              <li>• Maha Strategies is not claiming WSO2 partnership, certification, approval, or customer validation.</li>
              <li>• The published benchmark corpus is synthetic; the pilot exists to test whether the result survives a realistic customer workload.</li>
              <li>• The public policy bundle is evaluation-only. Production requires a reviewed gateway-side secret reference, service identity, mTLS, or equivalent interceptor authentication.</li>
              <li>• No fixed compression, savings, retention, or latency result is promised before measurement.</li>
            </ul>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="cta-heading">
          <p className="evidence-kicker">Start with evidence</p>
          <h2 id="cta-heading" className="evidence-section-title mt-4">Bring one expensive or audit-sensitive context workflow.</h2>
          <p className="evidence-copy mt-5">
            Send the approximate input size, request volume, current WSO2 AI Gateway version, and the facts or citations that must survive. Maha will reply with a bounded scope—or say plainly if the workflow is not a fit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="evidence-action evidence-action--primary" href="mailto:mayone@mahastrategies.com?subject=WSO2%20Context%20Compiler%20evaluation">Email Mayone ↗</a>
            <Link className="evidence-action evidence-action--secondary" href="/context-compiler">Review Context Compiler ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}

function Card({ label, body }: { label: string; body: string }) {
  return (
    <article className="evidence-card">
      <p className="evidence-kicker">{label}</p>
      <p className="evidence-card-copy mt-4">{body}</p>
    </article>
  )
}
