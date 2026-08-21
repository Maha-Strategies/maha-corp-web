import {
  GATEWAY_COMPILED_HEADER,
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_INTERCEPTOR_TOKEN_HEADER,
  compileGatewayContext,
  gatewayLimitsFrom,
  gatewaySecretFrom,
} from '@/lib/integrations/gateway-context-contract'

/**
 * The gateway-neutral compile endpoint.
 *
 * Kong, Apigee and Cloudflare adapters call this before forwarding to the
 * model provider; WSO2 keeps its own Interceptor Service routes because its
 * policy dictates the envelope. All four share the decision underneath.
 *
 * The response carries the rewritten body and the evidence headers, and
 * nothing else. Source text, credentials and prompt contents are never logged,
 * echoed into a header, or returned in an error.
 */
export const dynamic = 'force-dynamic'

const json = (body: unknown, status: number, headers: Record<string, string> = {}): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } })

export async function POST(request: Request): Promise<Response> {
  const limits = gatewayLimitsFrom()

  // Read as text first: the payload cap has to be applied to the bytes that
  // arrived, not to whatever a parser managed to make of them.
  let raw: string
  try {
    raw = await request.text()
  } catch {
    return json({ error: { code: 'invalid_envelope', message: 'The request body could not be read.' } }, 400)
  }

  const bodyBytes = Buffer.byteLength(raw, 'utf8')
  if (bodyBytes > limits.maxBodyBytes) {
    return json({ error: { code: 'payload_too_large', message: `Request body exceeds ${limits.maxBodyBytes} bytes.` } }, 413)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json({ error: { code: 'invalid_envelope', message: 'The request body must be JSON.' } }, 400)
  }

  const result = compileGatewayContext({
    body: parsed,
    bodyBytes,
    suppliedSecret: request.headers.get(GATEWAY_INTERCEPTOR_TOKEN_HEADER),
    configuredSecret: gatewaySecretFrom(),
    contentType: request.headers.get('content-type'),
    alreadyCompiled: request.headers.get(GATEWAY_COMPILED_HEADER) === 'true',
    limits,
  })

  if (result.outcome === 'rejected') {
    return json({ error: { code: result.code, message: result.message } }, result.status)
  }
  if (result.outcome === 'passthrough') {
    // The caller forwards its original body unchanged. Saying which rule
    // applied lets an operator tell "not opted in" from "already compiled"
    // without guessing from a status code.
    return json({ outcome: 'passthrough', reason: result.reason, contractVersion: GATEWAY_CONTRACT_VERSION }, 200)
  }

  return json(
    { outcome: 'compiled', body: result.body, contractVersion: GATEWAY_CONTRACT_VERSION },
    200,
    result.headers,
  )
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'cache-control': 'no-store' } })
}
