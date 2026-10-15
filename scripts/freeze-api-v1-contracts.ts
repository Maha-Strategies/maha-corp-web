import { readFile, writeFile } from 'node:fs/promises'
import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'

const batch = Number(process.argv[2])
if (!Number.isInteger(batch) || batch < 1 || batch > 20) throw Error('batch_number_required')
const implemented = ENDPOINTS.filter(e => e.status === 'local-implemented')
if (implemented.length !== batch * 50) throw Error('snapshot_count_mismatch')
const record = {
  implemented: implemented.map(e => ({ id: e.id, path: e.path, method: e.method,
    inputDigest: demandDigest(e.schema.input), outputDigest: demandDigest(e.schema.output), contractDigest: demandDigest(e) })),
  prices: ENDPOINTS.map(e => ({ id: e.id, amount: e.amount, tier: e.pricing!.tier })),
  productionReleaseDigest: demandDigest(JSON.parse(await readFile('content/api-v1/production-release-296.json', 'utf8'))),
}
await writeFile(`content/api-v1/batches-1-${batch}-contract-snapshot.json`, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ frozenContracts: implemented.length, prices: record.prices.length }))
