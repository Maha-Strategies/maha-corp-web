'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'

type Status = 'pending' | 'running' | 'awaiting_input' | 'awaiting_review' | 'awaiting_payment' | 'completed' | 'failed' | 'cancelled'
type Actor = { transport: string; targetId: string; operation: string }
type Task = { tenantId: string; taskId: string; status: Status; version: number; createdAt: string; updatedAt: string; terminalAt: string | null; lastTransitionId: string; lastEvent: string; lastActor: Actor; lastEvidenceSha256: string }
type Event = { version: number; transitionId: string; event: string; from: Status; to: Status; occurredAt: string; actor: Actor; evidenceSha256: string }
type Approval = { approvalId: string; status: string; actionSha256: string; policySha256: string; createdAt: string; expiresAt: string; reasonCode: string | null }
type Recovery = { actionId: string; status: string; actionSha256: string; policySha256: string; claimedAt: string; completedAt: string | null; responseStatus: number | null; responseSha256: string | null }
type Snapshot = { state: Task; events: Event[]; approvals: Approval[]; recoveryActions: Recovery[]; contentRetained: false }
type Deployment = { mode: 'legacy' | 'hosted' | 'private'; storageProvider: string; retentionDays: number; tenantId: string }

const STATUS_STYLE: Record<Status, string> = {
  pending: 'border-slate-500/40 bg-slate-500/10 text-slate-200', running: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
  awaiting_input: 'border-amber-400/40 bg-amber-400/10 text-amber-200', awaiting_review: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  awaiting_payment: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200', completed: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  failed: 'border-rose-400/40 bg-rose-400/10 text-rose-200', cancelled: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return `sha256:${[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function short(value: string, size = 10) { return value.length > size * 2 + 1 ? `${value.slice(0, size)}…${value.slice(-size)}` : value }
function when(value: string | null) { return value ? new Date(value).toLocaleString() : '—' }
function StatusPill({ value }: { value: Status }) { return <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_STYLE[value]}`}>{value.replaceAll('_', ' ')}</span> }

export default function OrchestrationConsole() {
  const [token, setToken] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selected, setSelected] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('Enter the private control token to load durable workflow state.')

  const headers = useCallback(() => ({ Authorization: `Bearer ${token}`, 'X-Maha-Tenant-Id': tenantId, 'Content-Type': 'application/json' }), [tenantId, token])
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { cache: 'no-store', ...init, headers: { ...headers(), ...(init?.headers ?? {}) } })
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
    return body
  }, [headers])

  const loadTask = useCallback(async (taskId: string) => {
    const body = await request(`/api/v1/orchestration/tasks/${encodeURIComponent(taskId)}`) as Snapshot
    setSelected(body)
    return body
  }, [request])

  const refresh = useCallback(async () => {
    if (!token) { setNotice('A control token is required. Legacy deployments also require a tenant ID.'); return }
    setBusy(true)
    try {
      const readiness = await request('/api/v1/orchestration/readiness') as { deployment: Deployment }
      setDeployment(readiness.deployment); setTenantId(readiness.deployment.tenantId)
      const body = await request('/api/v1/orchestration/tasks?limit=100') as { tenantId: string; tasks: Task[] }
      setTasks(body.tasks)
      if (selected) await loadTask(selected.state.taskId)
      setNotice(`Loaded ${body.tasks.length} metadata-only workflow record${body.tasks.length === 1 ? '' : 's'}.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load workflows.') } finally { setBusy(false) }
  }, [loadTask, request, selected, token])

  async function createTask() {
    setBusy(true)
    try {
      const transitionId = `operator-create-${crypto.randomUUID()}`
      const evidenceSha256 = await sha256(`${tenantId}\n${transitionId}\nworkflow.create`)
      const body = await request('/api/v1/orchestration/tasks', { method: 'POST', body: JSON.stringify({ transitionId, evidenceSha256 }) }) as { taskId: string }
      const list = await request('/api/v1/orchestration/tasks?limit=100') as { tasks: Task[] }
      setTasks(list.tasks)
      await loadTask(body.taskId)
      setNotice(`Created ${body.taskId}. No task payload was retained.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create workflow.') } finally { setBusy(false) }
  }

  async function transition(event: 'input_received' | 'task_completed' | 'task_failed' | 'task_cancelled') {
    if (!selected) return
    setBusy(true)
    try {
      const transitionId = `operator-${event}-${crypto.randomUUID()}`
      const evidenceSha256 = await sha256(`${tenantId}\n${selected.state.taskId}\n${event}\n${transitionId}`)
      await request(`/api/v1/orchestration/tasks/${selected.state.taskId}`, { method: 'POST', body: JSON.stringify({ event, transitionId, evidenceSha256 }) })
      await loadTask(selected.state.taskId)
      const list = await request('/api/v1/orchestration/tasks?limit=100') as { tasks: Task[] }; setTasks(list.tasks)
      setNotice(`Committed ${event}. The transition is replay-safe and evidence-bound.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not transition workflow.') } finally { setBusy(false) }
  }

  async function decide(approvalId: string, decision: 'approve' | 'deny') {
    if (!selected) return
    setBusy(true)
    try {
      await request(`/api/v1/workflows/${selected.state.taskId}/approvals/${approvalId}`, { method: 'POST', body: JSON.stringify({ decision, reasonCode: `operator_${decision}`, idempotencyKey: `operator-decision-${crypto.randomUUID()}` }) })
      await loadTask(selected.state.taskId)
      setNotice(`${decision === 'approve' ? 'Approved' : 'Denied'} the exact bound action. Approval does not dispatch it.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not decide approval.') } finally { setBusy(false) }
  }

  const counts = useMemo(() => ({ active: tasks.filter((task) => !['completed', 'failed', 'cancelled'].includes(task.status)).length, review: tasks.filter((task) => task.status === 'awaiting_review').length, terminal: tasks.filter((task) => ['completed', 'failed', 'cancelled'].includes(task.status)).length }), [tasks])

  return <main className="min-h-screen bg-[#071014] text-slate-100">
    <div className="mx-auto max-w-[1500px] px-5 py-8 lg:px-10">
      <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300">Maha control plane / private</p><h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Workflow operator console</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Inspect durable A2A and MCP task state, adjudicate exact-bound approvals, and recover safely. Payloads and credentials are never displayed or retained here.</p></div>
        <a href="/admin/operations" className="text-sm text-cyan-300 underline-offset-4 hover:underline">Operations overview →</a>
      </header>

      <section className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-xs uppercase tracking-wider text-slate-400">Tenant ID <span className="text-slate-600">(legacy only)</span><input value={tenantId} onChange={(event) => setTenantId(event.target.value)} autoComplete="off" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm normal-case tracking-normal outline-none focus:border-cyan-400/60" placeholder="Resolved from token in packaged modes" /></label>
        <label className="text-xs uppercase tracking-wider text-slate-400">Control token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm normal-case tracking-normal outline-none focus:border-cyan-400/60" placeholder="Held in this tab only" /></label>
        <button disabled={busy || !token} onClick={refresh} className="self-end rounded-lg border border-cyan-400/40 px-4 py-2.5 text-sm text-cyan-200 disabled:opacity-40">Refresh</button>
        <button disabled={busy || !token || !deployment || (!tenantId && deployment.mode === 'legacy')} onClick={createTask} className="self-end rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">New task</button>
      </section>

      <div role="status" className="mb-6 rounded-lg border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-slate-300">{busy ? 'Working… ' : ''}{notice}</div>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Deployment</p><p className="mt-2 font-mono text-lg uppercase text-cyan-200">{deployment?.mode ?? 'unverified'}</p><p className="mt-1 text-xs text-slate-600">{deployment ? `${deployment.storageProvider} · ${deployment.retentionDays}d` : 'Authenticate to verify'}</p></div>
        {[['Active', counts.active], ['Awaiting review', counts.review], ['Terminal', counts.terminal]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 px-4 py-3"><h2 className="font-medium">Durable tasks</h2></div>
          <div className="max-h-[760px] divide-y divide-white/[0.07] overflow-auto">
            {tasks.length === 0 ? <p className="p-5 text-sm text-slate-500">No indexed tasks loaded.</p> : tasks.map((task) => <button key={task.taskId} onClick={async () => { setBusy(true); try { await loadTask(task.taskId); setNotice(`Loaded ${task.taskId}.`) } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load task.') } finally { setBusy(false) } }} className={`w-full p-4 text-left transition hover:bg-white/[0.04] ${selected?.state.taskId === task.taskId ? 'bg-cyan-400/[0.06]' : ''}`}>
              <div className="mb-3 flex items-center justify-between gap-3"><StatusPill value={task.status} /><span className="font-mono text-[11px] text-slate-500">v{task.version}</span></div>
              <p className="break-all font-mono text-xs text-slate-200">{task.taskId}</p><p className="mt-2 text-xs text-slate-500">Updated {when(task.updatedAt)}</p>
            </button>)}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025]">
          {!selected ? <div className="grid min-h-[420px] place-items-center p-8 text-center text-slate-500"><p>Select a task to inspect its state, evidence chain, approvals, and recovery records.</p></div> : <div>
            <div className="border-b border-white/10 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><StatusPill value={selected.state.status} /><h2 className="mt-3 break-all font-mono text-base">{selected.state.taskId}</h2><p className="mt-1 text-xs text-slate-500">Created {when(selected.state.createdAt)} · updated {when(selected.state.updatedAt)}</p></div><div className="flex flex-wrap gap-2">
              {selected.state.status === 'awaiting_input' && <button disabled={busy} onClick={() => transition('input_received')} className="rounded-lg border border-amber-300/40 px-3 py-2 text-xs text-amber-200">Input received</button>}
              {!['completed', 'failed', 'cancelled'].includes(selected.state.status) && <><button disabled={busy} onClick={() => transition('task_completed')} className="rounded-lg border border-emerald-300/40 px-3 py-2 text-xs text-emerald-200">Complete</button><button disabled={busy} onClick={() => transition('task_failed')} className="rounded-lg border border-rose-300/40 px-3 py-2 text-xs text-rose-200">Fail</button><button disabled={busy} onClick={() => transition('task_cancelled')} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300">Cancel</button></>}
            </div></div></div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <Panel title={`Event history (${selected.events.length})`}>{selected.events.length === 0 ? <Empty /> : <div className="space-y-3">{[...selected.events].reverse().map((event) => <div key={`${event.version}-${event.transitionId}`} className="rounded-lg border border-white/[0.08] bg-black/20 p-3"><div className="flex items-center justify-between"><span className="font-mono text-xs text-cyan-200">#{event.version} {event.event}</span><span className="text-[11px] text-slate-500">{when(event.occurredAt)}</span></div><p className="mt-2 text-xs text-slate-400">{event.from} → {event.to} · {event.actor.transport} / {event.actor.operation}</p><p title={event.evidenceSha256} className="mt-2 font-mono text-[11px] text-slate-600">evidence {short(event.evidenceSha256)}</p></div>)}</div>}</Panel>
              <div className="space-y-5">
                <Panel title={`Approvals (${selected.approvals.length})`}>{selected.approvals.length === 0 ? <Empty /> : <div className="space-y-3">{selected.approvals.map((approval) => <div key={approval.approvalId} className="rounded-lg border border-white/[0.08] bg-black/20 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{short(approval.approvalId)}</span><span className="text-xs uppercase text-violet-200">{approval.status}</span></div><p className="mt-2 text-[11px] text-slate-500">Expires {when(approval.expiresAt)}</p>{approval.status === 'pending' && <div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => decide(approval.approvalId, 'approve')} className="rounded border border-emerald-300/40 px-2.5 py-1.5 text-xs text-emerald-200">Approve exact action</button><button disabled={busy} onClick={() => decide(approval.approvalId, 'deny')} className="rounded border border-rose-300/40 px-2.5 py-1.5 text-xs text-rose-200">Deny</button></div>}</div>)}</div>}</Panel>
                <Panel title={`Recovery ledger (${selected.recoveryActions.length})`}>{selected.recoveryActions.length === 0 ? <Empty /> : <div className="space-y-3">{selected.recoveryActions.map((action) => <div key={action.actionId} className="rounded-lg border border-white/[0.08] bg-black/20 p-3"><div className="flex justify-between gap-3"><span className="font-mono text-xs">{short(action.actionId)}</span><span className="text-xs uppercase text-cyan-200">{action.status}</span></div><p className="mt-2 text-[11px] text-slate-500">Claimed {when(action.claimedAt)} · response {action.responseStatus ?? '—'}</p></div>)}</div>}</Panel>
              </div>
            </div>
            <div className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-500">Safety boundary: approval records authorize only their bound action and policy digests. This console never signs payments, dispatches an upstream action, or automatically retries a recovery claim.</div>
          </div>}
        </section>
      </div>
    </div>
  </main>
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section><h3 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{title}</h3>{children}</section> }
function Empty() { return <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-600">No records.</p> }
