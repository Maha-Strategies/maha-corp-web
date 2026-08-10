// Noticing that someone paid, and whether they came back.
//
// The first external settlement was found by looking at a wallet balance and
// wondering where the money came from. Nothing in the platform reported it. The
// endpoint watch monitors availability and the Bazaar canary monitors listing
// freshness; neither notices revenue, and neither would notice the one event
// the commercial plan actually gates on -- a second payment from a wallet that
// is not ours.
//
// This module is the judgement, not the fetching. It takes settlements and
// decides what they mean, so the rule that separates a customer from our own
// canary is testable without a chain.
//
// The discipline it exists to enforce: every external figure excludes
// operator-controlled wallets, always, and says so on the report. Canary
// traffic converts by construction. Counting it as demand is the easiest lie
// this platform could tell itself, and the one the infrastructure review warned
// about by name.

/** One USDC transfer into the payee address. */
export type Settlement = {
  payer: string
  amountBaseUnits: bigint
  blockNumber: bigint
  transactionHash: string
}

export type PayerClass = 'canary' | 'external'

export type PayerSummary = {
  payer: string
  classification: PayerClass
  settlements: number
  totalBaseUnits: string
  firstBlock: string
  lastBlock: string
  /** Two or more settlements inside the scanned window. */
  repeat: boolean
}

export type NotableEvent =
  | { kind: 'first_external_settlement'; payer: string; transactionHash: string }
  | { kind: 'repeat_external_settlement'; payer: string; settlements: number }
  | { kind: 'unexpected_amount'; payer: string; transactionHash: string; amountBaseUnits: string }

export type WatchReport = {
  scannedFromBlock: string
  scannedToBlock: string
  /** Wallets excluded from every external figure below, and why. */
  excludedOperatorWallets: string[]
  externalPayers: PayerSummary[]
  canaryPayers: PayerSummary[]
  totals: {
    externalSettlements: number
    externalPayers: number
    repeatExternalPayers: number
    canarySettlements: number
  }
  notable: NotableEvent[]
  /** Carried on the report so the numbers are never read without their bound. */
  interpretation: string
}

const lower = (value: string) => value.trim().toLowerCase()

/**
 * Classify settlements and decide what is worth waking someone for.
 *
 * `expectedAmountBaseUnits` is the published price. A transfer of any other
 * amount into the payee is reported separately rather than counted as a sale:
 * it is far more likely to be the wallet being funded, or a mistake, than a
 * customer, and quietly adding it to revenue would overstate exactly the
 * figure this exists to keep honest.
 */
export function buildSettlementWatch(input: {
  settlements: readonly Settlement[]
  operatorWallets: readonly string[]
  expectedAmountBaseUnits: bigint
  fromBlock: bigint
  toBlock: bigint
  /** External payers already reported, so a repeat is news only once. */
  alreadyReportedPayers?: readonly string[]
}): WatchReport {
  const operators = new Set(input.operatorWallets.map(lower))
  const reported = new Set((input.alreadyReportedPayers ?? []).map(lower))

  const grouped = new Map<string, Settlement[]>()
  for (const settlement of input.settlements) {
    const payer = lower(settlement.payer)
    grouped.set(payer, [...(grouped.get(payer) ?? []), settlement])
  }

  const summaries: PayerSummary[] = [...grouped.entries()].map(([payer, settlements]): PayerSummary => {
    const blocks = settlements.map((settlement) => settlement.blockNumber)
    return {
      payer,
      classification: operators.has(payer) ? 'canary' : 'external',
      settlements: settlements.length,
      totalBaseUnits: settlements.reduce((total, settlement) => total + settlement.amountBaseUnits, BigInt(0)).toString(),
      firstBlock: (blocks.reduce((low, block) => (block < low ? block : low))).toString(),
      lastBlock: (blocks.reduce((high, block) => (block > high ? block : high))).toString(),
      repeat: settlements.length >= 2,
    }
  }).sort((left, right) => (left.payer < right.payer ? -1 : left.payer > right.payer ? 1 : 0))

  const externalPayers = summaries.filter((summary) => summary.classification === 'external')
  const canaryPayers = summaries.filter((summary) => summary.classification === 'canary')

  const notable: NotableEvent[] = []
  for (const summary of externalPayers) {
    const settlements = grouped.get(summary.payer) ?? []
    if (!reported.has(summary.payer)) {
      notable.push({
        kind: 'first_external_settlement',
        payer: summary.payer,
        transactionHash: settlements[0]?.transactionHash ?? '',
      })
    }
    // The decision gate. A single payment is a trial; a second is the first
    // evidence that the service was worth calling twice.
    if (summary.repeat) {
      notable.push({ kind: 'repeat_external_settlement', payer: summary.payer, settlements: summary.settlements })
    }
  }

  // Reported for every payer, operator or not: a canary paying the wrong
  // amount is a bug in our own bounded spend, which is worth knowing too.
  for (const [payer, settlements] of grouped) {
    for (const settlement of settlements) {
      if (settlement.amountBaseUnits !== input.expectedAmountBaseUnits) {
        notable.push({
          kind: 'unexpected_amount',
          payer,
          transactionHash: settlement.transactionHash,
          amountBaseUnits: settlement.amountBaseUnits.toString(),
        })
      }
    }
  }

  return {
    scannedFromBlock: input.fromBlock.toString(),
    scannedToBlock: input.toBlock.toString(),
    excludedOperatorWallets: [...operators].sort(),
    externalPayers,
    canaryPayers,
    totals: {
      externalSettlements: externalPayers.reduce((total, summary) => total + summary.settlements, 0),
      externalPayers: externalPayers.length,
      repeatExternalPayers: externalPayers.filter((summary) => summary.repeat).length,
      canarySettlements: canaryPayers.reduce((total, summary) => total + summary.settlements, 0),
    },
    notable,
    interpretation:
      'Counts cover the scanned block range only. Operator-controlled wallets are excluded from every '
      + 'external figure: canary traffic converts by construction and is not demand. "Repeat" means two or '
      + 'more settlements inside this window, so a payer whose two payments straddle the window boundary '
      + 'reads as two separate single payments -- widen the range before concluding a buyer did not return.',
  }
}

/** A one-line summary for a notification body. */
export function describeWatch(report: WatchReport): string {
  const { externalPayers, repeatExternalPayers, externalSettlements } = report.totals
  if (externalPayers === 0) return 'No external settlements in the scanned range.'
  const repeats = repeatExternalPayers > 0 ? `, ${repeatExternalPayers} of them repeat` : ''
  return `${externalSettlements} external settlement(s) from ${externalPayers} wallet(s)${repeats}.`
}
