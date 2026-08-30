import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import {
  BATCH_11_CANARY_RECORD_IDS,
  BATCH_11_RELEASE_CANARY,
  BATCH_11_REVISION_AUDITS,
  BATCH_11_SCOPED_DECISIONS,
} from './batch-11-revision-canary.ts'
import { BATCH_11_DECISIONS } from './frontier-alignment-batch-11-review.ts'

/**
 * Mixed-lineage release reconciliation for the five Batch 11 records.
 *
 * The batch was frozen on the assumption that all five supersede an existing
 * canonical release. The authoritative Production registry says otherwise: four
 * have exactly one active release, and tool-allowlisting has none at all. This
 * module corrects that assumption without papering over it.
 *
 * The load-bearing rule is that a release kind is DECLARED and then CHECKED,
 * never inferred. Deriving "initial" from a lookup that returned nothing would
 * make an outage, a typo in a record id, or a registry that failed to load
 * indistinguishable from a record that genuinely has no prior release - and all
 * three would silently produce an initial release that overwrites nothing and
 * supersedes nothing. So each record carries an explicit expected kind, and
 * reconciliation fails closed when the registry disagrees with it.
 *
 * Nothing here releases anything. It produces a manifest and a verdict.
 */

export const BATCH_11_MIXED_LINEAGE_VERSION = 'maha-batch-11-mixed-lineage/1.0' as const

export type ReleaseKind = 'initial' | 'superseding'

export type LineageFailureCode =
  | 'prior-release-appeared'
  | 'prior-release-disappeared'
  | 'multiple-active-prior-releases'
  | 'prior-revision-digest-changed'
  | 'proposed-revision-digest-changed'
  | 'decision-targets-other-revision'
  | 'decision-coverage-incomplete'
  | 'release-kind-disagrees-with-registry'
  | 'canonical-path-mismatch'
  | 'record-not-observed'
  | 'held-decision-cannot-release'

/**
 * What we assert the registry will say, written down before we look.
 *
 * `declaredPriorReleaseId` is null only for a record we assert has no prior
 * release. That null is a claim, not a lookup miss.
 */
export interface LineageDeclaration {
  recordId: string
  declaredReleaseKind: ReleaseKind
  declaredPriorReleaseId: string | null
  declaredPriorTargetSha256: string | null
  declaredCanonicalPath: string
  /** Why this record is classified as it is, in terms a reviewer can check. */
  classificationBasis: string
}

/** One record's frozen, sanitized view of the live registry. */
export interface RegistryObservationRecord {
  recordId: string
  totalReleases: number
  activeReleases: number
  activeRelease: {
    releaseId: string
    releaseKind: string
    targetSha256: string
    canonicalPath: string
    canonicalVersion: string
  } | null
}

export interface RegistryObservation {
  schemaVersion: string
  registrySchemaVersion: string
  source: string
  method: string
  totalReleasesInRegistry: number
  records: readonly RegistryObservationRecord[]
}

/**
 * The declarations, written from the reconciliation this task exists to make.
 *
 * Four supersede. One does not, and says so explicitly rather than arriving
 * there by absence.
 */
export const BATCH_11_LINEAGE_DECLARATIONS: readonly LineageDeclaration[] = [
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-tool-allowlisting',
    declaredReleaseKind: 'initial',
    declaredPriorReleaseId: null,
    declaredPriorTargetSha256: null,
    declaredCanonicalPath: '/knowledge/agentic-systems-mcp/measurements/agentic-systems-mcp-tool-allowlisting',
    classificationBasis:
      'The authoritative Production registry contains no release for this record, active or otherwise. It is therefore declared initial. This is an assertion about registry state that reconciliation re-checks; it is not a conclusion drawn from a lookup returning nothing.',
  },
  {
    recordId: 'urn:maha:record:biomolecular-engineering-structure-prediction-filtering',
    declaredReleaseKind: 'superseding',
    declaredPriorReleaseId: 'epirelease_9bf9b14ec8fb48f884efdc43e44ea349',
    declaredPriorTargetSha256: 'sha256:2f59ecb93f3ad9418b05e01058d2d629fff5368dcc20b838b0e996f651c1db50',
    declaredCanonicalPath: '/knowledge/biomolecular-engineering/comparisons/biomolecular-engineering-structure-prediction-filtering',
    classificationBasis: 'Exactly one active release observed, whose target digest equals the prior revision the audit was taken against.',
  },
  {
    recordId: 'urn:maha:record:critical-supply-chains-high-purity-quartz-deposits',
    declaredReleaseKind: 'superseding',
    declaredPriorReleaseId: 'epirelease_d9b0cd28c1614fa58192be24afcd2a7a',
    declaredPriorTargetSha256: 'sha256:c667320cf234997948bffc6fef2aefd2133010aed2a0af4d457dad0817fd93c0',
    declaredCanonicalPath: '/knowledge/critical-supply-chains/concepts/critical-supply-chains-high-purity-quartz-deposits',
    classificationBasis: 'Exactly one active release observed, whose target digest equals the prior revision the audit was taken against.',
  },
  {
    recordId: 'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium',
    declaredReleaseKind: 'superseding',
    declaredPriorReleaseId: 'epirelease_8e947374097d4695815dbf9ab653177b',
    declaredPriorTargetSha256: 'sha256:cb41216cd3cf8fdc36decedf66f8e768a25b450969b763e83c3d2b756ae57052',
    declaredCanonicalPath: '/knowledge/fusion-plasma-systems/mechanisms/fusion-plasma-systems-tokamak-plasma-equilibrium',
    classificationBasis: 'Exactly one active release observed, whose target digest equals the prior revision the audit was taken against.',
  },
  {
    recordId: 'urn:maha:record:mechanistic-interpretability-representation-probing-boundary',
    declaredReleaseKind: 'superseding',
    declaredPriorReleaseId: 'epirelease_93c92eb7a317465b83fabf8d3e6962da',
    declaredPriorTargetSha256: 'sha256:83339b28fdea2a81504e0bf44f9229fe06b24e444c774c0a0d513cf1b0bc8b3f',
    declaredCanonicalPath: '/knowledge/mechanistic-interpretability/comparisons/mechanistic-interpretability-representation-probing-boundary',
    classificationBasis: 'Exactly one active release observed, whose target digest equals the prior revision the audit was taken against.',
  },
]

export interface LineageManifestEntry {
  recordId: string
  releaseKind: ReleaseKind
  priorReleaseId: string | null
  priorTargetSha256: string | null
  proposedTargetSha256: string
  canonicalPath: string
  scopedDecisionCount: number
  scopedDecisionSha256s: readonly string[]
  auditSha256: string
  classificationBasis: string
  /** Empty means every gate passed for this record. */
  failures: readonly LineageFailureCode[]
  ready: boolean
}

export interface LineageManifest {
  schemaVersion: typeof BATCH_11_MIXED_LINEAGE_VERSION
  observationSource: string
  observationMethod: string
  totals: {
    records: number
    superseding: number
    initial: number
    ready: number
    blocked: number
  }
  standing: {
    productionMutationPerformed: false
    releasePerformed: false
    previewDatabaseCreated: false
    migrationApplied: false
    note: string
  }
  entries: readonly LineageManifestEntry[]
}

function sha(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

/**
 * Reconciles declarations against an observation, failing closed on disagreement.
 *
 * Every branch that could turn a superseding release into an initial one is an
 * explicit failure code rather than a fallback.
 */
export function reconcileLineage(observation: RegistryObservation): LineageManifest {
  const entries: LineageManifestEntry[] = BATCH_11_LINEAGE_DECLARATIONS.map((declared) => {
    const failures: LineageFailureCode[] = []
    const observed = observation.records.find((row) => row.recordId === declared.recordId)
    const audit = BATCH_11_REVISION_AUDITS.find((row) => row.recordId === declared.recordId)
    const canary = BATCH_11_RELEASE_CANARY.find((row) => row.recordId === declared.recordId)
    const decision = BATCH_11_DECISIONS.find((row) => row.recordId === declared.recordId)
    const scoped = BATCH_11_SCOPED_DECISIONS.filter((row) => row.recordId === declared.recordId)

    if (!observed) failures.push('record-not-observed')
    if (!audit || !canary || !decision) {
      failures.push('record-not-observed')
      return {
        recordId: declared.recordId,
        releaseKind: declared.declaredReleaseKind,
        priorReleaseId: declared.declaredPriorReleaseId,
        priorTargetSha256: declared.declaredPriorTargetSha256,
        proposedTargetSha256: '',
        canonicalPath: declared.declaredCanonicalPath,
        scopedDecisionCount: scoped.length,
        scopedDecisionSha256s: scoped.map((row) => row.decisionSha256),
        auditSha256: '',
        classificationBasis: declared.classificationBasis,
        failures,
        ready: false,
      }
    }

    if (decision.disposition === 'reject-or-hold') failures.push('held-decision-cannot-release')

    if (observed) {
      if (observed.activeReleases > 1) failures.push('multiple-active-prior-releases')

      // The two directions that must never be conflated.
      if (declared.declaredReleaseKind === 'superseding' && observed.activeReleases === 0) {
        failures.push('prior-release-disappeared')
      }
      if (declared.declaredReleaseKind === 'initial' && observed.activeReleases > 0) {
        failures.push('prior-release-appeared')
      }

      const impliedKind: ReleaseKind = observed.activeReleases === 0 ? 'initial' : 'superseding'
      if (observed.activeReleases <= 1 && impliedKind !== declared.declaredReleaseKind) {
        failures.push('release-kind-disagrees-with-registry')
      }

      if (declared.declaredReleaseKind === 'superseding' && observed.activeRelease) {
        if (observed.activeRelease.releaseId !== declared.declaredPriorReleaseId) failures.push('prior-release-appeared')
        if (observed.activeRelease.targetSha256 !== declared.declaredPriorTargetSha256) failures.push('prior-revision-digest-changed')
        if (observed.activeRelease.targetSha256 !== audit.priorRecordRevisionSha256) failures.push('prior-revision-digest-changed')
        if (observed.activeRelease.canonicalPath !== declared.declaredCanonicalPath) failures.push('canonical-path-mismatch')
      }
    }

    if (canary.canonicalPath !== declared.declaredCanonicalPath) failures.push('canonical-path-mismatch')
    if (canary.targetSha256 !== audit.revisedRecordRevisionSha256) failures.push('proposed-revision-digest-changed')

    // Every scope must target the exact proposed revision. A decision taken
    // against a different revision is not evidence about this one.
    if (scoped.length !== 4) failures.push('decision-coverage-incomplete')
    if (scoped.some((row) => row.targetSha256 !== audit.revisedRecordRevisionSha256)) {
      failures.push('decision-targets-other-revision')
    }

    const unique = [...new Set(failures)]
    return {
      recordId: declared.recordId,
      releaseKind: declared.declaredReleaseKind,
      priorReleaseId: declared.declaredPriorReleaseId,
      priorTargetSha256: declared.declaredPriorTargetSha256,
      proposedTargetSha256: audit.revisedRecordRevisionSha256,
      canonicalPath: declared.declaredCanonicalPath,
      scopedDecisionCount: scoped.length,
      scopedDecisionSha256s: scoped.map((row) => row.decisionSha256),
      auditSha256: audit.auditSha256,
      classificationBasis: declared.classificationBasis,
      failures: unique,
      ready: unique.length === 0,
    }
  }).sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))

  return {
    schemaVersion: BATCH_11_MIXED_LINEAGE_VERSION,
    observationSource: observation.source,
    observationMethod: observation.method,
    totals: {
      records: entries.length,
      superseding: entries.filter((row) => row.releaseKind === 'superseding').length,
      initial: entries.filter((row) => row.releaseKind === 'initial').length,
      ready: entries.filter((row) => row.ready).length,
      blocked: entries.filter((row) => !row.ready).length,
    },
    standing: {
      productionMutationPerformed: false,
      releasePerformed: false,
      previewDatabaseCreated: false,
      migrationApplied: false,
      note: 'Reconciliation and rehearsal preparation only. No release was performed, no Preview database was created, and no migration was applied.',
    },
    entries,
  }
}

export function lineageManifestDigest(manifest: LineageManifest): string {
  return sha(manifest)
}

/** Every canary record must appear exactly once in the declarations. */
export function assertDeclarationCoverage(): void {
  const declared = BATCH_11_LINEAGE_DECLARATIONS.map((row) => row.recordId).sort()
  const expected = [...BATCH_11_CANARY_RECORD_IDS].sort()
  if (declared.length !== expected.length || declared.some((id, index) => id !== expected[index])) {
    throw new Error('Lineage declarations do not cover exactly the Batch 11 canary records.')
  }
}
