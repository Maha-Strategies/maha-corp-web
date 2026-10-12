import { readDiscoveryAttribution } from '../lib/x402/discovery-attribution.ts'
// Existing server-side configuration only; prints aggregates, not addresses or purchase IDs.
console.log(JSON.stringify(await readDiscoveryAttribution(), null, 2))
