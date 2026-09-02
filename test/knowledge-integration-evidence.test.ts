import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const SITE = 'https://www.mahastrategies.com'
const INDEX_PATH = '/knowledge/integrations'
const EXACTZK_PATH = `${INDEX_PATH}/exactzk-independent-reproduction`
const SIGNED_PATH = '/artifacts/integrations/exactzk-independent-reproduction-attestation-001.json'
const RECORD_PATH = '/artifacts/integrations/exactzk-independent-reproduction-record-2026-09-01.json'
const NSGOODS_PATH = `${INDEX_PATH}/nsgoods-preflight-v3-fixture-validation`
const NSGOODS_RECORD_PATH = '/artifacts/integrations/nsgoods-preflight-v3-fixture-validation-2026-09-01.json'

test('ExactZK is directly discoverable from the Knowledge starting page', () => {
  const knowledge = readFileSync(join(ROOT, 'app/knowledge/page.tsx'), 'utf8')
  const index = readFileSync(join(ROOT, 'app/knowledge/integrations/page.tsx'), 'utf8')
  const record = readFileSync(join(ROOT, 'app/knowledge/integrations/exactzk-independent-reproduction/page.tsx'), 'utf8')

  assert.ok(knowledge.includes('KNOWLEDGE_INTEGRATIONS_PATH'))
  assert.ok(knowledge.includes('EXACTZK_EVIDENCE_PATH'))
  assert.ok(knowledge.includes('ExactZK independent reproduction'))
  assert.ok(knowledge.includes('Recently published integration evidence'))
  assert.ok(knowledge.includes('signedArtifactPath'))
  assert.ok(knowledge.includes('integrationRecordPath'))
  assert.ok(knowledge.includes('/maha-machine-readable-registry.json'))
  assert.match(knowledge, /Classified as external integration evidence, not canonical domain knowledge/)
  assert.ok(index.includes('EXACTZK_EVIDENCE_PATH'))
  assert.ok(record.includes('signedArtifactPath'))
  assert.ok(record.includes('upstreamPublication'))
  assert.ok(record.includes('Scope boundary'))
})

test('ExactZK HTML routes and machine-readable evidence are present', () => {
  assert.equal(existsSync(join(ROOT, 'app', INDEX_PATH, 'page.tsx')), true)
  assert.equal(existsSync(join(ROOT, 'app', EXACTZK_PATH, 'page.tsx')), true)
  assert.equal(existsSync(join(ROOT, 'public', SIGNED_PATH)), true)
  assert.equal(existsSync(join(ROOT, 'public', RECORD_PATH)), true)

  const signed = readFileSync(join(ROOT, 'public', SIGNED_PATH))
  assert.equal(createHash('sha256').update(signed).digest('hex'), '39ef9f94bec3adf3a85c955ca40381a48c7d20e75afa613a18e600e8bbb8d009')
})

test('ExactZK is included in the sitemap and public machine-readable registry', () => {
  const sitemap = readFileSync(join(ROOT, 'app/sitemap.ts'), 'utf8')
  assert.ok(sitemap.includes('KNOWLEDGE_INTEGRATIONS_PATH'))
  assert.ok(sitemap.includes('EXACTZK_EVIDENCE_PATH'))

  const registry = JSON.parse(readFileSync(join(ROOT, 'public/maha-machine-readable-registry.json'), 'utf8'))
  const exactzk = registry.resources.find((resource: { id: string }) => resource.id === 'exactzk-independent-reproduction')
  assert.ok(exactzk)
  assert.equal(exactzk.url, `${SITE}${EXACTZK_PATH}`)
  assert.deepEqual(exactzk.evidence, [`${SITE}${SIGNED_PATH}`, `${SITE}${RECORD_PATH}`])
  assert.match(exactzk.evidenceBoundary, /does not validate the full escrow system/i)
})

test('NSGoods preflight v3 validation is crawlable, machine-readable and explicitly fixture-only', () => {
  const pagePath = join(ROOT, 'app', NSGOODS_PATH, 'page.tsx')
  assert.equal(existsSync(pagePath), true)
  assert.equal(existsSync(join(ROOT, 'public', NSGOODS_RECORD_PATH)), true)

  const page = readFileSync(pagePath, 'utf8')
  assert.ok(page.includes('Fixture only'))
  assert.ok(page.includes('not a live-endpoint result'))
  assert.ok(page.includes('paid canary is not included'))

  const record = JSON.parse(readFileSync(join(ROOT, 'public', NSGOODS_RECORD_PATH), 'utf8'))
  assert.equal(record.status, 'passed')
  assert.equal(record.boundary.fixtureOnly, true)
  assert.equal(record.boundary.liveEndpointInvoked, false)
  assert.equal(record.boundary.paymentsMade, 0)
  assert.equal(record.verifiedCoverage.componentSignatures, 9)
  assert.equal(record.verifiedCoverage.envelopeSignatures, 3)
  assert.equal(record.verifiedCoverage.tamperCasesRejected, 9)

  const sitemap = readFileSync(join(ROOT, 'app/sitemap.ts'), 'utf8')
  assert.ok(sitemap.includes('NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH'))

  const registry = JSON.parse(readFileSync(join(ROOT, 'public/maha-machine-readable-registry.json'), 'utf8'))
  const entry = registry.resources.find((resource: { id: string }) => resource.id === 'nsgoods-preflight-v3-fixture-validation')
  assert.ok(entry)
  assert.equal(entry.url, `${SITE}${NSGOODS_PATH}`)
  assert.deepEqual(entry.evidence, [`${SITE}${NSGOODS_RECORD_PATH}`])
  assert.match(entry.evidenceBoundary, /does not report a verified live-endpoint/i)
})
