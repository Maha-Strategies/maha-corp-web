import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { authorizeRegistry } from '../lib/celestial-hypotheses/authorization.ts'
import { registryJson } from '../lib/celestial-hypotheses/route-support.ts'
import { REGISTRY_EPISTEMIC_BOUNDARY } from '../lib/celestial-hypotheses/types.ts'

const TOKEN = 'registry-test-token-that-is-at-least-32-bytes-long'

const ROUTES = [
  '../app/api/v1/celestial-hypotheses/drafts/route.ts',
  '../app/api/v1/celestial-hypotheses/[experimentId]/route.ts',
  '../app/api/v1/celestial-hypotheses/[experimentId]/outcomes/route.ts',
  '../app/api/v1/celestial-hypotheses/[experimentId]/provenance/route.ts',
  '../app/api/v1/celestial-hypotheses/[experimentId]/register/route.ts',
]

async function routeSources(): Promise<string[]> {
  return Promise.all(ROUTES.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
}

test('the registry exposes no PATCH, PUT, or DELETE mutation handler', async () => {
  for (const source of await routeSources()) {
    assert.doesNotMatch(source, /export (async )?function (PATCH|PUT|DELETE)\b/)
  }
})

test('every route is private, dynamic, no-store, and passes through the shared gate', async () => {
  for (const source of await routeSources()) {
    assert.match(source, /export const dynamic = 'force-dynamic'/)
    assert.match(source, /openGate\(request/)
  }
})

test('missing registry authorization fails closed and carries the epistemic boundary', async () => {
  const before = process.env.CELESTIAL_REGISTRY_TOKEN
  delete process.env.CELESTIAL_REGISTRY_TOKEN
  try {
    const authorization = authorizeRegistry(new Request('https://example.test'))
    assert.equal(authorization.kind, 'unconfigured')
    const response = registryJson({ error: { code: 'registry_unavailable' } }, 503)
    const result = await response.json() as { epistemicBoundary?: string }
    assert.equal(result.epistemicBoundary, REGISTRY_EPISTEMIC_BOUNDARY)
  } finally {
    if (before !== undefined) process.env.CELESTIAL_REGISTRY_TOKEN = before
  }
})

test('the configured token requires an exact bearer match', () => {
  const before = process.env.CELESTIAL_REGISTRY_TOKEN
  process.env.CELESTIAL_REGISTRY_TOKEN = TOKEN
  try {
    assert.equal(authorizeRegistry(new Request('https://example.test')).kind, 'unauthorized')
    assert.equal(authorizeRegistry(new Request('https://example.test', { headers: { Authorization: `Bearer ${TOKEN}` } })).kind, 'authorized')
  } finally {
    if (before === undefined) delete process.env.CELESTIAL_REGISTRY_TOKEN; else process.env.CELESTIAL_REGISTRY_TOKEN = before
  }
})
