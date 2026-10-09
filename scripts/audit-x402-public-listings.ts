import { writeFile } from 'node:fs/promises'
import Ajv from 'ajv'
import { assessOfferInactivity, findBazaarResource } from '../lib/x402/bazaar-inactivity.ts'
import { BAZAAR_MERCHANT_URL, MAHA_PAYEE, type BazaarResource } from '../lib/x402/discovery-payment-recipe.ts'

// Public diagnostic only: no credentials, signed authorizations or settlement.
const origin = 'https://www.mahastrategies.com'
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true })
async function request(url: string, method = 'GET') {
  const parsed = new URL(url)
  if (parsed.origin !== origin && !(parsed.origin === 'https://api.cdp.coinbase.com' && parsed.pathname === new URL(BAZAAR_MERCHANT_URL).pathname && method === 'GET')) {
    throw new Error('Public audit refuses an unexpected destination')
  }
  const response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(25_000),
    ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}) })
  const body = await response.json()
  return { response, body }
}
const checkedAt = new Date().toISOString()
const manifestResult = await request(`${origin}/.well-known/x402-public-manifest.json`)
if (!manifestResult.response.ok) throw new Error('Manifest unavailable')
const offers = manifestResult.body.offers.filter((offer: any) => offer.status === 'active' && offer.payment?.protocol === 'x402')
const resources: BazaarResource[] = []
for (let offset = 0; offset < 1_000; offset += 100) {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  url.searchParams.set('offset', String(offset))
  const result = await request(url.href)
  if (!result.response.ok) throw new Error(`Bazaar merchant lookup failed: ${result.response.status}`)
  const page = result.body.resources ?? result.body.items
  if (!Array.isArray(page)) throw new Error('Unrecognized Bazaar pagination payload')
  resources.push(...page)
  if (page.length < 100) break
  if (offset === 900) throw new Error('Bazaar pagination exceeds audit safety bound')
}
const rows: any[] = []
// Two concurrent unsigned probes, preserving report order.
for (let index = 0; index < offers.length; index += 2) {
  const pair = await Promise.all(offers.slice(index, index + 2).map(async (offer: any) => {
    try {
      const declarationUrl = new URL(offer.schemas.input)
      declarationUrl.hash = ''
      const [{ response, body }, declaration] = await Promise.all([
        request(offer.canonicalResource, 'POST'), request(declarationUrl.href),
      ])
      const encoded = response.headers.get('payment-required')
      const challenge = encoded ? JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) : null
      const terms = challenge?.accepts?.find((term: any) => term.scheme === 'exact' && term.network === 'eip155:8453')
      const metadata = declaration.body
      const schemaChecks = ['input', 'output'].map((side) => {
        const contract = metadata.contract?.[side]
        if (!contract?.schema || contract.example === undefined) return { side, valid: false, reason: 'schema or example missing' }
        const validate = ajv.compile(contract.schema)
        return { side, valid: Boolean(validate(contract.example)), errors: validate.errors }
      })
      const listing = findBazaarResource(resources, offer.canonicalResource)
      return { offerId: offer.id, resource: offer.canonicalResource, unsignedStatus: response.status,
        declarationStatus: declaration.response.status, schemaChecks,
        challengeMatches: response.status === 402 && challenge?.x402Version === 2
          && challenge?.resource?.url === offer.canonicalResource
          && terms?.amount === offer.payment.amountBaseUnits
          && terms?.payTo?.toLowerCase() === MAHA_PAYEE.toLowerCase()
          && terms?.asset?.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
          && JSON.stringify(body) === JSON.stringify(challenge),
        liveAmountBaseUnits: terms?.amount ?? null,
        declarationPriceMatches: metadata.payment?.amount === terms?.amount,
        bazaarIndexed: Boolean(listing),
        bazaarPriceMatches: listing ? Boolean(listing.accepts?.some((term) => term.amount === terms?.amount && term.network === terms?.network)) : null,
        inactivity: assessOfferInactivity({ offerId: offer.id, resource: offer.canonicalResource,
          coveredByCanary: offer.id === 'context-compression' }, listing, Date.now()),
      }
    } catch (error) { return { offerId: offer.id, error: String(error) } }
  }))
  rows.push(...pair)
}
const report = { checkedAt, finishedAt: new Date().toISOString(), realPayments: 0,
  boundary: 'Unsigned empty-body payment challenges and public schema examples only; no paid fulfillment or output recovery was tested. Format validation disabled; structural examples validated. Inactivity uses the repository configured 30-day threshold, not a guaranteed removal date.',
  manifestConfigurationAsOf: manifestResult.body.configurationAsOf,
  bazaarResourcesReturned: resources.length, rows }
const outputIndex = process.argv.indexOf('--output')
if (outputIndex >= 0) await writeFile(process.argv[outputIndex + 1], `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ checkedAt, offers: rows.length,
  quotesMatching: rows.filter((row) => row.challengeMatches).length,
  schemaExamplesValid: rows.filter((row) => row.schemaChecks?.every((check: any) => check.valid)).length,
  indexed: rows.filter((row) => row.bazaarIndexed).length,
  missing: rows.filter((row) => row.bazaarIndexed === false).map((row) => row.offerId),
  errors: rows.filter((row) => row.error),
  mismatches: rows.filter((row) => !row.error && (!row.challengeMatches || !row.declarationPriceMatches || row.bazaarPriceMatches === false)),
  urgent: rows.filter((row) => row.inactivity?.level === 'urgent'),
  prices: rows.map((row) => ({ offerId: row.offerId, baseUnits: row.liveAmountBaseUnits })),
}, null, 2))
