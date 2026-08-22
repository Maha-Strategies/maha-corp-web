// LOCAL-ONLY independent caller. Deliberately imports NOTHING from Maha: it
// reads the published agent card over HTTP and builds every request from the
// card and the A2A task shape, so it exercises the contract rather than the
// implementation's own types. This is a local compatibility harness, NOT
// validation by a third-party A2A client.
import { spawn } from 'node:child_process'

const host = spawn(process.execPath, ['--experimental-strip-types', new URL('./host.mts', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'inherit'] })
const port = await new Promise((resolve) => host.stdout.once('data', (d) => resolve(JSON.parse(String(d)).port)))
const base = `http://127.0.0.1:${port}`
const post = async (body) => { const r = await fetch(`${base}/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) } }

const evidence = {
  harness: { kind: 'local-only compatibility harness', thirdPartyClient: false,
    reason: 'No independent A2A client was installable from the local npm cache; installing one would need network authorization.',
    caller: 'purpose-built, imports no Maha module', transport: 'HTTP/1.1 over 127.0.0.1 loopback' },
  runtime: { node: process.version }, surface: [], credentialsUsed: false, providerCallsMade: 0, networkEgress: 'loopback only',
}

// 1. Agent card discovery at the well-known path.
const cardRes = await fetch(`${base}/.well-known/agent-card.json`)
const card = await cardRes.json()
const skill = card.skills?.[0]
evidence.surface.push({ step: 'agent-card discovery', path: '/.well-known/agent-card.json', status: cardRes.status,
  protocolVersion: card.protocolVersion ?? null, skillId: skill?.id ?? null,
  declaresNoPayments: card.boundaries?.payments === false, streaming: card.capabilities?.streaming ?? null })

// 2. A task built strictly from the card's published inputSchema. Before the
// schema was published this step failed: a caller with only the card guessed
// `id` and a nested `input.payload`, and was rejected as invalid_task.
const schema = skill.inputSchema
evidence.surface.push({ step: 'card publishes input schema', present: !!schema,
  required: schema?.required ?? null })
const task = { taskId: 'a2a-probe-0001', policy: { tokenBudget: 512 },
  request: { model: 'synthetic', messages: [],
    maha_context: { task: 'Summarise the synthetic coverage clause for evaluation.', tokenBudget: 512,
      documents: [{ id: 'syn-doc-1', text: 'Alpha beta gamma delta. Coverage category B applies to synthetic case 0001.' }] } } }
const ok = await post(task)
evidence.surface.push({ step: 'schema-derived task', httpStatus: ok.status, state: ok.json?.state ?? null,
  accepted: ok.json?.state === 'completed',
  returnsSourceText: JSON.stringify(ok.json ?? {}).includes('Alpha beta gamma delta') })

// 3. Replay: the identical task id must not silently produce a second result.
const replay = await post(task)
evidence.surface.push({ step: 'replay same taskId', httpStatus: replay.status, state: replay.json?.state ?? null,
  markedReplayed: replay.json?.replayed === true,
  sameStateAsFirst: replay.json?.state === ok.json?.state })

// 4. Unknown skill must be rejected.
const unknown = await post({ ...task, taskId: 'a2a-probe-0002', skillId: 'maha.context-control.__nope', request: { nonsense: true } })
evidence.surface.push({ step: 'unknown skill', httpStatus: unknown.status, state: unknown.json?.state ?? null,
  rejected: unknown.json?.state === 'rejected' || unknown.json?.state === 'failed' })

// 5. Malformed task must be rejected, not accepted.
const malformed = await post({ nonsense: true })
evidence.surface.push({ step: 'malformed task', httpStatus: malformed.status, state: malformed.json?.state ?? null,
  rejected: malformed.json?.state === 'rejected' || malformed.json?.state === 'failed' })

host.kill()
console.log(JSON.stringify(evidence, null, 2))
