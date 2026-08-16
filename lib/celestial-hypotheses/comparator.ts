/**
 * Deterministic comparator generation.
 *
 * A comparator set is the alternative moments the elected moment will be judged
 * against. Two properties matter and neither is statistical: the draw must be
 * reproducible by anyone holding the seed, and it must be fixed before the
 * outcome is known. This module provides both and claims nothing else.
 *
 * It is explicitly not a matched control. Constraining weekday, local hour and
 * geography removes the most obvious confounds; it does not balance anything
 * unobserved, and `COMPARATOR_BOUNDARY` is carried alongside every draw.
 */

import { createHash } from 'node:crypto'

import { sha256Hex } from './canonical.ts'
import { COMPARATOR_BOUNDARY, type ComparatorPolicy } from './types.ts'

export class ComparatorError extends Error {}

/** sfc32, seeded from the digest of the declared seed. */
function seededRandom(seed: string): () => number {
  const digest = createHash('sha256').update(seed).digest()
  let a = digest.readUInt32BE(0)
  let b = digest.readUInt32BE(4)
  let c = digest.readUInt32BE(8)
  let d = digest.readUInt32BE(12)
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4_294_967_296
  }
}

/** Weekday and hour of an instant, in the declared zone. */
function localParts(instant: Date, timeZone: string): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, weekday: 'short', hour: '2-digit' }).formatToParts(instant)
  const weekdayName = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0') % 24
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName)
  return { weekday, hour }
}

export interface ComparatorDraw {
  /** Position in the draw sequence; stable for a given seed. */
  index: number
  instantUtc: string
}

export interface ComparatorSet {
  policyVersion: ComparatorPolicy['policyVersion']
  /** Digest of the seed, whether the seed was revealed or only committed. */
  seedCommitmentSha256: string
  requestedDraws: number
  draws: ComparatorDraw[]
  /** Populated when the constraints could not yield the requested number. */
  shortfallReason: string | null
  boundary: string
}

/**
 * The commitment for a policy.
 *
 * A revealed seed hashes to its own commitment, so a policy registered with a
 * commitment and later opened with the seed can be checked against the
 * registration digest without the registry having held the seed.
 */
export function comparatorSeedCommitment(policy: ComparatorPolicy): string {
  if (policy.seedCommitmentSha256) return policy.seedCommitmentSha256
  if (policy.seed) return sha256Hex(policy.seed)
  throw new ComparatorError('Comparator policy carries neither a seed nor a commitment.')
}

export interface GenerateComparatorsInput {
  policy: ComparatorPolicy
  /** The elected moment, whose weekday the draws may be required to match. */
  electedMomentUtc: string
  /** Required when the policy only carries a commitment. */
  revealedSeed?: string
}

export function generateComparators(input: GenerateComparatorsInput): ComparatorSet {
  const { policy, electedMomentUtc } = input
  const seed = policy.seed ?? input.revealedSeed
  if (!seed) throw new ComparatorError('A seed is required to generate comparators; the policy carries only a commitment.')

  const commitment = comparatorSeedCommitment(policy)
  if (policy.seedCommitmentSha256 && sha256Hex(seed) !== policy.seedCommitmentSha256) {
    throw new ComparatorError('The revealed seed does not match the registered commitment.')
  }

  const start = new Date(policy.feasibleWindowStartUtc).getTime()
  const end = new Date(policy.feasibleWindowEndUtc).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new ComparatorError('The feasible window is empty or invalid.')
  }

  const elected = new Date(electedMomentUtc)
  if (!Number.isFinite(elected.getTime())) throw new ComparatorError('electedMomentUtc is not a valid instant.')

  const { timeZone, localHourBand, sameWeekday } = policy.matching
  const [lowHour, highHour] = localHourBand
  const electedWeekday = localParts(elected, timeZone).weekday

  const exclusions = (policy.exclusions ?? []).map((exclusion) => ({
    start: new Date(exclusion.startUtc).getTime(),
    end: new Date(exclusion.endUtc).getTime(),
  }))

  const random = seededRandom(seed)
  const draws: ComparatorDraw[] = []
  const seen = new Set<string>()

  // A bounded search: tight constraints over a short window can be
  // unsatisfiable, and the honest response is a stated shortfall rather than a
  // loop that never ends or a silently smaller comparator set.
  const maxAttempts = Math.max(10_000, policy.draws * 2_000)
  let attempts = 0

  while (draws.length < policy.draws && attempts < maxAttempts) {
    attempts += 1
    // Minute resolution: finer precision would imply the tradition
    // distinguishes moments it does not.
    const candidateMs = Math.floor((start + random() * (end - start)) / 60_000) * 60_000
    const candidate = new Date(candidateMs)

    if (exclusions.some((exclusion) => candidateMs >= exclusion.start && candidateMs < exclusion.end)) continue

    const parts = localParts(candidate, timeZone)
    if (sameWeekday && parts.weekday !== electedWeekday) continue
    if (parts.hour < lowHour || parts.hour > highHour) continue

    const iso = candidate.toISOString()
    if (seen.has(iso)) continue
    seen.add(iso)
    draws.push({ index: draws.length, instantUtc: iso })
  }

  return {
    policyVersion: policy.policyVersion,
    seedCommitmentSha256: commitment,
    requestedDraws: policy.draws,
    draws,
    shortfallReason: draws.length < policy.draws
      ? `Only ${draws.length} of ${policy.draws} comparators satisfied the declared constraints within ${maxAttempts} attempts. Widen the feasible window, the local-hour band, or the weekday constraint.`
      : null,
    boundary: COMPARATOR_BOUNDARY,
  }
}
