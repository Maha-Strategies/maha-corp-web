import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

type FrozenComponent = { path: string; sha256: string }
type Protocol = {
  schemaVersion: string
  protocolId: string
  verifiedMainSha: string
  evidence: {
    migrationDryRun: { productionMutationPerformed: boolean; pendingMigrations: number; preApplyClassification: string }
    repairedRevisionRelease: { initialReleases: number; replayedReleases: number; operation: string }
    propagationVerification: { records: number; routeHttp200: number; provenanceHttp200: number; sitemapComplete: boolean; llmsTxtComplete: boolean; releaseRegistryComplete: boolean }
  }
  frozenComponents: FrozenComponent[]
  requiredBoundaries: string[]
}

const protocol = JSON.parse(readFileSync('docs/operations/known-good-canonical-release-protocol-v1.json', 'utf8')) as Protocol
const protocolV2 = JSON.parse(readFileSync('docs/operations/known-good-canonical-release-protocol-v2.json', 'utf8')) as {
  schemaVersion: string
  extends: string
  evidence: {
    unappliedMigrationAmendment: {
      previewMutationPerformed: boolean
      productionMutationPerformed: boolean
      baseSha256: string
      currentSha256: string
      disposableDatabaseApplication: {
        externalPrerequisiteRequired: boolean
        tablesCreated: number
        functionsCreated: number
        singleTransaction: boolean
      }
    }
  }
  frozenComponents: FrozenComponent[]
  requiredBoundaries: string[]
}
const protocolV3 = JSON.parse(readFileSync('docs/operations/known-good-canonical-release-protocol-v3.json', 'utf8')) as {
  schemaVersion: string
  extends: string
  status: string
  evidence: {
    cabezonPreview: {
      branch: string
      migrationRunId: number
      migrationResult: string
      productionMutationPerformed: boolean
      lifecycleStatus: string
      sharedBypassCredentialUsed: boolean
      paymentEnabled: boolean
    }
  }
  frozenComponents: FrozenComponent[]
  requiredBoundaries: string[]
}

test('the known-good release protocol is pinned to byte-exact reviewed components', () => {
  assert.equal(protocol.schemaVersion, 'maha-known-good-release-protocol/1.0')
  assert.equal(protocol.frozenComponents.length, 6)
  for (const component of protocol.frozenComponents) {
    const historical = execFileSync('git', ['show', `${protocol.verifiedMainSha}:${component.path}`])
    const actual = createHash('sha256').update(historical).digest('hex')
    assert.equal(actual, component.sha256, `${component.path} does not match the byte-exact v1 historical freeze`)
  }
})

test('protocol v2 explicitly freezes the bounded unapplied witness migration amendment', () => {
  assert.equal(protocolV2.schemaVersion, 'maha-known-good-release-protocol/2.0')
  assert.equal(protocolV2.extends, 'docs/operations/known-good-canonical-release-protocol-v1.json')
  assert.deepEqual(protocolV2.evidence.unappliedMigrationAmendment.disposableDatabaseApplication, {
    externalPrerequisiteRequired: false,
    tablesCreated: 4,
    functionsCreated: 5,
    singleTransaction: true,
  })
  assert.equal(protocolV2.evidence.unappliedMigrationAmendment.previewMutationPerformed, false)
  assert.equal(protocolV2.evidence.unappliedMigrationAmendment.productionMutationPerformed, false)
  const supersededByV3 = new Set(protocolV3.frozenComponents.map((component) => component.path))
  for (const component of protocolV2.frozenComponents) {
    if (supersededByV3.has(component.path)) continue
    const actual = createHash('sha256').update(readFileSync(component.path)).digest('hex')
    assert.equal(actual, component.sha256, `${component.path} changed; create and evidence protocol v3 instead of silently changing v2`)
  }
  assert.match(protocolV2.requiredBoundaries.join('\n'), /No Production database mutation/)
})

test('protocol v3 freezes the isolated CABEZON Preview migration and lifecycle canary', () => {
  assert.equal(protocolV3.schemaVersion, 'maha-known-good-release-protocol/3.0')
  assert.equal(protocolV3.extends, 'docs/operations/known-good-canonical-release-protocol-v2.json')
  assert.equal(protocolV3.status, 'pending-github-token-revocation')
  assert.deepEqual(protocolV3.evidence.cabezonPreview, {
    branch: 'codex/cabezon-preview-adapter',
    migrationRunId: 33173876204,
    migrationResult: 'success',
    productionMutationPerformed: false,
    lifecycleStatus: 'acknowledged',
    sharedBypassCredentialUsed: false,
    paymentEnabled: false,
  })
  for (const component of protocolV3.frozenComponents) {
    const actual = createHash('sha256').update(readFileSync(component.path)).digest('hex')
    assert.equal(actual, component.sha256, `${component.path} does not match the byte-exact v3 freeze`)
  }
  const boundaries = protocolV3.requiredBoundaries.join('\n')
  for (const phrase of ['Preview only', 'exact PR branch', 'No Production credential', 'No purchase or payment', 'fingerprint']) {
    assert.match(boundaries, new RegExp(phrase))
  }
})

test('the frozen evidence records a non-mutating migration check and complete canary projection', () => {
  assert.deepEqual(protocol.evidence.migrationDryRun, {
    runId: 33090092159,
    headSha: 'c91832835c9c56528e5bbf56c1289118fc4a2588',
    conclusion: 'success',
    pendingMigrations: 0,
    preApplyClassification: 'no-delta',
    postApplyClassification: 'not-run',
    convergence: 'not-applicable',
    productionMutationPerformed: false,
  })
  assert.equal(protocol.evidence.repairedRevisionRelease.operation, 'review-publish-verify')
  assert.equal(protocol.evidence.repairedRevisionRelease.initialReleases, 2)
  assert.equal(protocol.evidence.repairedRevisionRelease.replayedReleases, 0)
  assert.deepEqual(
    {
      records: protocol.evidence.propagationVerification.records,
      routes: protocol.evidence.propagationVerification.routeHttp200,
      provenance: protocol.evidence.propagationVerification.provenanceHttp200,
      sitemap: protocol.evidence.propagationVerification.sitemapComplete,
      llms: protocol.evidence.propagationVerification.llmsTxtComplete,
      registry: protocol.evidence.propagationVerification.releaseRegistryComplete,
    },
    { records: 2, routes: 2, provenance: 2, sitemap: true, llms: true, registry: true },
  )
})

test('the protocol retains the release boundaries that made the canary credible', () => {
  const boundaries = protocol.requiredBoundaries.join('\n')
  for (const phrase of ['Production database identity', 'dry-run never applies', 'Unexplained pre-apply drift', 'exact confirmation phrase', 'credentials remain separate', 'exact reviewed record revisions', 'route, provenance, sitemap, llms.txt and registry', 'never represented as external endorsement']) {
    assert.match(boundaries, new RegExp(phrase))
  }
})
