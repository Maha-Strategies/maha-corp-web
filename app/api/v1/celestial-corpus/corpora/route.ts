import { openGate, optionsResponse, readJsonBody } from '@/lib/celestial-hypotheses/route-support'
import { resolveNatalProfile } from '@/lib/celestial-event-corpus/natal-profile'
import { corpusError, corpusJson } from '@/lib/celestial-event-corpus/route-support'
import { getCorpus, insertCorpusDraft, updateCorpusDraft } from '@/lib/celestial-event-corpus/store'
import { CorpusValidationError, parseCorpusDefinition } from '@/lib/celestial-event-corpus/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Creates or updates a private draft. Precise natal inputs are verified in memory and never stored. */
export async function POST(request: Request) {
  const gate = openGate(request, { write: true })
  if (!gate.ok) return gate.response
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  try {
    const payload = body.value as { definition?: unknown; natalProfile?: unknown }
    const natal = resolveNatalProfile(payload.natalProfile)
    const submitted = payload.definition as Record<string, unknown> | null
    if (!submitted || typeof submitted !== 'object') throw new CorpusValidationError(['Corpus definition must be an object.'])
    if (typeof submitted.natalProfileSha256 === 'string' && submitted.natalProfileSha256 && submitted.natalProfileSha256 !== natal.profileSha256) {
      return corpusError('natal_profile_digest_mismatch', 'The supplied natal profile does not match the corpus definition digest.', 422)
    }
    const definition = parseCorpusDefinition({ ...submitted, natalProfileSha256: natal.profileSha256 })
    const existing = await getCorpus(gate.client, definition.corpusId)
    if (existing?.status === 'locked') return corpusError('corpus_locked', 'The corpus definition is locked and cannot be edited.', 409)
    const stored = existing ? await updateCorpusDraft(gate.client, definition) : await insertCorpusDraft(gate.client, definition)
    return corpusJson({ corpus: stored }, existing ? 200 : 201)
  } catch (error) {
    if (error instanceof CorpusValidationError) return corpusError('invalid_corpus', 'The corpus definition is invalid.', 422, error.issues)
    return corpusError('corpus_write_failed', error instanceof Error ? error.message : 'The corpus could not be stored.', 502)
  }
}

export function OPTIONS() { return optionsResponse('POST, OPTIONS') }
