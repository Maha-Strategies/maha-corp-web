'use client'

import { useRef, useState } from 'react'

const packs = [{ id: 'starter', name: 'Starter', detail: '100,000 credits' }, { id: 'pro', name: 'Pro', detail: '600,000 credits' }, { id: 'enterprise', name: 'Enterprise', detail: '3,000,000 credits' }] as const

export function TopUpButtons({ apiKey }: { apiKey: string }) {
  const [loadingPack, setLoadingPack] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const requestIds = useRef<Record<string, string>>({})
  async function startCheckout(pack: (typeof packs)[number]['id']) {
    setLoadingPack(pack); setError(null); requestIds.current[pack] ??= crypto.randomUUID()
    try { const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ pack, clientRequestId: requestIds.current[pack] }) }); const result = await response.json().catch(() => null)
      if (!response.ok || typeof result?.url !== 'string') throw new Error(result?.error?.message ?? 'Checkout could not be started. Please try again.')
      window.location.assign(result.url)
    } catch (checkoutError) { setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout could not be started. Please try again.'); setLoadingPack(null) }
  }
  return <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-gray-950">Top up credits</h2><p className="mt-1 text-sm text-gray-600">Stripe processes payment. Repeated clicks reuse the same Checkout request.</p></div><div className="grid gap-3 sm:grid-cols-3">{packs.map((pack) => <button key={pack.id} type="button" onClick={() => startCheckout(pack.id)} disabled={loadingPack !== null} className="rounded-xl border border-gray-950 bg-black px-4 py-4 text-left text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"><span className="block text-sm font-semibold">{loadingPack === pack.id ? 'Opening checkout...' : pack.name}</span><span className="mt-1 block text-xs text-gray-300">{pack.detail}</span></button>)}</div>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}</section>
}
