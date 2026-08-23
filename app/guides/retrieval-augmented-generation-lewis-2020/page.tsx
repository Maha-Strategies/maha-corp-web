import type { Metadata } from 'next'
import Link from 'next/link'

import { EvidenceGuide } from '@/app/guides/_components/EvidenceGuide'

const path = '/guides/retrieval-augmented-generation-lewis-2020'
const title = 'Retrieval-Augmented Generation (Lewis et al., 2020): Developer Summary'
const description = 'A practical summary of Lewis et al. (2020), arXiv:2005.11401: how retrieval-augmented generation combines a parametric model with retrieved documents, what it demonstrated, and what to preserve in production RAG systems.'
const ragPaper = {
  name: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
  url: 'https://arxiv.org/abs/2005.11401',
  datePublished: '2020-05-22',
  authors: ['Patrick Lewis', 'Ethan Perez', 'Aleksandra Piktus', 'Fabio Petroni', 'Vladimir Karpukhin', 'Naman Goyal', 'Heinrich Küttler', 'Mike Lewis', 'Wen-tau Yih', 'Tim Rocktäschel', 'Sebastian Riedel', 'Douwe Kiela'],
}

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { type: 'article', url: `https://www.mahastrategies.com${path}`, siteName: 'Maha Strategies', title, description },
  twitter: { card: 'summary_large_image', title, description },
}

export default function RetrievalAugmentedGenerationLewis2020Page() {
  return <EvidenceGuide path={path} eyebrow="Paper reference and implementation guide" title={title} summary={description} published="2026-08-09" about={['Retrieval-augmented generation', 'Knowledge-intensive natural language processing', 'Dense Passage Retrieval', 'RAG system design']} citations={[ragPaper]} backHref="/context-compiler" backLabel="Context Compiler">
    <section className="evidence-section evidence-inset">
      <h2 className="evidence-card-title">Key takeaway</h2>
      <p className="evidence-copy mt-4">Lewis et al. introduced retrieval-augmented generation (RAG) as a way to pair a pretrained sequence-to-sequence model with a large, external collection of text. Instead of relying only on information encoded in model parameters, the system retrieves relevant passages and conditions generation on them.</p>
      <p className="evidence-copy mt-4">For developers, the durable idea is simple: keep knowledge in an inspectable corpus, retrieve the evidence for each task, and make the answer accountable to that evidence. Retrieval is not a guarantee of a correct answer; it creates a boundary that can be evaluated and improved.</p>
    </section>

    <section className="evidence-section">
      <h2 className="evidence-section-title">What does Retrieval-Augmented Generation mean?</h2>
      <p className="evidence-copy mt-5">In the paper, a query is used to retrieve passages from a dense vector index of Wikipedia. A generator then produces an answer while attending to that retrieved context. This makes the retrieved material part of the model&apos;s input rather than an invisible assumption inside the generated answer.</p>
      <p className="evidence-copy mt-4">The authors evaluate two variants: RAG-Sequence, which uses the same retrieved document set for a complete generated sequence, and RAG-Token, which may use different retrieved documents as generation proceeds. The paper reports results across knowledge-intensive NLP tasks and treats retrieval as a component that can be updated independently of the generator.</p>
    </section>

    <section className="evidence-section">
      <h2 className="evidence-section-title">The architecture in four steps</h2>
      <ol className="evidence-card-copy mt-6 flex flex-col gap-4">
        <li><strong className="text-[var(--text-primary)]">1. Prepare a corpus.</strong> Chunk authoritative source material and preserve stable source and passage identifiers.</li>
        <li><strong className="text-[var(--text-primary)]">2. Retrieve for the task.</strong> Rank candidate passages against the user&apos;s question; retrieval quality constrains what the generator can support.</li>
        <li><strong className="text-[var(--text-primary)]">3. Generate with evidence.</strong> Supply selected passages alongside clear instructions about scope, uncertainty, and citations.</li>
        <li><strong className="text-[var(--text-primary)]">4. Verify the boundary.</strong> Record which passages entered the prompt and require citations to resolve to those passages.</li>
      </ol>
    </section>

    <section className="evidence-section border border-[var(--border-default)] p-7 sm:p-9">
      <h2 className="evidence-card-title">What the 2020 paper does—and does not—establish</h2>
      <p className="evidence-copy mt-4">The paper is a foundational research result, not a production security or truthfulness guarantee. It shows a model architecture and benchmark evaluations; it does not prove that every deployed RAG system retrieves complete evidence, cites correctly, resists malicious documents, or stays current without a corpus-update process.</p>
      <p className="evidence-copy mt-4">Those production properties need their own tests. For source-sensitive systems, measure evidence retention, surface retrieved sources to reviewers, and distinguish a retrieved passage from a supported claim.</p>
    </section>

    <section className="evidence-section">
      <h2 className="evidence-section-title">Citation and primary source</h2>
      <p className="evidence-copy mt-5">The canonical preprint is <a href={ragPaper.url} className="text-[var(--text-primary)] underline underline-offset-4">Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks</a>, Patrick Lewis and coauthors, arXiv:2005.11401 (2020). Use the primary paper when citing the research; this guide is an implementation-oriented summary.</p>
    </section>

    <section className="evidence-section evidence-inset" style={{ borderLeftColor: 'var(--status-boundary)' }}>
      <h2 className="evidence-card-title">Put the paper&apos;s idea into a measurable system</h2>
      <p className="evidence-copy mt-4">RAG quality depends on what reaches the model. Maha&apos;s public benchmark tests whether an extractive context-selection process retains independently annotated evidence under a fixed token budget; it does not score answer truthfulness or claim to reproduce the paper&apos;s results.</p>
      <div className="mt-6 flex flex-wrap gap-4"><Link href="/guides/preserve-citations-reducing-llm-context" className="text-[var(--text-primary)] underline underline-offset-4">Preserve citations in RAG context</Link><Link href="/guides/context-compression-vs-conversation-summarization" className="text-[var(--text-primary)] underline underline-offset-4">Choose compression or summarization</Link><Link href="/benchmarks/context-retention" className="text-[var(--text-primary)] underline underline-offset-4">Review the context-retention benchmark</Link></div>
    </section>
  </EvidenceGuide>
}
