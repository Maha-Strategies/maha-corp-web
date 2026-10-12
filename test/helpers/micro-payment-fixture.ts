import assert from 'node:assert/strict'
import { MICRO_OFFERS } from '../../lib/x402/micro-offers.ts'
import { microHandlers } from '../../lib/x402/micro-route.ts'
import { type MicroProductId } from '../../lib/x402/micro-contracts.ts'
import { resolveX402 } from '../../lib/x402/gateway.ts'
import { x402Config, type X402Config } from '../../lib/x402/config.ts'
import { createMicroRecoveryReader } from '../../lib/x402/micro-recovery.ts'
import { createMicroPurchaseIdentity, microPurchaseHeaders } from '../../lib/x402/micro-purchase.ts'
import type { OfferUsageInput } from '../../lib/x402/offer-telemetry.ts'
const config = x402Config({ X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0x' + '2'.repeat(40), X402_ASSET: '0x' + '3'.repeat(40), X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify(MICRO_OFFERS.map(o => ({ method: 'POST', path: o.path }))) })!
export type Options = { rejected?: boolean; capacity?: boolean; noLedger?: boolean; chainFailed?: boolean; throwSettle?: boolean; telemetryFails?: boolean; releaseFails?: boolean; environment?: string; getPayer?: () => string; beforeSettle?: () => Promise<void>; rejectSpent?: boolean; failMarker?: boolean; failJournal?: boolean; rpc?: (name: string, args: Record<string, unknown>) => Promise<{data: unknown; error: {code?: string} | null}> }
export function fixture(offer = MICRO_OFFERS[0], options: Options & { config?: X402Config } = {}) {
  const calls = { verify: 0, settle: 0, resolve: 0, release: 0, order: [] as string[], rpc: [] as Record<string, unknown>[], usage: [] as OfferUsageInput[] }
  const claimed = new Set<string>()
  const identity = createMicroPurchaseIdentity()
  const admissions = new Map<string, Record<string, unknown>>()
  const journal = new Map<string, Record<string, unknown>>()
  const metadata = new Map<string, Record<string, unknown>>()
  const ledger = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls.rpc.push({ name, ...args })
    if (options.rpc) return options.rpc(name, args)
    const key = [args.p_offer_id, args.p_payer, args.p_idempotency_key].join(':')
    const a = admissions.get(key), m = metadata.get(key), r = journal.get(key)
    if (name === 'claim_x402_payment') {
      const id = String(args.p_payment_id)
      if (claimed.has(id)) return { data: 'duplicate', error: null }
      claimed.add(id); return { data: 'claimed', error: null }
    }
    if (name === 'record_x402_settlement') return { data: null, error: null }
    if (name === 'reserve_x402_micro_purchase' || name === 'reserve_x402_admission') {
      let decision = a ? a.state === 'settled' ? 'already_paid' : a.state === 'failed' ? 'proceed' : 'in_progress' : 'proceed'
      if (a && (a.p_input_hash !== args.p_input_hash || a.p_amount !== args.p_amount || a.p_resource !== args.p_resource)) decision = 'conflict'
      if (m && name === 'reserve_x402_micro_purchase' && (m.p_secret_hash !== args.p_secret_hash || m.p_response_digest !== args.p_response_digest)) decision = 'conflict'
      if (decision === 'proceed') {
        admissions.set(key, { ...args, state: 'reserved' })
        if (name === 'reserve_x402_micro_purchase') metadata.set(key, { ...args })
      }
      return { data: [{ decision, payment_transaction: a?.transaction ?? null }], error: null }
    }
    if (name === 'record_x402_admission_recovery') {
      if (options.failJournal && args.p_state === 'settled') return { data: null, error: {code:'synthetic_failure'} }
      journal.set(key, { state: args.p_state, transaction: args.p_transaction, payment_id: args.p_payment_id, network: args.p_network })
      return { data: null, error: null }
    }
    if (name === 'settle_x402_admission') {
      if (options.failMarker) return { data: null, error: {code:'synthetic_failure'} }
      if (a) Object.assign(a, { state: 'settled', transaction: args.p_transaction })
      return { data: null, error: null }
    }
    if (name === 'release_x402_admission') { if (a) a.state = 'failed'; return { data: null, error: null } }
    if (name === 'read_x402_admission_recovery') return { data: r ? [r] : [], error: null }
    if (name === 'read_x402_micro_purchase') {
      if (!m || !a || m.p_secret_hash !== args.p_secret_hash || a.p_input_hash !== args.p_input_hash) return { data: [], error: null }
      return { data: [{ state: r?.state === 'settled' || r?.state === 'marker_failed' ? 'paid' : r?.state ?? 'pending',
        response_digest: m.p_response_digest, transaction: r?.transaction ?? null, network: r?.network ?? null, amount: a.p_amount }], error: null }
    }
    throw new Error('Unexpected fixture RPC: ' + name)
  } }
  const handlers = microHandlers(offer.id as MicroProductId, {
    recover: createMicroRecoveryReader(options.noLedger ? null : ledger),
    environment: options.environment ?? 'test',
    record: async event => { calls.usage.push(event); if (options.telemetryFails) throw new Error('private-telemetry-marker') },
    release: async () => { calls.release++; if (options.releaseFails) throw new Error('private-release-marker') },
    resolve: request => { calls.resolve++; return resolveX402(request, { config: options.config ?? config,
      ledger: options.noLedger ? null : ledger,
      admissionLedger: options.noLedger ? null : ledger,
      facilitator: { verify: async (_payment, requirement) => {
        calls.verify++; assert.equal(requirement.amount, offer.amount)
        if (options.rejectSpent && calls.settle) return { ok: false, reason: 'authorization_already_spent' }
        return options.rejected ? { ok: false, reason: 'synthetic-rejection' } : { ok: true, payer: options.getPayer?.() ?? '0x' + '4'.repeat(40) }
      }, settle: async () => { calls.order.push('settle'); calls.settle++; await options.beforeSettle?.(); if (options.throwSettle) throw new Error('private-settlement-marker'); return { ok: true, payer: options.getPayer?.() ?? '0x' + '4'.repeat(40), transaction: '0x' + '5'.repeat(64) } } },
      confirmOnChain: async () => options.chainFailed ? { status: 'contradicted', reason: 'synthetic-mismatch' } : { status: 'confirmed', blockNumber: 1, amount: offer.amount },
      acquire: async () => { calls.order.push('acquire'); return { admitted: !options.capacity, active: 1, token: 'synthetic-slot' } },
      release: async () => { calls.release++ },
    }) },
  })
  const request = (body: unknown = offer.discovery.input, headers: Record<string, string> = {}, query = '') => new Request('https://www.mahastrategies.com' + offer.path + query, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...microPurchaseHeaders(offer.id, body, identity), ...headers }, body: JSON.stringify(body),
  })
  const signature = async (nonce = 0, networkIndex = 0) => {
    const challenge = await handlers.POST(request())
    assert.equal(challenge.status, 402)
    const body = await challenge.json()
    return Buffer.from(JSON.stringify({ x402Version: 2, resource: body.resource, accepted: body.accepts[networkIndex], extensions: { 'declaration-integrity': body.extensions['declaration-integrity'] }, payload: { signature: '0xsynthetic' + nonce } })).toString('base64')
  }
  return { calls, handlers, request, signature, identity, ledger }
}
