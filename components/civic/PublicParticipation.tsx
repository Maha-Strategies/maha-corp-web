'use client'
import { useEffect, useRef, useState } from 'react'
import { consultationSchema, publicSummarySchema, type Consultation, type PublicSummary } from '@/lib/civic/workspace-types'
import { aiSafetyReceiptSchema, aiSafetySubmissionSchema } from '@/lib/civic/ai-safety'
import { downloadPrivateJson, newCaseAccessKey } from './case-access'
import styles from './CivicDashboard.module.css'

function ConsultationResponse({ consultation }: { consultation: Consultation }) {
  const [alternative, setAlternative] = useState(consultation.packet.alternatives[0].id), [reasoning, setReasoning] = useState('')
  const [missing, setMissing] = useState(''), [challenge, setChallenge] = useState(''), [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [received, setReceived] = useState(false)
  const [clock, setClock] = useState(0)
  useEffect(() => {
    const first = setTimeout(() => setClock(Date.now()), 0), timer = setInterval(() => setClock(Date.now()), 10000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [])
  const attempt = useRef<{ fingerprint: string; id: string; key: string } | null>(null)
  const open = consultation.status === 'open' && Date.parse(consultation.packet.opensAt) <= clock && clock < Date.parse(consultation.packet.closesAt)
  return <div>
    {consultation.status === 'closed' && <div className={styles.result}><h4>Response rationale</h4><p>{consultation.responseRationale}</p></div>}
    {!open ? <p className={styles.muted}>This consultation is not currently accepting responses.</p> : received ? <p role="status">Your response was received privately. Use the downloaded access kit at <a href="/civic/follow-up">private follow-up</a>.</p> : <form className={styles.form} onSubmit={async e => {
      e.preventDefault(); setError('')
      const fingerprint = JSON.stringify({ alternative, reasoning, missing, challenge })
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID(), key: newCaseAccessKey() }
      const parsed = aiSafetySubmissionSchema.safeParse({ submissionId: attempt.current.id, topic: 'oversight', basis: 'concern',
        concern: reasoning, requestedAction: 'Review this consultation response, missing evidence and challenged assumptions.', sourceUrls: [], consentToPrivateReview: consent,
        consultationResponse: { consultationId: consultation.id, packetDigest: consultation.packetDigest, alternativeId: alternative, missingEvidence: missing, assumptionChallenge: challenge },
      })
      if (!parsed.success) { setError('Complete the response, evidence gaps, challenged assumptions and private-review consent.'); return }
      downloadPrivateJson({ id: attempt.current.id, accessKey: attempt.current.key, portal: '/civic/follow-up' }, 'civic-consultation-access-kit.json')
      setBusy(true)
      try {
        const response = await fetch('/api/civic/ai-safety', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'x-civic-case-key': attempt.current.key }, body: JSON.stringify(parsed.data) })
        const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Your response could not be confirmed.')
        const receipt = aiSafetyReceiptSchema.parse(body.receipt)
        if (receipt.id !== parsed.data.submissionId) throw new Error('The acknowledgment did not match this response.')
        setReceived(true)
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Submission failed; keep your draft.') }
      finally { setBusy(false) }
    }}>
      <label htmlFor={`alternative-${consultation.id}`}>Alternative you want considered</label><select id={`alternative-${consultation.id}`} value={alternative} onChange={e => setAlternative(e.target.value)}>{consultation.packet.alternatives.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <label htmlFor={`reason-${consultation.id}`}>Your reasoning</label><textarea id={`reason-${consultation.id}`} required minLength={20} maxLength={4000} value={reasoning} onChange={e => setReasoning(e.target.value)} />
      <label htmlFor={`missing-${consultation.id}`}>What evidence is missing?</label><textarea id={`missing-${consultation.id}`} required minLength={5} maxLength={1500} value={missing} onChange={e => setMissing(e.target.value)} />
      <label htmlFor={`challenge-${consultation.id}`}>Which assumptions should be challenged?</label><textarea id={`challenge-${consultation.id}`} required minLength={5} maxLength={1500} value={challenge} onChange={e => setChallenge(e.target.value)} />
      <label className={styles.consent}><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />Store this response for private operator review. I have removed sensitive information.</label>
      <p className={styles.muted}>Your response is private. Submitting downloads an access kit for follow-up. Participation is voluntary and does not constitute a representative poll.</p>
      <button disabled={busy}>{busy ? 'Submitting…' : 'Submit consultation response'}</button>{error && <p role="alert" className={styles.error}>{error}</p>}
    </form>}
  </div>
}
export default function PublicParticipation() {
  const [summaries, setSummaries] = useState<PublicSummary[]>([]), [consultations, setConsultations] = useState<Consultation[]>([])
  const [status, setStatus] = useState('Loading published participation records…')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/civic/participation', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json(); if (!response.ok || !body.available) throw new Error('Published participation records are not connected yet.')
      if (!controller.signal.aborted) { setSummaries(body.summaries.map((item: { summary: unknown }) => publicSummarySchema.parse(item.summary))); setConsultations(body.consultations.map((item: unknown) => consultationSchema.parse(item))); setStatus('Only consented, reviewed summaries and published consultation packets appear here.') }
    }).catch(error => { if (!controller.signal.aborted) { setSummaries([]); setConsultations([]); setStatus(error instanceof Error ? error.message : 'Public records unavailable.') } })
    return () => controller.abort()
  }, [refresh])
  return <div>
    <p role="status" className={styles.muted}>{status}</p><p><a href="/civic/follow-up">Follow up privately on your concern</a> · <a href="/civic/review">Operator review workspace</a></p>
    <button className={styles.secondary} type="button" onClick={() => setRefresh(value => value + 1)}>Refresh published participation</button>
    <h3>You raised / We investigated / What changed</h3>
    {!summaries.length && <p className={styles.muted}>No public investigation summaries are loaded. Private concerns are never shown as a public feed.</p>}
    {summaries.map(summary => <article className={styles.result} key={summary.id}><h4>{summary.title}</h4><p><strong>You raised:</strong> {summary.youRaised}</p><p><strong>We investigated:</strong> {summary.weInvestigated}</p><p><strong>What changed:</strong> {summary.whatChanged}</p><p><strong>Decision rationale:</strong> {summary.decisionRationale}</p><h4>Unresolved questions</h4>{summary.unresolved.length ? <ul>{summary.unresolved.map(item => <li key={item}>{item}</li>)}</ul> : <p>No unresolved questions were recorded in this summary; this does not establish completeness.</p>}{summary.sources.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.citation} ↗</a> · {source.verification.replaceAll('-', ' ')}</p>)}</article>)}
    <h3 className={styles.answerHeading}>Structured public consultations</h3>
    {!consultations.length && <p className={styles.muted}>No published consultations are loaded. Discussion templates stay private until an operator reviews and opens them.</p>}
    {consultations.map(item => <article key={item.id} className={styles.result}><p className={styles.eyebrow}>{item.status} · response window {item.packet.opensAt} to {item.packet.closesAt}</p><h4>{item.packet.title}</h4><p>{item.packet.question}</p><p>{item.packet.scope}</p><div className={styles.graphCards}>{item.packet.alternatives.map(alternative => <div key={alternative.id}><h4>{alternative.title}</h4><p>{alternative.description}</p><p><strong>Potential benefits</strong></p><ul>{alternative.benefits.map(text => <li key={text}>{text}</li>)}</ul><p><strong>Tradeoffs</strong></p><ul>{alternative.tradeoffs.map(text => <li key={text}>{text}</li>)}</ul></div>)}</div>
      <h4>Questions and decision criteria</h4><ul>{[...item.packet.questions, ...item.packet.decisionCriteria].map(text => <li key={text}>{text}</li>)}</ul><h4>Evidence packet</h4>{item.packet.evidence.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.citation}</a> · published {source.publishedOn ?? 'unknown'} · checked {source.checkedOn ?? 'not read'} · {source.verification}</p>)}
      <p className={styles.muted}>Packet digest: <code className={styles.digest}>{item.packetDigest}</code>Published alternatives and evidence are frozen; revisions require a new consultation.</p>
      <ConsultationResponse consultation={item} />
    </article>)}
    <p className={styles.muted}>Participation reflects people who chose to contribute. Neither submission volume nor selected alternatives establish representative public opinion.</p>
  </div>
}
