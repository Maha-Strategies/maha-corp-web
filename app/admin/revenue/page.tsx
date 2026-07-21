'use client'

import { useState } from 'react'

type FunnelCounts = { opportunities: number; qualified: number; checkoutStarted: number; paid: number; delivered: number; partiallyRefunded: number; refunded: number }
type OfferFunnel = FunnelCounts & { offerId: string }
type SourceFunnel = FunnelCounts & { sourceType: string }
type RevenueBucket = { grossCents: number; refundedCents: number; netCents: number; paidCount: number }
type OfferRevenue = RevenueBucket & { offerId: string; currency: string }
type PeriodRevenue = RevenueBucket & { period: string; currency: string }
type Metrics = {
  generatedAt: string
  granularity: 'day' | 'week' | 'month'
  funnel: { overall: FunnelCounts; byOffer: OfferFunnel[]; bySource: SourceFunnel[] }
  revenue: { totals: RevenueBucket; byOffer: OfferRevenue[]; byPeriod: PeriodRevenue[] }
  inbound: { total: number; qualified: number; needsClarification: number; converted: number; byOffer: { offerId: string; total: number; converted: number }[] }
  utility: { byStatus: Record<string, number>; byRunStatus: Record<string, number>; paid: { currency: string; grossCents: number; count: number }[]; refundedRuns: number }
}

const PERIODS = ['day', 'week', 'month'] as const

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}
function pct(part: number, whole: number) {
  return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`
}

const FUNNEL_STAGES: { key: keyof FunnelCounts; label: string }[] = [
  { key: 'opportunities', label: 'Routed' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'checkoutStarted', label: 'Checkout' },
  { key: 'paid', label: 'Paid' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'refunded', label: 'Refunded' },
]

export default function RevenueMetricsPage() {
  const [token, setToken] = useState('')
  const [period, setPeriod] = useState<typeof PERIODS[number]>('month')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  async function load(withPeriod = period, withToken = token) {
    setLoading(true); setNotice('')
    try {
      const response = await fetch(`/api/admin/revenue-metrics?period=${withPeriod}`, { headers: { Authorization: `Bearer ${withToken}` } })
      const body = await response.json() as Metrics & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Metrics unavailable.')
      setMetrics(body)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Metrics unavailable.')
    } finally {
      setLoading(false)
    }
  }

  function changePeriod(next: typeof PERIODS[number]) {
    setPeriod(next)
    if (metrics) void load(next)
  }

  if (!metrics) {
    return (
      <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200">
        <div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6">
          <p className="font-mono text-xs tracking-widest text-emerald-300">[ REVENUE METRICS // PRIVATE ]</p>
          <h1 className="mt-4 text-2xl text-white">Unlock the dashboard</h1>
          <p className="mt-2 text-sm text-zinc-400">Aggregate figures only — no requester identity is read or shown. Read-only: no sending, no payment authority.</p>
          <input
            type="password" value={token} onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void load() }}
            placeholder="Revenue control token"
            className="mt-5 w-full border border-zinc-700 bg-black p-3 font-mono text-sm outline-none focus:border-emerald-500"
          />
          <button onClick={() => load()} disabled={loading || token.length === 0} className="mt-4 w-full bg-emerald-500 p-3 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">
            {loading ? 'Loading…' : 'Open dashboard'}
          </button>
          {notice && <p className="mt-4 text-sm text-red-300">{notice}</p>}
        </div>
      </main>
    )
  }

  const { funnel, revenue, inbound, utility } = metrics
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-widest text-emerald-300">[ REVENUE METRICS // PRIVATE ]</p>
            <h1 className="mt-3 text-3xl text-white">Revenue dashboard</h1>
            <p className="mt-2 text-sm text-zinc-400">Aggregate only · generated {new Date(metrics.generatedAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex border border-zinc-700">
              {PERIODS.map((option) => (
                <button key={option} onClick={() => changePeriod(option)} className={`px-3 py-2 font-mono text-[10px] uppercase tracking-widest ${period === option ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
                  {option}
                </button>
              ))}
            </div>
            <button onClick={() => load()} disabled={loading} className="border border-zinc-600 px-4 py-2 font-mono text-xs uppercase tracking-widest hover:border-emerald-400 disabled:opacity-40">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {notice && <p className="mt-5 border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{notice}</p>}

        {/* Revenue headline */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Gross revenue" value={money(revenue.totals.grossCents)} sub={`${revenue.totals.paidCount} payments`} />
          <Stat label="Refunded" value={money(revenue.totals.refundedCents)} sub={pct(revenue.totals.refundedCents, revenue.totals.grossCents) + ' of gross'} tone="amber" />
          <Stat label="Net revenue" value={money(revenue.totals.netCents)} sub="gross − refunded" tone="emerald" />
        </section>

        {/* Funnel */}
        <Panel title="Funnel (source → offer → qualified → checkout → paid → delivered/refunded)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {FUNNEL_STAGES.map((stage) => (
              <div key={stage.key} className="border border-zinc-800 bg-black/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{stage.label}</p>
                <p className="mt-2 text-2xl text-white tabular-nums">{funnel.overall[stage.key]}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">{pct(funnel.overall[stage.key], funnel.overall.opportunities)}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* Funnel by offer */}
        <Panel title="Funnel by offer">
          <FunnelTable rows={funnel.byOffer.map((row) => ({ label: row.offerId, counts: row }))} firstHeader="Offer" />
        </Panel>

        {/* Funnel by source */}
        <Panel title="Funnel by source">
          <FunnelTable rows={funnel.bySource.map((row) => ({ label: row.sourceType, counts: row }))} firstHeader="Source" />
        </Panel>

        {/* Revenue by offer */}
        <Panel title="Revenue by offer">
          <Table head={['Offer', 'Currency', 'Gross', 'Refunded', 'Net', 'Payments']}>
            {revenue.byOffer.map((row) => (
              <tr key={`${row.offerId}-${row.currency}`} className="border-b border-zinc-800/70">
                <Td>{row.offerId}</Td>
                <Td className="uppercase">{row.currency}</Td>
                <Td numeric>{money(row.grossCents, row.currency)}</Td>
                <Td numeric className="text-amber-200">{money(row.refundedCents, row.currency)}</Td>
                <Td numeric className="text-emerald-200">{money(row.netCents, row.currency)}</Td>
                <Td numeric>{row.paidCount}</Td>
              </tr>
            ))}
            {revenue.byOffer.length === 0 && <EmptyRow span={6} />}
          </Table>
        </Panel>

        {/* Revenue by period */}
        <Panel title={`Revenue by period (${period})`}>
          <Table head={['Period', 'Currency', 'Gross', 'Refunded', 'Net', 'Payments']}>
            {revenue.byPeriod.map((row) => (
              <tr key={`${row.period}-${row.currency}`} className="border-b border-zinc-800/70">
                <Td className="tabular-nums">{row.period}</Td>
                <Td className="uppercase">{row.currency}</Td>
                <Td numeric>{money(row.grossCents, row.currency)}</Td>
                <Td numeric className="text-amber-200">{money(row.refundedCents, row.currency)}</Td>
                <Td numeric className="text-emerald-200">{money(row.netCents, row.currency)}</Td>
                <Td numeric>{row.paidCount}</Td>
              </tr>
            ))}
            {revenue.byPeriod.length === 0 && <EmptyRow span={6} />}
          </Table>
        </Panel>

        {/* Inbound + utility */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Inbound submissions (top of funnel)" inGrid>
            <div className="grid grid-cols-4 gap-2 text-center">
              <MiniStat label="Total" value={inbound.total} />
              <MiniStat label="Qualified" value={inbound.qualified} />
              <MiniStat label="Clarify" value={inbound.needsClarification} />
              <MiniStat label="Converted" value={inbound.converted} />
            </div>
            <Table head={['Offer', 'Total', 'Converted']}>
              {inbound.byOffer.map((row) => (
                <tr key={row.offerId} className="border-b border-zinc-800/70">
                  <Td>{row.offerId}</Td><Td numeric>{row.total}</Td><Td numeric>{row.converted}</Td>
                </tr>
              ))}
              {inbound.byOffer.length === 0 && <EmptyRow span={3} />}
            </Table>
          </Panel>

          <Panel title="Utility self-serve micro-funnel" inGrid>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KeyedCounts title="Checkout status" counts={utility.byStatus} />
              <KeyedCounts title="Run status" counts={utility.byRunStatus} />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Paid gross</p>
                {utility.paid.length === 0 ? <p className="mt-2 text-sm text-zinc-500">—</p> : utility.paid.map((row) => (
                  <p key={row.currency} className="mt-2 text-sm tabular-nums text-white">{money(row.grossCents, row.currency)} <span className="text-zinc-500">· {row.count}</span></p>
                ))}
              </div>
              <MiniStat label="Refunded runs" value={utility.refundedRuns} />
            </div>
          </Panel>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'emerald' | 'amber' }) {
  const accent = tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-white'
  return (
    <div className="border border-zinc-800 bg-zinc-950/50 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-3 text-3xl tabular-nums ${accent}`}>{value}</p>
      <p className="mt-1 font-mono text-[10px] text-zinc-500">{sub}</p>
    </div>
  )
}

function Panel({ title, children, inGrid }: { title: string; children: React.ReactNode; inGrid?: boolean }) {
  return (
    <section className={inGrid ? 'border border-zinc-800 bg-zinc-950/40 p-5' : 'mt-6 border border-zinc-800 bg-zinc-950/40 p-5'}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function FunnelTable({ rows, firstHeader }: { rows: { label: string; counts: FunnelCounts }[]; firstHeader: string }) {
  return (
    <Table head={[firstHeader, 'Routed', 'Qualified', 'Checkout', 'Paid', 'Delivered', 'Part. ref.', 'Refunded']}>
      {rows.map((row) => (
        <tr key={row.label} className="border-b border-zinc-800/70">
          <Td>{row.label}</Td>
          <Td numeric>{row.counts.opportunities}</Td>
          <Td numeric>{row.counts.qualified}</Td>
          <Td numeric>{row.counts.checkoutStarted}</Td>
          <Td numeric>{row.counts.paid}</Td>
          <Td numeric>{row.counts.delivered}</Td>
          <Td numeric className="text-amber-200">{row.counts.partiallyRefunded}</Td>
          <Td numeric className="text-amber-200">{row.counts.refunded}</Td>
        </tr>
      ))}
      {rows.length === 0 && <EmptyRow span={8} />}
    </Table>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {head.map((cell, index) => <th key={cell} className={`py-2 pr-4 ${index === 0 ? '' : 'text-right'}`}>{cell}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, numeric, className = '' }: { children: React.ReactNode; numeric?: boolean; className?: string }) {
  return <td className={`py-2 pr-4 ${numeric ? 'text-right tabular-nums' : ''} ${className}`}>{children}</td>
}

function EmptyRow({ span }: { span: number }) {
  return <tr><td colSpan={span} className="py-6 text-center text-sm text-zinc-500">No data yet.</td></tr>
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-800 bg-black/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-xl text-white tabular-nums">{value}</p>
    </div>
  )
}

function KeyedCounts({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
      {entries.length === 0 ? <p className="mt-2 text-sm text-zinc-500">—</p> : entries.map(([key, value]) => (
        <p key={key} className="mt-2 text-sm text-zinc-300"><span className="tabular-nums text-white">{value}</span> <span className="text-zinc-500">{key.replaceAll('_', ' ')}</span></p>
      ))}
    </div>
  )
}
