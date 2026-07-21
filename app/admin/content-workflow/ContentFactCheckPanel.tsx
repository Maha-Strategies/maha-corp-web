'use client'

import { useState } from 'react'

const CLASSIFICATIONS = ['supported', 'insufficient_evidence', 'contradicted', 'interpretation', 'time_sensitive'] as const
type Classification = (typeof CLASSIFICATIONS)[number]
type ClaimRow = { claimText: string; classification: Classification; citedUrls: string; rationale: string }

type Claim = { claim_index: number; claim_text: string; classification: string; required_action: string; rationale: string; cited_urls: string[]; risk: string; weak_evidence: boolean; resolution: string; resolution_reason: string | null }
type ReviewView = {
  structuralPublicationReadiness: { score: number; decision: string; checklist: Record<string, boolean> }
  claimVerificationReadiness: { reviewId: string; score: number; claimCount: number; highRiskOpen: number; acknowledged: boolean } | null
  publicationEligibility: { eligible: boolean; reasons: string[] }
  claims: Claim[]
}

const REASON_LABELS: Record<string, string> = {
  structural_score_below_70: 'Structural publication score is below 70.',
  structural_hard_blockers_open: 'Structural hard blockers (summary, method, limits, artifact) are unmet.',
  fact_check_review_missing: 'No claim-verification review has been recorded.',
  unresolved_contradicted_or_insufficient_claims: 'Contradicted or insufficient-evidence claims are unresolved.',
  reviewer_acknowledgement_missing: 'A human reviewer has not acknowledged the review.',
}
const emptyRow: ClaimRow = { claimText: '', classification: 'supported', citedUrls: '', rationale: '' }

type WorkflowDraft = { public_id: string; candidate_id: string; title: string; status: string }

export default function ContentFactCheckPanel({ token, drafts, onReviewChanged }: { token: string; drafts: WorkflowDraft[]; onReviewChanged?: () => void }) {
  const [draftId, setDraftId] = useState('')
  const [candidateId, setCandidateId] = useState('')
  const [rows, setRows] = useState<ClaimRow[]>([{ ...emptyRow }])
  const [view, setView] = useState<ReviewView | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function call(method: 'GET' | 'POST', body?: object, query = '') {
    const response = await fetch(`/api/admin/content-fact-checks${query}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json() as Record<string, unknown> & { error?: { message?: string } }
    if (!response.ok) throw new Error(data.error?.message ?? 'Request failed.')
    return data
  }

  async function loadReview(id = draftId) {
    if (!/^contentdraft_[a-f0-9]{32}$/.test(id)) { setNotice('Enter a valid draftId (contentdraft_…).'); return }
    setBusy(true); setNotice('')
    try { setView(await call('GET', undefined, `?draftId=${id}`) as unknown as ReviewView) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load review.'); setView(null) }
    finally { setBusy(false) }
  }
  function chooseDraft(id: string) {
    const draft = drafts.find((item) => item.public_id === id)
    setDraftId(id); setCandidateId(draft?.candidate_id ?? ''); setView(null); setNotice('')
  }

  async function submit() {
    setBusy(true); setNotice('')
    try {
      const claims = rows.filter((row) => row.claimText.trim()).map((row) => ({
        claimText: row.claimText.trim(), classification: row.classification,
        citedUrls: row.citedUrls.split(',').map((url) => url.trim()).filter(Boolean), rationale: row.rationale.trim(),
      }))
      await call('POST', { draftId, candidateId, claims, idempotencyKey: `factcheck:${draftId}:${crypto.randomUUID()}` })
      setNotice('Review recorded. Any prior publication handoff for this draft is now superseded.')
      setRows([{ ...emptyRow }]); await loadReview(); onReviewChanged?.()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not record review.') }
    finally { setBusy(false) }
  }

  async function resolve(claimIndex: number, resolution: 'resolved' | 'accepted') {
    const reason = window.prompt(`Reason to ${resolution} this claim (a human judgment, recorded in the audit log):`) ?? ''
    if (reason.trim().length < 3) { setNotice('A reason of at least 3 characters is required.'); return }
    setBusy(true); setNotice('')
    try { await call('POST', { action: 'resolve', reviewId: view?.claimVerificationReadiness?.reviewId, claimIndex, resolution, reason: reason.trim(), idempotencyKey: `resolve:${claimIndex}:${crypto.randomUUID()}` }); await loadReview(); onReviewChanged?.() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not record resolution.') }
    finally { setBusy(false) }
  }

  async function acknowledge() {
    const note = window.prompt('Acknowledgement note (optional). Truth, source quality, and recency remain your judgment:') ?? ''
    setBusy(true); setNotice('')
    try { await call('POST', { action: 'acknowledge', reviewId: view?.claimVerificationReadiness?.reviewId, note: note.trim(), idempotencyKey: `ack:${crypto.randomUUID()}` }); await loadReview(); onReviewChanged?.() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not acknowledge.') }
    finally { setBusy(false) }
  }

  const fc = view?.claimVerificationReadiness
  return (
    <section className="mt-8 border border-amber-900/50 bg-amber-950/5 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Step 3.5 · claim verification (editorial fact-check)</p>
      <h2 className="mt-2 text-lg text-white">Evidence-quality review before handoff</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Classifies each claim by the <em>sufficiency of the editor-supplied evidence</em> — never as true or false. Source quality,
        factual truth, recency, and appropriateness remain human judgments. A structurally-ready draft cannot be handed off while
        contradicted or insufficient-evidence claims are unresolved or unacknowledged.
      </p>

      {/* Submit a review */}
      <label className="mt-5 block text-xs text-zinc-400">Editorial-ready draft<select value={draftId} onChange={(event) => chooseDraft(event.target.value)} className="mt-1 w-full border border-zinc-700 bg-black p-2 text-sm text-zinc-200"><option value="">Choose a draft</option>{drafts.map((draft) => <option key={draft.public_id} value={draft.public_id}>{draft.title}</option>)}</select></label>
      {draftId && <p className="mt-2 font-mono text-[10px] text-zinc-500">Private review for the selected workflow draft. Candidate is linked automatically.</p>}
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="border border-zinc-800 p-3">
            <textarea value={row.claimText} onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, claimText: event.target.value } : r)))} placeholder="Claim text (a single factual statement from the draft)" className="w-full border border-zinc-700 bg-black p-2 text-sm text-zinc-200" />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <select value={row.classification} onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, classification: event.target.value as Classification } : r)))} className="border border-zinc-700 bg-black p-2 text-xs text-zinc-200">
                {CLASSIFICATIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input value={row.citedUrls} onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, citedUrls: event.target.value } : r)))} placeholder="cited HTTPS URLs, comma-separated" className="border border-zinc-700 bg-black p-2 text-xs text-zinc-200 sm:col-span-2" />
            </div>
            <input value={row.rationale} onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, rationale: event.target.value } : r)))} placeholder="rationale (why this classification)" className="mt-2 w-full border border-zinc-700 bg-black p-2 text-xs text-zinc-200" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setRows([...rows, { ...emptyRow }])} disabled={busy || rows.length >= 40} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase text-zinc-300">+ claim</button>
        <button onClick={() => void submit()} disabled={busy || !draftId || !candidateId || !rows.some((r) => r.claimText.trim())} className="border border-amber-500 px-3 py-2 font-mono text-[10px] uppercase text-amber-100 disabled:opacity-40">Record review</button>
        <button onClick={() => void loadReview()} disabled={busy || !draftId} className="border border-zinc-600 px-3 py-2 font-mono text-[10px] uppercase text-zinc-300">Load status</button>
      </div>
      {notice && <p role="status" className="mt-4 text-sm text-amber-200">{notice}</p>}

      {/* Both scores + eligibility */}
      {view && (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <ScoreCard title="Structural publication readiness" score={view.structuralPublicationReadiness.score} sub={`decision: ${view.structuralPublicationReadiness.decision.replaceAll('_', ' ')}`} explain="Evidence, editorial completeness, limits, artifact, reviewer. Threshold 70. Does not establish truth." />
            <ScoreCard title="Claim verification readiness" score={fc?.score ?? 0} sub={fc ? `${fc.claimCount} claims · ${fc.highRiskOpen} high-risk open · ${fc.acknowledged ? 'acknowledged' : 'not acknowledged'}` : 'no review yet'} explain="100 minus penalties: contradicted −25, insufficient −15, time-sensitive −8, weak evidence −5. Evidence sufficiency only." tone="amber" />
          </div>
          <div className={`mt-4 border p-3 text-sm ${view.publicationEligibility.eligible ? 'border-emerald-800 bg-emerald-950/20 text-emerald-100' : 'border-red-900 bg-red-950/20 text-red-100'}`}>
            <p className="font-mono text-[10px] uppercase tracking-widest">{view.publicationEligibility.eligible ? 'Publication-eligible' : 'Publication blocked'}</p>
            {!view.publicationEligibility.eligible && <ul className="mt-2 list-disc pl-5">{view.publicationEligibility.reasons.map((reason) => <li key={reason}>{REASON_LABELS[reason] ?? reason}</li>)}</ul>}
          </div>

          {fc && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => void acknowledge()} disabled={busy || (fc.highRiskOpen > 0) || fc.acknowledged} className="border border-emerald-600 px-3 py-2 font-mono text-[10px] uppercase text-emerald-100 disabled:opacity-40">{fc.acknowledged ? 'Acknowledged' : 'Acknowledge review'}</button>
              {fc.highRiskOpen > 0 && <span className="text-xs text-red-300">Resolve every high-risk claim before acknowledging.</span>}
            </div>
          )}

          {view.claims.length > 0 && (
            <div className="mt-5 space-y-2">
              {view.claims.map((claim) => (
                <article key={claim.claim_index} className="border border-zinc-800 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`font-mono text-[10px] uppercase tracking-widest ${claim.risk === 'high' ? 'text-red-300' : claim.risk === 'manual' ? 'text-amber-300' : 'text-zinc-400'}`}>#{claim.claim_index + 1} · {claim.classification} · {claim.required_action.replaceAll('_', ' ')} · {claim.resolution}</span>
                    {claim.risk === 'high' && claim.resolution === 'open' && (
                      <span className="flex gap-2">
                        <button onClick={() => void resolve(claim.claim_index, 'resolved')} disabled={busy} className="border border-zinc-600 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200">Resolve</button>
                        <button onClick={() => void resolve(claim.claim_index, 'accepted')} disabled={busy} className="border border-zinc-600 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200">Accept w/ reason</button>
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-zinc-300">{claim.claim_text}</p>
                  <p className="mt-1 text-xs text-zinc-500">{claim.rationale}{claim.weak_evidence ? ' · weak evidence' : ''}</p>
                  {claim.resolution_reason && <p className="mt-1 text-xs text-emerald-200">Resolution: {claim.resolution_reason}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ScoreCard({ title, score, sub, explain, tone }: { title: string; score: number; sub: string; explain: string; tone?: 'amber' }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
      <p className={`mt-2 text-3xl tabular-nums ${tone === 'amber' ? 'text-amber-100' : 'text-cyan-100'}`}>{score}<span className="text-base text-zinc-600">/100</span></p>
      <p className="mt-1 text-xs text-zinc-400">{sub}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">{explain}</p>
    </div>
  )
}
