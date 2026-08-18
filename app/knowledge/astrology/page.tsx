import type { Metadata } from 'next'
import Link from 'next/link'

import {
  ASTROLOGY_PATH,
  ASTROLOGY_PROHIBITED_USES,
  ASTROLOGY_REGISTRY_PATH,
  ASTROLOGY_RELEASE_DATE,
  ASTROLOGY_RULES,
  ASTROLOGY_SCHEMA_PATH,
  ASTROLOGY_SOURCES,
  ASTROLOGY_TRADITIONS,
  ASTROLOGY_VERSION,
  astrologyTraditionPath,
  getRulesForTradition,
} from '@/lib/astrology-traditions'
import { ASTRONOMY_KNOWLEDGE_PATH } from '@/lib/astronomy-knowledge'
import { SITE_URL } from '@/lib/briefs-data'
import { CELESTIAL_FACT_PATH } from '@/lib/celestial-facts'
import { CELESTIAL_GUIDE_LIST } from '@/lib/celestial-guides'
import { CALCULATION_REFERENCE_PATH, CALCULATION_REFERENCES } from '@/lib/celestial-calculation-references'
import { TIMING_REFERENCE_PATH, TIMING_REFERENCES } from '@/lib/celestial-timing-references'
import { CORPORATE_MUNDANE_PATH, CORPORATE_MUNDANE_REFERENCES } from '@/lib/corporate-mundane-references'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Astrology Traditions | Maha Strategies',
  description: 'Named interpretive traditions with passage-level provenance from public-domain sources. Records what traditions hold, not what is true.',
  alternates: { canonical: ASTROLOGY_PATH },
  openGraph: {
    type: 'website', title: 'Astrology Traditions | Maha Strategies',
    description: 'Tradition-scoped interpretation rules with verbatim source passages. Provenance is claimed; empirical validity is not.',
    url: `${SITE_URL}${ASTROLOGY_PATH}`, siteName: 'Maha Strategies',
  },
}

export default function AstrologyTraditionsPage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Astrology Traditions', url: `${SITE_URL}${ASTROLOGY_PATH}`,
    description: 'Named astrological traditions recorded with passage-level provenance and an explicit epistemic boundary.',
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">Astrology traditions</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{ASTROLOGY_VERSION} · released {ASTROLOGY_RELEASE_DATE}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Astrology traditions</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">
            Astrology is not recorded here as one body of knowledge. It is recorded as named interpretive traditions, each with its own sources, techniques, and disagreements. Every rule declares the tradition it belongs to, because a rule detached from its tradition belongs to none of them.
          </p>
        </header>

        <section className="mt-12 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">The epistemic boundary</h2>
          <p className="mt-3 max-w-3xl font-serif text-lg leading-8 text-zinc-200">
            Every rule in this layer is recorded as <span className="text-rose-300">unvalidated tradition</span>. That status is fixed in the schema and cannot be raised. This layer claims that a passage has been transcribed accurately from a named source. It does not claim, and cannot express, that any rule predicts anything.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            Provenance quality and empirical support are recorded on separate axes precisely so that a rule can be well-sourced and unsupported at the same time. Appearing in a respected old text is a fact about the text, not evidence about the world.
          </p>
        </section>

        <section className="mt-10 border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Prohibited uses</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">These apply to every rule in the registry without exception, and no generated report may produce them.</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {ASTROLOGY_PROHIBITED_USES.map((use) => (
              <li key={use} className="border-l border-rose-900/60 pl-3 text-sm leading-6 text-zinc-400">{use}</li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white">Calculations and methods</h2>
            <Link href={CALCULATION_REFERENCE_PATH} className="font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:text-cyan-100">Browse all {CALCULATION_REFERENCES.length} calculation contracts →</Link>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">The reference library documents time resolution, ephemerides, frames, zodiac conversions, houses, lunar limbs, aspects, uncertainty, and provenance. These longer guides connect those contracts to complete report methods.</p>
          <Link href={CALCULATION_REFERENCE_PATH} className="mt-6 block border border-cyan-800/70 bg-cyan-950/10 p-5 hover:border-cyan-500">
            <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">Calculation authority library · {CALCULATION_REFERENCES.length} references</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Every number needs a declared convention</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Inspect required inputs, procedures, production status, uncertainty behavior, authoritative sources, and the exact boundary between geometry and interpretation.</p>
          </Link>
          <Link href={TIMING_REFERENCE_PATH} className="mt-4 block border border-violet-800/70 bg-violet-950/10 p-5 hover:border-violet-500">
            <p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">Timing reference library · {TIMING_REFERENCES.length} canonical pages</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Ingresses, stations, lunations, and Vimśottarī chronology</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Inspect event definitions, root-finding procedures, frame choices, repeated crossings, period boundaries, uncertainty, source roles, and the exact limit on what each date can support.</p>
          </Link>
          <Link href={CORPORATE_MUNDANE_PATH} className="mt-4 block border border-cyan-800/70 bg-cyan-950/10 p-5 hover:border-cyan-500">
            <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">Corporate and mundane library · {CORPORATE_MUNDANE_REFERENCES.length} finite pages</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Formation, transaction, deployment, launch, and merger events</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Inspect evidence requirements, event-selection rules, location and time uncertainty, organization-specific geometry, preregistration methods, and sanitized system demonstrations.</p>
          </Link>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {CELESTIAL_GUIDE_LIST.map((guide) => (
              <Link key={guide.path} href={guide.path} className="block border border-zinc-800 p-5 hover:border-violet-500/50">
                <p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">{guide.eyebrow}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{guide.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{guide.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white">Traditions</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{ASTROLOGY_TRADITIONS.length} registered · {ASTROLOGY_RULES.length} rules</p>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {ASTROLOGY_TRADITIONS.map((tradition) => {
              const ruleCount = getRulesForTradition(tradition.id).length
              return (
                <Link key={tradition.id} href={astrologyTraditionPath(tradition)} className="block border border-zinc-800 p-5 hover:border-violet-500/50">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-widest">
                    <span className="border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-300">{tradition.zodiac}</span>
                    <span className={ruleCount > 0 ? 'text-zinc-500' : 'text-amber-400'}>{ruleCount} rule{ruleCount === 1 ? '' : 's'}</span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-white">{tradition.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">{tradition.period}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{tradition.description}</p>
                  {tradition.unpopulatedReason && (
                    <p className="mt-4 border-l border-amber-600/50 pl-3 text-xs leading-5 text-zinc-500"><span className="text-amber-400">No rules published:</span> {tradition.unpopulatedReason}</p>
                  )}
                </Link>
              )
            })}
          </div>
        </section>

        <section className="mt-14 border-t border-zinc-800 pt-10">
          <h2 className="text-2xl font-semibold text-white">Sources</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">Only rights-cleared editions may carry excerpts. Passages are transcribed verbatim and bounded; where an edition differs from others, the difference is recorded rather than silently corrected.</p>
          <ol className="mt-6 space-y-4">
            {ASTROLOGY_SOURCES.map((source) => (
              <li key={source.id} className="border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a>
                <span className="text-zinc-600"> · {source.author}{source.translator ? `, tr. ${source.translator}` : ''} · composed {source.originalComposed} · {source.edition}</span>
                <p className="mt-1 text-xs leading-5 text-zinc-600"><span className="font-mono uppercase tracking-widest text-emerald-400">{source.rightsStatus}</span> — {source.rightsNote}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest">
          <Link href={ASTROLOGY_REGISTRY_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Machine-readable registry</Link>
          <Link href={ASTROLOGY_SCHEMA_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Registry JSON Schema</Link>
          <Link href={CELESTIAL_FACT_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Celestial fact layer</Link>
          <Link href={ASTRONOMY_KNOWLEDGE_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Astronomy knowledge</Link>
        </section>
      </div>
    </main>
  )
}
