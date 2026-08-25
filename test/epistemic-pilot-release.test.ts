import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  EPISTEMIC_PILOT_RELEASE_RECORDS,
  EPISTEMIC_PILOT_RELEASE_ROUTES,
  EPISTEMIC_PILOT_WITHHELD_HYPOTHESES,
  getEpistemicPilotDomainLifecycle,
} from '../lib/epistemic-pilot-release.ts'
import { EPISTEMIC_SCHEMA_VERSION } from '../lib/epistemic-schema.ts'

const root = new URL('../', import.meta.url)

test('the complete foundational pilot release is a fixed 23 plus 23 cohort', () => {
  assert.equal(EPISTEMIC_PILOT_RELEASE_RECORDS.length, 46)
  assert.equal(new Set(EPISTEMIC_PILOT_RELEASE_ROUTES).size, 46)
  assert.equal(EPISTEMIC_PILOT_RELEASE_RECORDS.filter((record) => record.domainSlug === 'quantum-systems').length, 23)
  assert.equal(EPISTEMIC_PILOT_RELEASE_RECORDS.filter((record) => record.domainSlug === 'synthetic-biology').length, 23)
  assert.equal(EPISTEMIC_PILOT_WITHHELD_HYPOTHESES.length, 2)
})

test('every pilot record carries the complete claim-level rendering contract', () => {
  for (const record of EPISTEMIC_PILOT_RELEASE_RECORDS) {
    assert.equal(record.schemaVersion, EPISTEMIC_SCHEMA_VERSION)
    assert.ok(record.claims.length > 0, record.id)
    assert.ok(record.sources.length > 0, record.id)
    const sourceIds = new Set(record.sources.map((source) => source.id))
    for (const source of record.sources) {
      assert.ok(source.url.startsWith('https://'), source.id)
      assert.ok(source.exactLocator.trim(), source.id)
      assert.ok(source.establishes.trim(), source.id)
      assert.ok(source.boundary.trim(), source.id)
      assert.ok(source.rights.note.trim(), source.id)
    }
    for (const claim of record.claims) {
      assert.ok(claim.scope.trim(), claim.id)
      assert.ok(claim.boundary.trim(), claim.id)
      assert.ok(claim.uncertainty.statement.trim(), claim.id)
      assert.ok(claim.replication.assessment.trim(), claim.id)
      assert.ok(claim.sourceIds.every((sourceId) => sourceIds.has(sourceId)), claim.id)
    }
  }
})

test('domain lifecycle becomes active only when all 23 factory records are public', () => {
  const empty = getEpistemicPilotDomainLifecycle('quantum-systems', new Set())
  assert.equal(empty.status, 'adversarial-pilot')
  assert.equal(empty.outstandingFactoryRecords, 23)
  const quantumIds = new Set(EPISTEMIC_PILOT_RELEASE_RECORDS.filter((record) => record.domainSlug === 'quantum-systems').map((record) => record.id))
  const active = getEpistemicPilotDomainLifecycle('quantum-systems', quantumIds)
  assert.deepEqual(active, {
    status: 'active-structured-domain',
    foundationalTarget: 23,
    canonicalFactoryRecords: 23,
    outstandingFactoryRecords: 0,
  })
})

test('the production batch remains human-gated and checks all public projections', async () => {
  const [script, workflow, page] = await Promise.all([
    readFile(new URL('scripts/run-production-epistemic-pilot-release.ts', root), 'utf8'),
    readFile(new URL('.github/workflows/production-epistemic-pilot-release.yml', root), 'utf8'),
    readFile(new URL('app/knowledge/[kind]/page.tsx', root), 'utf8'),
  ])
  assert.match(script, /PROMOTE_46_PILOT_RECORDS/)
  assert.match(script, /The exact-hash review gate refused publication/)
  assert.ok(script.indexOf("operation: 'preview'") < script.indexOf("operation: 'publish'"))
  for (const contract of ['sitemap.xml', 'llms.txt', 'Active structured domain', 'maha-epistemic/1.0', 'Exact locator']) assert.ok(script.includes(contract), contract)
  assert.match(workflow, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
  assert.match(page, /Active structured domain/)
})
