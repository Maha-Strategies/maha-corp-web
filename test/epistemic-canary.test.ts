import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  EPISTEMIC_CANARY_CONTROL_RECORDS,
  EPISTEMIC_CANARY_CONTROL_ROUTES,
  EPISTEMIC_CANARY_RECORDS,
  EPISTEMIC_CANARY_ROUTES,
} from '../lib/epistemic-canary.ts'
import { buildDomainRegistry } from '../lib/epistemic-pilots.ts'

const root = new URL('../', import.meta.url)

test('the production canary is a fixed six-of-forty-six split', () => {
  assert.equal(EPISTEMIC_CANARY_RECORDS.length, 6)
  assert.equal(EPISTEMIC_CANARY_CONTROL_RECORDS.length, 40)
  assert.equal(new Set([...EPISTEMIC_CANARY_ROUTES, ...EPISTEMIC_CANARY_CONTROL_ROUTES]).size, 46)
  assert.deepEqual(EPISTEMIC_CANARY_RECORDS.map((record) => record.domainSlug), [
    'quantum-systems', 'quantum-systems', 'quantum-systems',
    'synthetic-biology', 'synthetic-biology', 'synthetic-biology',
  ])
  assert.ok(EPISTEMIC_CANARY_RECORDS.every((record) => record.publication.reviewState === 'draft'))
})

test('the public registry never enumerates draft identity or title metadata', () => {
  for (const domainSlug of ['quantum-systems', 'synthetic-biology']) {
    const registry = buildDomainRegistry(domainSlug)
    assert.ok(registry)
    const serialized = JSON.stringify(registry)
    for (const record of EPISTEMIC_CANARY_CONTROL_RECORDS.filter((candidate) => candidate.domainSlug === domainSlug)) {
      assert.equal(serialized.includes(record.id), false)
      assert.equal(serialized.includes(record.title), false)
    }
    assert.equal(registry.records.length, 1)
    assert.equal(registry.withheldInventory.disclosure, 'aggregate-only')
  }
})

test('canonical release revalidates every public discovery surface', async () => {
  const revalidation = await readFile(new URL('lib/epistemic-revalidation.ts', root), 'utf8')
  for (const path of [
    'release.canonicalPath',
    '`${release.canonicalPath}/provenance.json`',
    '`/knowledge/${release.domainSlug}/registry`',
    "'/sitemap.xml'",
    "'/llms.txt'",
  ]) assert.ok(revalidation.includes(path), path)
})

