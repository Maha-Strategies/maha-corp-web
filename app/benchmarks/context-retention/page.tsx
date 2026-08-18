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
  const completeCases = Math.round(measurement.dataset.cases * maha.completeEvidenceSetPercent / 100)
  const anyEvidenceCases = Math.round(measurement.dataset.cases * maha.anyEvidenceHitPercent / 100)
  const incompleteCases = measurement.dataset.cases - completeCases
  const partialCases = anyEvidenceCases - completeCases
  const missedCases = measurement.dataset.cases - anyEvidenceCases
  const grossMultiple = measurement.economics.mahaGrossInputCostAvoidedUsd / measurement.economics.productionX402FeeUsd

  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Original benchmark · MCRB-1</span><span>Measured {measurement.measuredOn}</span></p>
          <h1 className="evidence-title">How much evidence survives a fixed context budget?</h1>
          <p className="evidence-lede mt-7">Six extractive selectors. {measurement.dataset.cases} independently annotated questions. {measurement.dataset.uniquePapers} full scientific papers. One auditable question: did at least one complete human evidence set survive?</p>
          <p className="evidence-copy mt-5">MCRB-1 is a deliberately narrow retrieval benchmark. It measures exact evidence survival under a declared {measurement.protocol.declaredTokenBudget.toLocaleString()}-token budget—not generated-answer quality.</p>
          <div className="mt-9 flex flex-wrap gap-3"><a className="evidence-action evidence-action--primary" href="/benchmarks/mcrb-1/cases.jsonl">Download raw records ↗</a><Link className="evidence-action evidence-action--secondary" href="/context-compiler">Context Compiler ↗</Link></div>
        </header>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Primary results">
          <Metric label="Complete evidence" value={`${maha.completeEvidenceSetPercent}%`} detail={`${completeCases}/${measurement.dataset.cases} cases · 95% CI ${maha.completeEvidenceSetWilson95.low}–${maha.completeEvidenceSetWilson95.high}%`} status="verified" />
          <Metric label="Mean token reduction" value={`${maha.meanReductionPercent}%`} detail={`${maha.meanOutputTokens.toLocaleString()} mean output tokens`} status="sourced" />
          <Metric label="Front truncation" value={`${front.completeEvidenceSetPercent}%`} detail={`${(maha.completeEvidenceSetPercent / front.completeEvidenceSetPercent).toFixed(2)}× lower complete-set retention`} status="boundary" />
          <Metric label="Oracle ceiling" value={`${oracle.completeEvidenceSetPercent}%`} detail={`${(oracle.completeEvidenceSetPercent - maha.completeEvidenceSetPercent).toFixed(1)} points of ranking headroom`} status="illustrative" />
        </section>

        <section className="evidence-section" aria-labelledby="protocol-heading">
          <p className="evidence-kicker">Frozen protocol</p>
          <h2 id="protocol-heading" className="evidence-section-title mt-4">The labels came from people, not the system being tested.</h2>
          <p className="evidence-copy mt-5">The cohort is the first 250 eligible, answerable QASPER development questions ordered by SHA-256 of question ID. Every method receives the same fixed selection allowance. Exact human-highlighted spans determine retention; no LLM judge participates in the primary metric.</p>
          <dl className="mt-8 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-2 lg:grid-cols-4">
            <ProtocolFact label="Dataset" value="QASPER v0.3.0 dev" />
            <ProtocolFact label="Mean input" value={`${measurement.dataset.meanInputTokensBpe.toLocaleString()} BPE tokens`} />
            <ProtocolFact label="Declared budget" value={`${measurement.protocol.declaredTokenBudget.toLocaleString()} tokens`} />
            <ProtocolFact label="Primary metric" value="Complete evidence set" />
          </dl>
        </section>

        <section className="evidence-section" aria-labelledby="comparison-heading">
          <p className="evidence-kicker">Measured comparison</p>
          <h2 id="comparison-heading" className="evidence-section-title mt-4">BM25 leads the deployable baselines—and still fails often.</h2>
          <p className="evidence-copy mt-5">The oracle uses known gold evidence and is an unattainable upper bound, not a competing product. Passage identifiers make traceability 100% for every extractive method by construction.</p>
          <div className="mt-8 overflow-x-auto border border-[var(--border-default)] bg-[var(--surface-raised)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border-default)] font-mono text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]"><tr><th className="px-4 py-3">Method</th><th className="px-4 py-3">Complete</th><th className="px-4 py-3">Any evidence</th><th className="px-4 py-3">Mean recall</th><th className="px-4 py-3">Reduction</th><th className="px-4 py-3">p95 local</th></tr></thead>
              <tbody>{measurement.results.map((result) => <tr key={result.method} className={`border-t border-[var(--border-subtle)] ${result.method === 'maha_bm25' ? 'bg-[rgba(35,122,85,0.08)] font-medium' : ''}`}><th className="whitespace-nowrap px-4 py-3 font-medium">{labels[result.method] ?? result.method}</th><td className="px-4 py-3">{result.completeEvidenceSetPercent}%</td><td className="px-4 py-3">{result.anyEvidenceHitPercent}%</td><td className="px-4 py-3">{result.meanEvidenceRecallPercent}%</td><td className="px-4 py-3">{result.meanReductionPercent}%</td><td className="px-4 py-3">{result.latencyMs.p95} ms</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="failures-heading">
          <p className="evidence-kicker text-[var(--status-unverified)]">Failure analysis</p>
          <h2 id="failures-heading" className="evidence-section-title mt-4">The {incompleteCases} incomplete cases split into two different observability problems.</h2>
          <p className="evidence-copy mt-5">A single aggregate retention rate hides whether ranking found some of the needed evidence or never reached it. Those failures call for different diagnostics.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <FailureCard count={completeCases} label="Complete" body="At least one entire human-annotated evidence set survived selection." status="verified" />
            <FailureCard count={partialCases} label="Partial hit" body="Some annotated evidence survived, but no complete evidence set did." status="boundary" />
            <FailureCard count={missedCases} label="Total miss" body="None of the annotated evidence appeared in the selected context." status="unverified" />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="evidence-card"><p className="evidence-kicker">Position breakdown</p><h3 className="evidence-card-title mt-4">Location bias is reduced, not eliminated.</h3><div className="mt-6 space-y-4">{Object.entries(maha.byEvidencePosition).map(([position, value]) => <div key={position} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--border-subtle)] pb-3 text-sm"><span className="capitalize text-[var(--text-secondary)]">{position} evidence ({value.cases} cases)</span><span className="font-mono text-xs text-[var(--text-primary)]">{value.completeEvidenceSetPercent}% complete</span></div>)}</div><p className="evidence-card-copy mt-5">Front truncation retained 0% of complete evidence sets in both the middle and back buckets. BM25 retained {maha.byEvidencePosition.middle.completeEvidenceSetPercent}% and {maha.byEvidencePosition.back.completeEvidenceSetPercent}%.</p></article>
            <article className="evidence-card"><p className="evidence-kicker">Capacity diagnosis</p><h3 className="evidence-card-title mt-4">The budget could usually hold the evidence.</h3><p className="evidence-card-copy mt-5">The gold-label oracle preserved a complete evidence set in {oracle.completeEvidenceSetPercent}% of cases under the same allowance. The {(oracle.completeEvidenceSetPercent - maha.completeEvidenceSetPercent).toFixed(1)}-point gap is therefore primarily selection and ranking headroom, not proof that a larger context window is required.</p><p className="evidence-card-copy mt-4">That is the operational lesson: monitor no-hit, partial-hit, and complete-hit outcomes separately whenever evaluation labels exist.</p></article>
          </div>
        </section>

        <section className="evidence-section grid gap-6 lg:grid-cols-2">
          <article className="evidence-card"><p className="evidence-kicker">Economics · workload-specific</p><h2 className="evidence-card-title mt-4">Measured savings exceeded the machine fee.</h2><dl className="mt-6 grid grid-cols-2 gap-5 text-sm"><Economic label="Mean input" value={`${measurement.dataset.meanInputTokensBpe.toLocaleString()} tokens`} /><Economic label="Tokens avoided" value={`${measurement.economics.mahaMeanInputTokensAvoided.toLocaleString()}`} /><Economic label="Gross avoided" value={`$${measurement.economics.mahaGrossInputCostAvoidedUsd.toFixed(6)}`} /><Economic label="$0.001 multiple" value={`${grossMultiple.toFixed(2)}×`} /></dl><p className="evidence-card-copy mt-6">Uses a declared reference input rate of ${measurement.economics.referenceInputPriceUsdPerMillionTokens}/million tokens. Output generation is excluded equally. This is not a universal savings promise.</p></article>
          <article className="border-l-[3px] border-[var(--status-boundary)] bg-[rgba(160,111,20,0.08)] p-6 sm:p-8"><p className="evidence-kicker text-[var(--status-boundary)]">Interpretation boundary</p><h2 className="evidence-card-title mt-4">Retention is not answer quality.</h2><p className="evidence-card-copy mt-5">MCRB-1 tests whether independently highlighted evidence remains available to a downstream model. It does not test whether that model reasons correctly, cites correctly, or tells the truth. Generative summarizers are excluded because exact-span scoring penalizes paraphrase, while an LLM judge would make the primary result model-dependent.</p></article>
        </section>

        <section className="evidence-section" aria-labelledby="reproduce-heading">
          <p className="evidence-kicker">Reproduce and audit</p>
          <h2 id="reproduce-heading" className="evidence-section-title mt-4">Every case and measurement is public.</h2>
          <p className="evidence-copy mt-5">The cohort manifest contains IDs, hashes, token counts, and position buckets without source document text. The raw record file contains all 1,500 case-method measurements.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="/benchmarks/mcrb-1/results.json" className="evidence-action evidence-action--primary">Aggregate JSON</a><a href="/benchmarks/mcrb-1/cases.jsonl" className="evidence-action evidence-action--secondary">1,500 raw records</a><a href="/benchmarks/mcrb-1/cohort.json" className="evidence-action evidence-action--secondary">Frozen cohort</a><a href="https://github.com/Maha-Strategies/maha-corp-web/blob/main/scripts/run-context-retention-benchmark.ts" className="evidence-action evidence-action--secondary">Runner source ↗</a></div>
          <pre className="evidence-code mt-7 overflow-x-auto p-5 text-sm"><code>npm run benchmark:context-retention</code></pre>
          <p className="evidence-card-copy mt-5">Dataset: <a href="https://allenai.org/data/qasper" className="evidence-link">QASPER v0.3.0 ↗</a>, licensed CC BY 4.0. See the <a href="https://aclanthology.org/2021.naacl-main.365/" className="evidence-link">original paper ↗</a>.</p>
        </section>

        <section className="evidence-section" aria-labelledby="guides-heading">
          <p className="evidence-kicker">Related implementation notes</p><h2 id="guides-heading" className="evidence-section-title mt-4">Carry the measurement boundary into production.</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2"><GuideLink href="/guides/retrieval-augmented-generation-lewis-2020" title="Lewis et al. (2020) RAG developer summary" /><GuideLink href="/guides/context-compression-vs-conversation-summarization" title="Compression vs. conversation summarization" /><GuideLink href="/guides/preserve-citations-reducing-llm-context" title="Preserve citations while reducing context" /><GuideLink href="/context-compiler/playground" title="Inspect a Context Pack in the playground" /></div>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, detail, status }: { label: string; value: string; detail: string; status: 'verified' | 'sourced' | 'boundary' | 'illustrative' }) {
  const colors = { verified: 'var(--status-verified)', sourced: 'var(--status-sourced)', boundary: 'var(--status-boundary)', illustrative: 'var(--status-illustrative)' }
  return <article className="evidence-card border-t-[3px]" style={{ borderTopColor: colors[status] }}><p className="evidence-kicker">{label}</p><p className="font-editorial mt-3 text-4xl text-[var(--text-primary)]">{value}</p><p className="evidence-card-copy mt-2">{detail}</p></article>
}

function ProtocolFact({ label, value }: { label: string; value: string }) {
  return <div className="bg-[var(--surface-raised)] p-5"><dt className="evidence-kicker">{label}</dt><dd className="mt-3 text-sm text-[var(--text-primary)]">{value}</dd></div>
}

function FailureCard({ count, label, body, status }: { count: number; label: string; body: string; status: 'verified' | 'boundary' | 'unverified' }) {
  const colors = { verified: 'var(--status-verified)', boundary: 'var(--status-boundary)', unverified: 'var(--status-unverified)' }
  return <article className="evidence-card"><p className="font-editorial text-5xl" style={{ color: colors[status] }}>{count}</p><h3 className="evidence-card-title mt-3">{label}</h3><p className="evidence-card-copy mt-3">{body}</p></article>
}

function Economic({ label, value }: { label: string; value: string }) {
  return <div><dt className="evidence-kicker">{label}</dt><dd className="mt-2 text-lg text-[var(--text-primary)]">{value}</dd></div>
}

function GuideLink({ href, title }: { href: string; title: string }) {
  return <Link href={href} className="evidence-card evidence-card-copy text-[var(--text-primary)]">{title} →</Link>
}
