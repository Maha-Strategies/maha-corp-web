'use client'

import { useState } from 'react'

type JsonObject = Record<string, unknown>

const DRAFT = JSON.stringify({
  definition: {
    corpusId: 'corp_replace123456', participantPseudonym: 'pseudo_replace1234', studyRole: 'exploratory',
    corpusVersion: 'celestial-event-corpus/0.1', natalProfileSha256: '',
    samplingPlan: {
      planVersion: 'systematic-clock/1', windowStartUtc: '2026-01-01T00:00:00Z', windowEndUtc: '2026-12-31T00:00:00Z',
      anchorUtc: '2026-01-01T12:00:00Z', cadenceMinutes: 10080, intervalMinutes: 60, activityType: 'paid-client-work',
      qualifyingEventDefinition: 'A paid client-work milestone recorded by the declared platform or financial system of record.',
      negativeEvidenceProcedure: 'Query the same system of record for the complete interval and retain evidence that no qualifying event occurred.',
    },
  },
  natalProfile: { date: '2000-01-01', time: '12:00', timeZone: 'UTC', latitudeDegrees: 0, longitudeDegrees: 0 },
}, null, 2)

const OBSERVATIONS = JSON.stringify({
  natalProfile: { date: '2000-01-01', time: '12:00', timeZone: 'UTC', latitudeDegrees: 0, longitudeDegrees: 0 },
  observations: [
    {
      observationId: 'obs_milestone123456', kind: 'milestone', intervalStartUtc: '2026-02-12T08:32:00Z', intervalEndUtc: '2026-02-12T08:33:00Z',
      selectionMethod: 'observed-event', sourceKind: 'platform-record', dataSourceId: 'declared-platform', evidencePayload: { replace: 'Raw evidence is hashed in memory and discarded.' },
    },
    {
      observationId: 'obs_nonevent123456', kind: 'non-event', intervalStartUtc: '2026-01-01T12:00:00Z', intervalEndUtc: '2026-01-01T13:00:00Z',
      selectionMethod: 'systematic-clock', sourceKind: 'platform-query', dataSourceId: 'declared-platform', evidencePayload: {
        queryWindowStartUtc: '2026-01-01T12:00:00Z', queryWindowEndUtc: '2026-01-01T13:00:00Z', qualifyingEventCount: 0,
        retrievedAtUtc: '2026-01-02T00:00:00Z', sourceQueryId: 'replace-with-platform-query-id', rawResult: { replace: 'Complete interval query proving no qualifying event.' },
      },
    },
  ],
}, null, 2)

async function responseBody(response: Response): Promise<JsonObject> {
  const body = await response.json() as JsonObject
  if (!response.ok) {
    const error = body.error as { message?: string; issues?: string[] } | undefined
    throw new Error([error?.message ?? `Request failed (${response.status}).`, ...(error?.issues ?? [])].join('\n'))
  }
  return body
}

export default function CelestialCorpusConsole() {
  const [token, setToken] = useState('')
  const [corpusId, setCorpusId] = useState('corp_replace123456')
  const [draft, setDraft] = useState(DRAFT)
  const [observations, setObservations] = useState(OBSERVATIONS)
  const [result, setResult] = useState<JsonObject | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function call(path: string, init: RequestInit = {}) {
    if (!token) { setNotice('Enter the private registry token.'); return }
    setBusy(true); setNotice('')
    try {
      setResult(await responseBody(await fetch(path, { ...init, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })))
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Corpus request failed.') }
    finally { setBusy(false) }
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 sm:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-zinc-800 pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300">Private protocol console · exploratory corpus</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Celestial event corpus</h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">Persist milestones and evidence-backed ordinary periods under one locked systematic sampling plan. Precise natal inputs are used in memory to compile state vectors; only a profile digest is stored.</p>
          <p className="mt-3 max-w-4xl border-l border-amber-700 pl-4 text-xs leading-6 text-amber-200">A scheduled clock interval remains a candidate until the declared system of record supplies evidence that no qualifying event occurred. Observations cannot be edited or deleted after append.</p>
        </header>

        <section className="mt-8 grid gap-3 md:grid-cols-4">
          {['1 · Draft definition', '2 · Lock protocol', '3 · Prove observations', '4 · Inspect exposure'].map((step) => <div key={step} className="border border-zinc-800 bg-zinc-950 p-4 font-mono text-[10px] uppercase tracking-widest text-zinc-400">{step}</div>)}
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Private bearer token — memory only</label>
            <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm" />
            <label className="mt-7 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Corpus definition + ephemeral natal profile</label>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} className="mt-2 min-h-[32rem] w-full border border-zinc-800 bg-black p-4 font-mono text-xs leading-5" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void call('/api/v1/celestial-corpus/corpora', { method: 'POST', body: draft })} className="border border-emerald-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-emerald-200 disabled:opacity-40">Save draft</button>
              <button disabled={busy || !corpusId} onClick={() => void call(`/api/v1/celestial-corpus/corpora/${corpusId}/lock`, { method: 'POST' })} className="border border-amber-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-amber-200 disabled:opacity-40">Lock protocol</button>
              <button disabled={busy || !corpusId} onClick={() => void call(`/api/v1/celestial-corpus/corpora/${corpusId}/schedule`)} className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40">Generate schedule</button>
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Active corpus ID</label>
            <input value={corpusId} onChange={(event) => setCorpusId(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm" />
            <label className="mt-7 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Observation batch</label>
            <textarea value={observations} onChange={(event) => setObservations(event.target.value)} spellCheck={false} className="mt-2 min-h-[30rem] w-full border border-zinc-800 bg-black p-4 font-mono text-xs leading-5" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy || !corpusId} onClick={() => void call(`/api/v1/celestial-corpus/corpora/${corpusId}/observations`, { method: 'POST', body: observations })} className="border border-emerald-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-emerald-200 disabled:opacity-40">Append observations</button>
              <button disabled={busy || !corpusId} onClick={() => void call(`/api/v1/celestial-corpus/corpora/${corpusId}/observations`)} className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40">Inspect corpus</button>
            </div>
            {notice && <pre className="mt-6 whitespace-pre-wrap border border-rose-900 bg-rose-950/20 p-4 text-xs leading-5 text-rose-200">{notice}</pre>}
            <div className="mt-7 border border-zinc-800 bg-zinc-950 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Latest response</p><pre className="mt-4 max-h-[36rem] overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5">{result ? JSON.stringify(result, null, 2) : 'No request yet.'}</pre></div>
          </div>
        </section>
      </div>
    </main>
  )
}
