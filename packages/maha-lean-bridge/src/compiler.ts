import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  assertValidBindingManifest,
  bindingManifestDigest,
  type BindingManifest,
} from './bindings.ts'
import { normalizeSourceText } from './canonicalize.ts'
import { manifestDigest, safeSourcePath } from './verifier.ts'
import {
  BASELINE_ASSURANCE,
  FORMAL_PROOF_SCHEMA_VERSION,
  qualifiedName,
  type FormalProofAttachment,
  type ProofManifest,
} from './schema.ts'

/**
 * Builds attachments from trusted bindings.
 *
 * The compiler takes no claim ids, assumptions or boundary text from its
 * caller. Those come from the binding manifest, which is the reviewed record of
 * what a theorem is authorized to be attached to. A caller can only name a
 * binding; it cannot invent an association.
 *
 * Nothing here sets `machineChecked`. Everything produced is `unverified` until
 * the verifier runs Lean.
 */

export interface CompileRequest {
  theoremId: string
  /** The binding authorizing this attachment. */
  bindingId: string
}

export function compileFromBinding(
  request: CompileRequest,
  bindingManifest: BindingManifest,
  proofManifest: ProofManifest,
  packageRoot: string,
): FormalProofAttachment {
  assertValidBindingManifest(bindingManifest)
  const binding = bindingManifest.bindings.find((entry) => entry.bindingId === request.bindingId)
  if (!binding) throw new Error(`No binding named ${request.bindingId}.`)

  const theorem = proofManifest.theorems.find((t) => qualifiedName(t) === binding.qualifiedTheorem)
  if (!theorem) throw new Error(`${binding.qualifiedTheorem} is not in the proof manifest.`)

  const root = resolve(packageRoot)
  const sourcePath = safeSourcePath(root, theorem.sourceFile)
  if (!sourcePath) throw new Error(`${theorem.sourceFile} is not a safe repository-relative path.`)

  const actual = `sha256:${createHash('sha256')
    .update(normalizeSourceText(readFileSync(sourcePath, 'utf8')), 'utf8')
    .digest('hex')}`
  if (actual !== theorem.sourceSha256) {
    throw new Error(`${theorem.sourceFile} has changed since the manifest was generated. Regenerate it.`)
  }

  return {
    schemaVersion: FORMAL_PROOF_SCHEMA_VERSION,
    theoremId: request.theoremId,
    theoremName: theorem.theoremName,
    theoremNamespace: theorem.theoremNamespace,
    dossierId: binding.dossierId,
    claimIds: [...binding.claimIds],
    bindingId: binding.bindingId,
    bindingRevision: binding.revision,
    bindingManifestSha256: bindingManifestDigest(bindingManifest),
    sourceFile: theorem.sourceFile,
    sourceSha256: theorem.sourceSha256,
    toolchain: proofManifest.toolchain,
    leanVersion: proofManifest.leanVersion,
    buildConfiguration: proofManifest.buildConfiguration,
    assumptions: [...binding.assumptions],
    formalStatement: theorem.formalStatement,
    informalBoundary: binding.informalBoundary,
    proofStatus: 'unverified',
    verificationCommand: proofManifest.verificationCommand,
    proofManifestSha256: manifestDigest(proofManifest),
    calculationOperationIds: [...binding.calculationOperationIds],
    assurance: { ...BASELINE_ASSURANCE },
  }
}
