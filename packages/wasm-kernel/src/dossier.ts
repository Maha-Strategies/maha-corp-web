import type { CalculationReceipt } from './receipt.js'
import { canonicalJson, verifyCalculationReceipt } from './receipt.js'

export const DOSSIER_CALCULATION_ATTACHMENT_SCHEMA = 'maha-dossier-calculation-attachment/1.0' as const

export interface DossierCalculationAttachment {
  schemaVersion: typeof DOSSIER_CALCULATION_ATTACHMENT_SCHEMA
  dossierId: string
  claimIds: readonly string[]
  receipt: CalculationReceipt
  mediaType: 'application/ld+json'
  jsonLd: Readonly<Record<string, unknown>>
}

export async function attachCalculationReceiptToDossier(input: {
  dossierId: string
  claimIds: readonly string[]
  receipt: CalculationReceipt
}): Promise<DossierCalculationAttachment> {
  if (!input.dossierId.trim() || input.claimIds.length === 0 || input.claimIds.some((id) => !id.trim())) throw new Error('A dossier calculation attachment requires a dossier and at least one claim.')
  if (new Set(input.claimIds).size !== input.claimIds.length) throw new Error('Dossier calculation claim ids must be unique.')
  if (!await verifyCalculationReceipt(input.receipt)) throw new Error('Calculation receipt digest or schema is invalid.')
  const claimIds = [...input.claimIds].sort()
  return {
    schemaVersion: DOSSIER_CALCULATION_ATTACHMENT_SCHEMA,
    dossierId: input.dossierId,
    claimIds,
    receipt: input.receipt,
    mediaType: 'application/ld+json',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'MathSolver',
      name: `${input.receipt.module}.${input.receipt.operation}`,
      identifier: input.receipt.receiptSha256,
      isPartOf: input.dossierId,
      encodingFormat: KERNEL_ATTACHMENT_ENCODING,
      potentialAction: claimIds.map((claimId) => ({ '@type': 'AssessAction', object: claimId })),
    },
  }
}

export const KERNEL_ATTACHMENT_ENCODING = 'maha-calculation-receipt/1.0+json' as const
export const serializeDossierCalculationAttachment = (attachment: DossierCalculationAttachment): string => `${canonicalJson(attachment)}\n`
