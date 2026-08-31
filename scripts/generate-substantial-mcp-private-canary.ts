import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { sha256Canonical } from '../lib/epistemic-publication.ts'
import { SUBSTANTIAL_BATCH_3_PAGES } from '../lib/substantial-page-publication-batch-3.ts'
import {
  buildSubstantialMcpDeliveryReceipt,
  SUBSTANTIAL_MCP_RECEIPT_VERSION,
} from '../lib/substantial-mcp-delivery-receipt.ts'

const page = SUBSTANTIAL_BATCH_3_PAGES[0]
const release = page.releaseEvidence
const executionId = 'mcpexe_00000000000000000000000000000001'
const binding = {
  executionId,
  requestSha256: sha256Canonical({ fixture: 'private-substantial-delivery', recordId: page.contract.recordId }),
  projectionSha256: sha256Canonical({ fixture: 'licensed-projection', releaseId: release.releaseId, targetSha256: release.targetSha256 }),
  releaseId: release.releaseId,
  releaseSha256: sha256Canonical(release),
  targetSha256: release.targetSha256,
  canonicalPath: release.canonicalPath,
  recordId: page.contract.recordId,
}
const receipt = buildSubstantialMcpDeliveryReceipt(binding, page)
const artifact = {
  schemaVersion: 'maha-substantial-mcp-private-canary/0.1',
  receiptSchemaVersion: SUBSTANTIAL_MCP_RECEIPT_VERSION,
  fixtureBoundary: 'Deterministic private fixture. It proves binding and replay semantics without a credential, payment, production mutation, or public MCP discovery.',
  checks: {
    exactReleaseRevision: 'pass',
    exactCanonicalPath: 'pass',
    eligibleSubstantialPackage: 'pass',
    unsupportedExplanatoryParagraphs: 0,
    deterministicReceipt: 'pass',
    entitlementChangesEvidenceQuality: false,
  },
  receipt,
  secretsIncluded: false,
  commercialTransactionClaimed: false,
  publicDiscoveryAuthorized: false,
}
const path = resolve('content/mcp-evidence/substantial-delivery-private-canary.json')
await mkdir(dirname(path), { recursive: true })
await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(JSON.stringify({ recordId: page.contract.recordId, receiptSha256: receipt.receiptSha256, checks: artifact.checks }))
