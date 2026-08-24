'use client'

import { FormEvent, useMemo, useState } from 'react'

import styles from '../../admin/epistemic-work-queue/work-queue.module.css'

type Criterion = { id: string; label: string; question: string }
type Decision = { criterionId: string; verdict: 'satisfied' | 'reservation' | 'unsatisfied' | 'not-qualified'; rationale: string }
type RecordSnapshot = {
  title: string
  description: string
  summary: string
  claims: Array<{ id: string; statement: string; claimKind: string; evidenceMaturity: string; sourceIds: string[]; scope: string; boundary: string }>
  sources: Array<{ id: string; title: string; authors: string[]; publishedAt: string; sourceChronology?: { status: 'undated' | 'living-document'; accessedAt: string; sourceVersion?: string }; url: string; exactLocator: string; establishes: string; boundary: string; rights: { basis: string; note: string } }>
  sections: Array<{ heading: string; paragraphs: string[]; claimIds: string[] }>
  boundaries: string[]
  prohibitedInferences: string[]
}
type Assignment = {
  invitation: { invitationId: string; scope: string; note: string; expiresAt: string; reviewer: { displayName: string; qualifications: string[]; affiliation: string | null; conflicts: string[] } }
  criteria: Criterion[]
  target: { recordId: string; domainSlug: string; title: string; targetSha256: string; sourcePublicPath: string; record: RecordSnapshot }
  boundary: string
}

export default function InvitedEpistemicReviewPage() {
  const [invitationToken, setInvitationToken] = useState('')
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [disagreements, setDisagreements] = useState('')
  const [rationale, setRationale] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const complete = useMemo(() => decisions.length > 0 && decisions.every((decision) => decision.rationale.trim().length >= 10), [decisions])

  async function unlock(event?: FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/reviewer/epistemic-review', { headers: { Authorization: `Bearer ${invitationToken}` } })
      const body = await response.json() as Assignment & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The reviewer assignment could not be opened.')
      setAssignment(body)
      setDecisions(body.criteria.map((criterion) => ({ criterionId: criterion.id, verdict: 'not-qualified', rationale: '' })))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The reviewer assignment could not be opened.')
    } finally {
      setLoading(false)
    }
  }

  function updateDecision(index: number, patch: Partial<Decision>) {
    setDecisions((current) => current.map((decision, position) => position === index ? { ...decision, ...patch } : decision))
  }

  async function submit() {
    if (!assignment) return
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/reviewer/epistemic-review', {
        method: 'POST',
        headers: { Authorization: `Bearer ${invitationToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: decisions,
          disagreements: disagreements.split('\n').map((value) => value.trim()).filter(Boolean),
          rationale,
          supersedesReviewId: null,
          idempotencyKey: `invited-review:${assignment.invitation.invitationId}`,
        }),
      })
      const body = await response.json() as { persistence?: { decision?: string }; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The review could not be recorded.')
      setSubmitted(true)
      setMessage(`Review recorded with derived decision: ${body.persistence?.decision ?? 'recorded'}. This invitation is now consumed.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The review could not be recorded.')
    } finally {
      setLoading(false)
    }
  }

  if (!assignment) return <main className={styles.page}><div className={styles.shell}><section className={`${styles.hero} ${styles.login}`}>
    <p className={styles.kicker}>Independent expert workspace</p><h1 className={styles.title}>Review one frozen record.</h1>
    <p className={styles.lede}>Paste the one-time invitation credential you received from the operator. It stays in component memory, is sent only as a bearer credential, and is never written to browser storage.</p>
    <form className="mt-7" onSubmit={unlock}><label className={styles.fieldLabel} htmlFor="invitation-token">Reviewer invitation token</label><input id="invitation-token" className={styles.input} type="password" autoComplete="off" value={invitationToken} onChange={(event) => setInvitationToken(event.target.value)} /><button className={`${styles.button} mt-4`} disabled={loading || invitationToken.length !== 43}>{loading ? 'Checking…' : 'Open assigned review'}</button></form>
    {message && <p className={styles.notice}>{message}</p>}
  </section></div></main>

  const record = assignment.target.record
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><p className={styles.kicker}>Assigned scope · {assignment.invitation.scope}</p><h1 className={styles.title}>{assignment.target.title}</h1><p className={styles.lede}>You are reviewing this representation as <strong>{assignment.invitation.reviewer.displayName}</strong>, profile qualifications: {assignment.invitation.reviewer.qualifications.join('; ')}. Your decision applies only to the named scope and exact digest below.</p><p className={`${styles.mono} mt-5`}>{assignment.target.recordId}<br />{assignment.target.targetSha256}<br />expires {new Date(assignment.invitation.expiresAt).toLocaleString()}</p><p className={styles.boundary}>{assignment.boundary}</p></header>
    {message && <p className={styles.notice}>{message}</p>}
    <div className={styles.workspace}>
      <section className={styles.panel}><p className={styles.kicker}>Frozen representation</p><h2 className={styles.sectionTitle}>{record.title}</h2><p className="mt-4 text-sm leading-7 text-slate-700">{record.summary}</p><a className={styles.reviewLink} href={assignment.target.sourcePublicPath} target="_blank" rel="noreferrer">Open legacy source page</a>
        <h3 className={`${styles.kicker} mt-8`}>Claims</h3><div className={`${styles.list} mt-4`}>{record.claims.map((claim) => <article className={styles.item} key={claim.id}><strong>{claim.statement}</strong><span className={styles.itemMeta}>{claim.claimKind} · {claim.evidenceMaturity}<br />sources: {claim.sourceIds.join(', ') || 'none'}</span><p className="mt-3 text-sm leading-6 text-slate-600"><strong>Scope:</strong> {claim.scope}<br /><strong>Boundary:</strong> {claim.boundary}</p></article>)}</div>
        <h3 className={`${styles.kicker} mt-8`}>Sources</h3><div className={`${styles.list} mt-4`}>{record.sources.map((source) => <article className={styles.item} key={source.id}><strong>{source.title}</strong><span className={styles.itemMeta}>{source.authors.join(', ')} · {source.publishedAt || (source.sourceChronology ? `${source.sourceChronology.status}; accessed ${source.sourceChronology.accessedAt}${source.sourceChronology.sourceVersion ? `; version ${source.sourceChronology.sourceVersion}` : ''}` : 'date missing')}<br />locator: {source.exactLocator || 'missing'} · rights: {source.rights.basis}</span><p className="mt-3 text-sm leading-6 text-slate-600"><strong>Establishes:</strong> {source.establishes}<br /><strong>Boundary:</strong> {source.boundary}</p><a className={styles.reviewLink} href={source.url} target="_blank" rel="noreferrer">Inspect source</a></article>)}</div>
        <h3 className={`${styles.kicker} mt-8`}>Boundaries and prohibited inferences</h3><div className={`${styles.blockerGrid} mt-4`}>{[...record.boundaries, ...record.prohibitedInferences].map((value, index) => <p className={styles.blocker} key={`${index}:${value}`}>{value}</p>)}</div>
      </section>
      <section className={styles.panel}><p className={styles.kicker}>Scoped decision</p><h2 className={styles.sectionTitle}>{assignment.invitation.scope.replaceAll('-', ' ')}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{assignment.invitation.note}</p>{assignment.invitation.reviewer.conflicts.length > 0 && <p className={styles.boundary}><strong>Declared conflicts:</strong> {assignment.invitation.reviewer.conflicts.join('; ')}</p>}
        <div className="mt-6 space-y-5">{assignment.criteria.map((criterion, index) => <fieldset className={styles.evidence} key={criterion.id}><legend className="font-semibold">{criterion.label}</legend><p className="mt-2 text-sm leading-6 text-slate-600">{criterion.question}</p><label className="mt-4 block"><span className={styles.fieldLabel}>Verdict</span><select className={styles.select} value={decisions[index]?.verdict} onChange={(event) => updateDecision(index, { verdict: event.target.value as Decision['verdict'] })}><option value="not-qualified">Not qualified / abstain</option><option value="satisfied">Satisfied</option><option value="reservation">Reservation</option><option value="unsatisfied">Unsatisfied</option></select></label><label className="mt-4 block"><span className={styles.fieldLabel}>Criterion rationale</span><textarea className={styles.textarea} rows={4} value={decisions[index]?.rationale ?? ''} onChange={(event) => updateDecision(index, { rationale: event.target.value })} /></label></fieldset>)}</div>
        <label className="mt-5 block"><span className={styles.fieldLabel}>Material disagreements · one per line</span><textarea className={styles.textarea} rows={5} value={disagreements} onChange={(event) => setDisagreements(event.target.value)} /></label><label className="mt-5 block"><span className={styles.fieldLabel}>Overall rationale</span><textarea className={styles.textarea} rows={7} value={rationale} onChange={(event) => setRationale(event.target.value)} /></label><label className="mt-5 flex items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm this decision reflects my own review of this exact digest, within my declared qualifications. I understand it is not product approval, publication authority, or proof of empirical truth.</span></label><button className={`${styles.button} mt-6`} disabled={loading || submitted || !complete || rationale.trim().length < 20 || !confirmed} onClick={() => void submit()}>{submitted ? 'Invitation consumed' : loading ? 'Recording…' : 'Record final scoped decision'}</button>
      </section>
    </div>
  </div></main>
}
