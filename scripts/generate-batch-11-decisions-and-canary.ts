import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { BATCH_11_DECISIONS, BATCH_11_REVIEW_VERSION, batch11DecisionTotals } from '../lib/frontier-alignment-batch-11-review.ts'
import {
  BATCH_11_CANARY_VERSION,
  BATCH_11_PRIOR_BINDINGS,
  BATCH_11_RELEASE_CANARY,
  BATCH_11_REVISION_AUDITS,
  BATCH_11_SCOPED_DECISIONS,
  batch11CanaryTotals,
} from '../lib/batch-11-revision-canary.ts'

/**
 * Emits the Batch 11 review decisions and the five-record revision canary.
 *
 * Deterministic: everything is sorted by identifier, canonicalised before
 * hashing, and no timestamp or environment value is read. Two runs on the same
 * input produce identical bytes.
 */

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const byId = <T extends { recordId: string }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))

mkdirSync('content/frontier-alignment', { recursive: true })

const decisionsPayload = {
  schemaVersion: BATCH_11_REVIEW_VERSION,
  totals: batch11DecisionTotals(),
  standing: {
    activeBindingsChanged: 0,
    canonicalReleasesAuthorized: 0,
    externallyReviewed: false,
    independentlyReproduced: false,
    note: 'Append-only review artifacts. A decision records what the inspected evidence can carry for a specific packet against a specific record revision. It is not an active binding and does not become one.',
  },
  decisions: byId(BATCH_11_DECISIONS),
}
writeFileSync(
  'content/frontier-alignment/batch-11-review-decisions.json',
  `${JSON.stringify(JSON.parse(canonicalJson({ ...decisionsPayload, resultDigest: digest(decisionsPayload) })), null, 2)}\n`,
)

const canaryPayload = {
  schemaVersion: BATCH_11_CANARY_VERSION,
  totals: batch11CanaryTotals(),
  standing: {
    activeCanonicalReleases: 0,
    canonicalMutationAuthorized: false,
    productionMutationPerformed: false,
    releaseAuthorityPresent: false,
    note: 'Private preflight only. Each revision is proved still excluded by the merged three-gate publication queue, and no synthetic active release was created to make that pass.',
  },
  priorBindings: byId(BATCH_11_PRIOR_BINDINGS),
  audits: byId(BATCH_11_REVISION_AUDITS),
  scopedDecisions: byId(BATCH_11_SCOPED_DECISIONS),
  releaseCanary: byId(BATCH_11_RELEASE_CANARY),
}
writeFileSync(
  'content/frontier-alignment/batch-11-revision-canary.json',
  `${JSON.stringify(JSON.parse(canonicalJson({ ...canaryPayload, resultDigest: digest(canaryPayload) })), null, 2)}\n`,
)

process.stdout.write(
  `${JSON.stringify({ decisions: batch11DecisionTotals(), canary: batch11CanaryTotals(), decisionsDigest: digest(decisionsPayload), canaryDigest: digest(canaryPayload) }, null, 2)}\n`,
)
