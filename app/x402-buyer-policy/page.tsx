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
    <main className="min-h-screen bg-[#080a0d] px-6 py-20 text-zinc-300 sm:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd).replace(/</g, '\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <header className="max-w-4xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-indigo-300">[ Open x402 buyer controls ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">A wallet should be the last gate, not the first.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-400">A zero-dependency reference library that decides whether an agent may pay before any signature—and verifies what settled afterward. It is policy infrastructure, not a wallet or facilitator.</p>
          <div className="mt-8 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
            <a href="https://github.com/Maha-Strategies/maha-corp-web/tree/main/packages/x402-buyer-policy" target="_blank" rel="noopener noreferrer" className="border border-indigo-700 px-4 py-3 text-indigo-100 hover:bg-indigo-950/40">Inspect source package ↗</a>
            <a href="/schemas/x402-buyer-policy-1.0.0.json" className="px-4 py-3 text-zinc-300 underline underline-offset-4 hover:text-white">Policy JSON Schema ↗</a>
            <a href="/x402/buyer-policy.example.json" className="px-4 py-3 text-zinc-300 underline underline-offset-4 hover:text-white">Example policy ↗</a>
          </div>
        </header>

        <section className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Buyer policy controls">
          {controls.map(([name, detail]) => <article key={name} className="border border-zinc-800 bg-zinc-950/40 p-6"><h2 className="text-lg text-white">{name}</h2><p className="mt-3 text-sm leading-7 text-zinc-400">{detail}</p></article>)}
        </section>

        <section className="mt-16 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Pre-signing boundary ]</p>
            <h2 className="mt-4 text-3xl font-light text-white">One decision before custody is touched.</h2>
            <p className="mt-5 text-sm leading-7 text-zinc-400">The policy returns structured allow, deny, or approval-required codes. A caller invokes its Viem, CDP, LangChain.js, or MCP signing adapter only after an allow decision and atomic budget reservation.</p>
          </div>
          <pre className="overflow-x-auto border border-zinc-800 bg-black/50 p-5 text-xs leading-6 text-zinc-300"><code>{policyExample}</code></pre>
        </section>

        <section className="mt-16 border-y border-zinc-800 py-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Honest integration boundary ]</p>
          <h2 className="mt-4 text-2xl font-light text-white">Framework-neutral does not mean framework-magical.</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">LangChain.js, MCP TypeScript clients, and Viem can call the package directly. Python LangChain and CrewAI applications can enforce the same public JSON contract at their wallet boundary; this release does not claim to be a native Python package. Production deployments must replace the included single-process reference ledger with an atomic shared store.</p>
        </section>

        <section className="mt-14 flex flex-wrap gap-5 font-mono text-xs uppercase tracking-widest">
          <Link href="/recipes/bazaar-discovery-to-payment" className="text-indigo-100 underline underline-offset-4 hover:text-white">Run the discovery-to-payment recipe ↗</Link>
          <Link href="/x402-observatory" className="text-zinc-300 underline underline-offset-4 hover:text-white">Inspect seller conformance ↗</Link>
          <Link href="/developers" className="text-zinc-300 underline underline-offset-4 hover:text-white">Developer infrastructure ↗</Link>
        </section>
      </div>
    </main>
  )
}
