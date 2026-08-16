/**
 * Shared plumbing for the registry route handlers.
 *
 * Kept in one place so the authorization, configuration, and rate-limit gates
 * cannot drift apart between endpoints — an endpoint that forgot one of them
 * would be the whole vulnerability.
 */

import { authorizeRegistry, consumeRegistryWriteBudget } from './authorization.ts'
import { createHypothesisRegistryClient, type RegistryClient } from './store.ts'
import { REGISTRY_EPISTEMIC_BOUNDARY } from './types.ts'

const MAX_BODY_BYTES = 65_536

export function registryJson(body: Record<string, unknown>, status: number): Response {
  return Response.json(
    // Every response from this surface carries the boundary, so a client that
    // renders a result cannot render it without the caveat being available.
    { ...body, epistemicBoundary: REGISTRY_EPISTEMIC_BOUNDARY },
    { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } },
  )
}

export function registryError(code: string, message: string, status: number, issues?: string[]): Response {
  return registryJson({ error: { code, message, ...(issues ? { issues } : {}) } }, status)
}

export type Gate =
  | { ok: true; client: RegistryClient }
  | { ok: false; response: Response }

/** Authorization, configuration, and (for writes) the rate ceiling. */
export function openGate(request: Request, options: { write: boolean }): Gate {
  const authorization = authorizeRegistry(request)
  if (authorization.kind === 'unconfigured') {
    return { ok: false, response: registryError('registry_unavailable', 'Registry authorization is not configured.', 503) }
  }
  if (authorization.kind === 'unauthorized') {
    return { ok: false, response: registryError('unauthorized', 'A valid registry bearer token is required.', 401) }
  }
  if (options.write && !consumeRegistryWriteBudget()) {
    return { ok: false, response: registryError('rate_limited', 'Too many registry writes in this window.', 429) }
  }

  const client = createHypothesisRegistryClient()
  if (!client) {
    // Fail closed: a registry that accepts a registration it cannot persist is
    // worse than one that is briefly unavailable.
    return { ok: false, response: registryError('registry_unavailable', 'Registry persistence is not configured.', 503) }
  }
  return { ok: true, client }
}

export async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, response: registryError('payload_too_large', `Request bodies are limited to ${MAX_BODY_BYTES} bytes.`, 413) }
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown }
  } catch {
    return { ok: false, response: registryError('invalid_json', 'The request body is not valid JSON.', 400) }
  }
}

export function optionsResponse(allow: string): Response {
  return new Response(null, { status: 204, headers: { Allow: allow, 'Cache-Control': 'no-store' } })
}
