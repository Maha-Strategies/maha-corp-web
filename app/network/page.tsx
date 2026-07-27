import type { Metadata } from 'next'
import Link from 'next/link'
import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const pageUrl = `${MAHA_SITE_URL}/network`

export const metadata: Metadata = {
  title: 'Maha Knowledge Network | Projects, research, and tools',
  description: 'A transparent map of the public research, educational tools, publishing systems, and books connected to Maha Strategies and Mayone Maha Rajan.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Maha Knowledge Network',
    description: 'A transparent map of the public research, educational tools, publishing systems, and books connected to Maha Strategies.',
    url: pageUrl,
    type: 'website',
  },
}

const nodes = [
  {
    label: 'Educational field trip',
    name: 'Mayon Rajan',
    href: 'https://mayonrajan.com/learn/sources/',
    description: 'A free, true-scale educational visualization of Mayon Volcano, with a public methods record and claim-level source registry.',
    relationship: 'Published and maintained by Maha Strategies. Its volcanology context is complemented—but not validated—by the Volcanic Engine working paper.',
  },
  {
    label: 'Open research',
    name: 'Maha Strategies Research',
    href: 'https://research.mahastrategies.com/',
    description: 'Working papers and synthesis projects, visibly labelled with provenance, verification state, and non-peer-reviewed status where applicable.',
    relationship: 'An independent research surface for hypotheses and references; it links to Mayon only as an educational companion where relevant.',
  },
  {
    label: 'Publishing system',
    name: 'Agentic Book Publishing',
    href: 'https://publish.mahastrategies.com/guides/agentic-publishing-architecture',
    description: 'Tools and technical documentation for source-aware, accountable publishing workflows and author query preparation.',
    relationship: 'A Maha Strategies product line. It is not a source of scientific authority for the research or educational projects.',
  },
  {
    label: 'Book and program',
    name: 'The Maha Principle',
    href: 'https://themahaprinciple.com/framework',
    description: 'A book-led research program by Mayone Maha Rajan, with public framework, research, and application references.',
    relationship: 'Book text remains governed by its publishing terms; this network links only to permitted marketing, framework, research, and app material.',
  },
]

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'CollectionPage', '@id': `${pageUrl}#page`, url: pageUrl, name: 'Maha Knowledge Network', isPartOf: { '@id': `${MAHA_SITE_URL}/#website` }, about: [{ '@id': MAHA_ORGANIZATION_ID }, { '@id': MAYONE_MAHA_RAJAN_ID }] },
    { '@type': 'Organization', '@id': MAHA_ORGANIZATION_ID, name: 'Maha Strategies LLC', url: MAHA_SITE_URL, subjectOf: { '@id': `${pageUrl}#page` } },
    { '@type': 'WebApplication', '@id': 'https://mayonrajan.com/#application', name: 'Mayon Rajan', url: 'https://mayonrajan.com/', applicationCategory: 'EducationalApplication', publisher: { '@id': MAHA_ORGANIZATION_ID }, isAccessibleForFree: true },
    { '@type': 'ScholarlyArticle', '@id': 'https://research.mahastrategies.com/papers/the-volcanic-engine-thesis#article', name: 'The Volcanic Engine', url: 'https://research.mahastrategies.com/papers/the-volcanic-engine-thesis', isPartOf: { '@type': 'WebSite', url: 'https://research.mahastrategies.com/' }, creativeWorkStatus: 'Preprint' },
    { '@type': 'SoftwareApplication', '@id': 'https://publish.mahastrategies.com/#application', name: 'Agentic Book Publishing', url: 'https://publish.mahastrategies.com/', publisher: { '@id': MAHA_ORGANIZATION_ID } },
    { '@type': 'Book', '@id': 'https://themahaprinciple.com/#book', name: 'The Maha Principle: The Architecture of Human Flourishing', url: 'https://themahaprinciple.com/', author: { '@id': MAYONE_MAHA_RAJAN_ID } },
  ],
}

export default function KnowledgeNetworkPage() {
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-4xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Public entity and relationship map ]</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-light tracking-tight text-white sm:text-6xl">The Maha Knowledge Network</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300">A transparent guide to the public projects connected to Maha Strategies and Mayone Maha Rajan—what each one is for, who operates it, and where its authority begins and ends.</p>

      <section className="mt-14 border border-amber-900/50 bg-amber-950/10 p-7 text-sm leading-relaxed text-zinc-300">
        <h2 className="text-lg font-medium text-amber-100">How to read this map</h2>
        <p className="mt-3">A shared founder or publisher does not make one project evidence for another. Mayon&apos;s educational visualization follows its own methods and source record. Research papers state their own verification status. Publishing tools describe workflow infrastructure. Book material is limited to what may be made public under its publishing terms.</p>
      </section>

      <section className="mt-14 grid gap-6">
        {nodes.map((node) => <article key={node.name} className="border border-zinc-800 bg-[#0d1112] p-7 sm:p-9">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ {node.label} ]</p>
          <h2 className="mt-4 text-3xl font-light text-white"><a className="hover:text-cyan-200" href={node.href}>{node.name}</a></h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">{node.description}</p>
          <p className="mt-5 border-l border-cyan-700 pl-4 text-sm leading-relaxed text-zinc-300"><span className="font-medium text-white">Relationship:</span> {node.relationship}</p>
          <a className="mt-6 inline-block text-sm text-cyan-100 underline" href={node.href}>Open the relevant public page ↗</a>
        </article>)}
      </section>

      <section className="mt-16 border-t border-zinc-800 pt-10">
        <h2 className="text-2xl text-white">Primary operator</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">Maha Strategies LLC is an independent research, publishing, and technology-architecture organization, and the operating organization for the public applications and publishing tools above. <Link className="text-cyan-100 underline" href="/about">Read about Maha Strategies and Mayone Maha Rajan</Link>, or use the project-specific pages above for purpose, evidence, status, and contact boundaries.</p>
      </section>
    </article>
  </main>
}
