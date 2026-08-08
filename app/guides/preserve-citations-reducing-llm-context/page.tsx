import type { Metadata } from 'next'
import Link from 'next/link'

import measurement from '@/benchmarks/mcrb-1/results.json'
import { CodeBlock, EvidenceGuide, GuideMetric } from '@/app/guides/_components/EvidenceGuide'

const path = '/guides/preserve-citations-reducing-llm-context'
const title = 'How to Preserve Citations While Reducing LLM Context'
const description = 'An executable passage-level workflow for reducing LLM input while retaining source IDs, hashes, explicit coverage metrics, and honest evidence boundaries.'

export const metadata: Metadata = { title, description, alternates: { canonical: path }, openGraph: { type: 'article', url: `https://www.mahastrategies.com${path}`, title, description }, twitter: { card: 'summary_large_image', title, description } }

export default function PreserveCitationsPage() {
  const bm25 = measurement.results.find((result) => result.method === 'maha_bm25')!
  return <EvidenceGuide path={path} eyebrow="Executable provenance workflow" title={title} summary={description} about={['LLM citations', 'Context compression', 'Provenance', 'RAG']} backHref="/context-compiler" backLabel="Context Compiler">
    <section className="mt-12 grid gap-4 sm:grid-cols-3"><GuideMetric label="Citation traceability" value={`${bm25.citationTraceabilityPercent}%`} detail="Every selected benchmark passage emitted a source reference" /><GuideMetric label="Complete evidence sets" value={`${bm25.completeEvidenceSetPercent}%`} detail={`95% Wilson interval ${bm25.completeEvidenceSetWilson95.low}–${bm25.completeEvidenceSetWilson95.high}%`} /><GuideMetric label="Mean evidence recall" value={`${bm25.meanEvidenceRecallPercent}%`} detail={`At ${bm25.meanReductionPercent}% mean token reduction`} /></section>

    <section className="mt-14"><h2 className="text-3xl font-light text-white">Preserve identity before reducing text</h2><p className="mt-5 leading-7 text-zinc-400">Split each document into stable passages before ranking. Carry a source ID, passage ID, and content hash with each passage. Selection may then omit passages, but it must never silently detach retained text from its origin. The downstream prompt should require passage citations and the application should reject citations that do not appear in the returned pack.</p><p className="mt-4 leading-7 text-zinc-400">Traceability is not the same as completeness. MCRB-1 produced traceable references for every selected passage, while only {bm25.completeEvidenceSetPercent}% of questions retained every human-annotated evidence span. Both measurements belong in the product boundary.</p></section>

    <section className="mt-14 border border-zinc-800 p-7 sm:p-9"><h2 className="text-2xl text-white">The four records to keep</h2><ol className="mt-6 space-y-4 text-sm leading-7 text-zinc-400"><li><strong className="text-white">Source record:</strong> source ID, title, source hash, and original token estimate.</li><li><strong className="text-white">Passage record:</strong> passage ID, source ID, passage hash, and exact included text.</li><li><strong className="text-white">Boundary record:</strong> budget, reduction, source coverage, warnings, and excluded-passage behavior.</li><li><strong className="text-white">Pack record:</strong> input and output hashes so the received context can be checked for mutation.</li></ol></section>

    <section className="mt-14"><h2 className="text-3xl font-light text-white">Executable TypeScript check</h2><CodeBlock>{`const pack = await maha.compress({
  clientRequestId: crypto.randomUUID(),
  task: "Identify the release condition and rollback trigger.",
  tokenBudget: 1800,
  documents,
})

const validIds = new Set(pack.includedPassages.map(p => p.passageId))
const answer = await model({
  instruction: "Use only the pack. Cite claims as [source-id:passage].",
  context: pack.context,
})

for (const citation of extractCitations(answer)) {
  if (!validIds.has(citation)) throw new Error("Untraceable citation")
}`}</CodeBlock><p className="mt-5 text-sm leading-7 text-zinc-500">The citation parser is application-specific. The invariant is not: every accepted citation must resolve to an included passage, and the UI must expose the original source boundary.</p></section>

    <section className="mt-14 border border-amber-900/60 bg-amber-950/10 p-7"><h2 className="text-2xl text-white">Do not hide retention loss</h2><p className="mt-4 leading-7 text-zinc-400">If a source receives no selected passage, show that fact. If complete evidence retention is not known for the live workload, do not substitute source participation as though it were the same metric. The published benchmark measures both and states that retained evidence does not guarantee correct reasoning.</p><div className="mt-6 flex flex-wrap gap-4"><Link href="/benchmarks/context-retention" className="text-cyan-100 underline underline-offset-4">Review benchmark limits</Link><Link href="/context-compiler/playground" className="text-cyan-100 underline underline-offset-4">Inspect a Context Pack</Link></div></section>
  </EvidenceGuide>
}
