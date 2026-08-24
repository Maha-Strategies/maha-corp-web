'use client'

import { useMemo, useState } from 'react'

import styles from './work-queue.module.css'

type Priority = 'critical' | 'high' | 'normal' | 'low'
type SourceState = 'untriaged' | 'queued' | 'assigned' | 'in-progress' | 'ready-for-reingestion' | 'closed'
type SourceItem = {
  lane: 'source-completion'
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  sourcePublicPath: string
  priority: Priority
  state: SourceState
  blockers: Array<{ code: string; category: string; label: string; priority: Priority }>
  assignee: { id: string; name: string } | null
  evidenceCount: number
  lastEventAt: string | null
}
type ExpertItem = {
  lane: 'expert-review'
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  sourcePublicPath: string
  scope: string
  status: 'missing' | 'stale' | 'abstained' | 'changes-requested'
  priority: Priority
  latestReviewId: string | null
  reviewedAt: string | null
}
type Queue = {
  sourceCompletion: SourceItem[]
  expertReview: ExpertItem[]
  summary: {
    sourceRecords: number
    untriaged: number
    active: number
    readyForReingestion: number
    expertScopes: number
    expertChangesRequested: number
    expertStale: number
  }
}
type EvidenceDraft = { sourceUrl: string; exactLocator: string; proposedValue: string; note: string; rightsBasis: string }

const actionMap: Record<SourceState, Array<{ value: string; label: string }>> = {
  untriaged: [{ value: 'triage', label: 'Add to queue' }],
  queued: [{ value: 'assign', label: 'Assign' }, { value: 'start', label: 'Start work' }],
  assigned: [{ value: 'start', label: 'Start work' }, { value: 'submit-evidence', label: 'Submit evidence' }, { value: 'assign', label: 'Reassign' }],
  'in-progress': [{ value: 'submit-evidence', label: 'Submit evidence' }, { value: 'assign', label: 'Reassign' }],
  'ready-for-reingestion': [{ value: 'return', label: 'Return for changes' }, { value: 'close', label: 'Close superseded target' }],
  closed: [],
}

const initialSummary: Queue['summary'] = { sourceRecords: 0, untriaged: 0, active: 0, readyForReingestion: 0, expertScopes: 0, expertChangesRequested: 0, expertStale: 0 }

function priorityClass(priority: Priority) {
  return `${styles.badge} ${styles[priority]}`
}

export default function EpistemicWorkQueuePage() {
  const [token, setToken] = useState('')
  const [queue, setQueue] = useState<Queue>({ sourceCompletion: [], expertReview: [], summary: initialSummary })
  const [unlocked, setUnlocked] = useState(false)
  const [lane, setLane] = useState<'source' | 'expert'>('source')
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('all')
  const [status, setStatus] = useState('all')
  const [selectedSourceKey, setSelectedSourceKey] = useState('')
  const [selectedExpertKey, setSelectedExpertKey] = useState('')
  const [action, setAction] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [assigneeName, setAssigneeName] = useState('')
  const [note, setNote] = useState('')
  const [selectedBlockers, setSelectedBlockers] = useState<string[]>([])
  const [evidence, setEvidence] = useState<Record<string, EvidenceDraft>>({})
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const domains = useMemo(() => [...new Set([...queue.sourceCompletion, ...queue.expertReview].map((item) => item.domainSlug))].sort(), [queue])
  const selectedSource = queue.sourceCompletion.find((item) => `${item.recordId}:${item.targetSha256}` === selectedSourceKey) ?? null
  const selectedExpert = queue.expertReview.find((item) => `${item.recordId}:${item.targetSha256}:${item.scope}` === selectedExpertKey) ?? null
  const sourceItems = useMemo(() => queue.sourceCompletion.filter((item) => {
    const query = search.trim().toLowerCase()
    return (domain === 'all' || item.domainSlug === domain)
      && (status === 'all' || item.state === status)
      && (!query || `${item.title} ${item.recordId} ${item.blockers.map((blocker) => blocker.label).join(' ')}`.toLowerCase().includes(query))
  }), [domain, queue.sourceCompletion, search, status])
  const expertItems = useMemo(() => queue.expertReview.filter((item) => {
    const query = search.trim().toLowerCase()
    return (domain === 'all' || item.domainSlug === domain)
      && (status === 'all' || item.status === status)
      && (!query || `${item.title} ${item.recordId} ${item.scope}`.toLowerCase().includes(query))
  }), [domain, queue.expertReview, search, status])

  async function load(preserveNotice = false) {
    setLoading(true)
    if (!preserveNotice) setNotice('')
    try {
      const response = await fetch('/api/admin/epistemic-work-queue', { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json() as Queue & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The Phase 2 queue is unavailable.')
      setQueue(body)
      setUnlocked(true)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The Phase 2 queue is unavailable.')
    } finally { setLoading(false) }
  }

  function chooseSource(item: SourceItem) {
    setSelectedSourceKey(`${item.recordId}:${item.targetSha256}`)
    setAction(actionMap[item.state][0]?.value ?? '')
    setAssigneeId(item.assignee?.id ?? '')
    setAssigneeName(item.assignee?.name ?? '')
    setSelectedBlockers(item.blockers.map((blocker) => blocker.code))
    setEvidence(Object.fromEntries(item.blockers.map((blocker) => [blocker.code, { sourceUrl: '', exactLocator: '', proposedValue: '', note: '', rightsBasis: '' }])))
    setNote('')
  }

  async function submitEvent() {
    if (!selectedSource || !action) return
    setLoading(true); setNotice('')
    try {
      const evidenceRows = action === 'submit-evidence' ? selectedBlockers.map((blockerCode) => ({ blockerCode, ...evidence[blockerCode] })) : []
      const response = await fetch('/api/admin/epistemic-work-queue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: selectedSource.recordId,
          targetSha256: selectedSource.targetSha256,
          action,
          blockerCodes: selectedBlockers,
          assigneeId: assigneeId || null,
          assigneeName: assigneeName || null,
          evidence: evidenceRows,
          note,
          idempotencyKey: `epistemic-work:${crypto.randomUUID()}`,
        }),
      })
      const body = await response.json() as { queue?: Queue; event?: { nextState?: string }; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The queue event could not be recorded.')
      if (body.queue) setQueue(body.queue)
      setNotice(`Immutable event recorded. This target is now ${body.event?.nextState?.replaceAll('-', ' ') ?? 'updated'}; no public page was changed.`)
      setSelectedSourceKey('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The queue event could not be recorded.')
    } finally { setLoading(false) }
  }

  if (!unlocked) return <main className={styles.page}><div className={`${styles.shell} ${styles.login}`}><section className={styles.hero}><p className={styles.kicker}>Phase 2 · private operations</p><h1 className={styles.title}>Open the work queue.</h1><p className={styles.lede}>Triage source gaps and route frozen targets into qualified expert review. The operations token stays in component memory and is never written to browser storage.</p><label className={`${styles.fieldLabel} mt-8`} htmlFor="queue-token">Epistemic operations token</label><input id="queue-token" type="password" className={styles.input} value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} /><button className={`${styles.button} mt-4 w-full`} disabled={!token || loading} onClick={() => void load()}>{loading ? 'Opening…' : 'Open Phase 2 queue'}</button>{notice && <p className={styles.notice}>{notice}</p>}</section></div></main>

  const statEntries = [
    ['Source records', queue.summary.sourceRecords], ['Untriaged', queue.summary.untriaged], ['Active', queue.summary.active],
    ['Ready to re-ingest', queue.summary.readyForReingestion], ['Review scopes', queue.summary.expertScopes],
    ['Changes requested', queue.summary.expertChangesRequested], ['Stale reviews', queue.summary.expertStale],
  ] as const

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><p className={styles.kicker}>Phase 2 · source completion + expert review</p><h1 className={styles.title}>Turn withheld records into reviewable evidence.</h1><p className={styles.lede}>The queue exposes the exact work between durable ingestion and a future source-controlled release: complete missing evidence, bind it to the frozen target, re-ingest corrected content, then route every required scope to a qualified reviewer.</p><p className={styles.boundary}>Queue evidence is a proposal, not a correction to the candidate. It cannot satisfy the publication gate until the source record is revised, re-ingested under a new hash and independently reviewed.</p></header>
    {notice && <p className={styles.notice}>{notice}</p>}
    <section className={styles.stats} aria-label="Queue summary">{statEntries.map(([label, value]) => <article className={styles.stat} key={label}><p className={styles.kicker}>{label}</p><p className={styles.statValue}>{value}</p></article>)}</section>
    <div className={styles.tabs}><button className={`${styles.tab} ${lane === 'source' ? styles.tabActive : ''}`} onClick={() => { setLane('source'); setStatus('all') }}>Source completion · {queue.sourceCompletion.length}</button><button className={`${styles.tab} ${lane === 'expert' ? styles.tabActive : ''}`} onClick={() => { setLane('expert'); setStatus('all') }}>Expert review · {queue.expertReview.length}</button></div>
    <section className={styles.toolbar} aria-label="Queue filters"><label><span className={styles.fieldLabel}>Search</span><input className={styles.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, URN or blocker" /></label><label><span className={styles.fieldLabel}>Domain</span><select className={styles.select} value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">All domains</option>{domains.map((value) => <option key={value}>{value}</option>)}</select></label><label><span className={styles.fieldLabel}>Status</span><select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set((lane === 'source' ? queue.sourceCompletion.map((item) => item.state) : queue.expertReview.map((item) => item.status)))].map((value) => <option key={value}>{value.replaceAll('-', ' ')}</option>)}</select></label><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button></section>
    <section className={styles.workspace}>
      <aside className={styles.panel}><p className={styles.kicker}>{lane === 'source' ? 'Source records' : 'Review scopes'}</p><div className={`${styles.list} mt-4`}>{lane === 'source' ? sourceItems.map((item) => <button key={`${item.recordId}:${item.targetSha256}`} className={`${styles.item} ${selectedSourceKey === `${item.recordId}:${item.targetSha256}` ? styles.itemSelected : ''}`} onClick={() => chooseSource(item)}><strong>{item.title}</strong><span className={styles.itemMeta}>{item.domainSlug} · {item.state.replaceAll('-', ' ')} · {item.blockers.length} blockers</span><span className={styles.badges}><span className={priorityClass(item.priority)}>{item.priority}</span>{item.assignee && <span className={`${styles.badge} ${styles.low}`}>{item.assignee.name}</span>}</span></button>) : expertItems.map((item) => <button key={`${item.recordId}:${item.targetSha256}:${item.scope}`} className={`${styles.item} ${selectedExpertKey === `${item.recordId}:${item.targetSha256}:${item.scope}` ? styles.itemSelected : ''}`} onClick={() => setSelectedExpertKey(`${item.recordId}:${item.targetSha256}:${item.scope}`)}><strong>{item.title}</strong><span className={styles.itemMeta}>{item.domainSlug} · {item.scope.replaceAll('-', ' ')}</span><span className={styles.badges}><span className={priorityClass(item.priority)}>{item.status.replaceAll('-', ' ')}</span></span></button>)}{(lane === 'source' ? !sourceItems.length : !expertItems.length) && <p className={styles.empty}>No queue records match these filters.</p>}</div></aside>
      <div className={styles.detailGrid}>{lane === 'source' ? selectedSource ? <>
        <section className={styles.panel}><p className={styles.kicker}>Frozen source target</p><h2 className={styles.sectionTitle}>{selectedSource.title}</h2><p className={`${styles.mono} mt-3`}>{selectedSource.recordId}<br />{selectedSource.targetSha256}</p><div className={styles.badges}><span className={priorityClass(selectedSource.priority)}>{selectedSource.priority}</span><span className={`${styles.badge} ${styles.normal}`}>{selectedSource.state.replaceAll('-', ' ')}</span><span className={`${styles.badge} ${styles.low}`}>{selectedSource.evidenceCount} evidence rows</span></div><div className="flex flex-wrap gap-3"><a className={styles.reviewLink} href={selectedSource.sourcePublicPath}>Inspect legacy source page</a>{selectedSource.state === 'ready-for-reingestion' && <a className={styles.reviewLink} href="/admin/epistemic-reingestion">Open controlled compiler</a>}</div></section>
        <section className={styles.panel}><p className={styles.kicker}>Exact blockers</p><div className={styles.blockerGrid}>{selectedSource.blockers.map((blocker) => <label className={styles.blocker} key={blocker.code}><input type="checkbox" checked={selectedBlockers.includes(blocker.code)} onChange={(event) => setSelectedBlockers(event.target.checked ? [...selectedBlockers, blocker.code] : selectedBlockers.filter((value) => value !== blocker.code))} /><span><strong>{blocker.label}</strong><span className={styles.itemMeta}>{blocker.category} · {blocker.priority}</span></span></label>)}</div></section>
        <section className={styles.panel}><p className={styles.kicker}>Append-only workflow event</p><div className={`${styles.formGrid} mt-4`}><label><span className={styles.fieldLabel}>Action</span><select className={styles.select} value={action} onChange={(event) => setAction(event.target.value)}>{actionMap[selectedSource.state].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span className={styles.fieldLabel}>Assignee ID</span><input className={styles.input} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} placeholder="researcher_name" /></label><label><span className={styles.fieldLabel}>Assignee name</span><input className={styles.input} value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} placeholder="Qualified researcher" /></label></div>{action === 'submit-evidence' && <div className="mt-5 space-y-3">{selectedBlockers.map((blocker) => <div className={styles.evidence} key={blocker}><p className={styles.mono}>{blocker}</p><div className={`${styles.formGrid} mt-3`}><label><span className={styles.fieldLabel}>Source URL</span><input className={styles.input} value={evidence[blocker]?.sourceUrl ?? ''} onChange={(event) => setEvidence({ ...evidence, [blocker]: { ...evidence[blocker], sourceUrl: event.target.value } })} placeholder="https://…" /></label><label><span className={styles.fieldLabel}>Exact locator</span><input className={styles.input} value={evidence[blocker]?.exactLocator ?? ''} onChange={(event) => setEvidence({ ...evidence, [blocker]: { ...evidence[blocker], exactLocator: event.target.value } })} placeholder="Page, clause, figure or dataset row" /></label><label><span className={styles.fieldLabel}>Proposed field value</span><input className={styles.input} value={evidence[blocker]?.proposedValue ?? ''} onChange={(event) => setEvidence({ ...evidence, [blocker]: { ...evidence[blocker], proposedValue: event.target.value } })} placeholder="YYYY-MM-DD, evidence maturity, or exact replacement" /></label><label><span className={styles.fieldLabel}>Rights basis</span><input className={styles.input} value={evidence[blocker]?.rightsBasis ?? ''} onChange={(event) => setEvidence({ ...evidence, [blocker]: { ...evidence[blocker], rightsBasis: event.target.value } })} placeholder="public-domain, licensed…" /></label><label><span className={styles.fieldLabel}>Evidence note</span><textarea className={styles.textarea} value={evidence[blocker]?.note ?? ''} onChange={(event) => setEvidence({ ...evidence, [blocker]: { ...evidence[blocker], note: event.target.value } })} rows={3} /></label></div></div>)}</div>}<label className="mt-5 block"><span className={styles.fieldLabel}>Event rationale</span><textarea className={styles.textarea} value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Explain the assignment, evidence submission, return or closure without claiming publication approval." /></label><button className={`${styles.button} mt-4`} disabled={loading || !action || selectedBlockers.length === 0 || note.trim().length < 20} onClick={() => void submitEvent()}>{loading ? 'Recording…' : 'Record immutable event'}</button></section>
      </> : <section className={styles.panel}><p className={styles.empty}>Select a source-completion record to inspect its blockers and record the next event.</p></section> : selectedExpert ? <section className={styles.panel}><p className={styles.kicker}>Qualified expert review</p><h2 className={styles.sectionTitle}>{selectedExpert.title}</h2><p className={`${styles.mono} mt-3`}>{selectedExpert.recordId}<br />{selectedExpert.targetSha256}</p><div className={styles.badges}><span className={priorityClass(selectedExpert.priority)}>{selectedExpert.status.replaceAll('-', ' ')}</span><span className={`${styles.badge} ${styles.normal}`}>{selectedExpert.scope.replaceAll('-', ' ')}</span></div><p className={styles.lede}>This queue item requires a decision limited to one published scope and this exact frozen digest. Reviewer identity, qualifications, conflicts, verdict and rationale remain versioned.</p><a className={styles.reviewLink} href={`/admin/epistemic-ingestion?record=${encodeURIComponent(selectedExpert.recordId)}&scope=${encodeURIComponent(selectedExpert.scope)}`}>Open scoped review workspace</a></section> : <section className={styles.panel}><p className={styles.empty}>Select a review scope to inspect its frozen target and open the decision workspace.</p></section>}</div>
    </section>
  </div></main>
}
