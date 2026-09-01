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

test('ExactZK is discoverable from Knowledge in three bounded HTML fetches', () => {
  const knowledge = readFileSync(join(ROOT, 'app/knowledge/page.tsx'), 'utf8')
  const index = readFileSync(join(ROOT, 'app/knowledge/integrations/page.tsx'), 'utf8')
  const record = readFileSync(join(ROOT, 'app/knowledge/integrations/exactzk-independent-reproduction/page.tsx'), 'utf8')

  assert.ok(knowledge.includes('KNOWLEDGE_INTEGRATIONS_PATH'))
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
