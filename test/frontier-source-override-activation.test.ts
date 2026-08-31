import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

import {
  PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS,
  PRIVATE_SOURCE_OVERRIDE_CANARY,
  SOURCE_OVERRIDE_REJECT_RECORD_IDS,
  SOURCE_OVERRIDE_REVISE_RECORD_IDS,
} from '../lib/frontier-source-override-activation.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { epistemicReviewTargetHash, sha256Canonical } from '../lib/epistemic-publication.ts'

test('activation preserves the 26/13/1 decision split and changes no active binding', () => {
  assert.equal(PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.length, 26)
  assert.equal(SOURCE_OVERRIDE_REVISE_RECORD_IDS.length, 13)
  assert.equal(SOURCE_OVERRIDE_REJECT_RECORD_IDS.length, 1)
  for (const activation of PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS) {
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === activation.recordId)
    assert.ok(record)
    assert.equal(epistemicReviewTargetHash(record), activation.priorRecordRevisionSha256)
    assert.ok(record.sources.some((source) => source.id === activation.priorSourceContractId))
    assert.ok(!record.sources.some((source) => source.id === activation.proposedSourceContractId))
    assert.equal(activation.activationSha256, sha256Canonical({ ...activation, activationSha256: undefined }))
    assert.equal(activation.canonicalMutationAuthorized, false)
    assert.equal(activation.publicProjectionAuthorized, false)
    assert.equal(activation.releaseAuthorized, false)
  }
})

test('private canary contains five accepted candidates and remains noncanonical', () => {
  assert.equal(PRIVATE_SOURCE_OVERRIDE_CANARY.length, 5)
  for (const canary of PRIVATE_SOURCE_OVERRIDE_CANARY) {
    const activation = PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.find((entry) => entry.recordId === canary.recordId)
    assert.ok(activation)
    assert.equal(canary.activationSha256, activation.activationSha256)
    assert.equal(canary.state, 'verified-private-only')
    assert.equal(canary.activeBindingChanged, false)
    assert.equal(canary.canonicalMutationAuthorized, false)
    assert.equal(canary.publicProjectionAuthorized, false)
    assert.equal(canary.releaseAuthorized, false)
  }
})

test('generated activation artifact is deterministic and private', async () => {
  const run = () => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-source-override-activation.ts'], {
    cwd: process.cwd(), encoding: 'utf8', env: process.env,
  })
  assert.equal(run().status, 0)
  const first = await readFile('content/epistemic/frontier-source-override-activation.json', 'utf8')
  assert.equal(run().status, 0)
  const second = await readFile('content/epistemic/frontier-source-override-activation.json', 'utf8')
  assert.equal(second, first)
  assert.doesNotMatch(first, /"canonicalMutationAuthorized": true|"publicProjectionAuthorized": true|"releaseAuthorized": true/)
})

test('activation artifacts are absent from public route and index sources', async () => {
  const publicSources = await Promise.all([
    readFile('app/sitemap.ts', 'utf8'),
    readFile('app/llms.txt/route.ts', 'utf8'),
  ])
  assert.doesNotMatch(publicSources.join('\n'), /frontier-source-override-activation|private-revision-ready/)
})
