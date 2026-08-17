import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { assertSanitizedCelestialStudyEvidence } from '../scripts/run-production-celestial-study.ts'

test('published celestial study evidence rejects participant and natal material', () => {
  assert.doesNotThrow(() => assertSanitizedCelestialStudyEvidence({ corpus: { definitionSha256: 'sha256:abc' } }))
  for (const unsafe of [
    { participantPseudonym: 'pseudo_private01' },
    { nested: { natalProfileSha256: 'sha256:private' } },
    { location: { latitudeDegrees: 1 } },
    { note: 'pseudo_private01' },
    { date: '2000-01-01' },
  ]) assert.throws(() => assertSanitizedCelestialStudyEvidence(unsafe))
})

test('the production workflow is manual, approval-gated, and publishes only the sanitized output', async () => {
  const workflow = await readFile(new URL('../.github/workflows/production-celestial-study.yml', import.meta.url), 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /environment:\n\s+name: production-canary/)
  assert.match(workflow, /CELESTIAL_REGISTRY_TOKEN: \$\{\{ secrets\.CELESTIAL_REGISTRY_TOKEN \}\}/)
  assert.match(workflow, /production-celestial-study\.json/)
  assert.doesNotMatch(workflow, /schedule:/)
})
