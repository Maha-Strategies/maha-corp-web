import assert from 'node:assert/strict'
import test from 'node:test'

import { METERED_PATH, accessModeFrom, metersAtProxy, statusClassOf } from '../lib/context-compiler-metering.ts'

// proxy.ts answers challenges and refusals itself and returns before the route
// runs, so the route's metering wrapper cannot observe them. These assert the
// predicate that decides what the proxy records, and in particular that it
// never records what the route already will.

test('a challenge is metered at the proxy', () => {
  assert.equal(metersAtProxy(METERED_PATH, 'challenge'), true)
})

test('a refusal is not counted as discovery', () => {
  // A replay, a full resource or an unreadable ledger all happen after a
  // payment was presented. Counting them in the acquisition denominator would
  // fold post-payment failures into a pre-payment number and understate
  // conversion by exactly the count of things that broke later.
  assert.equal(metersAtProxy(METERED_PATH, 'refused'), false)
})

test('a paid admission is never metered at the proxy', () => {
  // It reaches the route, which records it. Counting it here as well would
  // double every settlement in the funnel.
  assert.equal(metersAtProxy(METERED_PATH, 'paid'), false)
})

test('a path with no price is not metered at all', () => {
  assert.equal(metersAtProxy(METERED_PATH, 'not_applicable'), false)
})

test('challenges for other resources do not land in the compiler meter', () => {
  // The table is specific to the Context Compiler; folding another priced
  // resource into it would silently inflate its discovery denominator.
  assert.equal(metersAtProxy('/api/v1/jobs/qubo-ising', 'challenge'), false)
  assert.equal(metersAtProxy('/api/v1/compress/other', 'challenge'), false)
})

test('a 402 is classified as a client status, not a server fault', () => {
  assert.equal(statusClassOf(402), '4xx')
  assert.equal(statusClassOf(409), '4xx')
  assert.equal(statusClassOf(429), '4xx')
  assert.equal(statusClassOf(503), '5xx')
  assert.equal(statusClassOf(201), '2xx')
})

test('access mode is read from proxy-injected headers, never inferred', () => {
  const headers = (entries: Record<string, string>) => new Headers(entries)
  assert.deepEqual(accessModeFrom(headers({ 'x-maha-access-mode': 'x402' })), { mode: 'x402', credentialId: '' })
  assert.deepEqual(accessModeFrom(headers({ 'x-maha-api-key-id': 'key_1' })), { mode: 'api_key', credentialId: 'key_1' })
  assert.deepEqual(accessModeFrom(headers({})), { mode: 'anonymous', credentialId: '' })
})
