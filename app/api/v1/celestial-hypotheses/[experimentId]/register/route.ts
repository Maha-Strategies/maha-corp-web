import { RegistrationRejected, registerExperiment } from '@/lib/celestial-hypotheses/registration'
import { openGate, optionsResponse, registryError, registryJson } from '@/lib/celestial-hypotheses/route-support'
import { getExperiment, lockRegistration } from '@/lib/celestial-hypotheses/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Take the lock.
 *
 * Everything the analysis could turn on is hashed here and the digest is stored
 * with an explicit UTC timestamp. After this returns 200 the experiment cannot
 * be edited by any supported path.
 *
 * The request body carries nothing: registering what was submitted in the same
 * call would let a caller lock a payload different from the draft that was
 * reviewed, which defeats the point of a separate review step.
 */
export async function POST(request: Request, { params }: { params: Promise<{ experimentId: string }> }) {
  const gate = openGate(request, { write: true })
  if (!gate.ok) return gate.response

  const { experimentId } = await params

  try {
    const existing = await getExperiment(gate.client, experimentId)
    if (!existing) return registryError('experiment_not_found', 'No experiment matches this id.', 404)
    if (existing.status !== 'draft') {
      return registryError('already_registered', 'This experiment is already registered; registration is not repeatable.', 409)
    }

    const registration = registerExperiment(existing.draft)
    const stored = await lockRegistration(gate.client, registration)

    return registryJson({
      experimentId: stored.experimentId,
      status: stored.status,
      registrationSha256: stored.registrationSha256,
      registeredAtUtc: stored.registeredAtUtc,
    }, 200)
  } catch (error) {
    if (error instanceof RegistrationRejected) {
      return registryError('registration_rejected', 'The draft cannot be registered.', 422, error.issues)
    }
    return registryError('registration_failed', error instanceof Error ? error.message : 'Registration could not be completed.', 502)
  }
}

export function OPTIONS() {
  return optionsResponse('POST, OPTIONS')
}
