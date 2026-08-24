import { createHash } from 'node:crypto'

import {
  EPISTEMIC_PHASE5_ALIGNMENT_BOUNDARY,
  EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES,
} from '../lib/epistemic-phase5-alignment-packages.ts'

type Json = Record<string, unknown>

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const ASSIGNEE_ID = 'maha_phase5_alignment_operator'
const ASSIGNEE_NAME = 'Maha Phase 5 alignment operator'

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

async function postQueueEvent(baseUrl: string, token: string, body: Json): Promise<Json> {
  return requestJson(baseUrl, token, '/api/admin/epistemic-work-queue', { method: 'POST', body: JSON.stringify(body) }, [200, 201])
}

export async function operatePhase5AlignmentRepair(environment: NodeJS.ProcessEnv = process.env, arguments_ = process.argv.slice(2)): Promise<void> {
  const apply = arguments_.includes('--apply')
  const baseUrl = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const token = environment.EPISTEMIC_OPERATIONS_TOKEN?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('EPISTEMIC_OPERATIONS_TOKEN must contain at least 32 bytes.')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(baseUrl).host)) throw new Error(`Refusing non-Production host ${baseUrl}.`)

  const workspace = await requestJson(baseUrl, token, '/api/admin/epistemic-work-queue', { method: 'GET' }, [200])
  const sourceItems = array(workspace.sourceCompletion, 'sourceCompletion')
  const itemByRecord = new Map(sourceItems.map((item) => [String(item.recordId), item]))
  const planned = EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES.map((sourcePackage) => {
    const item = itemByRecord.get(sourcePackage.recordId)
    if (!item) throw new Error(`${sourcePackage.recordId} is absent from the current source-completion queue.`)
    const blockers = array(item.blockers, 'blockers').map((blocker) => String(blocker.code))
    if (blockers.length !== 1 || blockers[0] !== sourcePackage.blockerCode) {
      throw new Error(`${sourcePackage.recordId} expected only ${sourcePackage.blockerCode}; current blockers: ${blockers.join(', ')}`)
    }
    return { item, sourcePackage }
  })

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} Phase 5 source-alignment repair`)
  console.log(`Host: ${baseUrl}`)
  console.log(`Current alignment targets: ${planned.length}`)
  console.log(EPISTEMIC_PHASE5_ALIGNMENT_BOUNDARY)
  if (!apply) {
    for (const { item, sourcePackage } of planned) console.log(`PLAN ${sourcePackage.recordId} (${sourcePackage.blockerCode}; state ${String(item.state)})`)
    console.log('No state changed. Re-run with --apply after reviewing this plan.')
    return
  }

  for (const { item, sourcePackage } of planned) {
    const recordId = sourcePackage.recordId
    const targetSha256 = String(item.targetSha256)
    const blockerCodes = [sourcePackage.blockerCode]
    const common = { recordId, targetSha256, blockerCodes }
    let state = String(item.state)
    if (state === 'untriaged') {
      await postQueueEvent(baseUrl, token, {
        ...common, action: 'triage', assigneeId: null, assigneeName: null, evidence: [],
        note: 'Phase 5 triage for one frozen source-alignment target.',
        idempotencyKey: `phase5-align-triage-${stableKey(recordId, targetSha256)}`,
      })
      state = 'queued'
    }
    if (state === 'queued' || state === 'assigned') {
      await postQueueEvent(baseUrl, token, {
        ...common, action: 'start', assigneeId: ASSIGNEE_ID, assigneeName: ASSIGNEE_NAME, evidence: [],
        note: 'Begin the evidence-bound source-alignment repair for this frozen target.',
        idempotencyKey: `phase5-align-start-${stableKey(recordId, targetSha256)}`,
      })
      state = 'in-progress'
    }
    if (state !== 'in-progress') throw new Error(`${recordId} is in unsupported source-completion state ${state}.`)

    const submitted = await postQueueEvent(baseUrl, token, {
      ...common,
      action: 'submit-evidence', assigneeId: ASSIGNEE_ID, assigneeName: ASSIGNEE_NAME,
      evidence: [{
        blockerCode: sourcePackage.blockerCode,
        sourceUrl: sourcePackage.sourceUrl,
        exactLocator: sourcePackage.exactLocator,
        proposedValue: sourcePackage.proposedValue,
        note: sourcePackage.note,
        rightsBasis: sourcePackage.rightsBasis,
      }],
      note: 'Submit one bounded Phase 5 alignment package; compilation remains noncanonical and resets all review scopes.',
      idempotencyKey: `phase5-align-evidence-${stableKey(recordId, targetSha256)}`,
    })
    const eventId = String(object(submitted.event, 'event').eventId)
    const compiled = await requestJson(baseUrl, token, '/api/admin/epistemic-reingestion', {
      method: 'POST',
      body: JSON.stringify({
        operation: 'compile', recordId, baseTargetSha256: targetSha256,
        corrections: [{ blockerCode: sourcePackage.blockerCode, evidenceEventId: eventId, proposedValue: sourcePackage.proposedValue }],
        note: 'Compile the bounded Phase 5 source-alignment repair into a new immutable draft target for fresh review.',
        idempotencyKey: `phase5-align-compile-${stableKey(recordId, targetSha256)}`,
      }),
    }, [200, 201])
    console.log(`COMPILED ${recordId} -> ${String(object(compiled.compilation, 'compilation').outputReviewTargetSha256)}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await operatePhase5AlignmentRepair()
