import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { assertRepositoryRelative, normalizeSourceText } from './canonicalize.ts'
import { manifestDigest } from './verifier.ts'
import {
  BASELINE_ASSURANCE,
  FORMAL_PROOF_SCHEMA_VERSION,
  qualifiedName,
  type FormalProofAttachment,
  type ProofManifest,
} from './schema.ts'

/**
 * Builds attachments from the proof manifest.
 *
 * The compiler never sets `machineChecked`: everything it produces is
 * `unverified` until the verifier runs Lean. Its job is to bind a theorem to
 * claims and to record the exact source and toolchain identity, so that any
 * later drift is detectable.
 */

export interface CompileRequest {
  theoremId: string
  /** Fully qualified Lean name, e.g. `Maha.Interval.add_valid`. */
  qualifiedTheorem: string
  dossierId: string
  claimIds: readonly string[]
  assumptions: readonly string[]
  informalBoundary: string
  calculationOperationIds?: readonly string[]
}

export function compileAttachment(
  request: CompileRequest,
  manifest: ProofManifest,
  packageRoot: string,
): FormalProofAttachment {
  const theorem = manifest.theorems.find((t) => qualifiedName(t) === request.qualifiedTheorem)
  if (!theorem) throw new Error(`${request.qualifiedTheorem} is not in the proof manifest.`)
  if (!request.informalBoundary.trim()) throw new Error('An attachment must state what the proof does not establish.')
  if (request.claimIds.length === 0) throw new Error('An attachment must bind at least one declared claim.')
  assertRepositoryRelative(theorem.sourceFile, 'sourceFile')

  const actual = `sha256:${createHash('sha256')
    .update(normalizeSourceText(readFileSync(join(packageRoot, theorem.sourceFile), 'utf8')), 'utf8')
    .digest('hex')}`
  if (actual !== theorem.sourceSha256) {
    throw new Error(`${theorem.sourceFile} has changed since the manifest was generated. Regenerate it.`)
  }

  return {
    schemaVersion: FORMAL_PROOF_SCHEMA_VERSION,
    theoremId: request.theoremId,
    theoremName: theorem.theoremName,
    theoremNamespace: theorem.theoremNamespace,
    dossierId: request.dossierId,
    claimIds: [...request.claimIds],
    sourceFile: theorem.sourceFile,
    sourceSha256: theorem.sourceSha256,
    toolchain: manifest.toolchain,
    leanVersion: manifest.leanVersion,
    buildConfiguration: manifest.buildConfiguration,
    assumptions: [...request.assumptions],
    formalStatement: theorem.formalStatement,
    informalBoundary: request.informalBoundary,
    proofStatus: 'unverified',
    verificationCommand: manifest.verificationCommand,
    proofManifestSha256: manifestDigest(manifest),
    calculationOperationIds: [...(request.calculationOperationIds ?? [])],
    assurance: { ...BASELINE_ASSURANCE },
  }
}
