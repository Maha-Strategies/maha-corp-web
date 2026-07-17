'use client'

import { FormEvent, useState } from 'react'

const STORAGE_KEY = 'mps-audit-access-purchase'

type Purchase = { credential: string; creditQuantity: number; expiresAt: string }

export default function AuditAccessCheckout({ purchaseState }: { purchaseState?: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
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

  async function copyApiAccessToken(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  if (purchaseState === 'success') {
    return <div className="mt-10 border border-emerald-800 bg-emerald-950/20 p-6 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Payment received ]</p>
      {purchase ? <>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">Your MPS-only API access token includes {purchase.creditQuantity} audit {purchase.creditQuantity === 1 ? 'credit' : 'credits'}.</p>
        <div role="alert" className="mt-6 border-2 border-red-500 bg-red-950/40 p-5 text-red-100">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-red-300">Save this token before closing this window</p>
          <p className="mt-3 text-sm font-semibold leading-relaxed">This is the only recoverable plaintext copy. Maha Strategies cannot display or recover this API access token after this browser window closes. Store it in your password manager or secret manager now.</p>
        </div>
        <div className="mt-6 border border-zinc-600 bg-black p-5" data-nosnippet>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">API Access Token</p>
          <code aria-label="API access token" className="mt-3 block select-all break-all border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-white">{purchase.credential}</code>
          <button type="button" onClick={() => copyApiAccessToken(purchase.credential)} className="mt-4 w-full bg-white px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-zinc-200 sm:w-auto">Copy API Access Token</button>
          <p aria-live="polite" className={`mt-3 text-xs ${copyStatus === 'failed' ? 'text-red-300' : 'text-emerald-300'}`}>
            {copyStatus === 'copied' && 'API access token copied. Save it somewhere secure before leaving this page.'}
            {copyStatus === 'failed' && 'Automatic copy failed. Select the visible token above and copy it manually.'}
          </p>
        </div>
        <p className="mt-4 text-xs text-zinc-500">Stripe may take a few seconds to activate the credential. It expires {new Date(purchase.expiresAt).toLocaleDateString()}.</p>
      </> : <div role="alert" className="mt-5 border-2 border-red-500 bg-red-950/40 p-5 text-red-100">
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
