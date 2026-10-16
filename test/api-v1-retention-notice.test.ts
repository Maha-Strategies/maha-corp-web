import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { modularRetentionNotice, retentionDuration } from '../lib/api-v1/retention-notice.ts'
import { PUBLICATION_RECOVERY_SECONDS, recoverySeconds } from '../lib/api-v1/types.ts'

test('the public banner reflects all 1000 enforced contracts, including five 30-day exceptions', () => {
  assert.equal(PRODUCTION_ENDPOINTS.length, 1000)
  assert.equal(PRODUCTION_ENDPOINTS.filter(e => recoverySeconds(e) === PUBLICATION_RECOVERY_SECONDS).length, 5)
  assert.equal(modularRetentionNotice(PRODUCTION_ENDPOINTS), 'Result content (995 services: 24 hours; 5 services: 30 days). Minimal purchase metadata: 90 days from creation; recovery does not extend deadlines.')
})
test('wording is derived, not a hard-coded count or default policy', () => {
  const endpoint = PRODUCTION_ENDPOINTS[0]
  assert.match(modularRetentionNotice([{ ...endpoint, recoverySeconds: PUBLICATION_RECOVERY_SECONDS }]), /1 service: 30 days/)
  assert.equal(retentionDuration(86400), '24 hours')
  assert.equal(retentionDuration(2592000), '30 days')
  assert.equal(retentionDuration(3600), '1 hour')
  for (const bad of [0, -1, NaN, Infinity, 1.2]) assert.throws(() => retentionDuration(bad))
})
test('catalogue banner and every modular card use the shared contract policy', () => {
  const page = readFileSync('app/developers/x402-products/page.tsx', 'utf8')
  assert.match(page, /modularRetentionNotice\(PRODUCTION_ENDPOINTS\)/)
  assert.match(page, /retentionDuration\(recoverySeconds\(e\)\)/)
  assert.doesNotMatch(page, /Result content: 24 hours/)
  const privacy = readFileSync('app/developers/x402-privacy/page.tsx', 'utf8')
  assert.match(privacy, /modularRetentionNotice\(PRODUCTION_ENDPOINTS\)/)
  assert.match(privacy, /PRODUCTION_ENDPOINTS.length/)
  assert.doesNotMatch(privacy, /296 released modular/)
})
