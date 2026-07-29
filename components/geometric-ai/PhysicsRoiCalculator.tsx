'use client'

import { useMemo, useState } from 'react'

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function Field({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-xs text-zinc-400">{label}<input aria-label={label} type="number" value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" /></label>
}

/** Local planning model. The multiplier is an assumption, not a performance guarantee. */
export function PhysicsRoiCalculator() {
  const [baselineSamples, setBaselineSamples] = useState(1_000_000)
  const [costPerSample, setCostPerSample] = useState(8)
  const [efficiency, setEfficiency] = useState(20)
  const result = useMemo(() => {
    const constrainedSamples = Math.ceil(baselineSamples / efficiency)
    const avoidedSamples = baselineSamples - constrainedSamples
    return { constrainedSamples, avoidedSamples, avoidedCost: avoidedSamples * costPerSample }
  }, [baselineSamples, costPerSample, efficiency])

  return <aside className="border border-cyan-900/70 bg-black/40 p-6" aria-labelledby="physics-roi-title"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Data-efficiency scenario</p><h2 id="physics-roi-title" className="mt-3 text-xl text-white">Model the data you may avoid collecting.</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Set a planning assumption from 10× to 100×. This local calculator does not send inputs anywhere and does not promise a measured outcome.</p><div className="mt-6 grid gap-4 sm:grid-cols-3"><Field label="Baseline labeled samples" value={baselineSamples} min={1} max={100_000_000} onChange={setBaselineSamples} /><Field label="Cost per sample (USD)" value={costPerSample} min={0} max={1_000_000} onChange={setCostPerSample} /><Field label="Assumed efficiency (×)" value={efficiency} min={10} max={100} onChange={setEfficiency} /></div><div className="mt-7 grid gap-4 border-t border-zinc-800 pt-6 sm:grid-cols-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Constrained scenario</p><p className="mt-2 text-2xl text-white">{number.format(result.constrainedSamples)}</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Samples avoided</p><p className="mt-2 text-2xl text-white">{number.format(result.avoidedSamples)}</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Illustrative cost avoided</p><p className="mt-2 text-2xl text-cyan-200">{currency.format(result.avoidedCost)}</p></div></div></aside>
}
