import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

import { sha256Canonical } from '../lib/epistemic-publication.ts'
import { SUBSTANTIAL_BATCH_3_PAGES } from '../lib/substantial-page-publication-batch-3.ts'
import {
  buildSubstantialMcpDeliveryReceipt,
  verifySubstantialMcpDeliveryReceipt,
  type LicensedProjectionBinding,
} from '../lib/substantial-mcp-delivery-receipt.ts'

const page = SUBSTANTIAL_BATCH_3_PAGES[0]
const release = page.releaseEvidence
const binding: LicensedProjectionBinding = {
  executionId: 'mcpexe_00000000000000000000000000000001',
  requestSha256: sha256Canonical({ request: 1 }),
  projectionSha256: sha256Canonical({ projection: 1 }),
  releaseId: release.releaseId,
  releaseSha256: sha256Canonical(release),
  targetSha256: release.targetSha256,
  canonicalPath: release.canonicalPath,
  recordId: page.contract.recordId,
}

test('receipt binds one licensed output to the exact substantial revision and route', () => {
  const receipt = buildSubstantialMcpDeliveryReceipt(binding, page)
  assert.equal(receipt.release.targetSha256, page.contract.recordRevisionSha256)
  assert.equal(receipt.release.canonicalPath, page.path)
  assert.equal(receipt.substantialPublication.publicationDigest, page.publicationDigest)
  assert.equal(receipt.substantialPublication.unsupportedExplanationParagraphs, 0)
  assert.equal(receipt.entitlementChangesEvidenceQuality, false)
  assert.equal(verifySubstantialMcpDeliveryReceipt(receipt, binding, page), true)
})

test('stale revisions, substituted routes, and tampered receipts fail closed', () => {
  assert.throws(() => buildSubstantialMcpDeliveryReceipt({ ...binding, targetSha256: sha256Canonical('stale') }, page), /exact substantial page/)
  assert.throws(() => buildSubstantialMcpDeliveryReceipt({ ...binding, canonicalPath: '/knowledge/substituted/concepts/substituted' }, page), /exact substantial page/)
  const receipt = buildSubstantialMcpDeliveryReceipt(binding, page)
  assert.equal(verifySubstantialMcpDeliveryReceipt({ ...receipt, deliveryState: 'private-machine-delivery', receiptSha256: sha256Canonical('tampered') }, binding, page), false)
})

test('idempotent replay creates byte-identical delivery receipts', () => {
  assert.deepEqual(buildSubstantialMcpDeliveryReceipt(binding, page), buildSubstantialMcpDeliveryReceipt(binding, page))
})

test('private canary regenerates byte-identically and stays outside public indexes', async () => {
  const run = () => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-substantial-mcp-private-canary.ts'], {
    cwd: process.cwd(), encoding: 'utf8', env: process.env,
  })
  assert.equal(run().status, 0)
  const first = await readFile('content/mcp-evidence/substantial-delivery-private-canary.json', 'utf8')
  assert.equal(run().status, 0)
  const second = await readFile('content/mcp-evidence/substantial-delivery-private-canary.json', 'utf8')
  assert.equal(second, first)
  const publicSources = await Promise.all([readFile('app/sitemap.ts', 'utf8'), readFile('app/llms.txt/route.ts', 'utf8')])
  assert.doesNotMatch(publicSources.join('\n'), /substantial-delivery-private-canary|private-machine-delivery/)
  const artifact = JSON.parse(first) as { secretsIncluded: boolean; receipt: Record<string, unknown> }
  assert.equal(artifact.secretsIncluded, false)
  assert.doesNotMatch(JSON.stringify(artifact.receipt), /bearerToken|credentialId|actorFingerprint|authorization/i)
})
