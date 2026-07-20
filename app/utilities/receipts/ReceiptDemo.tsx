'use client'

import { useState } from 'react'

type LineItem = { description: string; quantity: number | null; unitPrice: number | null; amount: number | null; category: string }
type DemoResult = {
  feasible: boolean
  confidence: number
  note: string
  receipt?: { merchant: string | null; purchasedAt: string | null; currency: string | null; subtotal: number | null; tax: number | null; total: number | null; lineItems: LineItem[] }
  csv?: string
  rowCount?: number
  upsell?: { message: string; unit: string } | null
}

export default function ReceiptDemo() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DemoResult | null>(null)

  async function parse() {
    setLoading(true); setError(''); setResult(null)
    try {
      const response = await fetch('/api/utilities/receipts/demo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      })
      const data = await response.json() as DemoResult & { error?: string }
      if (!response.ok) { setError(data.error ?? 'The parse failed. Try again.'); return }
      setResult(data)
    } catch {
      setError('Could not reach the parser. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function downloadCsv() {
    if (!result?.csv) return
    const blob = new Blob([result.csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'receipt.csv'; anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-10">
      <label className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-3">Paste one receipt (text)</label>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={8}
        placeholder={'WHOLE FOODS MARKET\n04/12/2026\nOrganic bananas   2.49\nOat milk 64oz     4.99\nSubtotal          7.48\nTax               0.62\nTotal             8.10'}
        className="w-full border border-zinc-700 bg-black px-4 py-3 font-mono text-sm text-zinc-200 outline-none focus:border-emerald-500"
      />
      <button
        type="button"
        onClick={parse}
        disabled={loading || text.trim().length < 12}
        className="mt-4 bg-emerald-400 px-7 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-600"
      >
        {loading ? 'Parsing…' : 'Parse free →'}
      </button>

      {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}

      {result && !result.feasible && (
        <div role="alert" className="mt-6 border border-amber-700/60 bg-amber-950/20 p-5 text-amber-100">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">Not a receipt we can parse</p>
          <p className="mt-2 text-sm leading-relaxed">{result.note} This check runs <em>before</em> any payment — a paid batch would decline this input, not charge for it.</p>
        </div>
      )}

      {result?.feasible && result.receipt && (
        <div className="mt-6 border border-emerald-800/60 bg-emerald-950/10 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">
              {result.rowCount} line {result.rowCount === 1 ? 'item' : 'items'} · confidence {(result.confidence * 100).toFixed(0)}%
            </p>
            <button type="button" onClick={downloadCsv} className="bg-white px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-black hover:bg-zinc-200">
              Download CSV ↓
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="py-2 pr-4">Description</th><th className="py-2 pr-4">Qty</th><th className="py-2 pr-4">Amount</th><th className="py-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {result.receipt.lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-zinc-800/70 text-zinc-300">
                    <td className="py-2 pr-4">{item.description}</td>
                    <td className="py-2 pr-4 tabular-nums">{item.quantity ?? ''}</td>
                    <td className="py-2 pr-4 tabular-nums">{item.amount ?? ''}</td>
                    <td className="py-2 text-zinc-400">{item.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-mono text-[11px] text-zinc-500">
            Total {result.receipt.total ?? result.receipt.subtotal ?? '—'} {result.receipt.currency ?? ''} · {result.receipt.merchant ?? 'unknown merchant'}
          </p>
          {result.upsell && (
            <p className="mt-5 border-t border-zinc-800 pt-4 text-sm text-zinc-400">
              {result.upsell.message} <span className="text-emerald-300">Batch pricing coming soon.</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
