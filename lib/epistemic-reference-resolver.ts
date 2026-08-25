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
      appliedAlias: DomainAlias
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
