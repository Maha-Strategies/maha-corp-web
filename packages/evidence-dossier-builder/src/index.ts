/**
 * Operator surface for the Maha Evidence Dossier.
 *
 * This package is an extraction, not a second implementation: schema,
 * canonicalization, compiler, validator, and adapter all resolve to the
 * canonical modules under `lib/evidence-dossier`. Only the CLI layer —
 * artifact-only verification and JSON-LD rendering — is new here.
 *
 * The package is private and is not published to npm.
 */
export * from './schema.ts'
export * from './canonicalize.ts'
export * from './runtime-witness.ts'
export * from './validate.ts'
export * from './compile.ts'
export * from './verify.ts'
export * from './jsonld.ts'
export * from './pdf.ts'
export * from './integrated-package.ts'

export const EVIDENCE_DOSSIER_BUILDER_VERSION = 'maha-evidence-dossier-builder/0.1' as const
export const EVIDENCE_DOSSIER_BUILDER_BOUNDARY =
  'This tool compiles and verifies evidence packages. It performs no source retrieval, asserts no external expert review or independent reproduction, and claims no legal, regulatory, scientific, or commercial certification.'
