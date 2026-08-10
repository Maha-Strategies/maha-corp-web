import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSettlementWatch, describeWatch, type Settlement } from '../lib/x402/settlement-watch.ts'
import { CANARY_BUYER, EXPECTED_PRICE_BASE_UNITS, OPERATOR_WALLETS } from '../lib/x402/discovery-payment-recipe.ts'

// The failure that matters here is not a missed alert. It is counting our own
// canary as a customer -- the most flattering mistake this platform could make,
// and the one its own infrastructure review named. Every external figure below
// is asserted to exclude operator wallets, in several shapes, because one
// address comparison going wrong turns a report into a press release.

const EXTERNAL = '0x72F6d77a78DbEc1B2fFf6F6DB4672dDdE1Bd04C4'
const OTHER_EXTERNAL = '0x1111111111111111111111111111111111111111'

const settlement = (payer: string, block: number, amount = EXPECTED_PRICE_BASE_UNITS): Settlement =>
  ({ payer, amountBaseUnits: amount, blockNumber: BigInt(block), transactionHash: `0x${block.toString(16).padStart(64, '0')}` })

const watch = (settlements: Settlement[], reported: string[] = []) => buildSettlementWatch({
  settlements,
  operatorWallets: [...OPERATOR_WALLETS],
  expectedAmountBaseUnits: EXPECTED_PRICE_BASE_UNITS,
  fromBlock: BigInt(1),
  toBlock: BigInt(1_000),
  alreadyReportedPayers: reported,
})

test('canary settlements are never counted as external demand', () => {
  const report = watch([settlement(CANARY_BUYER, 10), settlement(CANARY_BUYER, 20), settlement(EXTERNAL, 30)])

  assert.equal(report.totals.canarySettlements, 2)
  assert.equal(report.totals.externalSettlements, 1)
  assert.equal(report.totals.externalPayers, 1)
  assert.deepEqual(report.externalPayers.map((payer) => payer.payer), [EXTERNAL.toLowerCase()])
})

test('the canary is excluded whatever case its address arrives in', () => {
  // Chain logs, config files and humans disagree about checksum casing. An
  // address comparison that is case-sensitive would classify our own canary as
  // a customer, which is the single worst outcome this module can produce.
  for (const spelling of [CANARY_BUYER, CANARY_BUYER.toLowerCase(), CANARY_BUYER.toUpperCase().replace('0X', '0x'), ` ${CANARY_BUYER} `]) {
    const report = watch([settlement(spelling, 10)])
    assert.equal(report.totals.externalSettlements, 0, `case ${spelling} leaked into external figures`)
    assert.equal(report.totals.canarySettlements, 1)
  }
})

test('a repeat external payer is the event the gate is waiting for', () => {
  const report = watch([settlement(EXTERNAL, 10), settlement(EXTERNAL, 500)])

  assert.equal(report.totals.repeatExternalPayers, 1)
  assert.equal(report.externalPayers[0].repeat, true)
  assert.ok(report.notable.some((event) => event.kind === 'repeat_external_settlement' && event.payer === EXTERNAL.toLowerCase()))
})

test('a repeat canary payer is not a repeat buyer', () => {
  // The canary settles on a schedule. Reporting it as returning demand would
  // make the gate fire every three weeks forever.
  const report = watch([settlement(CANARY_BUYER, 10), settlement(CANARY_BUYER, 500)])
  assert.equal(report.totals.repeatExternalPayers, 0)
  assert.equal(report.notable.length, 0)
})

test('a first settlement is news once, not on every scheduled run', () => {
  const settlements = [settlement(EXTERNAL, 10)]
  assert.ok(watch(settlements).notable.some((event) => event.kind === 'first_external_settlement'))
  assert.equal(watch(settlements, [EXTERNAL]).notable.length, 0)
  // Suppression is case-insensitive too, or the alert repeats forever.
  assert.equal(watch(settlements, [EXTERNAL.toLowerCase()]).notable.length, 0)
})

test('a known payer returning still raises the repeat event', () => {
  // Suppressing the first-settlement notice must not suppress the thing that
  // actually matters commercially.
  const report = watch([settlement(EXTERNAL, 10), settlement(EXTERNAL, 500)], [EXTERNAL])
  assert.equal(report.notable.length, 1)
  assert.equal(report.notable[0].kind, 'repeat_external_settlement')
})

test('a transfer that is not the published price is not a sale', () => {
  // Funding the wallet, or a fat-fingered amount, would otherwise be added to
  // revenue. Reported, but never counted.
  const report = watch([settlement(EXTERNAL, 10, BigInt(5_000_000))])
  assert.ok(report.notable.some((event) => event.kind === 'unexpected_amount'))
  const unexpected = report.notable.find((event) => event.kind === 'unexpected_amount')
  assert.equal(unexpected && 'amountBaseUnits' in unexpected ? unexpected.amountBaseUnits : null, '5000000')
})

test('several external payers are each summarised separately', () => {
  const report = watch([
    settlement(EXTERNAL, 10), settlement(EXTERNAL, 20),
    settlement(OTHER_EXTERNAL, 30),
    settlement(CANARY_BUYER, 40),
  ])
  assert.equal(report.totals.externalPayers, 2)
  assert.equal(report.totals.externalSettlements, 3)
  assert.equal(report.totals.repeatExternalPayers, 1)
  // Deterministic order, so two runs over one window read identically.
  assert.deepEqual(report.externalPayers.map((payer) => payer.payer), [OTHER_EXTERNAL.toLowerCase(), EXTERNAL.toLowerCase()])
})

test('an empty window says nobody paid rather than nothing at all', () => {
  const report = watch([])
  assert.equal(report.totals.externalSettlements, 0)
  assert.equal(report.notable.length, 0)
  assert.equal(describeWatch(report), 'No external settlements in the scanned range.')
})

test('every report states the window it is bound by', () => {
  // A count without its range invites "the buyer never came back" from a scan
  // too narrow to have seen them.
  const report = watch([settlement(EXTERNAL, 10)])
  assert.match(report.interpretation, /scanned block range only/i)
  assert.match(report.interpretation, /converts by construction/i)
  assert.match(report.interpretation, /straddle the window boundary/i)
  assert.equal(report.scannedFromBlock, '1')
  assert.equal(report.scannedToBlock, '1000')
})

test('the excluded wallets are named on the report itself', () => {
  // A consumer should not have to trust that exclusion happened.
  const report = watch([settlement(EXTERNAL, 10)])
  assert.deepEqual(report.excludedOperatorWallets, [CANARY_BUYER.toLowerCase()])
})

test('totals in USDC base units survive round-tripping as strings', () => {
  // bigint does not survive JSON, and a silently truncated total would
  // understate revenue in the evidence artifact.
  const report = watch([settlement(EXTERNAL, 10), settlement(EXTERNAL, 20)])
  assert.equal(report.externalPayers[0].totalBaseUnits, '2000')
  assert.equal(JSON.parse(JSON.stringify(report)).externalPayers[0].totalBaseUnits, '2000')
})
