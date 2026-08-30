import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import {
  ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES,
  ALIGNMENT_BATCH_9_PRIVATE_CANARY,
  ALIGNMENT_BATCH_9_REVIEW_DECISIONS,
  ALIGNMENT_BATCH_9_REVIEW_VERSION,
} from '../lib/frontier-alignment-batch-9-review.ts'

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

const counts = {
  reviewed: ALIGNMENT_BATCH_9_REVIEW_DECISIONS.length,
  accepted: ALIGNMENT_BATCH_9_REVIEW_DECISIONS.filter((entry) => entry.decision === 'accept').length,
  revise: ALIGNMENT_BATCH_9_REVIEW_DECISIONS.filter((entry) => entry.decision === 'revise').length,
  rejected: ALIGNMENT_BATCH_9_REVIEW_DECISIONS.filter((entry) => entry.decision === 'reject').length,
  acceptedCandidateRevisions: ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES.length,
  canaryCandidateRevisions: ALIGNMENT_BATCH_9_PRIVATE_CANARY.length,
  canonicalMutationsAuthorized: ALIGNMENT_BATCH_9_REVIEW_DECISIONS.filter((entry) => entry.canonicalMutationAuthorized).length,
  publicProjectionsAuthorized: ALIGNMENT_BATCH_9_REVIEW_DECISIONS.filter((entry) => entry.publicProjectionAuthorized).length,
  releasesAuthorized: ALIGNMENT_BATCH_9_REVIEW_DECISIONS.filter((entry) => entry.releaseAuthorized).length,
}

const decisionsWithoutDigest = {
  schemaVersion: ALIGNMENT_BATCH_9_REVIEW_VERSION,
  boundary: {
    reviewKind: 'internal-editorial',
    reviewPass: 'separate-second-pass',
    externallyReviewed: false,
    independentlyReproduced: false,
    activeBindingsChanged: 0,
    canonicalRecordsMutated: 0,
    canonicalReleasesCreated: 0,
  },
  counts,
  decisions: ALIGNMENT_BATCH_9_REVIEW_DECISIONS,
  acceptedCandidates: ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES,
}
const decisionsArtifact = {
  ...decisionsWithoutDigest,
  artifactSha256: sha256(decisionsWithoutDigest),
}

const canaryWithoutDigest = {
  schemaVersion: 'maha-frontier-source-override-canary/0.1',
  boundary: {
    environment: 'private-in-memory-simulation',
    activeBindingsChanged: 0,
    databaseWrites: 0,
    canonicalRecordsMutated: 0,
    canonicalReleasesCreated: 0,
    publicProjectionAuthorized: false,
  },
  counts: {
    requested: 5,
    compiled: ALIGNMENT_BATCH_9_PRIVATE_CANARY.length,
    failed: 0,
    applied: 0,
  },
  candidates: ALIGNMENT_BATCH_9_PRIVATE_CANARY,
}
const canaryArtifact = {
  ...canaryWithoutDigest,
  artifactSha256: sha256(canaryWithoutDigest),
}

mkdirSync('content/frontier-alignment', { recursive: true })
mkdirSync('docs/frontier-audit', { recursive: true })
writeFileSync(
  'content/frontier-alignment/batch-9-review-decisions.json',
  `${JSON.stringify(decisionsArtifact, null, 2)}\n`,
)
writeFileSync(
  'content/frontier-alignment/batch-9-source-override-canary.json',
  `${JSON.stringify(canaryArtifact, null, 2)}\n`,
)

const row = (cells: readonly (string | number)[]) => `| ${cells.join(' | ')} |`
const lines = [
  '# Frontier source-alignment Batch 9 internal review',
  '',
  `Review \`${decisionsArtifact.schemaVersion}\` · digest \`${decisionsArtifact.artifactSha256}\``,
  '',
  'This is a separate internal-editorial review pass over the immutable Batch 9 proposals. It is not external review, independent reproduction, canonical adoption, or release authority. Accepted decisions produce private candidate revision and provenance digests only; the active records remain unchanged.',
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  ...Object.entries(counts).map(([key, value]) => row([key, value])),
  '',
  '## Decisions',
  '',
  row(['Record', 'Decision', 'Claim scope', 'Version relationship', 'Action']),
  row(['---', '---', '---', '---', '---']),
  ...ALIGNMENT_BATCH_9_REVIEW_DECISIONS.map((decision) => row([
    `\`${decision.recordId.replace('urn:maha:record:', '')}\``,
    `\`${decision.decision}\``,
    `\`${decision.checks.claimScope}\``,
    `\`${decision.checks.versionRelationship}\``,
    decision.requiredAction,
  ])),
  '',
  '## Five-record private canary',
  '',
  `Canary digest \`${canaryArtifact.artifactSha256}\``,
  '',
  row(['Record', 'Candidate revision', 'Provenance', 'State']),
  row(['---', '---', '---', '---']),
  ...ALIGNMENT_BATCH_9_PRIVATE_CANARY.map((candidate) => row([
    `\`${candidate.recordId.replace('urn:maha:record:', '')}\``,
    `\`${candidate.candidateRevisionSha256}\``,
    `\`${candidate.provenanceSha256}\``,
    `\`${candidate.applicationState}\``,
  ])),
  '',
  '## Boundaries',
  '',
  '- A review decision never edits the active source contract.',
  '- Revise, reject, missing, stale, or tampered decisions fail closed in the candidate compiler.',
  '- Accepted candidates are private source-binding revisions, not canonical records or releases.',
  '- No source content, quotation, credential, database row, public route, sitemap entry, or llms.txt entry is created.',
]
writeFileSync(
  'docs/frontier-audit/alignment-batch-9-review-decisions.md',
  `${lines.join('\n')}\n`,
)

console.log(JSON.stringify({
  wrote: [
    'content/frontier-alignment/batch-9-review-decisions.json',
    'content/frontier-alignment/batch-9-source-override-canary.json',
    'docs/frontier-audit/alignment-batch-9-review-decisions.md',
  ],
  counts,
  decisionsDigest: decisionsArtifact.artifactSha256,
  canaryDigest: canaryArtifact.artifactSha256,
}, null, 2))
