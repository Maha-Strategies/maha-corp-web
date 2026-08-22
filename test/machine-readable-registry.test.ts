import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { buildLlmsManifest } from '../lib/llms-manifest.ts'

const PUBLIC = join(import.meta.dirname, '..', 'public')
const DISCOVERY = join(import.meta.dirname, '..', 'content', 'discovery')
const REGISTRY_URL = 'https://www.mahastrategies.com/maha-machine-readable-registry.json'
const SCHEMA_URL = 'https://www.mahastrategies.com/maha-machine-readable-registry.schema.json'

type Registry = {
  $schema: string
  registryVersion: string
  assertionBoundary: { publicOnly: boolean; noCredentialOrCustomerData: boolean; doesNotGuarantee: string[] }
  resources: Array<{ id: string; url: string; machineReadable: boolean; evidenceBoundary: string; evidence?: string[]; schemas?: string[] }>
}

test('machine-readable registry is public-only, bounded, and self-described', () => {
  const registry = JSON.parse(readFileSync(join(PUBLIC, 'maha-machine-readable-registry.json'), 'utf8')) as Registry
  assert.equal(registry.$schema, SCHEMA_URL)
  assert.match(registry.registryVersion, /^\d+\.\d+\.\d+$/)
  assert.equal(registry.assertionBoundary.publicOnly, true)
  assert.equal(registry.assertionBoundary.noCredentialOrCustomerData, true)
  assert.ok(registry.assertionBoundary.doesNotGuarantee.some((item) => item.includes('crawled')))

  const ids = new Set<string>()
  for (const resource of registry.resources) {
    assert.equal(ids.has(resource.id), false, `duplicate resource id ${resource.id}`)
    ids.add(resource.id)
    assert.ok(resource.url.startsWith('https://www.mahastrategies.com/'), `${resource.id} must use Maha's public origin`)
    assert.ok(resource.evidenceBoundary.length > 30, `${resource.id} needs an explicit evidence boundary`)
    for (const url of [...(resource.evidence ?? []), ...(resource.schemas ?? [])]) {
      assert.ok(url.startsWith('https://www.mahastrategies.com/'), `${resource.id} must not catalog a private or third-party URL`)
    }
  }
})

test('registry is linked from both principal discovery surfaces', () => {
  const card = JSON.parse(readFileSync(join(DISCOVERY, 'agent-card.json'), 'utf8')) as { machineReadableRegistry?: string }
  assert.equal(card.machineReadableRegistry, REGISTRY_URL)
  assert.ok(buildLlmsManifest([]).includes(REGISTRY_URL))
})
