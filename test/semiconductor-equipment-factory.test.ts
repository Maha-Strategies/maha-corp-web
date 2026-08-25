import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  SEMICONDUCTOR_EQUIPMENT_FACTORY_BOUNDARY,
  SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES,
} from '../lib/semiconductor-equipment-factory.ts'

const ROOT = new URL('../', import.meta.url)

test('equipment factory cohort is exactly the 25 live equipment-class records', () => {
  assert.equal(SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.length, 25)
  assert.equal(new Set(SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map((candidate) => candidate.sourceRecordId)).size, 25)
  assert.equal(new Set(SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map((candidate) => candidate.record.id)).size, 25)
  for (const candidate of SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES) {
    assert.equal(candidate.adapterId, 'semiconductor')
    assert.match(candidate.sourceRecordId, /^equipment-/)
    assert.match(candidate.sourcePublicPath, /^\/knowledge\/equipment\//)
    assert.equal(candidate.record.domainSlug, 'semiconductor')
    assert.equal(candidate.record.publication.reviewState, 'draft')
    assert.equal(candidate.record.publication.requestedPublicPromotion, false)
  }
})

test('equipment cohort covers the requested critical process-tool families', () => {
  const slugs = new Set(SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map((candidate) => candidate.record.slug))
  for (const slug of [
    'duv-immersion-lithography-scanner',
    'euv-and-high-na-euv-lithography-scanner',
    'chemical-vapor-deposition-reactor',
    'atomic-layer-deposition-reactor',
    'plasma-etch-and-atomic-layer-etch-system',
    'chemical-mechanical-planarization-polisher',
    'optical-patterned-wafer-inspection-system',
    'electron-beam-defect-review-and-inspection-system',
    'overlay-critical-dimension-and-film-metrology-system',
  ]) assert.ok(slugs.has(slug), slug)
  assert.match(SEMICONDUCTOR_EQUIPMENT_FACTORY_BOUNDARY, /do not independently prove performance, supplier ranking, process qualification, yield/)
})

test('production operation is exact-batch, idempotent, human-gated, and fail-closed', async () => {
  const [script, workflow, migration] = await Promise.all([
    readFile(new URL('scripts/run-semiconductor-equipment-batch.ts', ROOT), 'utf8'),
    readFile(new URL('.github/workflows/production-semiconductor-equipment-batch.yml', ROOT), 'utf8'),
    readFile(new URL('supabase/migrations/20260825180000_epistemic_factory_packet_targets.sql', ROOT), 'utf8'),
  ])
  for (const contract of [
    '/api/admin/epistemic-factory/jobs',
    '/api/admin/epistemic-factory/worker',
    '/api/admin/epistemic-factory',
    '/api/admin/epistemic-reviews',
    '/api/admin/epistemic-releases',
    'PROMOTE_25_EQUIPMENT_RECORDS',
    'The exact-hash publication gate refused',
    "stableKey\\(candidate.record.id, candidate.reviewTargetSha256\\)",
    'only \\${exactHashPackets.filter\\(Boolean\\).length}/25 exact-hash reviewer packets could be verified',
    'Equipment\\s*·\\s*25',
    '/sitemap.xml',
  ]) assert.match(script, new RegExp(contract))
  assert.ok(script.indexOf("operation: 'preview'") < script.indexOf("operation: 'publish'"))
  assert.match(workflow, /environment: production-database/)
  assert.match(workflow, /EPISTEMIC_OPERATIONS_TOKEN/)
  assert.match(workflow, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
  assert.match(migration, /create or replace function public\.record_epistemic_factory_run/)
  assert.match(migration, /from public\.epistemic_factory_draft_targets/)
  assert.match(migration, /'factory'::text as target_origin/)
  assert.match(migration, /Reviewer packet is not bound to the latest immutable draft target/)
  assert.match(migration, /revoke all on function public\.record_epistemic_factory_run/)
})
