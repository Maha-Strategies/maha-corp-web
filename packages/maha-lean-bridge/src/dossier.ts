import type { FormalProofAttachment } from './schema.ts'

/**
 * Evidence Dossier integration for formal proofs.
 *
 * Formal proofs are a third category alongside deterministic calculations and
 * runtime witnesses. The three never merge, and none of them creates
 * passage-level support:
 *
 *   calculation      a deterministic computation with a receipt
 *   runtime witness  an observed execution with provenance
 *   formal proof     a machine-checked conditional statement
 *
 * A claim can carry any combination, including none. Absence is represented as
 * an explicit empty array so a reader can tell "no proof was attached" from
 * "this dossier predates formal proofs".
 */

/** JSON-LD projection of one verified proof. */
export interface FormalProofNode {
  '@type': 'MahaFormalProof'
  theoremId: string
  theoremName: string
  theoremNamespace: string
  formalStatement: string
  assumptions: readonly string[]
  informalBoundary: string
  claimIds: readonly string[]
  sourceFile: string
  sourceSha256: string
  toolchain: string
  leanVersion: string
  verificationCommand: string
  proofManifestSha256: string
  assurance: FormalProofAttachment['assurance']
}

/**
 * Projects attachments into JSON-LD.
 *
 * Only attachments whose proof actually checked may appear. A failed or unrun
 * proof is not represented as a weaker proof; it is simply absent, because a
 * reader must never have to distinguish grades of "proved" in the output.
 */
export function formalProofNodes(attachments: readonly FormalProofAttachment[]): FormalProofNode[] {
  return attachments
    .filter((attachment) => attachment.proofStatus === 'verified' && attachment.assurance.machineChecked === true)
    .map((attachment) => ({
      '@type': 'MahaFormalProof' as const,
      theoremId: attachment.theoremId,
      theoremName: attachment.theoremName,
      theoremNamespace: attachment.theoremNamespace,
      formalStatement: attachment.formalStatement,
      assumptions: attachment.assumptions,
      informalBoundary: attachment.informalBoundary,
      claimIds: attachment.claimIds,
      sourceFile: attachment.sourceFile,
      sourceSha256: attachment.sourceSha256,
      toolchain: attachment.toolchain,
      leanVersion: attachment.leanVersion,
      verificationCommand: attachment.verificationCommand,
      proofManifestSha256: attachment.proofManifestSha256,
      assurance: attachment.assurance,
    }))
    // Sorted by theorem id so the projection is order-independent.
    .sort((a, b) => (a.theoremId < b.theoremId ? -1 : a.theoremId > b.theoremId ? 1 : 0))
}

/** The wording rendered beneath the formal-statements section of the PDF. */
export const FORMAL_PROOF_BOUNDARY_NOTICE = [
  'A machine-checked proof establishes only that the stated formal conclusion follows from the stated formal assumptions.',
  'It is not an experiment, not an independent reproduction, not expert review, and not regulatory approval.',
  'It does not establish that the assumptions describe any physical system, and it does not change the source-based support of any claim.',
].join(' ')

/**
 * Section model for the PDF renderer.
 *
 * Returned even when empty, so the renderer emits an explicit "no formal
 * proofs are attached" section rather than silently omitting the category.
 */
export interface FormalProofSection {
  title: string
  notice: string
  proofs: FormalProofNode[]
}

export function formalProofSection(attachments: readonly FormalProofAttachment[]): FormalProofSection {
  return {
    title: 'Machine-checked formal statements',
    notice: FORMAL_PROOF_BOUNDARY_NOTICE,
    proofs: formalProofNodes(attachments),
  }
}
