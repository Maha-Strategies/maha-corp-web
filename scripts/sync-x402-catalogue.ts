import { readFileSync, writeFileSync } from 'node:fs'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { isMicroProduct } from '../lib/x402/micro-contracts.ts'
const args = process.argv.slice(2)
if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('Local --write or --check only.')
const offers = [...X402_OFFERS.filter(o => !isMicroProduct(o.id)), ...X402_OFFERS.filter(o => isMicroProduct(o.id))]
for (const [name, field, paymentField] of [['agent-card', 'capabilities', 'payment'], ['agent-offers', 'technicalCapabilities', 'machinePayment']] as const) {
  const path = `content/discovery/${name}.json`, before = readFileSync(path, 'utf8'), body = JSON.parse(before)
  const existing = body[field] as Record<string, any>[]
  const kept = existing.filter(row => !offers.some(o => o.id === row.id) && row[paymentField]?.protocol !== 'x402')
  body[field] = [...kept, ...offers.map(o => ({
    ...existing.find(row => row.id === o.id), id: o.id, status: o.status, endpoint: `https://www.mahastrategies.com${o.path}`, method: o.method,
    description: o.description, payableNow: o.availability.payableInProduction, blockedBy: o.availability.blockedBy,
    [paymentField]: { protocol: 'x402', version: 2, network: 'eip155:8453', amount: o.amount, assetSymbol: 'USDC', autonomous: o.availability.payableInProduction, payableNow: o.availability.payableInProduction },
  }))]
  if (name === 'agent-offers') {
    body.transactionPolicy.autonomousPaymentScope = offers.filter(o => o.availability.payableInProduction).map(o => o.id)
    body.transactionPolicy.describedNotPayable = offers.filter(o => !o.availability.payableInProduction).map(o => o.id)
    body.transactionPolicy.bindingCommitment = 'Only a matching live PAYMENT-REQUIRED challenge proves an endpoint is enabled. Prices, licences and limitations are product-specific. Book sections sell one pinned Markdown section; the two 10 USDC bundles deliver their pinned EPUB and PDF files. Neither permits redistribution, resale or model training. Payment, delivery, indexing and customer acceptance are distinct. Idempotent paid jobs and ebook bundles support their declared recovery contracts; never repay automatically after an uncertain outcome. Stripe purchases and custom engagements require human confirmation.'
  }
  const after = JSON.stringify(body, null, 2) + '\n'
  if (args[0] === '--write') writeFileSync(path, after)
  else if (before !== after) throw new Error(`x402-catalogue-stale:${name}`)
}
console.log('Public catalogues synchronized locally; no payment, network call or deployment.')
