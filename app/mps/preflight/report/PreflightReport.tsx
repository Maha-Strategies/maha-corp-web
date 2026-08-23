'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type Claim = { excerpt: string; tag: string; rationale: string; action: string }
type Report = { mps_version: string; input_hash: string; claims: Claim[] }
const colors: Record<string, string> = { VERIFIED: 'text-[var(--status-verified)] border-[var(--status-verified)]', SOURCED: 'text-[var(--status-sourced)] border-[var(--status-sourced)]', BOUNDARY: 'text-[var(--status-boundary)] border-[var(--status-boundary)]', ILLUSTRATIVE: 'text-[var(--status-illustrative)] border-[var(--status-illustrative)]', UNVERIFIED: 'text-[var(--status-unverified)] border-[var(--status-unverified)]' }

export default function PreflightReport() {
  const params = useSearchParams()
  const orderId = params.get('orderId') ?? ''
  const access = params.get('access') ?? ''
  const validLink = Boolean(orderId && access)
  const [loading, setLoading] = useState(validLink)
  const [error, setError] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId || !access) return
    fetch(`/api/mps-preflight/${encodeURIComponent(orderId)}?access=${encodeURIComponent(access)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { error?: string; report?: Report; documentLabel?: string | null }
        if (!response.ok) throw new Error(data.error ?? 'Report unavailable.')
        if (!data.report) throw new Error('Your report is still being prepared. Refresh in a moment.')
        setReport(data.report); setLabel(data.documentLabel ?? null)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Report unavailable.'))
      .finally(() => setLoading(false))
  }, [access, orderId])

  const counts = useMemo(() => report?.claims.reduce<Record<string, number>>((all, claim) => ({ ...all, [claim.tag]: (all[claim.tag] ?? 0) + 1 }), {}) ?? {}, [report])
  function download() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${orderId}-mps-preflight.json`; anchor.click(); URL.revokeObjectURL(url)
  }

  return <main className="evidence-page"><div className="evidence-container evidence-container--narrow">
    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ Private MPS/0.1 report ]</p>
    <h1 className="mt-5 text-4xl font-light tracking-tight text-[var(--text-primary)] sm:text-5xl">{label ?? 'MPS Preflight report'}</h1>
    {loading && <p className="mt-8 text-[var(--text-secondary)]">Loading your private report…</p>}
    {!validLink && <div className="mt-8 border border-[var(--status-unverified)] bg-[var(--surface-raised)] p-5 text-[var(--status-unverified)]">This private report link is incomplete.</div>}
    {error && <div className="mt-8 border border-[var(--status-unverified)] bg-[var(--surface-raised)] p-5 text-[var(--status-unverified)]"><p>{error}</p><button className="mt-4 font-mono text-xs uppercase tracking-widest underline" onClick={() => window.location.reload()}>Refresh report</button></div>}
    {report && <><div className="mt-8 flex flex-wrap gap-3">{Object.entries(counts).map(([tag, count]) => <span key={tag} className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-widest ${colors[tag] ?? 'text-[var(--text-secondary)] border-[var(--border-default)]'}`}>{tag}: {count}</span>)}</div>
      <div className="mt-8 flex flex-wrap items-center gap-4"><button onClick={download} className="evidence-action evidence-action--primary">Download JSON record</button><span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Source text not retained · {report.input_hash.slice(0, 22)}…</span></div>
      <section className="mt-12"><h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Claim ledger · {report.claims.length} identified claims</h2><div className="mt-5 grid gap-3">{report.claims.map((claim, index) => <article key={`${claim.excerpt}-${index}`} className={`border-l-2 border-y border-r border-[var(--border-default)] bg-[var(--surface-raised)] p-5 ${colors[claim.tag]?.split(' ')[1] ?? 'border-[var(--border-default)]'}`}><div className="flex flex-wrap justify-between gap-3"><p className="max-w-2xl text-lg italic leading-relaxed text-[var(--text-primary)]">“{claim.excerpt}”</p><span className={`font-mono text-[10px] uppercase tracking-widest ${colors[claim.tag]?.split(' ')[0] ?? 'text-[var(--text-secondary)]'}`}>{claim.tag}</span></div><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{claim.rationale}</p>{claim.action !== 'none' && <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Recommended action: {claim.action}</p>}</article>)}</div></section>
      <section className="mt-12 border border-[var(--status-sourced)] bg-[var(--surface-raised)] p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ Need a defensible record? ]</p><h2 className="mt-3 text-2xl font-light text-[var(--text-primary)]">Move from triage to source-by-source evidence review.</h2><p className="mt-3 max-w-2xl leading-relaxed text-[var(--text-secondary)]">A Preflight shows where the work is. A human Evidence Audit resolves priority claims against sources and documents the remaining uncertainty.</p><Link href="/contact" className="evidence-action evidence-action--secondary mt-5">Request human review →</Link></section>
    </>}
  </div></main>
}
