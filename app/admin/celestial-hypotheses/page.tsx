'use client'

import { useMemo, useState } from 'react'

import { REGISTRY_EPISTEMIC_BOUNDARY } from '@/lib/celestial-hypotheses/types'
import { ASTROLOGY_VERSION } from '@/lib/astrology-version'

type JsonObject = Record<string, unknown>

const EMPTY_DRAFT = JSON.stringify({
  draft: {
    experimentId: 'exp_replace_with_16_chars',
    participantPseudonym: 'pseudo_replace_me',
    studyRole: 'confirmatory',
    hypothesis: {
      statement: 'State one falsifiable prediction of at least forty characters.',
      traditionId: 'vedic-jyotisha',
      ruleIds: ['bs-muhurta-bava-favourable'],
      ruleProvenance: 'restates-source',
      ruleEmpiricalStatus: 'unvalidated-tradition',
    },
    activityType: 'software-release',
    actionWindowStartUtc: '2026-09-02T04:00:00Z',
    actionWindowEndUtc: '2026-09-02T06:00:00Z',
    factBundle: { note: 'Paste a complete validated CelestialFactBundle here.' },
    factBundleId: 'cel_local_replace_me',
    factBundleSha256: 'sha256:replace_me',
    compilerVersion: 'interpretation-compiler/0.1',
    ruleRegistryVersion: ASTROLOGY_VERSION,
    verdict: {
      verdictVersion: 'celestial-verdict/0.1', activityCorpusVersion: 'celestial-activity-rules/0.1',
      resolutionPolicyVersion: 'preserve-conflict-and-abstain/1', activityType: 'software-release', traditionId: 'vedic-jyotisha',
      factBundleId: 'cel_local_replace_me', factBundleSha256: 'sha256:replace_me', ruleRegistryVersion: ASTROLOGY_VERSION,
      applicableRuleIds: ['bs-muhurta-bava-favourable'], applicationIds: ['maha-software-release-bava'],
      favorableApplicationIds: ['maha-software-release-bava'], unfavorableApplicationIds: [], unresolvedVariantGroupIds: [], conflictApplicationIds: [],
      classification: 'favorable',
      prediction: { metricId: 'rollback_free_release', metricDirection: 'higher-is-better', targetRate: 0.8, relationToTarget: 'meets-or-exceeds-target' },
      empiricalCalibrationStatus: 'unvalidated',
      epistemicBoundary: 'This categorical verdict is a pre-registered output of an unvalidated interpretive tradition. It is not a probability, scientific confidence estimate, or guarantee of an outcome.',
    },
    metric: {
      metricId: 'rollback_free_release', name: 'Releases completing without rollback', kind: 'binary', unit: 'releases',
      direction: 'higher-is-better', horizonHours: 72, source: 'instrumented', dataSourceId: 'github-actions',
      measurementProcedure: 'Read the deployment record and mark 1 only when no rollback ran within the declared horizon.',
    },
    comparator: {
      policyVersion: 'comparator/1', feasibleWindowStartUtc: '2026-09-01T00:00:00Z', feasibleWindowEndUtc: '2026-10-01T00:00:00Z', draws: 8,
      matching: { sameWeekday: true, localHourBand: [9, 17], timeZone: 'Asia/Kolkata', geographyId: 'in-south', sameActivityType: true },
      exclusions: [], seedCommitmentSha256: 'sha256:replace_me',
    },
    analysisPlan: {
      planVersion: 'binary-outcome/1', metricId: 'rollback_free_release', targetRate: 0.8, minimumObservations: 20,
      stoppingRule: 'Analyse once at exactly 20 observations and never inspect an interim result.',
      multiplicityPolicy: 'One pre-declared comparison against one primary metric; no subgroup analyses.',
    },
    inclusionCriteria: ['Production releases of the primary application.'], exclusionCriteria: [], sampleSizeTarget: 20,
    prohibitedUseAttestation: true,
  },
  notes: 'Notes are outside the cryptographic seal.',
}, null, 2)

const EMPTY_OUTCOME = JSON.stringify({
  idempotencyKey: 'source-event-id-0001', value: 1,
  observedAtUtc: '2026-09-05T06:00:00Z', retrievedAtUtc: '2026-09-05T06:05:00Z',
  dataSourceId: 'github-actions', rawPayload: { note: 'Hashed in memory and never persisted.' },
}, null, 2)

async function body(response: Response): Promise<JsonObject> {
  const value = await response.json() as JsonObject
  if (!response.ok) {
    const error = value.error as { message?: string; issues?: string[] } | undefined
    throw new Error([error?.message ?? `Request failed (${response.status}).`, ...(error?.issues ?? [])].join('\n'))
  }
  return value
}

export default function CelestialHypothesisConsole() {
  const [token, setToken] = useState('')
  const [experimentId, setExperimentId] = useState('')
  const [draftJson, setDraftJson] = useState(EMPTY_DRAFT)
  const [outcomeJson, setOutcomeJson] = useState(EMPTY_OUTCOME)
  const [response, setResponse] = useState<JsonObject | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const draftPreview = useMemo(() => {
    try { return { value: JSON.parse(draftJson) as JsonObject, error: '' } }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : 'Invalid JSON.' } }
  }, [draftJson])

  async function call(path: string, init: RequestInit = {}) {
    if (!token) { setNotice('Enter the private registry token.'); return }
    setBusy(true); setNotice('')
    try {
      const result = await body(await fetch(path, {
        ...init,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      }))
      setResponse(result)
      if (typeof result.experimentId === 'string') setExperimentId(result.experimentId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Registry request failed.')
    } finally { setBusy(false) }
  }

  function requiredId(): string | null {
    if (experimentId) return experimentId
    const draft = draftPreview.value?.draft as { experimentId?: unknown } | undefined
    return typeof draft?.experimentId === 'string' ? draft.experimentId : null
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 sm:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-zinc-800 pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300">Private protocol console · confirmatory registry</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Celestial hypothesis registration</h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">{REGISTRY_EPISTEMIC_BOUNDARY}</p>
          <p className="mt-3 max-w-4xl border-l border-amber-700 pl-4 text-xs leading-6 text-amber-200">Review the complete payload before taking the lock. Once registered, analysis-relevant fields cannot be edited and outcome records cannot be changed or deleted.</p>
        </header>

        <section className="mt-8 grid gap-3 md:grid-cols-4">
          {['1 · Draft', '2 · Registered', '3 · Outcome recorded', '4 · Analyzed'].map((step) => <div key={step} className="border border-zinc-800 bg-zinc-950 p-4 font-mono text-[10px] uppercase tracking-widest text-zinc-400">{step}</div>)}
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Private bearer token — memory only</label>
            <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm" />

            <label className="mt-7 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Draft payload · review before lock</label>
            <textarea value={draftJson} onChange={(event) => setDraftJson(event.target.value)} spellCheck={false} className="mt-2 min-h-[34rem] w-full border border-zinc-800 bg-black p-4 font-mono text-xs leading-5 text-zinc-300" />
            {draftPreview.error && <p className="mt-2 text-sm text-rose-300">{draftPreview.error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy || !draftPreview.value} onClick={() => void call('/api/v1/celestial-hypotheses/drafts', { method: 'POST', body: draftJson })} className="border border-cyan-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan-200 disabled:opacity-40">Save / validate draft</button>
              <button disabled={busy || !requiredId()} onClick={() => { const id = requiredId(); if (id) void call(`/api/v1/celestial-hypotheses/${id}/register`, { method: 'POST' }) }} className="border border-amber-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-amber-200 disabled:opacity-40">Lock registration</button>
              <button disabled={busy || !requiredId()} onClick={() => { const id = requiredId(); if (id) void call(`/api/v1/celestial-hypotheses/${id}`) }} className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40">Refresh lifecycle</button>
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Active experiment</label>
            <input value={experimentId} onChange={(event) => setExperimentId(event.target.value)} placeholder="exp_…" className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm" />

            <label className="mt-7 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Outcome payload</label>
            <textarea value={outcomeJson} onChange={(event) => setOutcomeJson(event.target.value)} spellCheck={false} className="mt-2 min-h-64 w-full border border-zinc-800 bg-black p-4 font-mono text-xs leading-5" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy || !experimentId} onClick={() => void call(`/api/v1/celestial-hypotheses/${experimentId}/outcomes`, { method: 'POST', body: outcomeJson })} className="border border-cyan-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan-200 disabled:opacity-40">Append outcome</button>
              <button disabled={busy || !experimentId} onClick={() => void call(`/api/v1/celestial-hypotheses/${experimentId}/provenance`)} className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40">Inspect provenance</button>
            </div>

            {notice && <pre className="mt-6 whitespace-pre-wrap border border-rose-900 bg-rose-950/20 p-4 text-xs leading-5 text-rose-200">{notice}</pre>}
            <div className="mt-7 border border-zinc-800 bg-zinc-950 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Latest registry response</p>
              <pre className="mt-4 max-h-[38rem] overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-zinc-300">{response ? JSON.stringify(response, null, 2) : 'No request yet.'}</pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
