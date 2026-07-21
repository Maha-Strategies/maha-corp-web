import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseSearchConsoleImport,
  parseSearchConsoleQueriesCsv,
  searchConsoleImportCandidates,
  searchConsoleSubmission,
} from '../lib/search-console-ingestion.ts'

const HEADER = 'Top queries,Clicks,Impressions,CTR,Position'

test('parses the Google Search Console Queries.csv shape, including a UTF-8 BOM and quoted queries', () => {
  const rows = parseSearchConsoleQueriesCsv(`\uFEFF${HEADER}\n"claim verification API pricing",0,17,0%,9.4\n"sleep, stage 1",0,4,0%,97`)
  assert.deepEqual(rows, [
    { query: 'claim verification API pricing', clicks: 0, impressions: 17, ctr: 0, position: 9.4 },
    { query: 'sleep, stage 1', clicks: 0, impressions: 4, ctr: 0, position: 97 },
  ])
})

test('rejects a non-Queries export and validates the import date', () => {
  assert.throws(() => parseSearchConsoleQueriesCsv('Top pages,Clicks\n/foo,1'), /Queries\.csv/)
  assert.throws(() => parseSearchConsoleImport({ observedAt: '21-07-2026', csv: `${HEADER}\nquery,0,1,0%,1` }), /ISO date/)
})

test('queues only high-intent, capability-matched first-party searches', () => {
  const highIntent = searchConsoleSubmission({ query: 'claim verification API pricing', clicks: 0, impressions: 17, ctr: 0, position: 9.4 }, '2026-07-21')
  assert.ok(highIntent)
  assert.equal(highIntent.source, 'search_console')
  assert.equal(highIntent.signalClass, 'buyer_demand')
  assert.ok(highIntent.demandEvidence >= 14)
  assert.ok(highIntent.commercialIntent >= 11)
  assert.ok(highIntent.idempotencyKey.length >= 8)

  assert.equal(searchConsoleSubmission({ query: 'stage 1 sleep', clicks: 0, impressions: 4, ctr: 0, position: 97 }, '2026-07-21'), null)
})

test('reports eligible and skipped rows without retaining the raw CSV', () => {
  const input = parseSearchConsoleImport({
    observedAt: '2026-07-21',
    csv: `${HEADER}\nclaim verification API pricing,0,17,0%,9.4\nstage 1 sleep,0,4,0%,97`,
  })
  const result = searchConsoleImportCandidates(input)
  assert.equal(result.eligible.length, 1)
  assert.equal(result.skipped, 1)
})
