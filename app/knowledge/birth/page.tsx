import type { Metadata } from 'next'
import Link from 'next/link'

import { ASTROLOGY_PATH, ASTROLOGY_PROHIBITED_USES } from '@/lib/astrology-traditions'
import { BIRTH_REPORT_VERSION } from '@/lib/birth-report'
import { SITE_URL } from '@/lib/briefs-data'

import BirthForm from './BirthForm'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Birth pañcāṅga | Maha Strategies',
  description: 'The calendrical facts of a birth moment — janma nakṣatra, tithi, yoga, karaṇa, vāra — with every sourced rule that applies and every rule withheld, and its reason.',
  alternates: { canonical: '/knowledge/birth' },
  robots: { index: true, follow: true },
}

export default function BirthPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">Birth pañcāṅga</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{BIRTH_REPORT_VERSION}</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">Birth pañcāṅga</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">
            The calendrical facts of a birth moment, computed from an ephemeris and a stated ayanāṁśa, with every sourced rule that applies to them — and every rule that was withheld, with its reason.
          </p>
        </header>

        <BirthForm />

        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Read this before you read the output</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-sm leading-6 text-zinc-300">
            <p>
              <strong className="text-white">The pañcāṅga is arithmetic.</strong> Your janma nakṣatra, tithi, yoga, karaṇa and vāra follow from where the Sun and Moon were. Those values are checkable and reproducible, and a different ayanāṁśa would move the nakṣatra and yoga but not the tithi or karaṇa.
            </p>
            <p>
              <strong className="text-white">Everything built on top of it is unvalidated tradition.</strong> Each rule below is recorded as documented doctrine from a named source. There is no evidence that any of it predicts anything about a person, and the schema this layer uses cannot express such a claim.
            </p>
            <p>
              <strong className="text-white">This is not a personality reading, and it cannot become one.</strong> The rules a natal reading normally consists of — appearance, character, health, length of life — are withheld by report policy, because each maps to a prohibited use. You will see them listed as withheld rather than quietly absent.
            </p>
          </div>
        </section>

        <section className="mt-12 border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Prohibited uses</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">These apply to every rule in this layer without exception.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {ASTROLOGY_PROHIBITED_USES.map((use) => <li key={use} className="border-l border-rose-900/60 pl-3 text-sm leading-6 text-zinc-400">{use}</li>)}
          </ul>
        </section>

        <section className="mt-8 border border-zinc-800 bg-zinc-950/40 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Your inputs</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
            Birth details are submitted by POST, so they do not appear in the URL, in browser history, or in referrer headers. They are used to compute the report in the request and are not stored or written to a log. The report shows only derived values and digests.
          </p>
        </section>

        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest">
          <Link href="/knowledge/panchanga" className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Pañcāṅga today</Link>
          <Link href="/knowledge/muhurta" className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Muhūrta verdict</Link>
          <Link href={ASTROLOGY_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-violet-400 hover:text-violet-300">Traditions and sources</Link>
        </section>
      </div>
    </main>
  )
}
