import type { SupabaseClient } from '@supabase/supabase-js'

import { createHypothesisRegistryClient } from '../celestial-hypotheses/store.ts'
import { CELESTIAL_ENTERPRISE_API_VERSION, CELESTIAL_REPRODUCIBILITY_POLICY_VERSION } from './contracts.ts'
import { authorizeCelestialPrincipal, type CelestialPermission, type CelestialPrincipal } from './security.ts'

export const MAX_CELESTIAL_BODY_BYTES = 262_144
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Maha-Celestial-API-Version': CELESTIAL_ENTERPRISE_API_VERSION,
  'X-Maha-Reproducibility-Policy': CELESTIAL_REPRODUCIBILITY_POLICY_VERSION,
}

export function celestialJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...RESPONSE_HEADERS, ...headers } })
}

export function celestialError(code: string, message: string, status: number, issues?: string[]): Response {
  return celestialJson({ apiVersion: CELESTIAL_ENTERPRISE_API_VERSION, error: { code, message, ...(issues ? { issues } : {}) } }, status)
}

export async function readCelestialBody(request: Request): Promise<{ ok: true; value: unknown; bytes: number } | { ok: false; response: Response }> {
  const raw = await request.text()
  const bytes = new TextEncoder().encode(raw).byteLength
  if (bytes > MAX_CELESTIAL_BODY_BYTES) return { ok: false, response: celestialError('payload_too_large', `Request bodies are limited to ${MAX_CELESTIAL_BODY_BYTES} bytes.`, 413) }
  try { return { ok: true, value: JSON.parse(raw) as unknown, bytes } }
  catch { return { ok: false, response: celestialError('invalid_json', 'The request body is not valid JSON.', 400) } }
}

export type EnterpriseGate = { ok: true; client: SupabaseClient; principal: CelestialPrincipal } | { ok: false; response: Response }

export async function openEnterpriseGate(request: Request, permission: CelestialPermission): Promise<EnterpriseGate> {
  const client = createHypothesisRegistryClient()
  if (!client) return { ok: false, response: celestialError('service_unavailable', 'Enterprise celestial persistence is not configured.', 503) }
  const principal = await authorizeCelestialPrincipal(request, client, permission)
  if (!principal) return { ok: false, response: celestialError('forbidden', 'The authenticated organization member lacks this permission.', 403) }
  return { ok: true, client, principal }
}

export function validReportId(value: string): boolean { return /^celrep_[a-f0-9]{24}$/.test(value) }
