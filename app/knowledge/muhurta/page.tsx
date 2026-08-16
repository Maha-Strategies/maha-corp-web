import type { Metadata } from 'next'
import Link from 'next/link'

import { ASTROLOGY_PATH, getAstrologyPassage, getAstrologySource } from '@/lib/astrology-traditions'
import { SITE_URL } from '@/lib/briefs-data'
import { CompilerRefusal, compileReport, type CompiledReport } from '@/lib/interpretation-compiler'
import { buildLocalFactBundle } from '@/lib/local-fact-bundle'
import { parseInstant } from '@/lib/muhurta-input'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Muhūrta verdict | Maha Strategies',
  description: 'A tradition-scoped muhūrta reading compiled from computed pañcāṅga and verbatim Bṛhat Saṃhitā passages, with every withheld rule and its reason shown.',
  alternates: { canonical: '/knowledge/muhurta' },
}

const PLACES: Record<string, { label: string; lat: number; lon: number; elevation: number }> = {
  ujjain: { label: 'Ujjain', lat: 23.1765, lon: 75.7885, elevation: 494 },
  chennai: { label: 'Chennai', lat: 13.0827, lon: 80.2707, elevation: 6 },
  delhi: { label: 'Delhi', lat: 28.6139, lon: 77.209, elevation: 216 },
  london: { label: 'London', lat: 51.4769, lon: -0.0005, elevation: 47 },
}

const REASON_LABEL: Record<string, string> = {
  'chart-type-mismatch': 'Different chart type',
  'report-policy': 'Withheld by report policy',
  'requires-derivation': 'Needs a derivation not implemented',
  'condition-unsatisfied': 'Conditions not met at this moment',
  'limb-uncertain': 'Too near a division edge to assert',
  'panchanga-unavailable': 'No pañcāṅga derivable',
}

type SearchParams = Promise<{ at?: string; place?: string }>

function Modules({ report }: { report: CompiledReport }) {
  return (
    <div className="mt-6 space-y-5">
      {report.modules.map((entry) => (
        <article key={entry.id} className="border border-zinc-800 bg-zinc-950/70 p-6">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-widest">
            <span className="border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-300">Unvalidated tradition</span>
            <span className="text-zinc-600">{entry.heading}</span>
            {entry.observedLimbs.map((limb) => (
              <span key={limb} className="border border-emerald-600/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">{limb}</span>
            ))}
          </div>
          <p className="mt-4 font-serif text-lg leading-8 text-zinc-200">{entry.paragraph}</p>
          {entry.passageIds.map((passageId) => {
            const passage = getAstrologyPassage(passageId)
            if (!passage) return null
            const source = getAstrologySource(passage.sourceId)
            return (
              <figure key={passageId} className="mt-4 border-l-2 border-violet-700/60 pl-4">
                <blockquote className="font-serif text-base leading-7 text-zinc-300">&ldquo;{passage.excerpt}&rdquo;</blockquote>
                <figcaption className="mt-2 text-xs leading-5 text-zinc-600">
                  {passage.locator}{source ? ` · ${source.title}, tr. ${source.translator}, ${source.editionYear}` : ''}
                </figcaption>
                {passage.transcriptionNote && (
                  <p className="mt-2 border-l border-cyan-800/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-cyan-400">Transcription note:</span> {passage.transcriptionNote}</p>
                )}
              </figure>
            )
          })}
          {entry.disagreements.map((disagreement) => (
            <p key={disagreement} className="mt-3 border-l border-amber-800/50 pl-3 text-xs leading-5 text-zinc-400"><span className="text-amber-400">Disagreement:</span> {disagreement}</p>
          ))}
          <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-rose-400">Boundary:</span> {entry.boundary}</p>
        </article>
      ))}
    </div>
  )
}

export default async function MuhurtaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const placeKey = params.place && PLACES[params.place] ? params.place : 'ujjain'
  const place = PLACES[placeKey]
  const { instant, invalid } = parseInstant(params.at)

  const factBundle = buildLocalFactBundle({ instant, latitudeDegrees: place.lat, longitudeDegrees: place.lon, elevationMeters: place.elevation })

  let report: CompiledReport | null = null
  let refusal: CompilerRefusal | null = null
  try {
    report = compileReport({ factBundle, traditionId: 'vedic-jyotisha', chartType: 'electional' })
  } catch (error) {
    if (error instanceof CompilerRefusal) refusal = error
    else throw error
  }

  const panchanga = report?.panchanga

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">Muhūrta</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Vedic (Jyotiṣa) · electional · sidereal</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">Muhūrta verdict</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">
            What one named tradition holds about a given moment, compiled from a computed pañcāṅga and verbatim passages. Every rule that did <em>not</em> fire is listed with the reason, so the reading cannot be made to look stronger by hiding what was withheld.
          </p>
        </header>

        <form method="get" className="mt-8 flex flex-wrap items-end gap-4 border border-zinc-800 bg-zinc-950/60 p-5">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Moment (UTC)</span>
            <input type="text" name="at" defaultValue={instant.toISOString().slice(0, 16)} placeholder="2026-08-16T05:28" className="border border-zinc-700 bg-black px-3 py-2 font-mono text-sm text-zinc-200" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Place</span>
            <select name="place" defaultValue={placeKey} className="border border-zinc-700 bg-black px-3 py-2 font-mono text-sm text-zinc-200">
              {Object.entries(PLACES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <button type="submit" className="border border-violet-500 px-5 py-2 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-400 hover:text-black">Compile</button>
          {invalid && <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Unparseable moment — using now</p>}
        </form>

        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">What this is not</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
            {report?.epistemicBoundary ?? 'Every rule this page can draw on is recorded as unvalidated tradition. There is no evidence that any of it predicts anything.'}
          </p>
        </section>

        {panchanga && (
          <section className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {([
              ['Tithi', `${panchanga.tithi.name} (${panchanga.tithi.paksha})`, panchanga.tithi.nearBoundary],
              ['Nakshatra', panchanga.nakshatra.name, panchanga.nakshatra.nearBoundary],
              ['Yoga', panchanga.yoga.name, panchanga.yoga.nearBoundary],
              ['Karaṇa', panchanga.karana.name, panchanga.karana.nearBoundary],
              ['Vāra', panchanga.vara.name, false],
            ] as [string, string, boolean][]).map(([label, value, uncertain]) => (
              <div key={label} className={`border p-4 ${uncertain ? 'border-amber-600/60 bg-amber-950/10' : 'border-zinc-800 bg-zinc-950/60'}`}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
                <p className="mt-2 text-lg text-white">{value}</p>
                {uncertain && <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-amber-400">Near boundary</p>}
              </div>
            ))}
          </section>
        )}

        {refusal && (
          <section className="mt-8 border border-amber-900/60 bg-amber-950/10 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">The compiler refused at stage: {refusal.stage}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{refusal.message}</p>
            <ul className="mt-3 space-y-1">
              {refusal.issues.map((issue) => <li key={issue} className="border-l border-amber-800/50 pl-3 text-xs leading-5 text-zinc-400">{issue}</li>)}
            </ul>
          </section>
        )}

        {report && (
          <>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold text-white">What the tradition says about this moment</h2>
              {report.modules.length === 0
                ? <p className="mt-4 text-sm text-zinc-500">No rule applied.</p>
                : <Modules report={report} />}
            </section>

            <section className="mt-12">
              <h2 className="text-2xl font-semibold text-white">Withheld</h2>
              <p className="mt-2 max-w-3xl text-sm text-zinc-500">Every rule in the tradition is accounted for. Nothing is dropped silently.</p>
              <ul className="mt-5 space-y-2">
                {report.exclusions.map((exclusion) => (
                  <li key={exclusion.ruleId} className="border border-zinc-800 bg-zinc-950/40 p-4 text-sm leading-6 text-zinc-400">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400">{REASON_LABEL[exclusion.reason] ?? exclusion.reason}</span>
                    <span className="ml-3 font-mono text-[10px] text-zinc-600">{exclusion.ruleId}</span>
                    <p className="mt-2 text-zinc-400">{exclusion.detail}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-12 border-t border-zinc-800 pt-8">
              <h2 className="text-2xl font-semibold text-white">Provenance</h2>
              <dl className="mt-5 grid gap-3 font-mono text-[11px] text-zinc-500 sm:grid-cols-2">
                <div><dt className="text-zinc-600">Report</dt><dd className="break-all text-zinc-300">{report.reportId}</dd></div>
                <div><dt className="text-zinc-600">Compiler</dt><dd className="text-zinc-300">{report.provenance.compilerVersion}</dd></div>
                <div><dt className="text-zinc-600">Registry</dt><dd className="text-zinc-300">{report.provenance.traditionRegistryVersion}</dd></div>
                <div><dt className="text-zinc-600">Pañcāṅga</dt><dd className="text-zinc-300">{panchanga?.version ?? '—'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-zinc-600">Fact bundle</dt><dd className="break-all text-zinc-300">{report.provenance.factBundleId} · {report.provenance.factBundleSha256}</dd></div>
                <div className="sm:col-span-2"><dt className="text-zinc-600">Input digest</dt><dd className="break-all text-zinc-300">{report.provenance.inputSha256}</dd></div>
                <div className="sm:col-span-2"><dt className="text-zinc-600">Ayanāṁśa</dt><dd className="text-zinc-300">{panchanga ? `${panchanga.ayanamsa.name} ${panchanga.ayanamsa.degrees.toFixed(6)}°` : '—'}</dd></div>
              </dl>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-zinc-500">{report.conflictPolicy}</p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-500"><span className="font-mono text-[10px] uppercase tracking-widest text-rose-400">Prohibited uses</span> — {report.prohibitedUses.join('; ')}.</p>
            </section>
          </>
        )}

        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest">
          <Link href="/knowledge/panchanga" className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Pañcāṅga</Link>
          <Link href={`${ASTROLOGY_PATH}/vedic-jyotisha`} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Jyotiṣa rules</Link>
          <Link href={ASTROLOGY_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">All traditions</Link>
        </section>
      </div>
    </main>
  )
}
