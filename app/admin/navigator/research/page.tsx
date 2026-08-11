'use client'

import { useMemo, useState } from 'react'

import {
  NAVIGATOR_CLAIM_TYPES,
  NAVIGATOR_CONFIDENCE_LEVELS,
  NAVIGATOR_SOURCE_QUALITIES,
  type NavigatorClaimType,
  type NavigatorConfidence,
  type NavigatorDisposition,
  type NavigatorSourceQuality,
} from '@/lib/maha-navigator-research'

type ClaimDraft = { type: NavigatorClaimType; statement: string; sourceUrl: string; sourcePublishedOn: string; observedOn: string; sourceQuality: NavigatorSourceQuality; confidence: NavigatorConfidence }
type StoredClaim = { public_id: string; claim_type: NavigatorClaimType; statement: string; source_url: string; source_published_on: string | null; observed_on: string; source_quality: string; evidence_freshness: string; confidence: string }
type StoredEvent = { id: string; action: string; previous_disposition: string | null; new_disposition: string | null; challenged_claim_id: string | null; rationale: string | null; rubric_key: string; rubric_version: number; actor_fingerprint: string; created_at: string }
type Candidate = { public_id: string; company_name: string; company_domain: string; rubric_key: string; rubric_version: number; disposition: NavigatorDisposition; latest_review_rationale: string | null; benchmark_position: number | null; reviewed_at: string | null; created_at: string; claims: StoredClaim[]; events: StoredEvent[] }
type QualityGate = { state: 'collecting' | 'passed' | 'failed'; reviewed: number; requiredReviewed: number; pursue: number; requiredPursue: number; remaining: number; conversationWorthyRate: number | null; qualityGatePassed: boolean; outreachAuthorized: false; interpretation: string }
type Rubric = { rubric_key: string; version: number; name: string; definition: { idealAccountProfile?: string[]; buyingTriggers?: string[]; disqualifiers?: string[] } }
type CommercialStage = 'discovered' | 'recommendation_approved' | 'message_sent' | 'reply_received' | 'offer_inspected' | 'payment_confirmed' | 'delivery_succeeded' | 'repeat_purchase'
type OperatorCommercialStage = 'message_sent' | 'reply_received' | 'offer_inspected' | 'payment_confirmed' | 'delivery_succeeded'
type CommercialEvent = { id: string; candidate_id: string; stage: CommercialStage; offer_id: string | null; channel: string | null; reference_hash: string | null; actor_type: string; created_at: string }
type CommercialFunnel = { unit: 'distinct_prospects'; stages: Record<CommercialStage, number>; confirmedPayments: number; interpretation: string }

const LABELS: Record<NavigatorClaimType, string> = {
  account_fit: 'Account fit',
  buying_trigger: 'Dated buying trigger / why now',
  likely_owner: 'Likely sponsor role',
  disqualifier: 'Disqualifier or reason none was found',
}
const REVIEW_DISPOSITIONS: Exclude<NavigatorDisposition, 'unreviewed'>[] = ['pursue', 'watch', 'reject', 'insufficient_evidence', 'deferred']
const COMMERCIAL_STAGES: CommercialStage[] = ['discovered', 'recommendation_approved', 'message_sent', 'reply_received', 'offer_inspected', 'payment_confirmed', 'delivery_succeeded', 'repeat_purchase']

function blankClaims(): ClaimDraft[] {
  const today = new Date().toISOString().slice(0, 10)
  return NAVIGATOR_CLAIM_TYPES.map((type) => ({ type, statement: '', sourceUrl: '', sourcePublishedOn: '', observedOn: today, sourceQuality: 'primary', confidence: 'medium' }))
}

export default function NavigatorResearchPage() {
  const [token, setToken] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [gate, setGate] = useState<QualityGate | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companyDomain, setCompanyDomain] = useState('')
  const [claims, setClaims] = useState<ClaimDraft[]>(blankClaims)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [showRubric, setShowRubric] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [commercialEvents, setCommercialEvents] = useState<CommercialEvent[]>([])
  const [commercialFunnel, setCommercialFunnel] = useState<CommercialFunnel | null>(null)

  const claimReady = useMemo(() => claims.every((claim) => claim.statement.trim().length >= 10 && claim.sourceUrl.startsWith('https://') && claim.observedOn), [claims])

  async function load() {
    setLoading(true); setNotice('')
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [response, commercialResponse] = await Promise.all([
        fetch('/api/admin/navigator/research', { headers }),
        fetch('/api/admin/navigator/commercial-loop', { headers }),
      ])
      const body = await response.json() as { rubric?: Rubric; candidates?: Candidate[]; qualityGate?: QualityGate; error?: { message?: string } }
      const commercialBody = await commercialResponse.json() as { funnel?: CommercialFunnel; events?: CommercialEvent[]; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Navigator research queue unavailable.')
      if (!commercialResponse.ok) throw new Error(commercialBody.error?.message ?? 'Navigator commercial loop unavailable.')
      setRubric(body.rubric ?? null); setCandidates(body.candidates ?? []); setGate(body.qualityGate ?? null)
      setCommercialEvents(commercialBody.events ?? []); setCommercialFunnel(commercialBody.funnel ?? null); setUnlocked(true)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Navigator research queue unavailable.') }
    finally { setLoading(false) }
  }

  function updateClaim(index: number, patch: Partial<ClaimDraft>) { setClaims((current) => current.map((claim, claimIndex) => claimIndex === index ? { ...claim, ...patch } : claim)) }

  async function createCandidate() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/navigator/research', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_candidate', companyName, companyDomain, claims, idempotencyKey: `navigator-candidate:${crypto.randomUUID()}` }),
      })
      const body = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Candidate creation failed.')
      setCompanyName(''); setCompanyDomain(''); setClaims(blankClaims()); setShowCreate(false); setNotice('Candidate added without authorizing contact.'); await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Candidate creation failed.'); setLoading(false) }
  }

  async function review(candidate: Candidate, disposition: Exclude<NavigatorDisposition, 'unreviewed'>) {
    const rationale = window.prompt(`Why should ${candidate.company_name} move to ${disposition.replaceAll('_', ' ')}? This becomes append-only review history.`)
    if (!rationale) return
    await operate({ action: 'review_candidate', candidateId: candidate.public_id, disposition, rationale })
  }

  async function challenge(candidate: Candidate, claim: StoredClaim) {
    const rationale = window.prompt(`What is wrong, weak, stale, or ambiguous about this ${LABELS[claim.claim_type].toLowerCase()} claim?`)
    if (!rationale) return
    await operate({ action: 'challenge_claim', candidateId: candidate.public_id, claimId: claim.public_id, rationale })
  }

  async function operate(operation: Record<string, unknown>) {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/navigator/research', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...operation, idempotencyKey: `navigator-research:${crypto.randomUUID()}` }),
      })
      const body = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Review operation failed.')
      await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Review operation failed.'); setLoading(false) }
  }

  async function recordCommercial(candidate: Candidate, stage: OperatorCommercialStage) {
    let channel: string | null = null
    let offerId: string | null = null
    let referenceId: string | null = null
    if (stage === 'message_sent' || stage === 'reply_received') {
      channel = window.prompt('Channel: email, linkedin, reddit, registry, direct, or other')?.trim().toLowerCase() ?? null
      if (!channel) return
    }
    if (stage === 'offer_inspected' || stage === 'payment_confirmed' || stage === 'delivery_succeeded') {
      offerId = window.prompt('Exact offer ID inspected or purchased')?.trim() ?? null
      if (!offerId) return
    }
    if (stage === 'payment_confirmed' || stage === 'delivery_succeeded') {
      referenceId = window.prompt('Payment or delivery reference. Navigator stores only its SHA-256 hash.')?.trim() ?? null
      if (!referenceId) return
    }
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/navigator/commercial-loop', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.public_id, stage, channel, offerId, referenceId, idempotencyKey: `navigator-commercial:${crypto.randomUUID()}` }),
      })
      const body = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Commercial stage could not be recorded.')
      setNotice(`${stage.replaceAll('_', ' ')} recorded. No message, offer, or payment was initiated by Navigator.`); await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Commercial stage could not be recorded.'); setLoading(false) }
  }

  if (!unlocked) return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200"><div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-xs tracking-widest text-cyan-300">[ NAVIGATOR RESEARCH // PRIVATE ]</p><h1 className="mt-4 text-2xl text-white">Unlock research queue</h1><p className="mt-2 text-sm leading-6 text-zinc-400">Human research and review only. This surface cannot generate or send outreach.</p><input type="password" value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} placeholder="Inbound operations token" className="navigator-input mt-5"/><button onClick={() => void load()} disabled={!token || loading} className="mt-4 w-full bg-cyan-200 p-3 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">{loading ? 'Loading…' : 'Open research queue'}</button>{notice && <p className="mt-4 text-sm text-red-300">{notice}</p>}</div></main>

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="font-mono text-xs tracking-widest text-cyan-300">[ NAVIGATOR RESEARCH // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Evidence-backed account queue</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">A recommendation earns human review. It never grants permission to contact an account.</p></div><div className="flex gap-2"><a href="/admin/navigator" className="border border-zinc-700 px-4 py-2 font-mono text-xs uppercase">Assessments</a><button onClick={() => setShowCreate((value) => !value)} className="bg-cyan-200 px-4 py-2 font-mono text-xs font-bold uppercase text-black">{showCreate ? 'Close form' : 'Add candidate'}</button><button onClick={() => void load()} disabled={loading} className="border border-zinc-600 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div></header>

    {notice && <p className="mt-5 border border-cyan-900 bg-cyan-950/20 p-3 text-sm text-cyan-100">{notice}</p>}

    {gate && <section className="mt-8 grid gap-4 border border-zinc-800 bg-zinc-950/60 p-5 md:grid-cols-[1fr_auto_auto]"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">20-account quality gate · {gate.state}</p><p className="mt-2 text-sm leading-6 text-zinc-300">{gate.interpretation}</p></div><div><p className="text-3xl text-white">{gate.reviewed}/20</p><p className="font-mono text-[10px] uppercase text-zinc-500">reviewed</p></div><div><p className="text-3xl text-white">{gate.pursue}/10</p><p className="font-mono text-[10px] uppercase text-zinc-500">conversation-worthy</p></div></section>}

    {commercialFunnel && <section className="mt-4 border border-zinc-800 bg-zinc-950/60 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Commercial loop · distinct prospects</p><p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-400">{commercialFunnel.interpretation}</p></div><p className="font-mono text-xs text-zinc-400">{commercialFunnel.confirmedPayments} confirmed payment reference{commercialFunnel.confirmedPayments === 1 ? '' : 's'}</p></div><div className="mt-5 grid grid-cols-2 gap-px bg-zinc-800 sm:grid-cols-4 xl:grid-cols-8">{COMMERCIAL_STAGES.map((stage) => <div key={stage} className="bg-zinc-950 p-3"><p className="text-2xl text-white">{commercialFunnel.stages[stage]}</p><p className="mt-1 font-mono text-[9px] uppercase leading-4 text-zinc-500">{stage.replaceAll('_', ' ')}</p></div>)}</div></section>}

    {rubric && <section className="mt-4 border border-zinc-800"><button onClick={() => setShowRubric((value) => !value)} className="flex w-full justify-between p-4 text-left font-mono text-xs uppercase tracking-widest"><span>Rubric {rubric.rubric_key} v{rubric.version}</span><span>{showRubric ? '−' : '+'}</span></button>{showRubric && <div className="grid gap-6 border-t border-zinc-800 p-5 md:grid-cols-3">{([['Ideal account', rubric.definition.idealAccountProfile], ['Buying triggers', rubric.definition.buyingTriggers], ['Disqualifiers', rubric.definition.disqualifiers]] as const).map(([title, values]) => <div key={title}><h2 className="text-sm text-white">{title}</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">{values?.map((value) => <li key={value}>— {value}</li>)}</ul></div>)}</div>}</section>}

    {showCreate && <section className="mt-6 border border-cyan-900 bg-zinc-950 p-5"><h2 className="text-xl text-white">Add one researched account</h2><p className="mt-2 text-sm text-zinc-400">Every claim needs its own evidence. Publication date may be unknown; observation date may not.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="navigator-label">Company name<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="navigator-input"/></label><label className="navigator-label">Company domain<input value={companyDomain} onChange={(event) => setCompanyDomain(event.target.value)} placeholder="example.com" className="navigator-input"/></label></div><div className="mt-6 grid gap-5 xl:grid-cols-2">{claims.map((claim, index) => <fieldset key={claim.type} className="border border-zinc-800 p-4"><legend className="px-2 font-mono text-xs uppercase tracking-widest text-cyan-300">{LABELS[claim.type]}</legend><label className="navigator-label">Claim<textarea value={claim.statement} onChange={(event) => updateClaim(index, { statement: event.target.value })} rows={4} className="navigator-input"/></label><label className="navigator-label mt-3">Evidence URL<input type="url" value={claim.sourceUrl} onChange={(event) => updateClaim(index, { sourceUrl: event.target.value })} placeholder="https://…" className="navigator-input"/></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="navigator-label">Source published<input type="date" value={claim.sourcePublishedOn} onChange={(event) => updateClaim(index, { sourcePublishedOn: event.target.value })} className="navigator-input"/></label><label className="navigator-label">Observed<input type="date" value={claim.observedOn} onChange={(event) => updateClaim(index, { observedOn: event.target.value })} className="navigator-input"/></label><label className="navigator-label">Source quality<select value={claim.sourceQuality} onChange={(event) => updateClaim(index, { sourceQuality: event.target.value as NavigatorSourceQuality })} className="navigator-input">{NAVIGATOR_SOURCE_QUALITIES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label className="navigator-label">Claim confidence<select value={claim.confidence} onChange={(event) => updateClaim(index, { confidence: event.target.value as NavigatorConfidence })} className="navigator-input">{NAVIGATOR_CONFIDENCE_LEVELS.map((value) => <option key={value}>{value}</option>)}</select></label></div></fieldset>)}</div><button onClick={() => void createCandidate()} disabled={loading || companyName.trim().length < 2 || companyDomain.trim().length < 3 || !claimReady} className="mt-5 bg-cyan-200 px-5 py-3 font-mono text-xs font-bold uppercase text-black disabled:opacity-30">Save evidence snapshot</button></section>}

    <div className="mt-8 space-y-5">{candidates.map((candidate) => <article key={candidate.public_id} className="border border-zinc-800 bg-zinc-950/50 p-5"><div className="flex flex-wrap justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{candidate.disposition.replaceAll('_', ' ')} · rubric v{candidate.rubric_version}{candidate.benchmark_position ? ` · benchmark #${candidate.benchmark_position}` : ''}</p><h2 className="mt-2 text-xl text-white">{candidate.company_name}</h2><a href={`https://${candidate.company_domain}`} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-zinc-400 hover:text-cyan-200">{candidate.company_domain}</a></div><div className="flex flex-wrap gap-2">{REVIEW_DISPOSITIONS.map((disposition) => <button key={disposition} disabled={loading} onClick={() => void review(candidate, disposition)} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase hover:border-cyan-400 disabled:opacity-30">{disposition.replaceAll('_', ' ')}</button>)}</div></div>
      {candidate.disposition === 'pursue' && <div className="mt-4 flex flex-wrap gap-2 border-y border-zinc-800 py-3"><span className="mr-2 self-center font-mono text-[9px] uppercase tracking-widest text-emerald-300">Record evidence only</span>{(['message_sent','reply_received','offer_inspected','payment_confirmed','delivery_succeeded'] as OperatorCommercialStage[]).map((stage) => <button key={stage} disabled={loading} onClick={() => void recordCommercial(candidate, stage)} className="border border-emerald-950 px-3 py-2 font-mono text-[9px] uppercase text-emerald-200 hover:border-emerald-500 disabled:opacity-30">{stage.replaceAll('_', ' ')}</button>)}</div>}
      <div className="mt-5 grid gap-4 xl:grid-cols-2">{candidate.claims.map((claim) => <section key={claim.public_id} className="border border-zinc-800 p-4"><div className="flex justify-between gap-4"><h3 className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{LABELS[claim.claim_type]}</h3><button onClick={() => void challenge(candidate, claim)} className="font-mono text-[10px] uppercase text-amber-300">Challenge</button></div><p className="mt-3 text-sm leading-6 text-zinc-200">{claim.statement}</p><a href={claim.source_url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-xs text-cyan-200 hover:underline">{claim.source_url}</a><p className="mt-2 font-mono text-[10px] uppercase leading-5 text-zinc-500">observed {claim.observed_on} · source {claim.source_published_on ?? 'date unknown'}<br/>quality {claim.source_quality.replaceAll('_', ' ')} · freshness {claim.evidence_freshness} · confidence {claim.confidence}</p></section>)}</div>
      {candidate.latest_review_rationale && <p className="mt-4 border-l-2 border-cyan-700 pl-3 text-sm text-zinc-400">Latest review: {candidate.latest_review_rationale}</p>}
      <details className="mt-4 border-t border-zinc-800 pt-4"><summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-500">Commercial evidence ({commercialEvents.filter((event) => event.candidate_id === candidate.public_id).length})</summary><ol className="mt-3 space-y-2">{commercialEvents.filter((event) => event.candidate_id === candidate.public_id).map((event) => <li key={event.id} className="text-xs leading-5 text-zinc-400"><span className="text-emerald-200">{event.stage.replaceAll('_', ' ')}</span> · {new Date(event.created_at).toLocaleString()} · {event.actor_type}{event.channel ? ` · ${event.channel}` : ''}{event.offer_id ? ` · ${event.offer_id}` : ''}{event.reference_hash ? ` · ref ${event.reference_hash.slice(0, 18)}…` : ''}</li>)}</ol></details>
      <details className="mt-4 border-t border-zinc-800 pt-4"><summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-500">Decision and challenge history ({candidate.events.length})</summary><ol className="mt-3 space-y-3">{candidate.events.map((event) => <li key={event.id} className="text-xs leading-5 text-zinc-400"><span className="text-zinc-200">{event.action}</span> · {new Date(event.created_at).toLocaleString()} · reviewer {event.actor_fingerprint.slice(0, 18)}… · rubric v{event.rubric_version}{event.previous_disposition !== event.new_disposition ? ` · ${event.previous_disposition ?? 'none'} → ${event.new_disposition}` : ''}{event.rationale ? <span className="block pl-3">{event.rationale}</span> : null}</li>)}</ol></details>
    </article>)}{candidates.length === 0 && <p className="border border-zinc-800 p-8 text-center text-sm text-zinc-500">No researched accounts yet. Add evidence before making a recommendation.</p>}</div>
  </div></main>
}
