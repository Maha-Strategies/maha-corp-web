'use client'

import { useState } from 'react'

type Operation = { operation: string; endpoint: string; method: string; requests: number; units: number; successfulRequests: number; clientErrors: number; serverErrors: number }
type Metrics = { privacy: string; lookbackDays: number; since: string; requests: number; units: number; successfulRequests: number; successRate: number | null; byOperation: Operation[] }

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export default function CommercialApiMeteringPage() {
  const [token, setToken] = useState('')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [days, setDays] = useState('90')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch(`/api/admin/commercial-api-metering?days=${encodeURIComponent(days)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const body = await response.json() as Metrics & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Commercial API metering is unavailable.')
      setMetrics(body)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Commercial API metering is unavailable.')
    } finally { setLoading(false) }
  }

  if (!metrics) return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200"><div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-xs tracking-widest text-cyan-300">[ COMMERCIAL API METERING // PRIVATE ]</p><h1 className="mt-4 text-2xl text-white">Open the meter</h1><p className="mt-2 text-sm leading-relaxed text-zinc-400">Read-only daily aggregates for selected credential-based APIs. It does not collect IP addresses, request content, tokens, or visitor identity.</p><label className="mt-5 block text-xs text-zinc-500">Revenue control token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm text-white" /></label><label className="mt-4 block text-xs text-zinc-500">Lookback days<input type="number" min="1" max="366" value={days} onChange={(event) => setDays(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm text-white" /></label><button onClick={() => void load()} disabled={!token || loading} className="mt-4 w-full bg-cyan-300 p-3 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">{loading ? 'Loading…' : 'Open commercial API meter'}</button>{notice && <p className="mt-4 text-sm text-red-300">{notice}</p>}</div></main>

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs tracking-widest text-cyan-300">[ COMMERCIAL API METERING // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Selected API usage</h1><p className="mt-2 max-w-3xl text-sm text-zinc-400">{metrics.privacy}</p></div><div className="flex gap-3"><input aria-label="Lookback days" type="number" min="1" max="366" value={days} onChange={(event) => setDays(event.target.value)} className="w-24 border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /><button onClick={() => void load()} disabled={loading} className="border border-cyan-400 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100 disabled:opacity-40">{loading ? 'Loading…' : 'Refresh'}</button></div></header>{notice && <p className="mt-5 border border-red-800 p-3 text-sm text-red-200">{notice}</p>}<section className="mt-8 grid gap-4 sm:grid-cols-4"><Card label="Requests" value={whole.format(metrics.requests)} /><Card label="Metered units" value={whole.format(metrics.units)} /><Card label="Successful" value={whole.format(metrics.successfulRequests)} /><Card label="Success rate" value={metrics.successRate === null ? '—' : `${(metrics.successRate * 100).toFixed(1)}%`} /></section><p className="mt-4 text-xs text-zinc-500">Window begins {metrics.since}. These counts are daily aggregates and cannot identify a visitor.</p><section className="mt-9 overflow-x-auto border border-zinc-800"><table className="min-w-full text-left text-sm"><thead className="bg-zinc-950 font-mono text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Operation</th><th className="px-4 py-3">Endpoint</th><th className="px-4 py-3 text-right">Requests</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">4xx</th><th className="px-4 py-3 text-right">5xx</th></tr></thead><tbody className="divide-y divide-zinc-800">{metrics.byOperation.map((row) => <tr key={row.operation}><td className="px-4 py-3 font-mono text-cyan-100">{row.operation}</td><td className="px-4 py-3 text-zinc-400">{row.method} {row.endpoint}</td><td className="px-4 py-3 text-right">{whole.format(row.requests)}</td><td className="px-4 py-3 text-right">{whole.format(row.units)}</td><td className="px-4 py-3 text-right text-amber-200">{whole.format(row.clientErrors)}</td><td className="px-4 py-3 text-right text-red-200">{whole.format(row.serverErrors)}</td></tr>)}{metrics.byOperation.length === 0 && <tr><td className="px-4 py-10 text-center text-zinc-500" colSpan={6}>No selected commercial API activity in this window.</td></tr>}</tbody></table></section></div></main>
}

function Card({ label, value }: { label: string; value: string }) {
  return <article className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 text-3xl text-white">{value}</p></article>
}
