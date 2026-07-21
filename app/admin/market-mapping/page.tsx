'use client'

import { useMemo, useRef, useState } from 'react'

type Evidence = { url: string; note: string }
type Opportunity = {
  public_id: string; source: string; signal_class: string; source_reference: string; title: string; problem: string; buyer: string; proposed_solution: string; evidence: Evidence[]
  demand_evidence: number; commercial_intent: number; capability_fit: number; speed_to_validate: number; risk_penalty: number; score: number; status: string; reviewer_note: string | null; created_at: string
}

const ACTIVE = new Set(['discovered', 'under_review', 'approved_for_experiment'])

export default function MarketMappingPage() {
  const [token, setToken] = useState('')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const fileInput = useRef<HTMLInputElement>(null)
  const visible = useMemo(() => opportunities.filter((item) => filter === 'all' || ACTIVE.has(item.status)), [filter, opportunities])

  async function load() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/market-opportunities', { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json() as { opportunities?: Opportunity[]; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Market mapping is unavailable.')
      setOpportunities(body.opportunities ?? [])
      setUnlocked(true)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Market mapping is unavailable.') }
    finally { setLoading(false) }
  }

  async function operate(opportunityId: string, action: 'start_review' | 'approve_experiment' | 'reject' | 'archive') {
    const note = window.prompt(action === 'approve_experiment' ? 'Approval note: specify the bounded experiment. No publishing or spend is authorized.' : 'Operator note (optional):') ?? ''
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/market-opportunities', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, opportunityId, note, idempotencyKey: `${action}:${opportunityId}:${crypto.randomUUID()}` }),
      })
      const body = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Market operation failed.')
      await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Market operation failed.'); setLoading(false) }
  }

  async function runScout() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/market-scout', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 5 }),
      })
      const body = await response.json() as { scout?: { submitted: number; duplicates: number; failed: number; discovered: number; unique: number }; error?: { message?: string } }
      if (!response.ok || !body.scout) throw new Error(body.error?.message ?? 'The Scout could not complete its run.')
      await load()
      setNotice(`Scout reviewed ${body.scout.discovered} signals and queued ${body.scout.submitted} new proposal${body.scout.submitted === 1 ? '' : 's'} (${body.scout.duplicates} existing, ${body.scout.failed} failed).`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The Scout could not complete its run.'); setLoading(false) }
  }

  async function importSearchConsole(file: File) {
    setLoading(true); setNotice('')
    try {
      const csv = await file.text()
      const response = await fetch('/api/admin/search-console-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observedAt, csv }),
      })
      const body = await response.json() as { import?: { rows: number; eligible: number; skipped: number; created: number; duplicates: number; failed: number }; error?: { message?: string } }
      if (!response.ok || !body.import) throw new Error(body.error?.message ?? 'The Search Console import could not complete.')
      await load()
      setNotice(`Search Console reviewed ${body.import.rows} queries: ${body.import.created} queued, ${body.import.duplicates} existing, ${body.import.skipped} below the commercial-intent threshold, ${body.import.failed} failed.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The Search Console import could not complete.'); setLoading(false) }
  }

  if (!unlocked) return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200"><div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6">
      <p className="font-mono text-xs tracking-widest text-cyan-300">[ MARKET MAPPING // PRIVATE ]</p><h1 className="mt-4 text-2xl text-white">Unlock the queue</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">Evidence-backed proposals only. This queue cannot publish, spend, deploy, or contact anyone.</p>
      <input type="password" value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} placeholder="Market mapping token" className="mt-5 w-full border border-zinc-700 bg-black p-3 font-mono text-sm outline-none focus:border-cyan-400" />
      <button onClick={() => void load()} disabled={!token || loading} className="mt-4 w-full bg-cyan-300 p-3 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">{loading ? 'Loading…' : 'Open queue'}</button>
      {notice && <p className="mt-4 text-sm text-red-300">{notice}</p>}
    </div></main>
  )

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs tracking-widest text-cyan-300">[ MARKET MAPPING // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Opportunity queue</h1><p className="mt-2 text-sm text-zinc-400">Evidence → deterministic score → human approval. No autonomous publishing, spend, deployment, or outreach.</p></div><div className="flex flex-wrap gap-3"><select value={filter} onChange={(event) => setFilter(event.target.value as 'active' | 'all')} className="border border-zinc-700 bg-black p-2 text-sm"><option value="active">Active</option><option value="all">All</option></select><input aria-label="Search Console observation date" type="date" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} className="border border-zinc-700 bg-black p-2 text-sm" /><input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importSearchConsole(file) }} /><button onClick={() => fileInput.current?.click()} disabled={loading} className="border border-cyan-700 px-4 py-2 font-mono text-xs uppercase text-cyan-100 disabled:opacity-40">Import GSC queries</button><button onClick={() => void runScout()} disabled={loading} className="border border-cyan-400 px-4 py-2 font-mono text-xs uppercase text-cyan-200 disabled:opacity-40">{loading ? 'Working…' : 'Run Scout · max 5'}</button><button onClick={() => void load()} disabled={loading} className="border border-zinc-600 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div></div>
    {notice && <p className="mt-5 border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{notice}</p>}
    <div className="mt-8 space-y-4">{visible.map((item) => <article key={item.public_id} className="border border-zinc-800 bg-zinc-950/50 p-5"><div className="flex flex-wrap justify-between gap-5"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{item.source.replaceAll('_', ' ')} · {item.signal_class.replaceAll('_', ' ')} · {item.status.replaceAll('_', ' ')}</p><h2 className="mt-2 text-xl text-white">{item.title}</h2><p className="mt-1 text-sm text-zinc-400">Buyer: {item.buyer}</p></div><div className="text-right"><p className="font-mono text-3xl text-cyan-200">{item.score}</p><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">opportunity score</p></div></div>
      <p className="mt-5 text-sm leading-relaxed"><span className="text-zinc-500">Gap:</span> {item.problem}</p><p className="mt-3 text-sm leading-relaxed"><span className="text-zinc-500">Proposed experiment:</span> {item.proposed_solution}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 sm:grid-cols-5"><p>Demand {item.demand_evidence}/30</p><p>Intent {item.commercial_intent}/25</p><p>Fit {item.capability_fit}/20</p><p>Speed {item.speed_to_validate}/15</p><p>Risk −{item.risk_penalty}/20</p></div>
      <div className="mt-5 border-t border-zinc-800 pt-4"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence</p>{item.evidence.map((entry, index) => <p key={index} className="mt-2 text-sm text-zinc-400"><a className="text-cyan-200 underline" href={entry.url} target="_blank" rel="noreferrer">Source {index + 1}</a> · {entry.note}</p>)}</div>
      {item.reviewer_note && <p className="mt-4 border-l-2 border-cyan-400 pl-3 text-sm text-cyan-100">{item.reviewer_note}</p>}
      <div className="mt-5 flex flex-wrap gap-2">{item.status === 'discovered' && <button onClick={() => void operate(item.public_id, 'start_review')} disabled={loading} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase">Start review</button>}{item.status === 'under_review' && <button onClick={() => void operate(item.public_id, 'approve_experiment')} disabled={loading} className="border border-cyan-500 px-3 py-2 font-mono text-[10px] uppercase text-cyan-200">Approve bounded experiment</button>}{['discovered', 'under_review'].includes(item.status) && <button onClick={() => void operate(item.public_id, 'reject')} disabled={loading} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase">Reject</button>}{['discovered', 'under_review', 'rejected'].includes(item.status) && <button onClick={() => void operate(item.public_id, 'archive')} disabled={loading} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase">Archive</button>}</div>
    </article>)}{visible.length === 0 && <p className="border border-zinc-800 p-8 text-center text-sm text-zinc-500">No market opportunities in this view.</p>}</div>
  </div></main>
}
