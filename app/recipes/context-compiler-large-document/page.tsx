import type { Metadata } from 'next'
import Link from 'next/link'

import measurement from '@/content/recipes/context-compiler-large-document-result.json'

const SITE_URL = 'https://www.mahastrategies.com'
const PAGE_PATH = '/recipes/context-compiler-large-document'
const SOURCE_URL = 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/scripts/run-context-compiler-agent-recipe.ts'
const title = 'Large-Document Context Compression Agent Recipe | Maha Strategies'
const description = 'Reproduce a 106 KB Context Compiler workload, measure BPE token reduction and source coverage, and compare the result with the $0.001 x402 fee.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}${PAGE_PATH}`,
    siteName: 'Maha Strategies',
    title,
    description,
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Context Compiler large-document recipe' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-master.png'] },
}

const localCommand = 'npm run recipe:context-compiler'
const liveCommand = 'npm run recipe:context-compiler:live'

export default function ContextCompilerLargeDocumentRecipePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    datePublished: measurement.measuredOn,
    dateModified: measurement.measuredOn,
    url: `${SITE_URL}${PAGE_PATH}`,
    author: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
    about: {
      '@type': 'SoftwareApplication',
      name: 'Maha Context Compiler',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web API',
    },
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Executable agent recipe</span><span>Measured workload</span>
          </p>
          <h1 className="evidence-title evidence-title--product">Compress four real chapters before the model call.</h1>
          <p className="evidence-lede mt-7">This checked-in recipe compiles four complete, published Maha Strategies book chapters for one comparative-analysis task. It reports real BPE token counts, the API&apos;s source-coverage metric, and input-token economics against the production <span className="font-mono">0.001 USDC</span> x402 fee.</p>
        </header>

        <section className="evidence-section" aria-label="Measured recipe results">
          <p className="evidence-kicker">Measured</p>
          <h2 className="evidence-section-title mt-4">What the run produced.</h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Raw workload" value={`${measurement.workload.inputTokensBpe.toLocaleString()} tokens`} detail={`${measurement.workload.inputBytes.toLocaleString()} bytes across ${measurement.workload.sourceCount} sources`} />
            <Metric label="Compiled pack" value={`${measurement.result.compiledTokensBpe.toLocaleString()} tokens`} detail={`${measurement.result.savedTokensBpe.toLocaleString()} BPE input tokens removed`} />
            <Metric label="Reduction" value={`${measurement.result.reductionPercent}%`} detail={`Fixed ${measurement.workload.tokenBudget.toLocaleString()}-token requested budget`} />
            <Metric label="Source coverage" value={`${measurement.result.sourceCoveragePercent}%`} detail={`${measurement.result.includedSourceCount}/${measurement.workload.sourceCount} sources contributed at least one passage`} />
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="economics">
          <div className="evidence-inset">
            <p className="evidence-kicker">Declared economic assumption</p>
            <h2 id="economics" className="evidence-section-title mt-4">${measurement.economics.grossInputCostAvoidedUsd.toFixed(6)} gross input cost avoided at a $3/M reference rate.</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <Economic label="x402 fee" value={`$${measurement.economics.x402FeeUsd.toFixed(3)}`} />
              <Economic label="Net input cost avoided" value={`$${measurement.economics.netInputCostAvoidedUsd.toFixed(6)}`} />
              <Economic label="Gross saving / fee" value={`${measurement.economics.grossSavingsToFeeMultiple.toFixed(2)}×`} />
            </div>
            <p className="evidence-copy mt-7">This is not a universal savings claim. It compares one raw-input model call with one compiled-input model call at the explicitly declared reference rate. It excludes output-token cost from both alternatives, network latency, and any downstream call required to evaluate answer quality. Override the rate when reproducing the run.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="run-recipe">
          <p className="evidence-kicker">Run it</p>
          <h2 id="run-recipe" className="evidence-section-title mt-4">Measure locally first. Pay only when you choose live mode.</h2>
          <div className="mt-9 grid gap-5 lg:grid-cols-2">
            <Command title="1. Reproduce without payment" command={localCommand} detail="Runs the exact compiler implementation against the committed chapters. No key, network request, or payment is used." />
            <Command title="2. Exercise production x402" command={liveCommand} detail="Requires X402_BUYER_PRIVATE_KEY in the process environment. It signs and settles exactly one production payment on Base Mainnet." />
          </div>
          <div className="evidence-inset mt-7" style={{ borderLeftColor: 'var(--status-boundary)' }}>
            <p className="evidence-copy">Use a dedicated, limited-balance test wallet. Never commit a private key or paste it into source code. Live mode is deliberately opt-in and cannot run without the environment variable.</p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="evidence-action evidence-action--primary">Inspect executable source ↗</a>
            <Link href="/context-compiler" className="evidence-action evidence-action--secondary">Context Compiler contract ↗</Link>
            <a href="https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp" className="evidence-action evidence-action--secondary" target="_blank" rel="noopener noreferrer">Bazaar MCP endpoint ↗</a>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="interpretation">
          <p className="evidence-kicker">Boundaries</p>
          <h2 id="interpretation" className="evidence-section-title mt-4">What the measurement does&mdash;and does not&mdash;establish</h2>
          <ul className="evidence-copy mt-7 flex list-none flex-col gap-4 p-0">
            <li><strong className="text-[var(--text-primary)]">Real workload:</strong> the inputs are complete chapters already published in this repository, not generated filler or a simulated token count.</li>
            <li><strong className="text-[var(--text-primary)]">Exact reproduction:</strong> committed input and output hashes make corpus or compiler drift visible in the regression test.</li>
            <li><strong className="text-[var(--text-primary)]">Coverage boundary:</strong> 100% source coverage means every source contributed at least one passage. It does not mean every fact or passage survived.</li>
            <li><strong className="text-[var(--text-primary)]">Quality boundary:</strong> the recipe measures selection and economics, not whether a downstream model produces a correct or complete answer.</li>
          </ul>
          <p className="evidence-kicker mt-8 break-all normal-case tracking-normal">input {measurement.result.inputHash}<br />output {measurement.result.outputHash}</p>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="evidence-card">
      <p className="evidence-kicker">{label}</p>
      <p className="mt-3 font-mono text-2xl text-[var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p className="evidence-card-copy mt-3">{detail}</p>
    </article>
  )
}

function Economic({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="evidence-kicker">{label}</p>
      <p className="mt-2 font-mono text-xl text-[var(--status-verified)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

function Command({ title, command, detail }: { title: string; command: string; detail: string }) {
  return (
    <article className="evidence-card">
      <h3 className="evidence-card-title">{title}</h3>
      <pre className="evidence-code mt-4 overflow-x-auto p-4 font-mono text-xs"><code>{command}</code></pre>
      <p className="evidence-card-copy mt-4">{detail}</p>
    </article>
  )
}
