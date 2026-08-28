import { buildEvidenceDossierPackage, writeEvidenceDossierPackage } from '../../../lib/evidence-dossier/package.ts'
import { compileEvidenceDossier } from '../../../lib/evidence-dossier/compiler.ts'
import type { DossierEngagement, DossierPackage, EvidenceDossier } from './schema.ts'

export { buildEvidenceDossierPackage, compileEvidenceDossier, writeEvidenceDossierPackage }
export type { EvidenceDossierDraft, DossierClaimDraft, DossierPassageDraft, SourceComparisonDraft } from '../../../lib/evidence-dossier/compiler.ts'

/**
 * The rehearsal engagement. The commercial position is a fact about the
 * business, not a default to be edited for convenience: list $5,000,
 * nothing contracted, nothing received, and the offer not marked ready.
 */
export const INTERNAL_REHEARSAL_ENGAGEMENT: DossierEngagement = {
  mode: 'internal-rehearsal',
  listPriceUsd: 5_000,
  contractedPriceUsd: 0,
  cashReceivedUsd: 0,
  customerReference: null,
  deliveryTargetDays: 10,
  requestedAt: '2026-08-25T00:00:00Z',
}

export interface CompileOptions {
  /** Frozen instant supplied by the caller. The compiler never reads the clock. */
  engagement?: DossierEngagement
}

/**
 * Compiles an already-drafted dossier document into a package bundle.
 *
 * `generatedAt` and every other instant must already be present in the input.
 * Nothing here reads the system clock, so a given input always produces a
 * byte-identical package.
 */
export function compilePackage(dossier: EvidenceDossier, options: CompileOptions = {}): DossierPackage {
  return buildEvidenceDossierPackage(dossier, options.engagement ?? INTERNAL_REHEARSAL_ENGAGEMENT)
}
