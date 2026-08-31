import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { BATCH_11_LINEAGE_DECLARATIONS, reconcileLineage } from './batch-11-mixed-lineage-release.ts'
import { PHASE_ORDER } from './batch-11-rehearsal-phases.ts'
import {
  KNOWN_RELEASE_STATUSES,
  gateRecord,
  probeLineage,
  rehearsalPlanDigest,
} from './batch-11-remote-rehearsal.ts'
import { BATCH_11_REVISION_AUDITS, BATCH_11_SCOPED_DECISIONS } from './batch-11-revision-canary.ts'

/**
 * Independent audit of the sanitized Batch 11 rehearsal evidence.
 *
 * The workflow exiting zero is not evidence that the lifecycle succeeded. It is
 * evidence that nothing the workflow checked returned non-zero, which is a
 * weaker claim and a different one. This verifier re-derives what it can from
 * the repository's immutable manifests and compares, rather than reading the
 * artifact's own digests back to itself.
 *
 * Every unresolved state is a refusal. An artifact that cannot be tied to a
 * reviewed commit, a teardown that was reported but never observed, and an API
 * whose state could not be read are all failures here, because each is a way
 * for a live resource or an unreviewed run to pass unnoticed.
 */

export const EVIDENCE_VERIFIER_VERSION = 'maha-batch-11-evidence-verifier/1.0' as const

/** Exactly what a compliant rehearsal must show. */
export const REQUIRED_RELEASES = 5
export const REQUIRED_SUPERSEDING = 2
export const REQUIRED_INITIAL = 3
export const REQUIRED_EXECUTION_ORDERS = 120

export type RefusalCode =
  | 'artifact-malformed'
  | 'mode-not-executed'
  | 'phase-count-wrong'
  | 'phase-duplicated'
  | 'phase-out-of-order'
  | 'phase-not-executed'
  | 'release-count-mismatch'
  | 'release-composition-mismatch'
  | 'cohort-size-mismatch'
  | 'record-substituted-or-undeclared'
  | 'plan-digest-mismatch'
  | 'revision-digest-mismatch'
  | 'audit-digest-mismatch'
  | 'review-digest-mismatch'
  | 'order-convergence-missing'
  | 'order-convergence-incomplete'
  | 'production-write-detected'
  | 'production-access-credentialed'
  | 'production-access-not-public-get'
  | 'preview-branch-not-created'
  | 'preview-branch-not-destroyed'
  | 'preview-deployment-not-created'
  | 'preview-deployment-not-destroyed'
  | 'reviewed-commit-unbound-in-artifact'
  | 'reviewed-commit-mismatch'
  | 'teardown-observations-absent'
  | 'teardown-reported-not-observed'
  | 'teardown-state-unknown'
  | 'teardown-resource-present'
  | 'secret-shaped-content'
  | 'sensitive-data-detected'

/**
 * How well a torn-down resource is actually known to be gone.
 *
 * The middle two states exist because they are the ones that get rounded up to
 * success. "The cleanup step said it deleted it" and "the listing call failed"
 * are not absence, and neither may pass.
 */
export type TeardownState = 'confirmed-absent' | 'reported-not-observed' | 'unknown' | 'present'
export const TEARDOWN_STATES: readonly TeardownState[] = ['confirmed-absent', 'reported-not-observed', 'unknown', 'present']

export type TeardownResourceKind = 'supabase-branch' | 'vercel-preview'
export const REQUIRED_TEARDOWN_KINDS: readonly TeardownResourceKind[] = ['supabase-branch', 'vercel-preview']

/**
 * A sanitized teardown observation.
 *
 * Carries a non-reversible fingerprint rather than a resource name, so an
 * observation can be published without disclosing what was provisioned.
 */
export interface TeardownObservation {
  resourceKind: TeardownResourceKind
  /** sha256 of the resource identifier. Never the identifier itself. */
  identifierFingerprint: string
  observedState: TeardownState
  /** Free text. Excluded from the deterministic digest. */
  detail: string
  /** Immutable source evidence when present. Excluded from the digest. */
  observedAt?: string | null
}

export interface VerifierInput {
  artifact: unknown
  reviewedCommit: string
  teardown?: readonly TeardownObservation[] | null
}

export interface CheckResult {
  check: string
  passed: boolean
  refusal: RefusalCode | null
  detail: string
}

export interface VerificationReport {
  schemaVersion: typeof EVIDENCE_VERIFIER_VERSION
  verdict: 'verified' | 'refused'
  checks: readonly CheckResult[]
  refusals: readonly RefusalCode[]
  observed: Record<string, unknown>
  verificationDigest: string
}

/* ------------------------------------------------------------- scanning -- */

const SECRET_SHAPES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'bearer token', pattern: /bearer\s+[A-Za-z0-9._~+/-]{16,}/i },
  { name: 'supabase access token', pattern: /\bsbp_[A-Za-z0-9]{16,}\b/ },
  { name: 'supabase service key', pattern: /\bsb(?:p|s)_[a-z]*_[A-Za-z0-9]{16,}\b/ },
  { name: 'json web token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: 'database url with password', pattern: /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i },
  // Vercel tokens are bare 24-character alphanumerics, which is also the shape
  // of an ordinary identifier. Matching them anywhere flags field names like
  // `previewDeploymentCreated`, so this only fires in a value position under a
  // credential-ish key, where a real token would actually appear.
  { name: 'vercel token', pattern: /"(?:vercel[A-Za-z]*token|token|accessToken|deploymentToken)"\s*:\s*"[A-Za-z0-9_-]{20,}"/i },
  { name: 'authorization header', pattern: /"authorization"\s*:/i },
  { name: 'assigned secret', pattern: /\b(?:secret|token|password|apikey|api_key)"?\s*[:=]\s*"?[A-Za-z0-9/+_-]{20,}/i },
]

/** Categories of person-level data that must never reach an operator report. */
const SENSITIVE_SHAPES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'participant data', pattern: /\bparticipant(?:Id|Name|Email|s)?\b/i },
  { name: 'natal data', pattern: /\bnatal\b|\bbirth(?:Time|Place|Date)\b/i },
  { name: 'customer data', pattern: /\bcustomer(?:Id|Name|Email)\b/i },
  { name: 'enquiry data', pattern: /\benquir(?:y|ies)\b/i },
  { name: 'payment data', pattern: /\bpayment(?:Id|Method|Intent)\b|\bcard(?:Number|Last4)\b|\biban\b/i },
  { name: 'email address', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { name: 'private corpus excerpt', pattern: /\breject-or-hold\b|\breview packet\b|\baudit corpus\b/i },
  { name: 'unhashed authority value', pattern: /"authorizationBasis"\s*:|"authorityId"\s*:\s*"(?!sha256:)/i },
]

export function scanForProhibitedContent(value: unknown): { secrets: string[]; sensitive: string[] } {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  return {
    secrets: SECRET_SHAPES.filter((shape) => shape.pattern.test(text)).map((shape) => shape.name),
    sensitive: SENSITIVE_SHAPES.filter((shape) => shape.pattern.test(text)).map((shape) => shape.name),
  }
}

/* ------------------------------------------------- repository re-derivation */

export interface RepositoryContract {
  planDigest: string
  recordIds: readonly string[]
  supersedingCount: number
  initialCount: number
  revisionDigests: Readonly<Record<string, string>>
  auditDigests: Readonly<Record<string, string>>
  reviewDigests: Readonly<Record<string, readonly string[]>>
}

/**
 * Re-derives the cohort contract from committed manifests.
 *
 * Nothing here reads the artifact. That is the point: a forged artifact cannot
 * move these numbers, so comparing against them is a check rather than an echo.
 */
export function repositoryContract(observationPath = 'content/frontier-alignment/batch-11-registry-observation.json'): RepositoryContract {
  const observation = JSON.parse(readFileSync(observationPath, 'utf8'))
  const probeInput = {
    observation,
    totalRegistryRows: observation.totalReleasesInRegistry,
    statusVocabulary: [...KNOWN_RELEASE_STATUSES],
  }
  const gates = BATCH_11_LINEAGE_DECLARATIONS.map((declaration) =>
    gateRecord(probeLineage(declaration.recordId, probeInput), declaration.declaredReleaseKind))

  const revisionDigests: Record<string, string> = {}
  const auditDigests: Record<string, string> = {}
  const reviewDigests: Record<string, string[]> = {}
  for (const audit of BATCH_11_REVISION_AUDITS) {
    revisionDigests[audit.recordId] = audit.revisedRecordRevisionSha256
    auditDigests[audit.recordId] = audit.auditSha256
  }
  for (const decision of BATCH_11_SCOPED_DECISIONS) {
    (reviewDigests[decision.recordId] ??= []).push(decision.decisionSha256)
  }
  for (const key of Object.keys(reviewDigests)) reviewDigests[key].sort()

  return {
    planDigest: rehearsalPlanDigest(reconcileLineage(observation), gates),
    recordIds: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => entry.recordId).slice().sort(),
    supersedingCount: BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredReleaseKind === 'superseding').length,
    initialCount: BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredReleaseKind === 'initial').length,
    revisionDigests,
    auditDigests,
    reviewDigests,
  }
}

/* --------------------------------------------------------- verification -- */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Audits one sanitized artifact against the repository contract.
 *
 * Collects every failure rather than stopping at the first, so an operator sees
 * the whole shape of a bad run instead of peeling it one refusal at a time.
 */
export function verifyRehearsalEvidence(input: VerifierInput, contract = repositoryContract()): VerificationReport {
  const checks: CheckResult[] = []
  const pass = (check: string, detail: string) => checks.push({ check, passed: true, refusal: null, detail })
  const fail = (check: string, refusal: RefusalCode, detail: string) => checks.push({ check, passed: false, refusal, detail })

  const artifact = input.artifact
  if (!isObject(artifact)) {
    const report: VerificationReport = {
      schemaVersion: EVIDENCE_VERIFIER_VERSION,
      verdict: 'refused',
      checks: [{ check: 'artifact-shape', passed: false, refusal: 'artifact-malformed', detail: 'The artifact is not a JSON object.' }],
      refusals: ['artifact-malformed'],
      observed: {},
      verificationDigest: '',
    }
    return { ...report, verificationDigest: verificationDigest(report) }
  }

  // Mode.
  if (artifact.mode === 'executed') pass('mode', 'The artifact reports mode "executed".')
  else fail('mode', 'mode-not-executed', `mode is ${JSON.stringify(artifact.mode)}, not "executed".`)

  // Phases: count, distinctness, order, and status.
  const phases = Array.isArray(artifact.phases) ? artifact.phases : []
  const phaseNames = phases.map((entry) => (isObject(entry) ? String(entry.phase) : '<malformed>'))
  if (phaseNames.length !== PHASE_ORDER.length) {
    fail('phase-count', 'phase-count-wrong', `Expected ${PHASE_ORDER.length} phases, found ${phaseNames.length}.`)
  } else pass('phase-count', `${PHASE_ORDER.length} phases present.`)

  if (new Set(phaseNames).size !== phaseNames.length) {
    fail('phase-distinctness', 'phase-duplicated', `A phase appears more than once: ${phaseNames.join(', ')}.`)
  } else pass('phase-distinctness', 'Every phase appears exactly once.')

  if (phaseNames.length === PHASE_ORDER.length && phaseNames.some((name, index) => name !== PHASE_ORDER[index])) {
    fail('phase-order', 'phase-out-of-order', `Phases ran as ${phaseNames.join(' -> ')}; the required order is ${PHASE_ORDER.join(' -> ')}.`)
  } else if (phaseNames.length === PHASE_ORDER.length) pass('phase-order', 'Phases ran in the required order.')

  const executed = phases.filter((entry) => isObject(entry) && entry.status === 'executed').length
  if (executed !== PHASE_ORDER.length) {
    fail('phase-status', 'phase-not-executed', `${executed} of ${PHASE_ORDER.length} phases report status "executed".`)
  } else pass('phase-status', 'Every phase reports status "executed".')

  // Releases.
  const releasesIssued = Number(artifact.releasesIssued)
  if (releasesIssued !== REQUIRED_RELEASES) {
    fail('release-count', 'release-count-mismatch', `Expected ${REQUIRED_RELEASES} releases, artifact reports ${JSON.stringify(artifact.releasesIssued)}.`)
  } else pass('release-count', `${REQUIRED_RELEASES} releases issued.`)

  const fingerprint = isObject(artifact.fingerprint) ? artifact.fingerprint : {}
  const superseding = Number(fingerprint.supersedingCount)
  const initial = Number(fingerprint.initialCount)
  if (superseding !== REQUIRED_SUPERSEDING || initial !== REQUIRED_INITIAL) {
    fail('release-composition', 'release-composition-mismatch',
      `Expected ${REQUIRED_SUPERSEDING} superseding and ${REQUIRED_INITIAL} initial; artifact reports ${superseding} and ${initial}.`)
  } else if (superseding !== contract.supersedingCount || initial !== contract.initialCount) {
    fail('release-composition', 'release-composition-mismatch',
      `The artifact composition does not match the repository declarations (${contract.supersedingCount} superseding, ${contract.initialCount} initial).`)
  } else pass('release-composition', `${superseding} superseding and ${initial} initial, matching the declarations.`)

  const cohortSize = Number(fingerprint.cohortSize)
  if (cohortSize !== contract.recordIds.length) {
    fail('cohort-size', 'cohort-size-mismatch', `Artifact cohort is ${cohortSize}; the repository declares ${contract.recordIds.length}.`)
  } else pass('cohort-size', `Cohort size ${cohortSize} matches the declarations.`)

  // The single strongest cross-check: the plan digest binds the manifest, every
  // record, its proposed revision, its audit and its scoped decisions. A
  // substituted or stale record cannot leave it unchanged.
  if (fingerprint.planDigest !== contract.planDigest) {
    fail('plan-digest', 'plan-digest-mismatch',
      `The artifact plan digest does not match the digest re-derived from the repository manifests. A record, revision, audit or review decision differs from what is declared.`)
  } else pass('plan-digest', 'The plan digest matches the digest re-derived from the repository manifests.')

  // Record identity, checked explicitly as well, so a refusal can name the record.
  const declared = new Set(contract.recordIds)
  const reported = Array.isArray(artifact.cohortRecordIds) ? artifact.cohortRecordIds.map(String) : null
  if (reported) {
    const substituted = reported.filter((id) => !declared.has(id))
    const missing = contract.recordIds.filter((id) => !reported.includes(id))
    if (substituted.length > 0 || missing.length > 0) {
      fail('record-identity', 'record-substituted-or-undeclared',
        `Undeclared: ${substituted.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}.`)
    } else pass('record-identity', 'Every released record is one the repository declares.')
  } else {
    pass('record-identity', 'The artifact lists no record ids; identity rests on the plan digest.')
  }

  // Order convergence.
  if (fingerprint.orderIndependent !== true) {
    fail('order-convergence', 'order-convergence-missing', 'The artifact does not assert order independence.')
  } else if (Number(fingerprint.ordersProvenIndependent) !== REQUIRED_EXECUTION_ORDERS) {
    fail('order-convergence', 'order-convergence-incomplete',
      `Order independence was proven over ${fingerprint.ordersProvenIndependent} orders; ${REQUIRED_EXECUTION_ORDERS} are required.`)
  } else pass('order-convergence', `All ${REQUIRED_EXECUTION_ORDERS} execution orders converge on one final state.`)

  // Production.
  if (Number(artifact.productionWritesPerformed) !== 0) {
    fail('production-writes', 'production-write-detected', `The artifact reports ${JSON.stringify(artifact.productionWritesPerformed)} Production writes.`)
  } else pass('production-writes', 'Zero Production writes.')

  const access = isObject(artifact.productionAccess) ? artifact.productionAccess : null
  if (!access || access.kind !== 'public-https-get') {
    fail('production-access', 'production-access-not-public-get', `Production access kind is ${JSON.stringify(access?.kind)}, not "public-https-get".`)
  } else if (access.credentialPresented !== false) {
    fail('production-access', 'production-access-credentialed', 'Production access presented a credential.')
  } else pass('production-access', 'Production access was a credential-free public GET.')

  // Preview lifecycle.
  for (const [field, created, destroyed] of [
    ['branch', 'previewBranchCreated', 'previewBranchDestroyed'],
    ['deployment', 'previewDeploymentCreated', 'previewDeploymentDestroyed'],
  ] as const) {
    const createdCode: RefusalCode = field === 'branch' ? 'preview-branch-not-created' : 'preview-deployment-not-created'
    const destroyedCode: RefusalCode = field === 'branch' ? 'preview-branch-not-destroyed' : 'preview-deployment-not-destroyed'
    if (artifact[created] !== true) fail(`preview-${field}-created`, createdCode, `${created} is not true.`)
    else pass(`preview-${field}-created`, `${created} is true.`)
    if (artifact[destroyed] !== true) fail(`preview-${field}-destroyed`, destroyedCode, `${destroyed} is not true.`)
    else pass(`preview-${field}-destroyed`, `${destroyed} is true.`)
  }

  // Reviewed commit. An artifact that does not name its commit cannot be tied
  // to reviewed code, which is a gap rather than a pass.
  const serialized = JSON.stringify(artifact)
  const artifactCommit = typeof artifact.reviewedCommit === 'string' ? artifact.reviewedCommit : null
  if (!/^[0-9a-f]{40}$/.test(input.reviewedCommit)) {
    fail('reviewed-commit', 'reviewed-commit-mismatch', 'The supplied reviewed commit is not a 40-character SHA.')
  } else if (artifactCommit) {
    if (artifactCommit !== input.reviewedCommit) {
      fail('reviewed-commit', 'reviewed-commit-mismatch', 'The artifact names a different reviewed commit than the one supplied.')
    } else pass('reviewed-commit', 'The artifact names the supplied reviewed commit.')
  } else if (serialized.includes(input.reviewedCommit)) {
    pass('reviewed-commit', 'The supplied reviewed commit appears in the artifact.')
  } else {
    fail('reviewed-commit', 'reviewed-commit-unbound-in-artifact',
      'The artifact carries no reviewed commit, so it cannot be tied to the code that was reviewed.')
  }

  // Teardown. Only confirmed absence passes.
  const teardown = input.teardown ?? null
  if (!teardown || teardown.length === 0) {
    fail('teardown', 'teardown-observations-absent',
      'No teardown observation was supplied. The rehearsal reporting its own cleanup is not independent confirmation.')
  } else {
    for (const kind of REQUIRED_TEARDOWN_KINDS) {
      const observation = teardown.find((entry) => entry.resourceKind === kind)
      if (!observation) {
        fail(`teardown-${kind}`, 'teardown-observations-absent', `No observation covers ${kind}.`)
        continue
      }
      switch (observation.observedState) {
        case 'confirmed-absent':
          pass(`teardown-${kind}`, `${kind} was independently observed absent.`)
          break
        case 'reported-not-observed':
          fail(`teardown-${kind}`, 'teardown-reported-not-observed', `${kind} cleanup was reported but never independently observed.`)
          break
        case 'present':
          fail(`teardown-${kind}`, 'teardown-resource-present', `${kind} is still present.`)
          break
        default:
          fail(`teardown-${kind}`, 'teardown-state-unknown', `${kind} state could not be read; unknown is not absence.`)
      }
    }
  }

  // Content scanning, over the artifact and everything this report will carry.
  const scanned = scanForProhibitedContent({ artifact, checks, teardown })
  if (scanned.secrets.length > 0) {
    fail('secret-scan', 'secret-shaped-content', `Secret-shaped content detected: ${scanned.secrets.join(', ')}.`)
  } else pass('secret-scan', 'No secret-shaped content.')
  if (scanned.sensitive.length > 0) {
    fail('sensitive-scan', 'sensitive-data-detected', `Sensitive content detected: ${scanned.sensitive.join(', ')}.`)
  } else pass('sensitive-scan', 'No participant, natal, customer, enquiry, payment or private-corpus content.')

  const refusals = [...new Set(checks.filter((entry) => !entry.passed).map((entry) => entry.refusal!))]
  const report: VerificationReport = {
    schemaVersion: EVIDENCE_VERIFIER_VERSION,
    verdict: refusals.length === 0 ? 'verified' : 'refused',
    checks,
    refusals,
    observed: {
      mode: artifact.mode ?? null,
      phases: phaseNames,
      releasesIssued: Number.isFinite(releasesIssued) ? releasesIssued : null,
      supersedingCount: Number.isFinite(superseding) ? superseding : null,
      initialCount: Number.isFinite(initial) ? initial : null,
      planDigestMatches: fingerprint.planDigest === contract.planDigest,
      ordersProvenIndependent: fingerprint.ordersProvenIndependent ?? null,
      productionWritesPerformed: artifact.productionWritesPerformed ?? null,
      teardownStates: (teardown ?? []).map((entry) => ({ resourceKind: entry.resourceKind, observedState: entry.observedState })),
    },
    verificationDigest: '',
  }
  return { ...report, verificationDigest: verificationDigest(report) }
}

/**
 * Digest over the evidentiary fields only.
 *
 * Free-text detail, observation timestamps and the digest field itself are
 * excluded, so the same evidence verified twice produces the same digest and a
 * changed verdict cannot hide behind reworded prose.
 */
export function verificationDigest(report: VerificationReport): string {
  const evidentiary = {
    schemaVersion: report.schemaVersion,
    verdict: report.verdict,
    refusals: [...report.refusals].sort(),
    checks: report.checks.map((entry) => ({ check: entry.check, passed: entry.passed, refusal: entry.refusal })),
    observed: report.observed,
  }
  return `sha256:${createHash('sha256').update(canonicalJson(evidentiary), 'utf8').digest('hex')}`
}
