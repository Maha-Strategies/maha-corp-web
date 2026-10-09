'use client'

import { useEffect, useState } from 'react'
import type { PolicyGraph, PolicyNode, SimulationReceipt } from '@/lib/civic/policy-graph'
import { calculatePolicyVariables } from '@/lib/civic/policy-simulation'
import { CIVIC_SOURCE_ARCHIVES } from '@/lib/civic/source-archives'
import styles from './CivicDashboard.module.css'

const categories = ['monetary-reform', 'ai-governance', 'energy-grid', 'healthcare-transparency', 'anti-corruption', 'constitutional-sovereignty'] as const
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 3 })

function Scenario({ policy, initial, renderReceipt }: { policy: PolicyNode; initial: SimulationReceipt; renderReceipt: (receipt: SimulationReceipt) => React.ReactNode }) {
  const [adoption, setAdoption] = useState(100)
  const [baselines, setBaselines] = useState<Record<string, number>>({})
  const [impacts, setImpacts] = useState<Record<string, number>>({})
  const [result, setResult] = useState<{ key: string; receipt: SimulationReceipt } | null>(null)
  const [error, setError] = useState('')
  const scenario = { policyId: policy.id, adoptionRate: adoption / 100, baselineOverrides: baselines, impactOverrides: impacts }
  const key = JSON.stringify(scenario)
  const variables = calculatePolicyVariables(policy, scenario)
  const atInitial = policy.id === initial.policyId && adoption === 100 && !Object.keys(baselines).length && !Object.keys(impacts).length
  const receipt = result?.key === key ? result.receipt : atInitial ? initial : null
  useEffect(() => {
    if (atInitial) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setError('')
      try {
        const response = await fetch('/api/civic/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Scenario receipt unavailable.')
        if (!controller.signal.aborted) setResult({ key, receipt: data })
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Scenario receipt unavailable.') }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, atInitial])
  return <div className={styles.columns}><div>
    <span className={styles.badge}>Illustrative · unvalidated</span><h3 className={styles.policyTitle}>{policy.title}</h3><p>{policy.summary}</p>
    <div className={styles.form}>
      <label htmlFor="civic-adoption">Assumed adoption <strong>{adoption}%</strong></label>
      <input id="civic-adoption" type="range" min="0" max="100" step="1" value={adoption} onChange={e => setAdoption(Number(e.target.value))} />
      {policy.economicVariables.map((variable, index) => {
        const span = Math.max(Math.abs(variable.baselineValue) * .5, 1)
        return <div className={styles.form} key={variable.name}>
          <p className={styles.muted}>{variable.name} / {variable.unit}</p>
          <label htmlFor={`civic-baseline-${index}`}>Assumed baseline <strong>{number(baselines[variable.name] ?? variable.baselineValue)}</strong></label>
          <input id={`civic-baseline-${index}`} type="range" min={variable.baselineValue - span} max={variable.baselineValue + span} step={span / 100} value={baselines[variable.name] ?? variable.baselineValue} onChange={e => setBaselines(v => ({ ...v, [variable.name]: Number(e.target.value) }))} />
          <label htmlFor={`civic-impact-${index}`}>Assumed impact delta <strong>{number(impacts[variable.name] ?? variable.projectedImpactDelta)}</strong></label>
          <input id={`civic-impact-${index}`} type="range" min={variable.confidenceInterval[0]} max={variable.confidenceInterval[1]} step="any" value={impacts[variable.name] ?? variable.projectedImpactDelta} onChange={e => setImpacts(v => ({ ...v, [variable.name]: Number(e.target.value) }))} />
        </div>
      })}
      <p className={styles.muted}>Baseline sliders explore ±50% of the supplied baseline (minimum range ±1). Impact sliders stay within the supplied bounds. These ranges are interface assumptions, not empirical uncertainty.</p>
      <button type="button" className={styles.secondary} onClick={() => { setAdoption(100); setBaselines({}); setImpacts({}); setError('') }}>Reset assumptions</button>
    </div>
  </div><div className={styles.result} aria-live="polite">
    <p className={styles.eyebrow}>{receipt ? 'Scenario receipt' : 'Live arithmetic preview'} / {adoption}% adoption</p>
    {variables.map(variable => <div key={variable.name}><h3>{variable.name}</h3><div className={styles.projection}><strong>{number(variable.projectedValue)}</strong><span>{variable.unit}</span></div><dl className={styles.values}><div><dt>Assumed baseline</dt><dd>{number(variable.baseline)}</dd></div><div><dt>Scaled delta</dt><dd>{number(variable.delta)}</dd></div><div><dt>Scenario bounds</dt><dd>{variable.scenarioBounds.map(number).join(' to ')}</dd></div></dl></div>)}
    <p className={styles.muted}>Baseline + adoption × assumed impact. Bounds are supplied scenarios with no statistical confidence level. Costs and causal effects remain unknown.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {receipt ? renderReceipt(receipt) : <p className={styles.muted}>{error ? 'Only the local arithmetic preview is available.' : 'Recording the current assumptions…'}</p>}
  </div></div>
}

export default function PolicySimulator({ graph, policyId, onPolicyChange, initialSimulation, renderReceipt }: {
  graph: PolicyGraph; policyId: string; onPolicyChange: (id: string) => void; initialSimulation: SimulationReceipt; renderReceipt: (receipt: SimulationReceipt) => React.ReactNode
}) {
  const [category, setCategory] = useState('all')
  const filtered = graph.nodes.filter(node => category === 'all' || node.category === category)
  const policy = filtered.find(node => node.id === policyId) ?? filtered[0]
  return <>
    <div className={`${styles.form} ${styles.filters}`}>
      <div><label htmlFor="civic-category">Policy category</label><select id="civic-category" value={category} onChange={e => {
        const value = e.target.value; setCategory(value)
        const first = graph.nodes.find(node => value === 'all' || node.category === value)
        if (first) onPolicyChange(first.id)
      }}><option value="all">All categories</option>{categories.map(value => <option key={value} value={value}>{value.replaceAll('-', ' ')}</option>)}</select></div>
      {policy && <div><label htmlFor="civic-policy">Policy node</label><select id="civic-policy" value={policy.id} onChange={e => onPolicyChange(e.target.value)}>{filtered.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></div>}
    </div>
    {!policy ? <div className={styles.result} role="status"><h3>No modeled proposal in this category</h3><p className={styles.muted}>This registry has no economic variables or primary legislative sources for this category.</p></div> : <>
      <Scenario key={policy.id} policy={policy} initial={initialSimulation} renderReceipt={renderReceipt} />
      <div className={styles.graph} aria-label="Executable policy graph"><div><span>Proposal node</span><strong>{policy.id}</strong></div><span aria-hidden="true">→</span><div><span>Assumptions</span><strong>Baseline + adoption × impact</strong></div><span aria-hidden="true">→</span><div><span>Receipt</span><strong>Bounded scenario</strong></div></div>
      <p className={styles.muted}>{graph.edges.length} registered inter-policy edges. No cross-policy effects are inferred.</p>
      <div className={styles.columns}><div><h3>Evidence & legislative context</h3><p className={styles.muted}>{policy.evidenceBasis}</p>
        {policy.primaryLegislativeSources.map(source => {
          const archive = CIVIC_SOURCE_ARCHIVES.find(item => item.url === source.url && item.digest === source.digest)
          return <details className={styles.receipt} key={source.url}><summary>Primary source · {source.citation}</summary><p><a href={source.url} target="_blank" rel="noreferrer">Read the primary source ↗</a></p>
            {source.digest ? <><span className={styles.sourceNote}>Source bytes / SHA-256</span><code className={styles.digest}>{source.digest}</code></> : <p className={styles.muted}>Source bytes not archived · no source digest.</p>}
            {archive && <><p className={styles.muted}>Historical {archive.edition} edition; archived {archive.retrievedOn}. Byte integrity does not establish current law or policy outcomes.</p><a href={archive.archivePath} download>Download archived source PDF</a></>}
          </details>
        })}
      </div><div><h3>Tradeoffs & downsides</h3><ul>{policy.tradeoffsAndDownsides.map(text => <li key={text}>{text}</li>)}</ul></div></div>
    </>}
  </>
}
