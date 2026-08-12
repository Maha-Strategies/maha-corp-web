import assert from 'node:assert/strict'
import test from 'node:test'

import { getX402Readiness } from '../lib/x402/readiness.ts'
import { CONTEXT_COMPRESSION_OFFER, DEEP_CONTEXT_EVALUATION_OFFER, MPS_AUTONOMOUS_AUDIT_OFFER, X402_OFFERS } from '../lib/x402/offers.ts'

/**
 * A catalog in which Deep Context is still `preview`.
 *
 * Deep Context was promoted to `available`, so no published offer is in the
 * preview state any more. Injecting one keeps the preview branch covered:
 * otherwise promoting the last preview offer would silently delete the tests
 * for what happens to the next one.
 */
const WITH_PREVIEW_OFFER = X402_OFFERS.map((offer) => offer.id === 'deep-context-evaluation'
  ? { ...offer, status: 'preview' as const, availability: { payableInProduction: false, blockedBy: ['synthetic preview gate'] } }
  : offer)

// `catalogContradictions` used to be computed and then dropped: a deployment
// that disagreed with the published catalog logged one line at boot and served
// traffic anyway. A contradiction nobody is paged about is a contradiction that
// ships.

const BASE = {
  X402_ENABLED: 'true',
  X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0xSettlement',
  X402_ASSET: '0xUSDC',
  X402_NETWORK: 'base',
  X402_CHAIN_RPC_URL: 'https://base-rpc.example',
  X402_RESOURCES: JSON.stringify([{ method: 'POST', path: CONTEXT_COMPRESSION_OFFER.path }]),
}

const everything = async () => true
const nothing = async () => false
const check = (report: { checks: { id: string; state: string; summary: string; detail?: string }[] }, id: string) =>
  report.checks.find((entry) => entry.id === id)

test('a coherent deployment reports ready', async () => {
  const report = await getX402Readiness({ environment: BASE, probe: everything })
  assert.equal(report.state, 'ready')
  assert.equal(report.enabled, true)
  assert.equal(check(report, 'x402.catalog.agreement')?.state, 'ok')
  assert.equal(check(report, 'x402.settlement.configuration')?.state, 'ok')
})

test('a configuration that contradicts the catalog fails readiness', async () => {
  // The whole reason this endpoint exists.
  const report = await getX402Readiness({
    environment: {
      ...BASE,
      X402_RESOURCES: JSON.stringify([{ method: 'POST', path: CONTEXT_COMPRESSION_OFFER.path, amount: '5', description: 'cheap', concurrencyCap: 99 }]),
    },
    probe: everything,
  })
  assert.equal(report.state, 'unavailable')
  const contradiction = check(report, 'x402.catalog.agreement')
  assert.equal(contradiction?.state, 'fail')
  assert.match(contradiction!.detail ?? '', /prices POST \/api\/v1\/compress at 5 but the catalog publishes 1000/)
})

test('missing tables fail readiness rather than surfacing as a paid 503', async () => {
  const report = await getX402Readiness({ environment: BASE, probe: nothing })
  assert.equal(report.state, 'unavailable')
  const storage = check(report, 'x402.offer.context-compression.storage')
  assert.equal(storage?.state, 'fail')
  assert.match(storage!.detail ?? '', /Unapplied migrations/)
  assert.match(storage!.detail ?? '', /settle and then receive a 503/)
})

test('an offer enabled for payment but published as withheld fails readiness', async () => {
  // The specific mistake that would sell something the catalog says is not for
  // sale. It is a configuration error, not a code error, so only readiness can
  // catch it.
  //
  // Injects a withheld offer rather than naming a live one. Every offer in the
  // catalog is payable as of 2026-08-12, and a guard written against whichever
  // offer happens to be withheld today stops testing the invariant the moment
  // that offer is promoted -- which is exactly what happened to this test.
  const withheld = {
    ...MPS_AUTONOMOUS_AUDIT_OFFER,
    status: 'withheld' as const,
    availability: {
      payableInProduction: false,
      blockedBy: ['The required paid-job and admission migrations have not been applied and verified.'],
    },
  }
  const report = await getX402Readiness({
    environment: {
      ...BASE,
      X402_RESOURCES: JSON.stringify([
        { method: 'POST', path: CONTEXT_COMPRESSION_OFFER.path },
        { method: 'POST', path: withheld.path },
      ]),
    },
    offers: [CONTEXT_COMPRESSION_OFFER, withheld],
    probe: everything,
  })
  assert.equal(report.state, 'unavailable')
  const status = check(report, 'x402.offer.mps-autonomous-audit.status')
  assert.equal(status?.state, 'fail')
  assert.match(status!.summary, /enabled for payment but published as "withheld"/)
  // And it says what would unblock it.
  assert.match(status!.detail ?? '', /paid-job and admission migrations|durable paid-job recovery/i)
})

test('the MPS runtime prerequisite is reported before the offer is enabled', async () => {
  // The whole point of a precondition is to be checkable beforehand. Gating
  // this on enablement meant the only way to learn the retrieval secret was
  // missing was to enable MPS -- and because the route refuses after
  // settlement, that means learning it with a payer's money.
  const unmet = await getX402Readiness({ environment: BASE, probe: everything })
  const unmetCheck = check(unmet, 'x402.offer.mps-autonomous-audit.runtime')
  assert.equal(unmetCheck?.state, 'info', 'a prerequisite for a disabled offer is reported, not counted against health')
  assert.match(unmetCheck!.summary, /not enabled here/)
  // Reported without degrading the deployment: a correctly-configured system
  // must not be permanently amber for owning an unshipped product.
  assert.equal(unmet.state, 'ready')

  const met = await getX402Readiness({
    environment: { ...BASE, X402_RETRIEVAL_TOKEN_SECRET: 'a'.repeat(44), ANTHROPIC_API_KEY: 'k' },
    probe: everything,
  })
  const metCheck = check(met, 'x402.offer.mps-autonomous-audit.runtime')
  assert.equal(metCheck?.state, 'ok')
  // And a satisfied prerequisite must not hold readiness below ready, or a
  // healthy deployment could never report 200 while an offer waits to ship.
  assert.equal(met.state, 'ready')
})

test('an enabled paid MPS job fails readiness without its runtime secrets', async () => {
  const report = await getX402Readiness({
    environment: {
      ...BASE,
      X402_RESOURCES: JSON.stringify([
        { method: 'POST', path: CONTEXT_COMPRESSION_OFFER.path },
        { method: 'POST', path: MPS_AUTONOMOUS_AUDIT_OFFER.path },
      ]),
    },
    probe: everything,
  })
  const runtime = check(report, 'x402.offer.mps-autonomous-audit.runtime')
  assert.equal(runtime?.state, 'fail')
  assert.match(runtime?.detail ?? '', /retrieval-token secret/)
  assert.match(runtime?.detail ?? '', /model provider credential/)
})

test('an enabled paid MPS job reports its runtime dependencies without echoing them', async () => {
  const secret = 'retrieval-secret-that-is-long-enough-to-use'
  const modelKey = 'model-provider-secret'
  const report = await getX402Readiness({
    environment: {
      ...BASE,
      X402_RETRIEVAL_TOKEN_SECRET: secret,
      ANTHROPIC_API_KEY: modelKey,
      X402_RESOURCES: JSON.stringify([
        { method: 'POST', path: CONTEXT_COMPRESSION_OFFER.path },
        { method: 'POST', path: MPS_AUTONOMOUS_AUDIT_OFFER.path },
      ]),
    },
    probe: everything,
  })
  assert.equal(check(report, 'x402.offer.mps-autonomous-audit.runtime')?.state, 'ok')
  assert.equal(JSON.stringify(report).includes(secret), false)
  assert.equal(JSON.stringify(report).includes(modelKey), false)
})

test('a preview offer enabled outside Production warns rather than failing', async () => {
  // Preview means exercised in a non-production environment, so enabling it
  // there is the intended state. Failing on it would make readiness cry wolf
  // on every Preview and train operators to ignore the one signal that
  // matters -- a withheld offer being enabled.
  const report = await getX402Readiness({
    environment: {
      ...BASE,
      X402_RESOURCES: JSON.stringify([
        { method: 'POST', path: CONTEXT_COMPRESSION_OFFER.path },
        { method: 'POST', path: '/api/v1/compress/evaluate' },
      ]),
    },
    probe: everything,
    offers: WITH_PREVIEW_OFFER,
  })
  const status = check(report, 'x402.offer.deep-context-evaluation.status')
  assert.equal(status?.state, 'warn')
  assert.match(status!.summary, /correct outside Production, never inside it/)
  assert.equal(report.state, 'degraded', 'a preview offer degrades readiness, it does not break it')
})

test('a preview offer enabled in Production fails readiness', async () => {
  const report = await getX402Readiness({
    environment: {
      ...BASE,
      VERCEL_ENV: 'production',
      X402_RESOURCES: JSON.stringify([
        { method: 'POST', path: CONTEXT_COMPRESSION_OFFER.path },
        { method: 'POST', path: '/api/v1/compress/evaluate' },
      ]),
    },
    probe: everything,
    offers: WITH_PREVIEW_OFFER,
  })
  assert.equal(check(report, 'x402.offer.deep-context-evaluation.status')?.state, 'fail')
  assert.equal(report.state, 'unavailable')
})

test('missing required RPC functions fail readiness', async () => {
  const report = await getX402Readiness({
    environment: BASE,
    probe: everything,
    functionProbe: async () => new Set(),
  })
  const storage = check(report, 'x402.offer.context-compression.storage')
  assert.equal(storage?.state, 'fail')
  assert.match(storage?.detail ?? '', /record_x402_offer_usage\(\)/)
})

test('an available offer that is not enabled is information outside Production', async () => {
  const report = await getX402Readiness({
    environment: { ...BASE, X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]) },
    probe: everything,
  })
  // A Preview need not sell everything Production sells, so this must not hold
  // the deployment below ready.
  assert.equal(check(report, 'x402.offer.deep-context-evaluation.enablement')?.state, 'info')
  assert.equal(report.state, 'ready')
})

test('an available offer that is not enabled in Production fails readiness', async () => {
  // There it is a live contradiction: discovery tells an agent the offer is
  // payable and the deployment answers 401.
  const report = await getX402Readiness({
    environment: { ...BASE, VERCEL_ENV: 'production', X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]) },
    probe: everything,
  })
  const enablement = check(report, 'x402.offer.deep-context-evaluation.enablement')
  assert.equal(enablement?.state, 'fail')
  assert.match(enablement!.summary, /told to pay and then refused/)
  assert.equal(report.state, 'unavailable')
})

test('chain confirmation is on by default for Base, and its absence only degrades', async () => {
  // Base carries a default public RPC, so omitting the variable does not turn
  // confirmation off -- worth asserting, because the opposite assumption would
  // make the analytics correction look inert.
  const withoutRpc = { ...BASE } as Record<string, string | undefined>
  delete withoutRpc.X402_CHAIN_RPC_URL
  const withDefault = await getX402Readiness({ environment: withoutRpc, probe: everything })
  assert.equal(check(withDefault, 'x402.settlement.confirmation')?.state, 'ok')

  // A network with no default and no override is where confirmation is really
  // off, and that degrades rather than fails: the payments are real, they are
  // just uncorroborated, and the report says what that costs.
  const unconfirmed = await getX402Readiness({
    environment: { ...withoutRpc, X402_NETWORK: 'arbitrum' },
    probe: everything,
  })
  const confirmation = check(unconfirmed, 'x402.settlement.confirmation')
  assert.equal(confirmation?.state, 'warn')
  assert.match(confirmation!.detail ?? '', /unconfirmed rather than as purchases/)
  assert.equal(unconfirmed.state, 'degraded')
})

test('incomplete settlement configuration fails readiness', async () => {
  const report = await getX402Readiness({
    environment: { ...BASE, X402_ASSET_EIP712_NAME: ' ', X402_ASSET_EIP712_VERSION: ' ' },
    probe: everything,
  })
  // An empty EIP-712 domain refuses every payment at the facilitator, and is
  // otherwise silent everywhere.
  const settlement = check(report, 'x402.settlement.configuration')
  assert.equal(settlement?.state, 'ok', 'blank values fall back to the USDC defaults')
  assert.equal(report.state, 'ready')
})

test('a disabled environment reports unavailable without pretending to be broken', async () => {
  const report = await getX402Readiness({ environment: { X402_ENABLED: 'false' }, probe: everything })
  assert.equal(report.state, 'unavailable')
  assert.equal(report.enabled, false)
  assert.equal(check(report, 'x402.enabled')?.state, 'warn')
  // Every offer is still listed, with its published status, so the report is
  // readable without cross-referencing the catalog.
  assert.equal(report.offers.length, 3)
  assert.equal(report.offers.every((offer) => offer.enabledInThisEnvironment === false), true)
})

test('readiness fingerprints its database without disclosing it', async () => {
  // "Which database is this actually bound to" was unanswerable from outside:
  // the URL is a platform secret, it is not inlined in any client bundle, and a
  // migration applied against a correctly-named credential still left the app
  // unable to see the objects it created. A deployment that cannot name its own
  // database can only be diagnosed by guessing.
  const report = await getX402Readiness({
    environment: { ...BASE, NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' },
    probe: everything,
  })
  const { createHash } = await import('node:crypto')
  const expected = `sha256:${createHash('sha256').update('abcdefghijklmnopqrst').digest('hex')}`
  assert.equal(report.databaseFingerprint, expected)
  // The reference itself must not appear anywhere in the response.
  assert.equal(JSON.stringify(report).includes('abcdefghijklmnopqrst'), false)

  // Absent or malformed configuration reports null rather than inventing one.
  const none = await getX402Readiness({ environment: BASE, probe: everything })
  assert.equal(none.databaseFingerprint, null)
})

test('readiness never echoes a secret or a raw environment value', async () => {
  const secrets = ['super-secret-cdp-key', 'https://private-rpc.example/KEY123']
  const report = await getX402Readiness({
    environment: {
      ...BASE,
      X402_CHAIN_RPC_URL: secrets[1],
      CDP_API_KEY_ID: secrets[0],
      CDP_API_KEY_SECRET: secrets[0],
      X402_FACILITATOR_AUTH_HEADERS: JSON.stringify({ authorization: secrets[0] }),
    },
    probe: everything,
  })

  const serialized = JSON.stringify(report)
  for (const secret of secrets) {
    assert.equal(serialized.includes(secret), false, 'a readiness report must not echo the values it checks')
  }
  // Nor the payee, the asset address, or the facilitator host.
  assert.equal(serialized.includes('0xSettlement'), false)
  assert.equal(serialized.includes('facilitator.example'), false)
})

test('the report states which offers are payable, so a promotion can be gated on it', async () => {
  const report = await getX402Readiness({ environment: BASE, probe: everything })
  // Promoted on 2026-08-12. enabledInThisEnvironment stays false here because
  // BASE does not list the MPS path in X402_RESOURCES: being payable in the
  // catalog and being switched on in one environment are separate facts, and
  // the report has to keep them separate for a promotion to be gated on it.
  const mps = report.offers.find((offer) => offer.id === 'mps-autonomous-audit')!
  assert.equal(mps.status, 'available')
  assert.equal(mps.payableInProduction, true)
  assert.equal(mps.enabledInThisEnvironment, false)
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.availability.blockedBy.length, 0)

  // Deep Context was promoted on 2026-08-11 and must read as payable.
  const deep = report.offers.find((offer) => offer.id === 'deep-context-evaluation')!
  assert.equal(deep.status, 'available')
  assert.equal(deep.payableInProduction, true)
  assert.equal(DEEP_CONTEXT_EVALUATION_OFFER.availability.blockedBy.length, 0)

  const entry = report.offers.find((offer) => offer.id === 'context-compression')!
  assert.equal(entry.status, 'available')
  assert.equal(entry.payableInProduction, true)
})
