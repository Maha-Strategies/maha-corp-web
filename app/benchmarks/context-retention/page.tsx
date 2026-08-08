import type { Metadata } from 'next'
import Link from 'next/link'

import measurement from '@/benchmarks/mcrb-1/results.json'

const SITE_URL = 'https://www.mahastrategies.com'
const PAGE_PATH = '/benchmarks/context-retention'
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`
const title = 'MCRB-1: Context Retention at a Fixed Token Budget'
const description = 'A reproducible benchmark of BM25 context compilation, keyword selection, truncation, recency, and random selection across 250 independently annotated QASPER questions.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PAGE_PATH },
  openGraph: { type: 'article', url: PAGE_URL, siteName: 'Maha Strategies', title, description },
  twitter: { card: 'summary_large_image', title, description },
}

const labels: Record<string, string> = {
  maha_bm25: 'Maha BM25',
  maha_keyword: 'Maha keyword',
  front_truncation: 'Front truncation',
  tail_recency: 'Tail / recency',
  seeded_random: 'Seeded random',
  oracle_ceiling: 'Oracle ceiling',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${PAGE_URL}#dataset`,
  name: 'Maha Context Retention Benchmark v1 (MCRB-1)',
  description,
  url: PAGE_URL,
  dateModified: measurement.measuredOn,
  license: 'https://creativecommons.org/licenses/by/4.0/',
  isBasedOn: 'https://allenai.org/data/qasper',
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC' },
  distribution: [
    { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE_URL}/benchmarks/mcrb-1/results.json` },
    { '@type': 'DataDownload', encodingFormat: 'application/x-ndjson', contentUrl: `${SITE_URL}/benchmarks/mcrb-1/cases.jsonl` },
    { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE_URL}/benchmarks/mcrb-1/cohort.json` },
  ],
}

export default function ContextRetentionBenchmarkPage() {
  const maha = measurement.results.find((result) => result.method === 'maha_bm25')!
  const front = measurement.results.find((result) => result.method === 'front_truncation')!
  const oracle = measurement.results.find((result) => result.method === 'oracle_ceiling')!
  const grossMultiple = measurement.economics.mahaGrossInputCostAvoidedUsd / measurement.economics.productionX402FeeUsd

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200 sm:py-28"><div className="mx-auto max-w-6xl">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <nav><Link href="/context-compiler" className="font-mono text-[10px] uppercase tracking-widest text-cyan-200 hover:text-white">← Context Compiler</Link></nav>
    <header className="mt-8 max-w-4xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ Original benchmark // MCRB-1 ]</p>
      <h1 className="mt-5 text-4xl font-light leading-tight text-white sm:text-6xl">How much evidence survives a fixed context budget?</h1>
      <p className="mt-6 text-lg leading-8 text-zinc-300">MCRB-1 evaluates six extractive selectors on {measurement.dataset.cases} independently annotated questions across {measurement.dataset.uniquePapers} full scientific papers. The primary result is exact and auditable: did at least one complete human evidence set survive?</p>
    </header>

    <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Primary results">
      <Metric label="Maha complete evidence" value={`${maha.completeEvidenceSetPercent}%`} detail={`95% CI ${maha.completeEvidenceSetWilson95.low}–${maha.completeEvidenceSetWilson95.high}%`} />
      <Metric label="Mean token reduction" value={`${maha.meanReductionPercent}%`} detail={`${maha.meanOutputTokens.toLocaleString()} output tokens`} />
      <Metric label="Front truncation" value={`${front.completeEvidenceSetPercent}%`} detail={`${(maha.completeEvidenceSetPercent / front.completeEvidenceSetPercent).toFixed(2)}× lower complete-set retention than Maha`} />
      <Metric label="Known-evidence ceiling" value={`${oracle.completeEvidenceSetPercent}%`} detail={`${(oracle.completeEvidenceSetPercent - maha.completeEvidenceSetPercent).toFixed(1)} points of headroom remain`} />
    </section>

    <section className="mt-16" aria-labelledby="comparison-table">
      <div className="max-w-3xl"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Measured comparison</p><h2 id="comparison-table" className="mt-3 text-3xl font-light text-white">Maha leads every deployable baseline tested.</h2><p className="mt-4 leading-7 text-zinc-400">All methods received the same fixed selection allowance and returned passage-level citations. The oracle uses gold labels and is shown only as an upper bound.</p></div>
      <div className="mt-7 overflow-x-auto border border-zinc-800">
        <table className="min-w-full text-left text-sm"><thead className="bg-zinc-950 font-mono text-[10px] uppercase tracking-widest text-zinc-400"><tr><th className="px-4 py-3">Method</th><th className="px-4 py-3">Complete evidence</th><th className="px-4 py-3">Any evidence</th><th className="px-4 py-3">Mean recall</th><th className="px-4 py-3">Reduction</th><th className="px-4 py-3">p95 local</th></tr></thead>
          <tbody>{measurement.results.map((result) => <tr key={result.method} className={`border-t border-zinc-800 ${result.method === 'maha_bm25' ? 'bg-cyan-950/20 text-cyan-50' : 'text-zinc-300'}`}><th className="whitespace-nowrap px-4 py-3 font-medium">{labels[result.method] ?? result.method}</th><td className="px-4 py-3">{result.completeEvidenceSetPercent}%</td><td className="px-4 py-3">{result.anyEvidenceHitPercent}%</td><td className="px-4 py-3">{result.meanEvidenceRecallPercent}%</td><td className="px-4 py-3">{result.meanReductionPercent}%</td><td className="px-4 py-3">{result.latencyMs.p95} ms</td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="mt-16 grid gap-6 lg:grid-cols-2">
      <article className="border border-zinc-800 p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Economics</p><h2 className="mt-3 text-2xl text-white">The measured savings exceed the machine fee.</h2><dl className="mt-6 grid grid-cols-2 gap-5 text-sm"><Economic label="Mean input" value={`${measurement.dataset.meanInputTokensBpe.toLocaleString()} tokens`} /><Economic label="Tokens avoided" value={`${measurement.economics.mahaMeanInputTokensAvoided.toLocaleString()}`} /><Economic label="Gross cost avoided" value={`$${measurement.economics.mahaGrossInputCostAvoidedUsd.toFixed(6)}`} /><Economic label="$0.001 fee multiple" value={`${grossMultiple.toFixed(2)}×`} /></dl><p className="mt-6 text-xs leading-6 text-zinc-500">Uses a declared reference input rate of ${measurement.economics.referenceInputPriceUsdPerMillionTokens}/million tokens. Output generation cost is excluded equally. This is a workload result, not a universal savings promise.</p></article>
      <article className="border border-zinc-800 p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Position robustness</p><h2 className="mt-3 text-2xl text-white">Ranking matters after the introduction.</h2><div className="mt-6 space-y-4">{Object.entries(maha.byEvidencePosition).map(([position, value]) => <div key={position} className="grid grid-cols-[1fr_auto] gap-4 border-b border-zinc-800 pb-3 text-sm"><span className="capitalize text-zinc-400">{position} evidence ({value.cases} cases)</span><span className="text-white">{value.completeEvidenceSetPercent}% complete</span></div>)}</div><p className="mt-6 text-xs leading-6 text-zinc-500">Front truncation retained 0% of complete evidence sets in both the middle and back buckets. Maha BM25 retained 59.1% and 62.9%, respectively.</p></article>
    </section>

    <section className="mt-16 border border-amber-900/70 bg-amber-950/10 p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Interpretation boundary</p><h2 className="mt-3 text-2xl text-white">Retention is not answer quality.</h2><p className="mt-4 max-w-4xl leading-7 text-zinc-300">MCRB-1 tests whether independently highlighted evidence remains available to a downstream model. It does not test whether that model reasons correctly, cites correctly, or tells the truth. Generative summarizers and LangChain summarization are excluded from v1 because exact-span scoring penalizes paraphrase, while an LLM judge would make the primary result model-dependent.</p></section>

    <section className="mt-16"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Apply the evidence</p><h2 className="mt-3 text-3xl font-light text-white">Turn the benchmark into an implementation boundary.</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><GuideLink href="/guides/context-compression-vs-conversation-summarization" title="Compression vs. conversation summarization" /><GuideLink href="/guides/preserve-citations-reducing-llm-context" title="Preserve citations while reducing context" /><GuideLink href="/guides/crewai-context-compression-provenance" title="CrewAI context compression with provenance" /><GuideLink href="/context-compiler/playground" title="Inspect a Context Pack in the playground" /></div></section>

    <section className="mt-16"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Reproduce and audit</p><h2 className="mt-3 text-3xl font-light text-white">Every case and measurement is public.</h2><div className="mt-6 flex flex-wrap gap-3"><a href="/benchmarks/mcrb-1/results.json" className="border border-cyan-700 px-4 py-3 font-mono text-xs text-cyan-100 hover:bg-cyan-950/30">Aggregate JSON</a><a href="/benchmarks/mcrb-1/cases.jsonl" className="border border-zinc-700 px-4 py-3 font-mono text-xs text-zinc-300 hover:border-cyan-600">1,500 raw records</a><a href="/benchmarks/mcrb-1/cohort.json" className="border border-zinc-700 px-4 py-3 font-mono text-xs text-zinc-300 hover:border-cyan-600">Frozen cohort</a><a href="https://github.com/Maha-Strategies/maha-corp-web/blob/main/scripts/run-context-retention-benchmark.ts" className="border border-zinc-700 px-4 py-3 font-mono text-xs text-zinc-300 hover:border-cyan-600">Runner source ↗</a><a href="https://allenai.org/data/qasper" className="border border-zinc-700 px-4 py-3 font-mono text-xs text-zinc-300 hover:border-cyan-600">QASPER source ↗</a></div><pre className="mt-7 overflow-x-auto border border-zinc-800 bg-black p-5 text-sm text-cyan-100">npm run benchmark:context-retention</pre></section>
  </div></main>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="border border-zinc-800 bg-zinc-950/60 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 text-3xl text-white">{value}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p></article> }
function Economic({ label, value }: { label: string; value: string }) { return <div><dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</dt><dd className="mt-2 text-lg text-white">{value}</dd></div> }
function GuideLink({ href, title }: { href: string; title: string }) { return <Link href={href} className="border border-zinc-800 px-4 py-4 text-sm text-zinc-300 hover:border-cyan-700 hover:text-white">{title} →</Link> }
