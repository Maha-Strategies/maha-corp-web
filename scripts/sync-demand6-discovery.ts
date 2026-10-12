import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEMAND6_OFFERS } from '../lib/x402/demand6/offers.ts'
import { isDemand6 } from '../lib/x402/demand6/contracts.ts'
import { DECLARED_PAYMENT_NETWORKS } from '../lib/x402/networks.ts'
if (process.argv.slice(2).some(arg => !['--write', '--check'].includes(arg))) throw new Error('Only local --write or --check is supported.')
for (const [name, field, paymentField] of [['agent-card', 'capabilities', 'payment'], ['agent-offers', 'technicalCapabilities', 'machinePayment']] as const) {
  const path = resolve(import.meta.dirname, `../content/discovery/${name}.json`), before = readFileSync(path, 'utf8'), body = JSON.parse(before)
  body[field] = [...body[field].filter((entry: { id: string }) => !isDemand6(entry.id)), ...DEMAND6_OFFERS.map(offer => ({
    id: offer.id, status: offer.status, endpoint: 'https://www.mahastrategies.com' + offer.path, method: offer.method,
    description: offer.description, payableNow: false, blockedBy: offer.availability.blockedBy,
    [paymentField]: { protocol: 'x402', version: 2, network: 'eip155:8453', networks: DECLARED_PAYMENT_NETWORKS,
      amount: offer.amount, assetSymbol: 'USDC', autonomous: false, payableNow: false },
  }))]
  if (name === 'agent-offers') {
    body.transactionPolicy.autonomousPaymentScope = body.transactionPolicy.autonomousPaymentScope.filter((id: string) => !isDemand6(id))
    body.transactionPolicy.describedNotPayable = [...body.transactionPolicy.describedNotPayable.filter((id: string) => !isDemand6(id)), ...DEMAND6_OFFERS.map(offer => offer.id)]
  }
  const after = JSON.stringify(body, null, 2) + '\n'
  if (process.argv.includes('--write')) writeFileSync(path, after)
  else if (before !== after) throw new Error('demand6_discovery_stale')
}
console.log('Six locally implemented, nonpayable demand products synchronized. No activation, network or payment.')
