import type { SupabaseClient } from '@supabase/supabase-js'

import {
  activeEpistemicReleases,
  buildEpistemicCanonicalRelease,
  type CanonicalReleaseInput,
} from './epistemic-release.ts'
import {
  insertEpistemicCanonicalRelease,
  listEpistemicCanonicalReleases,
  listEpistemicExpertReviews,
  listEpistemicReleaseWithdrawals,
  listEpistemicReviewTargets,
} from './epistemic-store.ts'

export async function executeEpistemicCanonicalRelease(
  client: SupabaseClient,
  input: CanonicalReleaseInput,
  actorFingerprint: string,
) {
  const [targets, reviews, releases, withdrawals] = await Promise.all([
    listEpistemicReviewTargets(client),
    listEpistemicExpertReviews(client),
    listEpistemicCanonicalReleases(client),
    listEpistemicReleaseWithdrawals(client),
  ])
  const active = activeEpistemicReleases(releases, withdrawals)
  const target = targets.find((candidate) => candidate.recordId === input.recordId && candidate.reviewTargetSha256 === input.targetSha256)
  if (!target?.candidateSnapshot) throw new Error('The current frozen release target was not found.')
  const previous = active.find((release) => release.recordId === input.recordId) ?? null
  const release = buildEpistemicCanonicalRelease(input, {
    recordId: target.recordId,
    targetSha256: target.reviewTargetSha256,
    candidateSnapshot: target.candidateSnapshot,
  }, reviews, previous)
  if (input.operation === 'preview') return { release, persisted: false as const, persistence: null }
  const persistence = await insertEpistemicCanonicalRelease(client, release, input.idempotencyKey, actorFingerprint)
  return { release, persisted: true as const, persistence }
}

