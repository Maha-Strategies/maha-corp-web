import { validateEvidenceDossierPackage } from '../../../lib/evidence-dossier/package.ts'
import { assertValidDossier, validateDossier } from '../../../lib/evidence-dossier/validator.ts'
import type { DossierPackage, EvidenceDossier } from './schema.ts'

export { assertValidDossier, validateDossier, validateEvidenceDossierPackage }
export type { ValidationIssue } from '../../../lib/evidence-dossier/validator.ts'

export interface ValidationReport {
  ok: boolean
  dossierId: string | null
  issues: readonly string[]
}

/**
 * Parses and validates an operator-supplied dossier document.
 *
 * Parsing is deliberately strict and offline: an input that is not a dossier
 * fails closed with an issue code rather than being coerced into one.
 */
export function validateDossierDocument(raw: unknown): ValidationReport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, dossierId: null, issues: ['dossier-not-an-object'] }
  }
  const candidate = raw as Partial<EvidenceDossier>
  const dossierId = typeof candidate.dossierId === 'string' ? candidate.dossierId : null

  // The canonical validator assumes a structurally complete dossier and will
  // throw on arbitrary input. Operator input is arbitrary by definition, so the
  // required shape is checked here first and anything unexpected fails closed
  // rather than escaping as a crash.
  const structural: string[] = []
  for (const field of ['sources', 'passages', 'claims', 'comparisons', 'priorRevisions', 'contradictions', 'unsupportedInferences', 'limitations', 'prohibitedUses'] as const) {
    if (!Array.isArray(candidate[field])) structural.push(`dossier-field-not-an-array:${field}`)
  }
  for (const field of ['schemaVersion', 'dossierId', 'title', 'reviewState'] as const) {
    if (typeof candidate[field] !== 'string') structural.push(`dossier-field-not-a-string:${field}`)
  }
  if (!candidate.provenanceBundle || typeof candidate.provenanceBundle !== 'object') structural.push('dossier-provenance-bundle-missing')
  if (structural.length > 0) return { ok: false, dossierId, issues: structural }

  try {
    const issues = validateDossier(candidate as EvidenceDossier).map((issue) => `${issue.code}${issue.path ? `:${issue.path}` : ''}`)
    return { ok: issues.length === 0, dossierId, issues }
  } catch (error) {
    return { ok: false, dossierId, issues: [`dossier-validation-failed:${error instanceof Error ? error.message : 'unknown'}`] }
  }
}

export function validatePackageBundle(bundle: DossierPackage): ValidationReport {
  const issues = validateEvidenceDossierPackage(bundle)
  return { ok: issues.length === 0, dossierId: bundle.manifest?.dossierId ?? null, issues }
}
