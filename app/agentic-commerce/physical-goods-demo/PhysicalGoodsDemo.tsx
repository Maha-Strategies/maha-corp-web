'use client'

import { useMemo, useState } from 'react'

import type { PhysicalCommerceDemoResult } from '@/lib/carp/physical-commerce-demo'

type RunState = 'idle' | 'running' | 'complete' | 'error'

const stateLabels: Record<string, string> = {
  ENQUIRY_RECEIVED: 'Enquiry received',
  PRODUCT_MATCHED: 'Product matched',
  QUOTE_PENDING: 'Quote pending',
  QUOTE_APPROVED: 'Quote approved',
  BUYER_ACCEPTED: 'Buyer accepted',
  AWAITING_PAYMENT: 'Awaiting payment',
  FUNDED: 'Simulated escrow funded',
  EXPORTER_ACCEPTED: 'Exporter accepted',
  PACKED: 'Packed',
  EXPORT_CLEARED: 'Export cleared',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  RELEASED: 'Simulated funds released',
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default function PhysicalGoodsDemo() {
  const [quantity, setQuantity] = useState(20)
  const [runState, setRunState] = useState<RunState>('idle')
  const [result, setResult] = useState<PhysicalCommerceDemoResult | null>(null)
  const [error, setError] = useState('')
  const [showJson, setShowJson] = useState(false)
  const [copied, setCopied] = useState(false)

  const estimatedSubtotal = useMemo(() => quantity * 25, [quantity])

  async function runDemo() {
    setRunState('running')
    setError('')
    setShowJson(false)
    try {
      const response = await fetch('/api/agentic-commerce/physical-goods-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEnquiryRef: `web-demo-${crypto.randomUUID()}`,
          quantity,
          destinationCountry: 'US',
        }),
      })
      const payload = await response.json() as PhysicalCommerceDemoResult & { error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message ?? `The demonstration returned HTTP ${response.status}.`)
      setResult(payload)
      setRunState('complete')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demonstration could not be completed.')
      setRunState('error')
    }
  }

  async function copyReport() {
    if (!result) return
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-14 text-zinc-200 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-amber-300">[ CARP / CABEZON physical commerce lab ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight text-white sm:text-6xl">See the whole order loop before anything is sold.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">Run a governed agent enquiry through quote approval, simulated escrow, exporter acceptance, shipment evidence, delivery, and release. The event history is hash-linked so every transition can be audited.</p>
        </header>

        <section className="mt-9 border border-amber-800/70 bg-amber-950/20 p-5" aria-labelledby="safety-heading">
          <h2 id="safety-heading" className="font-mono text-xs uppercase tracking-widest text-amber-200">Demonstration only — no commercial transaction</h2>
          <p className="mt-3 max-w-5xl text-sm leading-6 text-amber-100/80">There is no real tea inventory, licensed exporter, importer, payment, escrow, customs filing, carrier, shipment, or delivery behind this page. Prices and counterparties are fictional. This is a workflow and evidence demonstration, not an offer for sale.</p>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border border-zinc-800 bg-zinc-950/60 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Bounded fictional enquiry</p>
            <h2 className="mt-3 text-2xl text-white">Sri Lankan black tea → United States</h2>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-zinc-500">Pack size</dt><dd className="mt-1 text-white">100 g</dd></div>
              <div><dt className="text-zinc-500">Unit price</dt><dd className="mt-1 text-white">$25 illustrative</dd></div>
              <div><dt className="text-zinc-500">Certification claims</dt><dd className="mt-1 text-white">None</dd></div>
              <div><dt className="text-zinc-500">Freight</dt><dd className="mt-1 text-white">$120 illustrative</dd></div>
            </dl>
            <label htmlFor="quantity" className="mt-7 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Fictional pack quantity</label>
            <input id="quantity" type="number" min={20} max={100} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-2 w-full border border-zinc-700 bg-black px-4 py-3 text-white focus:border-amber-500 focus:outline-none" />
            <p className="mt-3 text-xs text-zinc-500">Illustrative product subtotal: {usd(estimatedSubtotal)}. The server enforces 20–100 packs.</p>
            <button type="button" onClick={() => void runDemo()} disabled={runState === 'running'} className="mt-6 w-full border border-amber-500 bg-amber-950/30 px-5 py-3 font-mono text-xs uppercase tracking-widest text-amber-100 hover:bg-amber-900/40 disabled:cursor-wait disabled:opacity-50">
              {runState === 'running' ? 'Running governed workflow…' : result ? 'Run a new demonstration' : 'Run the full demonstration'}
            </button>
            {error && <p role="alert" className="mt-4 border border-red-900 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
          </div>

          <div className="border border-zinc-800 bg-zinc-950/40 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Control boundary</p>
            <h2 className="mt-3 text-2xl text-white">What Maha does—and does not do</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Boundary title="Maha controls" items={['Offer matching and policy rules', 'Explicit approval states', 'Append-only transition evidence', 'Quote and commission calculation', 'Machine-readable delivery record']} />
              <Boundary title="Partners must control" items={['Inventory and exporter license', 'Import and food compliance', 'Regulated payment or escrow', 'Packing and export filings', 'Carrier tracking and disputes']} />
            </div>
            <div className="mt-6 border-t border-zinc-800 pt-5 text-sm leading-6 text-zinc-400">
              <p>Commercial model shown by the demo: Maha earns <strong className="text-white">10% of the product subtotal</strong>, while freight is allocated separately. That is an illustrative policy, not a published customer price.</p>
            </div>
          </div>
        </section>

        {result && <>
          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Illustrative financial allocation">
            <Metric label="Buyer total" value={usd(result.quote.totalBuyerPayment)} detail="Product plus illustrative freight" />
            <Metric label="Exporter product proceeds" value={usd(result.quote.exporterProductProceeds)} detail="90% of product subtotal" />
            <Metric label="Maha commission" value={usd(result.quote.mahaCommission)} detail="10% of product subtotal" />
            <Metric label="Real funds moved" value="No" detail="Simulated escrow only" />
          </section>

          <section className="mt-8 border border-zinc-800 bg-zinc-950/50 p-6 sm:p-8" aria-labelledby="timeline-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ append-only state machine ]</p><h2 id="timeline-heading" className="mt-3 text-3xl text-white">Enquiry → delivery → release</h2></div>
              <p className="max-w-xl text-sm leading-6 text-zinc-500">Each event commits to the previous event hash. Human approvals are marked separately from automatic transitions.</p>
            </div>
            <ol className="mt-8 grid gap-3 lg:grid-cols-2">
              {result.events.map((event) => <li key={event.eventHash} className="border border-zinc-800 bg-black/40 p-4">
                <div className="flex items-start gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-700 font-mono text-xs text-zinc-400">{event.sequence}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm text-white">{stateLabels[event.state] ?? event.state}</h3>{event.humanApprovalRequired && <span className="border border-amber-800 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-300">human approval</span>}</div><p className="mt-2 text-xs leading-5 text-zinc-500">{event.detail}</p><p className="mt-2 truncate font-mono text-[9px] text-zinc-700">{event.eventHash}</p></div></div>
              </li>)}
            </ol>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="border border-zinc-800 bg-zinc-950/40 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence bundle</p><h2 className="mt-3 text-2xl text-white">Machine-verifiable handles</h2><dl className="mt-5 space-y-4 text-xs"><Hash label="Quote hash" value={result.evidence.quoteHash} /><Hash label="Event chain head" value={result.evidence.eventChainHead} /><Hash label="Report hash" value={result.evidence.reportHash} /><div><dt className="text-zinc-500">Simulated tracking reference</dt><dd className="mt-1 font-mono text-amber-200">{result.evidence.simulatedTrackingReference}</dd></div></dl></article>
            <article className="border border-zinc-800 bg-zinc-950/40 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Promotion gate</p><h2 className="mt-3 text-2xl text-white">What must exist before a real order</h2><ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-400">{result.productionRequirements.map((item) => <li key={item} className="flex gap-3"><span className="text-amber-400">—</span><span>{item}</span></li>)}</ul></article>
          </section>

          <section className="mt-8 border border-zinc-800 p-6">
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setShowJson((value) => !value)} className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:border-zinc-500">{showJson ? 'Hide JSON report' : 'Inspect JSON report'}</button><button type="button" onClick={() => void copyReport()} className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:border-zinc-500">{copied ? 'Copied' : 'Copy report'}</button><a href="/.well-known/maha/physical-commerce-demo.json" className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:border-zinc-500">Machine contract</a><a href="/.well-known/carp/seller.json" className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:border-zinc-500">CARP seller profile</a></div>
            {showJson && <pre className="mt-5 max-h-[40rem] overflow-auto border border-zinc-800 bg-black p-4 text-[11px] leading-5 text-emerald-200">{JSON.stringify(result, null, 2)}</pre>}
          </section>
        </>}
      </div>
    </main>
  )
}

function Boundary({ title, items }: { title: string; items: string[] }) {
  return <div><h3 className="text-sm text-white">{title}</h3><ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-500">{items.map((item) => <li key={item}>— {item}</li>)}</ul></div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 text-3xl font-light text-white">{value}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p></article>
}

function Hash({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-zinc-500">{label}</dt><dd className="mt-1 break-all font-mono text-[10px] leading-4 text-emerald-300">{value}</dd></div>
}
