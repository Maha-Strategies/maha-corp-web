'use client'

import { FormEvent, useMemo, useState, useSyncExternalStore } from 'react'

import ApiAccessTokenReveal from './ApiAccessTokenReveal'
import { browserConversionContext } from '@/components/ConversionTracker'

const STORAGE_KEY = 'mps-audit-access-purchase'
const RESTORING = 'restoring'

type Purchase = { credential: string; creditQuantity: number; expiresAt: string }

// One-time reveal: the token only crosses sessionStorage to survive the Stripe
// redirect. The first read purges it, so a refresh, shared machine, or later
// tab restore can never resurface it; afterwards it exists only in memory.
let revealedPurchaseJson: string | null | undefined
function readPurchaseOnce(): string | null {
  if (revealedPurchaseJson === undefined) {
    revealedPurchaseJson = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  }
  return revealedPurchaseJson
}
const subscribeToNothing = () => () => {}

export default function AuditAccessCheckout({ purchaseState }: { purchaseState?: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // The server snapshot renders a placeholder, so server and client markup
  // stay identical until the storage read resolves on the client.
  const purchaseJson = useSyncExternalStore(
    subscribeToNothing,
    purchaseState === 'success' ? readPurchaseOnce : () => null,
    () => (purchaseState === 'success' ? RESTORING : null),
  )
  const restoring = purchaseJson === RESTORING
  const purchase = useMemo<Purchase | null>(() => {
    if (!purchaseJson || purchaseJson === RESTORING) return null
    try { return JSON.parse(purchaseJson) as Purchase } catch { return null }
  }, [purchaseJson])

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/mps-credits/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, clientRequestId: crypto.randomUUID(), ...browserConversionContext() }),
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
      {restoring ? <div aria-hidden className="mt-6 animate-pulse border border-zinc-700 bg-zinc-950 p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Retrieving secure token…</p>
        <div className="mt-3 h-12 bg-zinc-900" />
      </div> : purchase ? <ApiAccessTokenReveal credential={purchase.credential} creditQuantity={purchase.creditQuantity} expiresAt={purchase.expiresAt} />
        : <div role="alert" className="mt-5 border-2 border-red-500 bg-red-950/40 p-5 text-red-100">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-red-300">API access token unavailable</p>
        <p className="mt-3 text-sm leading-relaxed">This browser no longer holds the one-time plaintext token, and it cannot be recovered from the credential registry. Contact support with your Stripe receipt.</p>
      </div>}
    </div>
  }

  return <form onSubmit={checkout} className="mt-10 border border-zinc-700 bg-zinc-950 p-6 sm:p-8">
    <label className="grid gap-2 text-sm text-zinc-300">Receipt email
      <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="border border-zinc-600 bg-black px-3 py-3 text-white outline-none focus:border-indigo-400" placeholder="you@organization.com" />
    </label>
    <p className="mt-5 text-xs leading-relaxed text-zinc-500">Stripe handles payment. Your secret credential is generated before checkout, held only in this browser tab, and activated by Stripe’s signed payment confirmation. You must copy it from the completion page before closing the window.</p>
    {purchaseState === 'cancelled' && <p className="mt-4 text-sm text-amber-200">Checkout was cancelled. No credential was activated.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <button disabled={loading} className="mt-6 w-full bg-white px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:cursor-wait disabled:bg-zinc-500">{loading ? 'Opening secure checkout…' : 'Purchase audit access'}</button>
  </form>
}
