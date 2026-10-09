'use client'
import { useState } from 'react'
import { COST_DRIVERS, CIVIC_MODEL_CARDS } from '@/lib/civic/model-display'
import type { CostScenario, CostEvidenceReceipt } from '@/lib/civic/model-evidence'
import { downloadPrivateJson } from './case-access'
import styles from './CivicDashboard.module.css'

const displayNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

export default function ModelEvidenceLab() {
  const [inputs, setInputs] = useState<Record<string, string>>({}), [observations, setObservations] = useState('[]')
  const [ranges, setRanges] = useState('{}'), [receipt, setReceipt] = useState<CostEvidenceReceipt | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [origin, setOrigin] = useState<'user-assumptions' | 'synthetic-worked-example'>('user-assumptions')
  return <div>
    <div className={styles.graphCards}>{CIVIC_MODEL_CARDS.map(card => <article key={card.id} className={styles.result}><p className={styles.eyebrow}>{card.version}</p><h3>{card.id.replaceAll('-', ' ')}</h3><span className={styles.badge}>{card.calibrationStatus}</span><p>{card.sourceScope}</p><p>{card.method}</p><ul>{card.limitations.map(text => <li key={text}>{text}</li>)}</ul></article>)}</div>
    <div className={styles.columns}><form className={styles.form} onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(''); setReceipt(null)
      try {
        const scenario = Object.fromEntries(Object.keys(COST_DRIVERS).map(key => [key, Number(inputs[key])])) as CostScenario
        const response = await fetch('/api/civic/model-evidence', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario, origin, observations: JSON.parse(observations), ranges: JSON.parse(ranges) }) })
        const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Check the scenario and observation data.')
        setReceipt(body)
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Calculation unavailable.') }
      finally { setBusy(false) }
    }}>
      <h3>AI governance testing & reporting costs</h3><p className={styles.muted}>Supply each driver. Results estimate conditional annual costs; no evidence-based safety benefit forecast is available.</p>
      {(Object.keys(COST_DRIVERS) as (keyof CostScenario)[]).map(key => <div key={key}><label htmlFor={`cost-${key}`}>{COST_DRIVERS[key].label}</label><input id={`cost-${key}`} type="number" min={0} max={COST_DRIVERS[key].max} step={COST_DRIVERS[key].integer ? 1 : 'any'} required value={inputs[key] ?? ''} onChange={e => { setInputs(previous => ({ ...previous, [key]: e.target.value })); setOrigin('user-assumptions'); setReceipt(null) }} /></div>)}
      <button type="button" className={styles.secondary} onClick={() => { setInputs({ systems: '10', testsPerSystem: '2', hoursPerTest: '3', hourlyCostUsd: '100', reportsPerYear: '10', hoursPerReport: '1' }); setOrigin('synthetic-worked-example'); setReceipt(null) }}>Load synthetic worked example</button>
      <p className={styles.muted}>Input basis: {origin.replaceAll('-', ' ')}.</p>
      <details><summary>Calibration observations and sensitivity ranges</summary><p className={styles.muted}>Optional observation rows require id, observedOn, scenario, observedAnnualCostUsd and source metadata. They remain user-supplied and unverified. They are processed in memory and not retained by this calculator. Ranges map driver names to [low, high]; defaults vary one driver at a time by ±20%.</p>
        <label htmlFor="cost-observations">Calibration observations (JSON array)</label><textarea id="cost-observations" className={styles.codeInput} rows={6} value={observations} onChange={e => { setObservations(e.target.value); setReceipt(null) }} />
        <label htmlFor="cost-ranges">Sensitivity ranges (JSON object)</label><textarea id="cost-ranges" className={styles.codeInput} rows={4} value={ranges} onChange={e => { setRanges(e.target.value); setReceipt(null) }} />
      </details><button disabled={busy}>{busy ? 'Calculating…' : 'Calculate conditional costs'}</button>{error && <p role="alert" className={styles.error}>{error}</p>}
    </form><div className={styles.result} aria-live="polite">{receipt ? <><p className={styles.eyebrow}>{receipt.version} · {receipt.input.origin}</p><h3>Conditional annual cost: ${receipt.result.annualCostUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</h3><p>Testing: {receipt.result.testingHours} hours · reporting: {receipt.result.reportingHours} hours.</p><p className={styles.muted}>{receipt.limitation}</p>
      <h4>One-driver sensitivity</h4><p className={styles.muted}>Scroll the table horizontally on small screens. Display values are rounded to two decimal places; the downloaded receipt retains full precision.</p><div className={styles.tableScroll}><table className={`${styles.economicTable} ${styles.sensitivityTable}`}><thead><tr><th>Driver</th><th>Range</th><th>Annual cost range (USD)</th></tr></thead><tbody>{receipt.sensitivity.map(row => <tr key={row.driver}><td>{COST_DRIVERS[row.driver].label}</td><td>{displayNumber(row.low)}–{displayNumber(row.high)} {row.unit}</td><td>{displayNumber(row.lowCostUsd)}–{displayNumber(row.highCostUsd)}</td></tr>)}</tbody></table></div>
      <h4>Calibration diagnostic</h4><p>{receipt.calibration.status} · {receipt.calibration.observations} observations</p>{receipt.calibration.meanAbsoluteErrorUsd !== null && <p>Mean absolute error: ${receipt.calibration.meanAbsoluteErrorUsd.toLocaleString('en-US')}. RMSE: ${receipt.calibration.rootMeanSquaredErrorUsd?.toLocaleString('en-US')}.</p>}
      <code className={styles.digest}>{receipt.digest}</code><button className={styles.secondary} type="button" onClick={() => downloadPrivateJson(receipt, 'civic-governance-cost-receipt.json')}>Download model receipt</button>
    </> : <><h3>Evidence before forecasts.</h3><p>Model versions, source dates and calibration gaps remain visible. A receipt binds the supplied assumptions and arithmetic; it does not make them empirically verified.</p></>}</div></div>
  </div>
}
