import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const script = await readFile(new URL('../scripts/run-x402-trust-report-canary.ts', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/production-x402-canary.yml', import.meta.url), 'utf8')

test('Claim Triage trust diagnostic is fixed to one exact 0.005 USDC purchase', () => {
  assert.match(script, /const SUBJECT = 'https:\/\/www\.mahastrategies\.com\/api\/v1\/mps\/audit'/)
  assert.match(script, /const AMOUNT = '5000'/)
  assert.match(script, /const NETWORK = 'eip155:8453'/)
  assert.match(script, /challengeCount !== 1 \|\| signatureCount !== 1/)
  assert.match(script, /X402_TRUST_REPORT_CONFIRMATION/)
})

test('response bytes are persisted before response assertions and settlement confirmation', () => {
  const capture = script.indexOf('await captureResponseBody(response, responsePath)')
  assert.ok(capture >= 0)
  assert.ok(capture < script.indexOf("if (response.status !== 200)"))
  assert.ok(capture < script.indexOf('await confirmSettlement('))
})

test('protected workflow uploads evidence even if verification fails', () => {
  assert.match(workflow, /purchase-claim-triage-trust-report:/)
  assert.match(workflow, /X402_TRUST_REPORT_CONFIRMATION:/)
  assert.match(workflow, /if: always\(\)[\s\S]*name: x402-trust-report-canary-/)
})
