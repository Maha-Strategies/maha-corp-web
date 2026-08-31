import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import type { TeardownObservation, TeardownResourceKind, TeardownState } from './batch-11-evidence-verifier.ts'
import type { TeardownHandleDigests } from './batch-11-evidence-binding.ts'

/**
 * Turns sanitized provider query results into teardown observations.
 *
 * The rehearsal reporting its own cleanup is not confirmation of it, so the
 * verifier needs an input produced somewhere else. This is that producer, and
 * it is deliberately inert: it makes no network call and reads no credential.
 * An operator runs the authoritative queries, sanitizes the results, and feeds
 * them here.
 *
 * The whole design turns on one asymmetry. Finding a resource proves presence;
 * failing to find one proves absence only when the search actually happened,
 * covered the right scope, and completed. A query that errored, covered a
 * partial scope, or was never attempted returns the same empty list as a
 * successful search of an empty account - so those cases produce `unknown`
 * rather than absence.
 */

export const TEARDOWN_PRODUCER_VERSION = 'maha-batch-11-teardown-observations/2.0' as const

/** Every temporary resource a rehearsal can leave behind. */
export const TEARDOWN_RESOURCE_KINDS: readonly TeardownResourceKind[] = [
  'supabase-branch',
  'vercel-preview',
  'github-environment-secret',
  'database-release-rows',
]

export type QueryStatus = 'succeeded' | 'failed' | 'malformed' | 'not-attempted'

/**
 * How much of the resource space a query actually covered.
 *
 * `exact-run-marker` and `exact-identifier` are the only scopes that can
 * support an absence claim. A broad or partial sweep cannot, and is not
 * accepted as one.
 */
export type QueryScope = 'exact-run-marker' | 'exact-identifier' | 'partial' | 'unknown'

export interface ProviderMatch {
  /** sha256 of the resource identifier. Never the identifier itself. */
  identifierFingerprint: string
  status: string
}

/** One sanitized authoritative query result, supplied by the operator. */
export interface ProviderQueryResult {
  provider: string
  resourceKind: TeardownResourceKind
  queryStatus: QueryStatus
  scope: QueryScope
  /** The run marker the query was scoped to. */
  runMarker: string
  /** The reviewed commit the run belonged to. */
  reviewedCommit: string
  /** Digest of the exact private identifier queried. */
  identifierFingerprint: string
  matches: readonly ProviderMatch[]
  detail: string
}

export interface ProducerInput {
  runMarker: string
  reviewedCommit: string
  expectedFingerprints: TeardownHandleDigests
  results: readonly ProviderQueryResult[]
}

export type ProducerRefusal =
  | 'no-query-for-resource'
  | 'query-did-not-succeed'
  | 'scope-insufficient'
  | 'stale-run-marker'
  | 'commit-mismatch'
  | 'resource-present'
  | 'provider-disagreement'
  | 'credential-shaped-input'
  | 'identifier-mismatch'

export interface ProducedObservation extends TeardownObservation {
  /** Why this state was reached, as a code rather than prose. */
  refusal: ProducerRefusal | null
  /** Queries that contributed, by provider name only. */
  providers: readonly string[]
}

export interface ProducerReport {
  schemaVersion: typeof TEARDOWN_PRODUCER_VERSION
  runMarker: string
  reviewedCommit: string
  observations: readonly ProducedObservation[]
  allConfirmedAbsent: boolean
  observationsDigest: string
}

const CREDENTIAL_SHAPES: readonly RegExp[] = [
  /bearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /\bsbp_[A-Za-z0-9]{16,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i,
  /"(?:token|secret|password|apikey|api_key)"\s*:\s*"[A-Za-z0-9/+_-]{16,}"/i,
]

/** Refuses input that carries anything credential-shaped, before using it. */
export function assertSanitized(input: unknown): void {
  const text = JSON.stringify(input ?? null)
  for (const pattern of CREDENTIAL_SHAPES) {
    if (pattern.test(text)) {
      throw new Error('The supplied provider results contain credential-shaped text. Sanitize them before producing observations.')
    }
  }
}

/**
 * Reduces every query for one resource kind to a single state.
 *
 * Presence wins over everything: if any authoritative query found the resource,
 * it is present regardless of what the others say. Absence is the weakest
 * claim and needs unanimity - every query succeeded, every scope was exact,
 * every marker and commit matched, and nothing was found.
 */
export function reduceResourceState(
  kind: TeardownResourceKind,
  runMarker: string,
  reviewedCommit: string,
  expectedFingerprint: string,
  results: readonly ProviderQueryResult[],
): { state: TeardownState; refusal: ProducerRefusal | null; detail: string; providers: string[] } {
  const forKind = results.filter((entry) => entry.resourceKind === kind)
  const providers = forKind.map((entry) => entry.provider).sort()

  if (forKind.length === 0) {
    return { state: 'unknown', refusal: 'no-query-for-resource', detail: `No authoritative query covered ${kind}.`, providers }
  }

  const found = forKind.filter((entry) => entry.matches.length > 0)
  if (found.length > 0) {
    const disagreeing = forKind.some((entry) => entry.queryStatus === 'succeeded' && entry.matches.length === 0)
    return {
      state: 'present',
      refusal: disagreeing ? 'provider-disagreement' : 'resource-present',
      detail: disagreeing
        ? `${kind}: providers disagree - ${found.map((e) => e.provider).join(', ')} found it while another reported none.`
        : `${kind}: ${found.reduce((total, entry) => total + entry.matches.length, 0)} matching resource(s) remain.`,
      providers,
    }
  }

  for (const entry of forKind) {
    if (entry.identifierFingerprint !== expectedFingerprint) {
      return { state: 'unknown', refusal: 'identifier-mismatch', detail: `${kind}: the ${entry.provider} query covered a different exact identifier.`, providers }
    }
    if (entry.queryStatus !== 'succeeded') {
      return { state: 'unknown', refusal: 'query-did-not-succeed', detail: `${kind}: the ${entry.provider} query ${entry.queryStatus}; an unread state is not absence.`, providers }
    }
    if (entry.scope !== 'exact-run-marker' && entry.scope !== 'exact-identifier') {
      return { state: 'unknown', refusal: 'scope-insufficient', detail: `${kind}: the ${entry.provider} query covered "${entry.scope}", which cannot support an absence claim.`, providers }
    }
    if (entry.runMarker !== runMarker) {
      return { state: 'unknown', refusal: 'stale-run-marker', detail: `${kind}: the ${entry.provider} query was scoped to a different run marker.`, providers }
    }
    if (entry.reviewedCommit !== reviewedCommit) {
      return { state: 'unknown', refusal: 'commit-mismatch', detail: `${kind}: the ${entry.provider} query belongs to a different reviewed commit.`, providers }
    }
  }

  return {
    state: 'confirmed-absent',
    refusal: null,
    detail: `${kind}: ${forKind.length} authoritative quer${forKind.length === 1 ? 'y' : 'ies'} succeeded at exact scope and found nothing.`,
    providers,
  }
}

/**
 * Recomputes a producer report's digest from its own fields.
 *
 * Exported so the verifier can re-derive it rather than trusting the value the
 * report carries: a hand-assembled object with a plausible digest is exactly
 * what this is meant to catch.
 */
export function recomputeObservationsDigest(report: {
  schemaVersion: string
  runMarker: string
  reviewedCommit: string
  observations: readonly ProducedObservation[]
  allConfirmedAbsent: boolean
}): string {
  return `sha256:${createHash('sha256').update(canonicalJson({
    schemaVersion: report.schemaVersion,
    runMarker: report.runMarker,
    reviewedCommit: report.reviewedCommit,
    allConfirmedAbsent: report.allConfirmedAbsent,
    observations: report.observations.map((entry) => ({
      resourceKind: entry.resourceKind,
      identifierFingerprint: entry.identifierFingerprint,
      observedState: entry.observedState,
      refusal: entry.refusal,
    })),
  }), 'utf8').digest('hex')}`
}

/** Produces one observation per required resource kind. */
export function produceTeardownObservations(input: ProducerInput): ProducerReport {
  assertSanitized(input)

  const observations: ProducedObservation[] = TEARDOWN_RESOURCE_KINDS.map((kind) => {
    const expectedFingerprint = input.expectedFingerprints[kind]
    const reduced = reduceResourceState(kind, input.runMarker, input.reviewedCommit, expectedFingerprint, input.results)
    return {
      resourceKind: kind,
      // Exact resource identity, disclosed only as the digest bound by the
      // public rehearsal artifact.
      identifierFingerprint: expectedFingerprint,
      observedState: reduced.state,
      detail: reduced.detail,
      refusal: reduced.refusal,
      providers: reduced.providers,
    }
  })

  const report = {
    schemaVersion: TEARDOWN_PRODUCER_VERSION,
    runMarker: input.runMarker,
    reviewedCommit: input.reviewedCommit,
    observations,
    allConfirmedAbsent: observations.every((entry) => entry.observedState === 'confirmed-absent'),
  }
  return { ...report, observationsDigest: recomputeObservationsDigest(report) }
}
