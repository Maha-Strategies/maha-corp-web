'use client'

import { useMemo, useState } from 'react'

type Criterion = { id: string; label: string; question: string }
type Target = { scope: string; targetType: string; targetId: string; targetVersion: string; targetSha256: string; title: string; payload: Record<string, unknown>; criteria: Criterion[] }
type CriterionInput = { criterionId: string; verdict: string; rationale: string }
type Review = { reviewId: string; scope: string; targetId: string; targetVersion: string; verdict: string; reviewer: { displayName: string; reviewerId: string; profileVersion: number }; rationale: string; disagreements: unknown[]; reviewedAtUtc: string }

const verdicts = ['agree', 'agree-with-reservation', 'revise', 'disagree', 'not-qualified']

export default function PractitionerReviewsPage() {
  const [token, setToken] = useState('')
  const [targets, setTargets] = useState<Target[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [targetKey, setTargetKey] = useState('')
  const [criteria, setCriteria] = useState<CriterionInput[]>([])
  const [reviewer, setReviewer] = useState({ reviewerId: '', profileVersion: '1', displayName: '', qualifications: '', affiliation: '', identityUrl: '', conflicts: '', qualifiedForScope: false })
  const [rationale, setRationale] = useState('')
  const [disagreements, setDisagreements] = useState('[]')
  const [supersedesReviewId, setSupersedesReviewId] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = useMemo(() => targets.find((target) => `${target.targetId}:${target.targetVersion}` === targetKey) ?? null, [targets, targetKey])

  function choose(target: Target) {
    setTargetKey(`${target.targetId}:${target.targetVersion}`)
    setCriteria(target.criteria.map((criterion) => ({ criterionId: criterion.id, verdict: 'agree', rationale: '' })))
    setDisagreements('[]'); setRationale(''); setSupersedesReviewId('')
  }

  async function load() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/practitioner-reviews', { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json() as { targets?: Target[]; reviews?: Review[]; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Practitioner reviews are unavailable.')
      setTargets(body.targets ?? []); setReviews(body.reviews ?? []); setUnlocked(true)
      if (!selected && body.targets?.[0]) choose(body.targets[0])
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Practitioner reviews are unavailable.') } finally { setLoading(false) }
  }

  async function submit() {
    if (!selected) return
    setLoading(true); setNotice('')
    try {
      let parsedDisagreements: unknown
      try { parsedDisagreements = JSON.parse(disagreements) } catch { throw new Error('Disagreements must be valid JSON.') }
      const response = await fetch('/api/admin/practitioner-reviews', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: selected.targetId, targetVersion: selected.targetVersion, targetSha256: selected.targetSha256,
          reviewer: { reviewerId: reviewer.reviewerId, profileVersion: Number(reviewer.profileVersion), displayName: reviewer.displayName, qualifications: reviewer.qualifications, affiliation: reviewer.affiliation || null, identityUrl: reviewer.identityUrl || null, conflicts: reviewer.conflicts.split('\n').map((item) => item.trim()).filter(Boolean), qualifiedForScope: reviewer.qualifiedForScope },
          criteria, disagreements: parsedDisagreements, rationale, supersedesReviewId: supersedesReviewId || null,
          idempotencyKey: `practitioner-review:${crypto.randomUUID()}`,
        }),
      })
      const body = await response.json() as { review?: { verdict?: string }; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The review could not be recorded.')
      await load(); setNotice(`Scoped review recorded as ${body.review?.verdict?.replaceAll('-', ' ') ?? 'complete'}. No product approval or empirical claim was created.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The review could not be recorded.'); setLoading(false) }
  }

  if (!unlocked) return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200"><div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-xs tracking-widest text-violet-300">[ PRACTITIONER REVIEW // PRIVATE ]</p><h1 className="mt-4 text-2xl text-white">Open the review registry</h1><p className="mt-2 text-sm leading-relaxed text-zinc-400">Review one frozen calculation profile, source passage, or formalized rule. This workspace cannot approve the product or validate predictive claims.</p><input type="password" value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} placeholder="Practitioner-review token" className="mt-5 w-full border border-zinc-700 bg-black p-3 font-mono text-sm"/><button onClick={() => void load()} disabled={!token || loading} className="mt-4 w-full bg-violet-300 p-3 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">{loading ? 'Loading…' : 'Open scoped reviews'}</button>{notice && <p className="mt-4 text-sm text-red-300">{notice}</p>}</div></main>

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-7xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs tracking-widest text-violet-300">[ PRACTITIONER REVIEW // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Scoped celestial review registry</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Calculation conventions, source fidelity, and rule formalization are reviewed separately. Every verdict binds one artifact version and digest.</p></div><button onClick={() => void load()} disabled={loading} className="border border-zinc-600 px-4 py-2 font-mono text-xs uppercase">Refresh</button></header>{notice && <p className="mt-5 border border-violet-900 bg-violet-950/20 p-3 text-sm text-violet-100">{notice}</p>}
    <section className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]"><aside className="border border-zinc-800 p-4"><h2 className="text-sm text-white">Frozen review targets</h2>{['calculation-conventions','source-fidelity','rule-formalization'].map((scope) => <div key={scope} className="mt-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{scope.replaceAll('-', ' ')}</p><div className="mt-2 space-y-1">{targets.filter((target) => target.scope === scope).map((target) => <button key={`${target.targetId}:${target.targetVersion}`} onClick={() => choose(target)} className={`w-full border p-2 text-left text-xs ${selected?.targetSha256 === target.targetSha256 ? 'border-violet-500 bg-violet-950/30 text-violet-100' : 'border-zinc-800 text-zinc-400'}`}>{target.title}<span className="mt-1 block font-mono text-[9px] text-zinc-600">{target.targetVersion} · {target.targetSha256.slice(0, 20)}…</span></button>)}</div></div>)}</aside>
      <div>{selected && <><section className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{selected.scope.replaceAll('-', ' ')}</p><h2 className="mt-2 text-xl text-white">{selected.title}</h2><p className="mt-2 font-mono text-[10px] text-zinc-500">{selected.targetType} · version {selected.targetVersion} · {selected.targetSha256}</p><details className="mt-4"><summary className="cursor-pointer text-sm text-violet-200">Inspect exact frozen payload</summary><pre className="mt-3 max-h-96 overflow-auto border border-zinc-800 bg-black p-4 text-[11px] leading-relaxed text-zinc-400">{JSON.stringify(selected.payload, null, 2)}</pre></details></section>
        <section className="mt-6 border border-zinc-800 p-5"><h2 className="text-lg text-white">Reviewer identity and suitability</h2><p className="mt-1 text-xs text-zinc-500">The attestation records the reviewer's claimed scope competence; Maha does not infer suitability from a generic approval.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-zinc-400">Stable reviewer ID<input value={reviewer.reviewerId} onChange={(event) => setReviewer({...reviewer, reviewerId:event.target.value})} placeholder="practitioner_name-or-id" className="mt-1 w-full border border-zinc-700 bg-black p-2"/></label><label className="text-xs text-zinc-400">Profile version<input type="number" min="1" value={reviewer.profileVersion} onChange={(event) => setReviewer({...reviewer, profileVersion:event.target.value})} className="mt-1 w-full border border-zinc-700 bg-black p-2"/></label><label className="text-xs text-zinc-400">Display name<input value={reviewer.displayName} onChange={(event) => setReviewer({...reviewer, displayName:event.target.value})} className="mt-1 w-full border border-zinc-700 bg-black p-2"/></label><label className="text-xs text-zinc-400">Affiliation<input value={reviewer.affiliation} onChange={(event) => setReviewer({...reviewer, affiliation:event.target.value})} className="mt-1 w-full border border-zinc-700 bg-black p-2"/></label><label className="text-xs text-zinc-400 sm:col-span-2">Qualifications for this scope<textarea value={reviewer.qualifications} onChange={(event) => setReviewer({...reviewer, qualifications:event.target.value})} className="mt-1 min-h-24 w-full border border-zinc-700 bg-black p-2"/></label><label className="text-xs text-zinc-400">Identity URL<input value={reviewer.identityUrl} onChange={(event) => setReviewer({...reviewer, identityUrl:event.target.value})} placeholder="https://…" className="mt-1 w-full border border-zinc-700 bg-black p-2"/></label><label className="text-xs text-zinc-400">Conflicts, one per line<textarea value={reviewer.conflicts} onChange={(event) => setReviewer({...reviewer, conflicts:event.target.value})} className="mt-1 min-h-20 w-full border border-zinc-700 bg-black p-2"/></label></div><label className="mt-4 flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" checked={reviewer.qualifiedForScope} onChange={(event) => setReviewer({...reviewer, qualifiedForScope:event.target.checked})}/><span>I attest that my qualifications cover this specific review scope and that the conflicts listed above are complete.</span></label></section>
        <section className="mt-6 space-y-4">{selected.criteria.map((criterion, index) => <article key={criterion.id} className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Criterion {index + 1}</p><h3 className="mt-2 text-lg text-white">{criterion.label}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">{criterion.question}</p><select value={criteria[index]?.verdict ?? 'agree'} onChange={(event) => setCriteria(criteria.map((item, itemIndex) => itemIndex === index ? {...item, verdict:event.target.value} : item))} className="mt-4 border border-zinc-700 bg-black p-2 text-sm">{verdicts.map((verdict) => <option key={verdict}>{verdict}</option>)}</select><textarea value={criteria[index]?.rationale ?? ''} onChange={(event) => setCriteria(criteria.map((item, itemIndex) => itemIndex === index ? {...item, rationale:event.target.value} : item))} placeholder="Criterion-specific rationale" className="mt-3 min-h-24 w-full border border-zinc-700 bg-black p-3 text-sm"/></article>)}</section>
        <section className="mt-6 border border-zinc-800 p-5"><h2 className="text-lg text-white">Disagreements and scoped conclusion</h2><p className="mt-1 text-xs text-zinc-500">A revise or disagree criterion requires a JSON disagreement with criterionId, severity, statement, and proposedResolution.</p><textarea value={disagreements} onChange={(event) => setDisagreements(event.target.value)} spellCheck={false} className="mt-3 min-h-36 w-full border border-zinc-700 bg-black p-3 font-mono text-xs"/><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Overall rationale for this target only" className="mt-3 min-h-28 w-full border border-zinc-700 bg-black p-3 text-sm"/><input value={supersedesReviewId} onChange={(event) => setSupersedesReviewId(event.target.value)} placeholder="Prior review ID superseded, if any" className="mt-3 w-full border border-zinc-700 bg-black p-3 font-mono text-xs"/><button onClick={() => void submit()} disabled={loading || !reviewer.qualifiedForScope} className="mt-4 border border-violet-400 px-4 py-3 font-mono text-xs uppercase text-violet-100 disabled:opacity-40">Record scoped review</button><p className="mt-3 text-xs leading-relaxed text-zinc-500">The system derives the target verdict from the criterion verdicts. This action cannot approve Maha Celestial as a product or establish empirical validity.</p></section></>}</div>
    </section>
    <section className="mt-10"><h2 className="text-xl text-white">Append-only review history</h2><div className="mt-4 space-y-3">{reviews.map((review) => <article key={review.reviewId} className="border border-zinc-800 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{review.scope.replaceAll('-', ' ')} · {review.verdict.replaceAll('-', ' ')}</p><p className="mt-2 text-sm text-white">{review.targetId} · {review.targetVersion}</p></div><p className="font-mono text-[10px] text-zinc-500">{review.reviewId}<br/>{new Date(review.reviewedAtUtc).toLocaleString()}</p></div><p className="mt-3 text-sm text-zinc-400">{review.rationale}</p><p className="mt-3 text-xs text-zinc-500">Reviewer: {review.reviewer.displayName} ({review.reviewer.reviewerId} profile v{review.reviewer.profileVersion}) · disagreements {review.disagreements.length}</p></article>)}{reviews.length === 0 && <p className="border border-zinc-800 p-6 text-sm text-zinc-500">No practitioner reviews have been recorded.</p>}</div></section>
  </div></main>
}
