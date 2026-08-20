import type { Metadata } from 'next'
import Link from 'next/link'

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
    href: 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/content/integrations/wso2-sanitized-three-path-trace.json',
    label: 'Sanitized three-path trace',
  },
  {
    href: 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/docs/integrations/wso2-context-interceptor.md',
    label: 'Technical integration notes',
  },
] as const

const resultRows = [
  { path: 'WSO2 baseline', tokens: '1,621,553', cost: '$1.632963', factResult: '60 / 60' },
  { path: 'WSO2 Prompt Compressor', tokens: '1,489,323', cost: '$1.505248', factResult: '0 / 60*' },
  { path: 'WSO2 + Maha', tokens: '18,849', cost: '$0.029379', factResult: '60 / 60' },
] as const

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
            In a 60-call comparison over 20 frozen, synthetic 20K–100K-token workloads, the Maha path reduced provider input tokens by 98.84% and observed model cost by 98.20% relative to baseline. All calls completed without retries or failures.
          </p>
          <div className="mt-7 overflow-x-auto border border-[var(--border-default)] bg-[var(--surface-raised)]">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                <tr>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Path</th>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Provider input tokens</th>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Observed model cost</th>
                  <th className="border-b border-[var(--border-default)] p-4 font-semibold">Required facts retained</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                {resultRows.map((row) => (
                  <tr key={row.path}>
                    <th className="border-b border-[var(--border-subtle)] p-4 font-medium text-[var(--text-primary)]">{row.path}</th>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-mono text-xs">{row.tokens}</td>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-mono text-xs">{row.cost}</td>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-mono text-xs">{row.factResult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">
            *The Prompt Compressor result is specific to WSO2 AI Gateway 1.1.0, Prompt Compressor 0.9.0, and a 0.55 retained ratio. It should not be generalized before WSO2 or a customer confirms that configuration reflects the intended production setup. Provider pricing assumptions and the full frozen configuration are recorded in the reproduction manifest.
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
