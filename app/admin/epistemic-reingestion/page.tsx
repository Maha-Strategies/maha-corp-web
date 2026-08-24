'use client'

import { useMemo, useState } from 'react'

import styles from '../epistemic-work-queue/work-queue.module.css'

type EvidenceOption = {
  eventId: string
  eventSha256: string
  occurredAt: string
  sourceUrl: string
  exactLocator: string | null
  proposedValue: string | null
  note: string
  rightsBasis: string | null
}

type Correction = {
  blockerCode: string
  kind: 'source-exact-locator' | 'source-publication-date' | 'claim-evidence-maturity'
  entityType: 'source' | 'claim'
  entityId: string
  fieldPath: string
  fieldLabel: string
  inputKind: 'text' | 'date' | 'select'
  options: string[]
  currentValue: string
  evidenceOptions: EvidenceOption[]
}

type ReadyTarget = {
  recordId: string
  domainSlug: string
  title: string
  sourcePublicPath: string
  candidateSha256: string
  targetSha256: string
  origin: 'ingestion' | 'reingestion'
  gateReasons: string[]
  corrections: Correction[]
  unsupportedSourceBlockers: string[]
}

type Compilation = {
  compilationId: string
  recordId: string
  domainSlug: string
  baseTargetSha256: string
  outputCandidateSha256: string
  outputReviewTargetSha256: string
  resolvedBlockerCodes: string[]
  remainingSourceBlockerCodes: string[]
  diff: Array<{ path: string; before: string; after: string }>
  gateDecision: { publicEligible: boolean; reasons: string[] }
  compiledAt: string
  note: string
}

type Workspace = {
  readyTargets: ReadyTarget[]
  recentCompilations: Compilation[]
  summary: { readyTargets: number; supportedCorrections: number; immutableRevisions: number }
}

type CorrectionDraft = { included: boolean; evidenceEventId: string; proposedValue: string }

const emptyWorkspace: Workspace = {
  readyTargets: [],
  recentCompilations: [],
  summary: { readyTargets: 0, supportedCorrections: 0, immutableRevisions: 0 },
}

function suggestedValue(correction: Correction, evidence: EvidenceOption): string {
  return evidence.proposedValue
    ?? (correction.kind === 'source-exact-locator' ? evidence.exactLocator : null)
    ?? (correction.inputKind === 'select' ? correction.options[0] : '')
    ?? ''
}

export default function EpistemicReingestionPage() {
  const [token, setToken] = useState('')
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace)
  const [unlocked, setUnlocked] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')
  const [drafts, setDrafts] = useState<Record<string, CorrectionDraft>>({})
  const [note, setNote] = useState('Compile the completed source work into a new frozen candidate for independent expert review.')
  const [preview, setPreview] = useState<Compilation | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const selected = workspace.readyTargets.find((target) => `${target.recordId}:${target.targetSha256}` === selectedKey) ?? null
  const visibleTargets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return workspace.readyTargets.filter((target) => !query || `${target.title} ${target.domainSlug} ${target.recordId}`.toLowerCase().includes(query))
  }, [search, workspace.readyTargets])

  async function load(keepNotice = false) {
    setLoading(true)
    if (!keepNotice) setNotice('')
    try {
      const response = await fetch('/api/admin/epistemic-reingestion', { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json() as Workspace & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The controlled compiler is unavailable.')
      setWorkspace(body)
      setUnlocked(true)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The controlled compiler is unavailable.')
    } finally { setLoading(false) }
  }

  function choose(target: ReadyTarget) {
    setSelectedKey(`${target.recordId}:${target.targetSha256}`)
    setPreview(null)
    setDrafts(Object.fromEntries(target.corrections.map((correction) => {
      const evidence = correction.evidenceOptions.at(-1)!
      return [correction.blockerCode, {
        included: true,
        evidenceEventId: evidence.eventId,
        proposedValue: suggestedValue(correction, evidence),
      }]
    })))
  }

  function buildRequest(operation: 'preview' | 'compile') {
    if (!selected) throw new Error('Select a frozen target first.')
    const corrections = selected.corrections.flatMap((correction) => {
      const draft = drafts[correction.blockerCode]
      return draft?.included ? [{ blockerCode: correction.blockerCode, evidenceEventId: draft.evidenceEventId, proposedValue: draft.proposedValue }] : []
    })
    if (!corrections.length) throw new Error('Select at least one evidence-bound correction.')
    return {
      operation,
      recordId: selected.recordId,
      baseTargetSha256: selected.targetSha256,
      corrections,
      note,
      idempotencyKey: `epistemic-reingestion:${crypto.randomUUID()}`,
    }
  }

  async function run(operation: 'preview' | 'compile') {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/epistemic-reingestion', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequest(operation)),
      })
      const body = await response.json() as { preview?: Compilation; compilation?: Compilation; persisted?: boolean; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'The controlled compilation failed.')
      const result = body.preview ?? body.compilation ?? null
      setPreview(result)
      if (operation === 'compile' && result) {
        setNotice(`Immutable revision ${result.compilationId} created. It is a new draft review target; no public page was changed.`)
        setSelectedKey('')
        await load(true)
      } else {
        setNotice('Preview compiled from the frozen target and evidence ledger. Nothing has been persisted.')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The controlled compilation failed.')
    } finally { setLoading(false) }
  }

  if (!unlocked) return <main className={styles.page}><div className={`${styles.shell} ${styles.login}`}><section className={styles.hero}><p className={styles.kicker}>Phase 2 · controlled compiler</p><h1 className={styles.title}>Open re-ingestion.</h1><p className={styles.lede}>Compile completed source evidence into a new frozen candidate. The operations token stays in component memory and is never written to browser storage.</p><label className={`${styles.fieldLabel} mt-8`} htmlFor="reingestion-token">Epistemic operations token</label><input id="reingestion-token" type="password" className={styles.input} value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} /><button className={`${styles.button} mt-4 w-full`} disabled={!token || loading} onClick={() => void load()}>{loading ? 'Opening…' : 'Open controlled compiler'}</button>{notice && <p className={styles.notice}>{notice}</p>}</section></div></main>

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><p className={styles.kicker}>Phase 2 · evidence → immutable revision</p><h1 className={styles.title}>Compile without silent mutation.</h1><p className={styles.lede}>Every allowed field is derived from an exact gate blocker. Every proposed value binds a prior submit-evidence event. The output receives a new digest, returns to draft and requires fresh scoped review.</p><p className={styles.boundary}>This compiler cannot edit arbitrary JSON, preserve old approvals, request public promotion or publish a route. Preview and compilation both fail closed when the target, blocker, evidence event or proposed value disagree.</p><div className="mt-6 flex flex-wrap gap-3"><a className={styles.reviewLink} href="/admin/epistemic-work-queue">Back to source queue</a><a className={styles.reviewLink} href="/admin/epistemic-ingestion">Open review workspace</a></div></header>
    {notice && <p className={styles.notice}>{notice}</p>}
    <section className={styles.stats} aria-label="Compiler summary"><article className={styles.stat}><p className={styles.kicker}>Ready targets</p><p className={styles.statValue}>{workspace.summary.readyTargets}</p></article><article className={styles.stat}><p className={styles.kicker}>Bound corrections</p><p className={styles.statValue}>{workspace.summary.supportedCorrections}</p></article><article className={styles.stat}><p className={styles.kicker}>Immutable revisions</p><p className={styles.statValue}>{workspace.summary.immutableRevisions}</p></article></section>
    <section className={styles.toolbar} aria-label="Compiler filters"><label><span className={styles.fieldLabel}>Search ready targets</span><input className={styles.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, domain or URN" /></label><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button></section>
    <section className={styles.workspace}>
      <aside className={styles.panel}><p className={styles.kicker}>Ready for re-ingestion</p><div className={`${styles.list} mt-4`}>{visibleTargets.map((target) => <button key={`${target.recordId}:${target.targetSha256}`} className={`${styles.item} ${selectedKey === `${target.recordId}:${target.targetSha256}` ? styles.itemSelected : ''}`} onClick={() => choose(target)}><strong>{target.title}</strong><span className={styles.itemMeta}>{target.domainSlug} · {target.origin} · {target.corrections.length} supported corrections</span><span className={styles.itemMeta}>{target.targetSha256.slice(0, 28)}…</span></button>)}{!visibleTargets.length && <p className={styles.empty}>No current target is both evidence-complete and ready for controlled re-ingestion.</p>}</div></aside>
      <div className={styles.detailGrid}>{selected ? <>
        <section className={styles.panel}><p className={styles.kicker}>Frozen base target</p><h2 className={styles.sectionTitle}>{selected.title}</h2><p className={`${styles.mono} mt-3`}>{selected.recordId}<br />{selected.targetSha256}</p><div className={styles.badges}><span className={`${styles.badge} ${styles.normal}`}>{selected.origin}</span><span className={`${styles.badge} ${styles.high}`}>{selected.corrections.length} compiler-supported</span>{selected.unsupportedSourceBlockers.length > 0 && <span className={`${styles.badge} ${styles.critical}`}>{selected.unsupportedSourceBlockers.length} unsupported</span>}</div><a className={styles.reviewLink} href={selected.sourcePublicPath}>Inspect legacy source page</a></section>
        <section className={styles.panel}><p className={styles.kicker}>Evidence-bound corrections</p><div className="mt-4 space-y-4">{selected.corrections.map((correction) => {
          const draft = drafts[correction.blockerCode]
          const evidence = correction.evidenceOptions.find((option) => option.eventId === draft?.evidenceEventId)
          return <article className={styles.evidence} key={correction.blockerCode}><label className="flex items-start gap-3"><input type="checkbox" checked={draft?.included ?? false} onChange={(event) => setDrafts({ ...drafts, [correction.blockerCode]: { ...draft, included: event.target.checked } })} /><span><strong>{correction.fieldLabel}</strong><span className={styles.itemMeta}>{correction.fieldPath}<br />{correction.blockerCode}</span></span></label><div className={`${styles.formGrid} mt-4`}><label><span className={styles.fieldLabel}>Bound evidence event</span><select className={styles.select} value={draft?.evidenceEventId ?? ''} onChange={(event) => { const option = correction.evidenceOptions.find((candidate) => candidate.eventId === event.target.value)!; setDrafts({ ...drafts, [correction.blockerCode]: { ...draft, evidenceEventId: option.eventId, proposedValue: suggestedValue(correction, option) } }) }}>{correction.evidenceOptions.map((option) => <option key={option.eventId} value={option.eventId}>{new Date(option.occurredAt).toLocaleString()} · {option.eventId.slice(0, 16)}…</option>)}</select></label><label><span className={styles.fieldLabel}>Proposed value</span>{correction.inputKind === 'select' ? <select className={styles.select} value={draft?.proposedValue ?? ''} onChange={(event) => setDrafts({ ...drafts, [correction.blockerCode]: { ...draft, proposedValue: event.target.value } })}>{correction.options.map((option) => <option key={option}>{option}</option>)}</select> : <input className={styles.input} type={correction.inputKind} value={draft?.proposedValue ?? ''} onChange={(event) => setDrafts({ ...drafts, [correction.blockerCode]: { ...draft, proposedValue: event.target.value } })} />}</label></div>{evidence && <div className="mt-3 border-l-2 border-violet-500 pl-3"><p className={styles.mono}>{evidence.sourceUrl}</p><p className="mt-2 text-sm leading-6 text-slate-600">{evidence.note}</p></div>}</article>
        })}</div>{selected.unsupportedSourceBlockers.length > 0 && <div className={styles.boundary}><strong>Withheld from this compiler:</strong> {selected.unsupportedSourceBlockers.join(', ')}</div>}</section>
        <section className={styles.panel}><p className={styles.kicker}>Compile controls</p><label className="mt-4 block"><span className={styles.fieldLabel}>Revision rationale</span><textarea className={styles.textarea} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="mt-4 flex flex-wrap gap-3"><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading || note.trim().length < 20} onClick={() => void run('preview')}>{loading ? 'Working…' : 'Preview exact diff'}</button><button className={styles.button} disabled={loading || note.trim().length < 20} onClick={() => void run('compile')}>{loading ? 'Working…' : 'Create immutable revision'}</button></div></section>
      </> : <section className={styles.panel}><p className={styles.empty}>Select a ready target to bind its evidence, preview the exact diff and create a new frozen revision.</p></section>}
      {preview && <section className={styles.panel}><p className={styles.kicker}>Machine-generated before / after</p><h2 className={styles.sectionTitle}>New target {preview.outputReviewTargetSha256.slice(0, 24)}…</h2><p className={`${styles.mono} mt-3`}>Base: {preview.baseTargetSha256}<br />Output: {preview.outputReviewTargetSha256}</p><div className="mt-5 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-slate-300"><th className="p-3 font-mono text-xs uppercase tracking-widest">Field</th><th className="p-3 font-mono text-xs uppercase tracking-widest">Before</th><th className="p-3 font-mono text-xs uppercase tracking-widest">After</th></tr></thead><tbody>{preview.diff.map((entry) => <tr key={entry.path} className="border-b border-slate-200 align-top"><td className="p-3 font-mono text-xs">{entry.path}</td><td className="p-3 text-rose-800">{entry.before || '∅ missing'}</td><td className="p-3 text-emerald-800">{entry.after}</td></tr>)}</tbody></table></div><div className={styles.badges}><span className={`${styles.badge} ${styles.low}`}>{preview.resolvedBlockerCodes.length} resolved</span><span className={`${styles.badge} ${styles.high}`}>{preview.remainingSourceBlockerCodes.length} source blockers remain</span><span className={`${styles.badge} ${styles.normal}`}>draft · fresh review required</span></div></section>}
      </div>
    </section>
    <section className={`${styles.panel} mt-8`}><p className={styles.kicker}>Recent immutable lineage</p><div className="mt-4 grid gap-3">{workspace.recentCompilations.slice(0, 12).map((compilation) => <article className={styles.item} key={compilation.compilationId}><strong>{compilation.recordId}</strong><span className={styles.itemMeta}>{compilation.compilationId} · {new Date(compilation.compiledAt).toLocaleString()}</span><span className={styles.itemMeta}>{compilation.baseTargetSha256.slice(0, 20)}… → {compilation.outputReviewTargetSha256.slice(0, 20)}… · {compilation.diff.length} fields</span></article>)}{!workspace.recentCompilations.length && <p className={styles.empty}>No controlled revisions have been persisted yet.</p>}</div></section>
  </div></main>
}
