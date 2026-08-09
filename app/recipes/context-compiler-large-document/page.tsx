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
    <main className="min-h-screen bg-[#070a0d] text-zinc-300 selection:bg-cyan-400 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <header className="max-w-4xl border-l border-cyan-500 pl-6 sm:pl-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ Executable agent recipe // measured workload ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight text-white sm:text-6xl">Compress four real chapters before the model call.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">This checked-in recipe compiles four complete, published Maha Strategies book chapters for one comparative-analysis task. It reports real BPE token counts, the API&apos;s source-coverage metric, and input-token economics against the production <span className="font-mono text-cyan-200">0.001 USDC</span> x402 fee.</p>
        </header>

        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Measured recipe results">
          <Metric label="Raw workload" value={`${measurement.workload.inputTokensBpe.toLocaleString()} tokens`} detail={`${measurement.workload.inputBytes.toLocaleString()} bytes across ${measurement.workload.sourceCount} sources`} />
          <Metric label="Compiled pack" value={`${measurement.result.compiledTokensBpe.toLocaleString()} tokens`} detail={`${measurement.result.savedTokensBpe.toLocaleString()} BPE input tokens removed`} />
          <Metric label="Reduction" value={`${measurement.result.reductionPercent}%`} detail={`Fixed ${measurement.workload.tokenBudget.toLocaleString()}-token requested budget`} />
          <Metric label="Source coverage" value={`${measurement.result.sourceCoveragePercent}%`} detail={`${measurement.result.includedSourceCount}/${measurement.workload.sourceCount} sources contributed at least one passage`} />
        </section>

        <section className="mt-12 border border-emerald-900 bg-emerald-950/10 p-7 sm:p-9" aria-labelledby="economics">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Declared economic assumption ]</p>
          <h2 id="economics" className="mt-4 text-3xl font-light text-white">${measurement.economics.grossInputCostAvoidedUsd.toFixed(6)} gross input cost avoided at a $3/M reference rate.</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            <Economic label="x402 fee" value={`$${measurement.economics.x402FeeUsd.toFixed(3)}`} />
            <Economic label="Net input cost avoided" value={`$${measurement.economics.netInputCostAvoidedUsd.toFixed(6)}`} />
            <Economic label="Gross saving / fee" value={`${measurement.economics.grossSavingsToFeeMultiple.toFixed(2)}×`} />
          </div>
          <p className="mt-7 text-xs leading-6 text-zinc-500">This is not a universal savings claim. It compares one raw-input model call with one compiled-input model call at the explicitly declared reference rate. It excludes output-token cost from both alternatives, network latency, and any downstream call required to evaluate answer quality. Override the rate when reproducing the run.</p>
        </section>

        <section className="mt-14" aria-labelledby="run-recipe">
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Run it ]</p>
          <h2 id="run-recipe" className="mt-4 text-3xl font-light text-white">Measure locally first. Pay only when you choose live mode.</h2>
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <Command title="1. Reproduce without payment" command={localCommand} detail="Runs the exact compiler implementation against the committed chapters. No key, network request, or payment is used." />
            <Command title="2. Exercise production x402" command={liveCommand} detail="Requires X402_BUYER_PRIVATE_KEY in the process environment. It signs and settles exactly one production payment on Base Mainnet." />
          </div>
          <div className="mt-6 border border-amber-900 bg-amber-950/10 p-5 text-sm leading-7 text-amber-100/80">
            Use a dedicated, limited-balance test wallet. Never commit a private key or paste it into source code. Live mode is deliberately opt-in and cannot run without the environment variable.
          </div>
          <div className="mt-7 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200">Inspect executable source ↗</a>
            <Link href="/context-compiler" className="border border-cyan-800 px-5 py-3 text-cyan-100 hover:bg-cyan-950/30">Context Compiler contract ↗</Link>
            <a href="https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp" className="border border-zinc-700 px-5 py-3 text-zinc-300 hover:border-zinc-500" target="_blank" rel="noopener noreferrer">Bazaar MCP endpoint ↗</a>
          </div>
        </section>

        <section className="mt-14 border-t border-zinc-800 pt-10" aria-labelledby="interpretation">
          <h2 id="interpretation" className="text-2xl text-white">What the measurement does—and does not—establish</h2>
          <ul className="mt-6 space-y-4 text-sm leading-7 text-zinc-400">
            <li><strong className="text-zinc-200">Real workload:</strong> the inputs are complete chapters already published in this repository, not generated filler or a simulated token count.</li>
            <li><strong className="text-zinc-200">Exact reproduction:</strong> committed input and output hashes make corpus or compiler drift visible in the regression test.</li>
            <li><strong className="text-zinc-200">Coverage boundary:</strong> 100% source coverage means every source contributed at least one passage. It does not mean every fact or passage survived.</li>
            <li><strong className="text-zinc-200">Quality boundary:</strong> the recipe measures selection and economics, not whether a downstream model produces a correct or complete answer.</li>
          </ul>
          <p className="mt-8 break-all font-mono text-[10px] leading-5 text-zinc-600">input {measurement.result.inputHash}<br />output {measurement.result.outputHash}</p>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{label}</p><p className="mt-3 font-mono text-2xl text-white">{value}</p><p className="mt-3 text-xs leading-5 text-zinc-500">{detail}</p></article>
}

function Economic({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-2 font-mono text-xl text-emerald-200">{value}</p></div>
}

function Command({ title, command, detail }: { title: string; command: string; detail: string }) {
  return <article className="border border-zinc-800 p-6"><h3 className="text-lg text-white">{title}</h3><pre className="mt-4 overflow-x-auto border border-zinc-800 bg-black p-4 font-mono text-xs text-cyan-200"><code>{command}</code></pre><p className="mt-4 text-xs leading-6 text-zinc-500">{detail}</p></article>
}
