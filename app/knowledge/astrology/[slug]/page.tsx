import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  ASTROLOGY_PATH,
  ASTROLOGY_PROHIBITED_USES,
  ASTROLOGY_TRADITIONS,
  astrologyTraditionPath,
  getAstrologyPassage,
  getAstrologySource,
  getAstrologyTraditionBySlug,
  getRulesForTradition,
} from '@/lib/astrology-traditions'
import { SITE_URL } from '@/lib/briefs-data'
import { CLAIM_EMPIRICAL_META, CLAIM_PROVENANCE_META } from '@/lib/claim-evidence'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return ASTROLOGY_TRADITIONS.map((tradition) => ({ slug: tradition.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const tradition = getAstrologyTraditionBySlug(slug)
  if (!tradition) return {}
  return {
    metadataBase: new URL(SITE_URL),
    title: `${tradition.name} | Astrology Traditions | Maha Strategies`,
    description: tradition.description,
    alternates: { canonical: astrologyTraditionPath(tradition) },
  }
}

export default async function AstrologyTraditionPage({ params }: PageProps) {
  const { slug } = await params
  const tradition = getAstrologyTraditionBySlug(slug)
  if (!tradition) notFound()

  const rules = getRulesForTradition(tradition.id)

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link>
          <span className="px-2">/</span>
          <Link href={ASTROLOGY_PATH} className="hover:text-white">Astrology</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">{tradition.name}</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest">
            <span className="border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-violet-300">{tradition.zodiac} zodiac</span>
            <span className="text-zinc-600">{tradition.period}</span>
            <span className="text-zinc-700">{rules.length} rule{rules.length === 1 ? '' : 's'}</span>
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">{tradition.name}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">{tradition.description}</p>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Chart types · {tradition.chartTypes.join(' · ')}</p>
        </header>

        <section className="mt-10 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Epistemic status</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
            Every rule below is recorded as documented interpretive tradition with no empirical validation. The provenance badge states how faithfully the record represents its source; it is not a measure of whether the rule is true. Prohibited uses: {ASTROLOGY_PROHIBITED_USES.join('; ')}.
          </p>
        </section>

        {tradition.unpopulatedReason && (
          <section className="mt-10 border border-amber-900/50 bg-amber-950/10 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">No rules published</p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{tradition.unpopulatedReason}</p>
          </section>
        )}

        {rules.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold text-white">Interpretation rules</h2>
            <div className="mt-6 space-y-6">
              {rules.map((rule) => (
                <article key={rule.id} id={rule.id} className="scroll-mt-24 border border-zinc-800 bg-zinc-950/70 p-6">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-widest">
                    <span className="border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-300" title={CLAIM_EMPIRICAL_META[rule.empirical].description}>{CLAIM_EMPIRICAL_META[rule.empirical].label}</span>
                    <span className="border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-400" title={CLAIM_PROVENANCE_META[rule.provenance].description}>{CLAIM_PROVENANCE_META[rule.provenance].label}</span>
                    <span className="text-zinc-600">{rule.technique}</span>
                    <span className="text-zinc-700">{rule.chartTypes.join(' · ')}</span>
                  </div>

                  <p className="mt-4 font-serif text-lg leading-8 text-zinc-200">{rule.interpretation}</p>

                  <div className="mt-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Chart conditions</p>
                    <ul className="mt-2 space-y-1">
                      {rule.conditions.map((condition) => (
                        <li key={`${rule.id}-${condition.factField}-${condition.description}`} className="border-l border-zinc-700 pl-3 text-sm leading-6 text-zinc-400">
                          <span className="font-mono text-[10px] text-zinc-600">{condition.factField}</span> — {condition.description}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Source passages</p>
                    {rule.passageIds.map((passageId) => {
                      const passage = getAstrologyPassage(passageId)
                      if (!passage) return null
                      const source = getAstrologySource(passage.sourceId)
                      return (
                        <figure key={passage.id} className="mt-3 border-l-2 border-violet-700/60 pl-4">
                          <blockquote className="font-serif text-base leading-7 text-zinc-300">“{passage.excerpt}”</blockquote>
                          <figcaption className="mt-2 text-xs leading-5 text-zinc-600">
                            {passage.locator}
                            {source && <> · <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300">{source.title}</a>{source.translator ? `, tr. ${source.translator}` : ''}, {source.editionYear}</>}
                          </figcaption>
                          {passage.transcriptionNote && (
                            <p className="mt-2 border-l border-cyan-800/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-cyan-400">Transcription note:</span> {passage.transcriptionNote}</p>
                          )}
                        </figure>
                      )
                    })}
                  </div>

                  {rule.disagreements.length > 0 && (
                    <div className="mt-5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Disagreements</p>
                      <ul className="mt-2 space-y-1">
                        {rule.disagreements.map((disagreement) => (
                          <li key={disagreement} className="border-l border-amber-800/50 pl-3 text-sm leading-6 text-zinc-400">{disagreement}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="mt-5 border-l border-rose-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-rose-400">Boundary:</span> {rule.boundary}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
