'use client'

import { useMemo, useState } from 'react'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

type NumberFieldProps = { label: string; value: number; onChange: (value: number) => void; step?: number }

function NumberField({ label, value, onChange, step = 1 }: NumberFieldProps) {
  return <label className="block text-xs text-zinc-400">{label}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-indigo-300" /></label>
}

/** A local planning tool; no values leave the browser. */
export function RoiCalculator() {
  const [calls, setCalls] = useState(500_000)
  const [tokensPerCall, setTokensPerCall] = useState(12_000)
  const [reductionPercent, setReductionPercent] = useState(60)
  const [costPerMillion, setCostPerMillion] = useState(3)
  const monthlyAvoidedCost = useMemo(() => (calls * tokensPerCall * (reductionPercent / 100) * costPerMillion) / 1_000_000, [calls, tokensPerCall, reductionPercent, costPerMillion])

  return <aside className="border border-zinc-700 bg-black/40 p-6" aria-labelledby="roi-calculator-title"><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">Token-cost planning scenario</p><h2 id="roi-calculator-title" className="mt-3 text-xl text-white">Model the context you can avoid sending.</h2><p className="mt-3 text-sm leading-6 text-zinc-400">The reduction percentage is an input for planning, not a promised result. This calculator runs only in your browser.</p><div className="mt-6 grid grid-cols-2 gap-4"><NumberField label="Agent calls / month" value={calls} onChange={setCalls} /><NumberField label="Input tokens / call" value={tokensPerCall} onChange={setTokensPerCall} /><NumberField label="Measured reduction (%)" value={reductionPercent} onChange={setReductionPercent} /><NumberField label="Blended input cost / 1M" value={costPerMillion} step={0.01} onChange={setCostPerMillion} /></div><p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Illustrative monthly input cost avoided</p><p className="mt-2 text-4xl font-light text-white">{currency.format(monthlyAvoidedCost)}</p><p className="mt-4 text-xs leading-5 text-zinc-500">Validate latency, output quality, source coverage, and citation completeness alongside token reduction.</p></aside>
}
