import type { Metadata } from 'next'
import Link from 'next/link'
import {
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_KIND_META,
  SEMICONDUCTOR_STAGES,
  SEMICONDUCTOR_STAGE_META,
  knowledgeArticlePath,
} from '@/lib/knowledge-data'
import { SITE_URL } from '@/lib/briefs-data'
import { SEMICONDUCTOR_PROCESS_MAP_PATH, getProcessMapStepCount } from '@/lib/semiconductor-process-map'
import { KNOWLEDGE_SUPPLIERS } from '@/lib/knowledge-process-profiles'
import {
  CELESTIAL_AUTHORITY_SOURCES,
  CELESTIAL_FACT_PATH,
  CELESTIAL_FACT_SCHEMA_VERSION,
} from '@/lib/celestial-facts'
import {
  ASTRONOMY_ARTICLES,
  ASTRONOMY_KNOWLEDGE_PATH,
  ASTRONOMY_KNOWLEDGE_VERSION,
  ASTRONOMY_SOURCES,
} from '@/lib/astronomy-knowledge'
import { ASTROLOGY_PATH, ASTROLOGY_RULES, ASTROLOGY_TRADITIONS, ASTROLOGY_VERSION } from '@/lib/astrology-traditions'
import { PANCHANGA_VERSION } from '@/lib/panchanga'
import {
  MATHEMATICAL_BRIDGES,
  MATHEMATICAL_CONCEPTS,
  MATHEMATICS_KNOWLEDGE_PATH,
  MATHEMATICS_KNOWLEDGE_VERSION,
} from '@/lib/mathematics-knowledge'
import {
  RELIGION_COMPARISONS,
  RELIGION_CONCEPTS,
  RELIGION_KNOWLEDGE_PATH,
  RELIGION_KNOWLEDGE_VERSION,
} from '@/lib/religion-knowledge'
import { NEUROMORPHIC_COMPARISONS, NEUROMORPHIC_CONCEPTS, NEUROMORPHIC_PATH, NEUROMORPHIC_VERSION } from '@/lib/neuromorphic-biocomputing'
import { EPISTEMIC_DOMAINS, EPISTEMIC_SYSTEM_PATH, PUBLIC_EPISTEMIC_RECORDS } from '@/lib/epistemic-pilots'
import { KNOWLEDGE_INTEGRATIONS_PATH } from '@/lib/knowledge-integration-evidence'
import styles from './knowledge-cyber-light.module.css'

export const metadata: Metadata = {
  title: 'Knowledge | Maha Strategies',
  description: 'A cited, provenance-aware knowledge system spanning technical domains and foundational source layers.',
  alternates: { canonical: '/knowledge' },
  openGraph: {
    title: 'Knowledge | Maha Strategies',
    description: 'Trace complex domains from source-governed facts through evidence, technical explanations, and strategic implications.',
    url: `${SITE_URL}/knowledge`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies Knowledge' }],
  },
}

const kindOrder = ['domain', 'process', 'material', 'equipment', 'concept'] as const

export default function KnowledgePage() {
  const sortedArticles = [...KNOWLEDGE_ARTICLES].sort((a, b) => {
    const firstStage = Math.min(...a.stageIds.map((id) => SEMICONDUCTOR_STAGE_META[id].order))
    const secondStage = Math.min(...b.stageIds.map((id) => SEMICONDUCTOR_STAGE_META[id].order))
    return firstStage - secondStage || a.title.localeCompare(b.title)
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Maha Strategies Knowledge',
    description: metadata.description,
    url: `${SITE_URL}/knowledge`,
    hasPart: [
      {
        '@type': 'Dataset',
        name: 'Maha Celestial Fact Layer',
        url: `${SITE_URL}${CELESTIAL_FACT_PATH}`,
        version: CELESTIAL_FACT_SCHEMA_VERSION,
      },
      {
        '@type': 'CollectionPage',
        name: 'Maha Astronomy Knowledge',
        url: `${SITE_URL}${ASTRONOMY_KNOWLEDGE_PATH}`,
        version: ASTRONOMY_KNOWLEDGE_VERSION,
      },
      {
        '@type': 'CollectionPage',
        name: 'Maha Mathematics Knowledge System',
        url: `${SITE_URL}${MATHEMATICS_KNOWLEDGE_PATH}`,
        version: MATHEMATICS_KNOWLEDGE_VERSION,
      },
      {
        '@type': 'CollectionPage',
        name: 'Religion and contemplative traditions',
        url: `${SITE_URL}${RELIGION_KNOWLEDGE_PATH}`,
        version: RELIGION_KNOWLEDGE_VERSION,
      },
      { '@type': 'CollectionPage', name: 'Neuromorphic and biocomputing', url: `${SITE_URL}${NEUROMORPHIC_PATH}`, version: NEUROMORPHIC_VERSION },
      { '@type': 'TechArticle', name: 'Maha Epistemic Publication System', url: `${SITE_URL}${EPISTEMIC_SYSTEM_PATH}` },
      { '@type': 'CollectionPage', name: 'Integration Evidence', url: `${SITE_URL}${KNOWLEDGE_INTEGRATIONS_PATH}` },
      ...EPISTEMIC_DOMAINS.map((domain) => ({ '@type': 'CollectionPage', name: domain.name, url: `${SITE_URL}/knowledge/${domain.slug}` })),
      ...KNOWLEDGE_ARTICLES.map((article) => ({
        '@type': 'TechArticle',
        name: article.title,
        url: `${SITE_URL}${knowledgeArticlePath(article)}`,
      })),
    ],
  }

  return (
    <main className={`${styles.indexPage} min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-cyan-400 selection:text-black`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <section className={`${styles.indexHero} border-b border-zinc-800 px-6 sm:px-12`}>
        <div className="mx-auto max-w-6xl">
          <p className={styles.indexKicker}>[ Phase 2 // Evidence architecture // Source to strategy ]</p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-end">
            <div>
              <h1 className={`${styles.indexTitle} max-w-4xl text-white`}>Understand the machinery beneath the brief.</h1>
              <p className={`${styles.indexLede} mt-6 max-w-3xl text-zinc-400`}>Knowledge separates source-governed facts from domain explanations and strategic analysis. Every technical claim carries a citation or an explicit analytical boundary; every article can link back to the immutable facts and Intelligence decisions it supports.</p>
              <Link href={SEMICONDUCTOR_PROCESS_MAP_PATH} className={`${styles.indexAction} ${styles.indexActionPrimary} mt-8`}>
                Explore the complete {getProcessMapStepCount()}-node semiconductor process map →
              </Link>
              <Link href="/knowledge/suppliers" className={`${styles.indexAction} ml-0 mt-3 sm:ml-3`}>
                Browse {KNOWLEDGE_SUPPLIERS.length} supplier profiles →
              </Link>
            </div>
            <div className={`${styles.snapshotPanel} border border-zinc-800 bg-zinc-950 p-5 font-mono text-xs leading-6 text-zinc-500`}>
              <p className="text-zinc-200">Universal publication gateway plus governed domain surfaces</p>
              <p>{KNOWLEDGE_ARTICLES.length} published semiconductor nodes</p>
              <p>{KNOWLEDGE_SUPPLIERS.length} evidence-bounded supplier profiles</p>
              <p>{SEMICONDUCTOR_STAGES.length} lifecycle stages</p>
              <p>{CELESTIAL_AUTHORITY_SOURCES.length} celestial authority contracts</p>
              <p>{ASTRONOMY_ARTICLES.length} Astronomy explainers</p>
              <p>{MATHEMATICAL_CONCEPTS.length} mathematical concepts · {MATHEMATICAL_BRIDGES.length} bridges</p>
              <p>{RELIGION_CONCEPTS.length} religion methods · {RELIGION_COMPARISONS.length} comparisons</p>
              <p>{NEUROMORPHIC_CONCEPTS.length} neuromorphic/biocomputing concepts · {NEUROMORPHIC_COMPARISONS.length} comparisons</p>
              <p>{EPISTEMIC_DOMAINS.length} governed technical domains · {PUBLIC_EPISTEMIC_RECORDS.length} canonical records</p>
              <p>Claim-level evidence status</p>
              <p>Bidirectional Intelligence links</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <div className={styles.domainHeadingRow}>
            <p className={styles.domainHeading}>Knowledge domains</p>
            <div className={styles.spectrumRule} aria-hidden="true" />
          </div>
          <div className={`${styles.domainGrid} mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3`}>
            <Link href={SEMICONDUCTOR_PROCESS_MAP_PATH} className="group border border-zinc-800 bg-zinc-950/60 p-6 transition-colors hover:border-cyan-500/50">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Technical knowledge system</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-cyan-200">Semiconductor manufacturing</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">A process graph spanning design, materials, equipment, defects, metrology, packaging, suppliers, and supporting Intelligence briefs.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-cyan-400">Explore {getProcessMapStepCount()} process nodes →</p>
            </Link>
            <Link href={CELESTIAL_FACT_PATH} className="group border border-sky-900/60 bg-sky-950/10 p-6 transition-colors hover:border-sky-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Foundational source layer · {CELESTIAL_FACT_SCHEMA_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-sky-200">Celestial facts</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">A reproducible contract for time, observer, ephemeris, reference frame, corrections, coordinates, and source provenance.</p>
              <p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-amber-200">Fact layer only. Explanation and interpretation remain outside this contract.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-sky-300">Inspect {CELESTIAL_AUTHORITY_SOURCES.length} authority contracts →</p>
            </Link>
            <Link href={ASTRONOMY_KNOWLEDGE_PATH} className="group border border-indigo-900/60 bg-indigo-950/10 p-6 transition-colors hover:border-indigo-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">Explanatory layer · {ASTRONOMY_KNOWLEDGE_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-indigo-200">Astronomy knowledge</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">A cited graph from observation and calibration through physical models, inference boundaries, and open questions.</p>
              <p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-amber-200">Scientific explanation only. Astrological interpretation is outside this layer.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-indigo-300">Explore {ASTRONOMY_ARTICLES.length} explainers · {ASTRONOMY_SOURCES.length} sources →</p>
            </Link>
            <Link href={MATHEMATICS_KNOWLEDGE_PATH} className="group border border-emerald-900/60 bg-emerald-950/10 p-6 transition-colors hover:border-emerald-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Connective grammar · {MATHEMATICS_KNOWLEDGE_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-emerald-200">Mathematics knowledge</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Geometry, time, numerical methods, statistics, networks, and decision procedures connected to each domain through explicit typed records.</p>
              <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-rose-200">Shared mathematics does not transfer scientific validity between physical models and interpretive traditions.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-emerald-300">Inspect {MATHEMATICAL_CONCEPTS.length} concepts · {MATHEMATICAL_BRIDGES.length} bridges →</p>
            </Link>
            <Link href={RELIGION_KNOWLEDGE_PATH} className="group border border-teal-900/60 bg-teal-950/10 p-6 transition-colors hover:border-teal-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Methodology layer · {RELIGION_KNOWLEDGE_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-teal-200">Religion and contemplative traditions</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Textual authority, translation, historical evidence, lived practice, theology, first-person experience, and empirical claims kept in their proper evidentiary frames.</p>
              <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-rose-200">The system documents and compares claims. It does not rank traditions or certify sacred and metaphysical propositions.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-teal-300">Inspect {RELIGION_CONCEPTS.length} methods · {RELIGION_COMPARISONS.length} comparisons →</p>
            </Link>
            <Link href={NEUROMORPHIC_PATH} className="group border border-lime-900/60 bg-lime-950/10 p-6 transition-colors hover:border-lime-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-lime-300">Substrate-aware technical layer · {NEUROMORPHIC_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-lime-200">Neuromorphic and biocomputing</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Spiking models, neuromorphic hardware, living neural cultures, molecular computation, bioelectronic interfaces, and hybrid systems under separate evidence contracts.</p>
              <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-rose-200">Activity and task performance do not certify consciousness or intelligence; research demonstrations do not imply deployment readiness.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-lime-300">Inspect {NEUROMORPHIC_CONCEPTS.length} concepts · {NEUROMORPHIC_COMPARISONS.length} comparisons →</p>
            </Link>
            <Link href={EPISTEMIC_SYSTEM_PATH} className="group border border-cyan-900/60 bg-cyan-950/10 p-6 transition-colors hover:border-cyan-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Publication gateway · maha-epistemic/1.0</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-cyan-200">Epistemic publication system</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">A multi-axis schema, source-rights contract, deterministic provenance hash, and enforceable gate between machine records and public pages.</p>
              <p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-amber-200">A record’s existence does not make it publishable. Drafts and incomplete claims remain below the crawlable layer.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-cyan-300">Inspect the universal contract →</p>
            </Link>
            <Link href={KNOWLEDGE_INTEGRATIONS_PATH} className="group border border-emerald-900/60 bg-emerald-950/10 p-6 transition-colors hover:border-emerald-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">External evidence · bounded records</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-emerald-200">Integration evidence</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Crawlable reproductions and interoperability records with direct links to signed artifacts, upstream publications and explicit non-claims.</p>
              <p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-amber-200">These records document observed integrations. They are not silently promoted into canonical domain knowledge.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-emerald-300">Inspect integration evidence →</p>
            </Link>
            {EPISTEMIC_DOMAINS.map((domain) => {
              const accent = {
                blue: { card: 'border-blue-900/60 bg-blue-950/10 hover:border-blue-400', label: 'text-blue-300' },
                green: { card: 'border-emerald-900/60 bg-emerald-950/10 hover:border-emerald-400', label: 'text-emerald-300' },
                violet: { card: 'border-violet-900/60 bg-violet-950/10 hover:border-violet-400', label: 'text-violet-300' },
                amber: { card: 'border-amber-900/60 bg-amber-950/10 hover:border-amber-400', label: 'text-amber-300' },
              }[domain.accent]
              return (
              <Link key={domain.slug} href={`/knowledge/${domain.slug}`} className={`group border p-6 transition-colors ${accent.card}`}>
                <p className={`font-mono text-[10px] uppercase tracking-widest ${accent.label}`}>Governed frontier domain · maha-epistemic/1.0</p>
                <h2 className="mt-4 text-2xl font-semibold text-white group-hover:underline">{domain.name}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{domain.description}</p>
                <p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-amber-200">{domain.stressPoint}</p>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-cyan-300">Open governed domain →</p>
              </Link>
              )
            })}
            <Link href={ASTROLOGY_PATH} className="group border border-violet-900/60 bg-violet-950/10 p-6 transition-colors hover:border-violet-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Interpretive layer · {ASTROLOGY_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-violet-200">Astrology traditions</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Named interpretive traditions with passage-level provenance from rights-cleared sources, recorded with their disagreements.</p>
              <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-rose-200">Every rule is unvalidated tradition. Provenance is claimed; predictive validity is not, and the schema cannot express it.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-violet-300">Inspect {ASTROLOGY_TRADITIONS.length} traditions · {ASTROLOGY_RULES.length} rules →</p>
            </Link>
            <Link href="/knowledge/panchanga" className="group border border-amber-900/60 bg-amber-950/10 p-6 transition-colors hover:border-amber-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Calendrical layer · {PANCHANGA_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-amber-200">Pañcāṅga</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Tithi, nakshatra, yoga, karaṇa, and vāra computed live from Sun and Moon geometry with a stated ayanāṁśa and flagged boundaries.</p>
              <p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-amber-200">Calendar arithmetic only. Whether a moment is auspicious is a tradition claim and is not made here.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-amber-300">Compute for four reference cities →</p>
            </Link>
            <Link href="/knowledge/muhurta" className="group border border-violet-900/60 bg-violet-950/10 p-6 transition-colors hover:border-violet-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Compiled verdict · {ASTROLOGY_VERSION}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-violet-200">Muhūrta verdict</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">What the Jyotiṣa tradition holds about a chosen moment, compiled from the pañcāṅga with every source passage attached.</p>
              <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-rose-200">Every withheld rule is shown with its reason, so the reading cannot look stronger than it is.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-violet-300">Compile a moment →</p>
            </Link>
            <Link href="/knowledge/birth" className="group border border-violet-900/60 bg-violet-950/10 p-6 transition-colors hover:border-violet-400">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Compiled verdict · natal</p>
              <h2 className="mt-4 text-2xl font-semibold text-white group-hover:text-violet-200">Birth pañcāṅga</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Janma nakṣatra, tithi, yoga, karaṇa and vāra for a birth moment, with every sourced rule that applies to them.</p>
              <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-rose-200">Not a personality reading. Character, appearance and health rules are withheld by policy and shown as withheld.</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-violet-300">Enter a birth moment →</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Semiconductor taxonomy</p>
          <div className="mt-5 grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-2 lg:grid-cols-5">
            {kindOrder.map((kind) => {
              const meta = KNOWLEDGE_KIND_META[kind]
              const count = KNOWLEDGE_ARTICLES.filter((article) => article.kind === kind).length
              return (
                <div key={kind} className="bg-[#0a0a0c] p-5">
                  <p className="font-mono text-xs uppercase tracking-widest text-cyan-300">{meta.label} · {count}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{meta.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[240px_1fr]">
            <aside>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Semiconductor lifecycle</p>
              <ol className="mt-5 space-y-3 border-l border-zinc-800 pl-5">
                {SEMICONDUCTOR_STAGES.map((stage) => (
                  <li key={stage}>
                    <a href={`#${stage}`} className="font-mono text-xs text-zinc-400 transition-colors hover:text-cyan-300">{String(SEMICONDUCTOR_STAGE_META[stage].order).padStart(2, '0')} · {SEMICONDUCTOR_STAGE_META[stage].label}</a>
                  </li>
                ))}
              </ol>
              <div className="mt-9 border-l-2 border-amber-500/60 pl-4 text-xs leading-5 text-zinc-500">
                Articles may span several stages. They appear at the earliest stage they materially explain.
              </div>
            </aside>

            <div className="space-y-14">
              {SEMICONDUCTOR_STAGES.map((stage) => {
                const stageOrder = SEMICONDUCTOR_STAGE_META[stage].order
                const articles = sortedArticles.filter((article) => Math.min(...article.stageIds.map((id) => SEMICONDUCTOR_STAGE_META[id].order)) === stageOrder)
                return (
                  <section key={stage} id={stage} className="scroll-mt-24">
                    <div className="flex items-baseline gap-4 border-b border-zinc-800 pb-3">
                      <span className="font-mono text-xs text-cyan-400">{String(stageOrder).padStart(2, '0')}</span>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{SEMICONDUCTOR_STAGE_META[stage].label}</h2>
                        <p className="mt-1 text-sm text-zinc-500">{SEMICONDUCTOR_STAGE_META[stage].description}</p>
                      </div>
                    </div>
                    {articles.length > 0 ? (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {articles.map((article) => (
                          <Link key={article.id} href={knowledgeArticlePath(article)} className="group border border-zinc-800 bg-zinc-950/60 p-5 transition-colors hover:border-cyan-500/50">
                            <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-widest">
                              <span className="text-cyan-300">{KNOWLEDGE_KIND_META[article.kind].label}</span>
                              <span className="text-zinc-600">{article.status}</span>
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-cyan-200">{article.shortTitle}</h3>
                            <p className="mt-3 text-sm leading-6 text-zinc-500">{article.description}</p>
                            <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-cyan-400">Open technical article →</p>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 border border-dashed border-zinc-800 p-5 font-mono text-xs text-zinc-600">Research queue open.</div>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
