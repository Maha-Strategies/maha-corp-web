'use client'
import { useRef, useState } from 'react'
import { consultationSchema, publicSummarySchema, riskGraphSchema, safetyCaseSchema, type Consultation, type SafetyCase } from '@/lib/civic/workspace-types'
import RiskEvidenceGraph from './RiskEvidenceGraph'
import styles from './CivicDashboard.module.css'

export default function CivicReviewWorkbench() {
  const [token, setToken] = useState(''), [cases, setCases] = useState<SafetyCase[]>([]), [state, setState] = useState<SafetyCase | null>(null)
  const [cursor, setCursor] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [reviewer, setReviewer] = useState(''), [nextAction, setNextAction] = useState(''), [dueOn, setDueOn] = useState('')
  const [status, setStatus] = useState('investigating'), [privateNote, setPrivateNote] = useState(''), [citizenUpdate, setCitizenUpdate] = useState(''), [clarification, setClarification] = useState('')
  const [graph, setGraph] = useState(''), [publication, setPublication] = useState(''), [privacy, setPrivacy] = useState(false)
  const [consultations, setConsultations] = useState<Consultation[]>([]), [consultation, setConsultation] = useState<Consultation | null>(null)
  const [consultationId, setConsultationId] = useState(''), [packet, setPacket] = useState(''), [rationale, setRationale] = useState(''), [consultationPrivacy, setConsultationPrivacy] = useState(false)
  const session = useRef(0)
  const pretty = (value: unknown) => JSON.stringify(value, null, 2)
  function selectCase(item: SafetyCase) {
    setState(item); setReviewer(item.assignedReviewer ?? ''); setNextAction(item.nextAction ?? ''); setDueOn(item.dueOn ?? '')
    setStatus(item.status === 'received' ? 'investigating' : item.status); setGraph(pretty(item.graph)); setClarification(item.clarificationRequest ?? '')
    setPrivateNote(''); setCitizenUpdate(''); setPrivacy(false)
    setPublication(pretty(item.publication?.draft ?? { id: crypto.randomUUID(), title: '', youRaised: '', weInvestigated: '', whatChanged: '', unresolved: [], decisionRationale: '', sources: [] }))
  }
  async function run(kind: 'case' | 'consultation', input: unknown) {
    setBusy(true); setError('')
    const generation = session.current
    try {
      const response = await fetch('/api/admin/civic-workbench', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ kind, input }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Workspace request failed.')
      if (session.current !== generation) return
      if (body.cases) { setCases(body.cases.map((item: unknown) => safetyCaseSchema.parse(item))); setCursor(body.nextCursor) }
      if (body.case) { const item = safetyCaseSchema.parse(body.case); selectCase(item); setCases(previous => previous.map(row => row.id === item.id ? item : row)) }
      if (body.consultations) setConsultations(body.consultations.map((item: unknown) => consultationSchema.parse(item)))
      if (body.consultation) { const item = consultationSchema.parse(body.consultation); selectConsultation(item); setConsultations(previous => [...previous.filter(row => row.id !== item.id), item]) }
    } catch (failure) { if (session.current === generation) setError(failure instanceof Error ? failure.message : 'Workspace unavailable.') }
    finally { if (session.current === generation) setBusy(false) }
  }
  function selectConsultation(item: Consultation) { setConsultation(item); setConsultationId(item.id); setPacket(pretty(item.packet)); setRationale(item.responseRationale ?? ''); setConsultationPrivacy(false) }
  function newConsultation() {
    setConsultation(null); setConsultationId(crypto.randomUUID()); setConsultationPrivacy(false); setRationale('')
    setPacket(pretty({ title: 'AI testing requirements — discussion draft', question: 'Which approach to testing AI systems should this platform investigate?', scope: 'Research consultation; this draft does not establish a legal requirement or forecast.',
      opensAt: new Date().toISOString(), closesAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      alternatives: [{ id: 'baseline', title: 'Existing practices', description: 'Document existing practices before proposing a new testing requirement.', benefits: ['Establishes a comparison baseline'], tradeoffs: ['May leave current evidence gaps unresolved'] },
        { id: 'independent-testing', title: 'Independent testing', description: 'Investigate independent testing for specified AI system uses.', benefits: ['May provide additional independent evidence'], tradeoffs: ['Testing costs and effectiveness need evidence'] }],
      evidence: [{ citation: 'OECD common AI incident-reporting framework (2025)', url: 'https://www.oecd.org/en/publications/towards-a-common-reporting-framework-for-ai-incidents_f326d4ac-en.html', publishedOn: '2025-02-28', checkedOn: null, contentDigest: null, verification: 'unreviewed-pointer' }],
      questions: ['What evidence would distinguish the alternatives?'], decisionCriteria: ['Evidence quality, feasibility, costs and effects on affected people'],
    }))
  }
  const mutate = (input: Record<string, unknown>) => run('case', { id: state!.id, expectedRevision: state!.revision, operationId: crypto.randomUUID(), ...input })
  return <div className={styles.dashboard}><section className={styles.panel}>
    <form className={styles.form} onSubmit={e => { e.preventDefault(); void run('case', { action: 'list' }) }}>
      <label htmlFor="review-token">Operator access token</label><input id="review-token" type="password" autoComplete="off" minLength={32} required value={token} onChange={e => setToken(e.target.value)} />
      <p className={styles.muted}>Use an approved operator credential. It stays in memory; never paste it into case notes, source links or public drafts. Reviewer labels are assignments, not proof of individual identity.</p>
      <button disabled={busy}>Open review inbox</button>
      <button className={styles.secondary} type="button" onClick={() => { session.current++; setBusy(false); setToken(''); setCases([]); setState(null); setConsultations([]); setConsultation(null); setConsultationId(''); setPacket(''); setPublication(''); setGraph(''); setPrivateNote(''); setCitizenUpdate(''); setClarification(''); setReviewer(''); setNextAction(''); setDueOn(''); setRationale(''); setCursor(null); setError('') }}>Lock workspace</button>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.columns}><div><h2>Private review inbox</h2>{cases.map(item => <article className={styles.result} key={item.id}><p>{item.id}</p><p>{item.status} · reviewer {item.assignedReviewer ?? 'unassigned'}</p><p>{item.submission?.concern ?? 'Withdrawn — content removed'}</p><button className={styles.secondary} onClick={() => selectCase(item)}>Review case {item.id.slice(0, 8)}</button></article>)}
      {cursor && <button disabled={busy} onClick={() => void run('case', { action: 'list', before: cursor })}>Next inbox page</button>}
    </div><div>{state && <><h2>Case review</h2><p className={styles.muted}>{state.id} · revision {state.revision}. Reload after a conflict before saving again.</p><button className={styles.secondary} disabled={busy} onClick={() => void run('case', { action: 'read', id: state.id })}>Reload selected case</button>
      {state.status === 'withdrawn' ? <p>This case has been withdrawn; its content cannot be restored here.</p> : <>
        <p><strong>Requested action:</strong> {state.submission?.requestedAction}</p>
        {state.submission?.consultationResponse && <div className={styles.result}><h3>Consultation response</h3><p>Alternative: {state.submission.consultationResponse.alternativeId}</p><p>Missing evidence: {state.submission.consultationResponse.missingEvidence}</p><p>Assumption challenge: {state.submission.consultationResponse.assumptionChallenge}</p></div>}
        {state.messages.map(message => <blockquote key={message.id}><span className={styles.sourceNote}>{message.visibility === 'operator' ? 'INTERNAL ONLY' : 'Citizen-visible'} · {message.author} · {message.at}</span>{message.text}</blockquote>)}
        <form className={styles.form} onSubmit={e => { e.preventDefault(); try { void mutate({ action: 'update', assignedReviewer: reviewer, nextAction, dueOn: dueOn || null, status, privateNote, citizenUpdate, clarificationRequest: clarification || null, graph: riskGraphSchema.parse(JSON.parse(graph)) }) } catch { setError('Check the graph JSON and its source metadata, node IDs and relationships.') } }}>
          <label htmlFor="assigned-reviewer">Assigned reviewer (citizen-visible alias)</label><input id="assigned-reviewer" maxLength={80} required value={reviewer} onChange={e => setReviewer(e.target.value)} />
          <label htmlFor="next-action">Next action (citizen-visible)</label><input id="next-action" required minLength={5} maxLength={1000} value={nextAction} onChange={e => setNextAction(e.target.value)} />
          <label htmlFor="next-due">Target date (optional)</label><input id="next-due" type="date" value={dueOn} onChange={e => setDueOn(e.target.value)} />
          <label htmlFor="case-status">Case status</label><select id="case-status" value={status} onChange={e => setStatus(e.target.value)}>{['investigating', 'awaiting-citizen', 'resolved', 'out-of-scope'].map(value => <option key={value}>{value}</option>)}</select>
          <label htmlFor="internal-note">Internal investigation note</label><textarea id="internal-note" maxLength={4000} value={privateNote} onChange={e => setPrivateNote(e.target.value)} />
          <label htmlFor="citizen-update">Status update for the citizen</label><textarea id="citizen-update" required minLength={5} maxLength={4000} value={citizenUpdate} onChange={e => setCitizenUpdate(e.target.value)} />
          <label htmlFor="clarification-request">Request for clarification (required for awaiting-citizen)</label><textarea id="clarification-request" maxLength={2000} value={clarification} onChange={e => setClarification(e.target.value)} />
          <label htmlFor="risk-graph-json">Evidence graph editor (JSON; visible to the citizen)</label><textarea id="risk-graph-json" rows={16} className={styles.codeInput} required value={graph} onChange={e => setGraph(e.target.value)} />
          <p className={styles.muted}>Add claim, source, system and question nodes. Link them with supports, challenges, affects or asks. Keep observations distinct from potential hazards. Sources need citation, URL, publication/check dates, verification and optional byte digest; use null for unknown dates or digest. Do not place internal notes in this graph.</p>
          <button disabled={busy}>Save investigation update</button>
        </form>
        <details className={styles.receipt}><summary>Inspect evidence relationships</summary><RiskEvidenceGraph graph={state.graph} /></details>
        <details className={styles.receipt}><summary>Prepare consented public summary</summary><form className={styles.form} onSubmit={e => { e.preventDefault(); try { void mutate({ action: 'draft-publication', draft: publicSummarySchema.parse(JSON.parse(publication)), privacyReviewed: privacy, privacyReviewer: reviewer }) } catch { setError('Complete the public summary JSON and privacy reviewer alias.') } }}>
          <label htmlFor="public-summary-json">Public summary draft (JSON)</label><textarea id="public-summary-json" rows={16} className={styles.codeInput} value={publication} onChange={e => { setPublication(e.target.value); setPrivacy(false) }} required />
          <label className={styles.consent}><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} />I reviewed this exact summary and its links for private information and safe publication.</label>
          <p className={styles.muted}>Saving a draft removes earlier publication and consent. The citizen must approve the exact new summary through private follow-up.</p><button disabled={busy}>Save summary for citizen consent</button>
        </form><p>{state.publication?.consentedDigest ? 'Citizen approved the current draft.' : 'Citizen approval is pending.'}</p>
          <button disabled={busy || !state.publication?.consentedDigest || !state.publication.privacyReviewed} onClick={() => void mutate({ action: 'publish' })}>Publish approved summary</button>
          <button className={styles.secondary} disabled={busy} onClick={() => void mutate({ action: 'unpublish' })}>Remove public summary</button>
        </details>
      </>}
    </>}</div></div>
  </section><section className={styles.panel}><h2>Structured consultations</h2>
    <button className={styles.secondary} disabled={busy} onClick={() => void run('consultation', { action: 'list' })}>Load consultations</button><button className={styles.secondary} onClick={newConsultation}>Prepare new discussion draft</button>
    <p className={styles.muted}>New discussion templates are drafts. Review the scope, sources, alternatives, questions and response dates before opening one.</p>
    {consultations.map(item => <button className={styles.secondary} key={item.id} onClick={() => selectConsultation(item)}>{item.packet.title} · {item.status}</button>)}
    {consultationId && <form className={styles.form} onSubmit={e => { e.preventDefault(); try { void run('consultation', { action: 'save-draft', id: consultationId, expectedRevision: consultation?.revision ?? 0, operationId: crypto.randomUUID(), packet: JSON.parse(packet) }) } catch { setError('Invalid consultation JSON.') } }}>
      <label htmlFor="consultation-packet">Question, alternatives and evidence packet (JSON)</label><textarea id="consultation-packet" className={styles.codeInput} rows={20} value={packet} readOnly={!!consultation && consultation.status !== 'draft'} onChange={e => setPacket(e.target.value)} />
      <button disabled={busy || (!!consultation && consultation.status !== 'draft')}>Save consultation draft</button>
      <label className={styles.consent}><input type="checkbox" checked={consultationPrivacy} onChange={e => setConsultationPrivacy(e.target.checked)} />I reviewed this public evidence packet and response rationale for privacy and accurate scope.</label>
      <button type="button" disabled={busy || !consultationPrivacy || consultation?.status !== 'draft'} onClick={() => void run('consultation', { action: 'open', id: consultation!.id, expectedRevision: consultation!.revision, operationId: crypto.randomUUID(), privacyReviewed: true })}>Open reviewed consultation</button>
      <label htmlFor="consultation-rationale">Public response rationale, unresolved issues and resulting decision</label><textarea id="consultation-rationale" minLength={10} maxLength={5000} value={rationale} onChange={e => { setRationale(e.target.value); setConsultationPrivacy(false) }} />
      <button type="button" disabled={busy || !consultationPrivacy || consultation?.status !== 'open' || rationale.trim().length < 10} onClick={() => void run('consultation', { action: 'close', id: consultation!.id, expectedRevision: consultation!.revision, operationId: crypto.randomUUID(), privacyReviewed: true, responseRationale: rationale })}>Close consultation and publish rationale</button>
    </form>}
  </section></div>
}
