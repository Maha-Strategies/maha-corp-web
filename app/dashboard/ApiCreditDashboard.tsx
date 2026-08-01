'use client'

import { useState } from 'react'
import { TopUpButtons } from './TopUpButtons'
import { AuditExportPanel } from './AuditExportPanel'
import { McpSettingsPanel } from './McpSettingsPanel'

type Balance = { api_key_id: string; balance_credits: number; tier: string }

export function ApiCreditDashboard({ status }: { status?: string }) {
  const [apiKey, setApiKey] = useState('')
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function connect(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null)
    try {
      const response = await fetch('/api/v1/keys/balance', { headers: { Authorization: `Bearer ${apiKey.trim()}` } })
      const result = await response.json().catch(() => null) as Balance | { error?: { message?: string } } | null
      const errorMessage = result && 'error' in result ? result.error?.message : undefined
      if (!response.ok || !result || !('api_key_id' in result)) throw new Error(errorMessage || 'We could not connect that API key.')
      setBalance(result); setApiKey(apiKey.trim())
    } catch (connectError) { setError(connectError instanceof Error ? connectError.message : 'We could not connect that API key.') }
    finally { setLoading(false) }
  }
  return <main className="min-h-screen bg-gray-50 px-6 py-14 text-gray-950 sm:py-20"><div className="mx-auto max-w-3xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Maha Strategies developer portal</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">API credit dashboard</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">Connect an API key to view its balance and buy credits. The key stays only in this browser tab and is never placed in the URL.</p>
    {status === 'success' && <div role="status" className="mt-8 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Payment completed. Credits appear after Stripe confirms the signed webhook.</div>}
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Connect an API key</h2><form onSubmit={connect} className="mt-4 flex flex-col gap-3 sm:flex-row"><input aria-label="Maha API key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="mha_live_..." className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button disabled={loading || !apiKey.trim()} className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? 'Connecting...' : 'Connect'}</button></form>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<p className="mt-3 text-xs text-gray-500">Do not paste this key into chat. Refreshing the page clears it.</p></section>
    {balance && <><section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium text-gray-600">Current Balance</p><p className="mt-2 text-4xl font-semibold tracking-tight">{new Intl.NumberFormat('en-US').format(balance.balance_credits)} <span className="text-lg font-medium text-gray-500">credits</span></p><p className="mt-4 text-sm text-gray-600">API key ID: <code className="rounded bg-gray-100 px-2 py-1 text-xs">{balance.api_key_id}</code> <span className="ml-3">Tier: {balance.tier}</span></p></section><AuditExportPanel apiKey={apiKey} /><McpSettingsPanel apiKey={apiKey} /><div className="mt-6"><TopUpButtons apiKey={apiKey} /></div></>}
  </div></main>
}
