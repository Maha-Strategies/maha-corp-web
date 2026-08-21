import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { compileContextPack, parseContextPackRequest } from '../lib/context-compiler.ts'
import {
  LOCAL_SELECTOR_MINIMUM_TOKENS,
  PRIVACY_BOUNDARY,
  nodeHost,
  portableHost,
  selectLocally,
} from '../lib/local-selector/index.ts'
import { parseLocalSelectorRequest } from '../lib/local-selector/contract.ts'

const ROOT = join(import.meta.dirname, '..')
const fixture = (name: string) => JSON.parse(readFileSync(join(ROOT, 'test/fixtures/local-selector', name), 'utf8'))
const large = () => fixture('release-evidence.json')
const small = () => fixture('below-minimum.json')

test('identical input and policy version produce identical output', () => {
  const first = selectLocally(large())
  const second = selectLocally(large())
  // packId is a fresh identifier by design; everything a reviewer would check
  // must be byte-identical.
  const stable = (result: typeof first) => ({ ...result, packId: '<fresh>' })
  assert.deepEqual(stable(first), stable(second))
  assert.equal(first.hashes.inputHash, second.hashes.inputHash)
  assert.equal(first.hashes.outputHash, second.hashes.outputHash)
})

test('the declared budget is enforced, not advised', () => {
  const result = selectLocally(large())
  assert.equal(result.bypass.applied, false)
  assert.ok(result.budget.used <= result.budget.declared, `used ${result.budget.used} > declared ${result.budget.declared}`)
  assert.equal(result.budget.satisfied, true)
  assert.ok(result.budget.selectionAllowance < result.budget.declared, 'guaranteed mode should reserve headroom')
})

/** An offset a reviewer cannot check is not provenance. */
test('every retained passage locates exactly in its own source', () => {
  const request = large()
  const result = selectLocally(request)
  assert.ok(result.retained.length > 0)

  const normalize = (value: string) => value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const sources = new Map(request.documents.map((document: { id: string; text: string }) => [document.id, normalize(document.text)]))

  for (const passage of result.retained) {
    const source = sources.get(passage.sourceId) as string
    const bytes = Buffer.from(source, 'utf8')
    const slice = bytes.subarray(passage.sourceStartByte, passage.sourceEndByte).toString('utf8')
    assert.equal(slice, passage.text, `offsets for ${passage.passageId} do not select its own text`)
    assert.ok(passage.sourceEndByte > passage.sourceStartByte)
    assert.equal(passage.passageHash, `sha256:${createHash('sha256').update(passage.text).digest('hex')}`)
  }
})

test('duplicate passages are removed and reported', () => {
  const result = selectLocally(large())
  assert.ok(result.metrics.duplicatePassagesRemoved > 0, 'the fixture contains a duplicate paragraph')
  assert.ok(result.reasonCodes.includes('dropped_duplicate'))
  const ids = result.retained.map((passage) => passage.passageId)
  assert.equal(new Set(ids).size, ids.length, 'a passage was retained twice')
})

test('a small input is bypassed and never made more expensive', () => {
  const result = selectLocally(small())
  assert.equal(result.bypass.applied, true)
  assert.equal(result.bypass.reason, 'below_minimum_size')
  assert.ok(result.reasonCodes.includes('bypassed_below_minimum'))
  assert.equal(result.retained.length, 0)
  assert.equal(result.metrics.tokensSaved, 0)
  assert.ok(
    result.metrics.compiledEstimatedTokens <= result.metrics.originalEstimatedTokens,
    'the bypass produced a larger context than the original',
  )
  assert.ok(result.metrics.originalEstimatedTokens < LOCAL_SELECTOR_MINIMUM_TOKENS)
})

test('required evidence retention is measured, not assumed', () => {
  const result = selectLocally(large())
  assert.ok(result.evidence && result.evidence.length === 3)
  for (const entry of result.evidence) {
    assert.equal(typeof entry.retained, 'boolean')
  }
  // The fixture is built so the labelled spans are findable; this asserts the
  // measurement works, not that retention is guaranteed.
  assert.ok(result.evidence.some((entry) => entry.retained), 'no labelled span survived a 512-token budget')
})

test('malformed input is refused rather than half-answered', () => {
  const cases: [unknown, RegExp][] = [
    ['a string', /must be a JSON object/],
    [{ ...large(), contractVersion: '9.9.9' }, /Unsupported contract version/],
    [{ ...large(), task: 'short' }, /at least 8 characters/],
    [{ ...large(), tokenBudget: 12 }, /at least 64/],
    [{ ...large(), documents: [] }, /at least one source document/],
    [{ ...large(), documents: [{ id: '', text: 'x' }] }, /id must be a non-empty string/],
    [{ ...large(), documents: [{ id: 'a', text: '' }] }, /text must be a non-empty string/],
    [{ ...large(), documents: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }, /must be unique/],
  ]
  for (const [input, pattern] of cases) {
    assert.throws(() => parseLocalSelectorRequest(input), pattern)
    assert.throws(() => selectLocally(input), pattern)
  }
})

/**
 * The privacy claim is that Maha code makes no call. Asserting it by reading
 * the source would prove nothing; this replaces the network primitives and
 * fails if any is touched.
 */
test('selection makes no network call and emits no telemetry', () => {
  const touched: string[] = []
  const globals = globalThis as Record<string, unknown>
  // Some of these are getter-only in modern Node, so they are replaced through
  // their property descriptor rather than by assignment.
  const saved = new Map<string, PropertyDescriptor | undefined>()
  const trap = (name: string) => new Proxy(function () {} as unknown as object, {
    apply: () => { touched.push(name); throw new Error(`network primitive ${name} was called`) },
    get: () => { touched.push(name); throw new Error(`network primitive ${name} was read`) },
  })

  const instrumented: string[] = []
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'navigator']) {
    const descriptor = Object.getOwnPropertyDescriptor(globals, name)
    if (descriptor && descriptor.configurable === false) continue
    saved.set(name, descriptor)
    Object.defineProperty(globals, name, { value: trap(name), configurable: true, writable: true })
    instrumented.push(name)
  }
  assert.ok(instrumented.includes('fetch'), 'fetch could not be instrumented, so this test proves nothing')

  try {
    const result = selectLocally(large())
    assert.ok(result.retained.length > 0)
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globals, name, descriptor)
      else delete globals[name]
    }
  }
  assert.deepEqual(touched, [], `selection touched: ${touched.join(', ')}`)
})

test('the declared privacy boundary matches what the runtime does', () => {
  const result = selectLocally(large())
  assert.deepEqual(result.boundaries, PRIVACY_BOUNDARY)
  assert.equal(PRIVACY_BOUNDARY.networkCallsMade, 0)
  assert.equal(PRIVACY_BOUNDARY.modelInferencePerformed, false)
  assert.equal(PRIVACY_BOUNDARY.cloudFallbackAvailable, false)
  assert.equal(PRIVACY_BOUNDARY.metadataExportRequiresCallerAction, true)
  // The list of things deliberately not claimed must not quietly shrink.
  assert.ok(PRIVACY_BOUNDARY.notClaimed.length >= 5)
  assert.ok(PRIVACY_BOUNDARY.notClaimed.some((entry) => /browser|operating system/i.test(entry)))
})

/** Parity: the local runtime must not become a second selector. */
test('local selection matches the shared Context Compiler on the frozen fixture', () => {
  const request = large()
  const local = selectLocally(request)
  const shared = compileContextPack(parseContextPackRequest({
    clientRequestId: 'parity-check-fixture',
    task: request.task,
    tokenBudget: request.tokenBudget,
    documents: request.documents,
    provenance: 'compact',
    scoring: 'bm25',
    budgetMode: 'guaranteed',
  }))
  assert.equal(local.context, shared.context, 'the local runtime selected a different pack')
  assert.deepEqual(
    local.retained.map((passage) => passage.passageId),
    shared.includedPassages.map((passage) => passage.passageId),
  )
  assert.equal(local.metrics.compiledEstimatedTokens, shared.metrics.compiledEstimatedTokens)
  assert.equal(local.metrics.duplicatePassagesRemoved, shared.metrics.duplicatePassagesRemoved)
})

/**
 * Injected host helpers must preserve hashes and UTF-8 byte offsets. This does
 * not prove the Node-only shared compiler can load in a browser or WASM host.
 */
test('injected host helpers preserve hash and offset behaviour', () => {
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const host = portableHost(digest)
  const result = selectLocally(large(), { host })
  assert.ok(result.retained.length > 0)
  assert.match(result.hashes.inputHash, /^sha256:[0-9a-f]{64}$/)
  assert.match(result.packId, /^localpack_[0-9a-f]{32}$/)

  // Offsets must agree with the Node host, or the port would silently differ.
  const viaNode = selectLocally(large(), { host: nodeHost })
  assert.deepEqual(
    result.retained.map((passage) => [passage.sourceStartByte, passage.sourceEndByte]),
    viaNode.retained.map((passage) => [passage.sourceStartByte, passage.sourceEndByte]),
  )
})

test('the fixtures are sanitized and say so', () => {
  for (const name of ['release-evidence.json', 'below-minimum.json']) {
    const record = fixture(name)
    assert.equal(record.sanitization.synthetic, true)
    assert.equal(record.sanitization.containsCustomerData, false)
    assert.equal(record.sanitization.containsPersonalData, false)
    assert.equal(record.sanitization.containsSecrets, false)
  }
})

test('the WASM feasibility boundary is measured, and no artifact is implied', async () => {
  const { execFileSync } = await import('node:child_process')
  const output = execFileSync('node', ['--experimental-strip-types', 'scripts/probe-local-selector-wasm-feasibility.ts'],
    { cwd: ROOT, encoding: 'utf8' })
  const report = JSON.parse(output) as {
    status: string
    artifactPublished: boolean
    blockers: string[]
    languageFeatures: Record<string, number>
    hostSeams: Record<string, string>
  }
  assert.equal(report.artifactPublished, false, 'a .wasm artifact must not be published without a real build')
  assert.ok(['buildable', 'not-buildable-here'].includes(report.status))
  if (report.status === 'not-buildable-here') {
    assert.ok(report.blockers.length > 0, 'a not-buildable verdict must name its blockers')
  }
  // The Unicode dependency is the finding worth keeping visible: a port with a
  // non-ICU regex engine changes selection for non-Latin text silently.
  assert.ok(report.languageFeatures.unicodePropertyEscapes > 0)
  assert.ok(Object.keys(report.hostSeams).length >= 3)
})

test('no .wasm artifact is committed', async () => {
  const { execFileSync } = await import('node:child_process')
  const tracked = execFileSync('git', ['ls-files', '*.wasm'], { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(tracked, '', `a .wasm artifact is committed without a reproducible build: ${tracked}`)
})
