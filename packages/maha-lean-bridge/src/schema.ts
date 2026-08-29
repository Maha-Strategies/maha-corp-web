/**
 * The formal-proof attachment format.
 *
 * An attachment binds a machine-checked Lean theorem to declared dossier
 * claims. It is deliberately narrow: it records what was proved, from which
 * exact source, under which exact toolchain, and — just as importantly — what
 * the proof does not establish.
 *
 * The assurance block is the load-bearing part. Every flag other than
 * `machineChecked` is false and stays false in this version. A Lean proof is a
 * deduction from stated assumptions; it is not an experiment, not a
 * reproduction, not a review, and not a certification that the assumptions
 * describe reality.
 */

export const FORMAL_PROOF_SCHEMA_VERSION = 'maha-formal-proof-attachment/0.1' as const

/**
 * Whether the proof was actually checked.
 *
 * `unverified` is the only legal state for an attachment a caller constructs;
 * `verified` may be set solely by the verifier, from Lean's exit status.
 */
export type ProofStatus = 'verified' | 'failed' | 'unverified'

export const PROOF_STATUSES: readonly ProofStatus[] = ['verified', 'failed', 'unverified']

/**
 * What a machine-checked proof does and does not establish.
 *
 * These are not adjustable by callers. `machineChecked` is set from a real Lean
 * run; the rest are structurally false because nothing in this package can
 * establish them.
 */
export interface ProofAssurance {
  /** A Lean build of the cited source succeeded and the theorem exists in it. */
  machineChecked: boolean
  /** Always false: deduction is not observation. */
  empiricallyValidated: false
  /** Always false: one machine checking a proof is not independent reproduction. */
  independentlyReproduced: false
  /** Always false: no proof here relates Lean to the AssemblyScript compiler or the WASM binary. */
  compilerEquivalenceProven: false
  /** Always false: a model's internal consistency is not evidence it describes reality. */
  scientificModelCertified: false
}

/** The exact toolchain a proof was checked with. */
export interface ProofToolchain {
  /** The literal contents of `lean-toolchain`, e.g. `leanprover/lean4:v4.33.1`. */
  toolchain: string
  /** The version Lean itself reports, e.g. `4.33.1`. */
  leanVersion: string
  /** Lake build configuration, e.g. `release`. */
  buildConfiguration: string
}

export interface FormalProofAttachment {
  schemaVersion: typeof FORMAL_PROOF_SCHEMA_VERSION
  /** Stable identity of this attachment. Unique within a dossier. */
  theoremId: string
  /** The Lean declaration name, without namespace. */
  theoremName: string
  /** The Lean namespace the declaration lives in. */
  theoremNamespace: string
  /** The dossier this attachment belongs to. */
  dossierId: string
  /** Declared claims in that dossier which this proof relates to. */
  claimIds: readonly string[]
  /** Repository-relative path of the Lean source, e.g. `Maha/Intervals.lean`. */
  sourceFile: string
  /** SHA-256 of the exact source bytes that were checked. */
  sourceSha256: string
  toolchain: string
  leanVersion: string
  buildConfiguration: string
  /**
   * The empirical premises the claim rests on.
   *
   * A proof discharges none of these. It establishes an implication whose
   * antecedent is exactly this list.
   */
  assumptions: readonly string[]
  /** The theorem statement, as written in the source. */
  formalStatement: string
  /**
   * What this proof does not establish, in plain language.
   *
   * Required and non-empty: an attachment without a stated boundary is refused.
   */
  informalBoundary: string
  proofStatus: ProofStatus
  /** The exact command a verifier runs to recheck this proof. */
  verificationCommand: string
  /** SHA-256 of the proof manifest this attachment was drawn from. */
  proofManifestSha256: string
  /** Calculation operations this proof relates to, when any. */
  calculationOperationIds: readonly string[]
  assurance: ProofAssurance
}

/** The assurance block every attachment starts from. */
export const BASELINE_ASSURANCE: ProofAssurance = {
  machineChecked: false,
  empiricallyValidated: false,
  independentlyReproduced: false,
  compilerEquivalenceProven: false,
  scientificModelCertified: false,
}

/** A single theorem as recorded in the generated proof manifest. */
export interface ManifestTheorem {
  theoremName: string
  theoremNamespace: string
  sourceFile: string
  sourceSha256: string
  formalStatement: string
}

export interface ProofManifest {
  schemaVersion: 'maha-formal-proof-manifest/0.1'
  toolchain: string
  leanVersion: string
  buildConfiguration: string
  verificationCommand: string
  /** Sorted by fully qualified name, so the manifest is order-independent. */
  theorems: readonly ManifestTheorem[]
}

export const PROOF_MANIFEST_SCHEMA_VERSION = 'maha-formal-proof-manifest/0.1' as const

/** Fully qualified name of a theorem, the identity used for lookup and duplicate detection. */
export function qualifiedName(theorem: Pick<ManifestTheorem, 'theoremName' | 'theoremNamespace'>): string {
  return theorem.theoremNamespace ? `${theorem.theoremNamespace}.${theorem.theoremName}` : theorem.theoremName
}

/**
 * Proof escapes that leave a theorem unproved while still compiling.
 *
 * `sorry` elaborates to a warning, not an error, so a build can succeed with
 * holes in it. Text scanning alone is not sufficient — the verifier also checks
 * Lean's exit status and its warning output — but a source containing these is
 * refused outright.
 */
export const PROOF_ESCAPES: readonly string[] = ['sorry', 'admit', 'sorryAx', 'native_decide']
