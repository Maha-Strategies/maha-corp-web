import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { BATCH_11_REVISED_RECORDS } from '../lib/batch-11-revision-canary.ts'
import { sha256Canonical } from '../lib/epistemic-publication.ts'

const output = resolve('content/epistemic/batch-11-revision-ingestion-records.json')
const body = {
  schemaVersion: 'maha-batch-11-revision-ingestion/1.0',
  purpose: 'exact-record-ingestion-snapshot',
  recordsSha256: sha256Canonical(BATCH_11_REVISED_RECORDS),
  records: BATCH_11_REVISED_RECORDS,
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(body, null, 2)}\n`)
console.log(JSON.stringify({ output, records: body.records.length, recordsSha256: body.recordsSha256 }))
