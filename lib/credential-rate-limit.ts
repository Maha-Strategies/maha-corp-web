export type CredentialRateLimitDecision =
  | { kind: 'accepted' }
  | { kind: 'rate_limited' }
  | { kind: 'unavailable'; errorCode: string }

type RateLimitRpcResult = {
  data: unknown
  error: { code?: string } | null
}

type RateLimitRpc = (parameters: {
  p_credential_id: string
  p_limit: number
}) => PromiseLike<RateLimitRpcResult>

/** Calls the shared, atomic rate limiter used by every serverless instance. */
export async function consumeCredentialRateLimit(
  credentialId: string,
  limit: number,
  rpc: RateLimitRpc,
): Promise<CredentialRateLimitDecision> {
  let result: RateLimitRpcResult
  try {
    result = await rpc({ p_credential_id: credentialId, p_limit: limit })
  } catch {
    return { kind: 'unavailable', errorCode: 'rate_limit_request_failed' }
  }
  if (result.error) return { kind: 'unavailable', errorCode: result.error.code ?? 'rate_limit_unavailable' }
  if (result.data === true) return { kind: 'accepted' }
  if (result.data === false) return { kind: 'rate_limited' }
  return { kind: 'unavailable', errorCode: 'invalid_rate_limit_response' }
}
