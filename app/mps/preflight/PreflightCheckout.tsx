'use client'

import { FormEvent, useState } from 'react'

export default function PreflightCheckout() {
  const [email, setEmail] = useState('')
  const [documentLabel, setDocumentLabel] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/mps-preflight/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, documentLabel }),
      })
      const data = await response.json() as { checkoutUrl?: string; error?: string }
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? 'Checkout could not start.')
      window.location.assign(data.checkoutUrl)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout could not start.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={checkout} className="mt-10 max-w-xl border border-zinc-700 bg-zinc-950 p-6 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Begin a private preflight ]</p>
      <div className="mt-6 grid gap-5">
        <label className="grid gap-2 text-sm text-zinc-300">
          Email for your private report
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="border border-zinc-600 bg-black px-3 py-3 text-white outline-none focus:border-indigo-400" placeholder="you@organization.com" />
        </label>
        <label className="grid gap-2 text-sm text-zinc-300">
          Document label <span className="text-zinc-500">(optional)</span>
          <input value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)} maxLength={120} className="border border-zinc-600 bg-black px-3 py-3 text-white outline-none focus:border-indigo-400" placeholder="Board memo draft, chapter 3, policy note…" />
        </label>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-zinc-500">Secure payment is handled by Stripe. After payment, you paste the document directly into a private session; the full source text is processed transiently and is not kept in the MPS ledger.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      <button disabled={loading} className="mt-6 w-full bg-white px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-zinc-200 disabled:cursor-wait disabled:bg-zinc-500">
        {loading ? 'Opening secure checkout…' : 'Continue to secure checkout — $49'}
      </button>
    </form>
  )
}
