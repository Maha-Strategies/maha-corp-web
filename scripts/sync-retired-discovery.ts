/** Offline mechanical synchronization of current public advertisements only. */
import { readFileSync, writeFileSync } from 'node:fs'
import { RETIRED_X402_PRODUCTS } from '../lib/x402/retired-offers.ts'
const mode = process.argv[2]
if (!['--write', '--check'].includes(mode)) throw Error('Use --write or --check')
const ids = new Set(RETIRED_X402_PRODUCTS.map(p => p.id))
for (const [name, field] of [['agent-card', 'capabilities'], ['agent-offers', 'technicalCapabilities']] as const) {
  const path = new URL(`../content/discovery/${name}.json`, import.meta.url), before = readFileSync(path, 'utf8'), value = JSON.parse(before)
  value[field] = value[field].filter((e: { id: string }) => !ids.has(e.id))
  if (value.transactionPolicy) for (const key of ['autonomousPaymentScope', 'describedNotPayable']) value.transactionPolicy[key] = value.transactionPolicy[key].filter((id: string) => !ids.has(id))
  const after = JSON.stringify(value, null, 2) + '\n'
  if (mode === '--write') writeFileSync(path, after)
  else if (before !== after) throw Error('retired_discovery_stale:' + name)
}
const path = new URL('../content/discovery/agentic-commerce.md', import.meta.url), before = readFileSync(path, 'utf8')
const after = before.split('\n').filter(line => !RETIRED_X402_PRODUCTS.some(p => line.includes(p.id) || line.includes(p.path))).join('\n')
if (mode === '--write') writeFileSync(path, after)
else if (before !== after) throw Error('retired_discovery_stale:agentic-commerce')
console.log('Retired whole-book experiments removed from current discovery; historical artifacts unchanged.')
