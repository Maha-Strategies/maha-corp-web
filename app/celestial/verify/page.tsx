import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'

import EvidenceVerifier from './EvidenceVerifier'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Verify an Evidence Bundle | Maha Celestial',
  description: 'Verify the canonical digest, detached signature, and current Maha Celestial issuer key for a report Evidence Bundle.',
  alternates: { canonical: '/celestial/verify' },
}

export default function VerifyEvidencePage() {
  return (
    <main className="min-h-screen bg-[#07070b] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-4xl">
        <nav className="font-mono text-[10px] uppercase tracking-widest text-zinc-600" aria-label="Maha Celestial breadcrumb"><Link href="/celestial" className="text-violet-300 hover:text-white">Maha Celestial</Link><span className="px-2">/</span><span>Verify</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Integrity · issuer provenance · explicit limits</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-6xl">Verify an Evidence Bundle.</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">Verification recomputes the RFC 8785 canonical digest and checks any detached ES256K signature against the current Maha Celestial issuer key. It verifies the artifact, not astrology.</p>
        </header>
        <EvidenceVerifier />
      </div>
    </main>
  )
}

