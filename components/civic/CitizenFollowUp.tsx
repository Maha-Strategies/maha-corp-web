'use client'
import { useRef, useState, type FormEvent } from 'react'
import { safetyCaseSchema, type SafetyCase } from '@/lib/civic/workspace-types'
import { downloadPrivateJson } from './case-access'
import RiskEvidenceGraph from './RiskEvidenceGraph'
import styles from './CivicDashboard.module.css'

export default function CitizenFollowUp() {
  const [id, setId] = useState(''), [key, setKey] = useState(''), [state, setState] = useState<SafetyCase | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reply, setReply] = useState('')
  const [concern, setConcern] = useState(''), [requestedAction, setRequestedAction] = useState(''), [withdraw, setWithdraw] = useState(false)
  const session = useRef(0)
  async function run(action: Record<string, unknown>) {
    setBusy(true); setError('')
    const generation = session.current
    try {
      const response = await fetch('/api/civic/ai-safety/case', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ id, ...action }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Private case unavailable.')
      if (session.current !== generation) return
      const next = safetyCaseSchema.parse(body.case); setState(next); setConcern(next.submission?.concern ?? ''); setRequestedAction(next.submission?.requestedAction ?? ''); setReply('')
    } catch (failure) { if (session.current === generation) setError(failure instanceof Error ? failure.message : 'Private case unavailable.') }
    finally { if (session.current === generation) setBusy(false) }
  }
  const change = (action: Record<string, unknown>) => run({ expectedRevision: state!.revision, operationId: crypto.randomUUID(), ...action })
  function unlock(event: FormEvent) { event.preventDefault(); void run({ action: 'read' }) }
  return <div className={styles.dashboard}><section className={styles.panel}>
    <p className={styles.muted}>Your access key grants control of this case. It stays in this page’s memory and is sent only in an authorization header. Keep your kit private; no email or account is required.</p>
    {!state ? <form className={styles.form} onSubmit={unlock}>
      <label htmlFor="case-id">Private case reference</label><input id="case-id" required value={id} onChange={e => setId(e.target.value.trim())} />
      <label htmlFor="case-key">Private access key</label><input id="case-key" type="password" autoComplete="off" required pattern="[a-f0-9]{64}" value={key} onChange={e => setKey(e.target.value.trim())} />
      <label htmlFor="case-kit">Or load your private access kit / receipt</label><input id="case-kit" type="file" accept="application/json" onChange={async e => {
        try { const file = e.target.files?.[0]; if (!file || file.size > 100000) throw new Error('Use a private access kit smaller than 100 KB.')
          const kit = JSON.parse(await file.text()); const reference = kit.id ?? kit.receipt?.id
          if (typeof reference !== 'string' || !/^[a-f0-9]{64}$/.test(kit.accessKey)) throw new Error('This kit does not contain an access key.')
          setId(reference); setKey(kit.accessKey); setError('')
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Invalid access kit.') }
      }} />
      <button disabled={busy}>Open private case</button>
    </form> : <>
      <div className={styles.result}><h2>Case status: {state.status.replaceAll('-', ' ')}</h2><p>Revision {state.revision} · updated {state.updatedAt}</p>
        <p>Reviewer: {state.assignedReviewer ?? (state.status === 'withdrawn' ? 'Assignment removed' : 'Not yet assigned')}</p><p>Next action: {state.nextAction ?? (state.status === 'withdrawn' ? 'None — case withdrawn' : 'Awaiting operator review')}{state.dueOn && <> · target {state.dueOn}</>}</p>
        <button type="button" disabled={busy} onClick={() => void run({ action: 'read' })}>Refresh case</button>
        <button className={styles.secondary} type="button" onClick={() => { session.current++; setBusy(false); setState(null); setKey(''); setId(''); setError(''); setWithdraw(false); setConcern(''); setRequestedAction(''); setReply('') }}>Lock private case</button>
        <button className={styles.secondary} type="button" onClick={() => downloadPrivateJson({ case: state }, 'civic-private-case.json')}>Download private case record</button>
      </div>
      {state.status === 'withdrawn' ? <p>Your submission, case notes, evidence graph and public summary have been removed from active storage. A minimal private withdrawal record remains until expiry. Backup retention is separate.</p> : <>
        <h3 className={styles.answerHeading}>Your current concern</h3><p>{state.submission?.concern}</p><p>Requested action: {state.submission?.requestedAction}</p>
        <h3 className={styles.answerHeading}>Updates and clarification</h3>{!state.messages.length && <p>No case updates yet.</p>}
        {state.messages.map(message => <blockquote key={message.id}><p className={styles.eyebrow}>{message.author} · {message.kind} · {message.at}</p>{message.text}</blockquote>)}
        {state.clarificationRequest && <form className={styles.form} onSubmit={e => { e.preventDefault(); void change({ action: 'reply', text: reply }) }}>
          <p><strong>Clarification requested:</strong> {state.clarificationRequest}</p><label htmlFor="case-reply">Your clarification</label><textarea id="case-reply" required minLength={5} maxLength={4000} value={reply} onChange={e => setReply(e.target.value)} /><button disabled={busy}>Send clarification</button>
        </form>}
        <details className={styles.receipt}><summary>Correct your concern</summary><p className={styles.muted}>Corrections reset the evidence assessment and remove any published summary until reviewed and consented again. Your initial receipt remains an integrity record.</p>
          <form className={styles.form} onSubmit={e => { e.preventDefault(); void change({ action: 'correct', concern, requestedAction }) }}>
            <label htmlFor="correct-concern">Corrected concern</label><textarea id="correct-concern" minLength={20} maxLength={4000} required value={concern} onChange={e => setConcern(e.target.value)} />
            <label htmlFor="correct-action">Corrected requested action</label><textarea id="correct-action" minLength={10} maxLength={1500} required value={requestedAction} onChange={e => setRequestedAction(e.target.value)} /><button disabled={busy}>Save correction</button>
          </form></details>
        <div className={styles.panel}><RiskEvidenceGraph graph={state.graph} /></div>
        {state.publication && <section className={styles.result}><h3>Proposed public summary</h3><h4>{state.publication.draft.title}</h4>
          <p><strong>You raised:</strong> {state.publication.draft.youRaised}</p><p><strong>We investigated:</strong> {state.publication.draft.weInvestigated}</p><p><strong>What changed:</strong> {state.publication.draft.whatChanged}</p>
          <p><strong>Decision rationale:</strong> {state.publication.draft.decisionRationale}</p><ul>{state.publication.draft.unresolved.map(item => <li key={item}>{item}</li>)}</ul>
          {state.publication.draft.sources.map(source => <div key={source.url}><p><a href={source.url} target="_blank" rel="noreferrer">{source.citation}</a> · {source.verification}</p><p className={styles.muted}>Published: {source.publishedOn ?? 'date unknown'} · checked: {source.checkedOn ?? 'not recorded'}</p>{source.contentDigest && <code className={styles.digest}>{source.contentDigest}</code>}</div>)}
          <details className={styles.receipt}><summary>Inspect the complete publication draft</summary><pre className={styles.json}>{JSON.stringify(state.publication.draft, null, 2)}</pre><code className={styles.digest}>{state.publication.digest}</code><button type="button" className={styles.secondary} onClick={() => downloadPrivateJson({ draft: state.publication!.draft, digest: state.publication!.digest }, 'civic-publication-draft.json')}>Download this exact draft</button></details>
          <p className={styles.muted}>Approving permits publication of exactly this summary and its sources. Your private case text and internal notes are excluded. Editing this summary requires new consent.</p>
          <p>{state.publication.publishedAt ? 'Published' : state.publication.consentedDigest ? 'You approved this draft; operator publication is pending.' : 'Not approved for publication.'}</p>
          <button type="button" disabled={busy || !!state.publication.consentedDigest} onClick={() => void change({ action: 'approve-publication', draftDigest: state.publication!.digest })}>Approve this exact summary for publication</button>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => void change({ action: 'revoke-publication' })}>Revoke publication permission</button>
        </section>}
        <details className={styles.receipt}><summary>Withdraw this concern</summary><p>Withdrawal removes your stored submission, case messages, evidence graph and any published summary from active storage. This cannot restore them later. Downloads or copies already made by others cannot be recalled.</p>
          <label className={styles.consent}><input type="checkbox" checked={withdraw} onChange={e => setWithdraw(e.target.checked)} />I want to withdraw and remove this concern.</label>
          <button type="button" disabled={!withdraw || busy} onClick={() => void change({ action: 'withdraw', confirm: true })}>Withdraw and remove concern</button>
        </details>
      </>}
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section></div>
}
