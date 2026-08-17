'use client'

import Link from 'next/link'

import type { CelestialEvidenceBundle } from '@/lib/celestial-evidence'

export default function EvidenceBundlePanel({ bundle }: { bundle: CelestialEvidenceBundle }) {
  function download() {
    const data = `${JSON.stringify(bundle, null, 2)}\n`
    const url = URL.createObjectURL(new Blob([data], { type: `${bundle.mediaType};charset=utf-8` }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${bundle.bundleId}.maha-celestial-evidence.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mt-6 border border-emerald-700/50 bg-emerald-950/10 p-6" aria-labelledby="evidence-bundle-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Maha Celestial Evidence Bundle</p>
          <h2 id="evidence-bundle-heading" className="mt-2 text-2xl font-semibold text-white">Take the evidence chain with you.</h2>
        </div>
        <span className={`border px-3 py-1 font-mono text-[9px] uppercase tracking-widest ${bundle.proof ? 'border-emerald-500/50 text-emerald-200' : 'border-amber-500/50 text-amber-200'}`}>
          {bundle.proof ? 'Issuer signature attached' : 'Digest only · unsigned'}
        </span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">The JSON artifact contains the astronomical facts, calculation conventions, chart geometry, tradition-specific modules, verbatim source passages, withheld rules, exploratory calibration, and non-claims used for this report. Its integrity status does not claim that astrology predicts events.</p>
      <dl className="mt-5 grid gap-3 font-mono text-[10px] sm:grid-cols-2">
        <div className="border border-zinc-800 bg-black/30 p-3"><dt className="uppercase tracking-widest text-zinc-600">Bundle</dt><dd className="mt-2 break-all text-zinc-300">{bundle.bundleId}</dd></div>
        <div className="border border-zinc-800 bg-black/30 p-3"><dt className="uppercase tracking-widest text-zinc-600">Content digest</dt><dd className="mt-2 break-all text-zinc-300">{bundle.integrity.contentSha256}</dd></div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest">
        <button type="button" onClick={download} className="border border-emerald-500 px-4 py-3 text-emerald-200 hover:bg-emerald-400 hover:text-black">Download evidence JSON</button>
        <Link href="/celestial/verify" className="border border-zinc-700 px-4 py-3 text-zinc-300 hover:border-white hover:text-white">Verify a bundle</Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-zinc-600">The downloaded file contains the resolved birth instant and precise observer coordinates needed for reproduction. Treat it as sensitive personal data and share it deliberately.</p>
    </section>
  )
}
