import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'

const title = 'x402 Buyer Policy Reference Library | Maha Strategies'
const description = 'An open, vendor-neutral policy layer for x402 agent budgets, allowlists, human approvals, replay controls, and settlement verification.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/x402-buyer-policy' },
  openGraph: { type: 'website', url: `${MAHA_SITE_URL}/x402-buyer-policy`, title, description },
}

const policyExample = `const decision = await authorizePayment({
  policy,
  ledger,
  intent: {
    taskId: runId,
    authorizationId: transferAuthorization.nonce,
    requestedResource: targetUrl,
    declaredResource: challenge.resource.url,
    requirement,
    schema: { status: doctorReport.ok ? 'valid' : 'invalid' },
  },
})

if (!decision.allowed) {
  throw new Error(\`${'${decision.code}'}: ${'${decision.message}'}\`)
}

// The wallet signer is invoked only after the policy allows and reserves.`

const controls = [
  ['Per-call and per-task ceilings', 'Integer base-unit limits are evaluated before signing; a shared ledger reserves task spend atomically.'],
  ['Explicit allowlists', 'Scheme, CAIP-2 network, asset, payee, and exact HTTPS resource must all match.'],
  ['Schema prerequisite', 'The caller must supply valid schema evidence from x402-doctor or another validator.'],
  ['Scoped human approval', 'Approval binds policy, task, resource, network, asset, payee, maximum amount, and expiry.'],
  ['Replay controls', 'Authorization identities and successful settlement transactions are independently claimed once.'],
  ['Settlement evidence', 'PAYMENT-RESPONSE is bound to network and payer; optional chain evidence binds token, payer, payee, and amount.'],
] as const

export default function X402BuyerPolicyPage() {
  const softwareJsonLd = {
    '@context': 'https://schema.org', '@type': 'SoftwareSourceCode',
    name: '@mahastrategies/x402-buyer-policy', description,
    codeRepository: 'https://github.com/Maha-Strategies/maha-corp-web/tree/main/packages/x402-buyer-policy',
    programmingLanguage: 'TypeScript', license: 'https://www.apache.org/licenses/LICENSE-2.0',
    runtimePlatform: 'Node.js, Bun, Deno, browsers, and JavaScript agent runtimes',
  }
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd).replace(/</g, '\u003c') }} />
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Open x402 buyer controls</span><span>Policy infrastructure</span>
          </p>
          <h1 className="evidence-title evidence-title--product">A wallet should be the last gate, not the first.</h1>
          <p className="evidence-lede mt-7">A zero-dependency reference library that decides whether an agent may pay before any signature&mdash;and verifies what settled afterward. It is policy infrastructure, not a wallet or facilitator.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="https://github.com/Maha-Strategies/maha-corp-web/tree/main/packages/x402-buyer-policy" target="_blank" rel="noopener noreferrer" className="evidence-action evidence-action--primary">Inspect source package ↗</a>
            <a href="/schemas/x402-buyer-policy-1.0.0.json" className="evidence-action evidence-action--secondary">Policy JSON Schema ↗</a>
            <a href="/x402/buyer-policy.example.json" className="evidence-action evidence-action--secondary">Example policy ↗</a>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="controls-heading">
          <p className="evidence-kicker">Buyer policy controls</p>
          <h2 id="controls-heading" className="evidence-section-title mt-4">What the policy decides.</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {controls.map(([name, detail]) => (
              <article key={name} className="evidence-card">
                <h3 className="evidence-card-title">{name}</h3>
                <p className="evidence-card-copy mt-3">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="boundary-heading">
          <p className="evidence-kicker">Pre-signing boundary</p>
          <h2 id="boundary-heading" className="evidence-section-title mt-4">One decision before custody is touched.</h2>
          <div className="mt-9 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <p className="evidence-copy">The policy returns structured allow, deny, or approval-required codes. A caller invokes its Viem, CDP, LangChain.js, or MCP signing adapter only after an allow decision and atomic budget reservation.</p>
            <pre className="evidence-code overflow-x-auto p-5 text-xs leading-6"><code>{policyExample}</code></pre>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="integration-heading">
          <div className="evidence-inset" style={{ borderLeftColor: 'var(--status-boundary)' }}>
            <p className="evidence-kicker">Honest integration boundary</p>
            <h2 id="integration-heading" className="evidence-section-title mt-4">Framework-neutral does not mean framework-magical.</h2>
            <p className="evidence-copy mt-5">LangChain.js, MCP TypeScript clients, and Viem can call the package directly. Python LangChain and CrewAI applications can enforce the same public JSON contract at their wallet boundary; this release does not claim to be a native Python package. Production deployments must replace the included single-process reference ledger with an atomic shared store.</p>
          </div>
        </section>

        <section className="evidence-section">
          <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-widest">
            <Link href="/recipes/bazaar-discovery-to-payment" className="evidence-link">Run the discovery-to-payment recipe ↗</Link>
            <Link href="/x402-observatory" className="evidence-link">Inspect seller conformance ↗</Link>
            <Link href="/developers" className="evidence-link">Developer infrastructure ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
