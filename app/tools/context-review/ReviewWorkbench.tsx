'use client'

import { useEffect, useState } from 'react'
import type { ContextReviewReport } from '@/lib/context-review'
import { reviewChannel, type ReviewClientEvent } from '@/lib/context-review-measurement'

function channel() { return reviewChannel(new URLSearchParams(window.location.search).get('channel') ?? 'web') }
function measure(event: ReviewClientEvent) {
  if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return
  void fetch('/api/context-review/events', { method: 'POST', credentials: 'omit', keepalive: true,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, channel: channel() }) }).catch(() => undefined)
}

const sample = JSON.stringify([
  { id: 'original', title: 'Original SLA', text: 'The SLA credit for a Severity 1 breach is 10%. This agreement is superseded by amendment-3 for service rebates.' },
  { id: 'amendment-3', title: 'Amendment 3', text: 'Effective January 2026, the service level rebate for a Priority One incident is 25%. This replaces the previous rebate provision.' },
], null, 2)

export default function ReviewWorkbench() {
  useEffect(() => { measure('view') }, [])
  const [task, setTask] = useState('What service level rebate applies under amendment-3?')
  const [documents, setDocuments] = useState(sample)
  const [expected, setExpected] = useState('[{"sourceId":"amendment-3","excerpt":"25%"}]')
  const [budget, setBudget] = useState(256)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<ContextReviewReport | null>(null)
  function change(edit: () => void) { edit(); setReport(null); setError('') }
  async function run() {
    setBusy(true); setError(''); setReport(null)
    try {
      const response = await fetch(`/api/context-review?channel=${channel()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, documents: JSON.parse(documents), expectedEvidence: JSON.parse(expected), tokenBudget: budget, sanitized: consent }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Review failed.')
      setReport(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review failed.') }
    finally { setBusy(false) }
  }
  function download() {
    if (!report) return
    measure('export')
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'maha-context-review.json'; link.click(); URL.revokeObjectURL(url)
  }
  const field = 'w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100'
  return <div className="space-y-6">
    <fieldset disabled={busy} className="min-w-0 space-y-6">
    <label className="block">Question or task<input className={`${field} mt-2`} maxLength={1200} value={task} onChange={event => change(() => setTask(event.target.value))} /></label>
    <div className="grid gap-6 lg:grid-cols-2">
      <label className="block">Sanitized documents (JSON array)<textarea className={`${field} mt-2 font-mono text-sm`} rows={12} value={documents} onChange={event => change(() => setDocuments(event.target.value))} /></label>
      <div className="space-y-6">
        <label className="block">Required evidence (exact excerpts, JSON array)<textarea className={`${field} mt-2 font-mono text-sm`} rows={6} value={expected} onChange={event => change(() => setExpected(event.target.value))} /></label>
        <p className="text-sm text-slate-300">You define what must survive. An empty list does not test completeness. Excerpts are case-sensitive and checked within selected passages from the named source.</p>
        <label className="block">Estimated token budget<input type="number" min={64} max={16000} className={`${field} mt-2`} value={budget} onChange={event => change(() => setBudget(Number(event.target.value)))} /></label>
      </div>
    </div>
    <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={consent} onChange={event => change(() => setConsent(event.target.checked))} /><span>I confirm these excerpts are sanitized, authorized or synthetic. Do not submit credentials, government IDs, payment card details, protected health information or confidential personal records. This sends the supplied text to Maha’s server for transient computation.</span></label>
    </fieldset>
    <button className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40" disabled={!consent || busy} onClick={run}>{busy ? 'Reviewing…' : 'Review context retention'}</button>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {report && <section aria-live="polite" className="space-y-5 rounded-2xl border border-slate-600 p-6">
      <h2 className="text-2xl font-semibold">Your review</h2>
      <p>{report.metrics.originalEstimatedTokens} → {report.metrics.compiledEstimatedTokens} estimated tokens. {report.metrics.estimatedReductionPercent}% estimated reduction.</p>
      <p>{report.declarationStatus === 'no_expected_evidence_declared' ? 'No required evidence was declared; completeness was not tested.' : 'Required evidence checks:'}</p>
      <ul className="space-y-2">{report.evidence.map((row, index) => <li key={index}><strong>{row.sourceId}</strong>: “{row.excerpt}” — {row.status.replaceAll('_', ' ')}</li>)}</ul>
      <h3 className="font-semibold">Selected context</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-sm">{report.context}</pre>
      <h3 className="font-semibold">Limits of this result</h3><ul className="list-disc space-y-2 pl-5 text-sm">{report.limitations.map(line => <li key={line}>{line}</li>)}{report.warnings.map(line => <li key={line}>{line}</li>)}</ul>
      <button className="rounded-xl border border-cyan-300 px-4 py-2" onClick={download}>Download report JSON (includes selected text)</button>
      <div className="border-t border-slate-600 pt-5"><h3 className="font-semibold">Want to evaluate a real workflow?</h3><p className="mt-2 text-sm">Ask about a scoped pilot and success criteria. Pricing and data-handling terms are agreed separately; this free review does not start a paid service.</p><a className="mt-3 inline-block text-cyan-300 underline" href="mailto:mayone@mahastrategies.com?subject=Context%20Review%20workflow%20pilot" onClick={() => measure('pilot_cta')}>Discuss a workflow pilot</a></div>
    </section>}
  </div>
}
