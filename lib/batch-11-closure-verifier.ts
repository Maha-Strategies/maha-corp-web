import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { FINGERPRINT_PATTERN } from './batch-11-credential-provenance.ts'
import {
  CREDENTIAL_IDENTITY_FIELDS,
  TEMPORARY_ENVIRONMENT_SECRET_NAMES,
  compareReleasesToContract,
  environmentSecretSlotFingerprint,
  runMarkerFor,
} from './batch-11-evidence-binding.ts'
import {
  REVOCABLE_CREDENTIALS,
  REVOCATION_IDENTITY_BINDING,
  recomputeRevocationDigest,
  REVOCATION_EVIDENCE_VERSION,
  type RevocableCredential,
  type RevocationReport,
} from './batch-11-revocation-evidence.ts'
import {
  REQUIRED_INITIAL,
  REQUIRED_RELEASES,
  REQUIRED_SUPERSEDING,
  REQUIRED_TEARDOWN_KINDS,
  repositoryContract,
  scanForProhibitedContent,
  verifyRehearsalEvidence,
  type RepositoryContract,
  type TeardownEvidence,
} from './batch-11-evidence-verifier.ts'
import { PHASE_ORDER } from './batch-11-rehearsal-phases.ts'
import { TEARDOWN_PRODUCER_VERSION } from './batch-11-teardown-observations.ts'

/**
 * Whether a Batch 11 rehearsal is closed.
 *
 * Closure is a stronger claim than "the run succeeded". A run can execute
 * every phase, release the right records, and still leave a branch alive, a
 * secret bound, or no way to tell which credential did the work. This asks the
 * question that matters after the fact: is there anything left, and can the
 * evidence be tied to the exact run that produced it.
 *
 * It reads two sanitized artifacts and nothing else. No credential, no network,
 * no live provider state - so running it cannot itself be the thing that
 * changes what it is measuring. Every unresolved answer is a refusal, because
 * the states that get rounded up to success are exactly the ones that hide a
 * surviving resource.
 */

export const CLOSURE_VERIFIER_VERSION = 'maha-batch-11-closure-verifier/1.0' as const

export type ClosureRefusal =
  | 'artifact-malformed'
  | 'teardown-malformed'
  | 'evidence-verification-refused'
  | 'run-identity-inconsistent'
  | 'credential-fingerprint-unproven'
  | 'credential-fingerprint-malformed'
  | 'capability-preflight-missing'
  | 'capability-preflight-unsuccessful'
  | 'capability-preflight-malformed'
  | 'mutation-preceded-preflight'
  | 'resource-identity-missing'
  | 'resource-identity-unbound'
  | 'resource-not-confirmed-destroyed'
  | 'cleanup-incomplete'
  | 'closure-output-credential-shaped'
  | 'release-binding-incomplete'
  | 'preview-identity-unproven'
  | 'revocation-evidence-missing'
  | 'revocation-evidence-inconsistent'
  | 'revocation-digest-mismatch'
  | 'revocation-observation-duplicated'
  | 'revocation-identity-unbound'
  | 'revocation-credential-identity-mismatch'
  | 'credential-not-confirmed-revoked'

export interface ClosureCheck {
  check: string
  passed: boolean
  refusal: ClosureRefusal | null
  detail: string
}

export interface ClosureReport {
  schemaVersion: typeof CLOSURE_VERIFIER_VERSION
  closed: boolean
  checks: readonly ClosureCheck[]
  refusals: readonly ClosureRefusal[]
  /** Everything a reader needs, and nothing reversible. */
  summary: {
    reviewedCommit: string | null
    workflowRunId: string | null
    runMarker: string | null
    credentialFingerprintMatched: boolean
    capabilityPreflightStatus: number | null
    phasesExecuted: number
    releases: { total: number | null; superseding: number | null; initial: number | null }
    productionWrites: number | null
    resourcesConfirmedDestroyed: number
    resourcesRequired: number
    credentialsConfirmedRevoked: number
    credentialsRequired: number
    /** Whether every revocation observation named the run's own credentials. */
    revocationBoundToRunCredentials: boolean
    protectedEnvironment: string | null
  }
  /** The composed evidence verdict, carried so closure is auditable in one file. */
  evidenceVerdict: 'verified' | 'refused'
  evidenceRefusals: readonly string[]
  closureDigest: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Digest over the closure conclusion.
 *
 * Covers the verdict, every check outcome and the summary. Free-text detail is
 * excluded so reworded prose cannot move it, while a changed answer does.
 */
export function closureDigest(report: Omit<ClosureReport, 'closureDigest'>): string {
  const conclusion = {
    schemaVersion: report.schemaVersion,
    closed: report.closed,
    refusals: [...report.refusals].sort(),
    checks: report.checks.map((entry) => ({ check: entry.check, passed: entry.passed, refusal: entry.refusal })),
    summary: report.summary,
    evidenceVerdict: report.evidenceVerdict,
    evidenceRefusals: [...report.evidenceRefusals].sort(),
  }
  return `sha256:${createHash('sha256').update(canonicalJson(conclusion), 'utf8').digest('hex')}`
}

/**
 * Verifies closure from the two sanitized artifacts.
 *
 * The reviewed commit is taken from the artifact rather than supplied, because
 * the artifact digest already covers it: a forged commit fails the digest under
 * the composed evidence verifier, so self-declaration is checkable here rather
 * than merely trusted.
 */
export function verifyBatch11Closure(
  artifact: unknown,
  teardown: unknown,
  revocation: unknown = null,
  contract: RepositoryContract = repositoryContract(),
): ClosureReport {
  const checks: ClosureCheck[] = []
  const pass = (check: string, detail: string) => checks.push({ check, passed: true, refusal: null, detail })
  const fail = (check: string, refusal: ClosureRefusal, detail: string) =>
    checks.push({ check, passed: false, refusal, detail })

  const emptySummary: ClosureReport['summary'] = {
    reviewedCommit: null,
    workflowRunId: null,
    runMarker: null,
    credentialFingerprintMatched: false,
    capabilityPreflightStatus: null,
    phasesExecuted: 0,
    releases: { total: null, superseding: null, initial: null },
    productionWrites: null,
    resourcesConfirmedDestroyed: 0,
    resourcesRequired: REQUIRED_TEARDOWN_KINDS.length,
    credentialsConfirmedRevoked: 0,
    credentialsRequired: REVOCABLE_CREDENTIALS.length,
    revocationBoundToRunCredentials: false,
    protectedEnvironment: null,
  }

  const seal = (report: Omit<ClosureReport, 'closureDigest'>): ClosureReport => {
    const sealed = { ...report, closureDigest: closureDigest(report) }
    // The report is scanned before it is returned: a closure report is meant to
    // be published, and a leak here would travel further than the artifact did.
    const scanned = scanForProhibitedContent(sealed)
    if (scanned.secrets.length > 0 || scanned.sensitive.length > 0) {
      const refused: Omit<ClosureReport, 'closureDigest'> = {
        ...report,
        closed: false,
        checks: [{
          check: 'closure-output-scan',
          passed: false,
          refusal: 'closure-output-credential-shaped',
          detail: `The closure report contains prohibited content: ${[...scanned.secrets, ...scanned.sensitive].join(', ')}.`,
        }],
        refusals: ['closure-output-credential-shaped'],
        summary: emptySummary,
      }
      return { ...refused, closureDigest: closureDigest(refused) }
    }
    return sealed
  }

  if (!isObject(artifact)) {
    return seal({
      schemaVersion: CLOSURE_VERIFIER_VERSION,
      closed: false,
      checks: [{ check: 'artifact-shape', passed: false, refusal: 'artifact-malformed', detail: 'The rehearsal artifact is not a JSON object.' }],
      refusals: ['artifact-malformed'],
      summary: emptySummary,
      evidenceVerdict: 'refused',
      evidenceRefusals: [],
    })
  }
  if (!isObject(teardown) || !Array.isArray((teardown as Record<string, unknown>).observations)) {
    return seal({
      schemaVersion: CLOSURE_VERIFIER_VERSION,
      closed: false,
      checks: [{ check: 'teardown-shape', passed: false, refusal: 'teardown-malformed', detail: 'The teardown artifact is not a producer report.' }],
      refusals: ['teardown-malformed'],
      summary: emptySummary,
      evidenceVerdict: 'refused',
      evidenceRefusals: [],
    })
  }

  const evidence = teardown as unknown as TeardownEvidence
  const reviewedCommit = typeof artifact.reviewedCommit === 'string' ? artifact.reviewedCommit : ''

  // Everything the evidence verifier already proves - commit binding, seven
  // ordered phases, five releases split two and three, zero Production writes,
  // exact cohort identity - is composed rather than restated.
  const evidenceReport = verifyRehearsalEvidence({ artifact, reviewedCommit, teardown: evidence }, contract)
  if (evidenceReport.verdict !== 'verified') {
    fail('evidence-verification', 'evidence-verification-refused',
      `The composed evidence verification refused: ${evidenceReport.refusals.join(', ')}.`)
  } else pass('evidence-verification', 'Commit, phases, releases, cohort identity and Production boundaries all verified.')

  // The two artifacts must describe the same run. Either alone can look right.
  const runId = artifact.workflowRunId === undefined || artifact.workflowRunId === null ? '' : String(artifact.workflowRunId)
  const runMarker = typeof artifact.runMarker === 'string' ? artifact.runMarker : ''
  if (!runId || runMarker !== runMarkerFor(runId)
    || String(evidence.workflowRunId ?? '') !== runId
    || evidence.runMarker !== runMarker
    || evidence.reviewedCommit !== reviewedCommit) {
    fail('run-identity', 'run-identity-inconsistent',
      'The rehearsal and teardown artifacts do not describe the same run, marker and commit.')
  } else pass('run-identity', `Both artifacts describe run ${runId} at marker ${runMarker}.`)

  // Which credential did the work. A run that cannot say is not closed, even
  // when everything it did was correct.
  if (artifact.credentialFingerprintMatched !== true) {
    fail('credential-fingerprint', 'credential-fingerprint-unproven',
      'The artifact does not record that the bound credential matched its expected fingerprint.')
  } else pass('credential-fingerprint', 'The bound credential matched its expected non-secret fingerprint.')

  // The read-only capability probe, which is what turns a wrong credential into
  // a refusal instead of an orphaned branch.
  const capability = isObject(artifact.poolerCapabilityPreflight) ? artifact.poolerCapabilityPreflight : null
  if (!capability) {
    fail('capability-preflight', 'capability-preflight-missing', 'The artifact records no capability preflight.')
  } else if (capability.status !== 200) {
    fail('capability-preflight', 'capability-preflight-unsuccessful',
      `The capability preflight recorded status ${JSON.stringify(capability.status)} rather than 200.`)
  } else if (capability.databaseType !== 'PRIMARY'
    || typeof capability.poolMode !== 'string' || capability.poolMode.length === 0
    || typeof capability.primaryHostFingerprint !== 'string' || !FINGERPRINT_PATTERN.test(capability.primaryHostFingerprint)
    || typeof capability.parentProjectRefFingerprint !== 'string' || !FINGERPRINT_PATTERN.test(capability.parentProjectRefFingerprint)) {
    fail('capability-preflight', 'capability-preflight-malformed',
      'The capability preflight is not a structurally valid PRIMARY record carrying only non-reversible fingerprints.')
  } else pass('capability-preflight', `The read-only capability preflight succeeded in ${capability.poolMode} mode.`)

  if (artifact.mutationStartedAfterPreflight !== true) {
    fail('mutation-order', 'mutation-preceded-preflight',
      'The artifact does not record that every mutation began after the preflight completed.')
  } else pass('mutation-order', 'Every remote mutation began after the preflight completed.')

  // Exact resource identity: each observation must be the fingerprint this run
  // derives, not a plausible-looking hash from somewhere else.
  const observations = evidence.observations ?? []
  const handles = isObject(artifact.teardownHandleDigests) ? artifact.teardownHandleDigests : null
  const identityProblems: string[] = []
  if (!handles) {
    identityProblems.push('the artifact records no teardown handle digests')
  }
  for (const kind of REQUIRED_TEARDOWN_KINDS) {
    const matching = observations.filter((entry) => entry.resourceKind === kind)
    if (matching.length !== 1) {
      identityProblems.push(`${kind}: ${matching.length} observations`)
      continue
    }
    // The observation must fingerprint the resource the run actually created,
    // not merely something shaped like a fingerprint. Matching the artifact's
    // own handle digest is what ties the two artifacts to one set of resources.
    const expected = handles ? handles[kind] : undefined
    if (typeof expected !== 'string' || !FINGERPRINT_PATTERN.test(expected)) {
      identityProblems.push(`${kind}: the artifact declares no usable handle digest`)
    } else if (matching[0].identifierFingerprint !== expected) {
      identityProblems.push(`${kind}: the observation fingerprints a different resource than the run created`)
    }
  }
  if (identityProblems.length > 0) {
    fail('resource-identity', identityProblems.some((entry) => entry.includes('observations'))
      ? 'resource-identity-missing' : 'resource-identity-unbound', identityProblems.join('; '))
  } else pass('resource-identity', `All ${REQUIRED_TEARDOWN_KINDS.length} temporary resources are identified by fingerprints derived from this run.`)

  // Destruction, independently observed. "The run said it cleaned up" is the
  // claim under audit, not the evidence for it.
  const destroyed = observations.filter((entry) => entry.observedState === 'confirmed-absent')
  const unresolved = observations.filter((entry) => entry.observedState !== 'confirmed-absent')
  if (unresolved.length > 0 || destroyed.length !== REQUIRED_TEARDOWN_KINDS.length) {
    fail('resource-destruction', 'resource-not-confirmed-destroyed',
      `${unresolved.length} resource(s) were not independently confirmed absent: ${unresolved.map((entry) => `${entry.resourceKind} (${entry.observedState})`).join(', ') || 'coverage incomplete'}.`)
  } else pass('resource-destruction', `Every ephemeral branch, deployment, secret binding and release row was independently confirmed absent.`)

  const cleanup = isObject(artifact.cleanup) ? artifact.cleanup : null
  if (!cleanup || Object.values(cleanup).some((value) => value !== true)) {
    fail('cleanup-status', 'cleanup-incomplete',
      `The artifact reports incomplete cleanup: ${JSON.stringify(cleanup)}.`)
  } else pass('cleanup-status', 'The run reports every temporary resource destroyed, corroborated by the observations above.')

  // Each release bound to its exact revision, source-alignment audit and
  // scoped decision bundle. A release can carry the right revision and audit
  // and still have been approved by a different set of decisions.
  const releaseProblems = Array.isArray(artifact.releaseIdentities)
    ? compareReleasesToContract(artifact.releaseIdentities as never)
    : ['the artifact lists no release identities']
  if (releaseProblems.length > 0) {
    fail('release-binding', 'release-binding-incomplete', releaseProblems.slice(0, 3).join(' '))
  } else pass('release-binding', 'Every release binds its exact revision, audit and decision-bundle digest.')

  // Who ran it, and under what protection.
  const identities = isObject(artifact.identities) ? artifact.identities : null
  const environment = identities && typeof identities.protectedEnvironment === 'string' ? identities.protectedEnvironment : null
  if (!identities || environment !== 'batch-11-preview-rehearsal') {
    fail('preview-identities', 'preview-identity-unproven',
      `The artifact records the protected environment as ${JSON.stringify(environment)}.`)
  } else if (CREDENTIAL_IDENTITY_FIELDS.some(([field]) =>
    typeof identities[field] !== 'string' || !FINGERPRINT_PATTERN.test(identities[field] as string))
    || new Set(CREDENTIAL_IDENTITY_FIELDS.map(([field]) => identities[field])).size !== CREDENTIAL_IDENTITY_FIELDS.length) {
    fail('preview-identities', 'preview-identity-unproven',
      `The artifact does not record ${CREDENTIAL_IDENTITY_FIELDS.length} distinct non-reversible ephemeral credential identities.`)
  } else pass('preview-identities', `Run approved in ${environment} under ${CREDENTIAL_IDENTITY_FIELDS.length} distinct ephemeral credential identities.`)

  /**
   * The fingerprint a revocation observation must carry to be about this run.
   *
   * Two come straight from the artifact: the run held those values and recorded
   * their digests, so an observation about a different token - however genuinely
   * revoked - fails to match. The third is derived rather than recorded, because
   * GitHub never returns a secret value; what is bound instead is the exact
   * slot, which is still specific to this environment, this run and this commit.
   *
   * Returns null when the artifact cannot supply the identity at all, which is a
   * different failure from supplying the wrong one.
   */
  const expectedRevocationIdentity = (credential: RevocableCredential): string | null => {
    const binding = REVOCATION_IDENTITY_BINDING[credential]
    if (binding === 'environment-secret-slot') {
      if (!environment || !runMarker || !reviewedCommit) return null
      return environmentSecretSlotFingerprint({
        environment,
        names: TEMPORARY_ENVIRONMENT_SECRET_NAMES,
        runMarker,
        reviewedCommit,
      })
    }
    const declared = identities ? identities[binding] : undefined
    return typeof declared === 'string' && FINGERPRINT_PATTERN.test(declared) ? declared : null
  }

  // Revocation, from an independent post-run check rather than the run itself.
  const revocationReport = isObject(revocation) ? (revocation as unknown as RevocationReport) : null
  let revoked = 0
  let revocationBound = false
  if (!revocationReport || !Array.isArray(revocationReport.observations)) {
    fail('revocation', 'revocation-evidence-missing',
      'No revocation evidence was supplied. A destroyed branch does not revoke the token that created it.')
  } else if (revocationReport.schemaVersion !== REVOCATION_EVIDENCE_VERSION
    || revocationReport.runMarker !== runMarker
    || revocationReport.reviewedCommit !== reviewedCommit) {
    fail('revocation', 'revocation-evidence-inconsistent',
      'The revocation evidence does not describe this run at this commit.')
  } else if (revocationReport.revocationDigest !== recomputeRevocationDigest({
    schemaVersion: revocationReport.schemaVersion,
    runMarker: revocationReport.runMarker,
    reviewedCommit: revocationReport.reviewedCommit,
    observations: revocationReport.observations,
    allConfirmedRevoked: revocationReport.observations.every((entry) => entry.observedState === 'confirmed-revoked'),
  })) {
    fail('revocation', 'revocation-digest-mismatch', 'The revocation digest does not recompute from its own observations.')
  } else {
    const seenCredentials = revocationReport.observations.map((entry) => entry.credential)
    const missing = REVOCABLE_CREDENTIALS.filter((credential) => !seenCredentials.includes(credential))
    const unresolved = revocationReport.observations.filter((entry) => entry.observedState !== 'confirmed-revoked')
    revoked = revocationReport.observations.filter((entry) => entry.observedState === 'confirmed-revoked').length

    // Which exact secrets these observations are about. Checked before the
    // states, because "confirmed-revoked" for the wrong credential is a more
    // misleading answer than "not confirmed" for the right one.
    const unbound: string[] = []
    const mismatched: string[] = []
    for (const observation of revocationReport.observations) {
      if (!REVOCABLE_CREDENTIALS.includes(observation.credential)) continue
      const expected = expectedRevocationIdentity(observation.credential)
      if (expected === null) unbound.push(observation.credential)
      else if (observation.credentialFingerprint !== expected) mismatched.push(observation.credential)
    }
    revocationBound = unbound.length === 0 && mismatched.length === 0 && missing.length === 0

    if (missing.length > 0) {
      fail('revocation', 'revocation-evidence-missing',
        `Revocation coverage is incomplete: missing ${missing.join(', ')}.`)
    } else if (new Set(seenCredentials).size !== seenCredentials.length) {
      fail('revocation', 'revocation-observation-duplicated',
        'A credential is observed more than once; one run issued one of each.')
    } else if (unbound.length > 0) {
      fail('revocation', 'revocation-identity-unbound',
        `The artifact records no credential identity to check these observations against: ${unbound.join(', ')}.`)
    } else if (mismatched.length > 0) {
      fail('revocation', 'revocation-credential-identity-mismatch',
        `${mismatched.join(', ')}: the observation is about a different credential than this run used.`)
    } else if (unresolved.length > 0) {
      fail('revocation', 'credential-not-confirmed-revoked',
        `${unresolved.map((entry) => `${entry.credential} (${entry.observedState})`).join(', ')}.`)
    } else pass('revocation', `All ${REVOCABLE_CREDENTIALS.length} temporary credentials this run used were independently confirmed revoked.`)
  }

  const fingerprintValue = isObject(artifact.fingerprint) ? artifact.fingerprint : {}
  const refusals = [...new Set(checks.filter((entry) => !entry.passed).map((entry) => entry.refusal!))]

  return seal({
    schemaVersion: CLOSURE_VERIFIER_VERSION,
    closed: refusals.length === 0,
    checks,
    refusals,
    summary: {
      reviewedCommit: reviewedCommit || null,
      workflowRunId: runId || null,
      runMarker: runMarker || null,
      credentialFingerprintMatched: artifact.credentialFingerprintMatched === true,
      capabilityPreflightStatus: capability && typeof capability.status === 'number' ? capability.status : null,
      phasesExecuted: Array.isArray(artifact.phases)
        ? artifact.phases.filter((entry) => isObject(entry) && entry.status === 'executed').length
        : 0,
      releases: {
        total: typeof artifact.releasesIssued === 'number' ? artifact.releasesIssued : null,
        superseding: typeof fingerprintValue.supersedingCount === 'number' ? fingerprintValue.supersedingCount : null,
        initial: typeof fingerprintValue.initialCount === 'number' ? fingerprintValue.initialCount : null,
      },
      productionWrites: typeof artifact.productionWritesPerformed === 'number' ? artifact.productionWritesPerformed : null,
      resourcesConfirmedDestroyed: destroyed.length,
      resourcesRequired: REQUIRED_TEARDOWN_KINDS.length,
      credentialsConfirmedRevoked: revoked,
      credentialsRequired: REVOCABLE_CREDENTIALS.length,
      revocationBoundToRunCredentials: revocationBound,
      protectedEnvironment: environment,
    },
    evidenceVerdict: evidenceReport.verdict,
    evidenceRefusals: evidenceReport.refusals,
  })
}

/** The closure contract, restated for the operator report. */
export const CLOSURE_REQUIREMENTS = {
  phases: PHASE_ORDER.length,
  releases: REQUIRED_RELEASES,
  superseding: REQUIRED_SUPERSEDING,
  initial: REQUIRED_INITIAL,
  productionWrites: 0,
  resources: REQUIRED_TEARDOWN_KINDS.length,
  producerSchema: TEARDOWN_PRODUCER_VERSION,
} as const
