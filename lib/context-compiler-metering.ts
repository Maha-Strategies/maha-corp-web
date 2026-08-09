import { createAgentInquiryLedger } from './agent-inquiry-ledger.ts'

// Records that a Context Compiler call happened, and nothing about what was in
// it. The endpoint answers sourceTextStored:false and that remains true: this
// sees a status code, an access mode, a credential identifier when one exists,
// and the compiler's own token estimates.

export type AccessMode = 'api_key' | 'x402' | 'anonymous'

/**
 * The metered path. The usage table is specific to the Context Compiler, so
 * the proxy must not fold challenges for other priced resources into it.
 */
export const METERED_PATH = '/api/v1/compress'

/**
 * Outcomes that terminate inside proxy.ts and therefore never reach the route
 * handler's metering wrapper.
 *
 * This was the gap: an unpaid probe is answered with a 402 challenge by the
 * proxy and returns from there, so the route never runs and nothing recorded
 * it. Challenges are the denominator of the only question the funnel exists to
 * answer -- did agents find this and decline, or never find it -- and without
 * them the two are indistinguishable.
 *
 * Paid admissions are deliberately excluded: those do reach the route, and
 * metering them here as well would double-count every settlement.
 */
export function metersAtProxy(pathname: string, kind: string): boolean {
  return pathname === METERED_PATH && (kind === 'challenge' || kind === 'refused')
}

/** Access mode from the headers proxy.ts injects, without trusting the caller. */
export function accessModeFrom(headers: Headers): { mode: AccessMode; credentialId: string } {
  if (headers.get('x-maha-access-mode') === 'x402') return { mode: 'x402', credentialId: '' }
  const keyId = headers.get('x-maha-api-key-id')
  return keyId ? { mode: 'api_key', credentialId: keyId } : { mode: 'anonymous', credentialId: '' }
}

export const statusClassOf = (status: number): '2xx' | '4xx' | '5xx' =>
  status >= 500 ? '5xx' : status >= 400 ? '4xx' : '2xx'

/**
 * Never throws and never delays the response.
 *
 * Metering is not worth a failed request: this runs after the response body
 * exists, and a broken meter degrades a dashboard rather than the product.
 */
export async function recordContextCompilerUsage(input: {
  mode: AccessMode
  credentialId: string
  status: number
  inputTokens?: number
  outputTokens?: number
  ledger?: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> } | null
}): Promise<void> {
  try {
    const ledger = input.ledger !== undefined ? input.ledger : createAgentInquiryLedger()
    if (!ledger) return
    const { error } = await ledger.rpc('record_context_compiler_usage', {
      p_access_mode: input.mode,
      p_credential_id: input.credentialId,
      p_status_class: statusClassOf(input.status),
      p_input_tokens: Math.max(0, Math.round(input.inputTokens ?? 0)),
      p_output_tokens: Math.max(0, Math.round(input.outputTokens ?? 0)),
    })
    if (error) console.error('context compiler usage meter failed')
  } catch {
    // Deliberately silent beyond the log above: a metering outage must not
    // surface to a paying caller.
  }
}
