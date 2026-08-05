'use client'

import { useCallback, useEffect, useState } from 'react'
import { MahaClient, type McpServerSummary, type McpSlaSettings } from '@/lib/sdk/index'

const DEFAULT_SETTINGS: McpSlaSettings = { requestsPerMinute: 60, timeoutMs: 10_000, failureThreshold: 3, cooldownMs: 30_000 }

function validPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.hash
  } catch { return false }
}

function Field({ label, value, min, max, suffix, disabled, onChange }: { label: string; value: number; min: number; max: number; suffix: string; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="text-sm font-medium text-gray-700">{label}<div className="mt-2 flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-black/10"><input type="number" required min={min} max={max} step={1} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 rounded-l-lg px-3 py-2 text-sm outline-none disabled:bg-gray-100" /><span className="border-l border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">{suffix}</span></div><span className="mt-1 block text-[11px] text-gray-500">Allowed range: {min.toLocaleString()}–{max.toLocaleString()}</span></label>
}

export function McpSettingsPanel({ apiKey }: { apiKey: string }) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [upstreamToken, setUpstreamToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingServers, setLoadingServers] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [discovering, setDiscovering] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [registered, setRegistered] = useState<McpServerSummary | null>(null)
  const [servers, setServers] = useState<McpServerSummary[]>([])
  const [settings, setSettings] = useState<McpSlaSettings>(DEFAULT_SETTINGS)

  const client = useCallback(() => new MahaClient({ apiKey, baseUrl: window.location.origin }), [apiKey])
  const loadServers = useCallback(async () => {
    setLoadingServers(true)
    try { setServers(await client().mcp.listServers()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Registered MCP servers could not be loaded.') }
    finally { setLoadingServers(false) }
  }, [client])
  const loadSettings = useCallback(async () => {
    setLoadingSettings(true)
    try { setSettings(await client().mcp.getSettings()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'MCP SLA settings could not be loaded.') }
    finally { setLoadingSettings(false) }
  }, [client])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void Promise.all([loadServers(), loadSettings()]) })
    return () => window.cancelAnimationFrame(frame)
  }, [loadServers, loadSettings])

  async function register(event: React.FormEvent) {
    event.preventDefault()
    const endpoint = baseUrl.trim()
    if (!validPublicHttpsUrl(endpoint)) { setError('Provide a public HTTPS endpoint without embedded credentials or a URL fragment.'); return }
    if (!upstreamToken.trim()) { setError('Provide the bearer credential for the upstream server.'); return }
    setLoading(true); setError(null); setNotice(null); setRegistered(null)
    try {
      const result = await client().mcp.registerServer({ name: name.trim(), baseUrl: endpoint, authType: 'bearer', secret: upstreamToken.trim() })
      setRegistered(result); await loadServers(); setName(''); setBaseUrl(''); setUpstreamToken('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The upstream MCP server could not be registered.') }
    finally { setLoading(false) }
  }

  async function discover(serverId: string) {
    setDiscovering(serverId); setError(null); setNotice(null)
    try {
      const updated = await client().mcp.discoverTools(serverId)
      setServers((current) => current.map((server) => server.serverId === serverId ? updated : server))
      setNotice(`Discovered ${updated.discovery.tools.length} validated tool${updated.discovery.tools.length === 1 ? '' : 's'} on ${updated.name}.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tool discovery failed.') }
    finally { setDiscovering(null) }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault(); setSavingSettings(true); setError(null); setNotice(null)
    try { setSettings(await client().mcp.updateSettings(settings)); setNotice('Tenant MCP rate, timeout, and circuit-breaker controls saved.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'MCP SLA settings could not be saved.') }
    finally { setSavingSettings(false) }
  }

  return <section className="mt-6 space-y-6" aria-labelledby="mcp-settings-heading">
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="mcp-settings-heading" className="text-lg font-semibold">MCP upstream settings</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Register a public HTTPS MCP upstream. Maha encrypts its credential, calls <code className="rounded bg-gray-100 px-1 py-0.5">tools/list</code>, and stores only validated tool metadata for this tenant.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">Bearer auth</span></div>
      <form onSubmit={(event) => void register(event)} className="mt-5 grid gap-4" noValidate>
        <label className="text-sm font-medium text-gray-700">Friendly server name<input required value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={160} disabled={loading} placeholder="Production Modal Upstream" className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label>
        <label className="text-sm font-medium text-gray-700">Public HTTPS endpoint<input required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} disabled={loading} placeholder="https://workspace--maha-mcp-upstream.modal.run" className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" aria-describedby="mcp-endpoint-help" /></label>
        <p id="mcp-endpoint-help" className="-mt-2 text-xs leading-5 text-gray-500">Private, localhost, IP-address, and redirect endpoints are rejected. Public DNS is checked again before every connection.</p>
        <label className="text-sm font-medium text-gray-700">Upstream bearer credential<input required type="password" autoComplete="off" value={upstreamToken} onChange={(event) => setUpstreamToken(event.target.value)} disabled={loading} placeholder="Token used only between Maha and this upstream" className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm disabled:bg-gray-100" /></label>
        <p className="-mt-2 text-xs leading-5 text-gray-500">The plaintext credential stays in memory only until submission. Encrypted credential material is never returned by the API.</p>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p>}
        {registered && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800"><p className="font-medium">Upstream registered. Discovery: {registered.discovery.status}.</p><p className="mt-1">Gateway server ID: <code className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-xs">{registered.serverId}</code></p>{registered.discovery.status === 'ready' ? <p className="mt-2 text-xs">{registered.discovery.tools.length} validated tools discovered automatically.</p> : <p className="mt-2 text-xs">The connection remains registered. Review the discovery error below and retry from Active connections.</p>}</div>}
        <div><button disabled={loading || !name.trim() || !baseUrl.trim() || !upstreamToken.trim()} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Registering and discovering…' : 'Register upstream'}</button></div>
      </form>
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-gray-900">Active connections and discovered tools</h3><p className="mt-1 text-xs text-gray-500">Tool schemas are validated and persisted; upstream credentials are never included.</p></div><button type="button" onClick={() => void loadServers()} disabled={loadingServers || loading} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{loadingServers ? 'Refreshing…' : 'Refresh servers'}</button></div>
      {loadingServers ? <p className="mt-4 text-sm text-gray-500">Loading registered servers…</p> : servers.length ? <div className="mt-4 space-y-4">{servers.map((server) => <article key={server.serverId} className="rounded-xl border border-gray-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-gray-900">{server.name}</h4><p className="mt-1 break-all font-mono text-[11px] text-gray-500">{server.serverId} · {server.baseUrl}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${server.discovery.status === 'ready' ? 'bg-green-50 text-green-700' : server.discovery.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{server.discovery.status === 'ready' ? `${server.discovery.tools.length} tools` : server.discovery.status}</span><button type="button" onClick={() => void discover(server.serverId)} disabled={discovering !== null || loading} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{discovering === server.serverId ? 'Discovering…' : 'Run tools/list'}</button></div></div>{server.discovery.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{server.discovery.error}</p>}{server.discovery.tools.length > 0 && <ul className="mt-4 grid gap-2 md:grid-cols-2">{server.discovery.tools.map((tool) => <li key={tool.name} className="rounded-lg bg-gray-50 p-3"><code className="text-xs font-semibold text-gray-900">{tool.name}</code><p className="mt-1 line-clamp-3 text-xs leading-5 text-gray-600">{tool.description || 'No description supplied by upstream.'}</p></li>)}</ul>}<p className="mt-3 text-[11px] text-gray-400">Registered {new Date(server.createdAt).toLocaleDateString()}{server.discovery.discoveredAt ? ` · Last discovery ${new Date(server.discovery.discoveredAt).toLocaleString()}` : ''}</p></article>)}</div> : <p className="mt-4 text-sm text-gray-500">No MCP upstreams are registered for this tenant.</p>}
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-gray-900">Tenant SLA controls</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">These limits apply across every Vercel instance and every registered upstream for this tenant. Repeated transport failures open a per-server circuit; one probe is admitted after cooldown.</p>
      {loadingSettings ? <p className="mt-4 text-sm text-gray-500">Loading SLA controls…</p> : <form onSubmit={(event) => void saveSettings(event)} className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Outbound request limit" value={settings.requestsPerMinute} min={1} max={600} suffix="requests/min" disabled={savingSettings} onChange={(value) => setSettings((current) => ({ ...current, requestsPerMinute: value }))} /><Field label="Upstream timeout" value={settings.timeoutMs} min={1_000} max={30_000} suffix="milliseconds" disabled={savingSettings} onChange={(value) => setSettings((current) => ({ ...current, timeoutMs: value }))} /><Field label="Failure threshold" value={settings.failureThreshold} min={1} max={10} suffix="failures" disabled={savingSettings} onChange={(value) => setSettings((current) => ({ ...current, failureThreshold: value }))} /><Field label="Circuit cooldown" value={settings.cooldownMs} min={5_000} max={300_000} suffix="milliseconds" disabled={savingSettings} onChange={(value) => setSettings((current) => ({ ...current, cooldownMs: value }))} /><div className="md:col-span-2"><button disabled={savingSettings} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">{savingSettings ? 'Saving controls…' : 'Save SLA controls'}</button></div></form>}
    </div>
  </section>
}
