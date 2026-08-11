import assert from 'node:assert/strict'
import test from 'node:test'

import { priceFor, requirementFor, x402Config, type X402Config } from '../lib/x402/config.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'
import type { PaymentFacilitator } from '../lib/x402/protocol.ts'
import { MPS_AUTONOMOUS_AUDIT_OFFER } from '../lib/x402/offers.ts'
import { IDEMPOTENCY_KEY_HEADER, INPUT_HASH_HEADER, readAdmissionClaim } from '../lib/x402/admission.ts'

// One logical request must produce at most one settlement.
//
// The bug: the proxy settled first and the route deduplicated second, so a
// payer whose request timed out retried with a freshly signed authorization,
// paid again, and was told `idempotentReplay: true`. The response asserted no
// second charge while a second charge existed. Everything below drives the real
// gateway and counts settlements at the facilitator, which is the only place
// that number is real.

const ENV = {
  X402_ENABLED: 'true',
  X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0xSettlement',
  X402_ASSET: '0xUSDC',
  X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify([{ method: 'POST', path: MPS_AUTONOMOUS_AUDIT_OFFER.path }]),
}
const config = () => x402Config(ENV) as X402Config
const PATH = MPS_AUTONOMOUS_AUDIT_OFFER.path
const URL_ = `https://www.mahastrategies.com${PATH}`
const INPUT_A = `sha256:${'a'.repeat(64)}`
const INPUT_B = `sha256:${'b'.repeat(64)}`

/**
 * A facilitator that counts settlements, and mints a distinct transaction for
 * each. A second settlement is therefore visible as both a count and a
 * different transaction id.
 */
function countingFacilitator() {
  const settlements: string[] = []
  const facilitator: PaymentFacilitator = {
    verify: async () => ({ ok: true, payer: '0xAgent' }),
    settle: async () => {
      const transaction = `tx_${settlements.length + 1}`
      settlements.push(transaction)
      return { ok: true, payer: '0xAgent', transaction }
    },
  }
  return { facilitator, settlements }
}

/**
 * An in-memory stand-in for the admission table, implementing the same
 * decisions as reserve_x402_admission.
 *
 * Deliberately mirrors the SQL rather than mocking the guard: the property
 * under test is the *sequence* -- claim, then settle -- and a mocked guard
 * would let that sequence be wrong while the test passed.
 */
function admissionStore() {
  const rows = new Map<string, { inputHash: string; resource: string; amount: string; state: string; transaction: string | null }>()
  const key = (args: Record<string, unknown>) => `${args.p_offer_id}|${args.p_payer}|${args.p_idempotency_key}`

  return {
    rows,
    rpc: async (name: string, args: Record<string, unknown>) => {
      const id = key(args)
      if (name === 'reserve_x402_admission') {
        const existing = rows.get(id)
        if (!existing) {
          rows.set(id, { inputHash: String(args.p_input_hash), resource: String(args.p_resource), amount: String(args.p_amount), state: 'reserved', transaction: null })
          return { data: [{ decision: 'proceed', payment_transaction: null }], error: null }
        }
        if (existing.inputHash !== args.p_input_hash || existing.resource !== args.p_resource || existing.amount !== String(args.p_amount)) {
          return { data: [{ decision: 'conflict', payment_transaction: null }], error: null }
        }
        if (existing.state === 'settled') return { data: [{ decision: 'already_paid', payment_transaction: existing.transaction }], error: null }
        if (existing.state === 'reserved') return { data: [{ decision: 'in_progress', payment_transaction: null }], error: null }
        existing.state = 'reserved'
        return { data: [{ decision: 'proceed', payment_transaction: null }], error: null }
      }
      if (name === 'settle_x402_admission') {
        const existing = rows.get(id)
        if (existing) { existing.state = 'settled'; existing.transaction = String(args.p_transaction) }
        return { data: null, error: null }
      }
      if (name === 'release_x402_admission') {
        const existing = rows.get(id)
        if (existing && existing.state === 'reserved') existing.state = 'failed'
        return { data: null, error: null }
      }
      return { data: null, error: null }
    },
  }
}

async function signature() {
  const priced = priceFor('POST', PATH, config())!
  const requirement = requirementFor(priced, URL_, config())
  const extensions = await discoveryExtensionsFor(priced, URL_, requirement)
  return Buffer.from(JSON.stringify({
    x402Version: 2,
    resource: resourceInfoFor(priced, URL_),
    accepted: requirement,
    // A fresh nonce each time: this is the *newly signed* retry that the old
    // design charged for a second time. The x402 replay guard cannot catch it,
    // because it is genuinely a different authorization.
    payload: { signature: `0x${Math.random().toString(16).slice(2)}` },
    extensions,
  }), 'utf8').toString('base64')
}

const request = async (headers: Record<string, string>) =>
  new Request(URL_, { method: 'POST', headers: { 'PAYMENT-SIGNATURE': await signature(), ...headers } })

const idempotent = (key: string, inputHash = INPUT_A) => ({ [IDEMPOTENCY_KEY_HEADER]: key, [INPUT_HASH_HEADER]: inputHash })
const freshLedger = () => ({ rpc: async () => ({ data: 'claimed', error: null }) }) as never
const acquire = async () => ({ admitted: true, active: 1, token: 'slot-token' })

test('the same logical request submitted twice settles exactly once', async () => {
  // The headline integration proof the whole design exists for.
  const { facilitator, settlements } = countingFacilitator()
  const admissionLedger = admissionStore()
  const deps = { config: config(), facilitator, ledger: freshLedger(), acquire, admissionLedger }

  const first = await resolveX402(await request(idempotent('req_same_0001')), deps)
  const second = await resolveX402(await request(idempotent('req_same_0001')), deps)

  assert.equal(first.kind, 'paid')
  assert.equal(second.kind, 'paid')
  assert.equal(settlements.length, 1, `expected one settlement, saw ${settlements.length}: ${settlements.join(', ')}`)

  if (first.kind !== 'paid' || second.kind !== 'paid') return
  // The retry is handed the original transaction, not a new one.
  assert.equal(second.transaction, first.transaction)
  assert.equal(second.replayed, true)
  assert.notEqual(first.replayed, true)
})

test('a retry with a newly signed authorization is still not charged again', async () => {
  // The exact shape the old design got wrong. Each call above already signs a
  // fresh nonce, so the x402 replay guard sees two legitimate, distinct
  // authorizations; only the admission claim stops the second settling.
  const { facilitator, settlements } = countingFacilitator()
  const admissionLedger = admissionStore()
  const deps = { config: config(), facilitator, ledger: freshLedger(), acquire, admissionLedger }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await resolveX402(await request(idempotent('req_retry_0001')), deps)
  }
  assert.equal(settlements.length, 1)
})

test('the same key with different input is refused before anything settles', async () => {
  const { facilitator, settlements } = countingFacilitator()
  const admissionLedger = admissionStore()
  const deps = { config: config(), facilitator, ledger: freshLedger(), acquire, admissionLedger }

  const first = await resolveX402(await request(idempotent('req_conflict_01', INPUT_A)), deps)
  assert.equal(first.kind, 'paid')

  const second = await resolveX402(await request(idempotent('req_conflict_01', INPUT_B)), deps)
  assert.equal(second.kind, 'refused')
  if (second.kind !== 'refused') return
  assert.equal(second.status, 409)
  assert.match(second.code, /idempotency|already_used/)

  // The refusal cost nothing: still one settlement, from the first request.
  assert.equal(settlements.length, 1)
})

test('concurrent duplicates cannot both settle', async () => {
  const { facilitator, settlements } = countingFacilitator()
  const admissionLedger = admissionStore()
  const deps = { config: config(), facilitator, ledger: freshLedger(), acquire, admissionLedger }

  const outcomes = await Promise.all([
    resolveX402(await request(idempotent('req_race_00001')), deps),
    resolveX402(await request(idempotent('req_race_00001')), deps),
    resolveX402(await request(idempotent('req_race_00001')), deps),
  ])

  assert.equal(settlements.length, 1, `expected one settlement, saw ${settlements.length}`)
  assert.equal(outcomes.filter((outcome) => outcome.kind === 'paid' && !outcome.replayed).length, 1)
  // The losers are refused as in-progress rather than charged.
  for (const outcome of outcomes) {
    if (outcome.kind === 'refused') assert.equal(outcome.status, 409)
  }
})

test('a failed settlement releases the claim so the payer can retry', async () => {
  // Refusing forever would be its own bug: a payer whose settlement failed
  // through no fault of theirs must not be locked out of their own key.
  const admissionLedger = admissionStore()
  const failing: PaymentFacilitator = {
    verify: async () => ({ ok: true, payer: '0xAgent' }),
    settle: async () => ({ ok: false, reason: 'insufficient_funds' }),
  }
  const refused = await resolveX402(await request(idempotent('req_release_001')), {
    config: config(), facilitator: failing, ledger: freshLedger(), acquire, admissionLedger,
  })
  assert.equal(refused.kind, 'challenge')

  const { facilitator, settlements } = countingFacilitator()
  const retried = await resolveX402(await request(idempotent('req_release_001')), {
    config: config(), facilitator, ledger: freshLedger(), acquire, admissionLedger,
  })
  assert.equal(retried.kind, 'paid')
  assert.equal(settlements.length, 1)
})

test('an unreadable admission store refuses rather than charging twice', async () => {
  // Failing open here would reintroduce the double charge on exactly the day
  // the database is unwell. A refusal costs a retry; failing open costs money.
  const { facilitator, settlements } = countingFacilitator()
  const broken = { rpc: async () => ({ data: null, error: { message: 'down' } }) }
  const outcome = await resolveX402(await request(idempotent('req_broken_0001')), {
    config: config(), facilitator, ledger: freshLedger(), acquire, admissionLedger: broken,
  })
  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 503)
  assert.equal(settlements.length, 0, 'nothing may settle when idempotency cannot be guaranteed')
})

test('an idempotent offer refuses a payer that declared no key, before settling', async () => {
  const { facilitator, settlements } = countingFacilitator()
  const outcome = await resolveX402(await request({}), {
    config: config(), facilitator, ledger: freshLedger(), acquire, admissionLedger: admissionStore(),
  })
  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 400)
  assert.equal(outcome.code, 'idempotency_key_required')
  assert.equal(settlements.length, 0)
})

test('the declared claim is validated before it is trusted', () => {
  const offer = { id: 'mps-autonomous-audit', amount: '100000' }
  assert.equal(readAdmissionClaim(new Headers(), offer, URL_).ok, false)
  assert.equal(readAdmissionClaim(new Headers({ [IDEMPOTENCY_KEY_HEADER]: 'short' }), offer, URL_).ok, false)
  assert.equal(
    readAdmissionClaim(new Headers({ [IDEMPOTENCY_KEY_HEADER]: 'req_valid_00001', [INPUT_HASH_HEADER]: 'not-a-hash' }), offer, URL_).ok,
    false,
  )

  const good = readAdmissionClaim(new Headers({ ...idempotent('req_valid_00001') }), offer, URL_)
  assert.equal(good.ok, true)
  if (!good.ok) return
  // Everything that makes a request that request is bound, so a key cannot be
  // reused across resources or prices.
  assert.equal(good.claim.offerId, 'mps-autonomous-audit')
  assert.equal(good.claim.amount, '100000')
  assert.equal(good.claim.resource, URL_)
  assert.equal(good.claim.inputHash, INPUT_A)
})

test('the stateless offers do not demand an idempotency key', async () => {
  // A duplicate compression is duplicated work the payer asked for, not a
  // double charge for one job. Requiring a key there would be friction with no
  // safety behind it.
  const { CONTEXT_COMPRESSION_OFFER, DEEP_CONTEXT_EVALUATION_OFFER } = await import('../lib/x402/offers.ts')
  assert.equal(CONTEXT_COMPRESSION_OFFER.requiresIdempotency, false)
  assert.equal(DEEP_CONTEXT_EVALUATION_OFFER.requiresIdempotency, false)
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.requiresIdempotency, true)
})
