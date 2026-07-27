'use client'

import { useMemo, useRef, useState } from 'react'

type Snapshot = { observedOn: string; query: string; clicks: number; impressions: number; ctr: number; position: number }
type QueryRow = Snapshot & { previous: Snapshot | null }
type Summary = { queries: number; clicks: number; impressions: number; ctr: number; position: number | null }
type Insight = { id: string; kind: 'momentum' | 'near_page_one' | 'low_ctr'; query: string; priority: number; recommendation: string; current: Snapshot; previous?: Snapshot }
type SearchPerformance = { latestObservedOn: string | null; previousObservedOn: string | null; snapshots: number; latest: Summary; previous: Summary | null; topQueries: QueryRow[]; insights: Insight[] }

const number = new Intl.NumberFormat('en-US')
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const button = 'border border-cyan-500 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-40'

function delta(current: number, previous?: number | null) {
  if (previous === null || previous === undefined) return '—'
  const change = current - previous
  return `${change >= 0 ? '+' : ''}${number.format(change)}`
}

function percentDelta(current: number, previous?: number | null) {
  if (!previous) return '—'
  const change = ((current - previous) / previous) * 100
  return `${change >= 0 ? '+' : ''}${decimal.format(change)}%`
}

function MetricCard({ label, value, comparison, positive = true }: { label: string; value: string; comparison: string; positive?: boolean }) {
  return <article className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 text-3xl text-white">{value}</p><p className={`mt-3 font-mono text-[10px] uppercase tracking-widest ${positive ? 'text-cyan-200' : 'text-amber-200'}`}>{comparison} vs prior import</p></article>
}

export default function SearchPerformancePage() {
  const [token, setToken] = useState('')
  const [data, setData] = useState<SearchPerformance | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [filter, setFilter] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const visibleQueries = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return data?.topQueries.filter((row) => !term || row.query.toLowerCase().includes(term)) ?? []
  }, [data, filter])

  async function load() {
    if (!token) { setNotice('Enter the Market mapping token to open this private board.'); return }
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/search-performance', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const body = await response.json() as SearchPerformance & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Search performance is unavailable.')
      setData(body)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Search performance is unavailable.') }
    finally { setLoading(false) }
  }

  async function importCsv(file: File) {
    if (!token) { setNotice('Enter the Market mapping token before importing a CSV.'); return }
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/search-console-import', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observedAt, csv: await file.text() }),
      })
      const body = await response.json() as { import?: { rows: number; created: number; duplicates: number; skipped: number }; error?: { message?: string } }
      if (!response.ok || !body.import) throw new Error(body.error?.message ?? 'The Search Console import could not complete.')
      await load()
      setNotice(`Imported ${body.import.rows} queries for ${observedAt}. ${body.import.created} demand proposals queued; ${body.import.duplicates} were already present; ${body.import.skipped} were outside the opportunity threshold.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The Search Console import could not complete.') }
    finally { setLoading(false) }
  }

  if (!data) return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200"><div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-xs tracking-widest text-cyan-300">[ SEARCH PERFORMANCE // PRIVATE ]</p><h1 className="mt-4 text-2xl text-white">Open the board</h1><p className="mt-2 text-sm leading-relaxed text-zinc-400">Import Google Search Console Queries.csv snapshots, compare observations, and turn only human-reviewed signals into work. This board never edits Google, publishes content, spends money, or sends outreach.</p><label className="mt-5 block text-xs text-zinc-500">Market mapping token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} placeholder="Token" className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm text-zinc-100 outline-none focus:border-cyan-400" /></label><button onClick={() => void load()} disabled={!token || loading} className="mt-4 w-full bg-cyan-300 p-3 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">{loading ? 'Loading…' : 'Open Search Performance'}</button>{notice && <p className="mt-4 text-sm text-red-300">{notice}</p>}</div></main>

  const prior = data.previous
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs tracking-widest text-cyan-300">[ SEARCH PERFORMANCE // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Search Performance board</h1><p className="mt-2 max-w-3xl text-sm text-zinc-400">First-party Search Console query snapshots, not a traffic estimate. Recommendations are review prompts; they never authorize autonomous content, spending, deployment, or outreach.</p></div><div className="flex flex-wrap gap-3"><a href="/admin/market-mapping" className="border border-cyan-700 px-4 py-2 font-mono text-xs uppercase text-cyan-100">Opportunity queue</a><button onClick={() => void load()} disabled={loading} className={button}>{loading ? 'Loading…' : 'Refresh'}</button></div></header>
    <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_.85fr]"><div className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Latest observation</p><h2 className="mt-2 text-xl text-white">{data.latestObservedOn ?? 'No import yet'}</h2><p className="mt-2 text-sm text-zinc-400">Compared with {data.previousObservedOn ?? 'no earlier imported snapshot'}. Import the same Google Search Console property and date range each time for a meaningful trend.</p></div><div className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Manual import</p><div className="mt-3 flex flex-wrap gap-3"><input aria-label="Search Console observation date" type="date" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} className="border border-zinc-700 bg-black p-2 text-sm" /><input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importCsv(file) }} /><button onClick={() => fileInput.current?.click()} disabled={loading} className={button}>Import Queries.csv</button></div><p className="mt-3 text-xs text-zinc-500">Accepts the Google Search Console Queries export only. Raw CSV files are not retained.</p></div></section>
    {notice && <p className="mt-5 border border-cyan-800 bg-cyan-950/20 p-3 text-sm text-cyan-100">{notice}</p>}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Impressions" value={number.format(data.latest.impressions)} comparison={`${delta(data.latest.impressions, prior?.impressions)} · ${percentDelta(data.latest.impressions, prior?.impressions)}`} /><MetricCard label="Clicks" value={number.format(data.latest.clicks)} comparison={`${delta(data.latest.clicks, prior?.clicks)} · ${percentDelta(data.latest.clicks, prior?.clicks)}`} /><MetricCard label="CTR" value={`${decimal.format(data.latest.ctr)}%`} comparison={`${prior ? `${data.latest.ctr - prior.ctr >= 0 ? '+' : ''}${decimal.format(data.latest.ctr - prior.ctr)} pp` : '—'}`} /><MetricCard label="Avg. position" value={data.latest.position === null ? '—' : decimal.format(data.latest.position)} comparison={prior?.position === null || prior?.position === undefined || data.latest.position === null ? '—' : `${data.latest.position - prior.position <= 0 ? '' : '+'}${decimal.format(data.latest.position - prior.position)}`} positive={data.latest.position === null || prior?.position === null || prior?.position === undefined ? true : data.latest.position <= prior.position} /></section>
    <p className="mt-3 text-xs text-zinc-500">Position is impression-weighted across imported query rows; lower is better. Query totals reflect only the imported export, not necessarily the whole property.</p>
    <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Review queue ]</p><h2 className="mt-2 text-xl text-white">Actionable signals</h2></div><p className="font-mono text-xs text-zinc-500">{data.insights.length} ranked prompts</p></div>{data.insights.length ? <div className="mt-5 grid gap-4 lg:grid-cols-3">{data.insights.map((insight) => <article key={insight.id} className="border border-zinc-800 bg-zinc-950/50 p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{insight.kind.replaceAll('_', ' ')}</p><h3 className="mt-2 text-lg text-white">{insight.query}</h3></div><span className="font-mono text-lg text-cyan-200">{insight.priority}</span></div><p className="mt-4 text-sm leading-relaxed text-zinc-400">{insight.recommendation}</p><p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{insight.current.impressions} impressions · {insight.current.clicks} clicks · {insight.current.ctr}% CTR · position {insight.current.position}</p></article>)}</div> : <p className="mt-5 border border-zinc-800 p-6 text-sm text-zinc-500">No query meets the current review thresholds. Import at least two snapshots to detect momentum.</p>}</section>
    <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Latest export ]</p><h2 className="mt-2 text-xl text-white">Top queries</h2></div><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter queries" className="border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400" /></div><div className="mt-5 overflow-x-auto border border-zinc-800"><table className="min-w-full text-left text-sm"><thead className="bg-zinc-950 font-mono text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Query</th><th className="px-4 py-3 text-right">Impr.</th><th className="px-4 py-3 text-right">Clicks</th><th className="px-4 py-3 text-right">CTR</th><th className="px-4 py-3 text-right">Position</th><th className="px-4 py-3 text-right">Δ impr.</th></tr></thead><tbody className="divide-y divide-zinc-800">{visibleQueries.map((row) => <tr key={row.query}><td className="max-w-sm px-4 py-3 text-zinc-200">{row.query}</td><td className="px-4 py-3 text-right text-zinc-300">{number.format(row.impressions)}</td><td className="px-4 py-3 text-right text-zinc-300">{number.format(row.clicks)}</td><td className="px-4 py-3 text-right text-zinc-300">{decimal.format(row.ctr)}%</td><td className="px-4 py-3 text-right text-zinc-300">{decimal.format(row.position)}</td><td className="px-4 py-3 text-right font-mono text-xs text-cyan-100">{row.previous ? `${row.impressions - row.previous.impressions >= 0 ? '+' : ''}${number.format(row.impressions - row.previous.impressions)}` : 'new'}</td></tr>)}{visibleQueries.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No queries match this view.</td></tr>}</tbody></table></div><p className="mt-3 text-xs text-zinc-500">Showing up to 100 highest-impression queries from the latest import. The complete historical snapshot remains in the private ledger.</p></section>
  </div></main>
}
