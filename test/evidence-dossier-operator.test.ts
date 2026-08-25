import assert from 'node:assert/strict'
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_NODES,
  MAX_PAYLOAD_BYTES,
  NormalizationError,
  normalizeValue,
  parseBoundedJson,
  sanitizeExportFilename,
  unknownFields,
} from '../lib/evidence-dossier/normalize.ts'
import { DOSSIER_PACKAGE_VERSION, evidentiaryProjection, type DossierPackage } from '../lib/evidence-dossier/package.ts'
import { validatePackage, verifyParent } from '../lib/evidence-dossier/package-validator.ts'
import { createInMemoryStore, createFixtureStore, StorageConflictError } from '../lib/evidence-dossier/storage.ts'
import { refuseTransition, requiresNewRevision, OPERATOR_FORBIDDEN_STATES } from '../lib/evidence-dossier/revision.ts'
import { buildReviewerPacket, serializePacket, REVIEW_CHECKLIST, PACKET_NONCLAIMS } from '../lib/evidence-dossier/packet.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { DOSSIER_SCHEMA_VERSION } from '../lib/evidence-dossier/schema.ts'
import { FRONTIER_CANARY_RECORDS, FRONTIER_CANARY_CONTROL_RECORDS } from '../lib/frontier-canonicalization.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'

const FIXTURES = new URL('../content/evidence-dossier/fixtures/', import.meta.url).pathname
const load = (name: string) => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8')) as DossierPackage
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/* ------------------------------------------------------------- fixtures -- */

test('all seven fixtures exist', () => {
  const names = readdirSync(FIXTURES).filter((n) => n.endsWith('.json')).sort()
  assert.deepEqual(names, [
    'attempted-canonical-promotion.json',
    'invalid-parent-digest.json',
    'malformed.json',
    'missing-locator.json',
    'prohibited-certification-wording.json',
    'valid-v0-2.json',
    'valid-v0-3-revision.json',
  ])
})

test('the valid fixture is schema-compatible with v0.2 and validates', () => {
  const pkg = load('valid-v0-2')
  assert.equal(pkg.packageVersion, DOSSIER_PACKAGE_VERSION)
  assert.equal(pkg.schemaVersion, DOSSIER_SCHEMA_VERSION)
  assert.equal(pkg.dossier.sources.length, 3)
  assert.equal(pkg.dossier.claims.length, 12)
  assert.equal(pkg.dossier.comparisons.length, 1)
  assert.deepEqual(validatePackage(pkg, { computeDigest: provenanceDigest }), [])
})

test('each invalid fixture fails for its own reason', () => {
  const cases: [string, string][] = [
    ['missing-locator', 'locator-missing'],
    ['prohibited-certification-wording', 'prohibited-wording'],
  ]
  for (const [name, code] of cases) {
    const issues = validatePackage(load(name), { computeDigest: provenanceDigest })
    assert.ok(issues.some((issue) => issue.code === code), `${name} did not report ${code}`)
    assert.ok(
      !issues.some((issue) => issue.code === 'payload-digest-mismatch'),
      `${name} must isolate one defect, not also fail its digest`,
    )
  }
})

test('the malformed fixture fails without throwing', () => {
  const issues = validatePackage(load('malformed'), { computeDigest: provenanceDigest })
  assert.ok(issues.length > 3)
  for (const issue of issues) assert.match(issue.path, /^\$/)
})

/* --------------------------------------------------------- normalization -- */

test('normalization is deterministic and canonicalizes unicode and instants', () => {
  const a = normalizeValue({ when: '2026-08-25T18:00:00+00:00', s: 'é' })
  const b = normalizeValue({ s: 'é', when: '2026-08-25T18:00:00Z' })
  assert.deepEqual(a, b)
})

test('structural limits reject pathological documents', () => {
  let deep: unknown = 'leaf'
  for (let i = 0; i < MAX_DEPTH + 5; i += 1) deep = { nested: deep }
  assert.throws(() => normalizeValue(deep), NormalizationError)

  assert.throws(() => normalizeValue({ big: new Array(MAX_ARRAY_LENGTH + 1).fill(1) }), NormalizationError)
  assert.throws(() => normalizeValue({ s: 'x'.repeat(20_001) }), NormalizationError)
  assert.throws(() => parseBoundedJson('"' + 'x'.repeat(MAX_PAYLOAD_BYTES + 10) + '"'), NormalizationError)
  assert.ok(MAX_NODES > 0)
})

test('prototype-polluting keys are refused', () => {
  const hostile = JSON.parse('{"__proto__":{"polluted":true}}')
  assert.throws(() => normalizeValue(hostile), /prototype-polluting/)
})

test('unknown fields are reported by path', () => {
  const paths = unknownFields({ known: 1, sneaky: 2 }, ['known'], '$')
  assert.deepEqual(paths, ['$.sneaky'])
})

test('export filenames are sanitized', () => {
  assert.equal(sanitizeExportFilename('../../etc/passwd'), 'etc-passwd')
  assert.equal(sanitizeExportFilename('a b/c:d'), 'a-b-c-d')
  assert.equal(sanitizeExportFilename('..'), 'dossier')
  assert.ok(!sanitizeExportFilename('x'.repeat(500)).includes('/'))
  assert.ok(sanitizeExportFilename('x'.repeat(500)).length <= 96)
})

/* ------------------------------------------------------------- lineage -- */

test('a parent digest is required once a prior revision exists', () => {
  const parent = load('valid-v0-2')
  const orphan = clone(load('valid-v0-3-revision'))
  orphan.parentDigest = null
  assert.ok(verifyParent(orphan, parent).some((i) => i.code === 'parent-digest-required'))
})

test('a mismatched parent digest is rejected', () => {
  const parent = load('valid-v0-2')
  const bad = load('invalid-parent-digest')
  assert.ok(verifyParent(bad, parent).some((i) => i.code === 'parent-digest-mismatch'))
})

test('the v0.3 fixture chains correctly to v0.2 and changes the digest', () => {
  const parent = load('valid-v0-2')
  const child = load('valid-v0-3-revision')
  assert.deepEqual(verifyParent(child, parent), [])
  assert.equal(child.parentDigest, parent.canonicalPayloadDigest)
  assert.notEqual(child.canonicalPayloadDigest, parent.canonicalPayloadDigest)
  assert.deepEqual(validatePackage(child, { computeDigest: provenanceDigest }), [])
  // The v0.3 change is editorial: a limitation, not a new scientific assertion.
  assert.equal(child.dossier.claims.length, parent.dossier.claims.length)
  assert.ok(child.dossier.limitations.length > parent.dossier.limitations.length)
})

/* ------------------------------------------------------- append-only -- */

test('the store appends and refuses replacement', async () => {
  const store = createInMemoryStore()
  const first = load('valid-v0-2')
  await store.append(first)
  await assert.rejects(() => store.append(first), StorageConflictError)

  const conflicting = clone(first)
  conflicting.dossier.title = 'changed'
  conflicting.canonicalPayloadDigest = provenanceDigest(evidentiaryProjection(conflicting))
  await assert.rejects(() => store.append(conflicting), StorageConflictError)
})

test('the store has no replace or delete in its interface', () => {
  const store = createInMemoryStore() as unknown as Record<string, unknown>
  for (const forbidden of ['replace', 'update', 'delete', 'remove', 'truncate']) {
    assert.equal(store[forbidden], undefined, `store must not expose ${forbidden}`)
  }
})

test('history preserves exact prior revisions in order', async () => {
  const store = createInMemoryStore()
  await store.append(load('valid-v0-2'))
  await store.append(load('valid-v0-3-revision'))
  const history = await store.history('pkg-euv-resist-stochastics')
  assert.equal(history.length, 2)
  assert.deepEqual(history.map((r) => r.revisionId), ['rev-0002', 'rev-0003'])
  const exact = await store.get('pkg-euv-resist-stochastics', 'rev-0002')
  assert.equal(exact?.canonicalPayloadDigest, load('valid-v0-2').canonicalPayloadDigest)
})

test('the fixture store refuses to overwrite a revision file', async () => {
  const dir = `/tmp/dossier-test-${process.pid}`
  rmSync(dir, { recursive: true, force: true })
  const store = createFixtureStore(dir)
  await store.append(load('valid-v0-2'))
  await assert.rejects(() => store.append(load('valid-v0-2')), StorageConflictError)
  rmSync(dir, { recursive: true, force: true })
})

/* ---------------------------------------------------- revision workflow -- */

test('canonical and external-review states are unreachable from the operator', () => {
  const from = load('valid-v0-2')
  for (const state of OPERATOR_FORBIDDEN_STATES) {
    const refusal = refuseTransition({ from, toState: state })
    assert.equal(refusal?.code, 'state-not-operator-reachable', `${state} must be refused`)
  }
  assert.ok(OPERATOR_FORBIDDEN_STATES.includes('canonical'))
})

test('internal audit requires a decision with a substantive rationale', () => {
  const from = load('valid-v0-2')
  assert.equal(refuseTransition({ from, toState: 'internally-audited' })?.code, 'decision-required')
  assert.equal(
    refuseTransition({
      from,
      toState: 'internally-audited',
      decision: { decision: 'ok', rationale: 'fine', decidedBy: 'internal-editorial', decidedAt: '2026-08-25' },
    })?.code,
    'rationale-required',
  )
  assert.equal(
    refuseTransition({
      from,
      toState: 'internally-audited',
      decision: {
        decision: 'accept',
        rationale: 'Every locator was opened and each audited statement was checked against its passage.',
        decidedBy: 'internal-editorial',
        decidedAt: '2026-08-25',
      },
    }),
    null,
  )
})

test('a revised draft after audit is allowed', () => {
  const audited = clone(load('valid-v0-2'))
  audited.reviewState = 'internally-audited'
  assert.equal(refuseTransition({ from: audited, toState: 'illustrative-draft' }), null)
})

test('changing evidence requires a new revision; presentation alone does not', () => {
  const base = load('valid-v0-2')

  const presentationOnly = clone(base)
  presentationOnly.presentation = { showComparisonMatrix: false, showPriorRevisions: false, printLayout: 'compact' }
  presentationOnly.canonicalPayloadDigest = provenanceDigest(evidentiaryProjection(presentationOnly))
  assert.equal(presentationOnly.canonicalPayloadDigest, base.canonicalPayloadDigest)
  assert.equal(requiresNewRevision(base, presentationOnly), false)

  const evidenceChanged = clone(base)
  evidenceChanged.dossier.claims[0].auditedStatement += ' (adjusted)'
  evidenceChanged.canonicalPayloadDigest = provenanceDigest(evidentiaryProjection(evidenceChanged))
  assert.notEqual(evidenceChanged.canonicalPayloadDigest, base.canonicalPayloadDigest)
  assert.equal(requiresNewRevision(base, evidenceChanged), true)
})

/* ------------------------------------------------------ reviewer packet -- */

test('the reviewer packet is deterministic and complete', () => {
  const pkg = load('valid-v0-2')
  const a = buildReviewerPacket(pkg)
  const b = buildReviewerPacket(clone(pkg))
  assert.equal(serializePacket(a), serializePacket(b))

  assert.equal(a.claims.length, pkg.dossier.claims.length)
  assert.equal(a.sources.length, pkg.dossier.sources.length)
  assert.ok(a.comparisonMatrix.length >= 1)
  assert.ok(a.reviewChecklist.length >= 5)
  assert.deepEqual([...a.reviewChecklist], [...REVIEW_CHECKLIST])
  assert.deepEqual([...a.nonClaims], [...PACKET_NONCLAIMS])
  assert.ok(a.revisionLineage.length >= 2)
  assert.match(a.nonClaims.join(' '), /not an approval|not.*certification/i)
})

test('the packet names a missing locator rather than hiding it', () => {
  const pkg = clone(load('valid-v0-2'))
  pkg.dossier.passages[0].locator = null
  const packet = buildReviewerPacket(pkg)
  assert.ok(packet.claims.some((claim) => claim.locators.some((l) => l.includes('MISSING LOCATOR'))))
})

/* ---------------------------------------------------------- local-only -- */

/** Strip comments so a guard matches real code, not prose describing it. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CONSOLE = codeOnly(
  readFileSync(new URL('../app/internal/evidence-dossier/operator/OperatorConsole.tsx', import.meta.url), 'utf8'),
)
const CONSOLE_RAW = readFileSync(
  new URL('../app/internal/evidence-dossier/operator/OperatorConsole.tsx', import.meta.url),
  'utf8',
)
const OPERATOR_PAGE = codeOnly(
  readFileSync(new URL('../app/internal/evidence-dossier/operator/page.tsx', import.meta.url), 'utf8'),
)

test('the console makes no network request and posts nothing', () => {
  assert.doesNotMatch(CONSOLE, /\bfetch\s*\(/)
  assert.doesNotMatch(CONSOLE, /XMLHttpRequest|navigator\.sendBeacon|WebSocket|EventSource/)
  assert.doesNotMatch(CONSOLE, /<form\b/)
  assert.doesNotMatch(CONSOLE, /useRouter|router\.push|redirect\(/)
  assert.doesNotMatch(CONSOLE, /analytics|gtag|dataLayer|track\(/i)
})

test('content never enters a URL, log or telemetry channel', () => {
  assert.doesNotMatch(CONSOLE, /console\.(log|info|warn|error)/)
  assert.doesNotMatch(CONSOLE, /location\.(search|hash|href)\s*=/)
  assert.doesNotMatch(CONSOLE, /URLSearchParams/)
  assert.doesNotMatch(CONSOLE, /localStorage|sessionStorage|document\.cookie/)
})

test('rendering is XSS-safe by construction', () => {
  assert.doesNotMatch(CONSOLE, /dangerouslySetInnerHTML/)
  assert.doesNotMatch(CONSOLE, /innerHTML/)
  assert.doesNotMatch(CONSOLE, /eval\(|new Function\(/)
})

test('the console carries the local-only label and bounded file size', () => {
  assert.match(CONSOLE_RAW, /Local validation only/)
  assert.match(CONSOLE_RAW, /not uploaded or published/)
  assert.match(CONSOLE, /MAX_PAYLOAD_BYTES/)
})

test('the operator page is noindex, nofollow and nocache with no write handler', () => {
  assert.match(OPERATOR_PAGE, /index: false/)
  assert.match(OPERATOR_PAGE, /follow: false/)
  assert.match(OPERATOR_PAGE, /nocache: true/)
  assert.doesNotMatch(OPERATOR_PAGE, /export async function (POST|PUT|PATCH|DELETE)/)
})

test('no dossier write API route exists', () => {
  const apiRoot = new URL('../app/api', import.meta.url).pathname
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
  const routes = walk(apiRoot).map((p) => p.slice(apiRoot.length)).filter((r) => /dossier/i.test(r))
  assert.deepEqual(routes, [])
})

test('the ingestion command refuses credential-shaped arguments and logs no payload', () => {
  const cli = readFileSync(new URL('../scripts/ingest-evidence-dossier.ts', import.meta.url), 'utf8')
  assert.match(cli, /Refusing a credential-shaped argument/)
  assert.doesNotMatch(cli, /console\.log\(\s*raw|console\.log\(\s*JSON\.stringify\(pkg\b/)
  assert.match(cli, /published: false/)
  assert.match(cli, /promoted: false/)
})

/* ------------------------------------------------------------ isolation -- */

test('the operator surfaces are absent from sitemap, llms.txt and public links', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /evidence-dossier/)
  }
  const navbar = readFileSync(new URL('../components/Navbar.tsx', import.meta.url), 'utf8')
  const footer = readFileSync(new URL('../components/SiteFooter.tsx', import.meta.url), 'utf8')
  for (const source of [navbar, footer]) {
    assert.doesNotMatch(source, /evidence-dossier/)
  }
})

test('nothing here touches Q-BR-001..012', () => {
  const packet = serializePacket(buildReviewerPacket(load('valid-v0-2')))
  for (const candidate of QUANTUM_BRIDGE_CANDIDATES) {
    assert.ok(!packet.includes(candidate.id))
  }
})

test('the frontier canary cohort is unchanged', () => {
  assert.equal(FRONTIER_CANARY_RECORDS.length, 40)
  assert.equal(FRONTIER_CANARY_CONTROL_RECORDS.length, 200)
})

test('the browser path pulls in no Node crypto', () => {
  // node:crypto in the client bundle means a polyfill ships to every operator.
  for (const file of [
    'lib/evidence-dossier/canonical.ts',
    'lib/evidence-dossier/normalize.ts',
    'lib/evidence-dossier/package.ts',
    'lib/evidence-dossier/package-validator.ts',
    'lib/evidence-dossier/digest-browser.ts',
    'app/internal/evidence-dossier/operator/OperatorConsole.tsx',
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from 'node:/, `${file} imports a Node built-in`)
    assert.doesNotMatch(source, /\bBuffer\./, `${file} uses Buffer`)
    assert.doesNotMatch(source, /from '\.\/digest\.ts'/, `${file} imports the Node digest module`)
  }
})
