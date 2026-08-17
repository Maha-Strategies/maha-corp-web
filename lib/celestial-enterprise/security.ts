import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

export const CELESTIAL_ROLES = ['owner', 'admin', 'developer', 'reviewer', 'auditor', 'billing'] as const
export type CelestialRole = typeof CELESTIAL_ROLES[number]
export type CelestialPermission = 'reports:create' | 'reports:read' | 'reports:delete' | 'reports:export' | 'batches:create' | 'packs:install' | 'packs:review' | 'webhooks:manage' | 'usage:read' | 'billing:manage' | 'incidents:read'

const ROLE_PERMISSIONS: Record<CelestialRole, CelestialPermission[]> = {
  owner: ['reports:create', 'reports:read', 'reports:delete', 'reports:export', 'batches:create', 'packs:install', 'packs:review', 'webhooks:manage', 'usage:read', 'billing:manage', 'incidents:read'],
  admin: ['reports:create', 'reports:read', 'reports:delete', 'reports:export', 'batches:create', 'packs:install', 'webhooks:manage', 'usage:read', 'incidents:read'],
  developer: ['reports:create', 'reports:read', 'reports:export', 'batches:create', 'usage:read'],
  reviewer: ['reports:read', 'reports:export', 'packs:review', 'incidents:read'],
  auditor: ['reports:read', 'reports:export', 'usage:read', 'incidents:read'],
  billing: ['usage:read', 'billing:manage', 'incidents:read'],
}

export function roleAllows(role: CelestialRole, permission: CelestialPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export type CelestialPrincipal = { tenantId: string; keyId: string; memberId: string; role: CelestialRole; permissions: CelestialPermission[] }

export async function authorizeCelestialPrincipal(request: Request, client: SupabaseClient, permission: CelestialPermission): Promise<CelestialPrincipal | null> {
  const tenantId = request.headers.get('x-maha-tenant-id') ?? ''
  const keyId = request.headers.get('x-maha-api-key-id') ?? ''
  if (!/^tenant_[a-z0-9_-]{8,120}$/.test(tenantId) || !/^key_[a-z0-9]{16,64}$/.test(keyId)) return null
  const { data, error } = await client.from('celestial_organization_members').select('member_id, role, status').eq('organization_id', tenantId).eq('api_key_id', keyId).maybeSingle()
  if (error || !data || data.status !== 'active' || !CELESTIAL_ROLES.includes(data.role as CelestialRole)) return null
  const role = data.role as CelestialRole
  const permissions = ROLE_PERMISSIONS[role]
  return roleAllows(role, permission) ? { tenantId, keyId, memberId: String(data.member_id), role, permissions } : null
}

function encryptionKey(): Buffer {
  const value = process.env.CELESTIAL_REPORT_ENCRYPTION_KEY ?? ''
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Celestial report encryption is not configured.')
  return Buffer.from(value, 'hex')
}

export function encryptReportPayload(tenantId: string, reportId: string, payload: unknown): { ciphertext: string; keyVersion: 'celestial-report-key/1' } {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(`${tenantId}:${reportId}:maha-celestial-api/1`))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return { ciphertext: `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`, keyVersion: 'celestial-report-key/1' }
}

export function decryptReportPayload<T>(tenantId: string, reportId: string, ciphertext: string): T {
  const [ivValue, tagValue, encryptedValue] = ciphertext.split('.')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Encrypted report payload is malformed.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAAD(Buffer.from(`${tenantId}:${reportId}:maha-celestial-api/1`))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8')) as T
}

export function webhookSignature(secret: string, timestamp: string, body: string): string {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

export function encryptWebhookSecret(tenantId: string, endpointId: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(`${tenantId}:${endpointId}:celestial-webhook/1`))
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptWebhookSecret(tenantId: string, endpointId: string, ciphertext: string): string {
  const [ivValue, tagValue, encryptedValue] = ciphertext.split('.')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Encrypted webhook secret is malformed.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAAD(Buffer.from(`${tenantId}:${endpointId}:celestial-webhook/1`))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8')
}
