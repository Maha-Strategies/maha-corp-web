'use client'

import { useMemo, useState } from 'react'

type VariableKind = 'integer' | 'continuous' | 'boolean' | 'choice'
type Variable = { id: string; name: string; kind: VariableKind; domain: string }
type ConstraintKind = 'hard' | 'soft'
type Constraint = { id: string; kind: ConstraintKind; statement: string; variableNames: string; source: string }

const uid = () => crypto.randomUUID()
const blankVariable = (): Variable => ({ id: uid(), name: '', kind: 'integer', domain: '' })
const blankConstraint = (kind: ConstraintKind = 'hard'): Constraint => ({ id: uid(), kind, statement: '', variableNames: '', source: '' })

const sample = {
  title: 'Regional distribution pilot',
  scope: 'Select weekly allocations for a three-node distribution pilot while meeting service and capacity limits.',
  objective: 'Minimize total delivered cost while maintaining required service coverage.',
  direction: 'minimize' as const,
  variables: [
    { id: 'sample-route-a', name: 'route_a_units', kind: 'integer' as const, domain: '0 to 800 units per week' },
    { id: 'sample-route-b', name: 'route_b_units', kind: 'integer' as const, domain: '0 to 650 units per week' },
  ],
  constraints: [
    { id: 'sample-hard-1', kind: 'hard' as const, statement: 'Total weekly allocation must be at least 1,000 units.', variableNames: 'route_a_units, route_b_units', source: 'Service commitment' },
    { id: 'sample-hard-2', kind: 'hard' as const, statement: 'Each route must remain within its stated weekly capacity.', variableNames: 'route_a_units, route_b_units', source: 'Carrier capacity sheet' },
    { id: 'sample-soft-1', kind: 'soft' as const, statement: 'Prefer allocations that minimize route imbalance.', variableNames: 'route_a_units, route_b_units', source: 'Operating preference' },
  ],
  assumptions: 'Unit costs, service commitments, and capacities are current for the selected pilot week. This sample does not contain real operational data.',
}

function validName(value: string) { return /^[A-Za-z][A-Za-z0-9_]*$/.test(value.trim()) }

function download(value: string) {
  const blob = new Blob([value], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'maha-constraint-pack.json'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function ConstraintCompiler() {
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [objective, setObjective] = useState('')
  const [direction, setDirection] = useState<'minimize' | 'maximize' | 'satisfy'>('minimize')
  const [variables, setVariables] = useState<Variable[]>([blankVariable()])
  const [constraints, setConstraints] = useState<Constraint[]>([blankConstraint('hard')])
  const [assumptions, setAssumptions] = useState('')
  const [copied, setCopied] = useState(false)

  const preflight = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []
    if (!title.trim()) errors.push('Name the decision or planning problem.')
    if (!scope.trim()) errors.push('State the decision scope and time boundary.')
    if (!objective.trim()) errors.push('State one primary objective.')
    if (!variables.length) errors.push('Add at least one decision variable.')
    const names = new Map<string, number>()
    for (const variable of variables) {
      const name = variable.name.trim()
      if (!validName(name)) errors.push(`Variable “${name || 'unnamed'}” needs a solver-safe name: letters, numbers, and underscores; start with a letter.`)
      if (!variable.domain.trim()) errors.push(`Variable “${name || 'unnamed'}” needs a domain or bound.`)
      const key = name.toLowerCase()
      if (name) names.set(key, (names.get(key) ?? 0) + 1)
    }
    for (const [name, count] of names) if (count > 1) errors.push(`Variable “${name}” appears more than once.`)
    const variableNames = new Set(variables.map((variable) => variable.name.trim().toLowerCase()).filter(Boolean))
    for (const constraint of constraints) {
      if (!constraint.statement.trim()) errors.push(`${constraint.kind === 'hard' ? 'Hard' : 'Soft'} constraint ${constraint.id.slice(0, 4)} needs a statement.`)
      const mentioned = constraint.variableNames.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
      for (const name of mentioned) if (!variableNames.has(name)) errors.push(`Constraint references “${name}”, which is not a defined variable.`)
      if (constraint.kind === 'soft' && !constraint.source.trim()) warnings.push(`Soft constraint ${constraint.id.slice(0, 4)} has no stated owner or source.`)
    }
    if (!constraints.some((constraint) => constraint.kind === 'hard' && constraint.statement.trim())) warnings.push('No complete hard constraint is present. A solver handoff needs at least one non-negotiable limit.')
    if (!assumptions.trim()) warnings.push('No assumptions are recorded. State what must be true for this pack to be used.')
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
  }, [title, scope, objective, variables, constraints, assumptions])

  const pack = useMemo(() => ({
    schemaVersion: 'maha-constraint-pack/0.1',
    generatedAt: new Date().toISOString(),
    status: preflight.errors.length ? 'needs_review' : 'preflight_complete',
    decision: { title: title.trim(), scope: scope.trim(), objective: objective.trim(), direction },
    variables: variables.map(({ name, kind, domain }) => ({ name: name.trim(), kind, domain: domain.trim() })),
    constraints: constraints.map(({ kind, statement, variableNames, source }) => ({ kind, statement: statement.trim(), variableNames: variableNames.split(',').map((value) => value.trim()).filter(Boolean), source: source.trim() || undefined })),
    assumptions: assumptions.trim() ? assumptions.trim().split('\n').map((value) => value.trim()).filter(Boolean) : [],
    preflight: preflight,
    limits: [
      'This pack is a problem-specification aid. It does not calculate an optimum or make a decision.',
      'Natural-language constraints require human review before formal solver encoding.',
      'Use current, authorized data and validate any solver model independently before operational use.',
    ],
  }), [title, scope, objective, direction, variables, constraints, assumptions, preflight])

  const json = useMemo(() => JSON.stringify(pack, null, 2), [pack])

  function updateVariable(id: string, patch: Partial<Variable>) { setVariables((current) => current.map((variable) => variable.id === id ? { ...variable, ...patch } : variable)) }
  function updateConstraint(id: string, patch: Partial<Constraint>) { setConstraints((current) => current.map((constraint) => constraint.id === id ? { ...constraint, ...patch } : constraint)) }
  function loadSample() { setTitle(sample.title); setScope(sample.scope); setObjective(sample.objective); setDirection(sample.direction); setVariables(sample.variables); setConstraints(sample.constraints); setAssumptions(sample.assumptions); setCopied(false) }
  async function copyJson() { await navigator.clipboard.writeText(json); setCopied(true); window.setTimeout(() => setCopied(false), 2000) }

  return <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
    <section className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ 01 · specify ]</p><button type="button" onClick={loadSample} className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 underline underline-offset-4 hover:text-white">Load safe example</button></div>
      <label className="block text-sm text-zinc-300">Decision name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Regional distribution pilot" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
      <label className="block text-sm text-zinc-300">Scope and time boundary<textarea value={scope} onChange={(event) => setScope(event.target.value)} placeholder="What is being decided, for whom, and over what period?" rows={3} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm leading-relaxed text-white outline-none focus:border-cyan-400" /></label>
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]"><label className="block text-sm text-zinc-300">Primary objective<input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="e.g. Minimize delivered cost" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-cyan-400" /></label><label className="block text-sm text-zinc-300">Direction<select value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"><option value="minimize">Minimize</option><option value="maximize">Maximize</option><option value="satisfy">Satisfy</option></select></label></div>
      <fieldset className="border-t border-zinc-800 pt-7"><div className="flex items-center justify-between gap-3"><legend className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Decision variables ]</legend><button type="button" onClick={() => setVariables((current) => [...current, blankVariable()])} className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">+ Add variable</button></div><p className="mt-2 text-xs leading-relaxed text-zinc-500">Use names a solver can consume later, such as <code>route_a_units</code> or <code>weekly_budget</code>.</p><div className="mt-4 space-y-3">{variables.map((variable, index) => <div key={variable.id} className="grid gap-2 border border-zinc-800 p-3 sm:grid-cols-[1fr_140px_1.2fr_auto]"><input value={variable.name} onChange={(event) => updateVariable(variable.id, { name: event.target.value })} placeholder={`variable_${index + 1}`} className="border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"/><select value={variable.kind} onChange={(event) => updateVariable(variable.id, { kind: event.target.value as VariableKind })} className="border border-zinc-700 bg-black px-3 py-2 text-sm text-white"><option value="integer">Integer</option><option value="continuous">Continuous</option><option value="boolean">Boolean</option><option value="choice">Choice</option></select><input value={variable.domain} onChange={(event) => updateVariable(variable.id, { domain: event.target.value })} placeholder="domain / bound" className="border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"/>{variables.length > 1 && <button type="button" onClick={() => setVariables((current) => current.filter((item) => item.id !== variable.id))} className="px-2 text-xs text-zinc-500 hover:text-white" aria-label={`Remove variable ${index + 1}`}>×</button>}</div>)}</div></fieldset>
      <fieldset className="border-t border-zinc-800 pt-7"><div className="flex items-center justify-between gap-3"><legend className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Constraints ]</legend><div className="flex gap-3"><button type="button" onClick={() => setConstraints((current) => [...current, blankConstraint('hard')])} className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">+ Hard</button><button type="button" onClick={() => setConstraints((current) => [...current, blankConstraint('soft')])} className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">+ Soft</button></div></div><div className="mt-4 space-y-3">{constraints.map((constraint, index) => <div key={constraint.id} className="border border-zinc-800 p-4"><div className="flex items-center justify-between gap-3"><select value={constraint.kind} onChange={(event) => updateConstraint(constraint.id, { kind: event.target.value as ConstraintKind })} className="border border-zinc-700 bg-black px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white"><option value="hard">Hard limit</option><option value="soft">Soft preference</option></select>{constraints.length > 1 && <button type="button" onClick={() => setConstraints((current) => current.filter((item) => item.id !== constraint.id))} className="text-xs text-zinc-500 hover:text-white" aria-label={`Remove constraint ${index + 1}`}>Remove</button>}</div><textarea value={constraint.statement} onChange={(event) => updateConstraint(constraint.id, { statement: event.target.value })} placeholder="State the constraint in plain language." rows={2} className="mt-3 w-full border border-zinc-700 bg-black px-3 py-2 text-sm leading-relaxed text-white outline-none focus:border-cyan-400"/><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={constraint.variableNames} onChange={(event) => updateConstraint(constraint.id, { variableNames: event.target.value })} placeholder="variables used, comma-separated" className="border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"/><input value={constraint.source} onChange={(event) => updateConstraint(constraint.id, { source: event.target.value })} placeholder="source / owner (optional)" className="border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"/></div></div>)}</div></fieldset>
      <label className="block border-t border-zinc-800 pt-7 text-sm text-zinc-300">Assumptions and data limits<textarea value={assumptions} onChange={(event) => setAssumptions(event.target.value)} placeholder="One assumption per line. State missing data, validity windows, and approvals required." rows={4} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm leading-relaxed text-white outline-none focus:border-cyan-400" /></label>
    </section>
    <aside className="lg:sticky lg:top-8 lg:self-start"><div className="border border-zinc-800 bg-zinc-950/70 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ 02 · preflight ]</p><h2 className="mt-3 text-2xl font-light text-white">Constraint Pack</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">A portable problem specification for a human reviewer or future solver adapter—not a recommendation engine.</p><div className="mt-6 space-y-3">{preflight.errors.length ? <div className="border border-amber-800 bg-amber-950/20 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-200">Needs review · {preflight.errors.length} blocker{preflight.errors.length === 1 ? '' : 's'}</p><ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-100">{preflight.errors.map((error) => <li key={error}>· {error}</li>)}</ul></div> : <div className="border border-emerald-800 bg-emerald-950/20 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-200">Structure complete</p><p className="mt-2 text-sm leading-relaxed text-emerald-100">The pack is structurally ready for human review and formal encoding. It has not been solved or independently validated.</p></div>}{preflight.warnings.length > 0 && <div className="border border-zinc-800 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Review notes</p><ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">{preflight.warnings.map((warning) => <li key={warning}>· {warning}</li>)}</ul></div>}</div><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => download(json)} className="bg-cyan-300 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-cyan-200">Download JSON</button><button type="button" onClick={() => void copyJson()} className="border border-zinc-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-200 hover:border-cyan-500">{copied ? 'Copied' : 'Copy JSON'}</button></div><pre className="mt-6 max-h-[430px] overflow-auto border border-zinc-800 bg-black p-4 text-[11px] leading-relaxed text-zinc-400">{json}</pre><div className="mt-6 border-t border-zinc-800 pt-5 text-xs leading-relaxed text-zinc-500"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Boundary</p><p className="mt-2">This tool runs locally in your browser. It does not retain inputs, call an AI model, access external systems, execute a solver, or authorize an operational decision.</p></div></div></aside>
  </div>
}
