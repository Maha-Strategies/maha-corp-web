'use client'

import { useState, type FormEvent } from 'react'

import type { AdvisorPlan } from '../../../lib/workflow-advisor'

type AdvisorResult = {
  mode: 'deterministic' | 'agent-interpreted'
  interpretation?: { interpretation: string; openQuestions: string[] }
  plan: AdvisorPlan
}

const objectiveOptions = [
  ['compile-context-pack', 'Compile a source-linked context pack'],
  ['evaluate-context-quality', 'Measure context retention and coverage'],
  ['compile-and-evaluate', 'Compile, then evaluate'],
  ['claim-provenance-triage', 'Triage claims in a passage'],
  ['summarize', 'Summarize or rewrite text'],
  ['verify-facts', 'Verify whether claims are true'],
  ['other', 'Something else / unsure'],
] as const

export default function WorkflowAdvisor({ aiAvailable }: { aiAvailable: boolean }) {
  const [objective, setObjective] = useState<string>('compile-context-pack')
  const [workflow, setWorkflow] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [bytes, setBytes] = useState('')
  const [documents, setDocuments] = useState('')
  const [tokenBudget, setTokenBudget] = useState('')
  const [priceCeiling, setPriceCeiling] = useState('')
  const [needsRetention, setNeedsRetention] = useState(false)
  const [binary, setBinary] = useState(false)
  const [result, setResult] = useState<AdvisorResult | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)
    setPending(true)
    try {
      const response = await fetch('/api/workflow-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(objective === 'auto' ? { 'x-maha-workflow-advisor-token': accessToken } : {}),
        },
        body: JSON.stringify({
          // Manual mode does not transmit free-text workflow details.
          workflow: objective === 'auto' ? workflow : '',
          objective,
          ...(bytes ? { estimatedInputBytes: Number(bytes) } : {}),
          ...(documents ? { documentCount: Number(documents) } : {}),
          ...(tokenBudget ? { requiredTokenBudget: Number(tokenBudget) } : {}),
          ...(priceCeiling ? { maximumPriceBaseUnits: priceCeiling.trim() } : {}),
          needsRetentionMeasurement: needsRetention,
          inputEncoding: binary ? 'binary' : 'utf8-text',
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'The advisor could not prepare a plan.')
      setResult(body as AdvisorResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The advisor could not prepare a plan.')
    } finally {
      setPending(false)
    }
  }

  function download() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'maha-workflow-advice.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const field = 'w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 text-[var(--text-primary)]'
  return <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <form onSubmit={submit} className="rounded-xl border border-[var(--border-default)] p-6 sm:p-8">
      <h2 className="text-xl text-[var(--text-primary)]">1. Describe the job</h2>
      <label className="mt-6 block text-sm text-[var(--text-secondary)]">Required outcome
        <select className={`${field} mt-2`} value={objective} onChange={(event) => setObjective(event.target.value)}>
          {objectiveOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {aiAvailable && <option value="auto">Let the AI agent interpret my workflow</option>}
        </select>
      </label>
      {objective === 'auto' && <label className="mt-5 block text-sm text-[var(--text-secondary)]">Workflow description (sent to OpenAI; do not include confidential data)
        <textarea className={`${field} mt-2 min-h-32`} maxLength={2000} value={workflow} onChange={(event) => setWorkflow(event.target.value)} required />
      </label>}
      {objective === 'auto' && <label className="mt-5 block text-sm text-[var(--text-secondary)]">Private advisor access token
        <input className={`${field} mt-2`} type="password" autoComplete="off" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} required />
      </label>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-[var(--text-secondary)]">Estimated input bytes<input className={`${field} mt-2`} type="number" min="1" step="1" value={bytes} onChange={(event) => setBytes(event.target.value)} placeholder="Optional" /></label>
        <label className="text-sm text-[var(--text-secondary)]">Document count<input className={`${field} mt-2`} type="number" min="1" step="1" value={documents} onChange={(event) => setDocuments(event.target.value)} placeholder="Optional" /></label>
        <label className="text-sm text-[var(--text-secondary)]">Token budget<input className={`${field} mt-2`} type="number" min="1" step="1" value={tokenBudget} onChange={(event) => setTokenBudget(event.target.value)} placeholder="Optional" /></label>
        <label className="text-sm text-[var(--text-secondary)]">Maximum USDC base units<input className={`${field} mt-2`} inputMode="numeric" pattern="[0-9]*" value={priceCeiling} onChange={(event) => setPriceCeiling(event.target.value)} placeholder="e.g. 10000 = $0.01" /></label>
      </div>
      <label className="mt-6 flex gap-3 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={needsRetention} onChange={(event) => setNeedsRetention(event.target.checked)} />I need measured retention, not just a compiled pack</label>
      <label className="mt-3 flex gap-3 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={binary} onChange={(event) => setBinary(event.target.checked)} />My input is binary (PDF, image, or archive)</label>
      <button type="submit" disabled={pending} className="mt-7 rounded-lg bg-[var(--text-primary)] px-5 py-3 text-sm font-semibold text-[var(--background)] disabled:opacity-50">{pending ? 'Preparing…' : 'Prepare advice'}</button>
      {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
      <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">The deterministic plan is free. No payment, wallet signature, source document, or API credential is requested here.</p>
    </form>
    <section className="rounded-xl border border-[var(--border-default)] p-6 sm:p-8" aria-live="polite">
      <h2 className="text-xl text-[var(--text-primary)]">2. Review the plan</h2>
      {!result && <p className="mt-6 text-sm leading-relaxed text-[var(--text-secondary)]">Your recommendation, published request example, limitations, and pre-payment checklist will appear here.</p>}
      {result && <div className="mt-6 space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <div className="border-l-2 border-[var(--status-sourced)] pl-4"><p className="font-mono text-xs uppercase text-[var(--status-sourced)]">{result.plan.decision.decision} · {result.mode}</p><p className="mt-2 text-lg text-[var(--text-primary)]">{result.plan.offers.length ? result.plan.offers.map((offer) => offer.name).join(' → ') : 'No suitable payable offer'}</p></div>
        {result.interpretation && <div><h3 className="font-semibold text-[var(--text-primary)]">Interpretation</h3><p className="mt-2">{result.interpretation.interpretation}</p>{result.interpretation.openQuestions.map((question, index) => <p key={index} className="mt-2">Open: {question}</p>)}</div>}
        <div><h3 className="font-semibold text-[var(--text-primary)]">Why</h3><ul className="mt-2 list-disc space-y-1 pl-5">{result.plan.decision.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>{result.plan.decision.warnings.map((warning, index) => <p key={index} className="mt-2 text-amber-500">{warning}</p>)}</div>
        {result.plan.offers.map((offer) => <article key={offer.id} className="border-t border-[var(--border-default)] pt-5">
          <h3 className="font-semibold text-[var(--text-primary)]">{offer.name}</h3>
          <p className="mt-2">Published price: {offer.publishedPrice} · {offer.method} {offer.path}</p>
          <p className="mt-2">Required body fields: {offer.requiredInputFields.join(', ') || 'see schema'}</p>
          <p className="mt-2">Retention: {offer.retentionNote}</p>
          <a className="mt-2 inline-block underline" href={offer.contractUrl}>Full schema and contract ↗</a>
          <details className="mt-4"><summary className="cursor-pointer font-medium text-[var(--text-primary)]">Published request example and headers</summary><pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-[var(--surface-raised)] p-4 text-xs">{JSON.stringify({ body: offer.requestExample, requiredHeaders: offer.requiredHeaders ?? {} }, null, 2)}</pre></details>
          <details className="mt-3"><summary className="cursor-pointer font-medium text-[var(--text-primary)]">Capability boundaries</summary><ul className="mt-2 list-disc pl-5">{offer.capabilityBoundaries.map((boundary, index) => <li key={index}>{boundary}</li>)}</ul></details>
        </article>)}
        <div className="border-t border-[var(--border-default)] pt-5"><h3 className="font-semibold text-[var(--text-primary)]">Before any payment</h3><ol className="mt-2 list-decimal space-y-2 pl-5">{result.plan.checksBeforePayment.map((check, index) => <li key={index}>{check}</li>)}</ol></div>
        <p className="text-xs">{result.plan.advisory}</p>
        <button type="button" onClick={download} className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-[var(--text-primary)]">Download advice JSON</button>
      </div>}
    </section>
  </div>
}
