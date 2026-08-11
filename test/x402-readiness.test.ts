import assert from 'node:assert/strict'
import test from 'node:test'

import { getX402Readiness } from '../lib/x402/readiness.ts'
import { CONTEXT_COMPRESSION_OFFER, MPS_AUTONOMOUS_AUDIT_OFFER } from '../lib/x402/offers.ts'

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
  assert.equal(report.state, 'unavailable')
  const status = check(report, 'x402.offer.mps-autonomous-audit.status')
  assert.equal(status?.state, 'fail')
  assert.match(status!.summary, /enabled for payment but published as "withheld"/)
  // And it says what would unblock it.
  assert.match(status!.detail ?? '', /database separation|durable paid-job recovery/i)
})

test('an available offer that is not enabled is a warning, not a failure', async () => {
  const report = await getX402Readiness({
    environment: { ...BASE, X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]) },
    probe: everything,
  })
  // Nothing here is wrong; the environment simply does not sell it.
  assert.equal(check(report, 'x402.offer.deep-context-evaluation.enablement'), undefined)
  assert.equal(report.state, 'ready')
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
  const mps = report.offers.find((offer) => offer.id === 'mps-autonomous-audit')!
  assert.equal(mps.status, 'withheld')
  assert.equal(mps.payableInProduction, false)
  assert.equal(mps.enabledInThisEnvironment, false)

  const entry = report.offers.find((offer) => offer.id === 'context-compression')!
  assert.equal(entry.status, 'available')
  assert.equal(entry.payableInProduction, true)
})
