import assert from 'node:assert/strict'
import { PATHS } from './workflow.ts'

export type Observation = {
  runId: string
  participant: string // Consented pseudonym, not a wallet-to-person inference.
  completedAt: string
  purpose: 'test' | 'real_work' | 'unknown'
  funding: 'self_funded' | 'sponsored' | 'operator' | 'unknown'
  independentlyOperated: boolean
  assisted: boolean
  resultValidated: boolean
  settlement: 'confirmed' | 'unconfirmed' | 'failed'
  evidenceRef: string // Private reconciliation record; never raw source text.
  payments: { endpoint: typeof PATHS[number]; transaction: string; amountUnits: number }[]
}

export function measure(input: { startedAt: string | null; observedThrough: string; observations: Observation[] }) {
  const now = Date.parse(input.observedThrough)
  assert.ok(Number.isFinite(now))
  if (input.startedAt === null) {
    assert.equal(input.observations.length, 0, 'Cannot count runs before experiment starts')
    return { status: 'not_started', confirmedRuns: 0, repeatParticipants: 0 }
  }
  const start = Date.parse(input.startedAt)
  assert.ok(Number.isFinite(start) && start <= now)
  const runs = new Set<string>()
  const txs = new Set<string>()
  for (const row of input.observations) {
    assert.ok(row.runId && !runs.has(row.runId), 'Duplicate or missing run ID')
    runs.add(row.runId)
    assert.match(row.participant, /^[a-z0-9_-]{1,64}$/)
    assert.ok(['test', 'real_work', 'unknown'].includes(row.purpose))
    assert.ok(['self_funded', 'sponsored', 'operator', 'unknown'].includes(row.funding))
    assert.ok(['confirmed', 'unconfirmed', 'failed'].includes(row.settlement))
    for (const flag of [row.independentlyOperated, row.assisted, row.resultValidated]) assert.equal(typeof flag, 'boolean')
    assert.ok(typeof row.evidenceRef === 'string' && row.evidenceRef.trim())
    const at = Date.parse(row.completedAt)
    assert.ok(Number.isFinite(at) && at >= start && at <= now)
    assert.ok(Array.isArray(row.payments))
    const endpoints = new Set<string>()
    for (const payment of row.payments) {
      assert.ok(PATHS.includes(payment.endpoint) && !endpoints.has(payment.endpoint))
      endpoints.add(payment.endpoint)
      assert.match(payment.transaction, /^0x[0-9a-fA-F]{64}$/)
      const key = payment.transaction.toLowerCase()
      assert.ok(!txs.has(key), 'Duplicate transaction: reconcile; do not count twice')
      txs.add(key)
      assert.ok(Number.isSafeInteger(payment.amountUnits) && payment.amountUnits > 0)
    }
    if (row.settlement === 'confirmed') assert.ok(row.payments.length > 0)
  }
  const paid = input.observations.filter(r => r.settlement === 'confirmed')
  const delivered = paid.filter(r => r.resultValidated && r.independentlyOperated && r.funding !== 'operator')
  const organic = delivered.filter(r => r.funding === 'self_funded' && r.purpose === 'real_work' && !r.assisted)
  const participants = [...new Set(organic.map(r => r.participant))]
  const day = (at: string) => new Date(at).toISOString().slice(0, 10)
  const sevenDays = 7 * 86400000
  let eligible = 0, repeats = 0, pending = 0
  for (const participant of participants) {
    const rows = organic.filter(r => r.participant === participant).sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
    const first = rows[0]
    if (now - Date.parse(first.completedAt) < sevenDays) { pending++; continue }
    eligible++
    if (rows.some(r => day(r.completedAt) !== day(first.completedAt) && Date.parse(r.completedAt) <= Date.parse(first.completedAt) + sevenDays)) repeats++
  }
  const converted = new Set(organic.filter(r => delivered.some(prior => prior.participant === r.participant && prior.funding === 'sponsored' && Date.parse(prior.completedAt) < Date.parse(r.completedAt) && day(prior.completedAt) !== day(r.completedAt))).map(r => r.participant))
  return {
    status: 'observing', attempts: input.observations.length,
    confirmedRuns: paid.length, validatedIndependentRuns: delivered.length,
    sponsoredRuns: delivered.filter(r => r.funding === 'sponsored').length,
    unknownFundingRuns: delivered.filter(r => r.funding === 'unknown').length,
    organicRealWorkRuns: organic.length,
    sponsoredToOrganicParticipants: converted.size,
    sevenDayRepeat: { eligibleParticipants: eligible, repeatParticipants: repeats, immatureParticipants: pending, rate: eligible ? repeats / eligible : null },
    confirmedGrossUsdc: paid.reduce((sum, r) => sum + r.payments.reduce((n, p) => n + p.amountUnits, 0), 0) / 1e6,
    organicGrossUsdc: organic.reduce((sum, r) => sum + r.payments.reduce((n, p) => n + p.amountUnits, 0), 0) / 1e6,
    contributionMargin: null,
    limitation: 'Operator-curated evidence, not automatic chain verification. Costs unavailable; no profitability claim. Wallets are not people. Sponsored or requested test repetitions are not organic repeat usage.',
  }
}
