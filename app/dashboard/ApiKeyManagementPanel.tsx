'use client'

import { useState } from 'react'
import { MahaClient } from '@/lib/sdk/index'

type KeyDisclosure = { apiKey: string; apiKeyId: string; balanceCredits: number; tier: string; disclosure: string }

function messageFromResponse(result: unknown, fallback: string) {
  if (result && typeof result === 'object' && 'error' in result && result.error && typeof result.error === 'object' && 'message' in result.error && typeof result.error.message === 'string') return result.error.message
  return fallback
}

export function ApiKeyManagementPanel({ apiKey, onKeyChanged, onKeyRevoked }: { apiKey?: string; onKeyChanged: (key: string, balance: { api_key_id: string; balance_credits: number; tier: string }) => void; onKeyRevoked: () => void }) {
  const [email, setEmail] = useState('')
  const [disclosure, setDisclosure] = useState<KeyDisclosure | null>(null)
  const [loading, setLoading] = useState<'generate' | 'rotate' | 'revoke' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(event: React.FormEvent) {
    event.preventDefault(); setLoading('generate'); setError(null); setDisclosure(null)
    try {
      const response = await fetch('/api/v1/keys/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result || typeof result.apiKey !== 'string' || typeof result.apiKeyId !== 'string') throw new Error(messageFromResponse(result, 'API key generation is temporarily unavailable.'))
      const key = result as KeyDisclosure
      setDisclosure(key); setEmail(''); onKeyChanged(key.apiKey, { api_key_id: key.apiKeyId, balance_credits: key.balanceCredits, tier: key.tier })
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'API key generation is temporarily unavailable.') }
    finally { setLoading(null) }
  }

  async function rotate() {
    if (!apiKey) return
    if (!window.confirm('Rotate this API key? The current key will stop working immediately.')) return
    setLoading('rotate'); setError(null); setDisclosure(null)
    try {
      const result = await new MahaClient({ apiKey, baseUrl: window.location.origin }).rotateApiKey()
      setDisclosure(result); onKeyChanged(result.apiKey, { api_key_id: result.apiKeyId, balance_credits: result.balanceCredits, tier: result.tier })
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'API key rotation is temporarily unavailable.') }
    finally { setLoading(null) }
  }

  async function revoke() {
    if (!apiKey) return
    if (!window.confirm('Permanently revoke this API key? This cannot be undone and disconnects this dashboard.')) return
    setLoading('revoke'); setError(null)
    try {
      await new MahaClient({ apiKey, baseUrl: window.location.origin }).revokeApiKey()
      setDisclosure(null); onKeyRevoked()
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'API key revocation is temporarily unavailable.') }
    finally { setLoading(null) }
  }

  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="api-key-management-heading">
    <div><h2 id="api-key-management-heading" className="text-lg font-semibold">API key management</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Generate a new starter key, rotate the connected key, or permanently revoke it. New secrets are shown exactly once and remain only in this tab.</p></div>
    <form onSubmit={generate} className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="new-api-key-email">Email for new starter key</label><input id="new-api-key-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button type="submit" disabled={loading !== null} className="rounded-lg border border-gray-900 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">{loading === 'generate' ? 'Generating…' : 'Generate starter key'}</button></form>
    {apiKey && <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void rotate()} disabled={loading !== null} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{loading === 'rotate' ? 'Rotating…' : 'Rotate connected key'}</button><button type="button" onClick={() => void revoke()} disabled={loading !== null} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{loading === 'revoke' ? 'Revoking…' : 'Revoke connected key'}</button></div>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {disclosure && <div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950"><p className="font-medium">Copy this API key now. It will not be shown again.</p><code className="mt-3 block overflow-x-auto rounded bg-white px-3 py-2 text-xs text-gray-950">{disclosure.apiKey}</code><p className="mt-3 text-xs text-green-800">Key ID: {disclosure.apiKeyId} · {new Intl.NumberFormat('en-US').format(disclosure.balanceCredits)} credits · {disclosure.tier}</p></div>}
  </section>
}
