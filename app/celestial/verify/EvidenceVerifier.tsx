'use client'

import { useState } from 'react'

import type { CelestialEvidenceVerification } from '@/lib/celestial-evidence'

export default function EvidenceVerifier() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<CelestialEvidenceVerification | null>(null)

  async function verifyFile(file: File | undefined) {
    setResult(null)
    setMessage('')
    if (!file) return
    if (file.size > 2_000_000) {
      setMessage('That file exceeds the 2 MB verification limit.')
      return
    }
    setPending(true)
    try {
      const raw = await file.text()
      JSON.parse(raw)
      const response = await fetch('/api/v1/celestial/evidence/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      })
      const payload = await response.json() as { verification?: CelestialEvidenceVerification; error?: string }
      if (!payload.verification) throw new Error(payload.error ?? 'The verifier did not return a result.')
      setResult(payload.verification)
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'That file is not valid JSON.' : error instanceof Error ? error.message : 'The bundle could not be verified.')
    } finally {
      setPending(false)
    }
  }

  const tone = result?.status === 'issuer-verified' ? 'emerald' : result?.status === 'invalid' ? 'rose' : 'amber'

  return (
    <section className="mt-8 border border-zinc-800 bg-zinc-950/70 p-6">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence JSON</span>
        <input
          type="file"
          accept=".json,application/json,application/vnd.maha-celestial.evidence+json"
          disabled={pending}
          onChange={(event) => void verifyFile(event.currentTarget.files?.[0])}
          className="mt-3 block w-full border border-zinc-700 bg-black px-4 py-4 text-sm text-zinc-300 file:mr-4 file:border-0 file:bg-violet-500 file:px-4 file:py-2 file:font-mono file:text-[10px] file:uppercase file:tracking-widest file:text-black"
        />
      </label>
      <p className="mt-3 text-xs leading-5 text-zinc-600">The file is submitted only for in-request verification, is not stored, and is limited to 2 MB.</p>
      {pending && <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-violet-300">Verifying canonical content and signature…</p>}
      {message && <p className="mt-5 border-l border-rose-600 pl-4 text-sm text-rose-200">{message}</p>}
      {result && (
        <div className={`mt-6 border p-5 ${tone === 'emerald' ? 'border-emerald-600/60 bg-emerald-950/10' : tone === 'rose' ? 'border-rose-600/60 bg-rose-950/10' : 'border-amber-600/60 bg-amber-950/10'}`}>
          <p className={`font-mono text-[10px] uppercase tracking-widest ${tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : 'text-amber-300'}`}>{result.status.replaceAll('-', ' ')}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{result.status === 'issuer-verified' ? 'Maha Celestial issuer and content verified.' : result.status === 'signature-valid' ? 'Signature valid; issuer key is not current.' : result.status === 'digest-valid' ? 'Content digest valid; no issuer signature.' : 'This artifact failed verification.'}</h2>
          <dl className="mt-5 grid gap-3 font-mono text-[10px] sm:grid-cols-2">
            <div><dt className="uppercase tracking-widest text-zinc-600">Bundle</dt><dd className="mt-1 break-all text-zinc-300">{result.bundleId ?? '—'}</dd></div>
            <div><dt className="uppercase tracking-widest text-zinc-600">Key</dt><dd className="mt-1 break-all text-zinc-300">{result.keyId ?? 'No key'}</dd></div>
            <div className="sm:col-span-2"><dt className="uppercase tracking-widest text-zinc-600">Recomputed digest</dt><dd className="mt-1 break-all text-zinc-300">{result.contentSha256 ?? '—'}</dd></div>
          </dl>
          {result.issues.length > 0 && <ul className="mt-5 space-y-2">{result.issues.map((issue) => <li key={issue} className="border-l border-zinc-700 pl-3 text-xs leading-5 text-zinc-400">{issue}</li>)}</ul>}
          <p className="mt-5 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">{result.boundary}</p>
        </div>
      )}
    </section>
  )
}

