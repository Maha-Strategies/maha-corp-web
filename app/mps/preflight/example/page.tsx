import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'MPS Preflight sample report | What a claim map looks like',
  description: 'Inspect a transparent, illustrative MPS Preflight report: claim statuses, review rationale, a verification backlog, and the limits of an automated review.',
  alternates: { canonical: '/mps/preflight/example' },
}

const sampleClaims = [
  {
    id: 'C-01',
    label: 'ILLUSTRATIVE',
    excerpt: 'This fictional memo describes a team considering an on-device AI pilot.',
    rationale: 'This is scenario-setting language. It is not presented as a fact about a real organization and should remain clearly framed as an example.',
    action: 'Keep the scenario label in the published draft.',
  },
  {
    id: 'C-02',
    label: 'SOURCED',
    excerpt: 'The example cites a vendor statement that source text remains on the device.',
    rationale: 'The draft attributes a specific operational statement to a named source. A preflight records the attribution; it does not independently confirm the vendor claim.',
    action: 'Check the current primary documentation and version date.',
  },
  {
    id: 'C-03',
    label: 'UNVERIFIED',
    excerpt: 'The proposed pilot will eliminate privacy risk.',
    rationale: 'The conclusion is absolute, while the sample supplies neither a scope nor evidence that would support it. The claim needs qualification or evidence before publication.',
    action: 'Replace with a bounded claim and document residual risks.',
  },
  {
    id: 'C-04',
    label: 'BOUNDARY',
    excerpt: 'Whether residual risk is acceptable depends on deployment details absent from this example.',
    rationale: 'This marks the point where a claim map must stop. An automated review cannot decide policy, legal, security, or organizational acceptability.',
    action: 'Escalate to the appropriate subject-matter reviewer.',
  },
]

const tagStyles: Record<string, string> = {
  ILLUSTRATIVE: 'border-sky-300/30 bg-sky-300/10 text-sky-200',
  SOURCED: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200',
  UNVERIFIED: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
  BOUNDARY: 'border-zinc-500/50 bg-zinc-800 text-zinc-300',
}

export default function MpsPreflightExamplePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'MPS Preflight sample report',
    description: 'A transparent, illustrative example of an MPS Preflight claim map and verification backlog.',
    mainEntityOfPage: 'https://www.mahastrategies.com/mps/preflight/example',
    isPartOf: { '@type': 'WebSite', name: 'Maha Strategies', url: 'https://www.mahastrategies.com' },
    publisher: { '@type': 'Organization', '@id': 'https://www.mahastrategies.com/#organization', name: 'Maha Strategies LLC' },
    about: { '@type': 'Thing', name: 'Maha Provenance Standard' },
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <article className="mx-auto max-w-4xl">
        <Link href="/mps/preflight" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-white">← MPS Preflight</Link>

        <header className="mt-10 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Sample deliverable · not a client report ]</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.06] tracking-tight text-white sm:text-6xl">What does an MPS Preflight report look like?</h1>
          <p className="mt-7 text-lg leading-relaxed text-zinc-400">A private preflight converts a document extract into a claim map and a short, actionable verification backlog. This worked example shows the report structure—not an audit of a real text, organization, or source.</p>
        </header>

        <section className="mt-10 rounded-sm border border-indigo-300/20 bg-indigo-300/[0.06] p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-200">Transparency note</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">Every excerpt, source, and result below is fictional and written solely to demonstrate the MPS report format. No item is marked VERIFIED: this sample has no primary-source packet, and MPS Preflight is automated triage rather than human or primary-source verification.</p>
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">[ 01 · claim map ]</p>
              <h2 className="mt-3 text-2xl font-light text-white">Four representative status decisions</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Illustrative input · 4 claims</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {sampleClaims.map((claim) => (
              <section key={claim.id} className="py-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-[11px] tracking-widest text-zinc-500">{claim.id}</span>
                  <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-widest ${tagStyles[claim.label]}`}>{claim.label}</span>
                </div>
                <blockquote className="mt-4 border-l border-zinc-700 pl-5 text-lg leading-relaxed text-white">“{claim.excerpt}”</blockquote>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">{claim.rationale}</p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Next action: <span className="text-zinc-300">{claim.action}</span></p>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 border-y border-zinc-800 py-10 sm:grid-cols-3">
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ 02 ]</p><h2 className="mt-3 text-lg text-white">Claim map</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">Each extractable claim receives a readable MPS status and a reason.</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ 03 ]</p><h2 className="mt-3 text-lg text-white">Verification backlog</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">Prioritized next actions distinguish research work from judgment calls.</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ 04 ]</p><h2 className="mt-3 text-lg text-white">Report record</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">The private report includes a downloadable machine-readable record alongside the reading view.</p></div>
        </section>

        <section className="mt-16 grid gap-8 rounded-sm border border-zinc-800 bg-zinc-950 p-7 sm:grid-cols-[1.1fr_.9fr] sm:p-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Private MPS Preflight ]</p>
            <h2 className="mt-4 text-3xl font-light leading-tight text-white">Run this on your own draft.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">For $49, submit up to about 2,000 words and receive a private claim map, verification backlog, and downloadable record. Your source text is processed transiently; the report retains an input hash and its claim excerpts.</p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Link href="/mps/preflight" className="bg-white px-5 py-3 font-mono text-[11px] uppercase tracking-widest text-zinc-950 transition-colors hover:bg-indigo-200">Start a private preflight — $49</Link>
              <Link href="/audit" className="px-2 py-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400 underline underline-offset-4 hover:text-white">Try the free public preflight</Link>
            </div>
          </div>
          <aside className="border-t border-zinc-800 pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">[ Important limit ]</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">A preflight does not certify a document, perform primary-source verification, or replace legal, security, investment, medical, or other specialist review. For complete manuscripts or high-stakes decisions, <Link href="/contact" className="text-indigo-300 underline underline-offset-4 hover:text-white">request a human Evidence Audit</Link>.</p>
          </aside>
        </section>
      </article>
    </main>
  )
}
