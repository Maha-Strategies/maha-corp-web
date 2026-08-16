import { openGate, optionsResponse, registryError, registryJson } from '@/lib/celestial-hypotheses/route-support'
import { getExperiment, latestAnalysis, listOutcomes } from '@/lib/celestial-hypotheses/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Read one experiment.
 *
 * Authenticated: this returns the participant pseudonym and the full locked
 * draft. The projection safe for public consumption lives in
 * `provenance.publicView` and is not served by any route in this version — see
 * the migration's note on deferred public listing.
 *
 * Outcome values are summarised rather than enumerated. A caller that needs the
 * individual observations can derive them from the digests in the provenance
 * bundle; returning the series by default would make casual re-identification
 * of a small participant set easier than it needs to be.
 */
export async function GET(request: Request, { params }: { params: Promise<{ experimentId: string }> }) {
  const gate = openGate(request, { write: false })
  if (!gate.ok) return gate.response

  const { experimentId } = await params

  try {
    const existing = await getExperiment(gate.client, experimentId)
    if (!existing) return registryError('experiment_not_found', 'No experiment matches this id.', 404)

    const outcomes = existing.status === 'draft' ? [] : await listOutcomes(gate.client, experimentId)
    const analysis = existing.status === 'draft' ? null : await latestAnalysis(gate.client, experimentId)

    return registryJson({
      experimentId: existing.experimentId,
      status: existing.status,
      registrationSha256: existing.registrationSha256,
      registeredAtUtc: existing.registeredAtUtc,
      draft: existing.draft,
      notes: existing.notes,
      outcomeSummary: {
        observations: outcomes.length,
        sampleSizeTarget: existing.draft?.sampleSizeTarget ?? null,
        minimumObservations: existing.draft?.analysisPlan?.minimumObservations ?? null,
      },
      analysis: analysis
        ? { status: analysis.status, classification: analysis.classification, observations: analysis.observations, rationale: analysis.rationale, analysisSha256: analysis.analysisSha256 }
        : null,
    }, 200)
  } catch (error) {
    return registryError('experiment_read_failed', error instanceof Error ? error.message : 'The experiment could not be read.', 502)
  }
}

export function OPTIONS() {
  return optionsResponse('GET, OPTIONS')
}
