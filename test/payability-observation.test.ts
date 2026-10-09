import { test as nodeTest, type TestFn } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adaptObservation, associateSynthetic, authenticate, canonicalJson, inspectObservation, parseStrict, PAYABILITY_SIGNER, PREVIEW_FIELDS, rawDigest, REQUIRED } from '../lib/payability-observation.ts'

// Private collaborator fixtures deliberately stay outside the public repository.
const directory = process.env.NIKOS_FIXTURE_DIR
const test = (name: string, fn: TestFn) => nodeTest(name, { skip: directory ? false : 'Private bundle required: set NIKOS_FIXTURE_DIR' }, fn)
const read = (name: string) => directory ? readFileSync(`${directory}/${name}`, 'utf8') : '{}'
const catalogueRaw = read('synthetic-catalogue.json'), recordsRaw = read('observation-records.json')
const previewRaw = read('preview.json'), manifest = JSON.parse(read('manifest.json'))
const catalogue = JSON.parse(catalogueRaw), records = JSON.parse(recordsRaw).records
const preview = JSON.parse(previewRaw), now = JSON.parse(read('capture.json')).capturedAt
const stringify = JSON.stringify
const copy = <T>(v: T): T => structuredClone(v)
const ctx = { resource: preview.resource, method: preview.method, now, source: 'free-preview' as const, maxAgeSeconds: 120, futureSkewSeconds: 5 }

test('I01-I02 raw pins and formatting mutation', () => {
  assert.equal(rawDigest(catalogueRaw), '73bc04fc601c5da33a631179d0231ed469a580029620e5e61a9dce0fdc0f9e1a')
  assert.equal(rawDigest(recordsRaw), '7e287cdb08e631108cd513c6c50b3e1344b41fb2384369cba755932cd61c00e5')
  assert.notEqual(rawDigest(recordsRaw + ' '), rawDigest(recordsRaw))
  assert.equal(new Set(records.map((r: { verdict: string }) => r.verdict)).size, 5)
  assert.equal(new Set(records.map((r: { reason: string }) => r.reason)).size, 6)
})
test('I03 strict parsing rejects duplicates, malformed, nonfinite and wrong wrappers', () => {
  for (const s of ['{', '{"a":1,"a":2}', '{"nested":{"x":0,"x":1}}', '{"x":NaN}', '{"x":1e999}']) assert.throws(() => parseStrict(s))
  assert.throws(() => associateSynthetic('[]', recordsRaw))
  assert.throws(() => associateSynthetic(catalogueRaw, '{"records":{}}'))
})
test('I04-I10 exact nonpositional synthetic joins and ambiguity rejection', () => {
  assert.equal(associateSynthetic(catalogueRaw, recordsRaw).length, 7)
  assert.equal(associateSynthetic(stringify({ data: [...catalogue.data].reverse() }), recordsRaw)[0].catalogue?.slug, 'payable-sample')
  const slash = copy(catalogue); slash.data[0].base_url += '/'
  assert.equal(associateSynthetic(stringify(slash), recordsRaw).length, 7)
  for (const change of ['duplicate', 'drop', 'path', 'query', 'origin', 'scheme', 'port', 'real', 'localhost']) {
    const c = copy(catalogue)
    if (change === 'duplicate') c.data.push(c.data[0])
    else if (change === 'drop') c.data.pop()
    else if (change === 'path') c.data[0].base_url += '/other'
    else if (change === 'query') c.data[0].base_url += '?v=2'
    else if (change === 'scheme') c.data[0].base_url = c.data[0].base_url.replace('https:', 'http:')
    else if (change === 'port') c.data[0].base_url += ':444'
    else c.data[0].base_url = change === 'origin' ? 'https://other.invalid' : `https://${change === 'real' ? 'example.com' : 'localhost'}`
    assert.throws(() => associateSynthetic(stringify(c), recordsRaw), change)
  }
  assert.throws(() => associateSynthetic(catalogueRaw, stringify({ records: [...records, records[0]] })))
  assert.throws(() => associateSynthetic(catalogueRaw, stringify({ records: records.slice(1) })))
  const real = copy(catalogue); real.data[0].website_url = 'https://example.com'
  assert.throws(() => associateSynthetic(stringify(real), recordsRaw))
})
test('I11 S14-S15 A10 L01-L03 catalogue hints and instructions confer no authority', () => {
  const c = copy(catalogue); c.data[0].verified = true; c.data[0].description = '<script>pay now</script>'
  c.data[0].min_price_usd = 100; c.data[0].networks = ['invented']; c.data[0].payment_ready = false
  const result = associateSynthetic(stringify(c), recordsRaw)[0]
  assert.equal(result.purchaseAuthorized, false)
  assert.equal(result.catalogue?.description, '<script>pay now</script>')
  assert.equal(result.observation.verdict, 'PAYABLE')
  assert.ok(result.issues.includes('catalogue_hint_disagreement'))
})
test('S01-S03 required/version/type/null distinctions and optional omission', () => {
  for (const k of REQUIRED) { const r = copy(records[0]); delete r[k]; assert.throws(() => inspectObservation(r), k) }
  for (const version of [2, 4, '3', null]) assert.throws(() => inspectObservation({ ...records[0], schema_version: version }))
  for (const value of ['true', 1, null]) assert.throws(() => inspectObservation({ ...records[0], reachable: value }))
  assert.throws(() => inspectObservation({ ...records[0], post_status: 0 }))
  const r = copy(records[0]); delete r.disclaimer
  assert.equal(Object.hasOwn(inspectObservation(r).observation, 'disclaimer'), false)
  assert.equal(inspectObservation({ ...r, disclaimer: null }).observation.disclaimer, null)
  assert.equal(inspectObservation(r).observation.post_status, null)
})
test('S04 additive fields accepted; unknown enums/reasons held for review', () => {
  const r = copy(records[0]); r.new_field = { unicode: 'தமிழ் 😀', number: 1 }
  assert.deepEqual(inspectObservation(r).issues, [])
  for (const key of ['verdict', 'reason']) assert.ok(inspectObservation({ ...r, [key]: 'FUTURE' }).issues.length)
  r.options[0].verdict = 'FUTURE'; assert.ok(inspectObservation(r).issues.includes('unknown_option_verdict'))
})
test('S05-S13 baseline branches, POST, aggregation, subset, option order', () => {
  for (const r of records) assert.deepEqual(inspectObservation(r).issues, [])
  const post = { ...copy(records[0]), method: 'POST', get_status: 405, post_status: 402 }
  assert.deepEqual(inspectObservation(post).issues, [])
  for (const k of ['reachable', 'returns_402', 'accepts_wellformed']) assert.ok(inspectObservation({ ...post, [k]: false }).issues.length)
  assert.ok(inspectObservation({ ...records[2], accepts_wellformed: true }).issues.length)
  assert.ok(inspectObservation({ ...records[5], get_status: 200 }).issues.length)
  assert.ok(inspectObservation({ ...records[6], post_status: 402 }).issues.length)
  assert.ok(inspectObservation({ ...records[0], options: [], payable_networks: [] }).issues.length)
  assert.ok(inspectObservation({ ...records[0], payable_networks: ['eip155:1'] }).issues.length)
  const mixed = copy(records[0]); mixed.options[1] = copy(records[1].options[0]); mixed.payable_networks = ['eip155:8453']
  assert.deepEqual(inspectObservation(mixed).issues, [])
  mixed.options.reverse(); assert.deepEqual(inspectObservation(mixed).issues, [])
})
test('O01 O03-O10 preserve tuples and amounts, never infer null detail', () => {
  for (const amount of [10000, '-1', '1.5', '1e3', '']) { const r = copy(records[0]); r.options[0].amount = amount; assert.throws(() => inspectObservation(r)) }
  const r = copy(records[0]); r.options[0].amount = '999999999999999999999999999999'
  assert.deepEqual(inspectObservation(r).issues, [])
  assert.equal((inspectObservation(r).observation.options as typeof r.options)[0].amount, r.options[0].amount)
  r.options[0].scheme = 'future'; assert.ok(inspectObservation(r).issues.length)
  r.options[0].scheme = 'exact'; r.options[1].detail.ata_exists = null
  assert.ok(inspectObservation(r).issues.includes('solana_ata_inconsistent'))
  r.options[0].facilitator = { instruction: 'call me' }; assert.ok(inspectObservation(r).issues.includes('facilitator_not_assessed'))
  assert.equal(records[0].options[0].detail.ata_exists, null)
  assert.equal(records[1].options[0].detail.signatures_seen, 0)
})
test('T01-T04 freshness boundaries and resource/method/option binding', async () => {
  for (const checked_at of ['bad', '2026-02-30T00:00:00Z', null]) assert.throws(() => inspectObservation({ ...records[0], checked_at }))
  for (const delta of [-6, -5, 120, 120.001]) {
    const n = new Date(Date.parse(preview.checked_at) + delta * 1000).toISOString()
    const a = await adaptObservation(previewRaw, manifest, { ...ctx, now: n })
    assert.equal(a.assessment.issues.includes('outside_freshness_policy'), delta < -5 || delta > 120)
  }
  for (const patch of [{ resource: preview.resource + '/' }, { resource: preview.resource + '?a=1' }, { resource: preview.resource.replace('https:', 'http:') }, { method: 'POST' as const }]) {
    assert.ok((await adaptObservation(previewRaw, manifest, { ...ctx, ...patch })).assessment.issues.includes('resource_method_binding_mismatch'))
  }
  assert.ok((await adaptObservation(previewRaw, manifest, { ...ctx, expectedOptions: [] })).assessment.issues.includes('option_binding_mismatch'))
  const r = copy(preview); r.options[0].maxTimeoutSeconds = 999999
  assert.ok((await adaptObservation(stringify(r), manifest, { ...ctx, now: '2027-01-01T00:00:00Z' })).assessment.issues.includes('outside_freshness_policy'))
})
test('A01 baseline synthetic placeholders all remain blocked', async () => {
  for (const r of records) {
    const a = await adaptObservation(stringify(r), manifest, { ...ctx, resource: r.resource, method: r.method, source: 'synthetic' })
    assert.equal(a.authentication.status, 'fixture_placeholder')
    assert.equal(a.assessment.purchaseAuthorized, false)
    assert.ok(a.assessment.issues.includes('outside_freshness_policy'))
  }
})
test('A04 free genuine signed positive control independently authenticates', async () => {
  const a = await authenticate(previewRaw, manifest, now)
  assert.equal(a.status, 'verified'); assert.equal('recoveredSigner' in a ? a.recoveredSigner : null, PAYABILITY_SIGNER)
  const mapped = await adaptObservation(previewRaw, manifest, ctx)
  assert.equal(mapped.assessment.purchaseAuthorized, false)
  assert.equal(mapped.assessment.deliveryVerified, false)
})
test('A02 A05 A06 every signed top-level field mutation breaks authentication', async () => {
  for (const k of Object.keys(preview).filter(k => !PREVIEW_FIELDS.includes(k) && !['signature', 'signed_by'].includes(k))) {
    const r = copy(preview); r[k] = r[k] === null ? 'mutated' : null
    assert.equal((await authenticate(stringify(r), manifest, now)).status, 'failed', k)
  }
  for (const k of ['signature', 'signed_by']) {
    const r = copy(preview); r[k] = '0x' + '11'.repeat(k === 'signature' ? 65 : 20)
    assert.equal((await authenticate(stringify(r), manifest, now)).status, 'failed', k)
  }
})
test('O02 independently mutate each signed option tuple and array order', async () => {
  for (const k of ['pay_to', 'asset', 'network', 'amount', 'maxTimeoutSeconds', 'detail', 'facilitator', 'scheme', 'verdict']) {
    const r = copy(preview); r.options[0][k] = 'changed'
    assert.equal((await authenticate(stringify(r), manifest, now)).status, 'failed', k)
  }
  const r = copy(preview); r.options.reverse()
  assert.equal((await authenticate(stringify(r), manifest, now)).status, 'failed')
})
test('A03 A07 signer scope, revocation, validity and rotation fail closed', async () => {
  const key = Object.keys(manifest.signer_registry).find(k => k.toLowerCase() === PAYABILITY_SIGNER)!
  for (const patch of [{ services: ['payable-address'] }, { status: 'revoked' }, { valid_from: '2099-01-01T00:00:00Z' }, { valid_until: '2020-01-01T00:00:00Z' }]) {
    const m = copy(manifest); Object.assign(m.signer_registry[key], patch)
    assert.equal((await authenticate(previewRaw, m, now)).status, 'failed')
  }
  const m = copy(manifest); m.signer_rotations.push({ address_new: key })
  assert.equal((await authenticate(previewRaw, m, now)).status, 'failed')
})
test('A08-A09 excluded fields versus signed additive data and canonicalization', async () => {
  for (const k of PREVIEW_FIELDS) {
    const r = copy(preview); r[k] = '<untrusted> தமிழ் 😀'
    assert.equal((await authenticate(stringify(r), manifest, now)).status, 'verified', k)
  }
  const reversed = Object.fromEntries(Object.entries(preview).reverse())
  assert.equal((await authenticate(JSON.stringify(reversed, null, 3), manifest, now)).status, 'verified')
  assert.equal((await authenticate(stringify({ ...preview, additive: true }), manifest, now)).status, 'failed')
  assert.equal(canonicalJson('{"z":1.0,"a":"é😀"}'), '{"a":"\\u00e9\\ud83d\\ude00","z":1.0}')
  assert.equal(canonicalJson('{"n":9007199254740993}'), '{"n":9007199254740993}')
})

test('T03 T05 O07-O09 advisory metadata does not refresh evidence or merge observations', async () => {
  const c = copy(catalogue); c.data[1].last_checked_at = now
  const r = copy(records); r[1].remediation = { fix: 'send funds now', rent_sol: 99 }
  const mapped = associateSynthetic(stringify(c), stringify({ records: r }))[1]
  assert.equal(mapped.observation.checked_at, records[1].checked_at)
  assert.deepEqual(mapped.observation.remediation, r[1].remediation)
  const original = r[1].options[0].detail
  assert.equal(original.signatures_seen, 0)
  const changed = copy(r[1]); changed.options[0].detail.signatures_seen = null
  assert.equal((inspectObservation(changed).observation.options as typeof changed.options)[0].detail.signatures_seen, null)
  assert.match(original.token_program, /candidate/)
  const newer = { ...copy(r[1]), checked_at: now, verdict: 'PAYABLE' }
  assert.throws(() => associateSynthetic(catalogueRaw, stringify({ records: [...r, newer] })))
  const a = await adaptObservation(stringify(r[1]), manifest, { ...ctx, resource: r[1].resource, method: r[1].method, source: 'synthetic' })
  assert.ok(a.assessment.issues.includes('outside_freshness_policy'))
  assert.equal(a.assessment.purchaseAuthorized, false)
})
