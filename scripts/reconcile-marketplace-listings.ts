// Read-only live reconciliation: unsigned challenges never authorize a payment.
import { mkdir, writeFile } from 'node:fs/promises'
import Ajv, { type AnySchema } from 'ajv'

type Offer = { id: string; status: string; canonicalResource: string; method: string; schemas: { input: string }; payment: { displayAmount: string; amountBaseUnits: string; network: string } }
type Quote = { amount?: string; maxAmountRequired?: string; network: string }
type Resource = { resource: string; accepts?: Quote[] }
type PublicPayload = { offers?: Offer[]; resources?: Resource[]; items?: Resource[]; accepts?: Quote[]; contract?: Record<string, { schema?: AnySchema; example?: unknown }> }
type Row = { id: string; endpoint: string; price: string; schemaUrl: string; schemaHttpStatus: number | null; schemaExampleStatus: ReturnType<typeof schemaExampleCheck>; unsignedChallengeStatus: number | null; challengeMatchesManifest: boolean; bazaar: { directoryUrl: string; listed: boolean; priceMatches: boolean | null }; lastVerification: string; [key: string]: unknown }

const site = 'https://www.mahastrategies.com'
const bazaarUrl = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28&limit=100'
const listUrl = 'https://x402-list.com/services/maha-context-compiler-and-deep-context-evaluation'
const directory = 'artifacts/marketplace-readiness/2026-10-01'
const ajv = new Ajv({ strict: false, allErrors: true })
function schemaExampleCheck(declaration: PublicPayload | null) {
  return Object.fromEntries(['input', 'output'].map(side => {
    const contract = declaration?.contract?.[side]
    if (!contract?.schema || contract.example === undefined) return [side, { status: 'missing_schema_or_example' }]
    try {
      const validate = ajv.compile(contract.schema)
      const valid = validate(contract.example)
      return [side, { status: valid ? 'example_valid_against_declared_schema' : 'example_invalid', errors: validate.errors ?? [] }]
    } catch (error) { return [side, { status: 'schema_compile_error', error: String(error) }] }
  }))
}
async function get(url: string, init: RequestInit = {}) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) })
    const body = await response.text()
    let json: PublicPayload | null = null
    try { json = JSON.parse(body) } catch { /* HTML directory */ }
    return { url, verifiedAt: new Date().toISOString(), status: response.status, json, body }
  } catch (error) { return { url, verifiedAt: new Date().toISOString(), status: null, json: null, body: '', error: String(error) } }
}
const [manifest, bazaar, list, cabezon, registry] = await Promise.all([
  get(`${site}/.well-known/x402-public-manifest.json`), get(bazaarUrl), get(listUrl),
  get('http://70.66.243.75:8086/'),
  get('https://registry.modelcontextprotocol.io/v0.1/servers?search=mahastrategies'),
])
if (manifest.status !== 200 || !Array.isArray(manifest.json?.offers)) throw new Error('Live manifest unavailable; no local fallback advertised as current.')
const rows: Row[] = []
const resources = bazaar.json?.resources ?? bazaar.json?.items ?? []
const offers = manifest.json.offers.filter(offer => offer.status === 'active')
for (let offset = 0; offset < offers.length; offset += 4) {
  rows.push(...await Promise.all(offers.slice(offset, offset + 4).map(async offer => {
    const declarationUrl = offer.schemas.input.split('#')[0]
    const [contract, challenge] = await Promise.all([
      get(declarationUrl), get(offer.canonicalResource, { method: offer.method, headers: { 'Content-Type': 'application/json' }, body: '{}' }),
    ])
    const entry = resources.find(resource => resource.resource === offer.canonicalResource)
    const accepted = challenge.json?.accepts ?? []
    const payment = offer.payment
    const matching = accepted.find(quote => String(quote.amount ?? quote.maxAmountRequired) === payment.amountBaseUnits && quote.network === payment.network)
    const listedAccepts = entry?.accepts ?? []
    const listedMatch = listedAccepts.some(quote => String(quote.amount ?? quote.maxAmountRequired) === payment.amountBaseUnits && quote.network === payment.network)
    return {
      id: offer.id, endpoint: offer.canonicalResource, method: offer.method,
      price: payment.displayAmount, amountBaseUnits: payment.amountBaseUnits, network: payment.network,
      unsignedChallengeStatus: challenge.status, challengeMatchesManifest: Boolean(matching),
      schemaUrl: declarationUrl, schemaHttpStatus: contract.status,
      contractKeys: contract.json ? Object.keys(contract.json) : [],
      schemaExampleStatus: schemaExampleCheck(contract.json),
      bazaar: { directoryUrl: bazaarUrl, listed: Boolean(entry), priceMatches: entry ? listedMatch : null },
      x402List: { directoryUrl: ['context-compression', 'deep-context-evaluation'].includes(offer.id) ? listUrl : null, status: ['context-compression', 'deep-context-evaluation'].includes(offer.id) && list.status === 200 ? 'combined page available; text price must be checked' : 'not independently verified' },
      cabezon: { directoryUrl: 'http://70.66.243.75:8086/', status: cabezon.status ?? 'unreachable; prior free-price discrepancy not reverified' },
      lastVerification: challenge.verifiedAt,
      evidence: { challenge: challenge.json, declaration: contract.json, bazaarEntry: entry ?? null },
    }
  })))
}
await mkdir(directory, { recursive: true })
const report = { verifiedAt: new Date().toISOString(), boundary: 'Unsigned HTTP 402 quotes and public declarations only; no payment, delivery, listing approval, or customer demand demonstrated.', sources: { manifest, bazaar, x402List: list, cabezon, registry }, rows }
await writeFile(`${directory}/listing-reconciliation.json`, JSON.stringify(report, null, 2) + '\n')
const columns = ['id', 'endpoint', 'price', 'schemaUrl', 'schemaHttpStatus', 'inputExampleStatus', 'outputExampleStatus', 'unsignedChallengeStatus', 'challengeMatchesManifest', 'bazaarListed', 'bazaarPriceMatches', 'directoryUrl', 'lastVerification']
const csv = (values: unknown[]) => values.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')
await writeFile(`${directory}/listing-reconciliation.csv`, [csv(columns), ...rows.map(row => csv([row.id, row.endpoint, row.price, row.schemaUrl, row.schemaHttpStatus, row.schemaExampleStatus.input.status, row.schemaExampleStatus.output.status, row.unsignedChallengeStatus, row.challengeMatchesManifest, row.bazaar.listed, row.bazaar.priceMatches, row.bazaar.directoryUrl, row.lastVerification]))].join('\n') + '\n')
console.log(JSON.stringify({ endpoints: rows.length, bazaarListed: rows.filter(row => row.bazaar.listed).length, missing: rows.filter(row => !row.bazaar.listed).map(row => row.id), mismatches: rows.filter(row => !row.challengeMatchesManifest || row.bazaar.priceMatches === false).map(row => row.id), declarationKeys: rows[0]?.contractKeys, x402ListLegacyHeader: /X-PAYMENT/i.test(list.body), cabezon: cabezon.status ?? cabezon.error }, null, 2))
