import {
  activeEpistemicReleases,
  epistemicReleaseStatus,
  publicEpistemicReleaseProvenance,
  sanitizedEpistemicRelease,
  type EpistemicCanonicalRelease,
  type EpistemicReleaseWithdrawal,
} from './epistemic-release.ts'
import {
  createEpistemicPersistenceClient,
  listEpistemicCanonicalReleases,
  listEpistemicReleaseWithdrawals,
} from './epistemic-store.ts'
import { PUBLIC_EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

export interface PublicEpistemicReleaseHistory {
  releases: EpistemicCanonicalRelease[]
  withdrawals: EpistemicReleaseWithdrawal[]
}

export async function getPublicEpistemicReleaseHistory(): Promise<PublicEpistemicReleaseHistory> {
  const client = createEpistemicPersistenceClient()
  if (!client) return { releases: [], withdrawals: [] }
  try {
    const [releases, withdrawals] = await Promise.all([
      listEpistemicCanonicalReleases(client),
      listEpistemicReleaseWithdrawals(client),
    ])
    return { releases, withdrawals }
  } catch {
    return { releases: [], withdrawals: [] }
  }
}

export async function getActiveEpistemicCanonicalReleases(): Promise<EpistemicCanonicalRelease[]> {
  const { releases, withdrawals } = await getPublicEpistemicReleaseHistory()
  return activeEpistemicReleases(releases, withdrawals)
}

export async function getPublicEpistemicRecords() {
  const active = await getActiveEpistemicCanonicalReleases()
  const records = new Map<string, EpistemicRecord>(PUBLIC_EPISTEMIC_RECORDS.map((record) => [record.id, record]))
  for (const release of active) records.set(release.recordId, release.recordSnapshot)
  return [...records.values()].sort((left, right) => epistemicRecordPath(left).localeCompare(epistemicRecordPath(right)))
}

export async function getPublicEpistemicDomainRecords(domainSlug: string) {
  return (await getPublicEpistemicRecords()).filter((record) => record.domainSlug === domainSlug)
}

export async function getActiveEpistemicRecordByPath(path: string) {
  if (!/^\/knowledge\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(path)) return null
  const releases = await getActiveEpistemicCanonicalReleases()
  return releases.find((release) => release.canonicalPath === path)?.recordSnapshot ?? null
}

export async function getPublicEpistemicReleaseRegistry() {
  const { releases, withdrawals } = await getPublicEpistemicReleaseHistory()
  const active = activeEpistemicReleases(releases, withdrawals)
  return {
    schemaVersion: 'maha-epistemic-release-registry/1.0',
    generatedAt: new Date().toISOString(),
    counts: {
      totalReleases: releases.length,
      active: active.length,
      superseded: releases.filter((release) => epistemicReleaseStatus(release, releases, withdrawals) === 'superseded').length,
      withdrawn: releases.filter((release) => epistemicReleaseStatus(release, releases, withdrawals) === 'withdrawn').length,
    },
    releases: releases.map((release) => sanitizedEpistemicRelease(release, releases, withdrawals)),
    boundary: 'This registry proves the publication lineage and gate decision for each release. It does not certify the truth, predictive validity, safety, or fitness of the underlying claims.',
  }
}

export async function getPublicEpistemicReleaseProvenance(releaseId: string) {
  if (!/^epirelease_[a-f0-9]{32}$/.test(releaseId)) return null
  const { releases, withdrawals } = await getPublicEpistemicReleaseHistory()
  const release = releases.find((candidate) => candidate.releaseId === releaseId)
  return release ? publicEpistemicReleaseProvenance(release, releases, withdrawals) : null
}
