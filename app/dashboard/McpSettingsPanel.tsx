'use client'

import { useCallback, useEffect, useState } from 'react'
import { MahaClient, type McpServerSummary } from '@/lib/sdk/index'

type RegisteredServer = { id: string; name?: unknown; baseUrl?: unknown; status?: unknown }

function validPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.hash
  } catch {
    return false
  }
}

export function McpSettingsPanel({ apiKey }: { apiKey: string }) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [upstreamToken, setUpstreamToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingServers, setLoadingServers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<RegisteredServer | null>(null)
  const [servers, setServers] = useState<McpServerSummary[]>([])

  const loadServers = useCallback(async () => {
    setLoadingServers(true)
    try {
      const client = new MahaClient({ apiKey, baseUrl: window.location.origin })
      setServers(await client.mcp.listServers())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registered MCP servers could not be loaded.')
    } finally {
      setLoadingServers(false)
    }
  }, [apiKey])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadServers() })
    return () => window.cancelAnimationFrame(frame)
  }, [loadServers])

  async function register(event: React.FormEvent) {
    event.preventDefault()
    const endpoint = baseUrl.trim()
    if (!validPublicHttpsUrl(endpoint)) {
      setError('Provide a public HTTPS endpoint without embedded credentials or a URL fragment.')
      return
    }
    if (!upstreamToken.trim()) {
      setError('Provide the bearer credential for the upstream server.')
      return
    }

    setLoading(true)
    setError(null)
    setRegistered(null)
    try {
      const client = new MahaClient({ apiKey, baseUrl: window.location.origin })
      const result = await client.mcp.registerServer({
        name: name.trim(),
        baseUrl: endpoint,
        authType: 'bearer',
        secret: upstreamToken.trim(),
        allowedEngines: ['*'],
      }) as RegisteredServer
      setRegistered(result)
      await loadServers()
      setName('')
      setBaseUrl('')
      setUpstreamToken('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The upstream MCP server could not be registered.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="mcp-settings-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="mcp-settings-heading" className="text-lg font-semibold">MCP upstream settings</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Register a public HTTPS MCP upstream for this API key. The gateway encrypts the bearer credential before storage and never returns it to this dashboard.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">Bearer auth</span></div>
    <form onSubmit={(event) => void register(event)} className="mt-5 grid gap-4" noValidate>
      <label className="text-sm font-medium text-gray-700">Friendly server name<input required value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={160} disabled={loading} placeholder="Staging Modal Upstream" className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label>
      <label className="text-sm font-medium text-gray-700">Public HTTPS endpoint<input required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} disabled={loading} placeholder="https://workspace--maha-e2e-mcp-upstream.modal.run" className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" aria-describedby="mcp-endpoint-help" /></label>
      <p id="mcp-endpoint-help" className="-mt-2 text-xs leading-5 text-gray-500">Private, localhost, and IP-address endpoints are rejected by the gateway. It verifies public DNS again before every proxy call.</p>
      <label className="text-sm font-medium text-gray-700">Upstream bearer credential<input required type="password" autoComplete="off" value={upstreamToken} onChange={(event) => setUpstreamToken(event.target.value)} disabled={loading} placeholder="Token used only between Maha and this upstream" className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm disabled:bg-gray-100" /></label>
      <p className="-mt-2 text-xs leading-5 text-gray-500">The credential stays only in this browser tab until submitted. Refreshing clears it; registration clears it immediately after success.</p>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {registered && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800"><p className="font-medium">Upstream registered and active.</p><p className="mt-1">Gateway server ID: <code className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-xs">{registered.id}</code></p><p className="mt-2 text-xs">This server-generated ID is the proxy connection reference. Save it in your enterprise configuration.</p></div>}
      <div><button disabled={loading || !name.trim() || !baseUrl.trim() || !upstreamToken.trim()} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Registering upstream…' : 'Register upstream'}</button></div>
    </form>
    <div className="mt-8 border-t border-gray-200 pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-gray-900">Active connections</h3><p className="mt-1 text-xs text-gray-500">Credentials are never included in this list.</p></div><button type="button" onClick={() => void loadServers()} disabled={loadingServers || loading} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">{loadingServers ? 'Refreshing…' : 'Refresh'}</button></div>{loadingServers ? <p className="mt-4 text-sm text-gray-500">Loading registered servers…</p> : servers.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-2 py-2 font-medium">Name</th><th className="px-2 py-2 font-medium">Endpoint</th><th className="px-2 py-2 font-medium">Status</th><th className="px-2 py-2 font-medium">Registered</th></tr></thead><tbody>{servers.map((server) => <tr key={server.serverId} className="border-b border-gray-100 text-gray-700"><td className="px-2 py-3 font-medium">{server.name}<p className="mt-1 font-mono text-[11px] text-gray-500">{server.serverId}</p></td><td className="max-w-64 break-all px-2 py-3 text-xs text-gray-600">{server.baseUrl}</td><td className="px-2 py-3"><span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{server.status}</span></td><td className="whitespace-nowrap px-2 py-3 text-xs text-gray-500">{new Date(server.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-gray-500">No MCP upstreams are registered for this API key.</p>}</div>
  </section>
}
