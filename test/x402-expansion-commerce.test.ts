import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { SPECS, buildCommerceExpansion } from '../lib/x402/expansion-commerce.ts'
import { schemaAccepts, type MicroSchema } from '../lib/x402/micro-schema.ts'

type Product = keyof typeof SPECS
type Row = Record<string, unknown>
type Check = { id: string; codes: string[] }
const rows = (value: unknown) => value as Row[]
const checks = (value: Row) => value.checks as Check[]
const issues = (value: Row) => value.issues as Check[]
const byteLength = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8')
const sample = (id: Product) => structuredClone(SPECS[id].sample) as Record<string, unknown>
const run = (id: Product, input = sample(id)) => {
  assert.equal(schemaAccepts(SPECS[id].inputSchema, input), true)
  const result = buildCommerceExpansion(id, input)!
  assert.ok(result)
  assert.equal(schemaAccepts(SPECS[id].resultSchema, result), true, JSON.stringify(result))
  assert.ok(byteLength(result) <= 65536)
  return result
}
test('all eight commerce fixtures have closed contracts, bounded results and no external calls', () => {
  assert.equal(Object.keys(SPECS).length, 8)
  for (const id of Object.keys(SPECS) as Product[]) {
    run(id)
    assert.equal(schemaAccepts(SPECS[id].inputSchema, { ...sample(id), password: 'never-accepted' }), false)
    assert.equal(schemaAccepts(SPECS[id].inputSchema, { ...sample(id), dataClass: 'private' }), false)
  }
  assert.equal(buildCommerceExpansion('unknown', {}), null)
})
test('argument validation checks required, extra, type and bound violations without executing values', () => {
  const id = 'tool-argument-validation', input = sample(id)
  input.arguments = [{ name: 'count', valueJson: '11' }, { name: 'unknown', valueJson: '"process.exit()"' }]
  const result = run(id, input)
  assert.equal(result.consistent, false)
  assert.deepEqual(result.checks, [{ id: 'count', codes: ['outside-bounds'] }, { id: 'unknown', codes: ['unknown-argument'] }])
  input.arguments = []; assert.equal(checks(run(id, input))[0].codes[0], 'required-argument-missing')
  input.arguments = [{ name: 'count', valueJson: '1.2' }]; assert.deepEqual(checks(run(id, input))[0].codes, ['type-mismatch'])
  input.arguments = [{ name: 'count', valueJson: 'NaN' }]; assert.ok(checks(run(id, input))[0].codes.includes('invalid-json'))
  input.arguments = [{ name: 'count', valueJson: '1' }, { name: 'count', valueJson: '2' }]
  assert.throws(() => buildCommerceExpansion(id, input), /duplicate/)
})
test('workflow graph refuses a topological order for cycles, duplicates or missing steps', () => {
  const id = 'workflow-dependency-validation', input = sample(id)
  assert.deepEqual(run(id).order, ['fetch', 'review'])
  input.steps = [{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }]
  assert.equal(run(id, input).valid, false); assert.deepEqual(run(id, input).order, [])
  input.steps = [{ id: 'a', dependsOn: ['missing'] }]
  assert.ok(issues(run(id, input)).some(x => x.codes.includes('missing-dependency')))
  input.steps = [{ id: 'a', dependsOn: [] }, { id: 'a', dependsOn: [] }]
  assert.equal(run(id, input).valid, false)
})
test('spending policy preserves exact totals and never approves a payment', () => {
  const id = 'buyer-spending-policy-check', input = sample(id)
  input.budgetBaseUnits = '9000'
  const result = run(id, input)
  assert.equal(result.totalBaseUnits, '10000'); assert.equal(result.budgetExceeded, true); assert.equal(result.executionAuthorized, false)
  input.budgetBaseUnits = '9999999999999999'; input.perCallCapBaseUnits = '9999999999999999'
  const c = rows(input.calls)[0]; c.amountBaseUnits = '9007199254740993'
  assert.equal(run(id, input).totalBaseUnits, '9007199254740993')
  c.humanApproved = false; assert.ok(checks(run(id, input))[0].codes.includes('declared-approval-missing'))
})
test('Ed25519 verification independently verifies exact UTF-8 bytes and rejects tampering', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519'), message = 'Synthetic signed receipt — €'
  const key = publicKey.export({ format: 'der', type: 'spki' }) as Buffer
  const input = { dataClass: 'synthetic', encoding: 'exact-utf8', message, publicKeyBase64: key.subarray(-32).toString('base64'), signatureBase64: sign(null, Buffer.from(message), privateKey).toString('base64') }
  assert.equal(run('signed-receipt-verification', input).signatureValid, true)
  assert.equal(run('signed-receipt-verification', { ...input, message: message + '!' }).signatureValid, false)
  assert.equal(schemaAccepts(SPECS['signed-receipt-verification'].inputSchema, { ...input, privateKey: 'forbidden' }), false)
})
test('challenge checks detect substitution, insecure URLs and a changed price', () => {
  const id = 'x402-challenge-sanity', input = sample(id), c = input.challenge as Row
  c.resourceUrl = 'http://example.org/result'; c.amountBaseUnits = '10001'; c.version = 1
  const result = run(id, input)
  assert.equal(result.consistent, false)
  for (const code of ['unsafe-resource-url', 'resource-mismatch', 'price-ceiling-exceeded', 'unsupported-version']) assert.ok((result.issues as string[]).includes(code))
})
test('reconciliation finds missing delivery, duplicate IDs and reused transactions', () => {
  const id = 'settlement-delivery-reconciliation', input = sample(id)
  input.deliveries = []; assert.deepEqual(checks(run(id, input))[0].codes, ['delivery-missing'])
  input.settlements = [...rows(input.settlements), ...rows(input.settlements).map(r => ({ ...r, id: 'request-2' }))]
  const result = run(id, input)
  assert.equal(result.settledBaseUnits, '0'); assert.ok(checks(result).every(x => x.codes.includes('transaction-reused-across-requests')))
})
test('idempotency audit identifies changed intent, double settlement and uncertainty', () => {
  const id = 'idempotency-trace-audit', input = sample(id), r = rows(input.attempts)[0]
  input.attempts = [r, { ...r, id: 'attempt-2', inputDigest: 'sha256:' + 'b'.repeat(64), transaction: '0x' + '3'.repeat(64), state: 'unknown' }]
  const result = run(id, input)
  assert.equal(result.automaticallyRetry, false)
  for (const code of ['idempotency-intent-changed', 'multiple-transactions-for-key']) assert.ok(checks(result)[0].codes.includes(code))
  assert.ok(checks(result)[1].codes.includes('outcome-ambiguous-inspect-before-retry'))
})
test('unknown licensing stays undetermined and declared permissions do not grant rights', () => {
  const id = 'machine-license-permission-match', input = sample(id)
  input.requestedUses = [{ id: 'training', use: 'train' }]
  assert.equal(rows(run(id, input).checks)[0].state, 'outside-declaration')
  input.policyStatus = 'unknown'; input.allowedUses = []
  const result = run(id, input)
  assert.equal(rows(result.checks)[0].state, 'undetermined'); assert.equal(result.rightsGranted, false)
})

const allProducts = Object.keys(SPECS) as Product[]
const digest = (digit = 'a') => `sha256:${digit.repeat(64)}`
const transaction = (value: number) => `0x${value.toString(16).padStart(64, '0')}`
const maxAmount = '9999999999999999'
const maximumTotal = (count: number) => (BigInt(maxAmount) * BigInt(count)).toString()
const longId = (prefix: string, index: number) => `${prefix}-${index}`.padEnd(80, 'x')
const rejected = (id: Product, changes: Row) => assert.throws(() => buildCommerceExpansion(id, { ...sample(id), ...changes }), /commerce-input-schema/)
const ledger = (prefix: string, count: number, txOffset = 0, longNames = false) => Array.from({ length: count }, (_, j) => ({ id: longNames ? longId(prefix, j) : `${prefix}-${j}`, resource: longNames ? longId('resource', j) : `resource-${j}`, transaction: transaction(j + txOffset), amountBaseUnits: maxAmount }))
const deliveries = (settlements: Row[]): Row[] => settlements.map(s => ({ ...s, responseDigest: digest() }))

test('known builders validate closed contracts before coercion; unknown IDs remain null', () => {
  for (const id of allProducts) {
    const original = sample(id), before = structuredClone(original), result = run(id, original)
    assert.deepEqual(original, before); assert.deepEqual(run(id, original), result)
    assert.ok(SPECS[id].description.length <= 500)
    for (const dataClass of ['private', 'participant', null, 1]) rejected(id, { dataClass })
    for (const key of Object.keys(original)) { const missing = { ...original }; delete missing[key]; assert.throws(() => buildCommerceExpansion(id, missing), /commerce-input-schema/) }
    rejected(id, { secret: 'not-a-real-secret' })
    assert.equal(schemaAccepts(SPECS[id].resultSchema, { ...result, injected: true }), false)
    for (const key of Object.keys(result)) { const missing = { ...result }; delete missing[key]; assert.equal(schemaAccepts(SPECS[id].resultSchema, missing), false) }
  }
  for (const id of ['unknown', '__proto__', 'constructor', 'toString']) assert.equal(buildCommerceExpansion(id, {}), null)
  let invoked = false
  const coercion = { valueOf() { invoked = true; return 1 }, toString() { invoked = true; return '1' } }
  rejected('tool-argument-validation', { fields: [{ name: 'count', type: 'integer', required: true, minimum: coercion, maximum: 10, maxLength: 80 }] })
  rejected('tool-argument-validation', { arguments: [{ name: 'count', valueJson: coercion }] })
  rejected('buyer-spending-policy-check', { budgetBaseUnits: coercion })
  assert.equal(invoked, false)
})

test('schemas are recursively closed/bounded and commerce source has no BigInt literals or external calls', () => {
  const inspect = (schema: MicroSchema): void => {
    if (schema.oneOf) { schema.oneOf.forEach(inspect); return }
    if (schema.type === 'object') { assert.equal(schema.additionalProperties, false); assert.deepEqual(schema.required, Object.keys(schema.properties!)); Object.values(schema.properties!).forEach(inspect) }
    if (schema.type === 'array') { assert.ok(schema.minItems! >= 0 && schema.maxItems! <= 128); inspect(schema.items!) }
    if (schema.type === 'integer') { assert.ok(Number.isSafeInteger(schema.minimum)); assert.ok(Number.isSafeInteger(schema.maximum)) }
    if (schema.type === 'string') assert.ok(schema.enum?.length || (schema.maxLength! <= 8000 && schema.pattern))
  }
  for (const id of allProducts) { inspect(SPECS[id].inputSchema); inspect(SPECS[id].resultSchema) }
  const source = readFileSync(new URL('../lib/x402/expansion-commerce.ts', import.meta.url), 'utf8')
  const testSource = readFileSync(new URL('./x402-expansion-commerce.test.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\b(?:0[xob][0-9a-f_]+|[0-9][0-9_]*)n\b/i)
  assert.doesNotMatch(testSource, /\b(?:0[xob][0-9a-f_]+|[0-9][0-9_]*)n\b/i)
  assert.doesNotMatch(source, /\b(?:fetch|eval|Function|Date\.now|Math\.random)\s*\(|process\.env/)
})

test('tool integer checks preserve exact JSON values instead of accepting rounded fractions or underflow', () => {
  const id = 'tool-argument-validation', fields = [{ name: 'n', type: 'integer', required: true, minimum: -1000000, maximum: 1000000, maxLength: 1024 }]
  for (const valueJson of ['1', '1.0', '1e2', '-0', '-10', '100e-2', '0.1e1', '0.000001e6', '1e0000000000000000001', '0e999999999999999999999', '0.0000e-999999']) {
    assert.equal(run(id, { ...sample(id), fields, arguments: [{ name: 'n', valueJson }] }).consistent, true, valueJson)
  }
  for (const valueJson of ['1.0000000000000000001', '999999.999999999999999', '1.9999999999999999999', '1e-9999', '-1e-9999', '1e309', '9007199254740993', 'null', '[]', '{}', 'true', '"1"']) {
    assert.deepEqual(checks(run(id, { ...sample(id), fields, arguments: [{ name: 'n', valueJson }] }))[0].codes, ['type-mismatch'], valueJson)
  }
  for (const valueJson of ['NaN', 'Infinity', '01', 'undefined', '(() => process.exit())()', '{"$ref":"https://invalid.example/"']) {
    assert.ok(checks(run(id, { ...sample(id), fields, arguments: [{ name: 'n', valueJson }] }))[0].codes.includes('invalid-json'))
  }
  const outside = run(id, { ...sample(id), fields, arguments: [{ name: 'n', valueJson: '9007199254740991' }] })
  assert.deepEqual(checks(outside)[0].codes, ['outside-bounds'])
})

test('malicious scalar JSON and tool contract fields cannot execute, pollute prototypes or expand the contract', () => {
  const id = 'tool-argument-validation', field = { name: 'constructor', type: 'string', required: true, minimum: 0, maximum: 1, maxLength: 1024 }
  for (const valueJson of ['{"__proto__":{"polluted":true}}', '{"constructor":{"prototype":{"polluted":true}}}', '["command"]', 'false', 'null']) {
    assert.equal(run(id, { ...sample(id), fields: [field], arguments: [{ name: field.name, valueJson }] }).consistent, false)
    assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false)
  }
  assert.equal(run(id, { ...sample(id), fields: [field], arguments: [{ name: field.name, valueJson: '"process.exit(); fetch(\\"https://invalid.example\\")"' }] }).consistent, true)
  const emoji = { ...field, maxLength: 1 }
  assert.equal(run(id, { ...sample(id), fields: [emoji], arguments: [{ name: field.name, valueJson: JSON.stringify('😀') }] }).consistent, true)
  for (const value of ['😀😀', 'a\n', '\u0000', '\u007f']) assert.ok(checks(run(id, { ...sample(id), fields: [emoji], arguments: [{ name: field.name, valueJson: JSON.stringify(value).replace(/\u007f/gu, '\\u007f') }] }))[0].codes.includes('string-outside-contract'))
  rejected(id, { fields: [{ ...field, pattern: '.*' }] }); rejected(id, { fields: [{ ...field, $ref: 'https://invalid.example/' }] })
  rejected(id, { fields: [{ ...field, type: 'function' }] }); rejected(id, { fields: [{ ...field, minimum: Number.MAX_SAFE_INTEGER + 1 }] })
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), fields: [{ ...field, minimum: 1, maximum: 0 }] }), /inverted-bounds/)
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), fields: [field, field] }), /duplicate-identifier/)
  const boolean = { ...field, type: 'boolean' }
  assert.equal(run(id, { ...sample(id), fields: [boolean], arguments: [{ name: field.name, valueJson: 'false' }] }).consistent, true)
  assert.equal(run(id, { ...sample(id), fields: [{ ...field, required: false }], arguments: [] }).consistent, true)
})

test('full tool boundary returns all 32 missing plus 32 distinct unknown argument checks', () => {
  const id = 'tool-argument-validation', fields = Array.from({ length: 32 }, (_, j) => ({ name: longId('field', j), type: 'integer', required: true, minimum: -1000000, maximum: 1000000, maxLength: 1024 }))
  const args = Array.from({ length: 32 }, (_, j) => ({ name: longId('unknown', j), valueJson: '"' + 'x'.repeat(1098) + '"' }))
  const result = run(id, { ...sample(id), fields, arguments: args })
  assert.equal(checks(result).length, 64); assert.equal(result.consistent, false)
  assert.ok(checks(result).slice(0, 32).every(c => c.codes[0] === 'required-argument-missing'))
  assert.ok(checks(result).slice(32).every(c => c.codes[0] === 'unknown-argument'))
  rejected(id, { fields: [...fields, { ...fields[0], name: 'extra' }] })
})

test('64 invalid workflow steps aggregate issues per ID without overflowing output limits', () => {
  const id = 'workflow-dependency-validation', steps = Array.from({ length: 64 }, (_, j) => ({ id: longId('step', j), dependsOn: Array.from({ length: 16 }, (_, k) => longId('missing', k)) }))
  const result = run(id, { ...sample(id), steps })
  assert.equal(result.valid, false); assert.deepEqual(result.order, []); assert.equal(issues(result).length, 64)
  assert.ok(issues(result).every(c => c.codes.includes('missing-dependency') && c.codes.includes('cycle-or-unresolved-dependency')))
  const duplicate = run(id, { ...sample(id), steps: Array(64).fill({ id: 'same', dependsOn: ['missing', 'same', 'same'] }) })
  assert.equal(issues(duplicate).length, 1)
  assert.deepEqual(issues(duplicate)[0].codes, ['cycle-or-unresolved-dependency', 'duplicate-dependency', 'duplicate-step', 'missing-dependency', 'self-dependency'])
  assert.deepEqual(run(id, { ...sample(id), steps: [...steps].reverse() }), result)
})

test('workflow order satisfies independent dependency constraints at the 64-step boundary', () => {
  const id = 'workflow-dependency-validation', steps = Array.from({ length: 64 }, (_, j) => ({ id: longId('step', j), dependsOn: Array.from({ length: Math.min(j, 16) }, (_, k) => longId('step', j - k - 1)) }))
  const result = run(id, { ...sample(id), steps: [...steps].reverse() }), order = result.order as string[]
  assert.equal(result.valid, true); assert.equal(order.length, 64)
  for (const s of steps) for (const dependency of s.dependsOn) assert.ok(order.indexOf(dependency) < order.indexOf(s.id))
  const caseSensitive = run(id, { ...sample(id), steps: [{ id: 'A', dependsOn: [] }, { id: 'a', dependsOn: ['A'] }] })
  assert.deepEqual(caseSensitive.order, ['A', 'a'])
  rejected(id, { steps: Array(65).fill(steps[0]) })
})

test('64 maximum payment amounts retain the exact high-bound total and never authorize payment', () => {
  const id = 'buyer-spending-policy-check', base = rows(sample(id).calls)[0], calls = Array.from({ length: 64 }, (_, j) => ({ ...base, id: longId('call', j), amountBaseUnits: maxAmount }))
  const result = run(id, { ...sample(id), calls, perCallCapBaseUnits: maxAmount, budgetBaseUnits: maxAmount })
  assert.equal(result.totalBaseUnits, '639999999999999936'); assert.equal(result.totalBaseUnits, maximumTotal(64)); assert.equal(result.budgetExceeded, true)
  assert.equal(checks(result).length, 64); assert.ok(checks(result).every(c => !c.codes.length)); assert.equal(result.executionAuthorized, false)
  const exactBudget = run(id, { ...sample(id), budgetBaseUnits: '10000', perCallCapBaseUnits: '10000' })
  assert.equal(exactBudget.consistent, true); assert.equal(exactBudget.budgetExceeded, false)
  for (const amountBaseUnits of ['-1', '01', '1\n', '1e3', '10000000000000000', 1, NaN]) rejected(id, { calls: [{ ...base, amountBaseUnits }] })
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), calls: [base, base] }), /duplicate-identifier/)
  const address = '0x' + 'a'.repeat(40)
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), allowedPayees: [address, '0x' + 'A'.repeat(40)] }), /duplicate-payee/)
  const denied = run(id, { ...sample(id), calls: [{ ...base, amountBaseUnits: '0', payee: address, network: 'unsupported', asset: address, humanApproved: false }] })
  assert.deepEqual(checks(denied)[0].codes, ['declared-approval-missing', 'payee-not-allowed', 'unsupported-asset', 'unsupported-network', 'zero-payment'])
})

test('receipt schemas enforce canonical base64; maximum UTF-8 message hashes exact bytes', () => {
  const id = 'signed-receipt-verification', input = sample(id), message = '😀'.repeat(8000)
  const result = run(id, { ...input, message })
  assert.equal(result.messageDigest, 'sha256:' + createHash('sha256').update(Buffer.from(message, 'utf8')).digest('hex'))
  assert.equal(result.signatureValid, false)
  const publicKeyBase64 = input.publicKeyBase64 as string, signatureBase64 = input.signatureBase64 as string
  rejected(id, { publicKeyBase64: publicKeyBase64.slice(0, 42) + 'F=' })
  rejected(id, { signatureBase64: signatureBase64.slice(0, 85) + 'B==' })
  rejected(id, { publicKeyBase64: publicKeyBase64.replace(/=$/, '') }); rejected(id, { signatureBase64: signatureBase64 + '\n' })
  rejected(id, { message: 'x'.repeat(8001) }); rejected(id, { message: 'line\nbreak' })
})

test('challenge validates both URL declarations and does not bless parser-normalized unsafe forms', () => {
  const id = 'x402-challenge-sanity', input = sample(id), expected = input.expected as Row, challenge = input.challenge as Row
  for (const resourceUrl of ['not-a-url', 'http://example.org/', 'https:example.org', 'https://user:pw@example.org/', 'https://@example.org/', 'https://example.org/#', 'https://example.org/#fragment', 'https://example.org/a b', 'https:\\example.org\\path']) {
    const result = run(id, { ...input, expected: { ...expected, resourceUrl }, challenge: { ...challenge, resourceUrl } })
    assert.equal(result.consistent, false, resourceUrl)
    assert.ok((result.issues as string[]).some(code => code.includes('resource-url')))
  }
  const changedQuery = run(id, { ...input, challenge: { ...challenge, resourceUrl: String(expected.resourceUrl) + '?other=1' } })
  assert.ok((changedQuery.issues as string[]).includes('resource-mismatch'))
  const brokenExpected = run(id, { ...input, expected: { ...expected, resourceUrl: 'invalid' } })
  assert.ok((brokenExpected.issues as string[]).includes('invalid-expected-resource-url'))
  const address = '0x' + 'a'.repeat(40)
  assert.equal(run(id, { ...input, expected: { ...expected, asset: address, payee: address }, challenge: { ...challenge, asset: '0x' + 'A'.repeat(40), payee: '0x' + 'A'.repeat(40) } }).consistent, true)
})

test('challenge network syntax, timeout limits, integer amounts and worst-case diagnostics are bounded', () => {
  const id = 'x402-challenge-sanity', input = sample(id), expected = input.expected as Row, challenge = input.challenge as Row
  for (const network of ['process.exit()', 'eip155:0', 'eip155:08453', 'eip155:' + '9'.repeat(33), ' eip155:8453']) {
    const result = run(id, { ...input, expected: { ...expected, network }, challenge: { ...challenge, network } })
    assert.deepEqual(result.issues, ['invalid-expected-network', 'invalid-network'])
  }
  for (const maxTimeoutSeconds of [1, 900]) assert.equal(run(id, { ...input, challenge: { ...challenge, maxTimeoutSeconds } }).consistent, true)
  for (const maxTimeoutSeconds of [0, 901, 100000]) assert.ok((run(id, { ...input, challenge: { ...challenge, maxTimeoutSeconds } }).issues as string[]).includes('timeout-outside-policy'))
  const result = run(id, { ...input, expected: { ...expected, resourceUrl: 'invalid', network: 'invalid', maxAmountBaseUnits: '0' }, challenge: { ...challenge, version: 10, scheme: 'x'.repeat(40), resourceUrl: 'http://example.org/#', network: 'x'.repeat(80), asset: '0x' + 'a'.repeat(40), payee: '0x' + 'b'.repeat(40), amountBaseUnits: maxAmount, maxTimeoutSeconds: 100000 } })
  assert.equal(result.consistent, false); assert.ok((result.issues as string[]).length <= 16)
  rejected(id, { challenge: { ...challenge, maxTimeoutSeconds: Number.MAX_SAFE_INTEGER + 1 } })
  rejected(id, { expected: { ...expected, network: () => 'eip155:8453' } })
})

test('all settlement/delivery cardinality boundary combinations support up to 128 distinct IDs', () => {
  const id = 'settlement-delivery-reconciliation'
  for (const settlementCount of [0, 1, 64]) for (const deliveryCount of [0, 1, 64]) {
    const settlements = ledger('s', settlementCount), receiptRows = deliveries(ledger('d', deliveryCount, 64))
    const result = run(id, { ...sample(id), settlements, deliveries: receiptRows })
    assert.equal(checks(result).length, settlementCount + deliveryCount)
    assert.equal(result.settledBaseUnits, maximumTotal(settlementCount))
    assert.equal(result.consistent, settlementCount + deliveryCount === 0)
    assert.ok(checks(result).every(c => c.codes.length === 1 && c.codes[0] === (c.id.startsWith('s-') ? 'delivery-missing' : 'settlement-missing')))
  }
  const maximum = ledger('long', 64, 0, true), result = run(id, { ...sample(id), settlements: maximum, deliveries: deliveries(maximum) })
  assert.equal(result.consistent, true); assert.equal(result.settledBaseUnits, '639999999999999936')
  const disjoint = run(id, { ...sample(id), settlements: maximum, deliveries: deliveries(ledger('delivery', 64, 64, true)) })
  assert.equal(checks(disjoint).length, 128); assert.ok(byteLength(disjoint) <= 65536)
  assert.deepEqual(run(id, { ...sample(id), settlements: [...maximum].reverse(), deliveries: deliveries([...maximum].reverse()) }), result)
  rejected(id, { settlements: ledger('s', 65) })
})

test('reconciliation matches exact resources/amounts and normalized hashes, never response truth', () => {
  const id = 'settlement-delivery-reconciliation', s = { id: 'A', resource: 'Offer', transaction: '0x' + 'a'.repeat(64), amountBaseUnits: '10' }, d = { ...s, transaction: '0x' + 'A'.repeat(64), responseDigest: digest('b') }
  assert.equal(run(id, { ...sample(id), settlements: [s], deliveries: [d] }).consistent, true)
  const changed = run(id, { ...sample(id), settlements: [s], deliveries: [{ ...d, resource: 'offer', amountBaseUnits: '11', transaction: transaction(5) }] })
  assert.deepEqual(checks(changed)[0].codes, ['amountBaseUnits-mismatch', 'resource-mismatch', 'transaction-mismatch'])
  const differentId = run(id, { ...sample(id), settlements: [s], deliveries: [{ ...d, id: 'a' }] })
  assert.equal(checks(differentId).length, 2); assert.equal(differentId.consistent, false)
  assert.equal(changed.settledBaseUnits, '10'); assert.equal(changed.buyerReceiptProven, false)
  rejected(id, { settlements: [{ ...s, amountBaseUnits: '10\n' }] }); rejected(id, { deliveries: [{ ...d, responseDigest: 'not-a-hash' }] })
})

test('duplicate settlement/delivery IDs and reused references are diagnosed on both sides without double counting', () => {
  const id = 'settlement-delivery-reconciliation', s = ledger('s', 2), d = deliveries(s)
  const duplicateSettlement = run(id, { ...sample(id), settlements: [s[0], s[0], s[1]], deliveries: d })
  assert.ok(checks(duplicateSettlement)[0].codes.includes('duplicate-settlement-id')); assert.equal(duplicateSettlement.settledBaseUnits, maxAmount)
  const duplicateDelivery = run(id, { ...sample(id), settlements: s, deliveries: [d[0], d[0], d[1]] })
  assert.ok(checks(duplicateDelivery)[0].codes.includes('duplicate-delivery-id')); assert.equal(duplicateDelivery.settledBaseUnits, maximumTotal(2))
  const reusedDelivery = run(id, { ...sample(id), settlements: s, deliveries: [d[0], { ...d[1], transaction: d[0].transaction }] })
  assert.ok(checks(reusedDelivery).every(c => c.codes.includes('transaction-reused-across-requests'))); assert.equal(reusedDelivery.settledBaseUnits, maximumTotal(2))
  const allDuplicate = run(id, { ...sample(id), settlements: Array(64).fill(s[0]), deliveries: Array(64).fill(d[0]) })
  assert.equal(checks(allDuplicate).length, 1); assert.equal(allDuplicate.settledBaseUnits, '0')
})

// Independent index/multiset oracle (the implementation uses per-record scans).
function reconciliationOracle(settlements: Row[], receipts: Row[]) {
  const byId = (data: Row[]) => { const map = new Map<string, Row[]>(); for (const r of data) { const key = r.id as string; map.set(key, [...(map.get(key) ?? []), r]) }; return map }
  const ss = byId(settlements), ds = byId(receipts), transactionIds = new Map<string, Set<string>>(), settlementTxCounts = new Map<string, number>()
  for (const r of [...settlements, ...receipts]) { const key = (r.transaction as string).toLowerCase(), set = transactionIds.get(key) ?? new Set<string>(); set.add(r.id as string); transactionIds.set(key, set) }
  for (const r of settlements) { const key = (r.transaction as string).toLowerCase(); settlementTxCounts.set(key, (settlementTxCounts.get(key) ?? 0) + 1) }
  const expected = [...new Set([...ss.keys(), ...ds.keys()])].sort().map(id => {
    const s = ss.get(id) ?? [], d = ds.get(id) ?? [], codes: string[] = []
    if (!s.length) codes.push('settlement-missing'); else if (s.length > 1) codes.push('duplicate-settlement-id')
    if (!d.length) codes.push('delivery-missing'); else if (d.length > 1) codes.push('duplicate-delivery-id')
    if (s.length === 1 && d.length === 1) {
      if (s[0].resource !== d[0].resource) codes.push('resource-mismatch')
      if (s[0].amountBaseUnits !== d[0].amountBaseUnits) codes.push('amountBaseUnits-mismatch')
      if ((s[0].transaction as string).toLowerCase() !== (d[0].transaction as string).toLowerCase()) codes.push('transaction-mismatch')
    }
    if ([...s, ...d].some(r => transactionIds.get((r.transaction as string).toLowerCase())!.size > 1)) codes.push('transaction-reused-across-requests')
    return { id, codes: codes.sort() }
  })
  let total = BigInt(0)
  for (const group of ss.values()) if (group.length === 1 && settlementTxCounts.get((group[0].transaction as string).toLowerCase()) === 1) total += BigInt(group[0].amountBaseUnits as string)
  return { expected, total: total.toString() }
}

test('reconciliation agrees with independent multiset/reference oracle on adversarial ledgers', () => {
  const id = 'settlement-delivery-reconciliation'
  for (let seed = 1; seed <= 40; seed++) {
    const settlements = Array.from({ length: 16 }, (_, j) => ({ id: `request-${(j * seed + j * j) % 13}`, resource: `offer-${j % 3}`, transaction: transaction((j * seed) % 11), amountBaseUnits: String(9007199254740990 + j % 2) }))
    const receipts = Array.from({ length: 16 }, (_, j) => ({ id: `request-${(j + seed) % 15}`, resource: `offer-${j % 3}`, transaction: transaction((j * seed) % 12), amountBaseUnits: String(9007199254740990 + j % 2), responseDigest: digest() }))
    const oracle = reconciliationOracle(settlements, receipts), actual = run(id, { ...sample(id), settlements, deliveries: receipts })
    assert.deepEqual(checks(actual), oracle.expected); assert.equal(actual.settledBaseUnits, oracle.total)
    assert.equal(actual.consistent, oracle.expected.every(c => c.codes.length === 0))
  }
})

test('idempotency audit compares exact intent/key/nonce references and permits repeated observations of one transaction', () => {
  const id = 'idempotency-trace-audit', original = rows(sample(id).attempts)[0], r = { ...original, transaction: '0x' + 'a'.repeat(64) }
  const repeated = run(id, { ...sample(id), attempts: [r, { ...r, id: 'attempt-2', transaction: '0x' + 'A'.repeat(64) }] })
  assert.equal(repeated.consistent, true)
  const changedKey = run(id, { ...sample(id), attempts: [r, { ...r, id: 'attempt-2', idempotencyKey: 'different' }] })
  assert.ok(checks(changedKey).every(c => c.codes.includes('nonce-reused-across-intents') && c.codes.includes('transaction-reused-across-keys')))
  const changedResource = run(id, { ...sample(id), attempts: [r, { ...r, id: 'attempt-2', resource: 'different', transaction: transaction(2) }] })
  assert.ok(checks(changedResource).every(c => c.codes.includes('idempotency-intent-changed') && c.codes.includes('multiple-transactions-for-key')))
  const nullReferences = run(id, { ...sample(id), attempts: [{ ...r, transaction: null, state: 'refused' }, { ...r, id: 'attempt-2', idempotencyKey: 'different', nonce: 'different', transaction: null, state: 'refused' }] })
  assert.equal(nullReferences.consistent, true)
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), attempts: [r, r] }), /duplicate-identifier/)
})

test('80-attempt boundary reports ambiguity and transaction contradictions without overflowing', () => {
  const id = 'idempotency-trace-audit', base = rows(sample(id).attempts)[0]
  for (const state of ['signed', 'unknown', 'settled', 'delivered', 'refused']) {
    const result = run(id, { ...sample(id), attempts: [{ ...base, state, transaction: null }] })
    const expected = state === 'signed' || state === 'unknown' ? ['outcome-ambiguous-inspect-before-retry'] : state === 'refused' ? [] : ['transaction-evidence-missing']
    assert.deepEqual(checks(result)[0].codes, expected)
  }
  assert.deepEqual(checks(run(id, { ...sample(id), attempts: [{ ...base, state: 'refused' }] }))[0].codes, ['refused-attempt-has-transaction'])
  const attempts = Array.from({ length: 80 }, (_, j) => ({ id: longId('attempt', j), idempotencyKey: longId('key', j % 2), nonce: longId('nonce', 0), resource: longId('resource', j), inputDigest: digest(j % 2 ? 'a' : 'b'), state: 'unknown', transaction: transaction(j % 7) }))
  const result = run(id, { ...sample(id), attempts })
  assert.equal(checks(result).length, 80); assert.ok(checks(result).every(c => c.codes.length === 5 && c.codes.includes('transaction-reused-across-keys') && c.codes.includes('idempotency-intent-changed') && c.codes.includes('nonce-reused-across-intents') && c.codes.includes('multiple-transactions-for-key') && c.codes.includes('outcome-ambiguous-inspect-before-retry')))
  rejected(id, { attempts: [...attempts, { ...base, id: 'extra' }] })
})

test('license matching exhausts declared use combinations and handles unknown/duplicate policy references', () => {
  const id = 'machine-license-permission-match', uses = ['read', 'internal-use', 'redistribute', 'resell', 'train']
  for (let mask = 0; mask < 32; mask++) {
    const allowedUses = uses.filter((_, j) => mask & (1 << j)), requestedUses = Array.from({ length: 32 }, (_, j) => ({ id: longId('use', j), use: uses[j % 5] }))
    const result = run(id, { ...sample(id), policyId: longId('policy', 0), allowedUses, requestedUses })
    assert.deepEqual(rows(result.checks).map(c => c.state), requestedUses.map(r => allowedUses.includes(r.use) ? 'matches-declaration' : 'outside-declaration'))
  }
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), allowedUses: ['read', 'read'] }), /inconsistent-policy/)
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), policyStatus: 'unknown' }), /inconsistent-policy/)
  const requested = rows(sample(id).requestedUses)[0]
  assert.throws(() => buildCommerceExpansion(id, { ...sample(id), requestedUses: [requested, requested] }), /duplicate-identifier/)
})

test('scalar schemas reject final-newline identifiers/amounts, unsafe integers and unknown nested fields', () => {
  rejected('workflow-dependency-validation', { steps: [{ id: 'name\n', dependsOn: [] }] })
  rejected('buyer-spending-policy-check', { budgetBaseUnits: '1\n' })
  const field = rows(sample('tool-argument-validation').fields)[0]
  for (const maximum of [NaN, Infinity, 2.5, 1000001, Number.MAX_SAFE_INTEGER + 1]) rejected('tool-argument-validation', { fields: [{ ...field, maximum }] })
  const c = sample('x402-challenge-sanity').challenge as Row
  rejected('x402-challenge-sanity', { challenge: { ...c, callback: 'fetch' } })
})

test('worst-case spending/reconciliation diagnostics retain every advertised row within 64KiB', () => {
  const spending = 'buyer-spending-policy-check', base = rows(sample(spending).calls)[0], address = '0x' + 'f'.repeat(40)
  const calls = Array.from({ length: 64 }, (_, j) => ({ ...base, id: longId('call', j), amountBaseUnits: maxAmount, payee: address, asset: address, network: 'x'.repeat(80), humanApproved: false }))
  const result = run(spending, { ...sample(spending), allowedPayees: Array.from({ length: 32 }, (_, j) => '0x' + j.toString(16).padStart(40, '0')), calls, budgetBaseUnits: '0', perCallCapBaseUnits: '0' })
  assert.equal(result.totalBaseUnits, maximumTotal(64)); assert.ok(checks(result).every(c => c.codes.length === 5))
  const reconcile = 'settlement-delivery-reconciliation', settlements = ledger('request', 64, 0, true)
  const receiptRows = deliveries(settlements).map((r, j) => ({ ...r, resource: longId('other-resource', j), amountBaseUnits: (BigInt(maxAmount) - BigInt(1)).toString(), transaction: transaction((j + 1) % 64) }))
  const mismatches = run(reconcile, { ...sample(reconcile), settlements, deliveries: receiptRows })
  assert.equal(checks(mismatches).length, 64); assert.ok(checks(mismatches).every(c => c.codes.length === 4)); assert.equal(mismatches.settledBaseUnits, maximumTotal(64))
})

test('result schemas reject invented diagnostic codes and bound their maximum serialized size', () => {
  const maxWireBytes = (schema: MicroSchema): number => {
    if (schema.oneOf) return Math.max(...schema.oneOf.map(maxWireBytes))
    if (schema.enum) return Math.max(...schema.enum.map(value => byteLength(value)))
    switch (schema.type) {
      case 'object': return 2 + Object.entries(schema.properties!).reduce((sum, [key, s]) => sum + byteLength(key) + 1 + maxWireBytes(s) + 1, 0)
      case 'array': return 2 + schema.maxItems! * (maxWireBytes(schema.items!) + 1)
      case 'integer': return Math.max(String(schema.minimum).length, String(schema.maximum).length)
      case 'boolean': return 5
      case 'null': return 4
      case 'string': return 2 + schema.maxLength! // All unconstrained result strings here are ASCII regexes.
      default: throw new Error('unbounded-result-schema')
    }
  }
  for (const id of allProducts) {
    assert.ok(maxWireBytes(SPECS[id].resultSchema) <= 65536, id)
    const result = run(id)
    if ('checks' in result && id !== 'machine-license-permission-match') {
      const bogus = { ...result, checks: [{ id: 'request', codes: ['invented-diagnostic'] }] }
      assert.equal(schemaAccepts(SPECS[id].resultSchema, bogus), false)
    }
  }
})
