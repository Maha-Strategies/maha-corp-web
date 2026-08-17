import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { CORPORATE_REPORT_VERSION } from '@/lib/corporate-report'

import CorporateForm from './CorporateForm'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Corporate formation chart | Maha Celestial',
  description: 'An evidence-bound corporate formation-event report with declared jurisdiction, event location, time confidence, calculation conventions, and organization-specific Jyotiṣa methodology.',
  alternates: { canonical: '/knowledge/corporate' },
}

export default function CorporateReportPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/reports/celestial" className="hover:text-white">Maha Celestial reports</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">Corporate formation event</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{CORPORATE_REPORT_VERSION} · organization subject</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">Corporate formation-event report</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">Record the event that constituted or materially began an organization, attach its evidence, and compute a formation chart without pretending an organization is a human subject. Uncertain times and nonstandard location choices remain visible in the result.</p>
        </header>

        <CorporateForm />

        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Hard boundary</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">This report documents a calculation and a named interpretive framework. It does not estimate valuation or investment return, guarantee a business outcome, or establish legal formation, good standing, or regulatory compliance.</p>
        </section>
      </div>
    </main>
  )
}
