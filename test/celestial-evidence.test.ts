import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { buildBirthReport } from '../lib/birth-report.ts'
import {
  CELESTIAL_EVIDENCE_SIGNING_KEY_ENV,
  verifyCelestialEvidenceBundle,
  type CelestialEvidenceBundle,
} from '../lib/celestial-evidence.ts'

const INPUT = {
  date: '1992-11-30',
  time: '20:09',
  timeZone: 'America/Chicago',
  latitudeDegrees: 48.588,
  longitudeDegrees: -93.4084,
  timingInstantUtc: '2026-08-17T06:45:00.000Z',
  evidenceIssuedAtUtc: '2026-08-17T08:00:00.000Z',
} as const

function withSigningKey<T>(value: string | undefined, operation: () => T): T {
  const before = process.env[CELESTIAL_EVIDENCE_SIGNING_KEY_ENV]
  if (value === undefined) delete process.env[CELESTIAL_EVIDENCE_SIGNING_KEY_ENV]
  else process.env[CELESTIAL_EVIDENCE_SIGNING_KEY_ENV] = value
  try { return operation() } finally {
    if (before === undefined) delete process.env[CELESTIAL_EVIDENCE_SIGNING_KEY_ENV]
    else process.env[CELESTIAL_EVIDENCE_SIGNING_KEY_ENV] = before
  }
}

test('the consumer report carries a complete evidence chain', () => {
  const report = withSigningKey(undefined, () => buildBirthReport(INPUT))
  const bundle = report.evidenceBundle
  assert.equal(bundle.issuer.product, 'Maha Celestial')
  assert.equal(bundle.astronomicalFacts.bundleId, report.factBundleId)
  assert.equal(bundle.chartGeometry.natalChart.version, report.natalChart.version)
  assert.deepEqual(bundle.boundaries.prohibitedUses.length > 0, true)
  assert.ok(bundle.interpretations.every((tradition) => tradition.modules.every((module) => module.passages.length > 0)))
  assert.equal(bundle.proof, null)
  assert.equal(verifyCelestialEvidenceBundle(bundle).status, 'digest-valid')
})

test('a dedicated key signs a bundle and the current issuer verifies it', () => {
  const privateKey = '1'.padStart(64, '0')
  const bundle = withSigningKey(privateKey, () => buildBirthReport(INPUT).evidenceBundle)
  const verification = withSigningKey(privateKey, () => verifyCelestialEvidenceBundle(bundle))
  assert.equal(verification.status, 'issuer-verified')
  assert.equal(verification.digestValid, true)
  assert.equal(verification.signatureValid, true)
  assert.equal(verification.issuerKeyCurrent, true)
})

test('a valid historical signature is distinguished from the current issuer key', () => {
  const bundle = withSigningKey('2'.padStart(64, '0'), () => buildBirthReport(INPUT).evidenceBundle)
  const verification = withSigningKey(undefined, () => verifyCelestialEvidenceBundle(bundle))
  assert.equal(verification.status, 'signature-valid')
  assert.equal(verification.signatureValid, true)
  assert.equal(verification.issuerKeyCurrent, false)
})

test('changing report content after issuance fails closed', () => {
  const bundle = withSigningKey('3'.padStart(64, '0'), () => buildBirthReport(INPUT).evidenceBundle)
  const tampered: CelestialEvidenceBundle = structuredClone(bundle)
  tampered.report.observer.latitudeDegrees += 1
  const verification = withSigningKey('3'.padStart(64, '0'), () => verifyCelestialEvidenceBundle(tampered))
  assert.equal(verification.status, 'invalid')
  assert.equal(verification.digestValid, false)
})

test('the verifier route returns only a no-store verification result', async () => {
  const route = await readFile(new URL('../app/api/v1/celestial/evidence/verify/route.ts', import.meta.url), 'utf8')
  assert.match(route, /export const dynamic = 'force-dynamic'/)
  assert.match(route, /'Cache-Control': 'no-store'/)
  assert.match(route, /MAX_BYTES = 2_000_000/)
  assert.doesNotMatch(route, /console\.(log|info)|\.insert\(|\.upsert\(/)
})

test('the product surface keeps the enterprise and celestial positions separate', async () => {
  const celestial = await readFile(new URL('../app/celestial/page.tsx', import.meta.url), 'utf8')
  const gateway = await readFile(new URL('../app/enterprise-mcp-gateway/page.tsx', import.meta.url), 'utf8')
  assert.match(celestial, /distinct interpretive product vertical/i)
  assert.match(celestial, /not part of Maha Strategies.*enterprise AI Gateway/i)
  assert.doesNotMatch(gateway, /Maha Celestial|astrolog/i)
})
