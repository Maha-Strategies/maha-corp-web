import { createHash } from 'node:crypto'

import { validExperimentId, validSourcePath } from './conversion-measurement'

type LedgerResponse = { error?: { code?: string } | null }
type Ledger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<LedgerResponse> }

export type CheckoutAttribution = {
  checkoutReference: string
  offerId: string
  experimentId: string | null
  sourcePath: string
  occurredAt: string
}

function hash(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function parseCheckoutAttribution(value: Record<string, unknown>): Pick<CheckoutAttribution, 'experimentId' | 'sourcePath'> {
  const experimentId = value.experimentId === undefined || value.experimentId === null ? null : value.experimentId
  if (experimentId !== null && !validExperimentId(experimentId)) throw new Error('experimentId is invalid.')
  const sourcePath = value.sourcePath === undefined || value.sourcePath === null ? null : value.sourcePath
  if (sourcePath !== null && !validSourcePath(sourcePath)) throw new Error('sourcePath is invalid.')
  return { experimentId, sourcePath: sourcePath ?? '/' }
}

export async function recordCheckoutAttribution(ledger: Ledger, input: CheckoutAttribution) {
  return ledger.rpc('record_checkout_conversion_attribution', {
    p_checkout_reference: input.checkoutReference,
    p_offer_id: input.offerId,
    p_experiment_id: input.experimentId,
    p_source_path: input.sourcePath,
    p_event_hash: hash(`checkout_started|${input.checkoutReference}`),
    p_at: input.occurredAt,
  })
}

export async function recordVerifiedCheckoutConversion(ledger: Ledger, input: Pick<CheckoutAttribution, 'checkoutReference' | 'offerId' | 'occurredAt'>) {
  return ledger.rpc('record_verified_checkout_conversion', {
    p_checkout_reference: input.checkoutReference,
    p_offer_id: input.offerId,
    p_event_hash: hash(`paid_conversion|${input.checkoutReference}`),
    p_at: input.occurredAt,
  })
}

export function publicEventHash(eventId: string) {
  return hash(`client_conversion|${eventId}`)
}
