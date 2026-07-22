'use client'

import { useMemo, useState } from 'react'

type Submission = { public_id: string; offer_id: string; requester_name: string; requester_email: string; requester_organization: string | null; decision: string; question: string; deadline: string | null; qualification_status: string; qualification_reasons: string[]; inquiry_class: string; referral_source: string; referral_detail: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; operations_status: string; reviewer_note: string | null; revenue_opportunity_id: string | null; created_at: string }
type Opportunity = { public_id: string; status: string; route: string; qualified: boolean; updated_at: string }
const actions = ['start_review', 'request_clarification', 'approve_for_scoping', 'refer_to_checkout', 'decline', 'close_lost'] as const

export default function InboundOperationsPage() {
  const [token, setToken] = useState(''), [submissions, setSubmissions] = useState<Submission[]>([]), [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [filter, setFilter] = useState('active')
  const byOpportunity = useMemo(() => new Map(opportunities.map((item) => [item.public_id, item])), [opportunities])
  async function load() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/inbound-operations', { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json() as { submissions?: Submission[]; opportunities?: Opportunity[]; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Queue unavailable.')
      setSubmissions(body.submissions ?? []); setOpportunities(body.opportunities ?? [])
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Queue unavailable.') }
    finally { setLoading(false) }
  }
  async function operate(submissionId: string, action: typeof actions[number]) {
    const note = window.prompt('Optional internal note (never sent to the requester):') ?? ''
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/inbound-operations', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId, action, note, idempotencyKey: crypto.randomUUID() }) })
      const body = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Action could not be recorded.')
      await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Action could not be recorded.'); setLoading(false) }
  }
  const visible = submissions.filter((item) => filter === 'all' || !['declined', 'closed_lost'].includes(item.operations_status))
  if (!token) return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200"><div className="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6"><p className="font-mono text-xs tracking-widest text-indigo-300">[ INBOUND OPERATIONS // PRIVATE ]</p><h1 className="mt-4 text-2xl text-white">Unlock the queue</h1><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Inbound operations token" className="mt-5 w-full border border-zinc-700 bg-black p-3" /><button onClick={load} className="mt-4 w-full bg-indigo-500 p-3 font-mono text-xs font-bold uppercase tracking-widest text-white">Open queue</button>{notice && <p className="mt-4 text-sm text-red-300">{notice}</p>}</div></main>
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs tracking-widest text-indigo-300">[ INBOUND OPERATIONS // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Revenue queue</h1><p className="mt-2 text-sm text-zinc-400">Review and route. These actions never send messages, accept work, or collect payment.</p></div><div className="flex gap-3"><select value={filter} onChange={(event) => setFilter(event.target.value)} className="border border-zinc-700 bg-black p-2 text-sm"><option value="active">Active</option><option value="all">All</option></select><button onClick={load} disabled={loading} className="border border-zinc-600 px-4 py-2 font-mono text-xs uppercase">{loading ? 'Loading…' : 'Refresh'}</button></div></div>{notice && <p className="mt-5 border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{notice}</p>}<div className="mt-8 space-y-4">{visible.map((item) => { const opportunity = item.revenue_opportunity_id ? byOpportunity.get(item.revenue_opportunity_id) : undefined; const campaign=[item.utm_source,item.utm_medium,item.utm_campaign].filter(Boolean).join(' / '); return <article key={item.public_id} className="border border-zinc-800 bg-zinc-950/50 p-5"><div className="flex flex-wrap justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">{item.offer_id} · {item.operations_status}</p><h2 className="mt-2 text-lg text-white">{item.requester_organization ?? item.requester_name}</h2><p className="mt-1 text-sm text-zinc-400">{item.requester_email} · {new Date(item.created_at).toLocaleString()}</p></div><div className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500"><p>Qualification: {item.qualification_status}</p><p>Class: {item.inquiry_class}</p><p className="mt-1">Revenue: {opportunity?.status ?? 'pending'}</p></div></div><p className="mt-4 text-sm"><span className="text-zinc-500">Decision:</span> {item.decision}</p><p className="mt-2 text-sm leading-relaxed"><span className="text-zinc-500">Question:</span> {item.question}</p><p className="mt-2 text-xs text-zinc-500">Source: {item.referral_source}{item.referral_detail ? ` · ${item.referral_detail}` : ''}{campaign ? ` · campaign ${campaign}` : ''}</p>{item.deadline && <p className="mt-2 text-sm text-amber-200">Deadline: {item.deadline}</p>}{item.reviewer_note && <p className="mt-3 border-l-2 border-indigo-500 pl-3 text-sm text-indigo-100">{item.reviewer_note}</p>}<div className="mt-5 flex flex-wrap gap-2">{actions.map((action) => <button key={action} disabled={loading} onClick={() => operate(item.public_id, action)} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:border-indigo-400 disabled:opacity-40">{action.replaceAll('_', ' ')}</button>)}</div></article> })}{visible.length === 0 && <p className="border border-zinc-800 p-8 text-center text-sm text-zinc-500">No submissions in this view.</p>}</div></div></main>
}
