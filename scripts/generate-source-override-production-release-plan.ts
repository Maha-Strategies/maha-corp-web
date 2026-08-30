import { mkdirSync, writeFileSync } from 'node:fs'

import { sha256Canonical } from '../lib/epistemic-publication.ts'
import { PRIVATE_REVISION_RELEASE_CANARY } from '../lib/source-override-revision-canary.ts'

const targets = PRIVATE_REVISION_RELEASE_CANARY.map((entry) => ({
  recordId: entry.recordId,
  targetSha256: entry.targetSha256,
  canonicalPath: entry.canonicalPath,
  releaseKind: entry.releaseKind,
  priorReleaseId: entry.priorReleaseId,
  priorReleaseTargetSha256: entry.priorReleaseTargetSha256,
  auditSha256: entry.auditSha256,
  decisionSha256s: entry.decisionSha256s,
  substantialContractDigest: entry.substantialContractDigest,
  requiredCanonicalVersion: entry.releaseKind === 'superseding' ? '1.1.0' : '1.0.0',
  requiredSupersedesReleaseId: entry.priorReleaseId,
  state: 'prepared-not-authorized' as const,
}))

const body = {
  schemaVersion: 'maha-source-override-production-release-plan/1.0',
  preparedFromCommit: 'resolved-at-execution-after-main-merge',
  requiredConfirmation: 'RELEASE_5_SOURCE_OVERRIDE_REVISIONS_IN_PRODUCTION',
  requiredEnvironment: 'production-database',
  requiredBranch: 'main',
  targets,
  counts: {
    total: targets.length,
    superseding: targets.filter((entry) => entry.releaseKind === 'superseding').length,
    initial: targets.filter((entry) => entry.releaseKind === 'initial').length,
  },
  controls: {
    executable: false,
    productionMutationAuthorized: false,
    authorityCredentialIncluded: false,
    operationsCredentialIncluded: false,
    explicitFutureAuthorizationRequired: true,
    exactMainCommitMustBeRecordedBeforeDispatch: true,
    previewEvidenceMustBeAttachedBeforeDispatch: true,
  },
  boundary: 'This file prepares exact release targets and lineage only. It is not an authorization, workflow dispatch, canonical release, external review, independent reproduction, scientific validation, or commercial certification.',
}
const payload = { ...body, planSha256: sha256Canonical(body) }

mkdirSync('content/epistemic', { recursive: true })
mkdirSync('docs/operations', { recursive: true })
writeFileSync('content/epistemic/source-override-production-release-plan.json', `${JSON.stringify(payload, null, 2)}\n`)

const rows = targets.map((entry) =>
  `| \`${entry.recordId.replace('urn:maha:record:', '')}\` | ${entry.releaseKind} | \`${entry.targetSha256}\` | \`${entry.canonicalPath}\` |`,
)
writeFileSync('docs/operations/source-override-production-release-plan.md', [
  '# Source-override Production release plan — prepared, not authorized',
  '',
  `Plan digest: \`${payload.planSha256}\``,
  '',
  'This package prepares the exact two superseding and three initial release targets. It cannot be executed: it contains no authority snapshot, credential, authorized operation, Production commit, or dispatch instruction. A new explicit authorization is required after the private Preview evidence is complete.',
  '',
  '| Record | Kind | Exact revision | Canonical path |',
  '| --- | --- | --- | --- |',
  ...rows,
  '',
  '## Required future gate',
  '',
  '- Merge the reviewed implementation to `main` and record the exact commit.',
  '- Attach the sanitized private Preview lifecycle evidence.',
  '- Reverify every target digest, prior lineage, review scope, and route against that commit.',
  '- Obtain explicit authorization using the dedicated Production confirmation phrase.',
  '- Use the separately protected `production-database` environment and release-authority credential.',
  '- Stop if any target, release lineage, path, review digest, or Preview invariant has drifted.',
  '',
  'Internal review and release lineage do not establish truth, external endorsement, independent reproduction, safety, or commercial fitness.',
  '',
].join('\n'))
