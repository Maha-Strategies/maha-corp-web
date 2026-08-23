'use client'

import Script from 'next/script'
import { FormEvent, useEffect, useMemo, useState } from 'react'

declare global { interface Window { mahaNavigatorTurnstileComplete?: (token: string) => void; mahaNavigatorTurnstileExpired?: () => void } }

type Domain = 'tool_authorization' | 'agent_identity' | 'task_budgets' | 'audit_receipts' | 'context_governance' | 'reliability'
type ControlState = 'unknown' | 'absent' | 'partial' | 'enforced'
type Assessment = {
  score: number; band: string; pilotCandidate: boolean
  gaps: { domain: Domain; status: ControlState; priority: string; action: string }[]
  strengths: Domain[]
  recommendedPilot: { id: string; name: string; objective: string }
  limits: string[]
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const domainLabels: Record<Domain, { name: string; prompt: string }> = {
  tool_authorization: { name: 'Tool authorization', prompt: 'Which tools, skills, or upstream servers may each agent call?' },
  agent_identity: { name: 'Agent identity', prompt: 'Can individual agents and workloads be identified, scoped, and revoked?' },
  task_budgets: { name: 'Task budgets', prompt: 'Are per-call and cumulative spending or resource ceilings enforced?' },
  audit_receipts: { name: 'Audit and receipts', prompt: 'Can you reconstruct policy decisions, tool calls, payments, and accountable actors?' },
  context_governance: { name: 'Context governance', prompt: 'Are context sources, retention, provenance, and token boundaries defined?' },
  reliability: { name: 'Reliability controls', prompt: 'Are timeouts, circuit breakers, alerts, and recovery paths tested?' },
}
const domains = Object.keys(domainLabels) as Domain[]
const stateLabels: Record<ControlState, string> = { unknown: 'Not assessed', absent: 'Not in place', partial: 'Partial or untested', enforced: 'Documented and enforced' }
const blankControls = () => Object.fromEntries(domains.map((domain) => [domain, 'unknown'])) as Record<Domain, ControlState>

function label(value: string) { return value.replaceAll('_', ' ') }
function saveJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
}

export default function NavigatorAssessment() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', organization: '', role: '', stage: 'pilot', protocols: ['mcp'] as string[], priority: 'tool_governance', primaryGoal: '', controls: blankControls(), consentToAssessment: false, consentToFollowUp: false, website: '' })
  const [result, setResult] = useState<{ assessmentId: string; assessment: Assessment } | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.mahaNavigatorTurnstileComplete = setTurnstileToken
    window.mahaNavigatorTurnstileExpired = () => setTurnstileToken('')
    return () => { delete window.mahaNavigatorTurnstileComplete; delete window.mahaNavigatorTurnstileExpired }
  }, [])

  const answered = useMemo(() => domains.filter((domain) => form.controls[domain] !== 'unknown').length, [form.controls])
  function toggleProtocol(protocol: string) { setForm((current) => ({ ...current, protocols: current.protocols.includes(protocol) ? current.protocols.filter((item) => item !== protocol) : [...current.protocols, protocol] })) }
  function updateControl(domain: Domain, value: ControlState) { setForm((current) => ({ ...current, controls: { ...current.controls, [domain]: value } })) }

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/navigator/assessments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: `navigator:${crypto.randomUUID()}`, requester: { name: form.name, email: form.email, organization: form.organization, role: form.role }, stage: form.stage, protocols: form.protocols, priority: form.priority, primaryGoal: form.primaryGoal, controls: form.controls, consentToAssessment: form.consentToAssessment, consentToFollowUp: form.consentToFollowUp, website: form.website || undefined, turnstileToken: turnstileToken || undefined }),
      })
      const body = await response.json() as { assessmentId?: string; assessment?: Assessment; error?: { message?: string } }
      if (!response.ok || !body.assessmentId || !body.assessment) throw new Error(body.error?.message ?? 'The assessment could not be created.')
      setResult({ assessmentId: body.assessmentId, assessment: body.assessment }); setStep(4)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The assessment could not be created.') }
    finally { setLoading(false) }
  }

  if (result) {
    const { assessment } = result
    return <section className="mt-12 grid gap-6 lg:grid-cols-[.75fr_1.25fr]" aria-live="polite"><aside className="border border-[var(--status-sourced)] bg-[var(--surface-raised)] p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Navigator brief · {result.assessmentId}</p><p className="mt-5 text-6xl font-light text-[var(--text-primary)]">{assessment.score}</p><p className="mt-2 font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)]">Inventory score · {assessment.band}</p><p className="mt-5 text-sm leading-6 text-[var(--text-secondary)]">This is a self-reported control inventory—not a security rating or certification.</p><button type="button" onClick={() => saveJson(result, `maha-navigator-${result.assessmentId}.json`)} className="evidence-action evidence-action--primary">Download brief</button></aside><div className="space-y-6"><section className="border border-[var(--border-default)] p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-verified)]">Recommended bounded pilot</p><h2 className="mt-3 text-2xl text-[var(--text-primary)]">{assessment.recommendedPilot.name}</h2><p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{assessment.recommendedPilot.objective}</p><p className="mt-4 text-xs text-[var(--text-muted)]">Candidate signal: {assessment.pilotCandidate ? 'A limited technical pilot may be relevant.' : 'Clarify the operating boundary before considering a pilot.'}</p></section><section className="border border-[var(--border-default)] p-6"><h2 className="text-lg text-[var(--text-primary)]">Control gaps</h2><div className="mt-4 space-y-4">{assessment.gaps.map((gap) => <article key={gap.domain} className="border-l-2 border-[var(--status-boundary)] pl-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm text-[var(--text-primary)]">{domainLabels[gap.domain].name}</h3><span className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">{gap.priority} · {stateLabels[gap.status]}</span></div><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{gap.action}</p></article>)}{assessment.gaps.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No inventory gaps were reported. Independent evidence review is still required.</p>}</div></section><section className="border border-[var(--border-default)] p-6"><h2 className="text-sm text-[var(--text-primary)]">Important limits</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--text-muted)]">{assessment.limits.map((item) => <li key={item}>— {item}</li>)}</ul></section></div></section>
  }

  return <form onSubmit={submit} className="mt-12 border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Step {step} of 3</p><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">No secrets or production payloads</p></div>
    {step === 1 && <section className="mt-7 space-y-5"><div><h2 className="text-2xl text-[var(--text-primary)]">Who is operating the system?</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Navigator uses this information only to create the requested brief and, if you opt in, arrange a human follow-up.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="evidence-input" /></Field><Field label="Work email"><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="evidence-input" /></Field><Field label="Organization"><input required value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="evidence-input" /></Field><Field label="Role"><input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="evidence-input" /></Field></div><div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div><Next onClick={() => setStep(2)} disabled={!form.name || !form.email || !form.organization || !form.role} /></section>}
    {step === 2 && <section className="mt-7 space-y-6"><div><h2 className="text-2xl text-[var(--text-primary)]">What are you deploying?</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Choose the protocols and the single operating problem that matters most now.</p></div><Field label="Deployment stage"><select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="evidence-input"><option value="exploring">Exploring</option><option value="pilot">Limited pilot</option><option value="production">Production</option></select></Field><fieldset><legend className="navigator-label">Protocols and tool surfaces</legend><div className="mt-3 flex flex-wrap gap-2">{['mcp', 'a2a', 'x402', 'api_tools', 'other'].map((protocol) => <button type="button" key={protocol} onClick={() => toggleProtocol(protocol)} className={`border px-4 py-2 font-mono text-xs uppercase tracking-widest ${form.protocols.includes(protocol) ? 'border-[var(--status-sourced)] bg-[var(--surface-raised)] text-[var(--status-sourced)]' : 'border-[var(--border-default)] text-[var(--text-muted)]'}`}>{label(protocol)}</button>)}</div></fieldset><Field label="Primary priority"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="evidence-input"><option value="tool_governance">Tool governance and authorization</option><option value="payment_safety">Agent payment safety</option><option value="context_cost">Context cost and provenance</option><option value="auditability">Auditability</option><option value="reliability">Reliability and recovery</option></select></Field><Field label="What must the system accomplish or prevent?"><textarea required minLength={20} maxLength={1500} rows={5} value={form.primaryGoal} onChange={(e) => setForm({ ...form, primaryGoal: e.target.value })} className="evidence-input" placeholder="Describe one real workload, decision, or failure you need to control." /></Field><div className="flex justify-between"><Back onClick={() => setStep(1)} /><Next onClick={() => setStep(3)} disabled={form.protocols.length === 0 || form.primaryGoal.trim().length < 20} /></div></section>}
    {step === 3 && <section className="mt-7 space-y-6"><div><h2 className="text-2xl text-[var(--text-primary)]">What controls exist today?</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Record what can be evidenced now. “Enforced” means documented and technically applied—not merely intended.</p></div><div className="grid gap-4 sm:grid-cols-2">{domains.map((domain) => <label key={domain} className="border border-[var(--border-default)] p-4"><span className="text-sm text-[var(--text-primary)]">{domainLabels[domain].name}</span><span className="mt-2 block min-h-12 text-xs leading-5 text-[var(--text-muted)]">{domainLabels[domain].prompt}</span><select value={form.controls[domain]} onChange={(e) => updateControl(domain, e.target.value as ControlState)} className="evidence-input mt-3">{Object.entries(stateLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}</div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{answered} of {domains.length} domains explicitly assessed</p><label className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]"><input type="checkbox" required checked={form.consentToAssessment} onChange={(e) => setForm({ ...form, consentToAssessment: e.target.checked })} className="mt-1" /><span>I authorize Maha Strategies to store these answers and my contact details to generate this requested assessment. I have not included secrets or sensitive production data.</span></label><label className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]"><input type="checkbox" checked={form.consentToFollowUp} onChange={(e) => setForm({ ...form, consentToFollowUp: e.target.checked })} className="mt-1" /><span>I would like a human follow-up about the recommended pilot. This is optional and is not consent to unrelated marketing.</span></label>{TURNSTILE_SITE_KEY && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-action="navigator_assessment" data-callback="mahaNavigatorTurnstileComplete" data-expired-callback="mahaNavigatorTurnstileExpired" /></>}{error && <p className="border border-[var(--status-unverified)] bg-[var(--surface-raised)] p-3 text-sm text-[var(--status-unverified)]">{error}</p>}<div className="flex justify-between gap-3"><Back onClick={() => setStep(2)} /><button type="submit" disabled={loading || !form.consentToAssessment} className="evidence-action evidence-action--primary">{loading ? 'Creating brief…' : 'Create readiness brief'}</button></div></section>}
  </form>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="navigator-label">{label}</span><span className="mt-2 block">{children}</span></label> }
function Next({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="ml-auto block border border-[var(--status-sourced)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)] disabled:opacity-30">Continue →</button> }
function Back({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)]">← Back</button> }
