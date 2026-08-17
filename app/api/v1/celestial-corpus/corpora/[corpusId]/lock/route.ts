import { openGate, optionsResponse } from '@/lib/celestial-hypotheses/route-support'
import { corpusError, corpusJson } from '@/lib/celestial-event-corpus/route-support'
import { getCorpus, lockCorpus } from '@/lib/celestial-event-corpus/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ corpusId: string }> }) {
  const gate = openGate(request, { write: true })
  if (!gate.ok) return gate.response
  const { corpusId } = await params
  try {
    const existing = await getCorpus(gate.client, corpusId)
    if (!existing) return corpusError('corpus_not_found', 'No corpus matches this id.', 404)
    if (existing.status === 'locked') return corpusJson({ corpus: existing }, 200)
    const corpus = await lockCorpus(gate.client, corpusId, existing.definitionSha256, new Date())
    return corpusJson({ corpus }, 200)
  } catch (error) {
    return corpusError('corpus_lock_failed', error instanceof Error ? error.message : 'The corpus could not be locked.', 502)
  }
}

export function OPTIONS() { return optionsResponse('POST, OPTIONS') }
