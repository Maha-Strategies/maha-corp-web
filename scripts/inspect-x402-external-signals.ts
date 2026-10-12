import { DEMAND_FEED_URL, readFreeTanodQuery, readFreeTanodDomain, readFreeTanodHistory, summarizeDemandFeed } from '../lib/x402/external-signals.ts'

// Public read-only observations. No wallet, payment library, package installation or private uploads.
let demand: unknown = { status: 'unavailable' }
try {
  const response = await fetch(DEMAND_FEED_URL, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (response.ok) demand = summarizeDemandFeed(await response.json())
} catch { /* Never print arbitrary provider errors or accept a broken feed as no demand. */ }
let tanod: unknown = { status: 'not_requested', paymentsMade: 0 }
if (process.argv.includes('--tanod')) {
  try { tanod = await readFreeTanodQuery() } catch { tanod = { status: 'unavailable', paymentsMade: 0 } }
}
let tanodDomain: unknown = { status: 'not_requested', paymentsMade: 0 }
let tanodHistory: unknown = { status: 'not_requested', paymentsMade: 0 }
if (process.argv.includes('--tanod-infrastructure')) {
  try { tanodDomain = await readFreeTanodDomain() } catch { tanodDomain = { status: 'unavailable', paymentsMade: 0 } }
  try { tanodHistory = await readFreeTanodHistory() } catch { tanodHistory = { status: 'unavailable', paymentsMade: 0 } }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), demand, tanod, tanodDomain, tanodHistory, paymentsMade: 0,
  automaticChanges: false, privateDataUploaded: false }, null, 2))
