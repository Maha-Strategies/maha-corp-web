import type { Metadata } from 'next'
import Link from 'next/link'

import MpsLearningLinks from '@/components/MpsLearningLinks'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const canonicalUrl = 'https://www.mahastrategies.com/mps/citing-ai-assisted-research'
const publicationDate = '2026-07-27'

export const metadata: Metadata = {
  title: 'How Should AI-Assisted Research Be Cited?',
  description: 'A practical guide to citing AI-assisted research without confusing the published work, its sources, and the tools used to create it.',
  alternates: { canonical: '/mps/citing-ai-assisted-research' },
  openGraph: { title: 'How Should AI-Assisted Research Be Cited?', description: 'A practical guide to source-aware AI-assisted research publishing.', url: canonicalUrl, type: 'article' },
}

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article', '@id': `${canonicalUrl}#article`, headline: 'How Should AI-Assisted Research Be Cited?',
  description: 'A practical guide to citing AI-assisted research while preserving source and methodology boundaries.', mainEntityOfPage: canonicalUrl,
  datePublished: publicationDate, dateModified: publicationDate, author: { '@id': MAYONE_MAHA_RAJAN_ID }, publisher: { '@id': MAHA_ORGANIZATION_ID },
  about: [{ '@type': 'Thing', name: 'Citation practice' }, { '@type': 'Thing', name: 'AI-assisted research' }],
}

export default function CitingAiAssistedResearchPage() {
  return <main className="evidence-page"><div className="evidence-container"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <article>
      <Link href="/mps/learn" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← MPS Learning Center</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ MPS/0.1 · practical guide ]</p>
      <h1 className="evidence-title evidence-title--product max-w-3xl">How should AI-assisted research be cited?</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">Cite the <strong>work you actually used</strong>. Then preserve two separate facts: the sources that support its claims, and the role AI tools played in producing or checking it.</p>

      <section className="mt-14 grid gap-4 md:grid-cols-3"><div className="border border-[var(--border-default)] p-6"><h2 className="evidence-card-title">1. Cite the artifact</h2><p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">Use its author, title, version, date, canonical URL, and DOI when it has one. This identifies the exact edition you read.</p></div><div className="border border-[var(--border-default)] p-6"><h2 className="evidence-card-title">2. Check the source trail</h2><p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">If you rely on a factual or technical claim, consult and cite the primary or authoritative source where possible—not only the synthesis that pointed you there.</p></div><div className="border border-[var(--border-default)] p-6"><h2 className="evidence-card-title">3. Disclose the instrument</h2><p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">Name meaningful AI assistance when the artifact itself does: synthesis, drafting, retrieval, verification, editing, or classification. Do not describe a tool as an author unless the publication’s own policy requires it.</p></div></section>

      <section className="mt-14 border-y border-[var(--border-default)] py-10"><h2 className="evidence-section-title">A worked example</h2><p className="mt-5 max-w-3xl leading-relaxed text-[var(--text-secondary)]">The De Sitter literature map has a canonical research page, a versioned Zenodo archive, a claim ledger, a source trail, and an explicit instrument disclosure. A citation to the map can identify the synthesis; a research conclusion drawn from it should still be checked against the relevant source paper.</p><div className="mt-6 border border-[var(--status-sourced)] bg-[var(--surface-raised)] p-6 font-mono text-sm leading-relaxed text-[var(--text-secondary)]">Rajan, M. M. (2026). <em>The de Sitter Problem in the String Swampland: A Verified Literature Map</em> (Version 2.0). Maha Strategies Research. https://doi.org/10.5281/zenodo.21603961</div><p className="mt-5 text-sm leading-relaxed text-[var(--text-muted)]">This example identifies a non-peer-reviewed literature map. It does not turn its summary into a substitute for the cited primary literature.</p></section>

      <section className="mt-14"><h2 className="evidence-section-title">Common mistakes</h2><ul className="mt-5 space-y-4 leading-relaxed text-[var(--text-secondary)]"><li><strong className="text-[var(--text-secondary)]">Citing an AI system as if it were the source.</strong> A model may assist with wording or retrieval, but the source of a factual statement is the evidence behind it.</li><li><strong className="text-[var(--text-secondary)]">Citing a polished synthesis without preserving its status.</strong> A DOI, stable URL, or JSON export does not imply peer review.</li><li><strong className="text-[var(--text-secondary)]">Treating a disclosure as verification.</strong> Saying that AI was used is not a claim-by-claim account of what was checked.</li><li><strong className="text-[var(--text-secondary)]">Dropping limitations during quotation.</strong> If the source calls a result contested, conjectural, or illustrative, preserve that framing.</li></ul></section>

      <section className="mt-14 border border-[var(--border-default)] bg-[var(--surface-raised)] p-7"><h2 className="evidence-section-title">A concise citation rule</h2><p className="mt-4 leading-relaxed text-[var(--text-secondary)]">Cite the versioned work for its synthesis, cite primary sources for the claims you adopt, and disclose meaningful AI assistance in the method or acknowledgment where a reader needs it to calibrate trust.</p></section>
      <MpsLearningLinks current="/mps/citing-ai-assisted-research" />
      <section className="mt-10 flex flex-wrap gap-4"><a href="https://research.mahastrategies.com/atlas/de-sitter-swampland" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Inspect the Atlas ↗</a><Link href="/mps/claim-level-provenance" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Read provenance guide</Link></section>
    </article>
    </div>
  </main>
}
