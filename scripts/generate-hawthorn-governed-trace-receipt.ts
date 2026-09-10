import { readFile, writeFile } from 'node:fs/promises'

import {
  buildGovernedTraceReceipt,
  type GovernedTraceInput,
  type HawthornTraceExport,
} from '../lib/integrations/hawthorn-governed-trace-receipt.ts'

const root = new URL('../fixtures/hawthorn-governed-trace-receipt/', import.meta.url)
const trace = JSON.parse(await readFile(new URL('synthetic-skillloop-trace.json', root), 'utf8')) as HawthornTraceExport
const governance = JSON.parse(await readFile(new URL('synthetic-governance-input.json', root), 'utf8')) as Omit<GovernedTraceInput, 'trace'>
const receipt = await buildGovernedTraceReceipt({ trace, ...governance })
const serialized = `${JSON.stringify(receipt, null, 2)}\n`

if (process.argv.includes('--write')) {
  await writeFile(new URL('synthetic-governed-trace-receipt.json', root), serialized, 'utf8')
}

process.stdout.write(serialized)
