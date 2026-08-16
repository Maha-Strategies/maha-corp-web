import type { Metadata } from 'next'
import Link from 'next/link'

import { ASTROLOGY_PATH } from '@/lib/astrology-traditions'
import { SITE_URL } from '@/lib/briefs-data'
import { CELESTIAL_FACT_PATH } from '@/lib/celestial-facts'
import { PANCHANGA_VERSION, computePanchanga, type Panchanga } from '@/lib/panchanga'

// Computed per request: a pañcāṅga is a statement about a moment, and a cached
// one would be quietly wrong.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Pañcāṅga | Maha Strategies',
  description: 'Reproducible pañcāṅga computation — tithi, nakshatra, yoga, karaṇa, vāra — derived from JPL-based ephemerides with a stated ayanāṁśa. Calendrical arithmetic, not auspiciousness.',
  alternates: { canonical: '/knowledge/panchanga' },
}

const PLACES = [
  { name: 'Ujjain', region: 'India · traditional prime meridian', latitudeDegrees: 23.1765, longitudeDegrees: 75.7885 },
  { name: 'Chennai', region: 'India', latitudeDegrees: 13.0827, longitudeDegrees: 80.2707 },
  { name: 'London', region: 'United Kingdom', latitudeDegrees: 51.4769, longitudeDegrees: -0.0005 },
  { name: 'New York', region: 'United States', latitudeDegrees: 40.7128, longitudeDegrees: -74.006 },
]

function clock(iso: string | null, longitudeDegrees: number): string {
  if (!iso) return '—'
  // Local mean solar time, so a reader can sanity-check sunrise without a
  // timezone database in the loop.
  const shifted = new Date(new Date(iso).getTime() + (longitudeDegrees / 15) * 3_600_000)
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')} LMT`
}

function Limb({ label, value, detail, uncertain }: { label: string; value: string; detail: string; uncertain: boolean }) {
  return (
    <div className={`border p-4 ${uncertain ? 'border-amber-600/60 bg-amber-950/10' : 'border-zinc-800 bg-zinc-950/60'}`}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-lg text-white">{value}</p>
      <p className="mt-1 font-mono text-[10px] text-zinc-600">{detail}</p>
      {uncertain && <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-amber-400">Near a boundary — not asserted</p>}
    </div>
  )
}

function PlaceCard({ place, panchanga }: { place: typeof PLACES[number]; panchanga: Panchanga }) {
  return (
    <section className="border border-zinc-800 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-semibold text-white">{place.name}</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{place.region}</p>
      </div>
      <p className="mt-2 font-mono text-[10px] text-zinc-600">
        {place.latitudeDegrees.toFixed(4)}°, {place.longitudeDegrees.toFixed(4)}° · sunrise {clock(panchanga.day.sunrise, place.longitudeDegrees)} · sunset {clock(panchanga.day.sunset, place.longitudeDegrees)}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Limb label="Tithi" value={`${panchanga.tithi.name}`} detail={`${panchanga.tithi.paksha} · ${panchanga.tithi.absoluteIndex}/30 · ${(panchanga.tithi.fraction * 100).toFixed(1)}% elapsed`} uncertain={panchanga.tithi.nearBoundary} />
        <Limb label="Nakshatra" value={panchanga.nakshatra.name} detail={`${panchanga.nakshatra.index}/27 · ${(panchanga.nakshatra.fraction * 100).toFixed(1)}% elapsed`} uncertain={panchanga.nakshatra.nearBoundary} />
        <Limb label="Yoga" value={panchanga.yoga.name} detail={`${panchanga.yoga.index}/27 · ${(panchanga.yoga.fraction * 100).toFixed(1)}% elapsed`} uncertain={panchanga.yoga.nearBoundary} />
        <Limb label="Karaṇa" value={panchanga.karana.name} detail={`${panchanga.karana.index}/60 · ${(panchanga.karana.fraction * 100).toFixed(1)}% elapsed`} uncertain={panchanga.karana.nearBoundary} />
        <Limb label="Vāra" value={panchanga.vara.name} detail="sunrise to sunrise" uncertain={false} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Rāhu Kāla</span>
          <p className="mt-1">
            {panchanga.rahuKala
              ? `${clock(panchanga.rahuKala.start, place.longitudeDegrees)} – ${clock(panchanga.rahuKala.end, place.longitudeDegrees)} (segment ${panchanga.rahuKala.segment} of 8)`
              : 'Undefined — the Sun does not both rise and set here today.'}
          </p>
        </div>
        <div className="border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Sidereal longitudes</span>
          <p className="mt-1 font-mono text-xs text-zinc-500">Sun {panchanga.sunLongitudeSidereal.toFixed(4)}° · Moon {panchanga.moonLongitudeSidereal.toFixed(4)}° · elongation {panchanga.elongation.toFixed(4)}°</p>
        </div>
      </div>
    </section>
  )
}

export default function PanchangaPage() {
  const instant = new Date()
  const computed = PLACES.map((place) => ({ place, panchanga: computePanchanga({ instant, ...place }) }))
  const ayanamsa = computed[0].panchanga.ayanamsa

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-amber-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">Pañcāṅga</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">{PANCHANGA_VERSION} · computed {instant.toISOString()}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Pañcāṅga</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">
            The five limbs of the Indian calendar, computed from Sun and Moon geometry for the present moment. Tithi and karaṇa follow from the Sun–Moon elongation; nakshatra and yoga additionally require a sidereal zero point, which is stated rather than assumed.
          </p>
        </header>

        <section className="mt-10 border-l-2 border-amber-500 bg-amber-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">This page computes a calendar, not a verdict</h2>
          <p className="mt-3 max-w-3xl font-serif text-lg leading-8 text-zinc-200">
            &ldquo;The tithi is Caturthī and the nakshatra is Hasta&rdquo; is a statement about where the Sun and Moon are. It is arithmetic, and it is checkable. Whether such a moment is <em>auspicious</em> is a separate claim belonging to a named tradition, and it is not made here.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            The Jyotiṣa tradition is registered in the tradition layer with no published muhūrta rules, because that layer refuses any rule lacking a verbatim passage from a rights-cleared edition. The arithmetic below is deliberately kept apart from interpretation so that neither borrows the other&rsquo;s credibility.
          </p>
        </section>

        <section className="mt-8 border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Ayanāṁśa · {ayanamsa.name} · {ayanamsa.degrees.toFixed(6)}°</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-500">{ayanamsa.accuracyNote}</p>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-500">
            Positions come from <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer" className="underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300">astronomy-engine</a> (MIT), which derives from JPL ephemerides. Values within {(0.05).toFixed(2)}° of a division edge are flagged rather than asserted, since a small change in ayanāṁśa or instant would flip them.
          </p>
        </section>

        <div className="mt-10 space-y-6">
          {computed.map(({ place, panchanga }) => <PlaceCard key={place.name} place={place} panchanga={panchanga} />)}
        </div>

        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest">
          <Link href={`${ASTROLOGY_PATH}/vedic-jyotisha`} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-amber-400 hover:text-amber-300">Jyotiṣa tradition record</Link>
          <Link href={ASTROLOGY_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-amber-400 hover:text-amber-300">Astrology traditions</Link>
          <Link href={CELESTIAL_FACT_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-amber-400 hover:text-amber-300">Celestial fact layer</Link>
        </section>
      </div>
    </main>
  )
}
