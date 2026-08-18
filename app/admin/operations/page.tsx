'use client'

import { useMemo, useState } from 'react'

type LoadState = 'idle' | 'ready' | 'unavailable'
type MarketOpportunity = { status: string }
type DemandCluster = { status: string }
type Experiment = { status: string; measure_after_on: string }
type ContentCandidate = { status: string }
type ContentDraft = { status: string }
type ContentHandoff = { decision: string }
type MicroValidation = { status: string; measure_after_on: string }
type Prospect = { status: string }
type InboundSubmission = { operations_status: string; qualification_status: string; deadline: string | null }
type RevenueMetrics = {
  revenue?: { totals?: { grossCents?: number; refundedCents?: number; netCents?: number } }
  funnel?: { overall?: Record<string, number> }
}

type MarketSnapshot = {
  opportunities: MarketOpportunity[]
  clusters: DemandCluster[]
  experiments: Experiment[]
  candidates: ContentCandidate[]
  drafts: ContentDraft[]
  handoffs: ContentHandoff[]
  validations: MicroValidation[]
  prospects: Prospect[]
}

const button = 'border border-cyan-500 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-40'
const link = 'border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:border-cyan-600'

function count(rows: { status: string }[], statuses: string[]) { return rows.filter((row) => statuses.includes(row.status)).length }
function money(cents?: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100) }
function isoToday() { return new Date().toISOString().slice(0, 10) }

async function getJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const body = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? 'The private operations ledger is unavailable.')
  return body
}

export default function OperationsHomePage() {
  const [marketToken, setMarketToken] = useState('')
  const [inboundToken, setInboundToken] = useState('')
  const [revenueToken, setRevenueToken] = useState('')
  const [market, setMarket] = useState<MarketSnapshot | null>(null)
  const [inbound, setInbound] = useState<InboundSubmission[] | null>(null)
  const [revenue, setRevenue] = useState<RevenueMetrics | null>(null)
  const [marketState, setMarketState] = useState<LoadState>('idle')
  const [inboundState, setInboundState] = useState<LoadState>('idle')
  const [revenueState, setRevenueState] = useState<LoadState>('idle')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const summary = useMemo(() => {
    if (!market) return null
    const due = market.experiments.filter((item) => item.status === 'measuring' && item.measure_after_on <= isoToday()).length
    const utilityDue = market.validations.filter((item) => item.status === 'measuring' && item.measure_after_on <= isoToday()).length
    return {
      marketReview: count(market.opportunities, ['discovered', 'under_review']),
      approvedSignals: count(market.opportunities, ['approved_for_experiment']),
      validDemand: count(market.clusters, ['validated']),
      experimentsToMeasure: due,
      contentToReview: count(market.drafts, ['private_draft', 'editorial_ready']),
      handoffsReady: market.handoffs.filter((item) => item.decision === 'ready_for_human_publish').length,
      utilityToMeasure: utilityDue,
      outboundFollowUp: count(market.prospects, ['reviewing', 'qualified', 'draft_ready', 'approved', 'sent', 'replied']),
    }
  }, [market])

  const inboundSummary = useMemo(() => {
    if (!inbound) return null
    return {
      active: inbound.filter((item) => !['closed', 'declined', 'archived'].includes(item.operations_status)).length,
      qualified: inbound.filter((item) => item.qualification_status === 'qualified').length,
      deadline: inbound.filter((item) => item.deadline && !['closed', 'declined', 'archived'].includes(item.operations_status)).length,
    }
  }, [inbound])

  async function load() {
    if (!marketToken && !inboundToken && !revenueToken) { setNotice('Enter at least one existing private token. Tokens stay only in this browser tab and are never saved.'); return }
    setLoading(true); setNotice('')
    const jobs: Promise<void>[] = []
    if (marketToken) jobs.push((async () => {
      try {
        const [opportunities, demand, experiments, candidates, drafts, handoffs, utilities, outbound] = await Promise.all([
          getJson<{ opportunities?: MarketOpportunity[] }>('/api/admin/market-opportunities', marketToken),
          getJson<{ clusters?: DemandCluster[] }>('/api/admin/demand-validation', marketToken),
          getJson<{ experiments?: Experiment[] }>('/api/admin/experiments', marketToken),
          getJson<{ candidates?: ContentCandidate[] }>('/api/admin/content-candidates', marketToken),
          getJson<{ drafts?: ContentDraft[] }>('/api/admin/content-drafts', marketToken),
          getJson<{ handoffs?: ContentHandoff[] }>('/api/admin/content-handoffs', marketToken),
          getJson<{ validations?: MicroValidation[] }>('/api/admin/micro-utility-validations', marketToken),
          getJson<{ prospects?: Prospect[] }>('/api/admin/outbound', marketToken),
        ])
        setMarket({ opportunities: opportunities.opportunities ?? [], clusters: demand.clusters ?? [], experiments: experiments.experiments ?? [], candidates: candidates.candidates ?? [], drafts: drafts.drafts ?? [], handoffs: handoffs.handoffs ?? [], validations: utilities.validations ?? [], prospects: outbound.prospects ?? [] })
        setMarketState('ready')
      } catch (error) { setMarket(null); setMarketState('unavailable'); setNotice(error instanceof Error ? error.message : 'Market operations could not be loaded.') }
    })())
    if (inboundToken) jobs.push((async () => {
      try { const result = await getJson<{ submissions?: InboundSubmission[] }>('/api/admin/inbound-operations', inboundToken); setInbound(result.submissions ?? []); setInboundState('ready') }
      catch (error) { setInbound(null); setInboundState('unavailable'); setNotice(error instanceof Error ? error.message : 'Inbound operations could not be loaded.') }
    })())
    if (revenueToken) jobs.push((async () => {
      try { const result = await getJson<RevenueMetrics>('/api/admin/revenue-metrics?period=month', revenueToken); setRevenue(result); setRevenueState('ready') }
      catch (error) { setRevenue(null); setRevenueState('unavailable'); setNotice(error instanceof Error ? error.message : 'Revenue metrics could not be loaded.') }
    })())
    await Promise.all(jobs)
    setLoading(false)
  }

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs tracking-widest text-cyan-300">[ OPERATIONS HOME // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Maha operator console</h1><p className="mt-2 max-w-3xl text-sm text-zinc-400">A read-only daily map of the existing systems. It joins no ledgers, sends no messages, publishes nothing, and keeps the separate authorization boundaries intact.</p></div><div className="flex flex-wrap items-center gap-2"><a className={link} href="/admin/orchestration">Workflow orchestration</a><button onClick={() => void load()} disabled={loading} className={button}>{loading ? 'Loading…' : 'Refresh available systems'}</button></div></header>

    <section className="mt-8 grid gap-5 lg:grid-cols-3"><TokenPanel title="Growth, content & outbound" name="Market mapping token" value={marketToken} onChange={setMarketToken} state={marketState} description="Opportunity queue, demand, experiments, content workflow, utility validation, and outbound CRM."/><TokenPanel title="Inbound operations" name="Inbound operations token" value={inboundToken} onChange={setInboundToken} state={inboundState} description="Qualified contact submissions and manual review queue."/><TokenPanel title="Revenue metrics" name="Revenue control token" value={revenueToken} onChange={setRevenueToken} state={revenueState} description="PII-free revenue, reconciliation, and product funnel metrics."/></section>
    <p className="mt-3 text-xs text-zinc-500">Tokens are held only in React memory for this page. Closing or reloading the tab clears them. This console uses existing protected endpoints rather than a new shared credential.</p>
    {notice && <p className="mt-5 border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{notice}</p>}

    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <NextCard number={summary?.marketReview} label="Market signals to review" href="/admin/market-mapping" action="Review direct-demand evidence" state={marketState} />
      <NextCard number={inboundSummary?.active} label="Active inbound items" href="/admin/inbound" action={inboundSummary?.deadline ? `${inboundSummary.deadline} with deadline` : 'Qualify or request context'} state={inboundState} />
      <NextCard number={summary?.experimentsToMeasure} label="Experiments ready to measure" href="/admin/experiments" action="Retain, iterate, or retire" state={marketState} />
      <NextCard number={summary?.handoffsReady} label="Publication handoffs ready" href="/admin/content-workflow" action="Review then explicitly release" state={marketState} />
    </section>

    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <Panel title="Demand and offer validation" state={marketState}>
        <MetricRow label="Approved signals awaiting corroboration" value={summary?.approvedSignals} />
        <MetricRow label="Validated demand clusters" value={summary?.validDemand} />
        <MetricRow label="Micro-utility validations due" value={summary?.utilityToMeasure} />
        <div className="mt-5 flex flex-wrap gap-2"><a className={link} href="/admin/demand-validation">Demand gate</a><a className={link} href="/admin/som-evaluator">SOM evaluator</a><a className={link} href="/admin/experiments">Experiments</a><a className={link} href="/admin/micro-utility-validations">Utility validation</a></div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">Advance only when the listed gate is genuinely met. A validated cluster permits a bounded experiment, not autonomous publishing, spend, outreach, or product deployment.</p>
      </Panel>
      <Panel title="Editorial and distribution" state={marketState}>
        <MetricRow label="Private/editorial drafts to review" value={summary?.contentToReview} />
        <MetricRow label="Human release handoffs" value={summary?.handoffsReady} />
        <MetricRow label="Outbound follow-ups to record" value={summary?.outboundFollowUp} />
        <div className="mt-5 flex flex-wrap gap-2"><a className={link} href="/admin/content-workflow">Content workflow</a><a className={link} href="/admin/content-publication-amendments">Amend live sources</a><a className={link} href="/admin/outbound">Outbound CRM</a><a className={link} href="/admin/sales-pipeline">Sales pipeline</a></div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">A score-qualified content handoff is not a truth guarantee or automatic release. Outbound drafts must be personally sent and then recorded accurately.</p>
      </Panel>
      <Panel title="Inbound and revenue" state={inboundState === 'ready' || revenueState === 'ready' ? 'ready' : inboundState === 'unavailable' || revenueState === 'unavailable' ? 'unavailable' : 'idle'}>
        <MetricRow label="Qualified inbound" value={inboundSummary?.qualified} />
        <MetricRow label="Net reconciled revenue" value={revenue ? money(revenue.revenue?.totals?.netCents) : undefined} />
        <MetricRow label="Paid opportunities" value={revenue?.funnel?.overall?.paid} />
        <div className="mt-5 flex flex-wrap gap-2"><a className={link} href="/admin/inbound">Inbound queue</a><a className={link} href="/admin/revenue">Revenue dashboard</a></div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">Stripe remains payment authority. Log revenue status only from reconciled payment/delivery/reversal events; this console does not expose inbound PII.</p>
      </Panel>
      <Panel title="Today’s safe operating sequence" state="ready">
        <ol className="space-y-3 text-sm text-zinc-300"><li><span className="font-mono text-cyan-300">01</span> Review urgent qualified inbound and personally decide the response.</li><li><span className="font-mono text-cyan-300">02</span> Review direct-demand evidence, not generic topical results.</li><li><span className="font-mono text-cyan-300">03</span> Advance one best-supported demand/experiment step.</li><li><span className="font-mono text-cyan-300">04</span> Check revenue/refunds and record only actual outcomes.</li><li><span className="font-mono text-cyan-300">05</span> Publish or send only after the relevant explicit approval gate.</li></ol>
        <p className="mt-5 border-l-2 border-cyan-500 pl-3 text-xs leading-relaxed text-cyan-100">This is an operations guide, not an automation command. Empty queues are an honest signal to learn from—not a reason to invent work or loosen the gates.</p>
      </Panel>
    </section>
  </div></main>
}

function TokenPanel({ title, name, value, onChange, state, description }: { title: string; name: string; value: string; onChange: (value: string) => void; state: LoadState; description: string }) {
  const stateText = state === 'ready' ? 'Loaded for this session' : state === 'unavailable' ? 'Unavailable or token rejected' : 'Optional for this view'
  const tone = state === 'ready' ? 'text-emerald-300' : state === 'unavailable' ? 'text-red-300' : 'text-zinc-500'
  return <section className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{title}</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">{description}</p><label className="mt-5 block text-xs text-zinc-500">{name}<input type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm text-zinc-200 outline-none focus:border-cyan-400" /></label><p className={`mt-3 text-xs ${tone}`}>{stateText}</p></section>
}

function Panel({ title, state, children }: { title: string; state: LoadState; children: React.ReactNode }) {
  return <section className="border border-zinc-800 bg-zinc-950/50 p-5"><div className="flex items-baseline justify-between gap-3"><h2 className="text-lg text-white">{title}</h2><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{state === 'ready' ? 'Live snapshot' : state === 'unavailable' ? 'Unavailable' : 'Unlock to load'}</p></div>{children}</section>
}

function MetricRow({ label, value }: { label: string; value: number | string | undefined }) {
  return <div className="mt-4 flex items-baseline justify-between gap-4 border-b border-zinc-800 pb-3"><p className="text-sm text-zinc-400">{label}</p><p className="font-mono text-xl text-cyan-100">{value ?? '—'}</p></div>
}

function NextCard({ number, label, href, action, state }: { number: number | undefined; label: string; href: string; action: string; state: LoadState }) {
  return <a href={href} className="border border-zinc-800 bg-zinc-950/50 p-5 transition hover:border-cyan-600"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 font-mono text-4xl text-cyan-200">{state === 'ready' ? number ?? 0 : '—'}</p><p className="mt-3 text-sm text-zinc-400">{action}</p></a>
}
