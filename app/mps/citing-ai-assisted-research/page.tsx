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
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-4xl">
      <Link href="/mps/learn" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white">← MPS Learning Center</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ MPS/0.1 · practical guide ]</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">How should AI-assisted research be cited?</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300">Cite the <strong>work you actually used</strong>. Then preserve two separate facts: the sources that support its claims, and the role AI tools played in producing or checking it.</p>

      <section className="mt-14 grid gap-4 md:grid-cols-3"><div className="border border-zinc-800 p-6"><h2 className="text-xl text-white">1. Cite the artifact</h2><p className="mt-4 text-sm leading-relaxed text-zinc-400">Use its author, title, version, date, canonical URL, and DOI when it has one. This identifies the exact edition you read.</p></div><div className="border border-zinc-800 p-6"><h2 className="text-xl text-white">2. Check the source trail</h2><p className="mt-4 text-sm leading-relaxed text-zinc-400">If you rely on a factual or technical claim, consult and cite the primary or authoritative source where possible—not only the synthesis that pointed you there.</p></div><div className="border border-zinc-800 p-6"><h2 className="text-xl text-white">3. Disclose the instrument</h2><p className="mt-4 text-sm leading-relaxed text-zinc-400">Name meaningful AI assistance when the artifact itself does: synthesis, drafting, retrieval, verification, editing, or classification. Do not describe a tool as an author unless the publication’s own policy requires it.</p></div></section>

      <section className="mt-14 border-y border-zinc-800 py-10"><h2 className="text-2xl text-white">A worked example</h2><p className="mt-5 max-w-3xl leading-relaxed text-zinc-400">The De Sitter literature map has a canonical research page, a versioned Zenodo archive, a claim ledger, a source trail, and an explicit instrument disclosure. A citation to the map can identify the synthesis; a research conclusion drawn from it should still be checked against the relevant source paper.</p><div className="mt-6 border border-indigo-900/50 bg-indigo-950/20 p-6 font-mono text-sm leading-relaxed text-zinc-300">Rajan, M. M. (2026). <em>The de Sitter Problem in the String Swampland: A Verified Literature Map</em> (Version 2.0). Maha Strategies Research. https://doi.org/10.5281/zenodo.21603961</div><p className="mt-5 text-sm leading-relaxed text-zinc-500">This example identifies a non-peer-reviewed literature map. It does not turn its summary into a substitute for the cited primary literature.</p></section>

      <section className="mt-14"><h2 className="text-2xl text-white">Common mistakes</h2><ul className="mt-5 space-y-4 leading-relaxed text-zinc-400"><li><strong className="text-zinc-200">Citing an AI system as if it were the source.</strong> A model may assist with wording or retrieval, but the source of a factual statement is the evidence behind it.</li><li><strong className="text-zinc-200">Citing a polished synthesis without preserving its status.</strong> A DOI, stable URL, or JSON export does not imply peer review.</li><li><strong className="text-zinc-200">Treating a disclosure as verification.</strong> Saying that AI was used is not a claim-by-claim account of what was checked.</li><li><strong className="text-zinc-200">Dropping limitations during quotation.</strong> If the source calls a result contested, conjectural, or illustrative, preserve that framing.</li></ul></section>

      <section className="mt-14 border border-zinc-800 bg-zinc-950 p-7"><h2 className="text-2xl text-white">A concise citation rule</h2><p className="mt-4 leading-relaxed text-zinc-400">Cite the versioned work for its synthesis, cite primary sources for the claims you adopt, and disclose meaningful AI assistance in the method or acknowledgment where a reader needs it to calibrate trust.</p></section>
      <MpsLearningLinks current="/mps/citing-ai-assisted-research" />
      <section className="mt-10 flex flex-wrap gap-4"><a href="https://research.mahastrategies.com/atlas/de-sitter-swampland" className="border border-zinc-600 px-5 py-3 font-mono text-xs uppercase tracking-widest text-zinc-100 hover:border-white">Inspect the Atlas ↗</a><Link href="/mps/claim-level-provenance" className="border border-zinc-600 px-5 py-3 font-mono text-xs uppercase tracking-widest text-zinc-100 hover:border-white">Read provenance guide</Link></section>
    </article>
  </main>
}
