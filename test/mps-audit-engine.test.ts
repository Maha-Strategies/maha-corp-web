import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MpsAuditError,
  auditInputHash,
  parseMpsAuditResponse,
  runMpsAudit,
  validateAuditPassage,
} from '../lib/mps-audit-engine.ts'

const passage = 'Researchers reported that coastal wetlands reduce storm surge, but the result remains uncertain across every coastline.'

test('validates and hashes an audit passage deterministically', () => {
  assert.equal(validateAuditPassage(`  ${passage}  `), passage)
  assert.equal(auditInputHash(passage), auditInputHash(passage))
  assert.notEqual(auditInputHash(passage), auditInputHash(`${passage} More text.`))
})

test('rejects empty and oversized passages', () => {
  assert.throws(() => validateAuditPassage(''), (error: unknown) => error instanceof MpsAuditError && error.status === 400)
  assert.throws(() => validateAuditPassage('x'.repeat(6_001)), (error: unknown) => error instanceof MpsAuditError && error.status === 413)
})

test('parses only exact, valid, non-duplicate claims', () => {
  const raw = JSON.stringify({
    claims: [
      {
        excerpt: 'Researchers reported that coastal wetlands reduce storm surge, but the result remains uncertain',
        tag: 'BOUNDARY',
        rationale: 'The statement explicitly frames the evidence as uncertain.',
        action: 'cite',
      },
      {
        excerpt: 'Researchers reported that coastal wetlands reduce storm surge, but the result remains uncertain',
        tag: 'BOUNDARY',
        rationale: 'Duplicate claim.',
        action: 'cite',
      },
      {
        excerpt: 'This sentence was not in the passage and cannot be accepted by the engine.',
        tag: 'SOURCED',
        rationale: 'Not an exact excerpt.',
        action: 'none',
      },
    ],
  })
  const claims = parseMpsAuditResponse(raw, passage)
  assert.equal(claims.length, 1)
  assert.equal(claims[0].tag, 'BOUNDARY')
  assert.equal(claims[0].action, 'cite')
})

test('runs provider-neutral audit logic and returns an input hash', async () => {
  const result = await runMpsAudit(passage, async () => JSON.stringify({
    claims: [{
      excerpt: 'Researchers reported that coastal wetlands reduce storm surge, but the result remains uncertain',
      tag: 'BOUNDARY',
      rationale: 'The phrase describes a limit on what is known.',
      action: 'cite',
    }],
  }))
  assert.equal(result.mps_version, '0.1')
  assert.match(result.input_hash, /^sha256:[a-f0-9]{64}$/)
  assert.equal(result.claims.length, 1)
})
