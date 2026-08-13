'use client'

import { useState } from 'react'

import type { EditorialCoverageAudit } from '@/lib/editorial-coverage-audit'

const number = new Intl.NumberFormat('en-US')

function Metric({ label, value, tone = 'cyan' }: { label: string; value: number; tone?: 'cyan' | 'amber' | 'rose' }) {
  const toneClass = tone === 'rose' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : 'text-cyan-300'
  return <article className="border border-zinc-800 bg-zinc-950/60 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className={`mt-3 text-3xl ${toneClass}`}>{number.format(value)}</p></article>
}

function EmptyQueue({ children }: { children: string }) {
  return <p className="border border-dashed border-zinc-800 p-6 text-sm text-zinc-600">{children}</p>
}

export default function EditorialCoveragePage() {
  const [token, setToken] = useState('')
  const [audit, setAudit] = useState<EditorialCoverageAudit | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/editorial-coverage', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const body = await response.json() as EditorialCoverageAudit & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Editorial coverage audit is unavailable.')
      setAudit(body)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Editorial coverage audit is unavailable.')
    } finally { setLoading(false) }
  }

  if (!audit) return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200">
      <div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-300">[ Editorial coverage // private ]</p>
        <h1 className="mt-4 text-2xl text-white">Unlock the editorial audit</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Read-only diagnostics for the Intelligence and Knowledge graph. This tool cannot edit or publish content.</p>
        <input type="password" value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} placeholder="Market mapping token" className="mt-5 w-full border border-zinc-700 bg-black p-3 font-mono text-sm" />
        <button onClick={() => void load()} disabled={!token || loading} className="mt-4 w-full bg-cyan-300 p-3 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">{loading ? 'Auditing…' : 'Run editorial audit'}</button>
        {notice && <p className="mt-4 text-sm text-rose-300">{notice}</p>}
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-300 sm:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-zinc-800 pb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-cyan-300">[ Editorial coverage // private // read only ]</p>
            <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">Knowledge–Intelligence audit</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">A deterministic review queue generated from published brief metadata, graph links, claim status, citation dates, and review age. Findings are prompts for editorial judgment—not automatic takedowns or publication decisions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/content-quality" className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest hover:border-cyan-500">Content quality</a>
            <button onClick={() => void load()} disabled={loading} className="border border-cyan-700 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan-200 disabled:opacity-40">{loading ? 'Refreshing…' : 'Refresh audit'}</button>
          </div>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Coverage gaps" value={audit.summary.coverageGaps} tone="amber" />
          <Metric label="Weak-evidence claims" value={audit.summary.weakEvidence} tone="rose" />
          <Metric label="Stale claims" value={audit.summary.staleClaims} tone="amber" />
          <Metric label="Briefs needing review" value={audit.summary.briefsNeedingReview} tone="rose" />
        </section>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Generated {audit.generatedOn} · {audit.summary.briefs} briefs · {audit.summary.knowledgeObjects} Knowledge objects · {audit.summary.graphEdges} graph edges</p>

        <section id="coverage-gaps" className="mt-14 scroll-mt-8">
          <div className="border-b border-zinc-800 pb-4"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">01 · Coverage gaps</p><h2 className="mt-2 text-2xl text-white">Objects missing a useful graph relationship</h2></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {audit.coverageGaps.map((item) => <a key={`${item.objectType}-${item.id}`} href={item.href} className="border border-zinc-800 bg-zinc-950/50 p-5 hover:border-amber-500/50"><div className="flex justify-between gap-4 font-mono text-[9px] uppercase tracking-widest"><span className="text-amber-300">{item.objectType}</span><span className="text-zinc-600">{item.status}</span></div><h3 className="mt-3 font-semibold text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{item.reason}</p></a>)}
            {audit.coverageGaps.length === 0 && <EmptyQueue>Every published object has a graph relationship.</EmptyQueue>}
          </div>
        </section>

        <section id="weak-evidence" className="mt-14 scroll-mt-8">
          <div className="border-b border-zinc-800 pb-4"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">02 · Weak evidence</p><h2 className="mt-2 text-2xl text-white">Claims requiring corroboration or a sharper boundary</h2></div>
          <div className="mt-5 space-y-3">
            {audit.weakEvidence.map((item) => <a key={item.claimId} href={item.href} className="block border border-zinc-800 bg-zinc-950/50 p-5 hover:border-rose-500/50"><div className="flex flex-wrap justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-rose-300">{item.claimStatus} · {item.sourceCount} source{item.sourceCount === 1 ? '' : 's'}</span><span className="text-zinc-600">{item.articleTitle}</span></div><p className="mt-3 text-sm leading-6 text-zinc-300">{item.statement}</p><p className="mt-3 text-xs leading-5 text-zinc-500">{item.reason}</p></a>)}
            {audit.weakEvidence.length === 0 && <EmptyQueue>No weak-evidence claims under the current policy.</EmptyQueue>}
          </div>
        </section>

        <section id="stale-claims" className="mt-14 scroll-mt-8">
          <div className="border-b border-zinc-800 pb-4"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">03 · Stale claims</p><h2 className="mt-2 text-2xl text-white">Claims whose review or dated evidence needs refreshing</h2></div>
          <div className="mt-5 space-y-3">
            {audit.staleClaims.map((item) => <a key={item.claimId} href={item.href} className="block border border-zinc-800 bg-zinc-950/50 p-5 hover:border-amber-500/50"><div className="flex flex-wrap justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-amber-300">{item.claimId}</span><span className="text-zinc-600">{item.articleTitle}</span></div><p className="mt-3 text-sm leading-6 text-zinc-300">{item.statement}</p><p className="mt-3 text-xs leading-5 text-zinc-500">{item.reason}</p></a>)}
            {audit.staleClaims.length === 0 && <EmptyQueue>No claims are stale under the current policy.</EmptyQueue>}
          </div>
        </section>

        <section id="brief-review" className="mt-14 scroll-mt-8">
          <div className="border-b border-zinc-800 pb-4"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">04 · Brief review queue</p><h2 className="mt-2 text-2xl text-white">Briefs needing human editorial attention</h2></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {audit.briefsNeedingReview.map((brief) => <a key={brief.briefSlug} href={brief.href} className="border border-zinc-800 bg-zinc-950/50 p-5 hover:border-cyan-500/50"><div className="flex justify-between gap-4 font-mono text-[9px] uppercase tracking-widest"><span className="text-cyan-300">{brief.status}</span><span className="text-zinc-600">Reviewed {brief.lastReviewedOn}</span></div><h3 className="mt-3 font-semibold text-white">{brief.title}</h3><ul className="mt-4 space-y-2 text-xs leading-5 text-zinc-500">{brief.triggers.map((trigger) => <li key={trigger} className="border-l border-zinc-700 pl-3">{trigger}</li>)}</ul></a>)}
          </div>
        </section>

        <section className="mt-14 border border-zinc-800 bg-zinc-950/50 p-6 text-xs leading-6 text-zinc-500">
          <p className="font-mono uppercase tracking-widest text-zinc-300">Policy boundaries</p>
          <p className="mt-3">Brief review age: {audit.policy.briefReviewDays} days. Claim review age: {audit.policy.claimReviewDays} days. Dated-source freshness window: {audit.policy.sourceFreshnessYears} years. Old evidence is a review signal, not proof that a technical claim is false.</p>
        </section>
      </div>
    </main>
  )
}
