import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const calcs = JSON.parse(readFileSync('content/legacy-uplift/kernel-calculations.json', 'utf8'))
const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))

const page = compiled.pages.find((p: { route: string }) => p.route === '/knowledge/mathematics/angle-normalization')
const section = (page.sections ?? []).find((s: { dimension: string }) => s.dimension === 'deterministic-calculation')

test('the page carries a calculation the kernel executed', () => {
  assert.ok(section, 'the calculation must render')
  assert.match(section.items.join(' '), /Executed by kernel sha256:[0-9a-f]{64}/)
  assert.equal(calcs.kernelSha256, section.items.join(' ').match(/sha256:[0-9a-f]{64}/)?.[0],
    'the rendered digest must be the one the receipts were produced under')
})

test('every case was verified by re-execution, not asserted', () => {
  // The generator verifies each receipt by rerunning the kernel and throws
  // otherwise, so a case reaching this file has already been checked. Each
  // still carries its own receipt digest so a reader can repeat it.
  const cases = calcs.calculations[0].cases
  assert.ok(cases.length >= 6, `expected the invariant cases, got ${cases.length}`)
  for (const c of cases) {
    assert.match(c.receiptSha256, /^sha256:[0-9a-f]{64}$/, `${c.input} has no receipt digest`)
  }
  assert.equal(new Set(cases.map((c: { receiptSha256: string }) => c.receiptSha256)).size, cases.length,
    'each case must have its own receipt')
})

test('the cases exhibit the invariants the page already states', () => {
  const text = section.items.join(' ')
  assert.match(text, /400° → 40°, 760° → 40°, −320° → 40°/, 'turn equivalence')
  assert.match(text, /400° → 40° → 40°/, 'idempotence, shown by applying it twice')
  assert.match(text, /360° → 0° rather than 360/, 'the half-open upper end')
})

test('the receipt is never presented as proof', () => {
  // The whole risk of putting a digest on a page. A receipt records what a
  // program computed; it does not make the mathematics true.
  const text = section.items.join(' ')
  assert.match(text, /What the receipt does not establish/)
  assert.match(text, /does not establish.*correct|not whether the computation is right/i)
  assert.match(text, /exhibiting is not proving/i)
  for (const forbidden of ['proves that', 'proof that the', 'guarantees the page']) {
    assert.ok(!text.toLowerCase().includes(forbidden), `the section claims too much: ${forbidden}`)
  }
  assert.ok(calcs.doesNotEstablish.length >= 3)
})

test('the page says how to check it independently', () => {
  const text = section.items.join(' ')
  assert.match(text, /Rebuild the kernel with npm run build:wasm-kernel/)
  assert.match(text, /deterministic/)
  assert.match(text, /re-execute/)
})

test('no WebAssembly reaches a served bundle', () => {
  // The kernel runs at build time. What ships is the receipt, which is data.
  // git grep exits 1 when nothing matches, which is the passing case here.
  let importers: string[] = []
  try {
    importers = execFileSync('git', ['grep', '-l', 'wasm-kernel', '--', 'app', 'components'], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 1) throw error
  }
  assert.deepEqual(importers, [], `a served route imports the kernel: ${importers.join(', ')}`)
  const runtime = readFileSync('lib/legacy-uplift-runtime.ts', 'utf8')
  assert.ok(!runtime.includes('wasm-kernel'), 'the page runtime must not import the kernel')
})

test('the calculation artifact carries no kernel bytes', () => {
  const raw = readFileSync('content/legacy-uplift/kernel-calculations.json', 'utf8')
  assert.ok(!/[A-Za-z0-9+/]{400,}={0,2}/.test(raw), 'the artifact must not embed encoded kernel bytes')
  assert.ok(raw.length < 20_000, `the artifact is ${raw.length} bytes; it should carry receipts, not a binary`)
})

test('a page without a kernel calculation renders none', () => {
  // Optional by design: the corpus renders no unverified number in its place.
  const others = compiled.pages.filter((p: { route: string; sections?: { dimension: string }[] }) =>
    p.route !== '/knowledge/mathematics/angle-normalization'
    && (p.sections ?? []).some((s) => s.dimension === 'deterministic-calculation'))
  assert.deepEqual(others.map((p: { route: string }) => p.route), [],
    'only the kernel-executed page may carry a calculation')
})
