import { readFileSync, writeFileSync } from 'node:fs'
import { BUYER_BRIEF_OFFER as o } from '../lib/x402/buyer-brief-offer.ts'
import { isMicroProduct } from '../lib/x402/micro-contracts.ts'
const args = process.argv.slice(2)
if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('Use --write or --check')
for (const [name, field, paymentField] of [['agent-card', 'capabilities', 'payment'], ['agent-offers', 'technicalCapabilities', 'machinePayment']] as const) {
  const path = new URL(`../content/discovery/${name}.json`, import.meta.url)
  const before = readFileSync(path, 'utf8'), body = JSON.parse(before)
  const retained = body[field].filter((v: {id: string}) => v.id !== o.id)
  const entry = {
    id: o.id, status: o.status, endpoint: `https://www.mahastrategies.com${o.path}`, method: o.method,
    description: o.description, payableNow: o.availability.payableInProduction, blockedBy: o.availability.blockedBy,
    [paymentField]: { protocol: 'x402', version: 2, network: 'eip155:8453', amount: o.amount, assetSymbol: 'USDC', autonomous: o.availability.payableInProduction, payableNow: o.availability.payableInProduction },
  }
  const index = retained.findIndex((v: {id: string}) => isMicroProduct(v.id))
  retained.splice(index < 0 ? retained.length : index, 0, entry)
  body[field] = retained
  if (name === 'agent-offers') for (const [key, included] of [['autonomousPaymentScope', o.availability.payableInProduction], ['describedNotPayable', !o.availability.payableInProduction]] as const) {
    const ids = body.transactionPolicy[key].filter((id: string) => id !== o.id)
    const firstMicro = ids.findIndex(isMicroProduct)
    if (included) ids.splice(firstMicro < 0 ? ids.length : firstMicro, 0, o.id)
    body.transactionPolicy[key] = ids
  }
  const after = JSON.stringify(body, null, 2) + '\n'
  if (args[0] === '--write') writeFileSync(path, after)
  else if (before !== after) throw new Error(`buyer-brief-discovery-stale:${name}`)
}
