import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  captureResponseBody,
  parseCapturedJson,
  prepareEvidenceDirectories,
  writeCaptureRecord,
} from '../lib/x402/canary-response-capture.ts'

/**
 * The evidence a paid canary is allowed to lose: none of it.
 *
 * The NSGoods canary spends 0.015 USDC of real money on one call. It used to
 * parse the answer and check the status, the balance delta and the settlement
 * receipt before writing anything, so any of those failing -- after the money
 * had already moved -- left the `if: always()` artifact upload with nothing to
 * upload. The only way to see what was bought was to buy it again.
 *
 * These tests fix the order: the bytes that arrived reach disk first, exactly
 * as received, and the judging happens afterwards. Nothing here makes a
 * network request, signs anything, or spends anything; every response is
 * constructed in memory.
 */

const ROOT = resolve(import.meta.dirname, '..')
const SCRIPT = readFileSync(resolve(ROOT, 'scripts/run-nsgoods-preflight-live-canary.ts'), 'utf8')
const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/production-nsgoods-preflight-canary.yml'), 'utf8')

const ENDPOINT =
  'https://x402.nsgoods.org/preflight?address=0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28&chain=eip155:8453&role=payee'

// Payment authorization material. It exists in this file only so the tests can
// prove it never reaches a file that gets uploaded. None of it is real.
const PAYMENT_SIGNATURE = `0x${'ab'.repeat(65)}`
const BUYER_PRIVATE_KEY = `0x${'7c'.repeat(32)}`
const AUTHORIZATION_NONCE = `0x${'f3'.repeat(32)}`
const PAYMENT_HEADER = Buffer.from(
  JSON.stringify({ signature: PAYMENT_SIGNATURE, authorization: { nonce: AUTHORIZATION_NONCE } }),
).toString('base64')

// Shaped and formatted the way the provider actually answers: one-space
// indentation from Python's `json.dumps(indent=1)`, and `ensure_ascii` escapes
// rather than literal characters. `JSON.stringify(parsed, null, 2)` reproduces
// neither, which is the whole reason the received bytes have to be kept.
const CAPTURE_MARKER = 'nsgoods-capture-marker'
const PROVIDER_BODY = [
  '{',
  ' "schema_version": "preflight_v3",',
  ' "request": {',
  '  "request_id": "pf_dc870bb380895fb0",',
  '  "subject": {',
  '   "address": "0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28",',
  '   "chain": "eip155:8453",',
  '   "role": "payee"',
  '  }',
  ' },',
  ' "components_evaluated": 3,',
  ` "note": "${CAPTURE_MARKER} r\\u00e9sum\\u00e9"`,
  '}',
].join('\n')

function evidenceDirectory() {
  const dir = mkdtempSync(join(tmpdir(), 'nsgoods-capture-'))
  return {
    dir,
    responsePath: join(dir, 'live-response.json'),
    capturePath: join(dir, 'response-capture.json'),
    evidencePath: join(dir, 'payment-evidence.json'),
  }
}

/** A settled provider response, carrying the payment material a real one does. */
function paidResponse(body: string, status = 200) {
  return new Response(new TextEncoder().encode(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'PAYMENT-SIGNATURE': PAYMENT_HEADER,
      'PAYMENT-RESPONSE': Buffer.from(JSON.stringify({ success: true, transaction: '0xfeed' })).toString('base64'),
    },
  })
}

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')

/* ------------------------------------------- persist before you judge it -- */

test('the received bytes are already on disk when the body is first parsed', async () => {
  const { responsePath } = evidenceDirectory()

  // The ordering claim is checked where it actually matters: at the moment the
  // JSON is parsed, the file has to already hold the bytes.
  const realParse = JSON.parse
  let onDiskAtParse: string | null = null
  JSON.parse = ((text: string, reviver?: Parameters<typeof realParse>[1]) => {
    if (onDiskAtParse === null && typeof text === 'string' && text.includes(CAPTURE_MARKER)) {
      onDiskAtParse = existsSync(responsePath) ? readFileSync(responsePath, 'utf8') : ''
    }
    return realParse(text, reviver)
  }) as typeof JSON.parse

  try {
    const captured = await captureResponseBody(paidResponse(PROVIDER_BODY), responsePath)
    const parsed = parseCapturedJson(captured)
    assert.equal((parsed.request as Record<string, unknown>).request_id, 'pf_dc870bb380895fb0')
  } finally {
    JSON.parse = realParse
  }

  assert.equal(onDiskAtParse, PROVIDER_BODY, 'the exact bytes must be persisted before anything parses them')
})

test('the body is consumed once and never read from the response a second time', async () => {
  const { responsePath } = evidenceDirectory()
  const response = paidResponse(PROVIDER_BODY)

  const captured = await captureResponseBody(response, responsePath)

  assert.equal(response.bodyUsed, true, 'the single read has to be the capture')
  await assert.rejects(() => response.text(), 'a spent stream must not be readable again')
  // Parsing works anyway, because it works off the captured bytes.
  assert.equal(parseCapturedJson(captured).components_evaluated, 3)
})

test('a malformed paid response is persisted byte for byte and still fails the run', async () => {
  const { responsePath } = evidenceDirectory()
  const truncated = `{"schema_version": "preflight_v3", "components": [{"component": "payability"`

  const captured = await captureResponseBody(paidResponse(truncated), responsePath)

  assert.deepEqual(readFileSync(responsePath), Buffer.from(truncated, 'utf8'))
  assert.equal(captured.sha256, sha256(Buffer.from(truncated, 'utf8')))
  assert.throws(
    () => parseCapturedJson(captured),
    (error: Error) => error.message.includes('not valid JSON') && error.message.includes(responsePath),
    'the run must fail, and say where the bytes that failed it are',
  )
})

test('a well-formed body that is not an object is persisted and still refused', async () => {
  const { responsePath } = evidenceDirectory()
  const notAnObject = '"maintenance"'

  const captured = await captureResponseBody(paidResponse(notAnObject), responsePath)

  assert.deepEqual(readFileSync(responsePath), Buffer.from(notAnObject, 'utf8'))
  assert.throws(() => parseCapturedJson(captured), /not a JSON object/)
})

test('a later settlement invariant failure cannot take the response with it', async () => {
  const { dir, responsePath, capturePath, evidencePath } = evidenceDirectory()
  await prepareEvidenceDirectories(responsePath, capturePath, evidencePath)

  // The canary's post-response order, with the balance check failing the way it
  // would after the money had already moved.
  await assert.rejects(async () => {
    const captured = await captureResponseBody(paidResponse(PROVIDER_BODY), responsePath)
    await writeCaptureRecord(captured, capturePath, ENDPOINT)
    parseCapturedJson(captured)
    throw new Error('Expected a 15000 base-unit debit; observed 0.')
  }, /15000 base-unit debit/)

  assert.deepEqual(readFileSync(responsePath), Buffer.from(PROVIDER_BODY, 'utf8'))
  assert.ok(existsSync(capturePath), 'the sanitized attempt record must survive the failure too')
  assert.ok(!existsSync(evidencePath), 'a failed run must not leave payment evidence claiming success')
  assert.deepEqual(readdirSync(dir).sort(), ['live-response.json', 'response-capture.json'])
})

test('an unexpected status is persisted before the status is judged', async () => {
  const { responsePath } = evidenceDirectory()
  const refusal = '{"error": "signing_unavailable"}'

  const captured = await captureResponseBody(paidResponse(refusal, 503), responsePath)

  assert.equal(captured.status, 503)
  assert.deepEqual(readFileSync(responsePath), Buffer.from(refusal, 'utf8'))
})

/* --------------------------------------------------- the digest and mode -- */

test('the digest is taken over the persisted bytes, not a re-serialization', async () => {
  const { responsePath } = evidenceDirectory()

  const captured = await captureResponseBody(paidResponse(PROVIDER_BODY), responsePath)

  const onDisk = readFileSync(responsePath)
  assert.deepEqual(onDisk, captured.bytes)
  assert.equal(captured.sha256, sha256(onDisk), 'the digest has to be recomputable from the file alone')

  // What the old code hashed. It has to be a different file and a different
  // digest, or this test would pass without proving anything.
  const reserialized = `${JSON.stringify(JSON.parse(PROVIDER_BODY), null, 2)}\n`
  assert.notEqual(onDisk.toString('utf8'), reserialized)
  assert.notEqual(captured.sha256, sha256(reserialized))
})

test('the persisted response and attempt record keep the 0600 mode', async () => {
  const { responsePath, capturePath } = evidenceDirectory()

  const captured = await captureResponseBody(paidResponse(PROVIDER_BODY), responsePath)
  await writeCaptureRecord(captured, capturePath, ENDPOINT)

  for (const path of [responsePath, capturePath]) {
    assert.equal(statSync(path).mode & 0o777, 0o600, `${path} must stay owner-only`)
  }
})

test('the evidence directory exists before a response ever arrives', async () => {
  const { dir, responsePath, capturePath, evidencePath } = evidenceDirectory()
  const nested = join(dir, 'nsgoods-preflight', 'live-response.json')

  await prepareEvidenceDirectories(nested, responsePath, capturePath, evidencePath)

  assert.ok(existsSync(join(dir, 'nsgoods-preflight')), 'the upload needs somewhere to look even if the run dies')
  assert.deepEqual(readdirSync(join(dir, 'nsgoods-preflight')), [])
})

/* ------------------------------------------------- nothing secret leaks -- */

test('no payment signature, buyer key or raw nonce reaches the persisted evidence', async () => {
  const { dir, responsePath, capturePath } = evidenceDirectory()
  process.env.NSGOODS_CAPTURE_TEST_KEY = BUYER_PRIVATE_KEY

  try {
    const captured = await captureResponseBody(paidResponse(PROVIDER_BODY), responsePath)
    await writeCaptureRecord(captured, capturePath, ENDPOINT)

    const files = readdirSync(dir)
    assert.deepEqual(files.sort(), ['live-response.json', 'response-capture.json'])
    for (const name of files) {
      const text = readFileSync(join(dir, name), 'utf8')
      for (const secret of [PAYMENT_SIGNATURE, BUYER_PRIVATE_KEY, AUTHORIZATION_NONCE, PAYMENT_HEADER]) {
        assert.ok(!text.includes(secret), `${name} must not carry payment authorization material`)
      }
      assert.ok(!/payment-signature/i.test(text), `${name} must not carry a payment header`)
      assert.ok(!text.includes('NSGOODS_CAPTURE_TEST_KEY'), `${name} must not carry environment values`)
    }

    // The record is built from a fixed field set, so nothing observed can ride
    // along into it.
    const record = JSON.parse(readFileSync(capturePath, 'utf8')) as Record<string, unknown>
    assert.deepEqual(Object.keys(record).sort(), [
      'byteLength', 'capturedAt', 'endpoint', 'httpStatus', 'responseFile', 'responseSha256', 'schemaVersion',
    ])
    assert.equal(record.responseSha256, captured.sha256)
    assert.equal(record.byteLength, Buffer.byteLength(PROVIDER_BODY, 'utf8'))
    assert.equal(record.responseFile, 'live-response.json')
    assert.equal(record.httpStatus, 200)
  } finally {
    delete process.env.NSGOODS_CAPTURE_TEST_KEY
  }
})

/* ----------------------------------------------- the canary's own order -- */

test('the canary persists the paid response before it judges anything', () => {
  const at = (needle: string) => {
    const index = SCRIPT.indexOf(needle)
    assert.notEqual(index, -1, `the canary no longer contains ${needle}`)
    return index
  }

  assert.ok(at('await prepareEvidenceDirectories(') < at('await paidFetch(ENDPOINT'), 'the directory precedes the payment')
  const capture = at('await captureResponseBody(response, responsePath)')
  assert.ok(at('await paidFetch(ENDPOINT') < capture, 'capture is the first thing done with the response')

  for (const laterCheck of [
    'if (challengeCount !== 1 || signatureCount !== 1)',
    'if (captured.status !== 200)',
    'const body = parseCapturedJson(captured)',
    'const afterBalance = await balanceOf(account.address)',
    'if (debited !== BigInt(EXPECTED_AMOUNT))',
    'settlement.success !== true',
    'await writeFile(evidencePath',
  ]) {
    assert.ok(capture < at(laterCheck), `${laterCheck} must run only after the bytes are persisted`)
  }
})

test('the canary neither re-reads the response nor rebuilds it', () => {
  assert.ok(!SCRIPT.includes('response.json()'), 'the stream must not be read a second time')
  assert.ok(!SCRIPT.includes('JSON.stringify(body'), 'the persisted response must not be a re-serialization')
  assert.ok(SCRIPT.includes('responseSha256: captured.sha256'), 'the digest must come from the persisted bytes')
  assert.ok(SCRIPT.includes('mode: 0o600'), 'the payment evidence must stay owner-only')
})

test('the artifact upload and payment cardinality protections are intact', () => {
  const upload = WORKFLOW.slice(WORKFLOW.indexOf('Upload bounded canary evidence'))
  assert.ok(upload.includes('if: always()'), 'evidence must upload on a failed run')
  assert.ok(upload.includes('if-no-files-found: warn'), 'the upload guard must not be weakened')
  assert.ok(upload.includes('path: ${{ runner.temp }}/nsgoods-preflight'), 'the whole evidence directory must upload')

  assert.ok(WORKFLOW.includes("= 'PAY NSGOODS PREFLIGHT 0.015 USDC'"), 'the human confirmation gate must stay')
  assert.ok(WORKFLOW.includes('--validate-config'), 'the unpaid preflight validation must stay')
  assert.equal(WORKFLOW.match(/run-nsgoods-preflight-live-canary\.ts(?!\s+--validate-config)/g)?.length, 1,
    'exactly one paid invocation may exist')

  assert.ok(SCRIPT.includes('Refused more than one payment challenge'), 'one challenge only')
  assert.ok(SCRIPT.includes('Refused more than one payment signature'), 'one signature only')
  assert.ok(SCRIPT.includes("ENDPOINT = `https://x402.nsgoods.org/preflight?address=${SUBJECT}"), 'the endpoint is fixed')
  assert.ok(SCRIPT.includes("EXPECTED_AMOUNT = '15000'"), 'the price is fixed')
})
