import { QUANTUM_SYSTEMS_GRAPH_RECORDS } from '../lib/quantum-systems-graph.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { SYNTHETIC_BIOLOGY_GRAPH_RECORDS } from '../lib/synthetic-biology-graph.ts'
import type { EpistemicRecord } from '../lib/epistemic-schema.ts'

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'

function selectedRecords(arguments_: readonly string[]): EpistemicRecord[] {
  const domain = arguments_.find((argument) => argument.startsWith('--domain='))?.slice('--domain='.length) ?? 'all'
  if (!['all', 'quantum-systems', 'synthetic-biology'].includes(domain)) throw new Error('--domain must be all, quantum-systems, or synthetic-biology.')
  return [
    ...(domain === 'all' || domain === 'quantum-systems' ? QUANTUM_SYSTEMS_GRAPH_RECORDS : []),
    ...(domain === 'all' || domain === 'synthetic-biology' ? SYNTHETIC_BIOLOGY_GRAPH_RECORDS : []),
  ]
}

export async function runFrontierPilotBatch(environment = process.env, arguments_ = process.argv.slice(2)) {
  const records = selectedRecords(arguments_)
  const apply = arguments_.includes('--apply')
  const summary = {
    records: records.length,
    quantumSystems: records.filter((record) => record.domainSlug === 'quantum-systems').length,
    syntheticBiology: records.filter((record) => record.domainSlug === 'synthetic-biology').length,
    reviewTargetSha256s: records.map(epistemicReviewTargetHash).sort(),
    canonical: 0,
    sitemapEligible: 0,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (!apply) {
    console.log('Preview only. Re-run with --apply to enqueue these exact noncanonical records.')
    return
  }
  const token = environment.EPISTEMIC_OPERATIONS_TOKEN?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('EPISTEMIC_OPERATIONS_TOKEN must contain at least 32 bytes.')
  const baseUrl = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(baseUrl).host)) throw new Error(`Refusing non-Production host ${baseUrl}.`)
  let queued = 0
  let replayed = 0
  for (const record of records) {
    const targetSha256 = epistemicReviewTargetHash(record)
    const response = await fetch(`${baseUrl}/api/admin/epistemic-factory/jobs`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        record,
        sourcePublicPath: epistemicRecordPath(record),
        idempotencyKey: `frontier-pilot:${record.id}:${targetSha256}`,
      }),
    })
    const payload = await response.json() as { persistence?: { idempotentReplay?: boolean }; error?: { message?: string } }
    if (!response.ok) throw new Error(`${record.id} returned ${response.status}: ${payload.error?.message ?? 'unknown error'}`)
    if (payload.persistence?.idempotentReplay) replayed += 1
    else queued += 1
  }
  console.log(`Queued ${queued} records; ${replayed} idempotent replays. Run operate:epistemic-factory-worker -- --drain to persist the draft targets.`)
}

if (import.meta.url === `file://${process.argv[1]}`) await runFrontierPilotBatch()

