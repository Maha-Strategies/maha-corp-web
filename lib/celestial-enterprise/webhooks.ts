import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import { digestOf } from '../celestial-hypotheses/canonical.ts'
import { assertPublicUpstreamHost, parsePublicUpstreamUrl } from '../mcp-gateway.ts'
import { decryptWebhookSecret, encryptWebhookSecret, webhookSignature, type CelestialPrincipal } from './security.ts'

export const CELESTIAL_WEBHOOK_EVENTS = ['report.completed', 'batch.completed', 'batch.partially-failed'] as const
export type CelestialWebhookEvent = typeof CELESTIAL_WEBHOOK_EVENTS[number]

export async function registerWebhook(client: SupabaseClient, principal: CelestialPrincipal, value: unknown) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const targetUrl = parsePublicUpstreamUrl(input.targetUrl)
  await assertPublicUpstreamHost(targetUrl)
  if (!Array.isArray(input.eventTypes) || input.eventTypes.length < 1) throw new Error('eventTypes must contain at least one supported event.')
  const eventTypes = input.eventTypes.map(String)
  if (eventTypes.some((event) => !(CELESTIAL_WEBHOOK_EVENTS as readonly string[]).includes(event)) || new Set(eventTypes).size !== eventTypes.length) throw new Error('eventTypes contains an unsupported or duplicate event.')
  const secret = `celwhsec_${randomBytes(24).toString('base64url')}`
  const endpointId = `celwh_${digestOf({ tenantId: principal.tenantId, targetUrl, entropy: randomBytes(16).toString('hex') }).slice(7, 31)}`
  const { error } = await client.from('celestial_webhook_endpoints').insert({
    endpoint_id: endpointId, organization_id: principal.tenantId, target_url: targetUrl,
    encrypted_signing_secret: encryptWebhookSecret(principal.tenantId, endpointId, secret), event_types: eventTypes,
    created_by_member_id: principal.memberId,
  })
  if (error) throw new Error(`Webhook registration failed: ${error.message}`)
  return { endpointId, targetUrl, eventTypes, status: 'active' as const, signingSecret: secret, disclosure: 'The signing secret is returned once. Store it securely.' }
}

export async function enqueueWebhookEvent(client: SupabaseClient, organizationId: string, eventType: CelestialWebhookEvent, data: Record<string, unknown>) {
  const { data: endpoints, error } = await client.from('celestial_webhook_endpoints').select('endpoint_id').eq('organization_id', organizationId).eq('status', 'active').contains('event_types', [eventType])
  if (error) throw new Error(`Webhook lookup failed: ${error.message}`)
  const payload = { eventVersion: 'celestial-webhook-event/1', eventType, occurredAtUtc: new Date().toISOString(), organizationId, data }
  const eventSha256 = digestOf(payload)
  if (!endpoints?.length) return 0
  const rows = endpoints.map(({ endpoint_id }) => ({ delivery_id: `celdel_${digestOf({ endpoint_id, eventSha256 }).slice(7, 31)}`, endpoint_id, organization_id: organizationId, event_type: eventType, event_sha256: eventSha256, payload }))
  const { error: insertError } = await client.from('celestial_webhook_deliveries').upsert(rows, { onConflict: 'delivery_id', ignoreDuplicates: true })
  if (insertError) throw new Error(`Webhook enqueue failed: ${insertError.message}`)
  return rows.length
}

export async function deliverPendingWebhooks(client: SupabaseClient, limit = 25): Promise<{ attempted: number; delivered: number }> {
  const { data, error } = await client.rpc('claim_celestial_webhook_deliveries', { p_limit: Math.max(1, Math.min(limit, 100)) })
  if (error) throw new Error(`Webhook queue read failed: ${error.message}`)
  let delivered = 0
  for (const row of data ?? []) {
    const { data: endpoint } = await client.from('celestial_webhook_endpoints').select('target_url, encrypted_signing_secret, status').eq('organization_id', row.organization_id).eq('endpoint_id', row.endpoint_id).maybeSingle()
    if (!endpoint || endpoint.status !== 'active') {
      await client.from('celestial_webhook_deliveries').update({ status: 'failed', attempts: Number(row.attempts) + 1 }).eq('delivery_id', row.delivery_id)
      continue
    }
    let status = 0
    try {
      const targetUrl = parsePublicUpstreamUrl(endpoint.target_url)
      await assertPublicUpstreamHost(targetUrl)
      const body = JSON.stringify(row.payload)
      const timestamp = String(Math.floor(Date.now() / 1_000))
      const secret = decryptWebhookSecret(String(row.organization_id), String(row.endpoint_id), endpoint.encrypted_signing_secret)
      const response = await fetch(targetUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { 'Content-Type': 'application/json', 'User-Agent': 'Maha-Celestial-Webhooks/1', 'X-Maha-Webhook-Timestamp': timestamp, 'X-Maha-Webhook-Signature': webhookSignature(secret, timestamp, body) }, body })
      status = response.status
      if (!response.ok) throw new Error('delivery_rejected')
      delivered += 1
      await client.from('celestial_webhook_deliveries').update({ status: 'delivered', attempts: Number(row.attempts) + 1, delivered_at: new Date().toISOString(), last_status: status }).eq('delivery_id', row.delivery_id)
    } catch {
      const attempts = Number(row.attempts) + 1
      await client.from('celestial_webhook_deliveries').update({ status: attempts >= 8 ? 'failed' : 'retrying', attempts, next_attempt_at: new Date(Date.now() + Math.min(86_400_000, 30_000 * 2 ** attempts)).toISOString(), last_status: status || null }).eq('delivery_id', row.delivery_id)
    }
  }
  return { attempted: data?.length ?? 0, delivered }
}
