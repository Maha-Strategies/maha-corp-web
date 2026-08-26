import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { EPISTEMIC_PHASE4_PILOT_ENTRIES } from './epistemic-pilot-corpus.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

/**
 * Namespace-aware resolution of a submitted `domain:slug` endpoint reference
 * onto a canonical epistemic record.
 *
 * This exists because bridge batches arrive with a namespace their author
 * chose, not the one the corpus uses. The first Q-BR audit hardcoded its own
 * corpus assembly and consequently reported four domains as absent that in
 * fact exist in the Phase-4 pilot corpus, one of them under a different domain
 * id. That was a defect in the resolver, not in the corpus, and this module is
 * the fix: one shared resolver, one declared alias table, typed outcomes.
 *
 * Design rules, all enforced by test:
 *   - exact canonical id wins before any alias is considered;
 *   - aliases are explicit and versioned, never inferred;
 *   - the submitted reference is preserved verbatim and never rewritten;
 *   - a normalized reference is recorded separately when an alias applies;
 *   - a nearest-slug suggestion is advisory only and is NEVER substituted;
 *   - a record in a non-canonical content system is a distinct outcome, not a
 *     resolution;
 *   - a public route is never evidence that a canonical record exists.
 */

export const REFERENCE_RESOLVER_VERSION = 'maha-reference-resolver/1.0' as const

/**
 * Declared domain aliases. Each entry is versioned and carries the reason it
 * exists so an alias can be audited rather than trusted.
 *
 * `canonical: false` means the alias target is a real namespace but is not a
 * canonical graph domain, so anything landing there cannot satisfy a bridge
 * endpoint.
 */
export interface DomainAlias {
  alias: string
  target: string
  since: string
  reason: string
}

export const DOMAIN_ALIASES: readonly DomainAlias[] = [
  {
    alias: 'fusion-plasma',
    target: 'fusion-plasma-systems',
    since: 'maha-reference-resolver/1.0',
    reason: 'Submitted batches shorten the canonical fusion-plasma-systems domain id.',
  },
  {
    alias: 'agentic-systems',
    target: 'agentic-systems-mcp',
    since: 'maha-reference-resolver/1.0',
    reason: 'Submitted batches drop the -mcp suffix from the canonical agentic-systems-mcp domain id.',
  },
  {
    alias: 'semiconductor-manufacturing',
    target: 'semiconductor',
    since: 'maha-reference-resolver/1.0',
    reason:
      'The Phase-4 pilot corpus uses the domain id "semiconductor". This alias makes the namespace difference explicit; it does not make pilot entries canonical.',
  },
]

/** An alias table with two entries for one alias would silently pick a winner. */
const aliasCounts = new Map<string, number>()
for (const entry of DOMAIN_ALIASES) {
  aliasCounts.set(entry.alias, (aliasCounts.get(entry.alias) ?? 0) + 1)
}
for (const [alias, count] of aliasCounts) {
  if (count > 1) throw new Error(`Ambiguous domain alias: ${alias} is declared ${count} times.`)
}
for (const entry of DOMAIN_ALIASES) {
  if (aliasCounts.has(entry.target)) {
    throw new Error(`Alias chain rejected: ${entry.target} is both an alias and an alias target.`)
  }
}

/**
 * Declared record aliases.
 *
 * A domain alias fixes a namespace difference. A record alias fixes a naming
 * difference for the SAME concept, and is far easier to abuse, so it carries a
 * higher burden: `equivalenceEvidence` must quote the canonical record text
 * that demonstrates the two names denote one concept. A merely related, nearby,
 * or narrower concept is not an alias and must stay unresolved — the submitter
 * should point at the record that exists rather than have the resolver quietly
 * redirect them.
 *
 * The alias key is the submitted reference verbatim. Nothing is inferred.
 */
export interface RecordAlias {
  alias: string
  targetRecordId: string
  since: string
  reason: string
  /** Canonical record text showing the two names denote the same concept. */
  equivalenceEvidence: string
}

export const RECORD_ALIASES: readonly RecordAlias[] = [
  {
    alias: 'quantum-systems:syndrome-extraction-cycle',
    targetRecordId: 'urn:maha:record:stabilizer-syndrome-measurement',
    since: 'maha-reference-resolver/1.1',
    reason:
      'Syndrome extraction and syndrome measurement are the same operation under two standard names, and the canonical record already scopes the repeated round rather than a single shot.',
    equivalenceEvidence:
      'The canonical record describes "Repeated parity measurements that extract error information while preserving the encoded logical state under the code model." Repetition is the cycle and extraction is the syndrome, so the submitted name adds nothing the record does not already bound.',
  },
]

const recordAliasCounts = new Map<string, number>()
for (const entry of RECORD_ALIASES) {
  recordAliasCounts.set(entry.alias, (recordAliasCounts.get(entry.alias) ?? 0) + 1)
}
for (const [alias, count] of recordAliasCounts) {
  if (count > 1) throw new Error(`Ambiguous record alias: ${alias} is declared ${count} times.`)
}

/* ---------------------------------------------------------------- corpus -- */

/** Canonical graph records. The only class a bridge endpoint may resolve to. */
const CANONICAL: readonly EpistemicRecord[] = EPISTEMIC_RECORDS
const CANONICAL_BY_ID = new Map(CANONICAL.map((record) => [record.id, record]))
const CANONICAL_DOMAINS = new Set(CANONICAL.map((record) => record.domainSlug))

/**
 * Phase-4 pilot ingestion entries. A different record class: they carry
 * `initialSourceBlockers` and are not canonical graph records, so a hit here is
 * reported as incompatible rather than resolved.
 */
const PILOT_DOMAINS = new Set(EPISTEMIC_PHASE4_PILOT_ENTRIES.map((entry) => entry.domainSlug))

/**
 * A record alias may only point at a canonical record, may never shadow a real
 * canonical id, and may never point at another alias. Each of these fails at
 * module load rather than silently producing a wrong resolution.
 */
for (const entry of RECORD_ALIASES) {
  if (CANONICAL_BY_ID.has(entry.alias)) {
    throw new Error(`Record alias collision: ${entry.alias} is already a canonical record id.`)
  }
  if (!CANONICAL_BY_ID.has(entry.targetRecordId)) {
    throw new Error(`Record alias ${entry.alias} targets ${entry.targetRecordId}, which is not a canonical record.`)
  }
  if (recordAliasCounts.has(entry.targetRecordId)) {
    throw new Error(`Record alias chain rejected: ${entry.targetRecordId} is both an alias and an alias target.`)
  }
}

export type ResolutionOutcome =
  | {
      status: 'exact-resolution'
      recordId: string
      domainSlug: string
      recordRevisionSha256: string
    }
  | {
      status: 'alias-resolution'
      recordId: string
      domainSlug: string
      recordRevisionSha256: string
      /** Exactly one of these is set, naming which table did the work. */
      appliedAlias?: DomainAlias
      appliedRecordAlias?: RecordAlias
      normalizedReference: string
    }
  | { status: 'unresolved-domain'; requestedDomain: string }
  | {
      status: 'unresolved-record'
      domainSlug: string
      /** Advisory only. Never substituted for the submitted reference. */
      nearestSlugSuggestion: string | null
      candidateCount: number
      appliedAlias?: DomainAlias
      normalizedReference?: string
    }
  | { status: 'ambiguous'; domainSlug: string; matches: readonly string[] }
  | {
      status: 'incompatible-record-class'
      domainSlug: string
      foundIn: string
      foundRecordId: string
      reason: string
      appliedAlias?: DomainAlias
    }

export interface ResolutionResult {
  /** Exactly as submitted. Never rewritten. */
  submittedReference: string
  outcome: ResolutionOutcome
  resolverVersion: typeof REFERENCE_RESOLVER_VERSION
}

function nearest(pool: readonly EpistemicRecord[], slug: string): string | null {
  const words = slug.split('-').filter((word) => word.length > 3)
  if (!words.length) return null
  let best: string | null = null
  let bestScore = 0
  for (const record of pool) {
    const recordWords = record.slug.split('-').filter((word) => word.length > 3)
    const score =
      words.filter((word) => recordWords.some((other) => other.includes(word) || word.includes(other))).length /
      words.length
    if (score > bestScore) {
      bestScore = score
      best = record.slug
    }
  }
  return bestScore >= 0.5 ? best : null
}

export function resolveEpistemicReference(submittedReference: string): ResolutionResult {
  const base = { submittedReference, resolverVersion: REFERENCE_RESOLVER_VERSION } as const

  // 1. An exact canonical id always wins, before any namespace interpretation.
  const direct = CANONICAL_BY_ID.get(submittedReference)
  if (direct) {
    return {
      ...base,
      outcome: {
        status: 'exact-resolution',
        recordId: direct.id,
        domainSlug: direct.domainSlug,
        recordRevisionSha256: epistemicReviewTargetHash(direct),
      },
    }
  }

  // 2. A declared record alias, matched on the submitted reference verbatim.
  //    This runs after the exact-id check so a real canonical id always wins,
  //    and before namespace interpretation so an alias cannot be assembled out
  //    of a domain alias plus a guess.
  const recordAlias = RECORD_ALIASES.find((entry) => entry.alias === submittedReference)
  if (recordAlias) {
    const target = CANONICAL_BY_ID.get(recordAlias.targetRecordId)!
    return {
      ...base,
      outcome: {
        status: 'alias-resolution',
        recordId: target.id,
        domainSlug: target.domainSlug,
        recordRevisionSha256: epistemicReviewTargetHash(target),
        appliedRecordAlias: recordAlias,
        normalizedReference: `${target.domainSlug}:${target.slug}`,
      },
    }
  }

  const separator = submittedReference.indexOf(':')
  if (separator < 1) {
    return { ...base, outcome: { status: 'unresolved-domain', requestedDomain: submittedReference } }
  }
  const requestedDomain = submittedReference.slice(0, separator)
  const slug = submittedReference.slice(separator + 1)

  const alias = DOMAIN_ALIASES.find((entry) => entry.alias === requestedDomain)
  const domainSlug = alias?.target ?? requestedDomain
  const normalizedReference = alias ? `${alias.target}:${slug}` : undefined

  const pool = CANONICAL.filter((record) => record.domainSlug === domainSlug)

  if (pool.length) {
    const matches = pool.filter((record) => record.slug === slug || record.slug === `${domainSlug}-${slug}`)
    if (matches.length > 1) {
      return {
        ...base,
        outcome: { status: 'ambiguous', domainSlug, matches: matches.map((record) => record.id) },
      }
    }
    if (matches.length === 1) {
      const record = matches[0]
      const revision = epistemicReviewTargetHash(record)
      return alias
        ? {
            ...base,
            outcome: {
              status: 'alias-resolution',
              recordId: record.id,
              domainSlug,
              recordRevisionSha256: revision,
              appliedAlias: alias,
              normalizedReference: normalizedReference!,
            },
          }
        : {
            ...base,
            outcome: {
              status: 'exact-resolution',
              recordId: record.id,
              domainSlug,
              recordRevisionSha256: revision,
            },
          }
    }
    return {
      ...base,
      outcome: {
        status: 'unresolved-record',
        domainSlug,
        nearestSlugSuggestion: nearest(pool, slug),
        candidateCount: pool.length,
        ...(alias ? { appliedAlias: alias, normalizedReference } : {}),
      },
    }
  }

  // The domain exists, but only in a non-canonical content system.
  if (PILOT_DOMAINS.has(domainSlug)) {
    const entry = EPISTEMIC_PHASE4_PILOT_ENTRIES.find(
      (candidate) => candidate.domainSlug === domainSlug && candidate.slug === slug,
    )
    if (entry) {
      return {
        ...base,
        outcome: {
          status: 'incompatible-record-class',
          domainSlug,
          foundIn: 'EPISTEMIC_PHASE4_PILOT_ENTRIES',
          foundRecordId: entry.recordId,
          reason:
            'Found a Phase-4 pilot ingestion entry, not a canonical graph record. Pilot entries carry their own unresolved source blockers and cannot back a bridge endpoint.',
          ...(alias ? { appliedAlias: alias } : {}),
        },
      }
    }
    return {
      ...base,
      outcome: {
        status: 'unresolved-record',
        domainSlug,
        nearestSlugSuggestion: null,
        candidateCount: 0,
        ...(alias ? { appliedAlias: alias, normalizedReference } : {}),
      },
    }
  }

  return { ...base, outcome: { status: 'unresolved-domain', requestedDomain: domainSlug } }
}

/** True only for outcomes that may back a bridge endpoint. */
export function isResolvedOutcome(outcome: ResolutionOutcome): boolean {
  return outcome.status === 'exact-resolution' || outcome.status === 'alias-resolution'
}

/** Namespaces the resolver knows about, for the gap report. */
export function namespaceInventory() {
  const canonical = [...CANONICAL_DOMAINS].sort().map((domainSlug) => ({
    domainSlug,
    recordCount: CANONICAL.filter((record) => record.domainSlug === domainSlug).length,
    backingModule: 'lib/epistemic-pilots.ts EPISTEMIC_RECORDS',
    canonicalGraph: true,
    publicProjection: true,
  }))
  const pilotOnly = [...PILOT_DOMAINS]
    .filter((domainSlug) => !CANONICAL_DOMAINS.has(domainSlug))
    .sort()
    .map((domainSlug) => ({
      domainSlug,
      recordCount: EPISTEMIC_PHASE4_PILOT_ENTRIES.filter((entry) => entry.domainSlug === domainSlug).length,
      backingModule: 'lib/epistemic-pilot-corpus.ts EPISTEMIC_PHASE4_PILOT_ENTRIES',
      canonicalGraph: false,
      publicProjection: false,
    }))
  return { resolverVersion: REFERENCE_RESOLVER_VERSION, canonical, pilotOnly, aliases: DOMAIN_ALIASES }
}
