import { readFile, writeFile } from 'node:fs/promises'
import { createPublicReader } from '../lib/x402/demand6/public-fetch.ts'
import { inspectQuote, type QuoteHistory } from '../lib/x402/demand6/products.ts'
import { MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { quoteObservationSchema } from '../lib/x402/demand6/contracts.ts'
// Explicit one-time public observation only. No schedule, signer, settlement or private upload.
if (!process.argv.includes('--collect')) throw new Error('Pass --collect to request two public unpaid observations.')
const resource = 'https://www.mahastrategies.com/api/v1/compress', file = 'content/x402/demand6/quote-history.json'
const saved = JSON.parse(await readFile(file, 'utf8')) as QuoteHistory
if (saved.schemaVersion !== 'maha-quote-history/1.0' || saved.observations.length > 998) throw new Error('history_bound_exceeded')
saved.observations.forEach(row => quoteObservationSchema.parse(row))
const read = createPublicReader([{ url: resource, method: 'POST', body: '{}' }])
const rows = [...saved.observations]
for (let i = 0; i < 2; i++) {
  const response = await read(resource)
  const row = inspectQuote(resource, response, MAHA_PAYEE, '999999999', new Date().toISOString())
  if (row.challengeState !== 'observed') throw new Error('quote_observation_incomplete')
  rows.push(row)
}
const snapshot: QuoteHistory = { schemaVersion: 'maha-quote-history/1.0', snapshotAt: new Date().toISOString(), observations: rows }
await writeFile(file, JSON.stringify(snapshot, null, 2) + '\n')
console.log(JSON.stringify({ observations: rows.length, newObservations: 2, snapshotAt: snapshot.snapshotAt, paymentsMade: 0, continuousUptimeEstablished: false }))
