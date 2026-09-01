import { createHmac } from 'node:crypto'

/**
 * Pure helpers for the ephemeral Batch 11 application/database binding.
 *
 * This module performs no network or filesystem effects. It accepts the
 * branch JWT secret only long enough to derive a one-hour service-role token;
 * callers must keep both values in process memory and out of artifacts.
 */

export const BATCH_11_PREVIEW_BINDING_VERSION = 'maha-batch-11-preview-binding/1.0' as const

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

export function deriveEphemeralServiceRole(jwtSecret: string, issuedAtSeconds: number): string {
  if (jwtSecret.length < 16) throw new Error('The ephemeral branch JWT secret is missing or implausibly short.')
  if (!Number.isSafeInteger(issuedAtSeconds) || issuedAtSeconds <= 0) throw new Error('The JWT issue time is invalid.')
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    role: 'service_role',
    iss: 'supabase',
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + 3600,
  })}`
  return `${unsigned}.${createHmac('sha256', jwtSecret).update(unsigned, 'utf8').digest('base64url')}`
}

export interface ParsedPreviewDeployment {
  id: string
  origin: string
}

function deploymentFrom(value: unknown): ParsedPreviewDeployment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = String(row.id ?? row.deploymentId ?? '')
  const rawUrl = String(row.url ?? '')
  if (!id || !rawUrl) return null
  const origin = rawUrl.startsWith('https://')
    ? rawUrl.replace(/\/$/, '')
    : `https://${rawUrl.replace(/\/$/, '')}`
  if (!origin.endsWith('.vercel.app') || origin.includes('mahastrategies.com')) return null
  return { id, origin }
}

export function parseVercelDeploymentOutput(output: string): ParsedPreviewDeployment {
  const candidates = [output.trim(), ...output.split('\n').map((line) => line.trim()).filter(Boolean).reverse()]
  for (const candidate of candidates) {
    try {
      const parsed = deploymentFrom(JSON.parse(candidate))
      if (parsed) return parsed
    } catch {
      // Vercel may print progress lines around the final JSON object.
    }
  }
  throw new Error('Vercel did not return a deployment id and isolated Preview origin.')
}

export function assertPrivatePreviewResponses(input: {
  unauthenticatedStatus: number
  unauthenticatedLocation: string | null
  authorizedStatus: number
}): void {
  const protectedResponse = [401, 403].includes(input.unauthenticatedStatus)
    || /vercel/i.test(input.unauthenticatedLocation ?? '')
  if (!protectedResponse) {
    throw new Error(`The isolated Preview did not enforce deployment protection (HTTP ${input.unauthenticatedStatus}).`)
  }
  if (input.authorizedStatus < 200 || input.authorizedStatus >= 300) {
    throw new Error(`The isolated Preview did not accept its protected bypass (HTTP ${input.authorizedStatus}).`)
  }
}

export function vercelDeploymentArguments(reviewedCommit: string): readonly string[] {
  if (!/^[0-9a-f]{40}$/.test(reviewedCommit)) throw new Error('The reviewed commit is not an exact Git SHA.')
  return [
    // `--skip-domain` is production-only in the pinned Vercel CLI. Preview
    // deployments are never promoted to a production domain, so adding that
    // flag makes the CLI refuse before it creates the isolated deployment.
    'deploy', '.', '--yes', '--force', '--target', 'preview',
    '--project', 'maha-corp-web', '--scope', 'mayonerajans-projects', '--json',
    '--env', 'NEXT_PUBLIC_SUPABASE_URL', '--build-env', 'NEXT_PUBLIC_SUPABASE_URL',
    '--env', 'SUPABASE_SERVICE_ROLE_KEY', '--env', 'EPISTEMIC_OPERATIONS_TOKEN',
    '--env', 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN', '--env', 'VERCEL_AUTOMATION_BYPASS_SECRET',
    '--meta', `batch11ReviewedCommit=${reviewedCommit}`,
  ]
}
