'use client'

import { useMemo, useState } from 'react'

import { OPERATIONS, currentJupiterPhase, formatDate } from '@/lib/transit-alignment'

function statusFor(operationId: string, phaseId: string) {
  const operation = OPERATIONS.find((item) => item.id === operationId)!
  if (operation.bestIn.includes(phaseId)) return { label: 'Proceed', tone: 'text-emerald-200 border-emerald-500/50 bg-emerald-950/25', copy: 'This is a supportive window to act, while still checking demand, cash, and delivery capacity.' }
  if (operation.prepareIn.includes(phaseId)) return { label: 'Prepare', tone: 'text-amber-100 border-amber-500/50 bg-amber-950/25', copy: 'Do the research, proof, and operational setup now; wait for a stronger commercial window to commit.' }
  if (operation.avoidIn.includes(phaseId)) return { label: 'Defer', tone: 'text-rose-200 border-rose-500/50 bg-rose-950/25', copy: 'Keep this out of the critical path. Preserve energy for the current commercial mandate.' }
  return { label: 'Neutral', tone: 'text-zinc-300 border-zinc-700 bg-zinc-950/40', copy: 'The transit lens is neutral here. Let evidence, capacity, and buyer urgency decide.' }
}

export default function TransitOperationsBoard() {
  const [operationId, setOperationId] = useState('pilot')
  const [dateValue, setDateValue] = useState(() => new Date().toISOString().slice(0, 10))
  const phase = useMemo(() => currentJupiterPhase(new Date(`${dateValue}T12:00:00`)), [dateValue])
  const operation = OPERATIONS.find((item) => item.id === operationId)!
  const status = statusFor(operationId, phase.id)

  return <section className="mt-16 border border-zinc-800 bg-zinc-950/50 p-6 sm:p-8">
    <div className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Operational check ]</p><h2 className="mt-2 text-2xl font-light text-white">Check an operating move against the timing board.</h2></div>
      <p className="max-w-sm text-xs leading-relaxed text-zinc-500">This is a reflective planning lens. It does not override evidence, customer consent, legal obligations, or financial controls.</p>
    </div>
    <div className="mt-7 grid gap-5 md:grid-cols-2">
      <label className="text-xs text-zinc-400">Operation<select value={operationId} onChange={(event) => setOperationId(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-black p-3 text-sm text-zinc-100">{OPERATIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs text-zinc-400">Target date<input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-black p-3 text-sm text-zinc-100" /></label>
    </div>
    <div className={`mt-7 border p-6 ${status.tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest opacity-80">{phase.planet} in {phase.sign} · House {phase.house} · {formatDate(phase.startsOn)}–{formatDate(phase.endsOn)}</p><h3 className="mt-3 text-2xl font-light">{status.label}: {operation.name}</h3></div><span className="border border-current px-3 py-1 font-mono text-[10px] uppercase tracking-widest">{status.label}</span></div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-90">{status.copy}</p>
      <p className="mt-5 border-l border-current pl-4 text-sm leading-relaxed"><strong>Current mandate:</strong> {phase.operatingTheme}</p>
    </div>
  </section>
}
