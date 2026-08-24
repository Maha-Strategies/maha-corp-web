'use client'

import { useMemo, useState } from 'react'

type Adapter = {
  id: string
  name: string
  sourceDatasetVersion: string
  counts: { sourceRecords: number; publicEligible: number; withheld: number }
}

type ReviewTarget = {
  recordId: string
  domainSlug: string
  title: string
  reviewTargetSha256: string
  sourcePublicPath: string
  gateDecision: { reasons?: string[] }
  reviewProgress?: { scopes?: Record<string, { status?: string }> }
}

type CriterionDefinition = { id: string; label: string; question: string }
type CriterionInput = { criterionId: string; verdict: string; rationale: string }
type Review = { reviewId: string; recordId: string; scope: string; decision: string; reviewer: { displayName: string }; reviewedAt: string }

const scopes = ['source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator'] as const
const criterionVerdicts = ['satisfied', 'reservation', 'unsatisfied', 'not-qualified']

export default function EpistemicIngestionPage() {
  const [token, setToken] = useState('')
  const [adapters, setAdapters] = useState<Adapter[]>([])
  const [targets, setTargets] = useState<ReviewTarget[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [criteriaDefinitions, setCriteriaDefinitions] = useState<Record<string, CriterionDefinition[]>>({})
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [scope, setScope] = useState<(typeof scopes)[number]>('source-fidelity')
  const [criteria, setCriteria] = useState<CriterionInput[]>([])
  const [reviewer, setReviewer] = useState({ reviewerId: '', profileVersion: '1', displayName: '', qualifications: '', affiliation: '', identityUrl: '', domains: '', conflicts: '' })
  const [disagreements, setDisagreements] = useState('')
  const [rationale, setRationale] = useState('')
  const [supersedesReviewId, setSupersedesReviewId] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = useMemo(() => targets.find((target) => target.recordId === selectedRecordId) ?? null, [targets, selectedRecordId])

  function prepareCriteria(nextScope: string, definitions = criteriaDefinitions) {
    setCriteria((definitions[nextScope] ?? []).map((criterion) => ({ criterionId: criterion.id, verdict: 'satisfied', rationale: '' })))
  }

  function chooseTarget(target: ReviewTarget) {
    setSelectedRecordId(target.recordId)
    setReviewer((value) => ({ ...value, domains: value.domains || target.domainSlug }))
    prepareCriteria(scope)
    setDisagreements(''); setRationale(''); setSupersedesReviewId('')
  }

  async function load(preserveNotice = false) {
    setLoading(true); if (!preserveNotice) setNotice('')
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [ingestionResponse, reviewResponse] = await Promise.all([
        fetch('/api/admin/epistemic-ingestion', { headers }),
        fetch('/api/admin/epistemic-reviews', { headers }),
      ])
      const ingestion = await ingestionResponse.json() as { inventory?: { adapters?: Adapter[] }; reviewTargets?: ReviewTarget[]; error?: { message?: string } }
      const review = await reviewResponse.json() as { criteria?: Record<string, CriterionDefinition[]>; targets?: ReviewTarget[]; reviews?: Review[]; error?: { message?: string } }
      if (!ingestionResponse.ok) throw new Error(ingestion.error?.message ?? 'Ingestion registry is unavailable.')
      if (!reviewResponse.ok) throw new Error(review.error?.message ?? 'Expert-review registry is unavailable.')
      const definitions = review.criteria ?? {}
      const loadedTargets = review.targets ?? ingestion.reviewTargets ?? []
      setAdapters(ingestion.inventory?.adapters ?? [])
      setTargets(loadedTargets)
      setReviews(review.reviews ?? [])
      setCriteriaDefinitions(definitions)
      setUnlocked(true)
      const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
      const requestedTarget = loadedTargets.find((target) => target.recordId === query.get('record'))
      const requestedScope = scopes.includes(query.get('scope') as (typeof scopes)[number])
        ? query.get('scope') as (typeof scopes)[number]
        : scope
      if (requestedTarget) {
        setSelectedRecordId(requestedTarget.recordId)
        setReviewer((value) => ({ ...value, domains: value.domains || requestedTarget.domainSlug }))
      }
      setScope(requestedScope)
      prepareCriteria(requestedScope, definitions)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The epistemic workspace is unavailable.')
    } finally { setLoading(false) }
  }

  async function runAdapter(adapterId: string) {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/epistemic-ingestion', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId, idempotencyKey: `epistemic-ingestion:${adapterId}:${crypto.randomUUID()}` }),
      })
      const body = await response.json() as { persistence?: { recordCount?: number; idempotentReplay?: boolean }; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The adapter could not be persisted.')
      await load(true)
      setNotice(`${body.persistence?.recordCount ?? 0} ${adapterId} candidates were recorded. No page was promoted.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The adapter could not be persisted.')
      setLoading(false)
    }
  }

  async function submitReview() {
    if (!selected) return
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/epistemic-reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: selected.recordId,
          domainSlug: selected.domainSlug,
          targetSha256: selected.reviewTargetSha256,
          scope,
          reviewer: {
            reviewerId: reviewer.reviewerId,
            profileVersion: Number(reviewer.profileVersion),
            displayName: reviewer.displayName,
            qualifications: reviewer.qualifications.split('\n').map((value) => value.trim()).filter(Boolean),
            affiliation: reviewer.affiliation || null,
            identityUrl: reviewer.identityUrl || null,
            domains: reviewer.domains.split('\n').map((value) => value.trim()).filter(Boolean),
            conflicts: reviewer.conflicts.split('\n').map((value) => value.trim()).filter(Boolean),
          },
          criteria,
          disagreements: disagreements.split('\n').map((value) => value.trim()).filter(Boolean),
          rationale,
          supersedesReviewId: supersedesReviewId || null,
          idempotencyKey: `epistemic-review:${crypto.randomUUID()}`,
        }),
      })
      const body = await response.json() as { review?: { decision?: string }; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The expert decision could not be recorded.')
      await load(true)
      setNotice(`Decision recorded as ${body.review?.decision?.replaceAll('-', ' ') ?? 'complete'}. The candidate remains unpublished until every required scope passes the gate.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The expert decision could not be recorded.')
      setLoading(false)
    }
  }

  if (!unlocked) return (
    <main className="min-h-screen bg-[#f3f6fa] px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-md border border-cyan-200 bg-white p-7 shadow-[0_16px_60px_rgba(14,116,144,0.10)]">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700">Epistemic operations · private</p>
        <h1 className="mt-4 text-3xl font-semibold">Open the migration ledger</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Run append-only adapters and record scoped decisions against frozen hashes. This workspace cannot auto-publish or approve the product.</p>
        <label className="mt-6 block font-mono text-[11px] uppercase tracking-widest text-slate-500" htmlFor="epistemic-token">Operations token</label>
        <input id="epistemic-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} className="mt-2 w-full border border-slate-300 bg-slate-50 p-3 font-mono text-sm outline-none focus:border-cyan-600" />
        <button onClick={() => void load()} disabled={!token || loading} className="mt-4 w-full bg-cyan-700 p-3 font-mono text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40">{loading ? 'Opening…' : 'Open durable ledger'}</button>
        {notice && <p className="mt-4 text-sm text-rose-700">{notice}</p>}
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#f3f6fa] px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-cyan-200 pb-7">
          <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700">Epistemic operations · append-only</p>
          <h1 className="mt-3 text-4xl font-semibold">Knowledge ingestion and expert review</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">Legacy content is hashed and preserved as a candidate. Reviewers decide one scope at a time; any content change invalidates decisions bound to the prior digest.</p></div>
          <div className="flex flex-wrap gap-3"><a href="/admin/epistemic-work-queue" className="border border-violet-500 bg-violet-50 px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-violet-800">Open Phase 2 queue</a><a href="/admin/epistemic-reingestion" className="border border-cyan-600 bg-cyan-50 px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-cyan-800">Open controlled compiler</a></div>
        </header>
        {notice && <p className="mt-6 border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">{notice}</p>}

        <section className="mt-8" aria-labelledby="adapter-title">
          <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-widest text-slate-500">01 · persistent imports</p><h2 id="adapter-title" className="mt-2 text-2xl font-semibold">Domain adapters</h2></div><button onClick={() => void load()} disabled={loading} className="border border-slate-300 bg-white px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {adapters.map((adapter) => <article key={adapter.id} className="border border-slate-200 bg-white p-5 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-wider text-cyan-700">{adapter.sourceDatasetVersion}</p><h3 className="mt-3 font-semibold">{adapter.name}</h3><p className="mt-2 text-sm text-slate-500">{adapter.counts.sourceRecords} candidates · {adapter.counts.publicEligible} eligible</p><button onClick={() => void runAdapter(adapter.id)} disabled={loading} className="mt-5 w-full border border-cyan-600 px-3 py-2 font-mono text-[10px] font-bold uppercase text-cyan-800 disabled:opacity-40">Record import</button></article>)}
          </div>
        </section>

        <section className="mt-12 grid gap-6 xl:grid-cols-[360px_1fr]" aria-labelledby="review-title">
          <aside className="border border-slate-200 bg-white p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-500">02 · frozen targets</p>
            <h2 id="review-title" className="mt-2 text-xl font-semibold">Imported candidates</h2>
            <div className="mt-4 max-h-[680px] space-y-2 overflow-auto pr-1">
              {targets.map((target) => { const approved = Object.values(target.reviewProgress?.scopes ?? {}).filter((item) => item.status === 'approved').length; return <button key={`${target.recordId}:${target.reviewTargetSha256}`} onClick={() => chooseTarget(target)} className={`w-full border p-3 text-left ${selected?.recordId === target.recordId ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200 bg-slate-50'}`}><span className="block text-sm font-medium">{target.title}</span><span className="mt-1 block font-mono text-[9px] text-slate-500">{target.domainSlug} · {approved}/4 scopes · {target.reviewTargetSha256.slice(0, 16)}…</span></button> })}
              {!targets.length && <p className="text-sm leading-6 text-slate-500">Run a domain adapter to create review targets.</p>}
            </div>
          </aside>

          <div className="space-y-6">
            {selected ? <>
              <section className="border border-slate-200 bg-white p-6"><p className="font-mono text-[11px] uppercase tracking-widest text-cyan-700">Frozen target</p><h2 className="mt-2 text-2xl font-semibold">{selected.title}</h2><p className="mt-3 break-all font-mono text-[10px] text-slate-500">{selected.reviewTargetSha256}</p><a href={selected.sourcePublicPath} className="mt-3 inline-block text-sm text-cyan-800 underline">Open legacy source page</a></section>
              <section className="border border-slate-200 bg-white p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-slate-500">03 · versioned reviewer identity</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input label="Stable reviewer ID" value={reviewer.reviewerId} onChange={(value) => setReviewer({ ...reviewer, reviewerId: value })} placeholder="expert_jane-doe" />
                  <Input label="Profile version" value={reviewer.profileVersion} onChange={(value) => setReviewer({ ...reviewer, profileVersion: value })} />
                  <Input label="Display name" value={reviewer.displayName} onChange={(value) => setReviewer({ ...reviewer, displayName: value })} />
                  <Input label="Affiliation (optional)" value={reviewer.affiliation} onChange={(value) => setReviewer({ ...reviewer, affiliation: value })} />
                  <Input label="Identity URL (optional)" value={reviewer.identityUrl} onChange={(value) => setReviewer({ ...reviewer, identityUrl: value })} />
                  <TextArea label="Qualified domains · one per line" value={reviewer.domains} onChange={(value) => setReviewer({ ...reviewer, domains: value })} />
                  <TextArea label="Qualifications · one per line" value={reviewer.qualifications} onChange={(value) => setReviewer({ ...reviewer, qualifications: value })} />
                  <TextArea label="Conflicts · one per line" value={reviewer.conflicts} onChange={(value) => setReviewer({ ...reviewer, conflicts: value })} />
                </div>
              </section>
              <section className="border border-slate-200 bg-white p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-slate-500">04 · scoped decision</p>
                <label className="mt-4 block text-sm font-medium" htmlFor="review-scope">Review scope</label>
                <select id="review-scope" value={scope} onChange={(event) => { const next = event.target.value as (typeof scopes)[number]; setScope(next); prepareCriteria(next) }} className="mt-2 w-full border border-slate-300 bg-white p-3 text-sm">{scopes.map((value) => <option key={value} value={value}>{value.replaceAll('-', ' ')}</option>)}</select>
                <div className="mt-5 space-y-4">{criteriaDefinitions[scope]?.map((definition) => { const value = criteria.find((item) => item.criterionId === definition.id); return <div key={definition.id} className="border border-slate-200 bg-slate-50 p-4"><p className="font-medium">{definition.label}</p><p className="mt-1 text-sm text-slate-600">{definition.question}</p><select value={value?.verdict ?? 'satisfied'} onChange={(event) => setCriteria(criteria.map((item) => item.criterionId === definition.id ? { ...item, verdict: event.target.value } : item))} className="mt-3 border border-slate-300 bg-white p-2 text-sm">{criterionVerdicts.map((verdict) => <option key={verdict}>{verdict}</option>)}</select><textarea value={value?.rationale ?? ''} onChange={(event) => setCriteria(criteria.map((item) => item.criterionId === definition.id ? { ...item, rationale: event.target.value } : item))} placeholder="Criterion-specific rationale" rows={3} className="mt-3 w-full border border-slate-300 bg-white p-3 text-sm" /></div>})}</div>
                <div className="mt-5 grid gap-4 md:grid-cols-2"><TextArea label="Disagreements · one per line" value={disagreements} onChange={setDisagreements} /><Input label="Supersedes review ID (optional)" value={supersedesReviewId} onChange={setSupersedesReviewId} /></div>
                <TextArea label="Scoped conclusion" value={rationale} onChange={setRationale} />
                <button onClick={() => void submitReview()} disabled={loading || !criteria.length} className="mt-5 bg-cyan-700 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40">Record immutable decision</button>
              </section>
            </> : <section className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Select an imported candidate to begin a scoped review.</section>}
          </div>
        </section>

        <section className="mt-12 border border-slate-200 bg-white p-6"><p className="font-mono text-[11px] uppercase tracking-widest text-slate-500">Recorded decisions</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reviews.slice(0, 12).map((review) => <article key={review.reviewId} className="border border-slate-200 p-4"><p className="font-mono text-[10px] text-cyan-700">{review.scope}</p><p className="mt-2 text-sm font-medium">{review.reviewer.displayName} · {review.decision}</p><p className="mt-2 break-all font-mono text-[9px] text-slate-500">{review.recordId}</p></article>)}</div></section>
      </div>
    </main>
  )
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block text-sm font-medium">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full border border-slate-300 bg-slate-50 p-3 text-sm font-normal" /></label>
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mt-4 block text-sm font-medium">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full border border-slate-300 bg-slate-50 p-3 text-sm font-normal" /></label>
}
