import { canonicalJson } from './digest.ts'
import { assertValidDossier } from './validator.ts'
import type { EvidenceDossier } from './schema.ts'

/**
 * Stable internal serialization. Validation runs first, so an invalid dossier
 * can never be serialized, exported or rendered.
 */
export function serializeDossier(dossier: EvidenceDossier): string {
  assertValidDossier(dossier)
  return JSON.stringify(dossier, null, 2)
}

/** Canonical form used for digesting and for byte-stable comparison. */
export function serializeDossierCanonical(dossier: EvidenceDossier): string {
  assertValidDossier(dossier)
  return canonicalJson(dossier)
}
