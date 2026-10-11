import { createPublicKey, verify, createHash } from 'node:crypto'
import { objectSchema as o, arraySchema as a, enumSchema as e, textSchema as t, ID_SCHEMA, HASH_SCHEMA as hash, schemaAccepts, type MicroSchema } from './micro-schema.ts'

type Row = Record<string, unknown>
const n = (min = 0, max = 1_000_000): MicroSchema => ({ type: 'integer', minimum: min, maximum: max })
const bool: MicroSchema = { type: 'boolean' }, no: MicroSchema = { type: 'boolean', enum: [false] }
const env = (fields: Record<string, MicroSchema>) => o({ dataClass: e('public', 'synthetic'), ...fields })
// JS "$" alone accepts a final newline. These identifiers and numbers must end exactly.
const strictEnd = '$(?![\\s\\S])'
const id: MicroSchema = { ...ID_SCHEMA, pattern: ID_SCHEMA.pattern + '(?![\\s\\S])' }
const ids = a(id, 0, 64)
const amount: MicroSchema = { type: 'string', maxLength: 16, pattern: `^(0|[1-9][0-9]{0,15})${strictEnd}` }
const totalAmount: MicroSchema = { type: 'string', maxLength: 20, pattern: `^(0|[1-9][0-9]{0,19})${strictEnd}` }
const address: MicroSchema = { type: 'string', maxLength: 42, pattern: '^0x[a-fA-F0-9]{40}$' }
const tx: MicroSchema = { type: 'string', maxLength: 66, pattern: '^0x[a-fA-F0-9]{64}$' }
const nullable = (schema: MicroSchema): MicroSchema => ({ oneOf: [schema, { type: 'null' }] })
const issue = (maxCodes: number, ...codes: string[]) => o({ id, codes: a(e(...codes), 0, maxCodes) })
const toolIssue = issue(2, 'required-argument-missing', 'invalid-json', 'type-mismatch', 'outside-bounds', 'string-outside-contract', 'unknown-argument')
const workflowIssue = issue(5, 'duplicate-step', 'duplicate-dependency', 'missing-dependency', 'self-dependency', 'cycle-or-unresolved-dependency')
const spendingIssue = issue(6, 'per-call-cap-exceeded', 'zero-payment', 'payee-not-allowed', 'unsupported-network', 'unsupported-asset', 'declared-approval-missing')
const reconciliationIssue = issue(4, 'duplicate-settlement-id', 'settlement-missing', 'duplicate-delivery-id', 'delivery-missing', 'resource-mismatch', 'transaction-mismatch', 'amountBaseUnits-mismatch', 'transaction-reused-across-requests')
const idempotencyIssue = issue(5, 'idempotency-intent-changed', 'nonce-reused-across-intents', 'multiple-transactions-for-key', 'transaction-reused-across-keys', 'outcome-ambiguous-inspect-before-retry', 'transaction-evidence-missing', 'refused-attempt-has-transaction')
const reported = o({ checks: a(toolIssue, 0, 64), consistent: bool, executionAuthorized: no })
const h = 'sha256:' + 'a'.repeat(64)
const payee = '0x' + '1'.repeat(40)
const transaction = '0x' + '2'.repeat(64)

export const SPECS = {
  'tool-argument-validation': {
    amount: '4500', title: 'Tool Argument Contract Check', category: 'contracts',
    description: 'Check up to 32 JSON argument values against a closed, declared scalar tool contract: types, required fields, code-point length and exact safe-integer bounds. Rounded fractions/underflow are not integers. Returns unknown fields and mismatches. No remote references, arbitrary patterns, tool execution or MCP conformance certification.',
    inputSchema: env({ fields: a(o({ name: id, type: e('string', 'integer', 'boolean'), required: bool, minimum: n(-1_000_000), maximum: n(-1_000_000), maxLength: n(1, 1024) }), 1, 32), arguments: a(o({ name: id, valueJson: t(1100) }), 0, 32) }),
    sample: { dataClass: 'synthetic', fields: [{ name: 'count', type: 'integer', required: true, minimum: 1, maximum: 10, maxLength: 80 }], arguments: [{ name: 'count', valueJson: '3' }] },
    resultSchema: reported,
  },
  'workflow-dependency-validation': {
    amount: '27500', title: 'Workflow Dependency Check', category: 'contracts',
    description: 'Check up to 64 workflow steps for duplicate IDs, missing dependencies and cycles. Returns a deterministic topological order only when valid. No scheduling, tool execution, access approval or guarantee that the workflow will succeed.',
    inputSchema: env({ steps: a(o({ id, dependsOn: a(id, 0, 16) }), 1, 64) }),
    sample: { dataClass: 'synthetic', steps: [{ id: 'fetch', dependsOn: [] }, { id: 'review', dependsOn: ['fetch'] }] },
    resultSchema: o({ valid: bool, order: ids, issues: a(workflowIssue, 0, 64), executionAuthorized: no }),
  },
  'buyer-spending-policy-check': {
    amount: '35000', title: 'Buyer Spending Policy Check', category: 'contracts',
    description: 'Compare up to 64 proposed Base-USDC calls with a declared total budget, per-call cap, allowed payees and human-approval requirement. Returns policy mismatches and exact arithmetic totals. Does not authorize, sign or execute payments; caller approval labels are not verified.',
    inputSchema: env({ budgetBaseUnits: amount, perCallCapBaseUnits: amount, allowedPayees: a(address, 1, 32), requireHumanApproval: bool, calls: a(o({ id, amountBaseUnits: amount, payee: address, network: t(80), asset: address, humanApproved: bool }), 1, 64) }),
    sample: { dataClass: 'synthetic', budgetBaseUnits: '100000', perCallCapBaseUnits: '50000', allowedPayees: [payee], requireHumanApproval: true, calls: [{ id: 'call-1', amountBaseUnits: '10000', payee, network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', humanApproved: true }] },
    resultSchema: o({ consistent: bool, totalBaseUnits: totalAmount, budgetExceeded: bool, checks: a(spendingIssue, 1, 64), executionAuthorized: no }),
  },
  'signed-receipt-verification': {
    amount: '12500', title: 'Ed25519 Receipt Verification', category: 'contracts',
    description: 'Verify one Ed25519 signature over up to 8,000 characters of exact UTF-8 receipt text using a supplied 32-byte public key. Returns cryptographic validity and message hash. Does not establish issuer identity, trusted time, licensing or the truth of the receipt. No private keys accepted.',
    inputSchema: env({ encoding: e('exact-utf8'), message: t(8000), publicKeyBase64: { type: 'string', maxLength: 44, pattern: '^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$' }, signatureBase64: { type: 'string', maxLength: 88, pattern: '^[A-Za-z0-9+/]{85}[AQgw]==$' } }),
    sample: { dataClass: 'synthetic', encoding: 'exact-utf8', message: 'Synthetic receipt; no transaction asserted.', publicKeyBase64: Buffer.alloc(32, 1).toString('base64'), signatureBase64: Buffer.alloc(64, 2).toString('base64') },
    resultSchema: o({ algorithm: e('Ed25519'), signatureValid: bool, messageDigest: hash, issuerIdentityVerified: no, factsVerified: no }),
  },
  'x402-challenge-sanity': {
    amount: '3500', title: 'x402 Challenge Policy Check', category: 'contracts',
    description: 'Inspect one supplied x402-v2 exact-payment challenge against an explicit expected HTTPS resource, EVM CAIP-2 network, asset, payee and maximum price. Checks both URL declarations, structure and payment-policy fields only; no live probe, payment, facilitator verification or server-authenticity claim.',
    inputSchema: env({ expected: o({ resourceUrl: t(512), network: t(80), asset: address, payee: address, maxAmountBaseUnits: amount }), challenge: o({ version: n(0, 10), resourceUrl: t(512), scheme: t(40), network: t(80), asset: address, payee: address, amountBaseUnits: amount, maxTimeoutSeconds: n(0, 100000) }) }),
    sample: { dataClass: 'synthetic', expected: { resourceUrl: 'https://example.org/result', network: 'eip155:8453', asset: payee, payee, maxAmountBaseUnits: '10000' }, challenge: { version: 2, resourceUrl: 'https://example.org/result', scheme: 'exact', network: 'eip155:8453', asset: payee, payee, amountBaseUnits: '10000', maxTimeoutSeconds: 60 } },
    resultSchema: o({ consistent: bool, issues: a(e('invalid-resource-url', 'unsafe-resource-url', 'invalid-expected-resource-url', 'unsafe-expected-resource-url', 'invalid-network', 'invalid-expected-network', 'unsupported-version', 'unsupported-scheme', 'resource-mismatch', 'network-mismatch', 'asset-mismatch', 'payee-mismatch', 'price-ceiling-exceeded', 'zero-payment', 'timeout-outside-policy'), 0, 16), liveServerVerified: no, executionAuthorized: no }),
  },
  'settlement-delivery-reconciliation': {
    amount: '54000', title: 'Settlement and Delivery Reconciliation', category: 'contracts',
    description: 'Match up to 64 settlements with 64 delivery receipts, including 128 distinct request IDs. Reports missing/contradictory records, duplicate IDs and reused transaction references. Exact settled total includes only unique settlement IDs/transactions, independent of delivery matches. No chain fetch, proof of buyer receipt or fulfilled-sales claim.',
    inputSchema: env({ settlements: a(o({ id, resource: id, transaction: tx, amountBaseUnits: amount }), 0, 64), deliveries: a(o({ id, resource: id, transaction: tx, amountBaseUnits: amount, responseDigest: hash }), 0, 64) }),
    sample: { dataClass: 'synthetic', settlements: [{ id: 'request-1', resource: 'offer-1', transaction, amountBaseUnits: '10000' }], deliveries: [{ id: 'request-1', resource: 'offer-1', transaction, amountBaseUnits: '10000', responseDigest: h }] },
    resultSchema: o({ consistent: bool, checks: a(reconciliationIssue, 0, 128), settledBaseUnits: totalAmount, chainFetched: no, buyerReceiptProven: no }),
  },
  'idempotency-trace-audit': {
    amount: '52000', title: 'Replay and Idempotency Trace Audit', category: 'contracts',
    description: 'Inspect up to 80 declared attempt records for nonce reuse across intents, changed inputs under one idempotency key, duplicate settlements and ambiguous outcomes. No raw payloads or credentials; no live state access, automatic retry or payment authorization.',
    inputSchema: env({ attempts: a(o({ id, idempotencyKey: id, nonce: id, resource: id, inputDigest: hash, state: e('signed', 'settled', 'delivered', 'unknown', 'refused'), transaction: nullable(tx) }), 1, 80) }),
    sample: { dataClass: 'synthetic', attempts: [{ id: 'attempt-1', idempotencyKey: 'request-1', nonce: 'nonce-1', resource: 'offer-1', inputDigest: h, state: 'delivered', transaction }] },
    resultSchema: o({ consistent: bool, checks: a(idempotencyIssue, 1, 80), automaticallyRetry: no, executionAuthorized: no }),
  },
  'machine-license-permission-match': {
    amount: '14500', title: 'Declared License Permission Match', category: 'contracts',
    description: 'Compare up to 32 requested uses with an explicit machine-readable license policy for reading, internal use, redistribution, resale or training. Unknown policies remain undetermined. Does not interpret legal prose, verify ownership, grant rights or provide a legal-compliance verdict.',
    inputSchema: env({ policyId: id, policyStatus: e('declared', 'unknown'), allowedUses: a(e('read', 'internal-use', 'redistribute', 'resell', 'train'), 0, 5), requestedUses: a(o({ id, use: e('read', 'internal-use', 'redistribute', 'resell', 'train') }), 1, 32) }),
    sample: { dataClass: 'synthetic', policyId: 'synthetic-personal-reading', policyStatus: 'declared', allowedUses: ['read', 'internal-use'], requestedUses: [{ id: 'use-1', use: 'read' }] },
    resultSchema: o({ checks: a(o({ id, state: e('matches-declaration', 'outside-declaration', 'undetermined') }), 1, 32), rightsGranted: no, legalComplianceVerified: no }),
  },
} as const

function unique(rows: Row[], field = 'id') {
  if (new Set(rows.map(x => x[field])).size !== rows.length) throw new Error('duplicate-identifier')
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  const v = value as Row
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}'
}
const sha = (s: string) => 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex')
const codesFor = (id: string, codes: string[]) => ({ id, codes: [...new Set(codes)].sort() })
const ok = (checks: { id: string; codes: string[] }[]) => checks.every(c => !c.codes.length)
const sameAddress = (a: unknown, b: unknown) => String(a).toLowerCase() === String(b).toLowerCase()

/** Verify the JSON number's exact value, not merely its rounded IEEE-754 parse. */
function exactSafeInteger(source: string, value: unknown): boolean {
  if (!Number.isSafeInteger(value)) return false
  const m = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(source.trim())
  if (!m) return false
  const digits = (m[2] + (m[3] ?? '')).replace(/^0+/, '')
  if (!digits) return true // Zero stays zero even with a very large declared exponent.
  const exponent = Number(m[4] ?? '0'), shift = exponent - (m[3]?.length ?? 0)
  if (!Number.isSafeInteger(shift)) return false
  let whole: string
  if (shift >= 0) {
    if (digits.length + shift > 16) return false
    whole = digits + '0'.repeat(shift)
  } else {
    if (-shift >= digits.length || !/^0+$/.test(digits.slice(shift))) return false
    whole = digits.slice(0, shift)
  }
  return BigInt(m[1] + whole) === BigInt(value as number)
}

function resourceUrlIssue(value: string): 'invalid-resource-url' | 'unsafe-resource-url' | null {
  let url: URL
  try { url = new URL(value) } catch { return 'invalid-resource-url' }
  const authority = /^https:\/\/([^/?#]*)/i.exec(value)?.[1]
  if (url.protocol !== 'https:' || !url.hostname || authority === undefined || authority.includes('@') || url.username || url.password || /[\s\\#]/u.test(value)) return 'unsafe-resource-url'
  return null
}
const evmNetwork = (value: unknown) => typeof value === 'string' && /^eip155:[1-9][0-9]{0,31}$(?![\s\S])/u.test(value)

function calculateCommerceExpansion(product: string, input: Row): Row | null {
  switch (product) {
    case 'tool-argument-validation': {
      const fields = input.fields as Row[], args = input.arguments as Row[]
      unique(fields, 'name'); unique(args, 'name')
      if (fields.some(f => Number(f.minimum) > Number(f.maximum))) throw new Error('inverted-bounds')
      const checks: { id: string; codes: string[] }[] = []
      for (const field of fields) {
        const arg = args.find(a => a.name === field.name), issues: string[] = []
        if (!arg) { if (field.required) issues.push('required-argument-missing') }
        else {
          let value: unknown
          try { value = JSON.parse(arg.valueJson as string) } catch { issues.push('invalid-json') }
          const kind = typeof value === 'number' && exactSafeInteger(arg.valueJson as string, value) ? 'integer' : typeof value
          if (kind !== field.type) issues.push('type-mismatch')
          if (field.type === 'integer' && kind === 'integer' && (Number(value) < Number(field.minimum) || Number(value) > Number(field.maximum))) issues.push('outside-bounds')
          if (field.type === 'string' && typeof value === 'string' && (Array.from(value).length > Number(field.maxLength) || /[\u0000-\u001f\u007f]/u.test(value))) issues.push('string-outside-contract')
        }
        checks.push(codesFor(String(field.name), issues))
      }
      for (const arg of args) if (!fields.some(f => f.name === arg.name)) checks.push(codesFor(String(arg.name), ['unknown-argument']))
      return { checks, consistent: ok(checks), executionAuthorized: false }
    }
    case 'workflow-dependency-validation': {
      const steps = input.steps as { id: string; dependsOn: string[] }[], issueMap = new Map<string, Set<string>>()
      const record = (key: string, codes: string[]) => { const merged = issueMap.get(key) ?? new Set<string>(); codes.forEach(code => merged.add(code)); if (merged.size) issueMap.set(key, merged) }
      const names = new Set(steps.map(s => s.id))
      for (const s of steps) {
        const codes: string[] = []
        if (steps.filter(x => x.id === s.id).length > 1) codes.push('duplicate-step')
        if (new Set(s.dependsOn).size !== s.dependsOn.length) codes.push('duplicate-dependency')
        if (s.dependsOn.some(d => !names.has(d))) codes.push('missing-dependency')
        if (s.dependsOn.includes(s.id)) codes.push('self-dependency')
        record(s.id, codes)
      }
      const order: string[] = [], remaining = new Map(steps.map(s => [s.id, s]))
      for (let pass = 0; pass < steps.length && remaining.size; pass++) {
        const ready = [...remaining.values()].filter(s => s.dependsOn.every(d => order.includes(d))).map(s => s.id).sort()
        if (!ready.length) break
        for (const key of ready) { remaining.delete(key); order.push(key) }
      }
      for (const s of remaining.values()) record(s.id, ['cycle-or-unresolved-dependency'])
      const issues = [...issueMap].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, codes]) => codesFor(key, [...codes]))
      return { valid: !issues.length, order: issues.length ? [] : order, issues, executionAuthorized: false }
    }
    case 'buyer-spending-policy-check': {
      const calls = input.calls as Row[]; unique(calls)
      const allowed = input.allowedPayees as string[]
      if (new Set(allowed.map(a => a.toLowerCase())).size !== allowed.length) throw new Error('duplicate-payee')
      const total = calls.reduce((n, c) => n + BigInt(c.amountBaseUnits as string), BigInt(0))
      const checks = calls.map(c => {
        const codes: string[] = []
        if (BigInt(String(c.amountBaseUnits)) > BigInt(String(input.perCallCapBaseUnits))) codes.push('per-call-cap-exceeded')
        if (BigInt(c.amountBaseUnits as string) === BigInt(0)) codes.push('zero-payment')
        if (!allowed.some(a => sameAddress(a, c.payee))) codes.push('payee-not-allowed')
        if (c.network !== 'eip155:8453') codes.push('unsupported-network')
        if (!sameAddress(c.asset, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')) codes.push('unsupported-asset')
        if (input.requireHumanApproval && !c.humanApproved) codes.push('declared-approval-missing')
        return codesFor(String(c.id), codes)
      })
      const budgetExceeded = total > BigInt(String(input.budgetBaseUnits))
      return { consistent: ok(checks) && !budgetExceeded, totalBaseUnits: total.toString(), budgetExceeded, checks, executionAuthorized: false }
    }
    case 'signed-receipt-verification': {
      const publicKey = Buffer.from(String(input.publicKeyBase64), 'base64'), signature = Buffer.from(String(input.signatureBase64), 'base64')
      if (publicKey.length !== 32 || signature.length !== 64 || publicKey.toString('base64') !== input.publicKeyBase64 || signature.toString('base64') !== input.signatureBase64) throw new Error('invalid-base64')
      const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), publicKey]), format: 'der', type: 'spki' })
      return { algorithm: 'Ed25519', signatureValid: verify(null, Buffer.from(String(input.message), 'utf8'), key, signature), messageDigest: sha(String(input.message)), issuerIdentityVerified: false, factsVerified: false }
    }
    case 'x402-challenge-sanity': {
      const expected = input.expected as Row, c = input.challenge as Row, issues: string[] = []
      const challengeUrlIssue = resourceUrlIssue(c.resourceUrl as string), expectedUrlIssue = resourceUrlIssue(expected.resourceUrl as string)
      if (challengeUrlIssue) issues.push(challengeUrlIssue)
      if (expectedUrlIssue) issues.push(expectedUrlIssue === 'invalid-resource-url' ? 'invalid-expected-resource-url' : 'unsafe-expected-resource-url')
      if (!evmNetwork(c.network)) issues.push('invalid-network')
      if (!evmNetwork(expected.network)) issues.push('invalid-expected-network')
      if (c.version !== 2) issues.push('unsupported-version')
      if (c.scheme !== 'exact') issues.push('unsupported-scheme')
      for (const field of ['resourceUrl', 'network']) if (expected[field] !== c[field]) issues.push(field === 'resourceUrl' ? 'resource-mismatch' : 'network-mismatch')
      for (const field of ['asset', 'payee']) if (!sameAddress(expected[field], c[field])) issues.push(field + '-mismatch')
      if (BigInt(String(c.amountBaseUnits)) > BigInt(String(expected.maxAmountBaseUnits))) issues.push('price-ceiling-exceeded')
      if (BigInt(c.amountBaseUnits as string) === BigInt(0)) issues.push('zero-payment')
      if (Number(c.maxTimeoutSeconds) < 1 || Number(c.maxTimeoutSeconds) > 900) issues.push('timeout-outside-policy')
      return { consistent: !issues.length, issues: [...new Set(issues)].sort(), liveServerVerified: false, executionAuthorized: false }
    }
    case 'settlement-delivery-reconciliation': {
      const settlements = input.settlements as Row[], deliveries = input.deliveries as Row[]
      const allRows = [...settlements, ...deliveries], keys = [...new Set(allRows.map(r => String(r.id)))].sort()
      const checks = keys.map(key => {
        const ss = settlements.filter(r => r.id === key), ds = deliveries.filter(r => r.id === key), codes: string[] = []
        if (ss.length !== 1) codes.push(ss.length ? 'duplicate-settlement-id' : 'settlement-missing')
        if (ds.length !== 1) codes.push(ds.length ? 'duplicate-delivery-id' : 'delivery-missing')
        if (ss.length === 1 && ds.length === 1) for (const field of ['resource', 'transaction', 'amountBaseUnits']) if (field === 'transaction' ? !sameAddress(ss[0][field], ds[0][field]) : ss[0][field] !== ds[0][field]) codes.push(field + '-mismatch')
        const reused = [...ss, ...ds].some(s => allRows.some(other => other.id !== key && sameAddress(other.transaction, s.transaction)))
        if (reused) codes.push('transaction-reused-across-requests')
        return codesFor(key, codes)
      })
      const valid = settlements.filter(s => settlements.filter(x => x.id === s.id).length === 1 && settlements.filter(x => sameAddress(x.transaction, s.transaction)).length === 1)
      return { consistent: ok(checks), checks, settledBaseUnits: valid.reduce((n, r) => n + BigInt(r.amountBaseUnits as string), BigInt(0)).toString(), chainFetched: false, buyerReceiptProven: false }
    }
    case 'idempotency-trace-audit': {
      const attempts = input.attempts as Row[]; unique(attempts)
      const intent = (r: Row) => canonical([r.resource, r.inputDigest])
      const checks = attempts.map(r => {
        const sameKey = attempts.filter(s => s.idempotencyKey === r.idempotencyKey), sameNonce = attempts.filter(s => s.nonce === r.nonce), codes: string[] = []
        if (sameKey.some(s => intent(s) !== intent(r))) codes.push('idempotency-intent-changed')
        if (sameNonce.some(s => intent(s) !== intent(r) || s.idempotencyKey !== r.idempotencyKey)) codes.push('nonce-reused-across-intents')
        if (new Set(sameKey.filter(s => s.transaction).map(s => String(s.transaction).toLowerCase())).size > 1) codes.push('multiple-transactions-for-key')
        if (r.transaction && attempts.some(s => s.idempotencyKey !== r.idempotencyKey && sameAddress(s.transaction, r.transaction))) codes.push('transaction-reused-across-keys')
        if (r.state === 'unknown' || r.state === 'signed') codes.push('outcome-ambiguous-inspect-before-retry')
        if ((r.state === 'settled' || r.state === 'delivered') && !r.transaction) codes.push('transaction-evidence-missing')
        if (r.state === 'refused' && r.transaction) codes.push('refused-attempt-has-transaction')
        return codesFor(String(r.id), codes)
      })
      return { consistent: ok(checks), checks, automaticallyRetry: false, executionAuthorized: false }
    }
    case 'machine-license-permission-match': {
      const requested = input.requestedUses as Row[], allowed = input.allowedUses as string[]
      unique(requested)
      if (new Set(allowed).size !== allowed.length || (input.policyStatus === 'unknown' && allowed.length)) throw new Error('inconsistent-policy')
      return { checks: requested.map(r => ({ id: r.id, state: input.policyStatus === 'unknown' ? 'undetermined' : allowed.includes(String(r.use)) ? 'matches-declaration' : 'outside-declaration' })), rightsGranted: false, legalComplianceVerified: false }
    }
    default: return null
  }
}

/** Validate known contracts before coercion/crypto; unknown product IDs have no side effects. */
export function buildCommerceExpansion(product: string, input: Row): Row | null {
  if (!Object.hasOwn(SPECS, product)) return null
  const spec = SPECS[product as keyof typeof SPECS]
  if (!schemaAccepts(spec.inputSchema, input)) throw new Error('commerce-input-schema')
  const result = calculateCommerceExpansion(product, input)
  if (!schemaAccepts(spec.resultSchema, result)) throw new Error('commerce-output-schema')
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 65536) throw new Error('commerce-output-64KiB')
  // Shared integration owns its aggregate request/envelope byte limit. No lower hidden row cap.
  return result
}
