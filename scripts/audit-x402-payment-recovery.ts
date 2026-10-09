import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { createFacilitator } from '../lib/x402/facilitator.ts'
import { createAdmissionGuard } from '../lib/x402/admission.ts'
import {
  acceptPayment,
  type PaymentPayload,
  type PaymentRequirement,
  type ReplayGuard,
} from '../lib/x402/protocol.ts'

// Characterization audit, NOT a security pass gate. All payments, ledger
// operations and network responses are fake. Each finding says whether the
// unsafe behavior was reproduced; no production modules are changed.
const requirement: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:8453', amount: '1000',
  payTo: `0x${'22'.repeat(20)}`, asset: `0x${'33'.repeat(20)}`,
  maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' },
}
const payer = `0x${'11'.repeat(20)}`
const transaction = `0x${'44'.repeat(32)}`
function payment(nonce = '55'): PaymentPayload {
  return {
    x402Version: 2, accepted: requirement,
    payload: {
      signature: `0x${'aa'.repeat(65)}`,
      authorization: { from: payer, to: requirement.payTo, value: requirement.amount,
        validAfter: '0', validBefore: '9999999999', nonce: `0x${nonce.repeat(32)}` },
    },
  }
}

function fakeLedger(failMarker = false) {
  let state: 'absent' | 'reserved' | 'settled' | 'failed' = 'absent'
  let recordedTransaction: string | null = null
  let releases = 0
  let recovery: Record<string, unknown> | null = null
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === 'record_x402_admission_recovery') {
        recovery = { state: args.p_state, transaction: args.p_transaction, payment_id: args.p_payment_id, network: args.p_network }
      }
      if (name === 'read_x402_admission_recovery') return { data: recovery ? [recovery] : [], error: null }
      if (name === 'reserve_x402_admission') {
        if (state === 'settled') return { data: [{ decision: 'already_paid', payment_transaction: recordedTransaction }], error: null }
        if (state === 'reserved') return { data: [{ decision: 'in_progress' }], error: null }
        state = 'reserved'
        return { data: [{ decision: 'proceed' }], error: null }
      }
      if (name === 'settle_x402_admission') {
        if (failMarker) return { data: null, error: { message: 'synthetic marker write failure' } }
        state = 'settled'
        recordedTransaction = String(args.p_transaction)
      }
      if (name === 'release_x402_admission') { state = 'failed'; releases += 1 }
      return { data: null, error: null }
    },
  }
  const guard = createAdmissionGuard({
    offerId: 'synthetic-recovery-audit', idempotencyKey: 'same_purchase_0001',
    inputHash: `sha256:${'ab'.repeat(32)}`, resource: 'https://merchant.example/paid', amount: requirement.amount,
  }, client)!
  return { guard, inspect: () => ({ state, recordedTransaction, releases }) }
}

function fakeReplay(): ReplayGuard {
  const ids = new Set<string>()
  return {
    async claim({ paymentId }) {
      if (ids.has(paymentId)) return 'duplicate'
      ids.add(paymentId)
      return 'claimed'
    },
    async recordSettlement() {},
  }
}

async function run() {
  const findings: Array<{ id: string; severity: string; reproduced: boolean; evidence: unknown }> = []
  const realFetch = globalThis.fetch
  // Guard the whole audit against accidental network access. The one scenario
  // below temporarily installs a strict mock accepting only merchant.example.
  globalThis.fetch = async () => { throw new Error('Audit forbids real network access') }
  try {
    const calls: string[] = []
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      assert.equal(url.hostname, 'facilitator.example')
      assert.equal(url.pathname, '/settle')
      calls.push(url.pathname)
      if (calls.length === 1) throw new Error('synthetic lost settlement response')
      return Response.json({ success: true, payer, transaction, network: requirement.network })
    }
    const diagnosticResult = await createFacilitator({ url: 'https://facilitator.example' }).settle(payment(), requirement)
    findings.push({ id: 'settlement-diagnostic-reposts-and-discards-success', severity: 'high',
      reproduced: calls.length === 2 && !diagnosticResult.ok,
      evidence: { signedSettlementPosts: calls.length, diagnosticResult,
        hypotheticalSecondResponse: 'mock would return success on a second call; should never be requested' } })
    globalThis.fetch = async () => { throw new Error('Audit forbids real network access') }

    const ledger = fakeLedger()
    const replayGuard = fakeReplay()
    let moneyMoves = 0
    const facilitator = {
      async verify() { return { ok: true as const, payer } },
      async settle() {
        moneyMoves += 1 // money moved, but the first response was lost
        return moneyMoves === 1
          ? { ok: false as const, reason: 'facilitator_settle_failed' }
          : { ok: true as const, payer, transaction }
      },
    }
    const first = await acceptPayment({ payment: payment(), requirements: [requirement], facilitator, replayGuard, admissionGuard: ledger.guard })
    const afterFirst = ledger.inspect()
    const retry = await acceptPayment({ payment: payment('66'), requirements: [requirement], facilitator, replayGuard, admissionGuard: ledger.guard })
    findings.push({ id: 'unknown-settlement-releases-logical-purchase', severity: 'high',
      reproduced: afterFirst.state === 'failed' && moneyMoves === 2,
      evidence: { first, afterFirst, retry, simulatedMoneyMovesForOnePurchase: moneyMoves } })

    const contradictedLedger = fakeLedger()
    const contradictedReplay = fakeReplay()
    let confirmations = 0
    let settlements = 0
    const contradictionInput = {
      requirements: [requirement], replayGuard: contradictedReplay, admissionGuard: contradictedLedger.guard,
      facilitator: {
        async verify() { return { ok: true as const, payer } },
        async settle() { settlements += 1; return { ok: true as const, payer, transaction } },
      },
      async confirmOnChain() { confirmations += 1; return { status: 'contradicted' as const, reason: 'synthetic wrong recipient' } },
    }
    const contradicted = await acceptPayment({ ...contradictionInput, payment: payment() })
    const contradictionRetry = await acceptPayment({ ...contradictionInput, payment: payment('77') })
    findings.push({ id: 'already-paid-retry-bypasses-chain-contradiction', severity: 'high',
      reproduced: !contradicted.ok && contradicted.status === 502 && contradictionRetry.ok,
      evidence: { first: contradicted, retry: contradictionRetry, confirmations, settlements } })

    const markerLedger = fakeLedger(true)
    const markerReplay = fakeReplay()
    let markerSettlements = 0
    const markerInput = {
      requirements: [requirement], replayGuard: markerReplay, admissionGuard: markerLedger.guard,
      facilitator: {
        async verify() { return { ok: true as const, payer } },
        async settle() { markerSettlements += 1; return { ok: true as const, payer, transaction } },
      },
    }
    const markerFirst = await acceptPayment({ ...markerInput, payment: payment() })
    const markerRetry = await acceptPayment({ ...markerInput, payment: payment('88') })
    findings.push({ id: 'failed-marker-write-leaves-paid-order-in-progress', severity: 'medium',
      reproduced: markerFirst.ok && !markerRetry.ok && markerRetry.status === 409 && markerSettlements === 1,
      evidence: { first: markerFirst, retry: markerRetry, settlements: markerSettlements, ledger: markerLedger.inspect(),
        interpretation: markerRetry.ok ? 'Original transaction recovered without a second settlement.' : 'Recovery remains blocked; inspect the journal.' } })

    const report = { checkedAt: new Date().toISOString(), scope: 'dirty local checkout; synthetic scenarios only',
      productionChanged: false, realPayments: 0, releaseGate: false, findings }
    const outputIndex = process.argv.indexOf('--output')
    if (outputIndex >= 0) {
      const output = process.argv[outputIndex + 1]
      if (!output) throw new Error('--output requires a path')
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
    }
    console.log(JSON.stringify(report, null, 2))
  } finally {
    globalThis.fetch = realFetch
  }
}
await run()
