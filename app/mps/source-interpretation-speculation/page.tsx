import type { Metadata } from 'next'
import Link from 'next/link'

import MpsLearningLinks from '@/components/MpsLearningLinks'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const canonicalUrl = 'https://www.mahastrategies.com/mps/source-interpretation-speculation'
const publicationDate = '2026-07-27'

export const metadata: Metadata = {
  title: 'Source, Interpretation, and Speculation: What Is the Difference?',
  description: 'A practical method for separating what a source reports, what an author infers, and what remains a possibility in AI-assisted research.',
  alternates: { canonical: '/mps/source-interpretation-speculation' },
  openGraph: { title: 'Source, Interpretation, and Speculation', description: 'A practical guide to keeping evidence, inference, and possibility distinct.', url: canonicalUrl, type: 'article' },
}

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article', '@id': `${canonicalUrl}#article`, headline: 'Source, Interpretation, and Speculation: What Is the Difference?',
  description: 'A practical method for separating evidence, interpretation, and speculation in AI-assisted research.', mainEntityOfPage: canonicalUrl,
  datePublished: publicationDate, dateModified: publicationDate, author: { '@id': MAYONE_MAHA_RAJAN_ID }, publisher: { '@id': MAHA_ORGANIZATION_ID },
  about: [{ '@type': 'Thing', name: 'Evidence' }, { '@type': 'Thing', name: 'Scientific inference' }, { '@type': 'Thing', name: 'Speculation' }],
}

export default function SourceInterpretationSpeculationPage() {
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-4xl">
      <Link href="/mps/learn" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white">← MPS Learning Center</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ MPS/0.1 · practical guide ]</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">Source, interpretation, speculation: what is the difference?</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300">Reliable writing does not eliminate interpretation. It makes the transition from <strong>what a source says</strong>, to <strong>what the author infers</strong>, to <strong>what might be possible</strong> visible to the reader.</p>

      <section className="mt-14 grid gap-4 md:grid-cols-3"><div className="border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">Source</p><h2 className="mt-3 text-xl text-white">What is reported or measured</h2><p className="mt-4 text-sm leading-relaxed text-zinc-400">A document, data set, observation, or primary record says something. Quote it accurately and preserve its own conditions, date, and limits.</p></div><div className="border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">Interpretation</p><h2 className="mt-3 text-xl text-white">What follows, if the reasoning holds</h2><p className="mt-4 text-sm leading-relaxed text-zinc-400">An author relates evidence to a question, chooses a framing, or weighs competing explanations. The reasoning can be valuable without being a direct property of the source.</p></div><div className="border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">Speculation</p><h2 className="mt-3 text-xl text-white">What could be true, but is not established</h2><p className="mt-4 text-sm leading-relaxed text-zinc-400">A hypothesis, scenario, analogy, or future possibility. It belongs in serious work when it is named as such and never silently upgraded into a finding.</p></div></section>

      <section className="mt-14"><h2 className="text-2xl text-white">A simple test while writing</h2><div className="mt-6 space-y-4 text-lg leading-relaxed text-zinc-400"><p><strong className="text-zinc-200">Ask “where does this sentence come from?”</strong> If the answer is a source, identify it. If the answer is your reasoning, use language that signals inference: “this suggests,” “one interpretation is,” or “under this assumption.” If the answer is a possibility, say “could,” “may,” “hypothesis,” or “illustrative.”</p><p><strong className="text-zinc-200">Then ask “what would make it wrong?”</strong> The answer belongs near the statement. A strong boundary makes later correction easier; it does not weaken a well-supported argument.</p></div></section>

      <section className="mt-14 border-y border-zinc-800 py-10"><h2 className="text-2xl text-white">How MPS represents the distinction</h2><p className="mt-5 max-w-3xl leading-relaxed text-zinc-400">MPS uses status labels to prevent a document from presenting every sentence with the same voice of certainty. A verified or sourced statement records a different condition from a boundary statement describing an open question, or an illustrative example that intentionally makes no claim about the world.</p><div className="mt-6 grid gap-4 md:grid-cols-2"><div className="border border-zinc-800 p-5"><h3 className="font-mono text-xs text-indigo-300">Useful public labels</h3><p className="mt-3 text-sm leading-relaxed text-zinc-400">Verified, sourced, boundary, illustrative, and unverified can describe the condition of a claim without pretending to resolve the underlying debate.</p></div><div className="border border-zinc-800 p-5"><h3 className="font-mono text-xs text-indigo-300">A necessary caution</h3><p className="mt-3 text-sm leading-relaxed text-zinc-400">A label is only as honest as the process behind it. Readers should still follow important claims to their cited sources and examine the evidence themselves.</p></div></div></section>

      <section className="mt-14"><h2 className="text-2xl text-white">A worked example of boundaries</h2><p className="mt-5 max-w-3xl leading-relaxed text-zinc-400">The Mayon Volcano educational project treats terrain, historical sources, inferred volcanic interiors, and hazard illustrations as different kinds of information. Its methodology page explains that an educational model can locate, visualize, and prompt questions without becoming a live warning system or an underground scan.</p><a href="https://mayonrajan.com/methods/" className="mt-5 inline-block text-zinc-100 underline underline-offset-4 hover:text-white">Read Mayon’s methodology and limits ↗</a></section>
      <MpsLearningLinks current="/mps/source-interpretation-speculation" />
      <section className="mt-10 flex flex-wrap gap-4"><Link href="/mps/what-is-mps" className="border border-zinc-600 px-5 py-3 font-mono text-xs uppercase tracking-widest text-zinc-100 hover:border-white">Read MPS explainer</Link><Link href="/audit" className="border border-zinc-600 px-5 py-3 font-mono text-xs uppercase tracking-widest text-zinc-100 hover:border-white">Try the free Auditor</Link></section>
    </article>
  </main>
}
