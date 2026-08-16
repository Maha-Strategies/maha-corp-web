import { runAnalysis } from '@/lib/celestial-hypotheses/analysis'
import { OutcomeRejected, buildOutcomeRecord } from '@/lib/celestial-hypotheses/outcomes'
import { openGate, optionsResponse, readJsonBody, registryError, registryJson } from '@/lib/celestial-hypotheses/route-support'
import { DuplicateOutcome, appendAnalysis, appendOutcome, getExperiment, listOutcomes } from '@/lib/celestial-hypotheses/store'
import { HYPOTHESIS_REGISTRY_VERSION, type ExperimentRegistration } from '@/lib/celestial-hypotheses/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Record one observation. Append-only.
 *
 * There is no PATCH and no DELETE on this route, and none can be added
 * usefully: the migration revokes update and delete on the outcomes table from
 * service_role, so a handler that tried would fail at the database.
 *
 * The submitted `rawPayload` is hashed and dropped. It is never stored and
 * never echoed back — the registry has no need to accumulate a copy of someone
 * else's telemetry, and holding one would be a liability rather than evidence.
 */
export async function POST(request: Request, { params }: { params: Promise<{ experimentId: string }> }) {
  const gate = openGate(request, { write: true })
  if (!gate.ok) return gate.response

  const { experimentId } = await params
  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  try {
    const existing = await getExperiment(gate.client, experimentId)
    if (!existing) return registryError('experiment_not_found', 'No experiment matches this id.', 404)
    if (existing.status === 'draft' || !existing.registrationSha256 || !existing.registeredAtUtc) {
      return registryError('not_registered', 'An outcome cannot be recorded before the experiment is registered.', 409)
    }
    if (existing.status === 'analyzed') {
      return registryError('experiment_complete', 'The fixed sample has been analyzed; no later outcome can change it.', 409)
    }

    const priorOutcomes = await listOutcomes(gate.client, experimentId)
    if (priorOutcomes.length >= existing.draft.sampleSizeTarget) {
      return registryError('sample_complete', 'The fixed sample size has already been reached.', 409)
    }

    const registration: ExperimentRegistration = {
      experimentId: existing.experimentId,
      status: 'registered',
      registryVersion: HYPOTHESIS_REGISTRY_VERSION,
      registrationSha256: existing.registrationSha256,
      registeredAtUtc: existing.registeredAtUtc,
      draft: existing.draft,
    }

    const submission = body.value as Parameters<typeof buildOutcomeRecord>[1]
    const record = buildOutcomeRecord(registration, submission, { now: () => new Date() })
    await appendOutcome(gate.client, { ...record, registrationSha256: existing.registrationSha256 })

    // Analysis is attempted on every append so a result appears as soon as the
    // declared horizon and sample threshold are both met — and returns
    // `pending` until then rather than a premature number.
    const outcomes = await listOutcomes(gate.client, experimentId)
    const analysis = runAnalysis({ registration, outcomes, now: new Date() })
    await appendAnalysis(gate.client, experimentId, analysis)

    return registryJson({
      experimentId,
      outcomeSha256: record.outcomeSha256,
      recordedObservations: outcomes.length,
      analysis: { status: analysis.status, classification: analysis.classification, rationale: analysis.rationale, analysisSha256: analysis.analysisSha256 },
    }, 201)
  } catch (error) {
    if (error instanceof DuplicateOutcome) {
      return registryError('duplicate_outcome', 'This idempotency key has already been recorded for this experiment.', 409)
    }
    if (error instanceof OutcomeRejected) {
      return registryError('outcome_rejected', 'The outcome could not be recorded.', 422, error.issues)
    }
    return registryError('outcome_write_failed', error instanceof Error ? error.message : 'The outcome could not be recorded.', 502)
  }
}

export function OPTIONS() {
  return optionsResponse('POST, OPTIONS')
}
