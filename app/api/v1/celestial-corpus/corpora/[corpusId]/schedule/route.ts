import { openGate, optionsResponse } from '@/lib/celestial-hypotheses/route-support'
import { corpusError, corpusJson } from '@/lib/celestial-event-corpus/route-support'
import { generateSystematicSchedule } from '@/lib/celestial-event-corpus/sampling'
import { getCorpus } from '@/lib/celestial-event-corpus/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ corpusId: string }> }) {
  const gate = openGate(request, { write: false })
  if (!gate.ok) return gate.response
  const { corpusId } = await params
  try {
    const corpus = await getCorpus(gate.client, corpusId)
    if (!corpus) return corpusError('corpus_not_found', 'No corpus matches this id.', 404)
    return corpusJson({ corpusId, status: corpus.status, definitionSha256: corpus.definitionSha256, candidates: generateSystematicSchedule(corpus.definition.samplingPlan) }, 200)
  } catch (error) {
    return corpusError('schedule_failed', error instanceof Error ? error.message : 'The schedule could not be generated.', 502)
  }
}

export function OPTIONS() { return optionsResponse('GET, OPTIONS') }
