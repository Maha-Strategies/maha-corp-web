import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const CANONICAL = join(ROOT, 'artifacts/integrations/fulcra-flow-state-pr-33.json')
const PUBLISHED = join(ROOT, 'public/artifacts/integrations/fulcra-flow-state-pr-33.json')

type FulcraEvidence = {
  integration: { pullRequestNumber: number; state: string; mergeCommit: string }
  license: { status: string; upstreamLicense: string }
  publicDisclosure: Record<string, boolean>
  privateSessionValidation: {
    sharingScope: string
    completionStatus: string
    sourceAudio: string
    thirdPartyAudioUsed: boolean
    markerDetections: number
    provenanceVerified: boolean
    liveFulcraPublicationReadBackVerified: boolean
    shareRecordCreated: boolean
    privateArtifactsRetainedOutsideRepository: boolean
  }
  nonClaims: string[]
  claimBoundary: string
}

test('Fulcra PR #33 evidence is published byte-identically', () => {
  assert.deepEqual(readFileSync(PUBLISHED), readFileSync(CANONICAL))
})

test('Fulcra evidence records the upstream merge without inflating the claim', () => {
  const artifact = JSON.parse(readFileSync(CANONICAL, 'utf8')) as FulcraEvidence

  assert.equal(artifact.integration.pullRequestNumber, 33)
  assert.equal(artifact.integration.state, 'merged')
  assert.equal(artifact.integration.mergeCommit, 'd3f43719c4d1b7c333ce592f14400b47f99891f1')
  assert.equal(artifact.license.status, 'resolved')
  assert.equal(artifact.license.upstreamLicense, 'MIT')

  assert.ok(Object.values(artifact.publicDisclosure).every((value) => value === false))
  assert.equal(artifact.privateSessionValidation.sharingScope, 'private')
  assert.equal(artifact.privateSessionValidation.completionStatus, 'completed_private')
  assert.equal(artifact.privateSessionValidation.sourceAudio, 'original_synthetic_tones')
  assert.equal(artifact.privateSessionValidation.thirdPartyAudioUsed, false)
  assert.equal(artifact.privateSessionValidation.markerDetections, 1)
  assert.equal(artifact.privateSessionValidation.provenanceVerified, true)
  assert.equal(artifact.privateSessionValidation.liveFulcraPublicationReadBackVerified, true)
  assert.equal(artifact.privateSessionValidation.shareRecordCreated, false)
  assert.equal(artifact.privateSessionValidation.privateArtifactsRetainedOutsideRepository, true)
  assert.match(artifact.claimBoundary, /does not establish a human performance result/i)
  assert.ok(artifact.nonClaims.some((claim) => /not a Fulcra partnership/i.test(claim)))
})

test('public Fulcra evidence contains no local path, private material or credential-shaped value', () => {
  const text = readFileSync(PUBLISHED, 'utf8')
  for (const forbidden of ['/Users/', '/private/tmp', 'file://', 'PRIVATE KEY', 'Bearer ', 'api_key', 'access_token']) {
    assert.ok(!text.includes(forbidden), `public Fulcra evidence contains ${forbidden}`)
  }
})
