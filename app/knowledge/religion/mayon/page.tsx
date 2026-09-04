import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  MAYON_CLAIMS,
  MAYON_CONNECTIONS,
  MAYON_GOVERNANCE,
  MAYON_KNOWLEDGE_DATE,
  MAYON_KNOWLEDGE_PATH,
  MAYON_KNOWLEDGE_VERSION,
  MAYON_MODERN_BRIDGES,
  MAYON_OPEN_QUESTIONS,
  MAYON_SOURCES,
} from '@/lib/mayon-knowledge'
import { MAYON_ANSWER_ENTRIES, MAYON_ANSWER_REGISTRY_PATH, MAYON_CORPUS_DEPTH, MAYON_TOPICS, mayonTopicPath } from '@/lib/mayon-topics'
import { RELIGION_KNOWLEDGE_PATH } from '@/lib/religion-knowledge'
import { TAMIL_CLASSICAL_PATH } from '@/lib/tamil-classical-traditions'
import { TAMIL_SOURCE_ATLAS_PATH } from '@/lib/tamil-source-atlas'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Māyōṉ (Mayon): Early Tamil Sources and Connections | Maha Strategies',
  description: 'A source-bound guide to Māyōṉ in early Tamil literature, the mullai landscape, Tirumāl, Vishnu, Krishna, Balarama, and the limits of each identification.',
  alternates: { canonical: MAYON_KNOWLEDGE_PATH },
  openGraph: {
    type: 'article',
    title: 'Māyōṉ (Mayon): Early Tamil Sources and Connections',
    description: 'Direct attestations, historical interpretations, typed deity relationships, and unresolved questions.',
    url: `${SITE_URL}${MAYON_KNOWLEDGE_PATH}`,
    siteName: 'Maha Strategies',
  },
}

const relationshipLabels = {
  'name-used-in-the-same-cultic-complex': 'Cultic-name relation',
  'traditional-identification': 'Traditional identification',
  'mythic-parallel': 'Mythic parallel',
  'contrastive-co-attestation': 'Contrastive co-attestation',
  'associated-figure': 'Associated figure',
} as const

const modernBridgeLabels = {
  'namesake-disambiguation': 'Namesake / disambiguation',
  'modern-educational-application': 'Modern educational application',
  'modern-editorial-bridge': 'Modern editorial bridge',
} as const

export default function MayonPage() {
  const explanatorySources = MAYON_SOURCES.filter((source) => source.contentInspected && source.explanatoryEligible)
  const bibliographicSources = MAYON_SOURCES.filter((source) => source.frame === 'bibliographic-record')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: 'Māyōṉ (Mayon): Early Tamil Sources and Connections',
    description: metadata.description,
    datePublished: MAYON_KNOWLEDGE_DATE,
    dateModified: MAYON_KNOWLEDGE_DATE,
    mainEntityOfPage: `${SITE_URL}${MAYON_KNOWLEDGE_PATH}`,
    isPartOf: `${SITE_URL}${RELIGION_KNOWLEDGE_PATH}`,
    citation: explanatorySources.map((source) => source.url),
    about: ['Māyōṉ', 'Mayon', 'Tirumāl', 'early Tamil religion', 'Paripāṭal', 'Tolkāppiyam'],
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-teal-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span>
          <Link href={RELIGION_KNOWLEDGE_PATH} className="hover:text-white">Religion and contemplative traditions</Link><span className="px-2">/</span>
          <span className="text-zinc-400">Māyōṉ</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-300">Early Tamil source dossier · {MAYON_KNOWLEDGE_VERSION}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Māyōṉ: begin with the Tamil texts, then type every connection.</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">Māyōṉ is an early Tamil divine name directly attested in the Tolkāppiyam’s landscape system. Later and denser Tirumāl material shares names, attributes, and narratives with Vishnu, Krishna, Narayana, and Balarama traditions—but those relations must be dated and sourced rather than collapsed into a timeless equation.</p>
        </header>

        <section className="mt-8 border border-amber-900/60 bg-amber-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Wider Tamil context</p><p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">Continue into the full landscape-deity stanza, Paripāṭal’s Tirumāl, Cevvēḷ and Vaiyai groupings, occurrence-level divine epithets, and later Āḻvār reception.</p><div className="mt-4 flex flex-wrap gap-5"><Link href={TAMIL_CLASSICAL_PATH} className="text-xs text-amber-300 underline underline-offset-4 hover:text-white">Explore classical Tamil traditions →</Link><Link href={TAMIL_SOURCE_ATLAS_PATH} className="text-xs text-amber-300 underline underline-offset-4 hover:text-white">Open 48 source-level guides →</Link></div></section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-teal-900/60 bg-teal-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">Direct attestation</p><p className="mt-3 text-sm leading-6 text-zinc-400">The inspected Tolkāppiyam text names Māyōṉ and places him with mullai, the forest or pastoral landscape.</p></div>
          <div className="border border-amber-900/60 bg-amber-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">Historical relation</p><p className="mt-3 text-sm leading-6 text-zinc-400">Tirumāl, Vishnu, Krishna, and Balarama connections are recorded as named scholarly interpretations or textual parallels.</p></div>
          <div className="border border-rose-900/60 bg-rose-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No identity shortcut</p><p className="mt-3 text-sm leading-6 text-zinc-400">A shared color, weapon, landscape, or mythic episode is evidence for comparison, not automatic proof of origin or equivalence.</p></div>
        </section>

        <section className="mt-14 border-t border-zinc-800 pt-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Source-bound topic system</p><h2 className="mt-3 text-3xl font-semibold text-white">Fifteen focused answers, not one flattened biography</h2></div>
            <Link href={MAYON_ANSWER_REGISTRY_PATH} className="font-mono text-[10px] uppercase tracking-widest text-teal-300 underline decoration-teal-900 underline-offset-4 hover:text-white">{MAYON_ANSWER_ENTRIES.length} machine-readable questions →</Link>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-500">Each page carries its own direct answer, claim-level locators, bounded comparison, limitations, unresolved questions, and typed relationships. Reuse is allowed only where the same inspected passage supports the new question.</p>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{MAYON_TOPICS.map((topic) => <Link key={topic.slug} href={mayonTopicPath(topic)} className="group border border-zinc-800 bg-zinc-950/50 p-5 hover:border-teal-600/60"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{topic.answerClass.replaceAll('-', ' ')}</p><h3 className="mt-3 text-lg font-semibold text-white group-hover:text-teal-200">{topic.shortTitle}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{topic.description}</p></Link>)}</div>
        </section>

        <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_330px]">
          <article>
            <section className="border-l-2 border-teal-500 bg-teal-950/10 p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Direct answer</p>
              <p className="mt-3 font-serif text-lg leading-8 text-zinc-200">The safest concise description is “an early Tamil deity associated in the Tolkāppiyam with mullai.” Calling Māyōṉ simply a “Dravidian Krishna” or a wholly separate “Dravidian god” goes beyond that direct evidence. The historically useful question is how Māyōṉ–Tirumāl traditions came to overlap with, differ from, and be identified with Vishnu–Krishna traditions in particular texts and periods.</p>
            </section>

            <section className="mt-14">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Claim-level evidence</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">What the inspected sources establish</h2>
              <div className="mt-7 space-y-6">
                {MAYON_CLAIMS.map((claim) => (
                  <section key={claim.id} className="border border-zinc-800 bg-zinc-950/60 p-6">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-widest">
                      <span className={claim.frame === 'primary-text' ? 'text-teal-300' : 'text-amber-300'}>{claim.frame.replaceAll('-', ' ')}</span>
                      {claim.sourceIds.map((sourceId) => <a key={sourceId} href={`#source-${sourceId}`} className="text-zinc-500 hover:text-white">[{sourceId}]</a>)}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">{claim.heading}</h3>
                    <p className="mt-3 font-serif text-base leading-7 text-zinc-300">{claim.statement}</p>
                    <div className="mt-4 space-y-1 text-xs leading-5 text-zinc-500">
                      {claim.sourceIds.map((sourceId) => <p key={sourceId}><span className="text-zinc-300">{sourceId}:</span> {claim.sourceLocators[sourceId]}</p>)}
                    </div>
                    <p className="mt-3 border-l border-rose-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-rose-300">Limit:</span> {claim.limitation}</p>
                  </section>
                ))}
              </div>
            </section>

            <section className="mt-14 border-t border-zinc-800 pt-9">
              <p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Relationship graph</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Connected does not mean identical</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-500">Each edge below states what kind of relationship the evidence supports. The edge type is part of the claim; it cannot be silently upgraded from co-attestation or parallel to identity.</p>
              <div className="mt-7 grid gap-4 md:grid-cols-2">
                {MAYON_CONNECTIONS.map((connection) => (
                  <article key={connection.name} className="border border-zinc-800 p-5">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{relationshipLabels[connection.relationship]}</p>
                    <h3 className="mt-3 text-lg font-semibold text-white">{connection.name}{connection.tamil ? <span className="ml-2 text-sm font-normal text-zinc-500">{connection.tamil}</span> : null}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{connection.basis}</p>
                    <p className="mt-3 text-xs leading-5 text-amber-200/70"><span className="text-amber-300">Boundary:</span> {connection.boundary}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-14 border-t border-zinc-800 pt-9">
              <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Modern Maha concept bridges</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Mayon the deity and Mayon the volcano are distinct referents</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-500">Maha uses “Mayon” elsewhere for a volcano explorer and its educational project. Those links belong in the knowledge graph, but in a separate modern layer. They are navigation and editorial connections—not evidence that the early Tamil divine name and the Philippine volcano share an origin.</p>
              <div className="mt-7 grid gap-4 md:grid-cols-2">
                {MAYON_MODERN_BRIDGES.map((bridge) => (
                  <Link key={bridge.path} href={bridge.path} className="group border border-sky-900/60 bg-sky-950/10 p-5 hover:border-sky-500/70">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-sky-300">{modernBridgeLabels[bridge.relationship]}</p>
                    <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-sky-200">{bridge.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{bridge.basis}</p>
                    <p className="mt-3 text-xs leading-5 text-amber-200/70"><span className="text-amber-300">Boundary:</span> {bridge.boundary}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-14 border-t border-zinc-800 pt-9">
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Research frontier</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Questions the first dossier does not settle</h2>
              <ul className="mt-6 space-y-3">{MAYON_OPEN_QUESTIONS.map((question) => <li key={question} className="border-l border-amber-800/60 pl-4 text-sm leading-6 text-zinc-400">{question}</li>)}</ul>
            </section>

            <section className="mt-14 border-t border-zinc-800 pt-9">
              <h2 className="text-3xl font-semibold text-white">Inspected sources</h2>
              <ol className="mt-7 space-y-6">{explanatorySources.map((source) => <li key={source.id} id={`source-${source.id}`} className="scroll-mt-24 border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><span className="text-zinc-600"> · {source.publisher}</span><p className="mt-2 text-xs text-zinc-500"><span className="text-zinc-300">Version:</span> {source.version}</p><p className="mt-2 text-xs text-zinc-500"><span className="text-zinc-300">Inspected locator:</span> {source.inspectedLocator}</p><p className="mt-2 text-xs text-zinc-500"><span className="text-zinc-300">Establishes:</span> {source.establishes}</p><p className="mt-2 text-xs text-amber-200/70"><span className="text-amber-300">Boundary:</span> {source.boundary}</p></li>)}</ol>
              {bibliographicSources.length > 0 && <div className="mt-8 border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Bibliographic controls · not explanatory evidence</p>{bibliographicSources.map((source) => <p key={source.id} className="mt-3 text-xs leading-5 text-zinc-500"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-4">{source.title}</a> is used only to reconcile catalogue and edition metadata.</p>)}</div>}
            </section>
          </article>

          <aside className="space-y-8">
            <div className="border border-teal-900/50 bg-teal-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Corpus depth</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Topic pages</dt><dd className="mt-1 text-zinc-300">{MAYON_CORPUS_DEPTH.before.topicPages} → {MAYON_CORPUS_DEPTH.after.topicPages}</dd></div><div><dt className="text-zinc-600">Source-bound claims</dt><dd className="mt-1 text-zinc-300">{MAYON_CORPUS_DEPTH.before.sourceBoundClaims} → {MAYON_CORPUS_DEPTH.after.sourceBoundClaims}</dd></div><div><dt className="text-zinc-600">Answer questions</dt><dd className="mt-1 text-zinc-300">{MAYON_CORPUS_DEPTH.before.generativeQuestions} → {MAYON_CORPUS_DEPTH.after.generativeQuestions}</dd></div><div><dt className="text-zinc-600">Minimum dimensions</dt><dd className="mt-1 text-zinc-300">{MAYON_CORPUS_DEPTH.after.informationDimensionsPerTopic} / 9</dd></div></dl></div>
            <div className="border border-zinc-800 bg-zinc-950/60 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence coverage</p>
              <dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Claims</dt><dd className="mt-1 text-zinc-300">{MAYON_CLAIMS.length} / {MAYON_CLAIMS.length} source-bound</dd></div><div><dt className="text-zinc-600">Exact locators</dt><dd className="mt-1 text-zinc-300">{MAYON_GOVERNANCE.claimsWithExactLocators} / {MAYON_CLAIMS.length}</dd></div><div><dt className="text-zinc-600">Primary-text claims</dt><dd className="mt-1 text-zinc-300">{MAYON_GOVERNANCE.primaryTextClaims}</dd></div><div><dt className="text-zinc-600">Scholarly interpretations</dt><dd className="mt-1 text-zinc-300">{MAYON_GOVERNANCE.scholarlyInterpretations}</dd></div></dl>
            </div>
            <div className="border border-rose-900/50 bg-rose-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Prohibited inferences</p><ul className="mt-4 space-y-3">{MAYON_GOVERNANCE.prohibitedInferences.map((item) => <li key={item} className="text-xs leading-5 text-zinc-400">{item}</li>)}</ul></div>
            <div className="border border-teal-900/50 bg-teal-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Next evidence layer</p><p className="mt-3 text-sm leading-6 text-zinc-400">The next batch will index every Māyōṉ, Māl, Tirumāl, and Neṭiyōṉ occurrence in the early Tamil corpus, then add manuscript, inscriptional, iconographic, and reception-history evidence without mixing their authority.</p></div>
          </aside>
        </div>

        <section className="mt-16 border-t border-zinc-800 pt-9"><Link href={RELIGION_KNOWLEDGE_PATH} className="font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:text-white">Return to religion methodology →</Link></section>
      </div>
    </main>
  )
}
