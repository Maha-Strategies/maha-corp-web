import type { Metadata } from 'next'
import Link from 'next/link'

import measurement from '@/benchmarks/mcrb-1/results.json'
import { CodeBlock, EvidenceGuide, GuideMetric } from '@/app/guides/_components/EvidenceGuide'

const path = '/guides/context-compression-vs-conversation-summarization'
const title = 'Context Compression vs. Conversation Summarization'
const description = 'A benchmark-grounded guide to choosing extractive context compilation, generative conversation summaries, or a staged combination without overstating what either preserves.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { type: 'article', url: `https://www.mahastrategies.com${path}`, siteName: 'Maha Strategies', title, description },
  twitter: { card: 'summary_large_image', title, description },
}

export default function ContextCompressionVsSummarizationPage() {
  const bm25 = measurement.results.find((result) => result.method === 'maha_bm25')!
  const front = measurement.results.find((result) => result.method === 'front_truncation')!
  const recency = measurement.results.find((result) => result.method === 'tail_recency')!

  return <EvidenceGuide path={path} eyebrow="Context engineering decision guide" title={title} summary={description} about={['Context compression', 'Conversation summarization', 'BM25', 'Retrieval-augmented generation']} backHref="/context-compiler" backLabel="Context Compiler">
    <section className="evidence-section grid gap-4 sm:grid-cols-3" aria-label="MCRB-1 evidence">
      <GuideMetric label="BM25 complete evidence" value={`${bm25.completeEvidenceSetPercent}%`} detail={`${measurement.dataset.cases} annotated QASPER questions`} />
      <GuideMetric label="Mean token reduction" value={`${bm25.meanReductionPercent}%`} detail={`${bm25.meanOutputTokens.toLocaleString()} mean output tokens`} />
      <GuideMetric label="Position robustness" value={`${bm25.byEvidencePosition.back.completeEvidenceSetPercent}%`} detail="Complete evidence when gold evidence was in the back third" />
    </section>

    <section className="evidence-section evidence-inset"><h2 className="evidence-card-title">The practical difference</h2><p className="evidence-copy mt-4"><strong>Context compilation selects source passages.</strong> The resulting pack can retain source IDs, passage IDs, and hashes because the evidence text is not rewritten. <strong>Conversation summarization generates a new representation.</strong> It can synthesize decisions and dialogue state, but its sentences are no longer identical to the original evidence.</p><p className="evidence-copy mt-4">Use compilation when a downstream answer must remain inspectable against supplied sources. Use summarization for conversational continuity when verbatim evidence recovery is not the primary requirement. In long-running agents, use both in stages: summarize workflow state, then compile the source documents needed for the current task.</p></section>

    <section className="evidence-section"><h2 className="evidence-section-title">BM25 passage selection versus LLM-generated summaries</h2><p className="evidence-copy mt-5">MCRB-1 compares BM25 selection with keyword selection, front truncation, tail/recency selection, seeded random selection, and a gold-label oracle. At a similar reduction, BM25 retained a complete evidence set in {bm25.completeEvidenceSetPercent}% of cases versus {front.completeEvidenceSetPercent}% for front truncation and {recency.completeEvidenceSetPercent}% for recency.</p><p className="evidence-copy mt-4">It deliberately does <strong className="text-[var(--text-primary)]">not</strong> assign a score to LLM or LangChain summaries. Exact-span scoring would punish faithful paraphrase, while an LLM judge would make the result depend on the evaluator model. The benchmark therefore supports a comparison of operating boundaries, not a claim that BM25 beats every generative summary.</p><Link href="/benchmarks/context-retention" className="mt-6 inline-block text-[var(--text-primary)] underline underline-offset-4">Inspect all 1,500 case-method records →</Link></section>

    <section className="evidence-section"><h2 className="evidence-section-title">Choose by failure mode</h2><div className="evidence-table-wrap mt-6"><table className="evidence-table"><thead><tr><th scope="col">Need</th><th scope="col">Prefer</th><th scope="col">Reason</th></tr></thead><tbody><tr><td>Source-linked RAG evidence</td><td>Extractive compilation</td><td>Selected text remains traceable to source passages.</td></tr><tr><td>Long dialogue continuity</td><td>Conversation summary</td><td>A compact generated state can preserve decisions and intent.</td></tr><tr><td>Agent state plus cited research</td><td>Staged combination</td><td>Summarize state; compile evidence for the current task.</td></tr></tbody></table></div></section>

    <section className="evidence-section"><h2 className="evidence-section-title">A safe staged pattern</h2><CodeBlock>{`const stateSummary = await summarizeConversation(turns)
const pack = await maha.compress({
  clientRequestId: crypto.randomUUID(),
  task: currentTask + "\nAgent state: " + stateSummary,
  tokenBudget: 4000,
  documents: sourceDocuments,
})

// Ground the next model call in pack.context and preserve passage IDs.`}</CodeBlock><p className="evidence-card-copy mt-5">Keep generated state separate from source evidence. Do not label a summary sentence as a source quotation, and do not infer that retained evidence guarantees a correct downstream answer.</p><Link href="/guides/retrieval-augmented-generation-lewis-2020" className="mt-5 inline-block text-[var(--text-primary)] underline underline-offset-4">Read the Lewis et al. (2020) RAG developer summary →</Link></section>
  </EvidenceGuide>
}
