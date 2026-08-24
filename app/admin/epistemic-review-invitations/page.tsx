'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'

import styles from '../epistemic-work-queue/work-queue.module.css'

type Scope = 'source-fidelity' | 'domain-fidelity' | 'boundary-adequacy' | 'rights-and-locator'
type PilotEntry = {
  recordId: string
  domainSlug: string
  title: string
  selectionRationale: string
  sourcePublicPath: string
  target: null | {
    origin: string
    reviewTargetSha256: string
    requiredReviewScopes: Scope[]
    reviewProgress: { scopes: Record<string, { status: string }> } | null
  }
}
type Invitation = {
  invitationId: string
  recordId: string
  domainSlug: string
  targetSha256: string
  scope: Scope
  reviewer: { reviewerId: string; profileVersion: number; displayName: string }
  note: string
  expiresAt: string
  createdAt: string
  status: 'active' | 'expired' | 'consumed' | 'revoked' | 'superseded-target'
}
type Workspace = {
  pilot: PilotEntry[]
  invitations: Invitation[]
  summary: { records: number; durableTargets: number; activeInvitations: number; completedInvitationReviews: number }
  boundary: string
}

export default function EpistemicReviewInvitationPage() {
  const [operationsToken, setOperationsToken] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [scope, setScope] = useState<Scope>('source-fidelity')
  const [reviewerId, setReviewerId] = useState('')
  const [profileVersion, setProfileVersion] = useState(1)
  const [displayName, setDisplayName] = useState('')
  const [qualifications, setQualifications] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [identityUrl, setIdentityUrl] = useState('')
  const [conflicts, setConflicts] = useState('')
  const [note, setNote] = useState('Please review the assigned scope against the frozen source record and record every material disagreement.')
  const [expiryDays, setExpiryDays] = useState(7)
  const [oneTimeToken, setOneTimeToken] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const selected = workspace?.pilot.find((entry) => entry.recordId === selectedRecordId) ?? null
  const invitations = useMemo(() => workspace?.invitations.filter((invitation) => !selectedRecordId || invitation.recordId === selectedRecordId) ?? [], [selectedRecordId, workspace])

  async function load(event?: FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setMessage('')
    setOneTimeToken('')
    try {
      const response = await fetch('/api/admin/epistemic-review-invitations', { headers: { Authorization: `Bearer ${operationsToken}` } })
      const body = await response.json() as Workspace & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The pilot workspace could not be loaded.')
      setWorkspace(body)
      const first = body.pilot.find((entry) => entry.target) ?? body.pilot[0]
      setSelectedRecordId((current) => body.pilot.some((entry) => entry.recordId === current) ? current : first?.recordId ?? '')
      if (first?.target?.requiredReviewScopes[0]) setScope(first.target.requiredReviewScopes[0])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The pilot workspace could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  function choose(entry: PilotEntry) {
    setSelectedRecordId(entry.recordId)
    setScope(entry.target?.requiredReviewScopes[0] ?? 'source-fidelity')
    setOneTimeToken('')
    setMessage('')
  }

  async function createInvitation() {
    if (!selected?.target) return
    setLoading(true)
    setMessage('')
    setOneTimeToken('')
    try {
      const response = await fetch('/api/admin/epistemic-review-invitations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${operationsToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'create',
          recordId: selected.recordId,
          domainSlug: selected.domainSlug,
          targetSha256: selected.target.reviewTargetSha256,
          scope,
          reviewer: {
            reviewerId,
            profileVersion,
            displayName,
            qualifications: qualifications.split('\n').map((value) => value.trim()).filter(Boolean),
            affiliation: affiliation.trim() || null,
            identityUrl: identityUrl.trim() || null,
            domains: [selected.domainSlug],
            conflicts: conflicts.split('\n').map((value) => value.trim()).filter(Boolean),
          },
          note,
          expiryDays,
          idempotencyKey: `epistemic-invitation:${crypto.randomUUID()}`,
        }),
      })
      const body = await response.json() as { token?: string | null; credentialReturnedOnce?: boolean; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The reviewer invitation could not be created.')
      if (!body.token) throw new Error('The idempotent invitation already exists. Its plaintext credential cannot be recovered; revoke it and issue a new invitation if necessary.')
      setOneTimeToken(body.token)
      setMessage('Invitation persisted. Copy the credential now: only its SHA-256 digest survives this response.')
      await loadWorkspaceWithoutClearingCredential()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The reviewer invitation could not be created.')
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkspaceWithoutClearingCredential() {
    const response = await fetch('/api/admin/epistemic-review-invitations', { headers: { Authorization: `Bearer ${operationsToken}` } })
    if (response.ok) setWorkspace(await response.json() as Workspace)
  }

  async function revoke(invitation: Invitation) {
    const reason = window.prompt('State why this invitation is being revoked. This is appended permanently.', 'Invitation revoked before review because the assignment or access window changed.')
    if (!reason) return
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/epistemic-review-invitations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${operationsToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'revoke', invitationId: invitation.invitationId, reason, idempotencyKey: `epistemic-invitation-revoke:${crypto.randomUUID()}` }),
      })
      const body = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The invitation could not be revoked.')
      setMessage('Invitation revoked through an append-only terminal event.')
      await loadWorkspaceWithoutClearingCredential()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The invitation could not be revoked.')
    } finally {
      setLoading(false)
    }
  }

  if (!workspace) return <main className={styles.page}><div className={styles.shell}><section className={`${styles.hero} ${styles.login}`}>
    <p className={styles.kicker}>Phase 4 · bounded reviewer access</p><h1 className={styles.title}>Invite one exact review.</h1>
    <p className={styles.lede}>Use the epistemic operations token. It remains in component memory only. Reviewer credentials are generated once, returned once, and never persisted in plaintext.</p>
    <form className="mt-7" onSubmit={load}><label className={styles.fieldLabel} htmlFor="operations-token">Epistemic operations token</label><input id="operations-token" className={styles.input} type="password" autoComplete="off" value={operationsToken} onChange={(event) => setOperationsToken(event.target.value)} /><button className={`${styles.button} mt-4`} disabled={loading || operationsToken.length < 32}>{loading ? 'Checking…' : 'Open pilot workspace'}</button></form>
    {message && <p className={styles.notice}>{message}</p>}
  </section></div></main>

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><p className={styles.kicker}>Phase 4 · canonical corpus operations</p><h1 className={styles.title}>Twenty records. One review at a time.</h1><p className={styles.lede}>The pilot freezes four records in each of five domains. Every credential binds one named reviewer profile version, one required scope, and one latest target digest. It carries no operations or release authority.</p><p className={styles.boundary}>{workspace.boundary}</p><div className="mt-6 flex flex-wrap gap-3"><Link className={styles.reviewLink} href="/admin/epistemic-work-queue">Source queue</Link><Link className={styles.reviewLink} href="/admin/epistemic-reingestion">Controlled compiler</Link><Link className={styles.reviewLink} href="/knowledge/epistemic-system/pilot-corpus">Public pilot manifest</Link></div></header>
    <section className={styles.stats}>{Object.entries(workspace.summary).map(([label, value]) => <article className={styles.stat} key={label}><p className={styles.kicker}>{label.replaceAll(/([A-Z])/g, ' $1')}</p><p className={styles.statValue}>{value}</p></article>)}</section>
    {message && <p className={styles.notice}>{message}</p>}
    {oneTimeToken && <section className={`${styles.panel} mt-6`}><p className={styles.kicker}>One-time credential · copy now</p><p className={`${styles.mono} mt-3`}>{oneTimeToken}</p><div className="mt-4 flex flex-wrap gap-3"><button className={styles.button} onClick={() => void navigator.clipboard.writeText(oneTimeToken)}>Copy credential</button><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => void navigator.clipboard.writeText(`${location.origin}/review/epistemic\n\nInvitation token: ${oneTimeToken}`)}>Copy reviewer handoff</button></div><p className={styles.boundary}>Closing or refreshing this page destroys this plaintext copy. Maha stores only its digest. Send it through a channel appropriate for the reviewer’s identity and your threat model.</p></section>}
    <div className={styles.workspace}>
      <section className={styles.panel}><p className={styles.kicker}>Bounded pilot corpus</p><div className={`${styles.list} mt-4`}>{workspace.pilot.map((entry) => <button key={entry.recordId} className={`${styles.item} ${entry.recordId === selectedRecordId ? styles.itemSelected : ''}`} onClick={() => choose(entry)}><strong>{entry.title}</strong><span className={styles.itemMeta}>{entry.domainSlug}<br />{entry.target?.reviewTargetSha256.slice(0, 28) ?? 'not durably ingested'}…</span><span className={styles.badges}><span className={`${styles.badge} ${entry.target ? styles.low : styles.critical}`}>{entry.target ? 'target ready' : 'target missing'}</span></span></button>)}</div></section>
      {selected && <section className={styles.panel}><p className={styles.kicker}>Invitation grant</p><h2 className={styles.sectionTitle}>{selected.title}</h2><p className={`${styles.mono} mt-3`}>{selected.recordId}<br />{selected.target?.reviewTargetSha256 ?? 'No durable target'}</p><p className="mt-4 text-sm leading-6 text-slate-600">{selected.selectionRationale}</p>
        <div className={`${styles.formGrid} mt-6`}><label><span className={styles.fieldLabel}>Review scope</span><select className={styles.select} value={scope} onChange={(event) => setScope(event.target.value as Scope)}>{(selected.target?.requiredReviewScopes ?? []).map((value) => <option key={value}>{value}</option>)}</select></label><label><span className={styles.fieldLabel}>Expires after days</span><input className={styles.input} type="number" min={1} max={30} value={expiryDays} onChange={(event) => setExpiryDays(Number(event.target.value))} /></label><label><span className={styles.fieldLabel}>Stable reviewer ID</span><input className={styles.input} value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} placeholder="expert_jane-doe" /></label><label><span className={styles.fieldLabel}>Profile version</span><input className={styles.input} type="number" min={1} value={profileVersion} onChange={(event) => setProfileVersion(Number(event.target.value))} /></label><label><span className={styles.fieldLabel}>Display name</span><input className={styles.input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label><span className={styles.fieldLabel}>Affiliation</span><input className={styles.input} value={affiliation} onChange={(event) => setAffiliation(event.target.value)} /></label></div>
        <label className="mt-4 block"><span className={styles.fieldLabel}>Qualifications · one per line</span><textarea className={styles.textarea} rows={4} value={qualifications} onChange={(event) => setQualifications(event.target.value)} /></label><label className="mt-4 block"><span className={styles.fieldLabel}>Identity URL · optional HTTPS</span><input className={styles.input} value={identityUrl} onChange={(event) => setIdentityUrl(event.target.value)} /></label><label className="mt-4 block"><span className={styles.fieldLabel}>Declared conflicts · one per line</span><textarea className={styles.textarea} rows={3} value={conflicts} onChange={(event) => setConflicts(event.target.value)} /></label><label className="mt-4 block"><span className={styles.fieldLabel}>Assignment note</span><textarea className={styles.textarea} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label><button className={`${styles.button} mt-6`} disabled={loading || !selected.target || reviewerId.length < 8 || displayName.trim().length < 2 || qualifications.trim().length < 2 || note.trim().length < 20} onClick={() => void createInvitation()}>{loading ? 'Persisting…' : 'Issue one-time invitation'}</button>
      </section>}
    </div>
    <section className={`${styles.panel} mt-6`}><p className={styles.kicker}>Invitation ledger</p><div className={`${styles.list} mt-4`}>{invitations.length ? invitations.map((invitation) => <article className={styles.item} key={invitation.invitationId}><strong>{invitation.reviewer.displayName} · {invitation.scope}</strong><span className={styles.itemMeta}>{invitation.invitationId}<br />expires {new Date(invitation.expiresAt).toLocaleString()}</span><span className={styles.badges}><span className={`${styles.badge} ${invitation.status === 'active' ? styles.normal : invitation.status === 'consumed' ? styles.low : styles.high}`}>{invitation.status}</span></span>{invitation.status === 'active' && <button className={`${styles.button} ${styles.buttonSecondary} mt-4`} onClick={() => void revoke(invitation)}>Revoke</button>}</article>) : <p className={styles.empty}>No invitations for this pilot record.</p>}</div></section>
  </div></main>
}
