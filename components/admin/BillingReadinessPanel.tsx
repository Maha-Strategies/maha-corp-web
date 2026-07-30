'use client'

import { useState } from 'react'

type Check = { state: 'ready' | 'degraded' | 'unavailable'; code: string; count?: number; latestAt?: string }
type Report = {
  generatedAt: string
  state: Check['state']
  readOnly: true
  configuration: Record<string, boolean>
  dependencies: { supabase: Check; upstash: Check }
  ledger: { checkouts: Check; stripeEvents: Check; entries: Check; reversals: Check }
}

const LABELS: Record<string, string> = {
  supabaseUrlConfigured: 'Supabase URL',
  supabaseServiceRoleConfigured: 'Supabase service role',
  upstashUrlConfigured: 'Upstash URL',
  upstashTokenConfigured: 'Upstash token',
  stripeSecretKeyConfigured: 'Stripe secret key',
  stripeWebhookSecretConfigured: 'API-credit webhook secret',
  starterPriceConfigured: 'Starter Price ID',
  proPriceConfigured: 'Pro Price ID',
  enterprisePriceConfigured: 'Enterprise Price ID',
}

function tone(state: Check['state']) {
  return state === 'ready' ? 'text-emerald-300' : state === 'degraded' ? 'text-amber-300' : 'text-red-300'
}

export function BillingReadinessPanel({ token }: { token: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true); setNotice('')
    try {
      const response = await fetch('/api/admin/billing-readiness', { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json().catch(() => null) as Report | { error?: { message?: string } } | null
      if (!body || !('configuration' in body)) throw new Error(body && 'error' in body ? body.error?.message ?? 'Billing readiness is unavailable.' : 'Billing readiness is unavailable.')
      setReport(body)
      if (!response.ok) setNotice('One or more dependencies are unavailable. Review the failed checks below; no billing action was taken.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Billing readiness is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="mt-6 border border-zinc-800 bg-zinc-950/40 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">Billing readiness · read-only</p><p className="mt-2 text-sm text-zinc-400">Checks configuration presence and read-only ledger access. Secrets, customer data, and payment actions are never displayed or created.</p></div>
      <button onClick={() => void load()} disabled={loading} className="border border-zinc-600 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:border-emerald-400 disabled:opacity-40">{loading ? 'Checking…' : 'Refresh checks'}</button>
    </div>
    {notice && <p className="mt-4 border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-100">{notice}</p>}
    {report && <>
      <p className={`mt-4 font-mono text-xs uppercase tracking-widest ${tone(report.state)}`}>Overall: {report.state} · checked {new Date(report.generatedAt).toLocaleString()}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{Object.entries(report.configuration).map(([key, value]) => <div key={key} className="border border-zinc-800 bg-black/30 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{LABELS[key] ?? key}</p><p className={`mt-2 text-sm ${value ? 'text-emerald-300' : 'text-red-300'}`}>{value ? 'Configured' : 'Missing'}</p></div>)}</div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2"><ReadinessCheck label="Supabase billing ledger" check={report.dependencies.supabase} /><ReadinessCheck label="Upstash Redis" check={report.dependencies.upstash} /></div>
      <div className="mt-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Billing-ledger tables</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReadinessCheck label="Checkouts" check={report.ledger.checkouts} /><ReadinessCheck label="Stripe events" check={report.ledger.stripeEvents} /><ReadinessCheck label="Credit entries" check={report.ledger.entries} /><ReadinessCheck label="Reversals" check={report.ledger.reversals} /></div></div>
      <div className="mt-5 border-t border-zinc-800 pt-5 text-sm leading-6 text-zinc-400"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Manual test sequence</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Confirm all checks read ready.</li><li>Use Stripe test mode to buy one Starter pack from the dashboard.</li><li>Reconnect the API key and confirm its balance increases by 100,000 credits.</li><li>Resend the same Stripe event and confirm no second grant occurs.</li><li>Issue a test refund and confirm the ledger records one reversal.</li></ol></div>
    </>}
  </section>
}

function ReadinessCheck({ label, check }: { label: string; check: Check }) {
  return <div className="border border-zinc-800 bg-black/30 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className={`mt-2 text-sm ${tone(check.state)}`}>{check.state}</p><p className="mt-1 font-mono text-[10px] text-zinc-500">{check.code}</p>{typeof check.count === 'number' && <p className="mt-2 text-xs text-zinc-300">{check.count.toLocaleString()} records</p>}{check.latestAt && <p className="mt-1 text-xs text-zinc-500">latest {new Date(check.latestAt).toLocaleString()}</p>}</div>
}
