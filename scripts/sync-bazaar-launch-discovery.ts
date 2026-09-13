/** Offline generation of the existing discovery documents; no network or payments. */
import { readFileSync, writeFileSync } from 'node:fs'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { BAZAAR_LAUNCH_IDS } from '../lib/x402/bazaar-launch.ts'

const args = process.argv.slice(2)
if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('Use --write or --check')
for (const [name, field, paymentField] of [
  ['agent-card', 'capabilities', 'payment'], ['agent-offers', 'technicalCapabilities', 'machinePayment'],
] as const) {
  const path = new URL(`../content/discovery/${name}.json`, import.meta.url)
  const before = readFileSync(path, 'utf8'), data = JSON.parse(before)
  for (const entry of data[field]) {
    if (!BAZAAR_LAUNCH_IDS.includes(entry.id)) continue
    const offer = X402_OFFERS.find(o => o.id === entry.id)!
    entry.description = offer.description
    entry[paymentField].amount = offer.amount
  }
  const after = JSON.stringify(data, null, 2) + '\n'
  if (args[0] === '--write') writeFileSync(path, after)
  else if (before !== after) throw new Error(`launch-discovery-stale:${name}`)
}
console.log('23 launch descriptions and prices synchronized offline.')
