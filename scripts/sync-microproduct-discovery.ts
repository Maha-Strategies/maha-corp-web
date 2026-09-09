import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { isMicroProduct } from '../lib/x402/micro-contracts.ts'

if (process.argv.slice(2).some(x => !['--write', '--check'].includes(x))) throw new Error('Only local --write or --check is supported.')
for (const [name, field, paymentField] of [['agent-card', 'capabilities', 'payment'], ['agent-offers', 'technicalCapabilities', 'machinePayment']] as const) {
  const path = resolve(import.meta.dirname, `../content/discovery/${name}.json`)
  const before = readFileSync(path, 'utf8'), body = JSON.parse(before)
  const retained = body[field].filter((entry: { id: string }) => !isMicroProduct(entry.id))
  body[field] = [...retained, ...MICRO_OFFERS.map(o => ({
    id: o.id, status: o.status, endpoint: `https://www.mahastrategies.com${o.path}`, method: o.method,
    description: o.description, payableNow: o.availability.payableInProduction, blockedBy: o.availability.blockedBy,
    [paymentField]: { protocol: 'x402', version: 2, network: 'eip155:8453', amount: o.amount, assetSymbol: 'USDC', autonomous: o.availability.payableInProduction, payableNow: o.availability.payableInProduction },
  }))]
  if (name === 'agent-offers') body.transactionPolicy.describedNotPayable = [...body.transactionPolicy.describedNotPayable.filter((id: string) => !isMicroProduct(id)), ...MICRO_OFFERS.filter(o => !o.availability.payableInProduction).map(o => o.id)]
  const after = JSON.stringify(body, null, 2) + '\n'
  if (process.argv.includes('--write')) writeFileSync(path, after)
  else if (before !== after) throw new Error(`microproduct-discovery-stale:${name}`)
}
console.log(`${MICRO_OFFERS.filter(o => o.availability.payableInProduction).length} released and ${MICRO_OFFERS.filter(o => !o.availability.payableInProduction).length} withheld microproduct declarations synchronized. No network or deployment.`)
