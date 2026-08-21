/**
 * Maha Context Compiler — Cloudflare Worker middleware.
 *
 * Sits between a client and a model provider. Compiles the context, forwards
 * the rewritten request, and returns the provider's response with the evidence
 * headers attached.
 *
 * Fails closed on every error path. Never logs a request body, a prompt, a
 * source document, or a secret -- the only thing this Worker is allowed to say
 * about a request is its outcome.
 */
export interface Env {
  /** Shared secret. Set with `wrangler secret put`, never in wrangler.toml. */
  MAHA_CONTEXT_INTERCEPTOR_SECRET: string
  /** Maha compiler endpoint. */
  MAHA_COMPILER_URL: string
  /** Model provider the rewritten request is forwarded to. */
  MAHA_PROVIDER_URL: string
  MAHA_GATEWAY_TIMEOUT_MS?: string
  MAHA_GATEWAY_MAX_BODY_BYTES?: string
}

const EVIDENCE_HEADERS = [
  'x-maha-compiled',
  'x-maha-input-hash',
  'x-maha-output-hash',
  'x-maha-token-budget',
  'x-maha-retained-passages',
  'x-maha-source-coverage-bps',
  'x-maha-policy-version',
] as const

const DEFAULT_TIMEOUT_MS = 3_000
const DEFAULT_MAX_BODY_BYTES = 512_000

function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } })
}

const positiveInteger = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Only POST is supported.')
    if (!env.MAHA_CONTEXT_INTERCEPTOR_SECRET || env.MAHA_CONTEXT_INTERCEPTOR_SECRET.length < 32) {
      return fail(503, 'interceptor_not_configured', 'The Maha context interceptor is not configured.')
    }

    const timeoutMs = positiveInteger(env.MAHA_GATEWAY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
    const maxBodyBytes = positiveInteger(env.MAHA_GATEWAY_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES)

    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) {
      return fail(413, 'payload_too_large', `Request body exceeds ${maxBodyBytes} bytes.`)
    }

    // Idempotence: a body already compiled upstream is forwarded as-is.
    if (request.headers.get('x-maha-compiled') === 'true') {
      return forward(raw, request, env, {})
    }

    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return fail(400, 'invalid_envelope', 'The request body must be JSON.') }
    const body = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
    if (!body) return fail(400, 'invalid_envelope', 'The request body must be a JSON object.')
    // Not opted in: forward untouched, so the Worker is safe on a shared route.
    if (body.maha_context === undefined) return forward(raw, request, env, {})

    let compiled: Response
    try {
      compiled = await fetch(env.MAHA_COMPILER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-maha-interceptor-token': env.MAHA_CONTEXT_INTERCEPTOR_SECRET,
        },
        body: raw,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      // Timeout or transport failure. Refusing costs a request; forwarding an
      // uncompiled prompt costs a provider call and reports success.
      return fail(503, 'compiler_unavailable', 'The context compiler is unavailable.')
    }

    if (!compiled.ok) {
      const detail = await compiled.json<{ error?: { code?: string } }>().catch(() => null)
      return fail(compiled.status, detail?.error?.code ?? 'context_compilation_rejected', 'The context compiler refused the request.')
    }

    const result = await compiled.json<{ outcome?: string; body?: Record<string, unknown> }>().catch(() => null)
    if (result?.outcome === 'passthrough') return forward(raw, request, env, {})
    if (result?.outcome !== 'compiled' || !result.body) {
      return fail(502, 'invalid_compiler_output', 'The compiler returned an unusable result.')
    }

    const evidence: Record<string, string> = {}
    for (const name of EVIDENCE_HEADERS) {
      const value = compiled.headers.get(name)
      if (value) evidence[name] = value
    }
    return forward(JSON.stringify(result.body), request, env, evidence)
  },
}

/**
 * Forward to the provider and return its response with evidence attached.
 * The caller's authorization header is passed through unchanged; the
 * interceptor secret is never forwarded.
 */
async function forward(
  body: string,
  original: Request,
  env: Env,
  evidence: Record<string, string>,
): Promise<Response> {
  const headers = new Headers()
  for (const name of ['authorization', 'content-type', 'accept', 'x-api-key', 'anthropic-version']) {
    const value = original.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (Object.keys(evidence).length > 0) headers.set('x-maha-compiled', 'true')

  const upstream = await fetch(env.MAHA_PROVIDER_URL, { method: 'POST', headers, body })
  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })
  for (const [name, value] of Object.entries(evidence)) response.headers.set(name, value)
  return response
}
