'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'

import styles from '../epistemic-work-queue/work-queue.module.css'

type Approval = { scope: string; reviewId: string; reviewSha256: string; reviewedAt: string }
type Candidate = {
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  sourcePublicPath: string
  origin: string
  ready: boolean
  approvals: Approval[]
  blockers: string[]
  activeRelease: { releaseId: string; canonicalVersion: string; targetSha256: string; releasedAt: string } | null
}
type Release = {
  releaseId: string
  recordId: string
  canonicalPath: string
  canonicalVersion: string
  targetSha256: string
  status: 'active' | 'superseded' | 'withdrawn'
  releasedAt: string
}
type Workspace = {
  candidates: Candidate[]
  releases: Release[]
  withdrawals: unknown[]
  summary: { candidates: number; ready: number; active: number; superseded: number; withdrawn: number }
  boundary: string
}

const emptySummary = { candidates: 0, ready: 0, active: 0, superseded: 0, withdrawn: 0 }

export default function EpistemicReleaseControlPage() {
  const [token, setToken] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [canonicalVersion, setCanonicalVersion] = useState('1.0')
  const [authorityId, setAuthorityId] = useState('authority_maha-release')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('Release authority')
  const [authorizationBasis, setAuthorizationBasis] = useState('Authorized human release authority for Maha Strategies canonical knowledge publication.')
  const [publicAttribution, setPublicAttribution] = useState(false)
  const [publicChangeSummary, setPublicChangeSummary] = useState('')
  const [rationale, setRationale] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const selected = workspace?.candidates.find((candidate) => candidate.recordId === selectedId) ?? null
  const activeReleases = useMemo(() => workspace?.releases.filter((release) => release.status === 'active') ?? [], [workspace])

  async function load(event?: FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/epistemic-releases', { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json() as Workspace & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Release workspace could not be loaded.')
      setWorkspace(body)
      const firstReady = body.candidates.find((candidate) => candidate.ready)
      setSelectedId((current) => body.candidates.some((candidate) => candidate.recordId === current) ? current : firstReady?.recordId ?? body.candidates[0]?.recordId ?? '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Release workspace could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  function authority() {
    return { authorityId, displayName, role, authorizationBasis, publicAttribution }
  }

  async function submit(operation: 'preview' | 'publish') {
    if (!selected) return
    if (operation === 'publish' && !confirmed) {
      setMessage('Confirm the human release-authority statement before publishing.')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/epistemic-releases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          recordId: selected.recordId,
          targetSha256: selected.targetSha256,
          canonicalVersion,
          supersedesReleaseId: selected.activeRelease?.releaseId ?? null,
          authority: authority(),
          publicChangeSummary,
          rationale,
          idempotencyKey: `epistemic-release:${operation}:${crypto.randomUUID()}`,
        }),
      })
      const body = await response.json() as { preview?: Record<string, unknown>; release?: Record<string, unknown>; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Release operation failed.')
      setPreview(body.preview ?? body.release ?? null)
      setMessage(operation === 'preview' ? 'Preview compiled without persistence.' : 'Canonical release persisted. The public projection will now expose the active record.')
      if (operation === 'publish') {
        setConfirmed(false)
        await load()
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Release operation failed.')
    } finally {
      setLoading(false)
    }
  }

  async function withdraw(release: Release) {
    if (!confirmed) {
      setMessage('Confirm the human release-authority statement before withdrawing a canonical release.')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/epistemic-releases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'withdraw',
          releaseId: release.releaseId,
          authority: authority(),
          publicChangeSummary,
          rationale,
          idempotencyKey: `epistemic-withdrawal:${crypto.randomUUID()}`,
        }),
      })
      const body = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Withdrawal failed.')
      setMessage('Withdrawal persisted. The release remains in public history but is no longer canonical.')
      setConfirmed(false)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Withdrawal failed.')
    } finally {
      setLoading(false)
    }
  }

  if (!workspace) return (
    <main className={styles.page}><div className={styles.shell}><section className={`${styles.hero} ${styles.login}`}>
      <p className={styles.kicker}>Phase 3 · separate release authority</p><h1 className={styles.title}>Canonical release control.</h1>
      <p className={styles.lede}>Use the dedicated release-authority credential. The operations token is deliberately rejected here, and this credential is never written to browser storage.</p>
      <form className="mt-7" onSubmit={load}><label className={styles.fieldLabel} htmlFor="release-token">Release-authority token</label><input id="release-token" className={styles.input} type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /><button className={`${styles.button} mt-4`} disabled={loading || token.length < 32}>{loading ? 'Checking…' : 'Open release control'}</button></form>
      {message && <p className={styles.notice}>{message}</p>}
    </section></div></main>
  )

  return (
    <main className={styles.page}><div className={styles.shell}>
      <header className={styles.hero}><p className={styles.kicker}>Phase 3 · approvals → canonical release</p><h1 className={styles.title}>Publish one exact hash.</h1><p className={styles.lede}>The release compiler accepts only the latest frozen target, the latest unqualified decision for every required expert scope, and a separately authenticated human authority. Supersession and withdrawal append history; neither erases it.</p><p className={styles.boundary}>{workspace.boundary}</p><div className="mt-6 flex flex-wrap gap-3"><Link className={styles.reviewLink} href="/admin/epistemic-reingestion">Controlled compiler</Link><Link className={styles.reviewLink} href="/admin/epistemic-ingestion">Expert reviews</Link><Link className={styles.reviewLink} href="/knowledge/epistemic-system/releases">Public release ledger</Link></div></header>

      <section className={styles.stats}>{Object.entries(workspace.summary ?? emptySummary).map(([label, value]) => <article className={styles.stat} key={label}><p className={styles.kicker}>{label}</p><p className={styles.statValue}>{value}</p></article>)}</section>
      {message && <p className={styles.notice}>{message}</p>}

      <div className={styles.workspace}>
        <section className={styles.panel}><p className={styles.kicker}>Frozen targets</p><div className={`${styles.list} mt-4`}>{workspace.candidates.map((candidate) => <button key={candidate.recordId} className={`${styles.item} ${candidate.recordId === selectedId ? styles.itemSelected : ''}`} onClick={() => { setSelectedId(candidate.recordId); setPreview(null); setConfirmed(false) }}><strong>{candidate.title}</strong><span className={styles.itemMeta}>{candidate.domainSlug} · {candidate.origin}<br />{candidate.targetSha256.slice(0, 28)}…</span><span className={styles.badges}><span className={`${styles.badge} ${candidate.ready ? styles.low : styles.high}`}>{candidate.ready ? 'release ready' : `${candidate.blockers.length} blockers`}</span>{candidate.activeRelease && <span className={`${styles.badge} ${styles.normal}`}>supersedes {candidate.activeRelease.canonicalVersion}</span>}</span></button>)}</div></section>

        {selected ? <section className={styles.panel}><p className={styles.kicker}>Exact-hash release decision</p><h2 className={styles.sectionTitle}>{selected.title}</h2><p className={`${styles.mono} mt-3`}>{selected.recordId}<br />{selected.targetSha256}</p>
          <div className={styles.badges}><span className={`${styles.badge} ${selected.ready ? styles.low : styles.critical}`}>{selected.ready ? 'all scoped reviews approved' : 'withheld'}</span><span className={`${styles.badge} ${styles.normal}`}>{selected.approvals.length} exact approvals</span></div>
          {!selected.ready && <div className={`${styles.blockerGrid} mt-5`}>{selected.blockers.map((blocker) => <div className={styles.blocker} key={blocker}><span className={styles.mono}>{blocker}</span></div>)}</div>}
          <div className={`${styles.formGrid} mt-6`}><label><span className={styles.fieldLabel}>Canonical version</span><input className={styles.input} value={canonicalVersion} onChange={(event) => setCanonicalVersion(event.target.value)} /></label><label><span className={styles.fieldLabel}>Authority ID</span><input className={styles.input} value={authorityId} onChange={(event) => setAuthorityId(event.target.value)} /></label><label><span className={styles.fieldLabel}>Authority display name</span><input className={styles.input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label><span className={styles.fieldLabel}>Authority role</span><input className={styles.input} value={role} onChange={(event) => setRole(event.target.value)} /></label></div>
          <label className="mt-4 block"><span className={styles.fieldLabel}>Authorization basis</span><textarea className={styles.textarea} rows={3} value={authorizationBasis} onChange={(event) => setAuthorizationBasis(event.target.value)} /></label><label className="mt-4 block"><span className={styles.fieldLabel}>Public change summary</span><textarea className={styles.textarea} rows={3} value={publicChangeSummary} onChange={(event) => setPublicChangeSummary(event.target.value)} placeholder="Public-safe summary only. Do not include participant, natal, credential, or private reviewer data." /></label><label className="mt-4 block"><span className={styles.fieldLabel}>Internal release or withdrawal rationale</span><textarea className={styles.textarea} rows={5} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Explain why this exact target should become canonical, or why an active release must be withdrawn. This internal field is not published." /></label>
          <div className="mt-4 space-y-3"><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={publicAttribution} onChange={(event) => setPublicAttribution(event.target.checked)} /><span>Publish my authority name and role. If unchecked, the public bundle exposes only the authority snapshot hash.</span></label><label className="flex items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I am the authorized human release authority and accept responsibility for this publication-state decision. This is not a claim of scientific truth.</span></label></div>
          <div className="mt-6 flex flex-wrap gap-3"><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading || !selected.ready || publicChangeSummary.trim().length < 20 || rationale.trim().length < 40 || displayName.trim().length < 2} onClick={() => void submit('preview')}>Preview immutable release</button><button className={styles.button} disabled={loading || !selected.ready || !confirmed || publicChangeSummary.trim().length < 20 || rationale.trim().length < 40 || displayName.trim().length < 2} onClick={() => void submit('publish')}>{selected.activeRelease ? 'Publish superseding version' : 'Publish canonical version'}</button></div>
          {preview && <section className={`${styles.evidence} mt-6`}><p className={styles.kicker}>Compiled release artifact</p><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(preview, null, 2)}</pre></section>}
        </section> : <section className={styles.panel}><p className={styles.empty}>Select a frozen target.</p></section>}
      </div>

      <section className={`${styles.panel} mt-8`}><p className={styles.kicker}>Active canonical releases</p><p className={styles.lede}>Withdrawal requires the same release-authority identity, public-safe summary, internal rationale, and explicit confirmation above. History remains public and immutable.</p><div className="mt-5 grid gap-3">{activeReleases.map((release) => <article className={styles.item} key={release.releaseId}><strong>{release.canonicalPath}</strong><span className={styles.itemMeta}>{release.releaseId} · version {release.canonicalVersion} · {new Date(release.releasedAt).toLocaleString()}</span><button className={`${styles.button} ${styles.buttonSecondary} mt-4`} disabled={loading || !confirmed || publicChangeSummary.trim().length < 20 || rationale.trim().length < 40 || displayName.trim().length < 2} onClick={() => void withdraw(release)}>Withdraw active release</button></article>)}{!activeReleases.length && <p className={styles.empty}>No active database-backed canonical releases yet.</p>}</div></section>
    </div></main>
  )
}
