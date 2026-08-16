import { buildProvenanceBundle } from '@/lib/celestial-hypotheses/provenance'
import { openGate, optionsResponse, registryError, registryJson } from '@/lib/celestial-hypotheses/route-support'
import { getExperiment, latestAnalysis, listOutcomes } from '@/lib/celestial-hypotheses/store'
import { HYPOTHESIS_REGISTRY_VERSION, type ExperimentRegistration } from '@/lib/celestial-hypotheses/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The full hash chain for one experiment.
 *
 * This is the endpoint a sceptical reader uses: it exposes the registration
 * digest and timestamp, the fact-bundle digest, the compiler and rule-registry
 * versions, the rule ids and the passage and source ids they resolve to, the
 * comparator's seed commitment, the analysis-plan hash, every outcome digest,
 * and the analysis digest once one exists.
 *
 * It exposes the seed *commitment*, never the seed. Publishing an unopened seed
 * would let a reader reconstruct a comparator draw the registration deliberately
 * kept sealed until the outcome was in.
 */
export async function GET(request: Request, { params }: { params: Promise<{ experimentId: string }> }) {
  const gate = openGate(request, { write: false })
  if (!gate.ok) return gate.response

  const { experimentId } = await params

  try {
    const existing = await getExperiment(gate.client, experimentId)
    if (!existing) return registryError('experiment_not_found', 'No experiment matches this id.', 404)
    if (existing.status === 'draft' || !existing.registrationSha256 || !existing.registeredAtUtc) {
      return registryError('not_registered', 'A draft has no provenance bundle; nothing has been locked yet.', 409)
    }

    const registration: ExperimentRegistration = {
      experimentId: existing.experimentId,
      status: 'registered',
      registryVersion: HYPOTHESIS_REGISTRY_VERSION,
      registrationSha256: existing.registrationSha256,
      registeredAtUtc: existing.registeredAtUtc,
      draft: existing.draft,
    }

    const outcomes = await listOutcomes(gate.client, experimentId)
    const analysis = await latestAnalysis(gate.client, experimentId)

    return registryJson({ provenance: buildProvenanceBundle({ registration, outcomes, analysis }) }, 200)
  } catch (error) {
    return registryError('provenance_read_failed', error instanceof Error ? error.message : 'The provenance bundle could not be built.', 502)
  }
}

export function OPTIONS() {
  return optionsResponse('GET, OPTIONS')
}
