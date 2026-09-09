import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MICRO_IDS, MICRO_VERSION } from '../lib/x402/micro-contracts.ts'
import { MICRO_SAMPLE_INPUTS } from '../lib/x402/micro-samples.ts'
import { buildMicroProduct, microDigest } from '../lib/x402/micro-products.ts'

if (process.argv.slice(2).some(x => !['--write', '--check'].includes(x))) throw new Error('Only --write or --check is supported; this script has no remote mode.')
const outputs = Object.fromEntries(await Promise.all(MICRO_IDS.map(async id => [id, await buildMicroProduct(id, MICRO_SAMPLE_INPUTS[id])])))
const body = { version: MICRO_VERSION, basis: 'local-synthetic-and-public-corpus-examples; no payments or deployment', outputs }
const text = JSON.stringify({ ...body, digest: microDigest(body) }, null, 2) + '\n'
const target = resolve(import.meta.dirname, '../content/discovery/microproduct-examples.json')
if (process.argv.includes('--write')) writeFileSync(target, text)
else if (readFileSync(target, 'utf8') !== text) throw new Error('microproduct-examples-stale')
console.log(JSON.stringify({ products: MICRO_IDS.length, digest: microDigest(body), remoteCalls: 0, builds: 0 }))
