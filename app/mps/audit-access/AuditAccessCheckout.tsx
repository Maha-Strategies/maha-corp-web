'use client'

import { FormEvent, useState } from 'react'

const STORAGE_KEY = 'mps-audit-access-purchase'

type Purchase = { credential: string; creditQuantity: number; expiresAt: string }

export default function AuditAccessCheckout({ purchaseState }: { purchaseState?: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [purchase] = useState<Purchase | null>(() => {
    if (purchaseState !== 'success' || typeof window === 'undefined') return null
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    try { return JSON.parse(saved) as Purchase } catch { sessionStorage.removeItem(STORAGE_KEY); return null }
  })

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/mps-credits/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, clientRequestId: crypto.randomUUID() }),
      })
      const data = await response.json() as Purchase & { checkoutUrl?: string; error?: { message?: string } }
      if (!response.ok || !data.checkoutUrl || !data.credential) throw new Error(data.error?.message ?? 'Checkout could not start.')
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ credential: data.credential, creditQuantity: data.creditQuantity, expiresAt: data.expiresAt }))
      window.location.assign(data.checkoutUrl)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout could not start.')
      setLoading(false)
    }
  }

  if (purchaseState === 'success') {
    return <div className="mt-10 border border-emerald-800 bg-emerald-950/20 p-6 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Payment received ]</p>
      {purchase ? <>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">Your MPS-only credential includes {purchase.creditQuantity} audit {purchase.creditQuantity === 1 ? 'credit' : 'credits'}. Copy it now; it is stored only in this browser tab.</p>
        <code className="mt-5 block overflow-x-auto border border-zinc-700 bg-black p-4 text-xs text-white">{purchase.credential}</code>
        <button onClick={() => navigator.clipboard.writeText(purchase.credential)} className="mt-4 border border-zinc-500 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-white">Copy credential</button>
        <p className="mt-4 text-xs text-zinc-500">Stripe may take a few seconds to activate the credential. It expires {new Date(purchase.expiresAt).toLocaleDateString()}.</p>
      </> : <p className="mt-4 text-sm text-amber-200">This browser no longer has the one-time credential. Contact support with your Stripe receipt.</p>}
    </div>
  }

  return <form onSubmit={checkout} className="mt-10 border border-zinc-700 bg-zinc-950 p-6 sm:p-8">
    <label className="grid gap-2 text-sm text-zinc-300">Receipt email
      <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="border border-zinc-600 bg-black px-3 py-3 text-white outline-none focus:border-indigo-400" placeholder="you@organization.com" />
    </label>
    <p className="mt-5 text-xs leading-relaxed text-zinc-500">Stripe handles payment. Your secret credential is generated before checkout, held only in this browser tab, and activated by Stripe’s signed payment confirmation.</p>
    {purchaseState === 'cancelled' && <p className="mt-4 text-sm text-amber-200">Checkout was cancelled. No credential was activated.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <button disabled={loading} className="mt-6 w-full bg-white px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:cursor-wait disabled:bg-zinc-500">{loading ? 'Opening secure checkout…' : 'Purchase audit access'}</button>
  </form>
}
