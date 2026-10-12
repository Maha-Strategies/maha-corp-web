import { writeFile } from 'node:fs/promises'
import { DEMAND6_IDS, DEMAND6_SAMPLES } from '../lib/x402/demand6/contracts.ts'
import { buildDemandProduct } from '../lib/x402/demand6/products.ts'
import { fixtureDependencies } from '../lib/x402/demand6/fixtures.ts'
const outputs = Object.fromEntries(await Promise.all(DEMAND6_IDS.map(async id => [id,
  await buildDemandProduct(id, { ...DEMAND6_SAMPLES[id], dataClass: 'synthetic' }, fixtureDependencies)])))
await writeFile('content/x402/demand6/examples.json', JSON.stringify(outputs, null, 2) + '\n')
console.log('Six original synthetic examples generated. Network calls, payments and model calls: 0.')
