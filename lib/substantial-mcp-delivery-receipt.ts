import { sha256Canonical } from './epistemic-publication.ts'
import {
  buildLicensedEvidenceProjection,
  mcpEvidenceOutputSha256,
} from './mcp-evidence-licensing.ts'

export const SUBSTANTIAL_MCP_RECEIPT_VERSION = 'maha-substantial-mcp-receipt/0.1' as const

type LicensedProjection = ReturnType<typeof buildLicensedEvidenceProjection>

export interface DeliverableSubstantialPage {
  contract: { recordId: string; recordRevisionSha256: string }
  publicationVersion: string
  publicationDigest: string
  path: string
  quality: {
    eligible: boolean
    evidenceCoverage: {
      claimsExplained: number
      claimsTotal: number
      unsupportedExplanationParagraphs: number
    }
  }
}

export interface LicensedProjectionBinding {
  executionId: string
  requestSha256: string
  projectionSha256: string
  releaseId: string
  releaseSha256: string
  targetSha256: string
  canonicalPath: string
  recordId: string
}

export interface SubstantialMcpDeliveryReceipt {
  schemaVersion: typeof SUBSTANTIAL_MCP_RECEIPT_VERSION
  receiptId: string
  execution: {
    executionId: string
    requestSha256: string
    projectionSha256: string
  }
  release: {
    releaseId: string
    releaseSha256: string
    targetSha256: string
    canonicalPath: string
  }
  substantialPublication: {
    recordId: string
    publicationVersion: string
    publicationDigest: string
    recordRevisionSha256: string
    path: string
    claimsExplained: number
    claimsTotal: number
    unsupportedExplanationParagraphs: 0
  }
  deliveryState: 'private-machine-delivery'
  acknowledgementRequired: true
  entitlementChangesEvidenceQuality: false
  receiptSha256: string
}

export function bindingFromLicensedProjection(projection: LicensedProjection): LicensedProjectionBinding {
  return {
    executionId: projection.execution.executionId,
    requestSha256: projection.execution.requestSha256,
    projectionSha256: mcpEvidenceOutputSha256(projection),
    releaseId: projection.release.releaseId,
    releaseSha256: projection.release.releaseSha256,
    targetSha256: projection.release.targetSha256,
    canonicalPath: projection.release.canonicalPath,
    recordId: projection.record.id,
  }
}

export function buildSubstantialMcpDeliveryReceipt(
  binding: LicensedProjectionBinding,
  page: DeliverableSubstantialPage,
): SubstantialMcpDeliveryReceipt {
  if (!/^sha256:[a-f0-9]{64}$/.test(binding.projectionSha256)
    || !/^sha256:[a-f0-9]{64}$/.test(binding.releaseSha256)
    || !/^sha256:[a-f0-9]{64}$/.test(binding.targetSha256)) {
    throw new Error('Licensed projection binding contains an invalid digest.')
  }
  if (binding.recordId !== page.contract.recordId
    || binding.targetSha256 !== page.contract.recordRevisionSha256
    || binding.canonicalPath !== page.path) {
    throw new Error('Licensed projection does not bind the exact substantial page revision and route.')
  }
  if (!page.quality.eligible
    || page.quality.evidenceCoverage.unsupportedExplanationParagraphs !== 0
    || page.quality.evidenceCoverage.claimsExplained !== page.quality.evidenceCoverage.claimsTotal) {
    throw new Error('Substantial page is not eligible for machine delivery.')
  }
  const base = {
    schemaVersion: SUBSTANTIAL_MCP_RECEIPT_VERSION,
    receiptId: `urn:maha:receipt:mcp-substantial:${binding.executionId}`,
    execution: {
      executionId: binding.executionId,
      requestSha256: binding.requestSha256,
      projectionSha256: binding.projectionSha256,
    },
    release: {
      releaseId: binding.releaseId,
      releaseSha256: binding.releaseSha256,
      targetSha256: binding.targetSha256,
      canonicalPath: binding.canonicalPath,
    },
    substantialPublication: {
      recordId: page.contract.recordId,
      publicationVersion: page.publicationVersion,
      publicationDigest: page.publicationDigest,
      recordRevisionSha256: page.contract.recordRevisionSha256,
      path: page.path,
      claimsExplained: page.quality.evidenceCoverage.claimsExplained,
      claimsTotal: page.quality.evidenceCoverage.claimsTotal,
      unsupportedExplanationParagraphs: 0 as const,
    },
    deliveryState: 'private-machine-delivery' as const,
    acknowledgementRequired: true as const,
    entitlementChangesEvidenceQuality: false as const,
  }
  return { ...base, receiptSha256: sha256Canonical(base) }
}

export function verifySubstantialMcpDeliveryReceipt(
  receipt: SubstantialMcpDeliveryReceipt,
  binding: LicensedProjectionBinding,
  page: DeliverableSubstantialPage,
): boolean {
  const rebuilt = buildSubstantialMcpDeliveryReceipt(binding, page)
  return sha256Canonical(rebuilt) === sha256Canonical(receipt)
}
