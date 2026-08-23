import type { Metadata } from 'next'

import { COMPATIBILITY_PACK_CONTRACT, COMPATIBILITY_PACK_SAMPLE_REPORT } from '@/lib/agent-infrastructure-compatibility-pack'

export const metadata: Metadata = {
  title: 'Agent Infrastructure Compatibility Pack | Maha Strategies',
  description: 'A fixed-price, evidence-backed compatibility assessment for one A2A agent, one MCP server and their policy and payment boundary.',
  alternates: { canonical: '/agent-infrastructure-compatibility-pack' },
  openGraph: { title: 'Agent Infrastructure Compatibility Pack', description: 'One A2A agent. One MCP server. One bounded compatibility report.', url: '/agent-infrastructure-compatibility-pack', type: 'website' },
}

const contractUrl = '/api/discovery/agent-infrastructure-compatibility-pack'

export default function AgentInfrastructureCompatibilityPackPage() {
  const sample = COMPATIBILITY_PACK_SAMPLE_REPORT
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Service', name: COMPATIBILITY_PACK_CONTRACT.name,
    description: COMPATIBILITY_PACK_CONTRACT.description, provider: { '@type': 'Organization', name: 'Maha Strategies LLC' },
    offers: { '@type': 'Offer', price: '49.00', priceCurrency: 'USD', availability: 'https://schema.org/PreOrder', url: 'https://www.mahastrategies.com/agent-infrastructure-compatibility-pack' },
  }
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Machine product</span><span>Contract v{COMPATIBILITY_PACK_CONTRACT.version}</span>
          </p>
          <h1 className="evidence-title evidence-title--product">One agent. One tool server. One compatibility verdict you can inspect.</h1>
          <p className="evidence-lede mt-7">The Agent Infrastructure Compatibility Pack exercises one A2A agent and one MCP server against caller-declared tool, task and payment policy. It returns source-linked, hashed findings&mdash;not a generic market report or a certification badge.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a className="evidence-action evidence-action--primary" href={contractUrl}>Machine contract ↗</a>
            <a className="evidence-action evidence-action--secondary" href={`${contractUrl}/sample`}>Sample JSON report ↗</a>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="scope-heading">
          <p className="evidence-kicker">Scope</p>
          <h2 id="scope-heading" className="evidence-section-title mt-4">Fixed price, bounded scope.</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <Card label="Fixed price" value="49.00 USDC" text="Base Mainnet, 49,000,000 base units. The live challenge will be authoritative once payment is promoted." />
            <Card label="Bounded scope" value="1 A2A + 1 MCP" text="One declared non-mutating skill and tool. JSON-RPC only. No open-ended scanning." />
            <Card label="Current status" value="Contract published" text="Payment remains withheld until durable delivery and automatic refund recovery pass Production E2E." />
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="answers-heading">
          <p className="evidence-kicker">The report</p>
          <h2 id="answers-heading" className="evidence-section-title mt-4">What the report answers</h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            <Card label="Identity & protocol" value="Discovery bound" text="Agent Card, RPC URL, tools/list inventory, declared methods and schema evidence are captured with timestamps and hashes." />
            <Card label="Policy" value="Allowlist enforced" text="The selected skill, tool, methods, timeout and per-call/task payment ceilings are evaluated without silently broadening policy." />
            <Card label="Payment" value="Challenge inspected" text="Network, asset, payee and amount are compared with policy. Maha never holds the buyer key or settles an upstream payment." />
            <Card label="Auditability" value="Evidence attached" text="Every finding carries a bounded observation, source URL, observed time and SHA-256 digest." />
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="sample-heading">
          <p className="evidence-kicker">Worked example</p>
          <h2 id="sample-heading" className="evidence-section-title mt-4">Sample decision: {sample.decision.replaceAll('_', ' ')}</h2>
          <p className="evidence-kicker mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <span>{sample.summary.passed} passed</span>
            <span>{sample.summary.failed} failed</span>
            <span>{sample.summary.notChecked} not checked</span>
            <span>Highest severity {sample.summary.highestSeverity}</span>
          </p>
          <div className="mt-7 flex flex-col gap-4">
            {sample.checks.map((check) => (
              <article key={check.id} className="border-l-2 border-[var(--status-sourced)] pl-4">
                <p className="evidence-kicker">{check.layer} — {check.status}</p>
                <p className="evidence-card-copy mt-2">{check.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="behaviour-heading">
          <p className="evidence-kicker">Boundaries</p>
          <h2 id="behaviour-heading" className="evidence-section-title mt-4">Failure, refund, and limitations</h2>
          <div className="mt-9 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="evidence-card-title">Failure and refund behavior</h3>
              <ul className="evidence-copy mt-4 flex list-none flex-col gap-3 p-0">
                <li><strong className="text-[var(--text-primary)]">No charge:</strong> invalid schema, unsafe target, unreachable preflight target, or unsupported authentication.</li>
                <li><strong className="text-[var(--text-primary)]">Report, no refund:</strong> incompatibility, policy rejection, target timeout/error, or payment terms outside policy. Those are the findings purchased.</li>
                <li><strong className="text-[var(--text-primary)]">Full automatic refund:</strong> Maha fails after settlement, cannot confirm durable report storage, or misses the delivery target.</li>
                <li><strong className="text-[var(--text-primary)]">No duplicate charge:</strong> retries bind clientRequestId to the input hash and return the original report.</li>
              </ul>
            </div>
            <div>
              <h3 className="evidence-card-title">Limitations</h3>
              <ul className="evidence-copy mt-4 flex list-disc flex-col gap-2 pl-5">
                {COMPATIBILITY_PACK_CONTRACT.limitations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function Card({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <article className="evidence-card">
      <p className="evidence-kicker">{label}</p>
      <p className="evidence-card-title mt-3">{value}</p>
      <p className="evidence-card-copy mt-3">{text}</p>
    </article>
  )
}
