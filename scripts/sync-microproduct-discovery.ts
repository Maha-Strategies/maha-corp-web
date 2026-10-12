import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { isMicroProduct } from '../lib/x402/micro-contracts.ts'
import { DECLARED_PAYMENT_NETWORKS } from '../lib/x402/networks.ts'

if (process.argv.slice(2).some(x => !['--write', '--check'].includes(x))) throw new Error('Only local --write or --check is supported.')
for (const [name, field, paymentField] of [['agent-card', 'capabilities', 'payment'], ['agent-offers', 'technicalCapabilities', 'machinePayment']] as const) {
  const path = resolve(import.meta.dirname, `../content/discovery/${name}.json`)
  const before = readFileSync(path, 'utf8'), body = JSON.parse(before)
  const updates = MICRO_OFFERS.map(o => ({
    id: o.id, status: o.status, endpoint: `https://www.mahastrategies.com${o.path}`, method: o.method,
    description: o.description, payableNow: o.availability.payableInProduction, blockedBy: o.availability.blockedBy,
    [paymentField]: { protocol: 'x402', version: 2, network: 'eip155:8453', networks: DECLARED_PAYMENT_NETWORKS, amount: o.amount, assetSymbol: 'USDC', autonomous: o.availability.payableInProduction, payableNow: o.availability.payableInProduction },
  }))
  // Independent cohorts must not reorder each other's already-valid entries.
  const byId = new Map(updates.map(entry => [entry.id, entry]))
  const existing = body[field].filter((entry: { id: string }) => !isMicroProduct(entry.id) || byId.has(entry.id))
  const present = new Set(existing.map((entry: { id: string }) => entry.id))
  body[field] = [...existing.map((entry: { id: string }) => byId.get(entry.id) ?? entry), ...updates.filter(entry => !present.has(entry.id))]
  if (name === 'agent-offers') {
    for (const [key, payable] of [['autonomousPaymentScope', true], ['describedNotPayable', false]] as const) {
      const wanted = MICRO_OFFERS.filter(o => o.availability.payableInProduction === payable).map(o => o.id)
      const retained = body.transactionPolicy[key].filter((id: string) => !isMicroProduct(id) || wanted.includes(id))
      body.transactionPolicy[key] = [...retained, ...wanted.filter(id => !retained.includes(id))]
    }
  }
  const after = JSON.stringify(body, null, 2) + '\n'
  if (process.argv.includes('--write')) writeFileSync(path, after)
  else if (before !== after) throw new Error(`microproduct-discovery-stale:${name}`)
}
console.log(`${MICRO_OFFERS.filter(o => o.availability.payableInProduction).length} released and ${MICRO_OFFERS.filter(o => !o.availability.payableInProduction).length} withheld microproduct declarations synchronized. No network or deployment.`)
