import type { Metadata } from 'next'
import Link from 'next/link'

import MpsLearningLinks from '@/components/MpsLearningLinks'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const canonicalUrl = 'https://www.mahastrategies.com/mps/claim-level-provenance'
const publicationDate = '2026-07-27'

export const metadata: Metadata = {
  title: 'What Is Claim-Level Provenance?',
  description: 'A practical explanation of how a substantive claim can retain its source, status, limits, and review history when it is reused.',
  alternates: { canonical: '/mps/claim-level-provenance' },
  openGraph: { title: 'What Is Claim-Level Provenance?', description: 'A practical guide to source-aware claims in AI-assisted research and publishing.', url: canonicalUrl, type: 'article' },
}

const record = [
  ['Claim', 'The exact statement a reader is asked to rely on.'],
  ['Status', 'Whether the statement is verified, sourced, a boundary, illustrative, or still unverified.'],
  ['Source trail', 'The primary or cited material that lets a reader inspect the basis for the statement.'],
  ['Scope and limits', 'What the claim does not establish, including uncertainty and conditions of use.'],
  ['Version and review date', 'Whether the wording changed and when the assertion was last checked.'],
]

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article', '@id': `${canonicalUrl}#article`, headline: 'What Is Claim-Level Provenance?',
  description: 'A practical explanation of claim-level provenance for AI-assisted research and publishing.', mainEntityOfPage: canonicalUrl,
  datePublished: publicationDate, dateModified: publicationDate, author: { '@id': MAYONE_MAHA_RAJAN_ID }, publisher: { '@id': MAHA_ORGANIZATION_ID },
  about: [{ '@type': 'Thing', name: 'Data provenance' }, { '@type': 'Thing', name: 'Research integrity' }, { '@type': 'Thing', name: 'AI-assisted research' }],
}

export default function ClaimLevelProvenancePage() {
  return <main className="evidence-page"><div className="evidence-container"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <article>
      <Link href="/mps/learn" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← MPS Learning Center</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ MPS/0.1 · practical guide ]</p>
      <h1 className="evidence-title evidence-title--product max-w-3xl">What is claim-level provenance?</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]"><strong>Claim-level provenance is the record that stays attached to a substantive assertion:</strong> what it says, where it came from, how it is framed, what it does not establish, and when it was last checked.</p>

      <section className="mt-14 space-y-5 text-lg leading-relaxed text-[var(--text-secondary)]"><p>A bibliography can show that a document contains sources. It cannot, by itself, show which source supports which sentence, whether that sentence is an observation or an interpretation, or whether the author has verified the source rather than repeated it.</p><p>That distinction matters more when text is copied into a brief, quoted in a slide, or supplied as context to an AI system. A sentence often travels without its footnote, caveat, or surrounding disagreement. Claim-level provenance treats those qualifications as part of the claim record rather than decoration around it.</p></section>

      <section className="mt-14"><h2 className="evidence-section-title">The minimum useful record</h2><div className="mt-6 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-default)]">{record.map(([label, description]) => <div key={label} className="grid gap-2 py-5 md:grid-cols-[10rem_1fr]"><h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</h3><p className="leading-relaxed text-[var(--text-secondary)]">{description}</p></div>)}</div></section>

      <section className="mt-14 grid gap-8 border-y border-[var(--border-default)] py-10 md:grid-cols-2"><div><h2 className="evidence-section-title">A concrete example</h2><p className="mt-4 leading-relaxed text-[var(--text-secondary)]">The De Sitter Atlas gives each concise statement a stable identifier, a status label, an explanation, a limitation, and source IDs. A reader can inspect a single claim instead of treating a whole page as equally certain.</p><a className="mt-5 inline-block text-[var(--text-primary)] underline underline-offset-4 hover:text-[var(--text-primary)]" href="https://research.mahastrategies.com/atlas/de-sitter-swampland/claims/ds-001">Inspect atlas claim ds-001 ↗</a></div><div><h2 className="evidence-section-title">What it does not do</h2><p className="mt-4 leading-relaxed text-[var(--text-secondary)]">A well-formed record does not establish truth. It makes a claim easier to challenge, update, and reuse responsibly. The primary source may still be wrong, incomplete, contested, or misapplied.</p></div></section>

      <section className="mt-14"><h2 className="evidence-section-title">Use it in practice</h2><ol className="mt-5 list-decimal space-y-3 pl-6 leading-relaxed text-[var(--text-secondary)]"><li>Write the claim in a form that can be checked.</li><li>Name its epistemic status before expanding its rhetoric.</li><li>Link the best available source or explicitly name the source gap.</li><li>State the boundary: what a reader must not infer from it.</li><li>Publish a revision trail when the wording or evidence changes.</li></ol></section>

      <MpsLearningLinks current="/mps/claim-level-provenance" />
      <section className="mt-10 flex flex-wrap gap-4"><Link href="/audit" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Try the free Auditor</Link><Link href="/mps" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Read MPS/0.1</Link></section>
    </article>
    </div>
  </main>
}
