import { openGate, optionsResponse, readJsonBody } from '@/lib/celestial-hypotheses/route-support'
import { summarizeCorpusExposure } from '@/lib/celestial-event-corpus/analysis'
import { compileCorpusObservation } from '@/lib/celestial-event-corpus/compiler'
import { resolveNatalProfile } from '@/lib/celestial-event-corpus/natal-profile'
import { corpusError, corpusJson } from '@/lib/celestial-event-corpus/route-support'
import { DuplicateCorpusObservation, appendCorpusObservations, getCorpus, listCorpusObservations } from '@/lib/celestial-event-corpus/store'
import { CorpusValidationError, type CorpusObservationSubmission } from '@/lib/celestial-event-corpus/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ corpusId: string }> }) {
  const gate = openGate(request, { write: false })
  if (!gate.ok) return gate.response
  const { corpusId } = await params
  try {
    const corpus = await getCorpus(gate.client, corpusId)
    if (!corpus) return corpusError('corpus_not_found', 'No corpus matches this id.', 404)
    const observations = await listCorpusObservations(gate.client, corpusId)
    return corpusJson({ corpus, observations, exposureSummary: summarizeCorpusExposure(observations) }, 200)
  } catch (error) {
    return corpusError('corpus_read_failed', error instanceof Error ? error.message : 'The corpus could not be read.', 502)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ corpusId: string }> }) {
  const gate = openGate(request, { write: true })
  if (!gate.ok) return gate.response
  const { corpusId } = await params
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  try {
    const corpus = await getCorpus(gate.client, corpusId)
    if (!corpus) return corpusError('corpus_not_found', 'No corpus matches this id.', 404)
    if (corpus.status !== 'locked') return corpusError('corpus_not_locked', 'Lock the sampling definition before appending observations.', 409)
    const payload = body.value as { natalProfile?: unknown; observations?: unknown }
    const natal = resolveNatalProfile(payload.natalProfile)
    if (natal.profileSha256 !== corpus.definition.natalProfileSha256) return corpusError('natal_profile_digest_mismatch', 'The supplied natal profile does not match this corpus.', 422)
    if (!Array.isArray(payload.observations) || payload.observations.length < 1 || payload.observations.length > 100) {
      return corpusError('invalid_observation_batch', 'Submit 1–100 observations.', 422)
    }
    const records = payload.observations.map((submission) => compileCorpusObservation({
      definition: corpus.definition,
      definitionSha256: corpus.definitionSha256,
      submission: submission as CorpusObservationSubmission,
      natalChart: natal.natalChart,
      birthInstant: natal.birthInstant,
      latitudeDegrees: natal.profile.latitudeDegrees,
      longitudeDegrees: natal.profile.longitudeDegrees,
    }))
    await appendCorpusObservations(gate.client, records)
    const observations = await listCorpusObservations(gate.client, corpusId)
    return corpusJson({ appended: records.length, observationSha256: records.map((record) => record.observationSha256), exposureSummary: summarizeCorpusExposure(observations) }, 201)
  } catch (error) {
    if (error instanceof DuplicateCorpusObservation) return corpusError('duplicate_observation', error.message, 409)
    if (error instanceof CorpusValidationError) return corpusError('invalid_observation', 'One or more observations are invalid.', 422, error.issues)
    return corpusError('observation_write_failed', error instanceof Error ? error.message : 'Observations could not be appended.', 502)
  }
}

export function OPTIONS() { return optionsResponse('GET, POST, OPTIONS') }
