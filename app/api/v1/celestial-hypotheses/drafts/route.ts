import { parseExperimentDraft, validateDraft } from '@/lib/celestial-hypotheses/registration'
import { openGate, optionsResponse, readJsonBody, registryError, registryJson } from '@/lib/celestial-hypotheses/route-support'
import { getExperiment, insertDraft, updateDraft } from '@/lib/celestial-hypotheses/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Create or amend a draft.
 *
 * A draft is the only editable state, so re-posting the same experimentId
 * amends it. Once the experiment is registered the database trigger refuses the
 * update and this returns 409 — the edit is rejected at the storage layer, not
 * merely discouraged here.
 *
 * The draft is validated but a failing draft is still stored: the point of a
 * draft is to be worked on. Validation issues are returned so the author can
 * see what would block registration.
 */
export async function POST(request: Request) {
  const gate = openGate(request, { write: true })
  if (!gate.ok) return gate.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const payload = body.value as { draft?: unknown; notes?: unknown }
  const parsed = parseExperimentDraft(payload?.draft)
  if (!parsed.ok) return registryError('invalid_request', 'The draft is structurally invalid.', 400, parsed.issues)
  const draft = parsed.draft

  const notes = typeof payload.notes === 'string' ? payload.notes.slice(0, 4_000) : null
  const issues = validateDraft(draft)

  try {
    const existing = await getExperiment(gate.client, draft.experimentId)
    if (existing && existing.status !== 'draft') {
      return registryError('experiment_locked', 'This experiment is registered and can no longer be edited.', 409)
    }
    const stored = existing
      ? await updateDraft(gate.client, draft, notes)
      : await insertDraft(gate.client, draft, notes)

    return registryJson({
      experimentId: stored.experimentId,
      status: stored.status,
      registrationBlockers: issues,
      registrable: issues.length === 0,
    }, existing ? 200 : 201)
  } catch (error) {
    return registryError('draft_write_failed', error instanceof Error ? error.message : 'The draft could not be stored.', 502)
  }
}

export function OPTIONS() {
  return optionsResponse('POST, OPTIONS')
}
