'use client'

import { useState } from 'react'

type Server = { public_id: string; client_id: string; display_name: string; endpoint_url: string; status: string; allowed_methods: string[]; allowed_tool_names: string[]; context_pack_required_tools: string[]; context_pack_id_argument: string; context_pack_hash_argument: string; context_pack_content_argument: string; created_at: string }
type Event = { server_id: string; client_id: string; credential_id: string; mcp_method: string | null; tool_name: string | null; outcome: string; upstream_status: number | null; context_pack_id: string | null; created_at: string }

const supportedMethods = ['initialize', 'notifications/initialized', 'ping', 'tools/list', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get', 'tools/call']
const button = 'border border-cyan-500 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-40'

export default function McpGatewayAdminPage() {
  const [token, setToken] = useState('')
  const [servers, setServers] = useState<Server[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [allowedMethods, setAllowedMethods] = useState<string[]>(['initialize', 'notifications/initialized', 'ping', 'tools/list'])
  const [allowedToolNames, setAllowedToolNames] = useState('')
  const [contextPackRequiredTools, setContextPackRequiredTools] = useState('')

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) }, cache: 'no-store' })
    const data = await response.json() as { error?: { message?: string } }
    if (!response.ok) throw new Error(data.error?.message ?? 'The gateway control plane is unavailable.')
    return data
  }

  async function refresh() {
    if (!token) { setNotice('Enter the MCP Gateway operations token to load the private registry.'); return }
    setLoading(true); setNotice('')
    try {
      const data = await request('/api/admin/mcp-gateway') as { servers: Server[]; events: Event[] }
      setServers(data.servers); setEvents(data.events)
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'The gateway control plane is unavailable.') }
    finally { setLoading(false) }
  }

  function toggleMethod(method: string) {
    setAllowedMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method])
  }

  async function register(event: React.FormEvent) {
    event.preventDefault()
    if (!token) { setNotice('Enter the MCP Gateway operations token first.'); return }
    setLoading(true); setNotice('')
    try {
      const result = await request('/api/admin/mcp-gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, displayName, endpointUrl, allowedMethods, allowedToolNames: allowedToolNames.split(',').map((value) => value.trim()).filter(Boolean), contextPackRequiredTools: contextPackRequiredTools.split(',').map((value) => value.trim()).filter(Boolean) }) }) as { server: Server }
      setNotice(`Registered ${result.server.display_name}. Issue a tenant credential with the mcp_gateway capability before connecting a client.`)
      setDisplayName(''); setEndpointUrl(''); setAllowedToolNames(''); setContextPackRequiredTools('')
      await refresh()
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'The gateway server could not be registered.') }
    finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-12 text-zinc-200"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs tracking-widest text-cyan-300">[ ENTERPRISE MCP GATEWAY // PRIVATE ]</p><h1 className="mt-3 text-3xl text-white">Tenant gateway registry</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Register public upstream MCP endpoints, define their explicit policy, and review metadata-only traffic outcomes. This first release stores no upstream secrets or request contents.</p></div><button onClick={() => void refresh()} disabled={loading} className={button}>{loading ? 'Loading…' : 'Refresh registry'}</button></header>
    <label className="mt-7 block max-w-xl text-xs text-zinc-500">MCP Gateway operations token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm text-zinc-200 outline-none focus:border-cyan-400" /></label>
    <p className="mt-2 text-xs text-zinc-500">The token remains only in this browser tab’s memory and is cleared on reload.</p>
    {notice && <p className="mt-5 border border-cyan-900 bg-cyan-950/20 p-3 text-sm text-cyan-100">{notice}</p>}
    <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.3fr]"><form onSubmit={(event) => void register(event)} className="border border-zinc-800 bg-zinc-950/50 p-5"><h2 className="text-lg text-white">Register public upstream</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">Only register a server after reviewing its endpoint and tool surface. Private servers belong in the future OAuth release.</p><Field label="Tenant client ID" value={clientId} onChange={setClientId} placeholder="client_…" /><Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Approved public research server" /><Field label="Public HTTPS MCP endpoint" value={endpointUrl} onChange={setEndpointUrl} placeholder="https://example.com/mcp" />
      <fieldset className="mt-5"><legend className="text-xs text-zinc-500">Allowed MCP methods</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{supportedMethods.map((method) => <label key={method} className="flex items-center gap-2 border border-zinc-800 p-2 text-xs text-zinc-300"><input type="checkbox" checked={allowedMethods.includes(method)} onChange={() => toggleMethod(method)} />{method}</label>)}</div></fieldset>
      <Field label="Allowed tool names (comma-separated; required if tools/call is selected)" value={allowedToolNames} onChange={setAllowedToolNames} placeholder="search_claims, get_claim_record" />
      <Field label="Require registered Context Packs for these approved tools (optional; must be in allowed tools)" value={contextPackRequiredTools} onChange={setContextPackRequiredTools} placeholder="search_claims" required={false} />
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">For each named tool, callers must supply <code>contextPackId</code>, <code>contextPackHash</code>, and <code>context</code>. The gateway verifies the exact context hash against a pack registered to the same tenant.</p>
      <button disabled={loading} className={`mt-6 ${button}`}>Register server</button></form>
      <section className="border border-zinc-800 bg-zinc-950/50 p-5"><h2 className="text-lg text-white">Registered servers</h2><div className="mt-4 space-y-3">{servers.length ? servers.map((server) => <article key={server.public_id} className="border border-zinc-800 bg-black/30 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm text-white">{server.display_name}</h3><span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">{server.status}</span></div><p className="mt-2 break-all font-mono text-xs text-cyan-200">/api/mcp-gateway/{server.public_id}</p><p className="mt-2 break-all text-xs text-zinc-500">{server.endpoint_url}</p><p className="mt-3 text-xs text-zinc-400">{server.allowed_methods.join(', ')}</p>{server.allowed_tool_names.length > 0 && <p className="mt-2 text-xs text-zinc-400">Tools: {server.allowed_tool_names.join(', ')}</p>}{server.context_pack_required_tools.length > 0 ? <p className="mt-2 text-xs text-cyan-100">Context Pack admission: {server.context_pack_required_tools.join(', ')}</p> : <p className="mt-2 text-xs text-zinc-600">Context Pack admission: not required</p>}</article>) : <p className="text-sm text-zinc-500">Load the registry to view servers.</p>}</div></section></section>
    <section className="mt-8 border border-zinc-800 bg-zinc-950/50 p-5"><h2 className="text-lg text-white">Recent gateway events</h2><p className="mt-2 text-sm text-zinc-400">No request arguments or responses are retained here.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-zinc-800 text-zinc-500"><tr><th className="p-2">Time</th><th className="p-2">Method</th><th className="p-2">Tool</th><th className="p-2">Context Pack</th><th className="p-2">Outcome</th><th className="p-2">Status</th></tr></thead><tbody>{events.map((event, index) => <tr key={`${event.server_id}-${event.created_at}-${index}`} className="border-b border-zinc-900 text-zinc-300"><td className="p-2 whitespace-nowrap">{new Date(event.created_at).toLocaleString()}</td><td className="p-2 font-mono">{event.mcp_method ?? '—'}</td><td className="p-2 font-mono">{event.tool_name ?? '—'}</td><td className="p-2 font-mono">{event.context_pack_id ?? '—'}</td><td className="p-2">{event.outcome}</td><td className="p-2">{event.upstream_status ?? '—'}</td></tr>)}</tbody></table>{events.length === 0 && <p className="py-5 text-sm text-zinc-500">No events loaded.</p>}</div></section>
  </div></main>
}

function Field({ label, value, onChange, placeholder, required = true }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return <label className="mt-5 block text-xs text-zinc-500">{label}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full border border-zinc-700 bg-black p-3 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-cyan-400" /></label>
}
