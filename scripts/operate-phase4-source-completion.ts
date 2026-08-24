import { createHash } from 'node:crypto'

import {
  EPISTEMIC_PHASE4_SOURCE_PACKAGE_BOUNDARY,
  EPISTEMIC_PHASE4_SOURCE_PACKAGES,
} from '../lib/epistemic-phase4-source-packages.ts'

type Json = Record<string, unknown>

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const ASSIGNEE_ID = 'maha_phase4_source_operator'
const ASSIGNEE_NAME = 'Maha Phase 4 source operator'

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function stableKey(...values: string[]): string {
  return createHash('sha256').update(values.join('|')).digest('hex').slice(0, 24)
}

async function requestJson(baseUrl: string, token: string, path: string, init: RequestInit, expected: readonly number[]): Promise<Json> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
  })
  const body = object(await response.json().catch(() => ({})), path)
  if (!expected.includes(response.status)) {
    const error = object(body.error ?? {}, 'error')
    throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${String(error.code ?? 'unknown')} ${String(error.message ?? '')}`)
  }
  return body
}

function blockerCodes(item: Json): string[] {
  return array(item.blockers, 'blockers').map((blocker) => String(blocker.code))
}

async function postQueueEvent(baseUrl: string, token: string, body: Json): Promise<Json> {
  return requestJson(baseUrl, token, '/api/admin/epistemic-work-queue', { method: 'POST', body: JSON.stringify(body) }, [200, 201])
}

export async function operatePhase4SourceCompletion(environment: NodeJS.ProcessEnv = process.env, arguments_ = process.argv.slice(2)): Promise<void> {
  const apply = arguments_.includes('--apply')
  const baseUrl = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const token = environment.EPISTEMIC_OPERATIONS_TOKEN?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('EPISTEMIC_OPERATIONS_TOKEN must contain at least 32 bytes.')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(baseUrl).host)) throw new Error(`Refusing non-Production host ${baseUrl}.`)

  const workspace = await requestJson(baseUrl, token, '/api/admin/epistemic-work-queue', { method: 'GET' }, [200])
  const sourceItems = array(workspace.sourceCompletion, 'sourceCompletion')
  const packageByRecord = new Map(EPISTEMIC_PHASE4_SOURCE_PACKAGES.map((entry) => [entry.recordId, entry]))
  const planned = sourceItems.flatMap((item) => {
    const recordId = String(item.recordId)
    const sourcePackage = packageByRecord.get(recordId)
    if (!sourcePackage) return []
    const blockers = blockerCodes(item)
    const corrections = sourcePackage.corrections.filter((correction) => blockers.includes(correction.blockerCode))
    if (corrections.length !== blockers.length) {
      const missing = blockers.filter((blocker) => !corrections.some((correction) => correction.blockerCode === blocker))
      throw new Error(`${recordId} has source blockers without a researched correction: ${missing.join(', ')}`)
    }
    return [{ item, corrections }]
  })

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} Phase 4 source completion`)
  console.log(`Host: ${baseUrl}`)
  console.log(`Current researched targets: ${planned.length}`)
  console.log(EPISTEMIC_PHASE4_SOURCE_PACKAGE_BOUNDARY)
  if (!apply) {
    for (const { item, corrections } of planned) console.log(`PLAN ${String(item.recordId)} (${corrections.length} corrections; state ${String(item.state)})`)
    console.log('No state changed. Re-run with --apply after reviewing this plan.')
    return
  }

  for (const { item, corrections } of planned) {
    const recordId = String(item.recordId)
    const targetSha256 = String(item.targetSha256)
    const blockers = blockerCodes(item)
    let state = String(item.state)
    const common = { recordId, targetSha256, blockerCodes: blockers }
    if (state === 'untriaged') {
      await postQueueEvent(baseUrl, token, {
        ...common, action: 'triage', assigneeId: null, assigneeName: null, evidence: [],
        note: 'Phase 4 operator triage for the frozen source-completion target.',
        idempotencyKey: `phase4-triage-${stableKey(recordId, targetSha256)}`,
      })
      state = 'queued'
    }
    if (state === 'queued' || state === 'assigned') {
      await postQueueEvent(baseUrl, token, {
        ...common, action: 'start', assigneeId: ASSIGNEE_ID, assigneeName: ASSIGNEE_NAME, evidence: [],
        note: 'Begin applying the reviewed Phase 4 operator source package to this frozen target.',
        idempotencyKey: `phase4-start-${stableKey(recordId, targetSha256)}`,
      })
      state = 'in-progress'
    }
    if (state === 'in-progress') {
      const submitted = await postQueueEvent(baseUrl, token, {
        ...common,
        action: 'submit-evidence', assigneeId: ASSIGNEE_ID, assigneeName: ASSIGNEE_NAME,
        evidence: corrections.map(({ blockerCode, sourceUrl, exactLocator, proposedValue, note, rightsBasis }) => ({ blockerCode, sourceUrl, exactLocator, proposedValue, note, rightsBasis })),
        note: 'Submit the bounded Phase 4 source package. Source mismatches remain explicit for invited source-fidelity review.',
        idempotencyKey: `phase4-evidence-${stableKey(recordId, targetSha256)}`,
      })
      const event = object(submitted.event, 'event')
      const eventId = String(event.eventId)
      const compiled = await requestJson(baseUrl, token, '/api/admin/epistemic-reingestion', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'compile', recordId, baseTargetSha256: targetSha256,
          corrections: corrections.map(({ blockerCode, proposedValue }) => ({ blockerCode, evidenceEventId: eventId, proposedValue })),
          note: 'Compile the Phase 4 operator source package into a new immutable draft target for independent expert review.',
          idempotencyKey: `phase4-compile-${stableKey(recordId, targetSha256)}`,
        }),
      }, [200, 201])
      const compilation = object(compiled.compilation, 'compilation')
      console.log(`COMPILED ${recordId} -> ${String(compilation.outputReviewTargetSha256)}`)
      continue
    }
    if (state === 'ready-for-reingestion') {
      throw new Error(`${recordId} already has submitted evidence. Compile it through the private re-ingestion workspace so its existing evidence-event identity is preserved.`)
    }
    throw new Error(`${recordId} is in unsupported source-completion state ${state}.`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await operatePhase4SourceCompletion()
}
